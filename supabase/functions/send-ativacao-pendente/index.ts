// ─────────────────────────────────────────────────────────────
// Edge Function: send-ativacao-pendente (24/11)
//
// Avisa por e-mail quem comprou o Doonly na Hotmart (PRO mensal ou vitalício)
// e ainda não criou a conta no app — lembrando o passo final ("criar sua conta
// com o mesmo e-mail da compra pra liberar o PRO").
//
// Segurança: precisa do cabeçalho x-webhook-secret (mesmo segredo dos demais).
//
// POST (JSON):
//   { "modo": "teste", "email": "bruno@..." }
//      → manda só pra esse e-mail, pra você ver como chega
//   { "modo": "lote", "emails": ["a@x.com", "b@x.com"] }
//      → manda pra todos os e-mails da lista (ignora quem já tem conta)
//   { "modo": "rodar" }  (padrão)
//      → manda pra todo mundo com compra pendente há 1+ hora sem conta,
//        máx. 1 e-mail por evento (marca "email_ativacao_enviado").
//
// Agendamento sugerido: pg_cron a cada 2 horas, chamando com { "modo": "rodar" }.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);
const SEGREDO = Deno.env.get("WEBHOOK_SECRET") || "";
const RESEND = Deno.env.get("RESEND_API_KEY") || "";

const CADASTRO = "https://doonly.com.br/cadastro";
const WHATSAPP = "https://wa.me/5541998843669";

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}

const ASSUNTO = "Falta só 1 passo pra ativar seu Doonly";

function htmlEmail(email: string, tipo: "mensal" | "vitalicio" | "teste") {
  const titulo = tipo === "vitalicio"
    ? "Seu Doonly vitalício está esperando"
    : tipo === "teste"
    ? "Seu teste grátis do Doonly está esperando"
    : "Seu Doonly PRO está esperando";
  const subt = tipo === "vitalicio"
    ? "Você comprou o Doonly vitalício e falta só 1 passo pra começar a usar: criar sua conta no app."
    : tipo === "teste"
    ? "Você começou o teste grátis e falta só 1 passo pra entrar: criar sua conta no app."
    : "Você comprou o Doonly PRO e falta só 1 passo pra começar a usar: criar sua conta no app.";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#F4EEF1;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2C1A28;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4EEF1;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.04);">
        <tr><td style="background:#22130E;padding:28px 28px 24px;">
          <div style="font:700 28px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#fff;letter-spacing:-.02em;">Doonly</div>
          <div style="height:3px;width:52px;background:#E85A8C;margin-top:8px;border-radius:2px;"></div>
        </td></tr>
        <tr><td style="padding:32px 28px 8px;">
          <h1 style="margin:0 0 10px;font:700 22px/1.25 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2C1A28;">${esc(titulo)}</h1>
          <p style="margin:0 0 20px;font:400 15px/1.55 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#4a3942;">${esc(subt)}</p>
        </td></tr>
        <tr><td style="padding:0 28px 8px;">
          <a href="${CADASTRO}" style="display:block;background:#E85A8C;color:#fff;text-decoration:none;text-align:center;padding:18px 20px;border-radius:12px;font:700 17px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;">Criar minha conta</a>
          <p style="margin:12px 0 0;font:500 13px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8B7A86;text-align:center;">Use este e-mail no cadastro:<br><b style="color:#2C1A28;font-size:14px;">${esc(email)}</b></p>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <p style="margin:0 0 6px;font:600 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2C1A28;">É rápido:</p>
          <ol style="margin:0;padding-left:20px;font:400 14.5px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#4a3942;">
            <li>Toque no botão acima e entre em <b>doonly.com.br/cadastro</b></li>
            <li>Preencha nome, e-mail (<b>${esc(email)}</b>) e uma senha</li>
            <li>Pronto: seu PRO é liberado automaticamente</li>
          </ol>
        </td></tr>
        <tr><td style="padding:24px 28px 8px;">
          <div style="background:#FFF6F9;border-radius:12px;padding:16px 18px;">
            <p style="margin:0 0 6px;font:600 14px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2C1A28;">Precisa de ajuda?</p>
            <p style="margin:0;font:500 13.5px/1.45 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#4a3942;">Chama a gente no WhatsApp:<br>
              <a href="${WHATSAPP}" style="color:#E85A8C;text-decoration:none;font-weight:700;">(41) 99884-3669</a>
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:24px 28px 28px;">
          <p style="margin:0;font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#8B7A86;text-align:center;">Equipe Doonly · doonly.com.br</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function textoEmail(email: string, tipo: "mensal" | "vitalicio" | "teste") {
  const t = tipo === "vitalicio"
    ? "Você comprou o Doonly vitalício"
    : tipo === "teste"
    ? "Você começou o teste grátis do Doonly"
    : "Você comprou o Doonly PRO";
  return `${t} e falta só criar sua conta no app pra começar a usar.

Acesse: ${CADASTRO}
Use este e-mail no cadastro: ${email}

Precisa de ajuda? WhatsApp (41) 99884-3669

Equipe Doonly · doonly.com.br`;
}

async function enviarResend(para: string, assunto: string, html: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Doonly <contato@doonly.com.br>",
      to: [para],
      subject: assunto,
      html,
      text: texto,
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return { ok: false, erro: `Resend ${r.status}: ${txt.slice(0, 200)}` };
  }
  return { ok: true };
}

