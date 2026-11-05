// ═══════════════════════════════════════════════════════════════════════════
// hotmart-webhook — liga e desliga o Doonly PRO sozinho, conforme a Hotmart avisa (02/10)
//
// Endereço (cadastrar na Hotmart):  https://<projeto>.supabase.co/functions/v1/hotmart-webhook
// Segredos (Supabase → Edge Functions → Secrets):
//   HOTMART_HOTTOK      → o token "hottok" que a Hotmart mostra na tela do Webhook (obrigatório)
//   HOTMART_PRODUTO_ID  → id do produto Doonly PRO na Hotmart (opcional: ignora eventos de outros produtos)
// Publicar SEM verificação de JWT (a Hotmart não manda login do Supabase).
//
// Regras:
//   compra aprovada / concluída ............ PRO ligado até a próxima cobrança (+3 dias de folga)
//   (31/10) teste grátis (compra de R$ 0) .. PRO ligado só pelos 7 dias do teste (+1 dia para a 1ª cobrança passar);
//                                            a 1ª cobrança (compra paga) estende para o mês
//   assinatura cancelada pelo cliente ...... PRO continua até o fim do período já pago (ou do teste)
//   reembolso / chargeback / cancelamento .. PRO desligado na hora
//   pagamento atrasado ..................... nada muda; marca "atrasada" (o PRO vence sozinho na data)
//   outros eventos ......................... só ficam registrados
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const HOTTOK = Deno.env.get("HOTMART_HOTTOK") || "";
const PRODUTO_ID = (Deno.env.get("HOTMART_PRODUTO_ID") || "").trim();

const FOLGA_DIAS = 3;     // tolerância depois da data da próxima cobrança
const PERIODO_DIAS = 31;  // se a Hotmart não informar a próxima cobrança
const TESTE_DIAS = 7;     // (31/10) período grátis da oferta na Hotmart
const FOLGA_TESTE_DIAS = 1;

const LIGAR = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);
const DESLIGAR = new Set(["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_CANCELED", "PURCHASE_PROTEST"]);
const CANCELAR_NO_FIM = new Set(["SUBSCRIPTION_CANCELLATION"]);
const ATRASO = new Set(["PURCHASE_DELAYED"]);

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

/** Datas da Hotmart chegam em milissegundos (número) ou como texto ISO */
function paraData(v: unknown): Date | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" || /^\d+$/.test(String(v)) ? new Date(Number(v)) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}
const maisDias = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

