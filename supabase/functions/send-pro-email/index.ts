// ─────────────────────────────────────────────────────────────
// Edge Function: send-pro-email (27/10)
//
// Manda o e-mail "Seu Doonly PRO está ativo" quando a conta vira PRO.
// Quem chama: o gatilho notif_pro_ativado (tabela profiles), via pg_net,
// com { user_id } e o cabeçalho x-webhook-secret (o mesmo segredo dos avisos).
//
// - Só envia se a conta estiver PRO no momento do envio
// - Uma vez por ativação: não repete se já mandou nos últimos 25 dias
//   (profiles.pro_email_enviado_em)
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assuntoPro, htmlPro, textoPro } from "./modelo.ts";

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

const INTERVALO_MINIMO_MS = 25 * 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ motivo: "Use POST." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resend = Deno.env.get("RESEND_API_KEY");
    if (!url || !service || !resend) return json({ motivo: "Configuração incompleta." }, 500);

    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const segredo = req.headers.get("x-webhook-secret") || "";
    const { data: ok } = await db.rpc("push_segredo_ok", { s: segredo });
    if (!ok) return json({ motivo: "Proibido" }, 403);

    const corpo = await req.json().catch(() => null) as { user_id?: string } | null;
    const userId = corpo?.user_id;
    if (!userId) return json({ motivo: "Falta a conta." }, 400);

    const { data: perfil } = await db.from("profiles")
      .select("nome, plano, pro_email_enviado_em").eq("id", userId).maybeSingle();
    if (!perfil) return json({ motivo: "Conta não encontrada." }, 404);
    if (perfil.plano !== "pro") return json({ enviado: false, motivo: "A conta não está PRO." });
    if (perfil.pro_email_enviado_em &&
        Date.now() - new Date(perfil.pro_email_enviado_em).getTime() < INTERVALO_MINIMO_MS) {
      return json({ enviado: false, motivo: "Já enviado." });
    }

    const { data: u } = await db.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) return json({ enviado: false, motivo: "Conta sem e-mail." });

    const nome = perfil.nome || (u.user.user_metadata as Record<string, string> | null)?.nome || "";

    // marca antes de enviar: se o gatilho disparar duas vezes seguidas, só um e-mail sai
    await db.from("profiles").update({ pro_email_enviado_em: new Date().toISOString() }).eq("id", userId);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Doonly <contato@doonly.com.br>",
        to: [email],
        subject: assuntoPro(nome),
        html: htmlPro(nome),
        text: textoPro(nome),
      }),
    });
    if (!r.ok) {
      console.error("Resend", r.status, await r.text());
      // devolve a marcação para poder tentar de novo
      await db.from("profiles").update({ pro_email_enviado_em: perfil.pro_email_enviado_em }).eq("id", userId);
      return json({ enviado: false, motivo: "Falha no envio." }, 502);
    }
    return json({ enviado: true });
  } catch (e) {
    console.error("send-pro-email", e);
    return json({ motivo: "Erro interno." }, 500);
  }
});
