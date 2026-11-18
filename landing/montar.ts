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
  // (17/11) /testes: clone da landing com a seção nova "Veja como o Doonly pode te ajudar" (rascunho, uma função por vez)
  const SECAO_TESTES = `<style>
.tt-sec{padding:56px 20px 64px; background:#FFF7F1; color:#3A2930; font-family:'Geist',system-ui,sans-serif;}
.tt-sec *{box-sizing:border-box;}
.tt-wrap{max-width:1040px; margin:0 auto;}
.tt-cab{text-align:center; max-width:640px; margin:0 auto 40px;}
.tt-olho{font-size:13px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#D13E68; margin:0 0 10px;}
.tt-h2{font-size:clamp(26px,5vw,38px); font-weight:700; line-height:1.12; margin:0 0 12px; color:#4E0F25; letter-spacing:-.01em;}
.tt-h2 b{color:#E8577F;}
.tt-sub{font-size:16px; line-height:1.55; color:#8C6B77; margin:0;}
.tt-rec{display:flex; gap:40px; align-items:center; background:#fff; border:1px solid #F3DCE4; border-radius:22px; padding:28px; box-shadow:0 18px 50px -30px rgba(110,27,54,.35);}
.tt-rec__tela{flex:none; width:272px;}
.tt-rec__moldura{border-radius:26px; background:#120a0e; padding:8px; box-shadow:0 16px 40px -22px rgba(0,0,0,.6);}
.tt-rec__moldura img{display:block; width:100%; border-radius:19px;}
.tt-rec__tx{flex:1; min-width:0;}
.tt-tag{display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:600; color:#D13E68; background:#FBEAE1; padding:6px 12px; border-radius:9px; margin:0 0 14px;}
.tt-tag svg{width:16px; height:16px;}
.tt-rec__h3{font-size:24px; font-weight:700; line-height:1.15; margin:0 0 10px; color:#4E0F25; letter-spacing:-.01em;}
.tt-rec__p{font-size:16px; line-height:1.6; color:#5A444C; margin:0 0 18px;}
.tt-lista{list-style:none; margin:0; padding:0; display:grid; gap:11px;}
.tt-lista li{display:flex; gap:10px; align-items:flex-start; font-size:14.5px; line-height:1.45; color:#3A2930;}
.tt-lista__ck{flex:none; width:22px; height:22px; border-radius:7px; background:#E8577F; color:#fff; display:flex; align-items:center; justify-content:center; margin-top:1px;}
.tt-lista__ck svg{width:13px; height:13px;}
.tt-nota{max-width:1040px; margin:26px auto 0; font-size:13px; color:#8C6B77; text-align:center; border-top:1px dashed #F3DCE4; padding-top:16px;}
@media (max-width:760px){.tt-rec{flex-direction:column; gap:22px; padding:20px; text-align:center;} .tt-rec__tela{width:230px;} .tt-tag{margin-left:auto; margin-right:auto;} .tt-lista li{text-align:left;}}
</style>
<section class="tt-sec dl-secao alignfull" id="recursos-detalhe" aria-labelledby="tt-h2">
  <div class="tt-wrap">
    <div class="tt-cab">
      <p class="tt-olho">Tudo num app só</p>
      <h2 class="tt-h2" id="tt-h2">Veja como o Doonly <b>pode te ajudar</b></h2>
      <p class="tt-sub">Cada recurso, por dentro — com a tela real do app, do jeitinho que você vai usar.</p>
    </div>
    <div class="tt-rec">
      <div class="tt-rec__tela"><div class="tt-rec__moldura"><img src="/site/media/cardapio-a-6b059457.webp" alt="Tela do cardápio digital do Doonly com os produtos, fotos e preços" loading="lazy"></div></div>
      <div class="tt-rec__tx">
        <span class="tt-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg> Cardápio digital</span>
        <h3 class="tt-rec__h3">Sua loja aberta 24h, sem você responder no WhatsApp</h3>
        <p class="tt-rec__p">A cliente escolhe o bolo, o sabor e a data no seu cardápio e já paga no Pix — sem parar a sua produção pra responder preço e disponibilidade. O pedido chega organizado, pronto pra você só aceitar.</p>
        <ul class="tt-lista">
          <li><span class="tt-lista__ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Link e QR Code pra pôr na bio, no WhatsApp ou impresso</span></li>
          <li><span class="tt-lista__ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Fotos, sabores, tamanhos e adicionais em cada produto</span></li>
          <li><span class="tt-lista__ck"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span><span>Pagamento no Pix na hora do pedido</span></li>
        </ul>
      </div>
    </div>
    <p class="tt-nota">Rascunho · 1ª funcionalidade (Cardápio digital). As próximas entram uma a uma, cada uma com o print real da tela.</p>
  </div>
</section>
`
  const corpoTestes = corpo.replace(
    '<section class="dl-secao dl-secao--clara dl-beneficios" id="beneficios"',
    SECAO_TESTES + '<section class="dl-secao dl-secao--clara dl-beneficios" id="beneficios"'
  )
  const pixel = `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
${PIXELS.map(id => `fbq('init', '${id}');`).join('\n')}
fbq('track', 'PageView');
</script>`
  const fazerHtml = (corpoPagina: string, semRedirecionar = false) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${semRedirecionar ? '' : `<script>
/* app instalado no celular (o iPhone guarda o endereço de quando instalou) ou quem já está logada: vai direto para o app */
(function(){try{var app=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
var logada=Object.keys(localStorage).some(function(k){return k.indexOf('sb-')===0&&k.indexOf('auth-token')>0&&localStorage.getItem(k)});
var loja=/DoonlyApp/.test(navigator.userAgent);
if((app||logada||loja)&&!/[?&]site=1/.test(location.search))location.replace('/inicio'+location.search+location.hash);}catch(e){}})();
</script>`}
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
  fs.writeFileSync(path.join(dist, 'testes.html'), fazerHtml(corpoTestes, true)) // doonly.com.br/testes (rascunho, sem redirect)
}