/** Comparação que não vaza o tamanho do token pelo tempo de resposta */
function iguais(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "use POST" });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { erro: "corpo inválido" }); }

  // 1) Segurança: o token tem que ser o da sua conta Hotmart
  const recebido = req.headers.get("x-hotmart-hottok") || body?.hottok || "";
  if (!HOTTOK || !iguais(String(recebido), HOTTOK)) return json(401, { erro: "hottok inválido" });

  const evento = String(body?.event || "");
  const idEvento = String(body?.id || "");
  const d = body?.data || {};
  if (!evento || !idEvento) return json(400, { erro: "evento sem id" });

  // 2) Só o produto Doonly PRO (se configurado)
  const produto = String(d?.product?.id ?? "");
  if (PRODUTO_ID && produto && produto !== PRODUTO_ID) return json(200, { ok: true, ignorado: "outro produto" });

  // 3) Não processar o mesmo aviso duas vezes (a Hotmart pode reenviar)
  const { data: jaTem } = await sb.from("hotmart_eventos").select("id").eq("id", idEvento).maybeSingle();
  if (jaTem) return json(200, { ok: true, repetido: true });

  const email = String(d?.buyer?.email || d?.subscriber?.email || d?.subscription?.subscriber?.email || "").trim().toLowerCase();
  const transacao = d?.purchase?.transaction ?? null;
  const assinante = d?.subscription?.subscriber?.code || d?.subscriber?.code || null;
  const proxCobranca = paraData(d?.purchase?.date_next_charge ?? d?.date_next_charge ?? d?.subscription?.date_next_charge);
  // Os avisos de compra não trazem a próxima cobrança: conta 1 mês a partir da APROVAÇÃO da compra
  // (o "Compra completa" chega ~7 dias depois; contar da chegada do aviso daria dias de PRO a mais).
  const aprovadaEm = paraData(d?.purchase?.approved_date) || new Date();
  // (31/10) teste grátis: a Hotmart registra a adesão como uma compra de valor zero
  const valor = Number(d?.purchase?.price?.value ?? d?.purchase?.full_price?.value);
  const teste = LIGAR.has(evento) && Number.isFinite(valor) && valor === 0;

  // 4) Acha a conta pelo e-mail da compra
  let userId: string | null = null;
  if (email) {
    const { data: uid } = await sb.rpc("hotmart_usuario_por_email", { p_email: email });
    userId = (uid as string) || null;
  }

  let resultado = "registrado";
  let expira: Date | null = null;
  let mudanca: Record<string, unknown> | null = null;

  if (teste) {
    // Só os dias do teste: se a 1ª cobrança passar, a compra paga estende; se não, o PRO vence sozinho
    expira = maisDias(proxCobranca || maisDias(aprovadaEm, TESTE_DIAS), FOLGA_TESTE_DIAS);
    mudanca = { plano: "pro", pro_expira_em: expira.toISOString(), assinatura_origem: "hotmart", assinatura_status: "teste",
      ...(assinante ? { hotmart_assinante: assinante } : {}), ...(transacao ? { hotmart_transacao: transacao } : {}) };
    resultado = "teste_gratis";
  } else if (LIGAR.has(evento)) {
    // Ligado até a próxima cobrança + folga. Sem a data, 1 mês depois da aprovação da compra.
    expira = maisDias(proxCobranca || maisDias(aprovadaEm, PERIODO_DIAS), FOLGA_DIAS);
    mudanca = { plano: "pro", pro_expira_em: expira.toISOString(), assinatura_origem: "hotmart", assinatura_status: "ativa",
      ...(assinante ? { hotmart_assinante: assinante } : {}), ...(transacao ? { hotmart_transacao: transacao } : {}) };
    resultado = "pro_ativado";
  } else if (DESLIGAR.has(evento)) {
    mudanca = { plano: "free", pro_expira_em: new Date().toISOString(), assinatura_status: "reembolsada" };
    resultado = "pro_removido";
  } else if (CANCELAR_NO_FIM.has(evento)) {
    // Continua PRO até o fim do que já foi pago: não encurta nem estende a data atual.
    mudanca = { assinatura_status: "cancelada" };
    if (proxCobranca) { expira = proxCobranca; mudanca.pro_expira_em = proxCobranca.toISOString(); }
    resultado = "cancelada_no_fim_do_periodo";
  } else if (ATRASO.has(evento)) {
    mudanca = { assinatura_status: "atrasada" };
    resultado = "pagamento_atrasado";
  } else {
    resultado = "ignorado";
  }

  // 5) Aplica na conta (ou deixa guardado pra quando ela se cadastrar)
  if (mudanca) {
    if (userId) {
      const { data: perfil } = await sb.from("profiles").select("plano, pro_expira_em, hotmart_transacao, hotmart_assinante").eq("id", userId).maybeSingle();
      const atual = paraData((perfil as any)?.pro_expira_em);
      const jaPro = (perfil as any)?.plano === "pro";
      // (6.157) reembolso/cancelamento de OUTRA compra (ex.: boleto que venceu depois que ela pagou no cartão, ou uma
      // compra antiga) não derruba a assinatura ativa: só vale se for a mesma transação ou o mesmo assinante
      const transPerfil = (perfil as any)?.hotmart_transacao || null, assPerfil = (perfil as any)?.hotmart_assinante || null;
      const mesmaCompra = (transacao && transPerfil && String(transacao) === String(transPerfil)) || (assinante && assPerfil && String(assinante) === String(assPerfil));
      const temRegistro = !!(transPerfil || assPerfil);
      if ((DESLIGAR.has(evento) || CANCELAR_NO_FIM.has(evento)) && temRegistro && !mesmaCompra) { mudanca = null; resultado = "ignorado_outra_compra"; }
      // Cancelamento: nunca aumenta o prazo que ela já tem
      if (mudanca && CANCELAR_NO_FIM.has(evento) && mudanca.pro_expira_em && atual && atual < new Date(String(mudanca.pro_expira_em))) delete mudanca.pro_expira_em;
      // (31/10) aviso do teste chegando depois da 1ª cobrança (ex.: "Compra completa" de R$ 0): não volta para "teste"
      if (teste && jaPro && atual && expira && atual > expira) { mudanca = null; resultado = "teste_ignorado_ja_paga"; }
      // Compra: nunca ENCURTA um prazo maior que ela já tenha (ex.: aviso atrasado chegando depois da renovação)
      else if (mudanca && LIGAR.has(evento) && atual && jaPro && expira && atual > expira) {
        expira = atual; mudanca.pro_expira_em = atual.toISOString();
      }
      if (mudanca) {
        const { error } = await sb.from("profiles").update(mudanca).eq("id", userId);
        if (error) {
          console.error("Erro ao atualizar perfil:", error.message);
          return json(500, { erro: "não foi possível atualizar a conta" }); // a Hotmart tenta de novo
        }
      }
    } else if (LIGAR.has(evento)) {
      resultado = teste ? "teste_sem_conta" : "sem_conta"; // aplicado automaticamente quando ela criar a conta com esse e-mail
    } else {
      resultado += "_sem_conta";
      // (6.157) reembolso/estorno antes de criar a conta: o PRO guardado daquela compra não é mais aplicado no cadastro
      if (DESLIGAR.has(evento) && email) {
        const { data: pend } = await sb.from("hotmart_eventos").select("id, transacao, assinante").eq("email", email).in("resultado", ["sem_conta", "teste_sem_conta"]);
        const alvo = ((pend as any[]) || []).filter(e => (!transacao && !assinante) || (transacao && String(e.transacao) === String(transacao)) || (assinante && String(e.assinante) === String(assinante)));
        if (alvo.length) {
          const { error: eP } = await sb.from("hotmart_eventos").update({ resultado: "reembolsado_sem_conta" }).in("id", alvo.map(e => e.id));
          if (eP) { console.error("Erro ao cancelar o PRO guardado:", eP.message); return json(500, { erro: "não foi possível registrar o reembolso" }); }
        }
      }
    }
  }

  // 6) Registra o evento
  const { error: errLog } = await sb.from("hotmart_eventos").insert({
    id: idEvento, evento, email: email || null, user_id: userId, transacao, assinante, resultado,
    pro_expira_em: expira ? expira.toISOString() : null, payload: body,
  });
  if (errLog) console.error("Erro ao registrar evento:", errLog.message);

  return json(200, { ok: true, evento, resultado });
});
