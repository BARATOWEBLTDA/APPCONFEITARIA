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
  const primeiroNome = (nome || "").split(" ")[0] || "";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="x-apple-disable-message-reformatting">
  <title>Boas-vindas ao Doonly</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F0F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#3D1A24;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F7F0F2;opacity:0;">
    Sua conta no Doonly está pronta. Comece agora.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F7F0F2;padding:20px 8px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:720px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EFE7EA;box-shadow:0 4px 16px rgba(61,26,36,0.06);overflow:hidden;">

          <!-- BANNER -->
          <tr>
            <td align="center" style="padding:0;line-height:0;font-size:0;">
              <img src="https://raw.githubusercontent.com/BARATOWEBLTDA/APPCONFEITARIA/main/public/emails/banner.png"
                   alt="Doonly — Sua confeitaria acaba de ganhar uma ajudinha"
                   width="720"
                   style="display:block;width:100%;max-width:720px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:36px 44px 32px;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4A3439;">
                Olá${primeiroNome ? `, ${primeiroNome}` : ""}! A partir de agora, você pode organizar <strong>produtos, pedidos, clientes</strong> e sua rotina em um só lugar &mdash; com mais clareza e menos correria.
              </p>
            </td>
          </tr>

          <!-- CARD DE 3 PASSOS -->
          <tr>
            <td style="padding:0 44px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background-color:#FBF6F7;border-radius:12px;border:1px solid #EFE7EA;">
                <tr>
                  <td style="padding:22px 22px 20px;">
                    <div style="margin:0 0 18px;font-size:11px;font-weight:700;color:#6E3548;letter-spacing:0.12em;text-transform:uppercase;">
                      Comece em 3 passos
                    </div>

                    <!-- Passo 1 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="42" style="vertical-align:top;padding-top:2px;">
                          <div style="font-size:20px;font-weight:800;color:#986274;letter-spacing:-0.02em;line-height:1;">01</div>
                        </td>
                        <td style="padding-bottom:14px;vertical-align:top;">
                          <div style="font-size:15px;font-weight:700;color:#3D1A24;line-height:1.3;margin:0 0 3px;">Configure sua confeitaria</div>
                          <div style="font-size:13.5px;color:#7A5F65;line-height:1.5;">Adicione nome, logo e informações do seu negócio.</div>
                        </td>
                      </tr>
                    </table>

                    <div style="border-top:1px solid #EFE7EA;height:1px;line-height:1px;font-size:1px;margin:0 0 14px;">&nbsp;</div>

                    <!-- Passo 2 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="42" style="vertical-align:top;padding-top:2px;">
                          <div style="font-size:20px;font-weight:800;color:#986274;letter-spacing:-0.02em;line-height:1;">02</div>
                        </td>
                        <td style="padding-bottom:14px;vertical-align:top;">
                          <div style="font-size:15px;font-weight:700;color:#3D1A24;line-height:1.3;margin:0 0 3px;">Cadastre seu primeiro produto</div>
                          <div style="font-size:13.5px;color:#7A5F65;line-height:1.5;">Monte seu cardápio com preços, sabores e opções.</div>
                        </td>
                      </tr>
                    </table>

                    <div style="border-top:1px solid #EFE7EA;height:1px;line-height:1px;font-size:1px;margin:0 0 14px;">&nbsp;</div>

                    <!-- Passo 3 -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="42" style="vertical-align:top;padding-top:2px;">
                          <div style="font-size:20px;font-weight:800;color:#986274;letter-spacing:-0.02em;line-height:1;">03</div>
                        </td>
                        <td style="vertical-align:top;">
                          <div style="font-size:15px;font-weight:700;color:#3D1A24;line-height:1.3;margin:0 0 3px;">Registre seu primeiro pedido</div>
                          <div style="font-size:13.5px;color:#7A5F65;line-height:1.5;">E veja o Doonly ajudando a manter tudo organizado.</div>
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
            <td style="padding:0 44px;">
              <div style="border-top:1px solid #EFE7EA;height:1px;line-height:1px;font-size:1px;">&nbsp;</div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="padding:32px 44px 40px;">
              <p style="margin:0 0 6px;font-size:14px;color:#4A3439;line-height:1.55;">
                Estamos felizes em fazer parte do crescimento da sua confeitaria. <span style="color:#E85A8C;">&#10084;</span>
              </p>
              <p style="margin:0 0 22px;font-size:14px;font-weight:700;color:#3D1A24;line-height:1.4;">
                Equipe Doonly
              </p>
              <p style="margin:0 0 4px;font-size:13px;color:#8B6F76;line-height:1.55;">
                Dúvida ou sugestão? Fala com a gente:
              </p>
              <p style="margin:0 0 18px;font-size:13px;line-height:1.55;">
                <a href="mailto:contato@doonly.com.br" style="color:#6E3548;text-decoration:none;font-weight:600;">
                  contato@doonly.com.br
                </a>
              </p>
              <p style="margin:0;font-size:11px;color:#B8A0A6;line-height:1.5;">
                <a href="https://doonly.com.br" style="color:#B8A0A6;text-decoration:none;">doonly.com.br</a>
                &nbsp;&middot;&nbsp;
                &copy; 2026 Doonly
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
          subject: "Doonly: sua conta está pronta",
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
          subject: "Doonly: sua conta está pronta",
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
