// ─────────────────────────────────────────────────────────────
// E-mail "Seu Doonly PRO está ativo" (27/10) · mesmo visual do de boas-vindas
// ─────────────────────────────────────────────────────────────
export const APP_URL = "https://doonly.com.br/inicio";
const ZAP_EQUIPE = "5511978414991";

function primeiroNomeDe(nome: string): string {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}
function esc(t: string): string {
  return t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

const GANHOU: string[] = [
  "Todos os produtos no cardápio, sem limite",
  "Lucratividade de cada produto e do mês",
  "Doo IA com 150 mensagens por dia e imagens",
  "Cupons e complementos sem limite",
  "Cardápio com a sua cor e o nome da loja no link",
  "Sem o “Feito com Doonly” no cardápio e nos PDFs",
];

export function assuntoPro(nome: string): string {
  const n = primeiroNomeDe(nome);
  return n ? `Seu Doonly PRO está ativo, ${n}` : "Seu Doonly PRO está ativo";
}

export function textoPro(nome: string): string {
  const n = primeiroNomeDe(nome);
  return [
    n ? `Olá, ${n}!` : "Olá!",
    "",
    "Obrigado por assinar. Tudo do Doonly PRO já está liberado na sua conta.",
    "",
    "O que você ganhou:",
    ...GANHOU.map(g => `- ${g.replace(/[“”]/g, '"')}`),
    "",
    `Abrir o Doonly: ${APP_URL}`,
    "",
    "A cobrança é mensal, pela Hotmart, sem fidelidade. Para ver ou cancelar, abra Minha assinatura no app.",
    "",
    `Dúvida? Fale com a gente no WhatsApp: https://wa.me/${ZAP_EQUIPE} ou contato@doonly.com.br`,
    "",
    "Equipe Doonly",
  ].join("\n");
}

export function htmlPro(nome: string): string {
  const n = esc(primeiroNomeDe(nome));
  const ganhou = GANHOU.map((g, i) => `
                <tr>
                  <td width="32" valign="top" style="padding:${i ? "10px" : "0"} 0 0;">
                    <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background-color:#E85A8C;color:#FFFFFF;font-size:13px;font-weight:700;text-align:center;">&#10003;</div>
                  </td>
                  <td valign="top" style="padding:${i ? "10px" : "0"} 0 0;font-size:15px;line-height:1.45;color:#2C1219;">${esc(g)}</td>
                </tr>`).join("");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <meta name="x-apple-disable-message-reformatting">
  <title>Seu Doonly PRO está ativo</title>
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
    Tudo do PRO já está liberado na sua conta.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4EEF1;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EADFE4;overflow:hidden;">

          <tr>
            <td class="px" style="padding:28px 40px 26px;background-color:#22130E;">
              <div style="font-size:13px;font-weight:700;letter-spacing:0.14em;color:#F2C46D;">DOONLY PRO</div>
              <div style="margin-top:8px;font-size:15px;line-height:1.5;color:#E9DDD8;">Sua confeitaria com tudo liberado.</div>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:32px 40px 8px;">
              <h1 class="h1" style="margin:0;font-size:26px;font-weight:800;line-height:1.25;color:#2C1219;">${n ? `Seu PRO está ativo, ${n}!` : "Seu PRO está ativo!"}</h1>
              <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:#4B3A42;">
                Obrigado por assinar. Tudo do <strong style="color:#2C1219;">Doonly PRO</strong> já está liberado na sua conta.
              </p>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:24px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FDF7F9;border:1px solid #F3DCE6;border-radius:16px;">
                <tr>
                  <td style="padding:20px 20px 22px;">
                    <div style="margin:0 0 14px;font-size:16px;font-weight:800;color:#2C1219;">O que você ganhou</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${ganhou}
                    </table>
                  </td>
                </tr>
              </table>
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
            <td class="px" style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3EEF1;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:14px;line-height:1.5;color:#4B3A42;">
                    A cobrança é mensal, pela Hotmart, <strong style="color:#2C1219;">sem fidelidade</strong>. Para ver ou cancelar, abra <strong style="color:#2C1219;">Minha assinatura</strong> no app.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="px" style="padding:28px 40px 32px;border-top:1px solid #F5F0F2;">
              <p style="margin:0;font-size:15px;line-height:1.55;color:#4B3A42;">Que bom ter você no PRO.</p>
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
          Você recebeu este e-mail porque assinou o Doonly PRO.<br>
          <a href="https://doonly.com.br" style="color:#9A8E94;text-decoration:none;">doonly.com.br</a> &middot; &copy; 2026 Doonly
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
