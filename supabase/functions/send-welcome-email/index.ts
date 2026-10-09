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

// ── E-mail de boas-vindas (09/10 · refeito no padrão do guia) ──────────
// 600px (padrão de e-mail), título em texto (aparece mesmo com imagens bloqueadas),
// botão "Abrir o Doonly", os mesmos primeiros passos do app e versão só texto.
const APP_URL = "https://doonly.com.br/inicio";
const ZAP_EQUIPE = "5511978414991";

function primeiroNomeDe(nome: string): string {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}
function esc(t: string): string {
  return t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

const PASSOS: [string, string][] = [
  ["Conte sobre a sua confeitaria", "Nome, logo, endereço e horário. É o que a cliente vê no topo do cardápio."],
  ["Cadastre o primeiro produto", "Com foto e preço. Dá pra montar bolos por tamanho, sabor e recheio."],
  ["Mande o link do cardápio", "Suas clientes pedem por ali e o pedido chega no seu WhatsApp e na sua agenda."],
];

export function assuntoBoasVindas(nome: string): string {
  const n = primeiroNomeDe(nome);
  return n ? `Boas-vindas ao Doonly, ${n}` : "Boas-vindas ao Doonly";
}

export function textoBoasVindas(nome: string): string {
  const n = primeiroNomeDe(nome);
  return [
    n ? `Olá, ${n}!` : "Olá!",
    "",
    "Sua conta no Doonly está pronta. Agora você organiza pedidos, clientes, cardápio e o financeiro da confeitaria num lugar só.",
    "",
    "Comece por aqui:",
    ...PASSOS.map(([t, d], i) => `${i + 1}. ${t}: ${d}`),
    "",
    `Abrir o Doonly: ${APP_URL}`,
    "",
    "Dica: instale o Doonly na tela inicial do celular pra abrir com um toque.",
    "",
    `Dúvida? Fale com a gente no WhatsApp: https://wa.me/${ZAP_EQUIPE} ou contato@doonly.com.br`,
    "",
    "Equipe Doonly",
  ].join("\n");
}

function buildWelcomeEmailHTML(nome: string): string {
  const n = esc(primeiroNomeDe(nome));
  const passos = PASSOS.map(([t, d], i) => `
                <tr>
                  <td width="44" valign="top" style="padding:${i ? "16px" : "0"} 0 0;">
                    <div style="width:32px;height:32px;line-height:32px;border-radius:16px;background-color:#FDF2F6;color:#C33A6E;font-size:15px;font-weight:700;text-align:center;">${i + 1}</div>
                  </td>
                  <td valign="top" style="padding:${i ? "16px" : "0"} 0 0;">
                    <div style="font-size:16px;font-weight:700;color:#2C1219;line-height:1.35;">${t}</div>
                    <div style="margin-top:2px;font-size:14px;color:#6B5D64;line-height:1.5;">${d}</div>
                  </td>
                </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <meta name="x-apple-disable-message-reformatting">
  <title>Boas-vindas ao Doonly</title>
  <style>
    @media (max-width: 620px) {
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .h1 { font-size: 24px !important; }
      .bt a { display: block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F4EEF1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2C1219;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F4EEF1;opacity:0;">
    Sua conta está pronta. Veja os 3 primeiros passos pra começar a vender pelo cardápio.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4EEF1;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EADFE4;overflow:hidden;">

          <tr>
            <td style="padding:0;line-height:0;font-size:0;">
              <a href="${APP_URL}" target="_blank" style="text-decoration:none;">
                <img src="https://raw.githubusercontent.com/BARATOWEBLTDA/APPCONFEITARIA/main/public/emails/banner.png" width="600" alt="Doonly: sua confeitaria acaba de ganhar uma ajudinha"
                     style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;">
              </a>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:32px 40px 8px;">
              <h1 class="h1" style="margin:0;font-size:26px;font-weight:800;line-height:1.25;color:#2C1219;">${n ? `Boas-vindas, ${n}!` : "Boas-vindas ao Doonly!"}</h1>
              <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:#4B3A42;">
                Sua conta está pronta. Agora você organiza <strong style="color:#2C1219;">pedidos, clientes, cardápio e o financeiro</strong> da confeitaria num lugar só, com menos correria.
              </p>
            </td>
          </tr>

          <tr>
            <td class="px bt" align="left" style="padding:24px 40px 8px;">
              <a href="${APP_URL}" target="_blank"
                 style="display:inline-block;padding:15px 28px;border-radius:13px;background-color:#E85A8C;border-bottom:3px solid #C33A6E;color:#FFFFFF;font-size:16px;font-weight:700;line-height:1;text-decoration:none;text-align:center;">
                Abrir o Doonly
              </a>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:24px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFFFF;border:1px solid #EADFE4;border-radius:16px;">
                <tr>
                  <td style="padding:20px 20px 22px;">
                    <div style="margin:0 0 16px;font-size:16px;font-weight:800;color:#2C1219;">Comece por aqui</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${passos}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3EEF1;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.5;color:#4B3A42;">
                    <strong style="color:#2C1219;">Dica:</strong> instale o Doonly na tela inicial do celular. Ele abre com um toque, como um aplicativo.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:28px 40px 32px;border-top:1px solid #F5F0F2;">
              <p style="margin:0;font-size:15px;line-height:1.55;color:#4B3A42;">Ficamos felizes em fazer parte da sua confeitaria.</p>
              <p style="margin:4px 0 20px;font-size:15px;font-weight:700;color:#2C1219;">Equipe Doonly</p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#6B5D64;">
                Dúvida? Fale com a gente no
                <a href="https://wa.me/${ZAP_EQUIPE}" target="_blank" style="color:#C33A6E;font-weight:700;text-decoration:none;">WhatsApp</a>
                ou em
                <a href="mailto:contato@doonly.com.br" style="color:#C33A6E;font-weight:700;text-decoration:none;">contato@doonly.com.br</a>.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9A8E94;text-align:center;">
          Você recebeu este e-mail porque criou uma conta no Doonly.<br>
          <a href="https://doonly.com.br" style="color:#9A8E94;text-decoration:none;">doonly.com.br</a> &middot; &copy; 2026 Doonly
        </p>
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
          subject: assuntoBoasVindas(nome),
          html,
          text: textoBoasVindas(nome),
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
          subject: assuntoBoasVindas(nome),
          html,
          text: textoBoasVindas(nome),
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
