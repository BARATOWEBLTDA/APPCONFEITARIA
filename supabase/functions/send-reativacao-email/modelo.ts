// (19/11) E-mails de reativação: A = criou a conta e não cadastrou produto; B = tem produto, loja pronta e parou de entrar.
// O HTML é o aprovado em 19/11 (mesmo padrão do e-mail de boas-vindas). As chaves {{...}} são trocadas na hora do envio.

export type Dados = { nome: string; linkCardapio?: string; linkSair: string };

const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export function primeiroNome(nome: string): string {
  const p = (nome || "").trim().split(/\s+/)[0] || "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}
const ZAP = "https://wa.me/5511978414991?text=" + encodeURIComponent("Olá! Quero que a equipe Doonly cadastre o meu cardápio.");

export const ASSUNTO_A = "A gente cadastra seus produtos";
export const ASSUNTO_B = "No próximo cliente, mande seu cardápio";

const HTML_A = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>A gente cadastra seus produtos</title>
<style>
@media (max-width: 620px) { .px { padding-left: 24px !important; padding-right: 24px !important; } .bt a { display: block !important; } }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F4EEF1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2C1219;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F4EEF1;opacity:0;">Produtos, descrições, fotos e banners. Você só chama no WhatsApp.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4EEF1;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EADFE4;overflow:hidden;">
<tr><td class="px" style="padding:28px 40px 0;"><img src="https://doonly.com.br/emails/logo-doonly.png" width="112" alt="Doonly" style="display:block;width:112px;height:auto;border:0;outline:none;"></td></tr>
<tr><td class="px" style="padding:24px 40px 4px;"><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Oi, {{nome}}.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Vimos que você começou a configurar seu cardápio no Doonly, mas ainda não cadastrou seus produtos.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Sabemos que, no meio das encomendas e das mensagens no WhatsApp, nem sempre sobra tempo para organizar tudo.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Por isso, queremos te contar uma coisa: <b style="font-weight:600;">nossa equipe pode fazer esse trabalho para você, sem nenhum custo.</b></p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">A gente cadastra seus produtos e categorias, prepara as descrições, melhora as fotos e até cria os banners da sua loja.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Tudo para deixar seu cardápio bonito e organizado, do seu jeito.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Você só precisa chamar nossa equipe no WhatsApp.</p></td></tr>
<tr><td class="px bt" style="padding:10px 40px 8px;"><a href="https://wa.me/5511978414991?text=Ol%C3%A1!%20Quero%20que%20a%20equipe%20Doonly%20cadastre%20o%20meu%20card%C3%A1pio." target="_blank" style="display:inline-block;padding:15px 28px;border-radius:12px;background-color:#25A85A;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;text-align:center;">Conversar no WhatsApp</a></td></tr>
<tr><td class="px" style="padding:20px 40px 32px;font-size:16px;line-height:1.6;color:#3A2A31;">Equipe Doonly</td></tr>
<tr><td class="px" style="padding:18px 40px 22px;border-top:1px solid #EADFE4;font-size:12.5px;line-height:1.6;color:#8A7C83;">Você recebeu este e-mail porque criou uma conta no Doonly.<br><a href="{{link_sair}}" style="color:#8A7C83;text-decoration:underline;">Não quero mais receber estes e-mails</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
const HTML_B = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<title>No próximo cliente, mande seu cardápio</title>
<style>
@media (max-width: 620px) { .px { padding-left: 24px !important; padding-right: 24px !important; } .bt a { display: block !important; } }
</style>
</head>
<body style="margin:0;padding:0;background-color:#F4EEF1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#2C1219;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#F4EEF1;opacity:0;">Chega de mandar fotos e preços toda vez que alguém pergunta.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4EEF1;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;border:1px solid #EADFE4;overflow:hidden;">
<tr><td class="px" style="padding:28px 40px 0;"><img src="https://doonly.com.br/emails/logo-doonly.png" width="112" alt="Doonly" style="display:block;width:112px;height:auto;border:0;outline:none;"></td></tr>
<tr><td class="px" style="padding:24px 40px 4px;"><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Oi, {{nome}}.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Seu cardápio no Doonly já tem produtos cadastrados e está pronto para receber pedidos.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Agora imagine o próximo cliente chamando no WhatsApp:</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;"><span style="display:block;padding:12px 16px;border-radius:12px;background-color:#F6F1F3;color:#2C1219;">“O que você tem? Tem foto? Quanto custa?”</span></p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Em vez de procurar imagens na galeria e digitar os preços de novo, você pode simplesmente mandar o link do seu cardápio.</p><p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#3A2A31;">Ele vê seus produtos, escolhe o que quer e faz o pedido por ali. E você ganha mais tempo para cuidar das encomendas.</p><div style="margin:6px 0 14px;padding:14px 16px;border:1px solid #EADFE4;border-radius:12px;"><div style="font-size:12.5px;color:#8A7C83;">O link do seu cardápio</div><a href="{{link_cardapio}}" style="font-size:16px;font-weight:600;color:#C33A6E;text-decoration:none;word-break:break-all;">{{link_cardapio_curto}}</a></div></td></tr>
<tr><td class="px bt" style="padding:10px 40px 8px;"><a href="{{link_cardapio}}" target="_blank" style="display:inline-block;padding:15px 28px;border-radius:12px;background-color:#E0457B;color:#FFFFFF;font-size:16px;font-weight:600;text-decoration:none;text-align:center;">Abrir meu cardápio</a></td></tr>
<tr><td class="px" style="padding:20px 40px 32px;font-size:16px;line-height:1.6;color:#3A2A31;">Equipe Doonly</td></tr>
<tr><td class="px" style="padding:18px 40px 22px;border-top:1px solid #EADFE4;font-size:12.5px;line-height:1.6;color:#8A7C83;">Você recebeu este e-mail porque criou uma conta no Doonly.<br><a href="{{link_sair}}" style="color:#8A7C83;text-decoration:underline;">Não quero mais receber estes e-mails</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

function preencher(html: string, d: Dados): string {
  const n = primeiroNome(d.nome);
  const link = d.linkCardapio || "https://doonly.com.br/inicio";
  return html
    .replace("Oi, {{nome}}.", n ? `Oi, ${esc(n)}.` : "Oi.")
    .replaceAll("{{link_cardapio_curto}}", esc(link.replace(/^https?:\/\//, "")))
    .replaceAll("{{link_cardapio}}", esc(link))
    .replaceAll("{{link_sair}}", esc(d.linkSair));
}
export const htmlA = (d: Dados) => preencher(HTML_A, d);
export const htmlB = (d: Dados) => preencher(HTML_B, d);

export function textoA(d: Dados): string {
  const n = primeiroNome(d.nome);
  return [n ? `Oi, ${n}.` : "Oi.", "",
    "Vimos que você começou a configurar seu cardápio no Doonly, mas ainda não cadastrou seus produtos.", "",
    "Sabemos que, no meio das encomendas e das mensagens no WhatsApp, nem sempre sobra tempo para organizar tudo.", "",
    "Por isso, queremos te contar uma coisa: nossa equipe pode fazer esse trabalho para você, sem nenhum custo.", "",
    "A gente cadastra seus produtos e categorias, prepara as descrições, melhora as fotos e até cria os banners da sua loja.", "",
    "Você só precisa chamar nossa equipe no WhatsApp:", ZAP, "", "Equipe Doonly", "", `Não quero mais receber estes e-mails: ${d.linkSair}`].join("\n");
}
export function textoB(d: Dados): string {
  const n = primeiroNome(d.nome);
  return [n ? `Oi, ${n}.` : "Oi.", "",
    "Seu cardápio no Doonly já tem produtos cadastrados e está pronto para receber pedidos.", "",
    "Agora imagine o próximo cliente chamando no WhatsApp: \"O que você tem? Tem foto? Quanto custa?\"", "",
    "Em vez de procurar imagens na galeria e digitar os preços de novo, você pode simplesmente mandar o link do seu cardápio.", "",
    "Ele vê seus produtos, escolhe o que quer e faz o pedido por ali. E você ganha mais tempo para cuidar das encomendas.", "",
    `O link do seu cardápio: ${d.linkCardapio || ""}`, "", "Equipe Doonly", "", `Não quero mais receber estes e-mails: ${d.linkSair}`].join("\n");
}
