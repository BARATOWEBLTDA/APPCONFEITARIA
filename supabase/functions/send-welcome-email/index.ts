// ─────────────────────────────────────────────────────────────
// Edge Function: send-welcome-email
//
// Envia um e-mail de boas-vindas via Resend após o cadastro.
// Fire-and-forget: chamada do handleCadastro sem bloquear a UX.
//
// Segurança:
// - Requer JWT válido (usuária tem que estar autenticada)
// - Só envia pro email do próprio user (não permite abuso)
// - Rate limit: uma vez por conta (dedup no banco por welcome_sent_at)
//
// Setup requerido:
// 1. Secret RESEND_API_KEY configurada no projeto Supabase
// 2. Coluna profiles.welcome_email_sent_at (opcional, previne duplicatas)
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Template HTML de boas-vindas (branded Doonly) ──────────
// Segue mesmo padrão premium dos templates de Auth (01-04):
// header vinho, hero circular, card de dicas, footer "Equipe Doonly"
function buildWelcomeEmailHTML(nome: string): string {
  const primeiroNome = (nome || "").split(" ")[0] || "confeiteira";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>Bem-vinda ao Doonly!</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F0F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#3D1A24;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F7F0F2;opacity:0;">
    Sua confeitaria mais organizada começa agora. Bora fazer a primeira ação?
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F0F2;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;background-color:#FFFFFF;border-radius:20px;border:1px solid #EFE7EA;box-shadow:0 8px 32px rgba(61,26,36,0.08);overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#986274 0%,#6E3548 100%);padding:56px 32px;">
              <img src="https://raw.githubusercontent.com/BARATOWEBLTDA/APPCONFEITARIA/main/public/mail.png"
                   width="72" height="72"
                   alt="Doonly"
                   style="display:block;margin:0 auto 16px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
              <div style="font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;line-height:1;margin-bottom:12px;">
                Doonly
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.75);letter-spacing:0.12em;text-transform:uppercase;font-weight:500;">
                Bem-vinda ao time
              </div>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td align="center" style="padding:56px 40px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" valign="middle"
                      style="width:88px;height:88px;background-color:#F7F0F2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:40px;line-height:88px;">🍰</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#3D1A24;line-height:1.25;letter-spacing:-0.02em;">
                Bem-vinda, ${primeiroNome}!
              </h1>
              <p style="margin:0 0 12px;font-size:16px;line-height:1.55;color:#4A3439;">
                Sua conta no Doonly está pronta. A partir de agora, você tem tudo o que precisa para organizar pedidos, clientes, receitas e finanças da sua confeitaria em um só lugar.
              </p>
              <p style="margin:0 0 36px;font-size:16px;line-height:1.55;color:#4A3439;">
                Que tal começar agora?
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center"
                      style="background:linear-gradient(135deg,#986274 0%,#6E3548 100%);border-radius:12px;box-shadow:0 6px 20px rgba(110,53,72,0.28);">
                    <a href="https://doonly.com.br/inicio"
                       style="display:inline-block;padding:0 48px;height:54px;line-height:54px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:0.4px;border-radius:12px;">
                      Abrir meu Doonly
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD DE PRIMEIROS PASSOS -->
          <tr>
            <td style="padding:0 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#F7F0F2;border-radius:14px;border:1px solid #EFE7EA;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="margin:0 0 12px;font-size:13px;font-weight:700;color:#6E3548;letter-spacing:0.05em;text-transform:uppercase;">
                      <span style="font-size:15px;vertical-align:middle;">✨</span>
                      <span style="vertical-align:middle;margin-left:6px;">Primeiros passos</span>
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#4A3439;line-height:1.55;vertical-align:top;">
                          <span style="color:#6E3548;font-weight:700;">1.</span>
                          <span style="margin-left:6px;">Cadastre seus <strong>produtos</strong> com fotos e preços.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#4A3439;line-height:1.55;vertical-align:top;">
                          <span style="color:#6E3548;font-weight:700;">2.</span>
                          <span style="margin-left:6px;">Ative seu <strong>cardápio online</strong> e receba pedidos.</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:14px;color:#4A3439;line-height:1.55;vertical-align:top;">
                          <span style="color:#6E3548;font-weight:700;">3.</span>
                          <span style="margin-left:6px;">Configure seus <strong>custos</strong> para ver sua real lucratividade.</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- DIVISOR -->
          <tr>
            <td style="padding:0 40px;">
              <div style="border-top:1px solid #EFE7EA;height:1px;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:32px 40px 40px;">
              <p style="margin:0 0 14px;font-size:14px;font-weight:600;color:#3D1A24;line-height:1.4;">
                Equipe Doonly
              </p>
              <p style="margin:0 0 4px;font-size:13px;color:#8B6F76;line-height:1.55;">
                Precisa de ajuda? Fale com a gente:
              </p>
              <p style="margin:0 0 20px;font-size:13px;line-height:1.55;">
                <a href="mailto:contato@doonly.com.br" style="color:#6E3548;text-decoration:none;font-weight:600;">
                  contato@doonly.com.br
                </a>
              </p>
              <p style="margin:0;font-size:11px;color:#B8A0A6;line-height:1.5;">
                <a href="https://doonly.com.br" style="color:#B8A0A6;text-decoration:none;">doonly.com.br</a>
                &nbsp;·&nbsp;
                © 2026 Doonly
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // ── 1) Valida JWT do usuário ───────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceKey || !resendApiKey) {
      console.error("Missing env vars", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceKey,
        hasResend: !!resendApiKey,
      });
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2) Anti-duplicata: se já enviamos, retorna OK sem reenviar ──
    // Requer coluna `welcome_email_sent_at` em profiles.
    // Se a coluna não existir, o try/catch abaixo apenas ignora e envia mesmo assim.
    try {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("welcome_email_sent_at, nome")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.welcome_email_sent_at) {
        return new Response(JSON.stringify({ ok: true, skipped: "already_sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extrai nome do profile OU do user_metadata
      const nome = profile?.nome
        || (user.user_metadata as Record<string, string> | null)?.nome
        || "";

      // ── 3) Envia via Resend API ───────────────────────────
      const html = buildWelcomeEmailHTML(nome);
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Doonly <contato@doonly.com.br>",
          to: [user.email],
          subject: "Bem-vinda ao Doonly! Sua confeitaria começa aqui 🍰",
          html,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error("Resend error", resendRes.status, errText);
        return new Response(JSON.stringify({ error: "Failed to send email" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── 4) Marca como enviado (best-effort) ───────────────
      // Se a coluna não existir, essa call falha silenciosamente
      // e não bloqueia o retorno de sucesso pro cliente.
      await adminClient
        .from("profiles")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", user.id);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (dbErr) {
      // Se a query no profiles falhar (ex: coluna não existe ainda),
      // ainda tentamos enviar o email — melhor duplicar do que não enviar.
      console.warn("Profile check failed, sending anyway:", dbErr);

      const nome = (user.user_metadata as Record<string, string> | null)?.nome || "";
      const html = buildWelcomeEmailHTML(nome);
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Doonly <contato@doonly.com.br>",
          to: [user.email],
          subject: "Bem-vinda ao Doonly! Sua confeitaria começa aqui 🍰",
          html,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        console.error("Resend error", resendRes.status, errText);
        return new Response(JSON.stringify({ error: "Failed to send email" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, note: "sent_without_dedup" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("send-welcome-email fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
