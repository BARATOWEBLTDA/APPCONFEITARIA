/**
 * (6.145) Página de vendas em doonly.com.br/ (antes vinha a plano de usar o WordPress em vendas.doonly.com.br).
 * Depois do build, o HTML do app vira dist/app.html (a Vercel manda todas as rotas do app para ele) e o
 * dist/index.html passa a ser a página de vendas, montada com os arquivos do plugin (landing/ e public/site/).
 * Para trocar a página: substitua landing/landing.html, landing/head.html e public/site/ pelos do plugin novo.
 */
import fs from 'node:fs'
import path from 'node:path'

const TITULO = 'Doonly · O app da sua confeitaria, do pedido ao lucro'
const PIXELS = ['993511453142629', '1001203303966677']
const MIDIA = '/site/media/'
// (17/11) /pro: mesma landing, mas o CTA vai direto pro checkout do PRO na Hotmart (7 dias grátis), o mesmo
// link do botão "Testar grátis por 7 dias" do app. sck=lp-pro só marca a origem dessa campanha pra você separar.
const HOTMART_PRO = 'https://pay.hotmart.com/M107866310B?off=elyrqwi7&checkoutMode=10&sck=lp-pro'
// trocas de copy da versão /pro: a página não pode falar "grátis / criar conta" se o botão pede cartão.
// (mais longas primeiro, pra não casar pedaço de outra)
const TROCAS_PRO: [string, string][] = [
  ['Comece grátis. Profissionalize sua confeitaria.', 'Teste o PRO grátis por 7 dias.'],
  ['Quero criar minha conta grátis', 'Quero testar o PRO grátis por 7 dias'],
  ['Criar minha conta grátis', 'Testar o PRO grátis por 7 dias'],
  ['Criar conta grátis', 'Testar o PRO grátis'],
  ['Comece agora mesmo. ', 'Comece agora. '],
  ['Crie sua conta grátis.', 'Teste o PRO grátis.'],
]

export function montarLanding(raiz: string, dist: string, versao: string) {
  const app = path.join(dist, 'index.html')
  if (!fs.existsSync(app)) return
  fs.renameSync(app, path.join(dist, 'app.html'))

  const head = fs.readFileSync(path.join(raiz, 'landing/head.html'), 'utf8')
    .replaceAll('{{DL_MIDIA}}', MIDIA)
    .replaceAll('https://vendas.doonly.com.br/', 'https://doonly.com.br/')
  // base comum (mídia + botão Entrar); o destino do CTA de cadastro muda por versão
  const corpoBase = fs.readFileSync(path.join(raiz, 'landing/landing.html'), 'utf8')
    .replaceAll('{{DL_MIDIA}}', MIDIA)
    .replace(/href="[^"]*" data-dl-url="entrar"/g, 'href="/login" data-dl-url="entrar"')
  // raiz (grátis): CTA vai pro cadastro do app
  const corpo = corpoBase
    .replace(/href="[^"]*" data-dl-url="cadastro"/g, 'href="/cadastro" data-dl-url="cadastro"')
  // /pro: CTA vai pro checkout da Hotmart + copy de teste do PRO
  let corpoPro = corpoBase
    .replace(/href="[^"]*" data-dl-url="cadastro"/g, `href="${HOTMART_PRO}" data-dl-url="cadastro"`)
  for (const [de, para] of TROCAS_PRO) corpoPro = corpoPro.split(de).join(para)
  const pixel = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${PIXELS.map(id => `fbq('init', '${id}');`).join('\n')}
fbq('track', 'PageView');
</script>`
  const fazerHtml = (corpoPagina: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>
/* app instalado no celular (o iPhone guarda o endereço de quando instalou) ou quem já está logada: vai direto para o app */
(function(){try{var app=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
var logada=Object.keys(localStorage).some(function(k){return k.indexOf('sb-')===0&&k.indexOf('auth-token')>0&&localStorage.getItem(k)});
var loja=/DoonlyApp/.test(navigator.userAgent);
if((app||logada||loja)&&!/[?&]site=1/.test(location.search))location.replace('/inicio'+location.search+location.hash);}catch(e){}})();
</script>
<title>${TITULO}</title>
${head}
<meta property="og:image" content="https://doonly.com.br/og-doonly.jpg?v=1">
<link rel="icon" type="image/png" sizes="32x32" href="${MIDIA}img-19-3e3d99de72.png">
<link rel="icon" type="image/png" sizes="64x64" href="${MIDIA}img-20-5808a732d3.png">
<link rel="apple-touch-icon" sizes="180x180" href="${MIDIA}img-21-3f6494f498.png">
<link rel="stylesheet" href="/site/css/doonly-landing.css?v=${versao}">
${pixel}
</head>
<body>
${PIXELS.map(id => `<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=${id}&amp;ev=PageView&amp;noscript=1"></noscript>`).join('\n')}
${corpoPagina}
<script src="/site/js/doonly-landing.js?v=${versao}"></script>
</body>
</html>
`
  fs.writeFileSync(app, fazerHtml(corpo))                       // raiz: doonly.com.br (cadastro grátis)
  fs.writeFileSync(path.join(dist, 'pro.html'), fazerHtml(corpoPro)) // doonly.com.br/pro (checkout do PRO)
}