function classificar(resultado: string): "mensal" | "vitalicio" | "teste" {
  if (resultado === "vitalicio_sem_conta") return "vitalicio";
  if (resultado === "teste_sem_conta") return "teste";
  return "mensal";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "use POST" }, 405);

  // segurança
  const recebido = req.headers.get("x-webhook-secret") || "";
  if (!SEGREDO || recebido !== SEGREDO) return json({ erro: "segredo inválido" }, 401);
  if (!RESEND) return json({ erro: "RESEND_API_KEY não configurado" }, 500);

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const modo: string = body?.modo || "rodar";

  // ─── modo teste: manda pra um e-mail só (sem tocar no banco) ───
  if (modo === "teste") {
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return json({ erro: "falta email" }, 400);
    const tipo = (body?.tipo || "mensal") as "mensal" | "vitalicio" | "teste";
    const r = await enviarResend(email, ASSUNTO, htmlEmail(email, tipo), textoEmail(email, tipo));
    return json({ ok: r.ok, erro: r.erro, email, tipo });
  }

  // ─── busca eventos sem_conta pendentes ───
  let emails: string[];
  if (modo === "lote" && Array.isArray(body?.emails)) {
    emails = body.emails.map((e: unknown) => String(e).trim().toLowerCase()).filter(Boolean);
  } else {
    // modo "rodar" (padrão): pega últimos N dias, pelo menos 1h atrás, sem e-mail enviado
    const dias = Number(body?.dias) || 30;
    const horasAtras = Number(body?.horas_atras) ?? 1;
    const corte = new Date(Date.now() - horasAtras * 3600000).toISOString();
    const limiteBaixo = new Date(Date.now() - dias * 86400000).toISOString();

    const { data: evs, error } = await sb.from("hotmart_eventos")
      .select("id, email, resultado, email_ativacao_enviado")
      .in("resultado", ["sem_conta", "teste_sem_conta", "vitalicio_sem_conta"])
      .gt("recebido_em", limiteBaixo)
      .lt("recebido_em", corte)
      .is("email_ativacao_enviado", null)
      .not("email", "is", null);
    if (error) return json({ erro: "ler eventos: " + error.message }, 500);
    emails = Array.from(new Set((evs || []).map((e: any) => String(e.email).toLowerCase())));
  }

  if (emails.length === 0) return json({ ok: true, enviados: 0, msg: "nenhum pendente" });

  // ─── filtra quem já tem conta (não mandar pra quem já criou) ───
  const { data: users } = await sb.from("auth_users_emails_view").select("email").in("email", emails).catch(async () => {
    // fallback: busca via auth schema diretamente se a view não existir
    return await (sb.from as any)("users").select("email").in("email", emails);
  }) as any;
  // alternativa: usar RPC "hotmart_usuario_por_email" (já existe)
  const semConta: string[] = [];
  for (const em of emails) {
    const { data: uid } = await sb.rpc("hotmart_usuario_por_email", { p_email: em });
    if (!uid) semConta.push(em);
  }

  // ─── busca o tipo de cada e-mail (mensal, vitalicio, teste) ───
  const { data: tiposEv } = await sb.from("hotmart_eventos")
    .select("email, resultado, id")
    .in("email", semConta)
    .in("resultado", ["sem_conta", "teste_sem_conta", "vitalicio_sem_conta"])
    .order("recebido_em", { ascending: false });

  const tipoDe: Record<string, "mensal" | "vitalicio" | "teste"> = {};
  const idsPorEmail: Record<string, string[]> = {};
  for (const e of (tiposEv || []) as any[]) {
    const em = String(e.email).toLowerCase();
    if (!tipoDe[em]) tipoDe[em] = classificar(e.resultado);
    (idsPorEmail[em] ||= []).push(e.id);
  }

  // ─── envia e marca ───
  const resultados: Array<{ email: string; ok: boolean; erro?: string }> = [];
  for (const em of semConta) {
    const tipo = tipoDe[em] || "mensal";
    const r = await enviarResend(em, ASSUNTO, htmlEmail(em, tipo), textoEmail(em, tipo));
    resultados.push({ email: em, ok: r.ok, ...(r.erro ? { erro: r.erro } : {}) });
    if (r.ok) {
      const ids = idsPorEmail[em] || [];
      if (ids.length > 0) {
        await sb.from("hotmart_eventos")
          .update({ email_ativacao_enviado: new Date().toISOString() })
          .in("id", ids);
      }
    }
  }

  const sucesso = resultados.filter(r => r.ok).length;
  return json({
    ok: true,
    enviados: sucesso,
    falhas: resultados.length - sucesso,
    total: resultados.length,
    resultados,
  });
});
