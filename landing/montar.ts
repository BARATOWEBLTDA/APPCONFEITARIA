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
// (18/11) prova social: nº de confeitarias (base do banco antigo do Bruno). Subir de 50 em 50 quando crescer.
const CONFEITARIAS = 9741
const milhar = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
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
  // (18/11) abertura /testes: mockup igual ao tutorial do app visto no PC — notebook com o Início (fixo) + celular com o cardápio
  const BV_HERO = `<style>
#inicio .dl-note, #inicio .dl-celular, #inicio .dl-palco__sombra, #inicio .dl-palco__arco, #inicio .dl-confeitos{display:none !important;}
#inicio .dl-palco{display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:0;}
#inicio .bv-dup-wrap{position:relative; display:block; width:100%; max-width:560px; margin:0 auto; padding:24px 44px 40px 0; perspective:2200px;}
#inicio .bv-dup{position:relative; transform:rotateY(-9deg) rotateX(3deg); transform-style:preserve-3d;}
#inicio .bv-nb{display:block; width:100%;}
#inicio .bv-nb-tampa{position:relative; padding:14px 12px 11px; border-radius:16px 16px 6px 6px; background:linear-gradient(180deg,#2A2A2E,#19191C); box-shadow:0 0 0 1px #3A3A40, 0 30px 60px rgba(0,0,0,.5);}
#inicio .bv-nb-cam{position:absolute; top:6px; left:50%; width:6px; height:6px; margin-left:-3px; border-radius:50%; background:#0D0D0F; box-shadow:inset 0 0 0 1.5px #2E2E34;}
#inicio .bv-nb-tela{position:relative; aspect-ratio:1040/650; overflow:hidden; border-radius:4px; background:#FAF7F8;}
#inicio .bv-pc-print{display:block; width:100%; height:100%; object-fit:cover; object-position:top center;}
#inicio .bv-nb-base{position:relative; height:15px; margin:0 -38px; border-radius:0 0 13px 13px; background:linear-gradient(180deg,#D9D6DB 0,#B9B5BC 60%,#8F8A93 100%); box-shadow:0 14px 24px rgba(0,0,0,.45);}
#inicio .bv-nb-base i{position:absolute; top:0; left:50%; width:110px; height:7px; margin-left:-55px; border-radius:0 0 8px 8px; background:#A8A3AC;}
#inicio .bv-cel--mini{position:absolute; right:-28px; bottom:-30px; width:168px; padding:4px; border-radius:28px; background:linear-gradient(150deg,#2B272A 0%,#0F0D0E 100%); transform:translateZ(70px) rotateY(4deg); box-shadow:0 28px 50px -10px rgba(0,0,0,.6), 0 0 0 1px #48414580, inset 0 0 0 1px rgba(255,255,255,.07);}
#inicio .bv-cel--mini .bv-cel-entalhe{position:absolute; top:8px; left:50%; z-index:2; width:44px; height:12px; transform:translateX(-50%); border-radius:8px; background:#000;}
#inicio .bv-cel--mini .bv-cel-tela{position:relative; height:318px; border-radius:24px; overflow:hidden; background:#3A1A25;}
#inicio .bv-cel-rolo{height:100%; overflow:hidden;}
#inicio .bv-cel-print{display:block; width:100%; height:100%; object-fit:cover; object-position:50% 0%; animation:tt-rola-card 24s linear 1s infinite alternate;}
@keyframes tt-rola-card{0%,4%{object-position:50% 0%;} 96%,100%{object-position:50% 100%;}}
@media (prefers-reduced-motion:reduce){ #inicio .bv-cel-print{animation:none;} }
#inicio .bv-cel-menu{position:absolute; left:0; right:0; bottom:0; width:100%; z-index:2;}
@media (max-width:640px){ #inicio .bv-dup-wrap{max-width:380px; padding:18px 34px 30px 0;} #inicio .bv-cel--mini{width:132px; right:-18px; bottom:-20px;} #inicio .bv-cel--mini .bv-cel-tela{height:248px;} #inicio .tt-prova__txt{font-size:13px; max-width:280px;} }
#inicio .tt-prova{display:flex; flex-direction:column; align-items:center; gap:9px; margin:18px auto 0; max-width:440px;}
#inicio .tt-prova__logos{display:flex; align-items:center; padding-left:10px;}
#inicio .tt-prova__logo, #inicio .tt-prova__mais{width:42px; height:42px; border-radius:50%; margin-left:-10px; border:2px solid #fff; background:#fff; overflow:hidden; flex:none; box-shadow:0 3px 10px rgba(0,0,0,.3);}
#inicio .tt-prova__logo img{width:100%; height:100%; object-fit:cover; display:block;}
#inicio .tt-prova__mais{display:flex; align-items:center; justify-content:center; background:#E85A8C; color:#fff; font-size:13px; font-weight:600;}
#inicio .tt-prova__txt{margin:0 auto; max-width:320px; font-size:14.5px; line-height:1.4; color:rgba(255,255,255,.85); text-align:center; text-wrap:balance;}
#inicio .tt-prova__txt b{color:#fff; font-weight:600; white-space:nowrap;}
#inicio{padding-bottom:30px;}
#inicio + .dl-secao{padding-top:36px !important;}
#comece .tt-comece-sub{margin:10px auto 0; max-width:520px; font-size:16px; line-height:1.4; color:#6B4C57; text-align:center; text-wrap:balance;}
#comece .tt-comece-sub b{color:#D13E68; font-weight:600;}
</style>
<div class="bv-dup-wrap">
  <div class="bv-dup">
    <div class="bv-nb">
      <div class="bv-nb-tampa"><span class="bv-nb-cam"></span>
        <div class="bv-nb-tela"><img class="bv-pc-print" src="/site/media/img-02-6637d5a52f.webp" alt="Início do Doonly no computador"></div>
      </div>
      <div class="bv-nb-base"><i></i></div>
    </div>
    <div class="bv-cel bv-cel--mini">
      <span class="bv-cel-entalhe"></span>
      <div class="bv-cel-tela"><div class="bv-cel-rolo"><img class="bv-cel-print" src="/tutorial/cardapio-exemplo.jpg?v=3" alt="Cardápio digital no celular"></div><img class="bv-cel-menu" src="/tutorial/cardapio-exemplo-nav.jpg?v=3" alt=""></div>
    </div>
  </div>
</div>
<div class="tt-prova">
  <div class="tt-prova__logos">
    <span class="tt-prova__logo"><img src="https://epixsranjplmltzmdsbo.supabase.co/storage/v1/object/public/products/logos/8e2f0c80-beba-443b-b06c-3fb70b63cb85-1794930140218.jpg?t=1794930140906" alt="Confeitos Da Jana" loading="lazy"></span>
    <span class="tt-prova__logo"><img src="https://epixsranjplmltzmdsbo.supabase.co/storage/v1/object/public/products/logos/38c7623f-e84f-4863-8453-65f15208b945-1794856742581.jpg?t=1794856743322" alt="Bessoni Cakes" loading="lazy"></span>
    <span class="tt-prova__logo"><img src="https://epixsranjplmltzmdsbo.supabase.co/storage/v1/object/public/products/logos/a1a84f2e-2a50-4f07-834c-9013c45375d6-1794950962883.jpg?t=1794950963799" alt="Doce Magia" loading="lazy"></span>
    <span class="tt-prova__logo"><img src="https://epixsranjplmltzmdsbo.supabase.co/storage/v1/object/public/products/logos/f02eca90-5c14-48b8-9ace-d7d7559822a4-1794876883601.jpg?t=1794876884392" alt="Itallo Bolos" loading="lazy"></span>
    <span class="tt-prova__logo"><img src="https://epixsranjplmltzmdsbo.supabase.co/storage/v1/object/public/products/logos/8b1f6afd-e6ea-4326-b0f8-c8e583376546-1794940089380.jpg?t=1794940090129" alt="Delicias Da Eli" loading="lazy"></span>
    <span class="tt-prova__mais">+${Math.floor(CONFEITARIAS / 1000)}K</span>
  </div>
  <p class="tt-prova__txt"><b>+ de ${milhar(CONFEITARIAS)} confeitarias</b> já organizam o dia a dia com o Doonly</p>
</div>`
  // (18/11) seção "a equipe faz por você" (cardápio + logo + banners) — gancho de economia de tempo, antes do "Comece agora"
  const SECAO_EQUIPE = `<style>
#equipe-faz{background:#FDEFF4; padding:66px 20px;}
#equipe-faz .dl-container{max-width:1000px; margin:0 auto;}
#equipe-faz .tt-eq-olho{font-size:13px; font-weight:500; letter-spacing:.05em; text-transform:uppercase; color:#D9739A; text-align:center; margin:0 0 12px;}
#equipe-faz .dl-h2{text-align:center;}
#equipe-faz .tt-eq-sub{max-width:560px; margin:14px auto 0; font-size:16px; line-height:1.6; color:#8A6B76; text-align:center; text-wrap:balance;}
#equipe-faz .tt-eq-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin:42px 0 0;}
#equipe-faz .tt-eq-card{background:#fff; border:1px solid #F2DBE4; border-radius:20px; padding:32px 24px; text-align:center;}
#equipe-faz .tt-eq-ic{display:inline-flex; align-items:center; justify-content:center; width:56px; height:56px; border-radius:50%; border:1.5px solid #F0C9D8; background:#fff; color:#E85A8C; margin:0 auto 16px;}
#equipe-faz .tt-eq-ic svg{width:26px; height:26px;}
#equipe-faz .tt-eq-card h3{margin:0 0 8px; font-size:18px; font-weight:500; color:#5A1230;}
#equipe-faz .tt-eq-card p{margin:0; font-size:14.5px; line-height:1.55; color:#8A6B76;}
#equipe-faz .tt-eq-acao{display:flex; justify-content:center; margin:40px 0 0;}
@media (max-width:760px){ #equipe-faz{padding:50px 18px;} #equipe-faz .tt-eq-grid{grid-template-columns:1fr; gap:12px;} #equipe-faz .tt-eq-card{padding:26px 22px;} }
</style>
<section class="dl-secao alignfull" id="equipe-faz" aria-labelledby="tt-eq-t">
  <div class="dl-container">
    <p class="tt-eq-olho">Sem tempo pra montar?</p>
    <h2 class="dl-h2" id="tt-eq-t">Deixa que <span class="dl-h2__rosa">a gente faz por você</span></h2>
    <p class="tt-eq-sub">Você manda as fotos e os preços. A equipe do Doonly monta tudo — do cardápio à identidade da sua loja — pra você começar a vender sem perder tempo.</p>
    <div class="tt-eq-grid">
      <div class="tt-eq-card">
        <span class="tt-eq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18M4.5 9 6 4.5A2 2 0 0 1 7.9 3h8.2a2 2 0 0 1 1.9 1.5L19.5 9M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/></svg></span>
        <h3>Cardápio montado pela equipe</h3>
        <p>A gente cadastra seus produtos com foto, preço, sabores e tamanhos. Você só revisa e publica.</p>
      </div>
      <div class="tt-eq-card">
        <span class="tt-eq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg></span>
        <h3>Logo profissional</h3>
        <p>Uma identidade bonita pra sua confeitaria, feita pra combinar com a cara da sua loja.</p>
      </div>
      <div class="tt-eq-card">
        <span class="tt-eq-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg></span>
        <h3>Banners prontos pra divulgar</h3>
        <p>Artes de promoções e datas especiais pro topo do seu cardápio e pras suas redes.</p>
      </div>
    </div>
    <div class="tt-eq-acao"><a class="dl-btn dl-btn--primario dl-btn--grande" href="${HOTMART_PRO}"><span>Testar o PRO grátis por 7 dias</span><svg class="dl-ico dl-btn__seta" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></a></div>
  </div>
</section>
`
  const corpoTestes = corpoPro
    .replace('<section class="dl-secao dl-secao--branca dl-comece" id="comece"', SECAO_EQUIPE + '<section class="dl-secao dl-secao--branca dl-comece" id="comece"')
    .replace('<div class="dl-palco__sombra" aria-hidden="true"></div>', BV_HERO + '\n\t\t\t<div class="dl-palco__sombra" aria-hidden="true"></div>')
    .replace('<h2 class="dl-h2" id="dl-comece-titulo">Comece agora. <span class="dl-h2__rosa">Teste o PRO grátis.</span></h2>', '<h2 class="dl-h2" id="dl-comece-titulo">Comece agora. <span class="dl-h2__rosa">Teste o PRO grátis.</span></h2><p class="tt-comece-sub">São <b>7 dias grátis</b> para testar todas as funcionalidades do Doonly</p>')
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
