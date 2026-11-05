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

export function montarLanding(raiz: string, dist: string, versao: string) {
  const app = path.join(dist, 'index.html')
  if (!fs.existsSync(app)) return
  fs.renameSync(app, path.join(dist, 'app.html'))

  const head = fs.readFileSync(path.join(raiz, 'landing/head.html'), 'utf8')
    .replaceAll('{{DL_MIDIA}}', MIDIA)
    .replaceAll('https://vendas.doonly.com.br/', 'https://doonly.com.br/')
  const corpo = fs.readFileSync(path.join(raiz, 'landing/landing.html'), 'utf8')
    .replaceAll('{{DL_MIDIA}}', MIDIA)
    .replace(/href="[^"]*" data-dl-url="cadastro"/g, 'href="/cadastro" data-dl-url="cadastro"')
    .replace(/href="[^"]*" data-dl-url="entrar"/g, 'href="/login" data-dl-url="entrar"')
  const pixel = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${PIXELS.map(id => `fbq('init', '${id}');`).join('\n')}
fbq('track', 'PageView');
</script>`
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<script>
/* app instalado no celular (o iPhone guarda o endereço de quando instalou) ou quem já está logada: vai direto para o app */
(function(){try{var app=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
var logada=Object.keys(localStorage).some(function(k){return k.indexOf('sb-')===0&&k.indexOf('auth-token')>0&&localStorage.getItem(k)});
if((app||logada)&&!/[?&]site=1/.test(location.search))location.replace('/inicio'+location.search+location.hash);}catch(e){}})();
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
${corpo}
<script src="/site/js/doonly-landing.js?v=${versao}"></script>
</body>
</html>
`
  fs.writeFileSync(app, html)
}
