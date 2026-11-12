// (12/11) Assinatura do PRO pelo Google Play (e depois App Store), avisada pelo RevenueCat.
// O app configura o RevenueCat com o id da conta do Doonly (app_user_id), então a compra já vem com a conta certa.
// Segurança: o RevenueCat manda o cabeçalho Authorization com o segredo LOJA_WEBHOOK_SEGREDO (cadastrado nos dois lados).
// Eventos: compra/renovação/troca/volta → PRO até a data de expiração (+1 dia de folga); cancelamento → continua PRO até o fim;
// expiração → volta ao grátis; problema no pagamento → "atrasada" (o Google ainda tenta cobrar por alguns dias).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (status: number, b: unknown) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const LIGAR = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED", "TEMPORARY_ENTITLEMENT_GRANT"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method !== "POST") return json(405, { erro: "método" });
  const segredo = Deno.env.get("LOJA_WEBHOOK_SEGREDO") || "";
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!segredo || auth !== segredo) return json(401, { erro: "não autorizado" });

  const body = await req.json().catch(() => null) as { event?: Record<string, unknown> } | null;
  const ev = body?.event || {};
  const tipo = String(ev.type || "");
  if (tipo === "TEST") return json(200, { ok: true, teste: true });

  // a conta: o app_user_id (ou um dos apelidos, se a pessoa comprou antes de entrar)
  const ids = [ev.app_user_id, ev.original_app_user_id, ...((ev.aliases as string[]) || [])].map(String).filter(x => UUID.test(x));
  const userId = ids[0];
  if (!userId) return json(200, { ok: true, ignorado: "sem_conta" });

  const loja = String(ev.store || "") === "APP_STORE" ? "app_store" : "google_play";
  const expiraMs = Number(ev.expiration_at_ms || 0);
  const expira = expiraMs ? new Date(expiraMs + 86400000) : null; // +1 dia de folga (renovação que demora um pouco)
  const teste = String(ev.period_type || "") === "TRIAL";

  let mudanca: Record<string, unknown> | null = null;
  if (LIGAR.has(tipo) && expira) mudanca = { plano: "pro", pro_expira_em: expira.toISOString(), assinatura_origem: loja, assinatura_status: teste ? "teste" : "ativa" };
  else if (tipo === "CANCELLATION") mudanca = { assinatura_status: "cancelada", ...(expira ? { pro_expira_em: expira.toISOString() } : {}) };
  else if (tipo === "EXPIRATION") mudanca = { plano: "free", pro_expira_em: new Date().toISOString(), assinatura_status: "expirada" };
  else if (tipo === "BILLING_ISSUE") mudanca = { assinatura_status: "atrasada" };
  if (!mudanca) return json(200, { ok: true, ignorado: tipo });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: perfil } = await sb.from("profiles").select("plano, pro_expira_em, assinatura_origem").eq("id", userId).maybeSingle();
  if (!perfil) return json(200, { ok: true, ignorado: "conta_nao_existe" });
  const atual = perfil.pro_expira_em ? new Date(perfil.pro_expira_em) : null;
  // quem também é PRO pela Hotmart (ou ganhou PRO da equipe) com prazo maior: o fim da assinatura do Google não derruba
  if ((tipo === "EXPIRATION" || tipo === "CANCELLATION") && perfil.assinatura_origem && perfil.assinatura_origem !== loja && atual && atual > new Date()) {
    return json(200, { ok: true, ignorado: "outra_assinatura_ativa" });
  }
  // compra: nunca encurta um prazo maior que ela já tenha
  if (LIGAR.has(tipo) && atual && expira && atual > expira && perfil.plano === "pro") mudanca.pro_expira_em = atual.toISOString();
  // cancelamento: nunca aumenta o prazo
  if (tipo === "CANCELLATION" && atual && mudanca.pro_expira_em && atual < new Date(String(mudanca.pro_expira_em))) delete mudanca.pro_expira_em;

  const { error } = await sb.from("profiles").update(mudanca).eq("id", userId);
  if (error) return json(500, { erro: error.message }); // o RevenueCat tenta de novo
  return json(200, { ok: true, tipo, userId });
});
