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
// (21/11) /pro2: a mesma página PRO, com a oferta da Black Friday do app (1º mês por R$ 1). É o mesmo checkout do botão
// "Virar PRO" do app; sck=lp-pro-r1 separa essa campanha no relatório da Hotmart. A /pro (7 dias) continua igual.
const HOTMART_PRO_R1 = 'https://pay.hotmart.com/M107866310B?off=8ba1tara&checkoutMode=10&sck=lp-pro-r1'
const TROCAS_PRO2: [string, string][] = [
  ['Quero testar o PRO grátis por 7 dias', 'Quero o PRO por R$ 1 no 1º mês'],
  ['Teste o PRO grátis por 7 dias.', 'PRO por apenas R$ 1 no 1º mês.'],
  ['Testar o PRO grátis por 7 dias', 'Quero o PRO por R$ 1'],
  ['São <b>7 dias grátis</b> para testar todas as funcionalidades do Doonly', 'Depois, <b>R$ 29,90 por mês</b>: menos de R$ 1 por dia para usar tudo do Doonly'],
  ['Teste o PRO grátis.', '1º mês por apenas R$ 1.'],
  ['Testar o PRO grátis', 'PRO por R$ 1'],
]
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
  </div>
</section>
`
  // (18/11) abertura nova (mockup notebook+celular do tutorial + logos das confeitarias) — vale pra raiz e pra PRO
  const comAbertura = (body: string) => body.replace('<div class="dl-palco__sombra" aria-hidden="true"></div>', BV_HERO + '\n\t\t\t<div class="dl-palco__sombra" aria-hidden="true"></div>')
  // extras só da versão PRO: seção "a gente faz por você" + o texto de 7 dias no "Comece agora"
  const comExtrasPro = (body: string) => body
    .replace('<section class="dl-secao dl-secao--branca dl-comece" id="comece"', SECAO_EQUIPE + '<section class="dl-secao dl-secao--branca dl-comece" id="comece"')
    .replace('<h2 class="dl-h2" id="dl-comece-titulo">Comece agora. <span class="dl-h2__rosa">Teste o PRO grátis.</span></h2>', '<h2 class="dl-h2" id="dl-comece-titulo">Comece agora. <span class="dl-h2__rosa">Teste o PRO grátis.</span></h2><p class="tt-comece-sub">São <b>7 dias grátis</b> para testar todas as funcionalidades do Doonly</p>')
  const corpoRaiz = comAbertura(corpo)                       // raiz (grátis) + abertura nova
  const corpoProFinal = comExtrasPro(comAbertura(corpoPro))  // PRO completa (a antiga /testes)
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
  fs.writeFileSync(app, fazerHtml(corpoRaiz))                        // raiz: doonly.com.br (cadastro grátis) + abertura nova
  fs.writeFileSync(path.join(dist, 'pro.html'), fazerHtml(corpoProFinal)) // doonly.com.br/pro: versão PRO completa (a antiga /testes)
  let corpoPro2 = corpoProFinal.split(HOTMART_PRO).join(HOTMART_PRO_R1)
  for (const [de, para] of TROCAS_PRO2) corpoPro2 = corpoPro2.split(de).join(para)
  // (21/11) /pro2 no formato AIDA completo: botão já na abertura, botão no meio da página (depois da ficha técnica),
  // prazo da oferta e as dúvidas respondidas antes do botão final. Só nesta página; /pro e a raiz não mudam.
  const BT_P2 = (texto: string, classe: string) => `<a class="dl-btn dl-btn--primario ${classe}" href="${HOTMART_PRO_R1}" data-dl-url="cadastro"><span>${texto}</span></a>`
  const CSS_P2 = `<style>
.p2-hero-acao{display:flex; flex-direction:column; align-items:flex-start; gap:10px; margin:22px 0 0;}
.p2-hero-acao small{font-size:14px; line-height:1.4; color:rgba(255,255,255,.78);}
.p2-prazo{display:inline-block; padding:5px 10px; border-radius:8px; background:#FFE9A8; color:#5A3A00; font-size:13px; font-weight:600; white-space:nowrap;}
@media (max-width:900px){ .p2-hero-acao{align-items:center; text-align:center;} .p2-hero-acao .dl-btn{width:100%; max-width:340px;} }
#p2-meio{padding:54px 20px; background:#160D12; text-align:center;}
#p2-meio h2{margin:0 auto 10px; max-width:720px; font-size:clamp(24px,3.2vw,36px); line-height:1.15; font-weight:700; color:#fff;}
#p2-meio h2 span{color:#FF5C9A;}
#p2-meio p{margin:0 auto 24px; max-width:560px; font-size:16.5px; line-height:1.5; color:rgba(255,255,255,.78);}
#p2-meio .p2-prazo{margin-top:16px;}
.p2-duvidas{max-width:760px; margin:38px auto 0; text-align:left;}
.p2-duvidas h3{margin:0 0 12px; font-size:20px; font-weight:600; color:#3A1220; text-align:center;}
.p2-duvidas details{border-bottom:1px solid #F0DFE5;}
.p2-duvidas summary{display:flex; align-items:center; justify-content:space-between; gap:14px; padding:16px 2px; cursor:pointer; list-style:none; font-size:16.5px; font-weight:500; color:#3A1220;}
.p2-duvidas summary::-webkit-details-marker{display:none;}
.p2-duvidas summary::after{content:"+"; flex:none; font-size:22px; line-height:1; color:#E0397B;}
.p2-duvidas details[open] summary::after{content:"−";}
.p2-duvidas p{margin:0; padding:0 2px 18px; font-size:15.5px; line-height:1.55; color:#6B4A56;}
.dl-root .dl-barra .p2-unico{font-weight:500; background:linear-gradient(90deg,#FFFFFF 0%,#FFD3E3 55%,#FF9DC0 100%); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:transparent;}
.dl-root .dl-titulo.p2-titulo{font-size:clamp(2rem,8.4vw,2.5rem); line-height:1.12; letter-spacing:-.02em; text-transform:none; font-weight:700; text-wrap:balance;}
.dl-root .dl-titulo.p2-titulo span{color:#FF5C9A; white-space:nowrap;}
@media (min-width:900px){ .dl-root .dl-titulo.p2-titulo{font-size:clamp(2.4rem,3.5vw,3.3rem);} }
/* degradê animado (rosa → coral, devagar) na parte destacada dos títulos */
@supports ((-webkit-background-clip:text) or (background-clip:text)){
  .dl-root .dl-h2 .dl-h2__rosa, .dl-root .dl-titulo.p2-titulo span{background:linear-gradient(90deg,#FF7DAE 0%,#F42C7A 25%,#FF8A6B 50%,#F42C7A 75%,#FF7DAE 100%); background-size:200% 100%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; color:#F42C7A; animation:p2-degrade 7s linear infinite;}
}
@keyframes p2-degrade{from{background-position:0% 0}to{background-position:200% 0}}
@media (prefers-reduced-motion:reduce){ .dl-root .dl-h2 .dl-h2__rosa, .dl-root .dl-titulo.p2-titulo span{animation:none;} }
.dl-root #dl-recursos-titulo{font-size:clamp(1.5rem,7.1vw,1.75rem); max-width:17em; margin-inline:auto;}
@media (min-width:600px){ .dl-root #dl-recursos-titulo{font-size:clamp(1.75rem,1.1rem + 2.6vw,3.25rem);} }
.dl-root #funcionalidades{position:relative;}
.p2-faixa{position:absolute; top:0; left:0; right:0; overflow:hidden; padding:11px 0; background:rgba(244,44,122,.10); border-block:1px solid rgba(255,125,174,.22);}
.p2-faixa__trilho{display:flex; width:max-content; animation:p2-faixa 46s linear infinite;}
.p2-faixa__grupo{display:flex; align-items:center; flex:none;}
.p2-faixa__grupo span{padding:0 18px; font-size:.8125rem; font-weight:600; letter-spacing:.16em; text-transform:uppercase; white-space:nowrap; color:rgba(255,246,238,.9);}
.p2-faixa__grupo i{font-style:normal; font-size:.75rem; color:#FF7DAE;}
@keyframes p2-faixa{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){ .p2-faixa__trilho{animation:none;} }
.dl-root #funcionalidades .dl-cabeca{margin-top:34px;}
.dl-root #funcionalidades .dl-cabeca .dl-lead{font-size:clamp(1rem,.9rem + .42vw,1.25rem); text-wrap:balance;}
@font-face{font-family:"Tinteiro"; src:url(/site/media/homemade-apple.woff2) format("woff2"); font-weight:400; font-style:normal; font-display:swap;}
.dl-root .dl-ponte.p2-ponte{margin-top:clamp(30px,3.4vw,48px); gap:2px;}
.dl-root .dl-ponte.p2-ponte .dl-ponte__texto{max-width:none; font-family:"Tinteiro","Segoe Script","Bradley Hand",cursive; font-weight:400; font-size:min(1.125rem,4.5vw); line-height:1.55; letter-spacing:0; color:#2B1A3A; text-wrap:balance; transform:rotate(-1.5deg);}
.dl-root .dl-ponte.p2-ponte em{display:block; font-style:normal; color:inherit; background:none; -webkit-text-fill-color:currentColor; animation:none;}
.dl-root .p2-tinta{width:min(46%,200px); height:auto; margin-left:30%; color:#E0397B; transform:rotate(-2.5deg);}
@media (min-width:700px){ .dl-root .dl-ponte.p2-ponte .dl-ponte__texto{font-size:clamp(1.35rem,1.75vw,1.75rem);} .dl-root .p2-tinta{width:250px; margin-left:20%;} }
.dl-root .dl-secao.dl-dores{padding-bottom:clamp(40px,4.4vw,60px);}
/* (21/11) cartões das funcionalidades: celular maior, título mais solto do número, letras um pouco maiores e a descrição embaixo do celular */
.dl-root #funcionalidades .dl-passo4{padding-bottom:20px;}
.dl-root #funcionalidades .dl-passo4__num{order:0;}
.dl-root #funcionalidades .dl-passo4__titulo{order:1; margin-top:14px; font-size:min(1.1875rem,5vw); white-space:nowrap;}
.dl-root #funcionalidades .dl-passo4__tela{order:2; flex:none; margin:16px -8px 0; padding:0;}
.dl-root #funcionalidades .dl-passo4__video{max-width:none; border-radius:16px;}
.dl-root #funcionalidades .dl-passo4__texto{order:3; margin:16px 0 0; font-size:.9375rem; line-height:1.5;}
@media (max-width:639px){ .dl-root #funcionalidades .dl-passo4__tela{margin-inline:-18px;} .dl-root #funcionalidades .dl-passo4__video{border-radius:0;} }
@media (min-width:1270px){ .dl-root #funcionalidades .dl-passo4__titulo{font-size:min(1.1875rem,1.3vw) !important;} }
@media (min-width:640px){ .dl-root #funcionalidades .dl-passo4__titulo{font-size:1.1875rem;} .dl-root #funcionalidades .dl-passo4__texto{font-size:1rem;} .dl-root #funcionalidades .dl-passo4__tela{margin-inline:-10px;} }
/* (21/11) pares "Hoje / Com o Doonly": problema apagado e riscado, solução em verde, ícones maiores */
.dl-root .dl-dores .dl-par{border-color:#E9E1E4;}
.dl-root .dl-dores .dl-par__hoje, .dl-root .dl-dores .dl-par__doonly{grid-template-columns:34px minmax(0,1fr); gap:12px;}
.dl-root .dl-dores .dl-par__ic{width:34px; height:34px;}
.dl-root .dl-dores .dl-par__ic .dl-ico{width:17px; height:17px;}
.dl-root .dl-dores .dl-par__hoje{background:#F6F2F3;}
.dl-root .dl-dores .dl-par__hoje .dl-par__ic{background:#C9BEC3; color:#fff;}
.dl-root .dl-dores .dl-par__hoje .dl-par__txt{color:#8A7B82; text-decoration:line-through; text-decoration-color:rgba(138,123,130,.7);}
.dl-root .dl-dores .dl-par__hoje .dl-par__rot{color:#9A8C92;}
.dl-root .dl-dores .dl-par__doonly{background:#E9F8EF; border-color:#CDEBD8;}
.dl-root .dl-dores .dl-par__doonly .dl-par__ic{background:#18A957; color:#fff;}
.dl-root .dl-dores .dl-par__doonly .dl-par__rot{color:#12864A;}
.dl-root .dl-dores .dl-par__doonly .dl-par__txt{color:#16241C; font-weight:600;}
.dl-root .dl-dores .dl-par__txt{font-size:1rem;}
@media (max-width:599px){ .dl-root .dl-dores .dl-par__txt{font-size:min(.9375rem,3.9vw); letter-spacing:-.01em; text-wrap:nowrap;} .dl-root .dl-dores .dl-par__hoje, .dl-root .dl-dores .dl-par__doonly{padding-left:14px; padding-right:10px; gap:10px;} }
.dl-root .p2-par-cab{display:none;}
@media (min-width:1280px){
  .dl-root .p2-par-cab{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); margin:0 0 -4px !important; padding:0 22px; list-style:none; font-size:.75rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase;}
  .dl-root .p2-par-cab span:first-child{color:#9A8C92;} .dl-root .p2-par-cab span:last-child{color:#12864A; padding-left:22px;}
  .dl-root .dl-dores .dl-par__rot{display:none;}
  .dl-root .dl-dores .dl-par__txt{font-size:.9375rem;}
}
/* (21/11) cartão de funcionalidade no modelo novo */
.dl-root #funcionalidades .p2-func{padding:22px 20px 24px;}
.dl-root #funcionalidades .p2-func__selo{align-self:center; display:inline-flex; align-items:center; gap:10px; margin:0; padding:5px 16px 5px 5px; border-radius:999px; background:#FFF6EE;}
.dl-root #funcionalidades .p2-func__selo b{display:grid; place-items:center; width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#FF5C9A,#F42C7A); color:#fff; font-size:.8125rem; font-weight:700;}
.dl-root #funcionalidades .p2-func__selo span{color:#3A1220; font-size:.8125rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap;}
.dl-root #funcionalidades .p2-func .dl-passo4__titulo{margin:16px 0 0; text-align:center; white-space:normal; text-wrap:balance; font-size:clamp(1.375rem,6vw,1.625rem) !important; line-height:1.15; letter-spacing:-.02em;}
.dl-root #funcionalidades .p2-func .dl-passo4__tela{margin-top:20px;}
.dl-root #funcionalidades .p2-func .dl-passo4__texto{margin:20px 0 0; font-size:1.0625rem; line-height:1.45; color:rgba(255,246,238,.72);}
.dl-root #funcionalidades .p2-func__lista{order:4; display:grid; gap:10px; margin:16px 0 0; padding:0; list-style:none;}
.dl-root #funcionalidades .p2-func__lista li{display:grid; grid-template-columns:24px minmax(0,1fr); gap:10px; align-items:center; margin:0; color:#FFF6EE; font-size:1rem; font-weight:500; line-height:1.3;}
.dl-root #funcionalidades .p2-func__lista i{display:grid; place-items:center; width:24px; height:24px; border-radius:50%; background:#F42C7A; color:#fff;}
@media (max-width:639px){ .dl-root #funcionalidades .p2-func .dl-passo4__tela{margin-inline:-20px;} .dl-root #funcionalidades .p2-func__lista li{font-size:min(1rem,4.1vw); white-space:nowrap;} }
@media (max-width:345px){ .dl-root #funcionalidades .p2-func__lista li{white-space:normal;} }
@media (min-width:640px){
  .dl-root #funcionalidades .dl-passos4{grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:22px; max-width:1000px; margin-inline:auto;}
  .dl-root #funcionalidades .p2-func{padding:28px 32px 30px;}
  .dl-root #funcionalidades .p2-func .dl-passo4__tela{margin-inline:0; justify-content:center;}
  .dl-root #funcionalidades .p2-func .dl-passo4__video{max-width:310px;}
  .dl-root #funcionalidades .p2-func .dl-passo4__titulo{font-size:1.625rem !important;}
  .dl-root #funcionalidades .p2-func .dl-passo4__texto, .dl-root #funcionalidades .p2-func__lista{width:100%; max-width:360px; margin-inline:auto;}
}
/* (21/11) pares com textos longos: sem risco, podem ocupar várias linhas */
.dl-root .dl-dores .dl-par__hoje .dl-par__txt{text-decoration:none; color:#5E5158;}
.dl-root .dl-dores .dl-par__doonly .dl-par__txt{font-weight:500;}
.dl-root .dl-dores .dl-par__txt{text-wrap:pretty !important; white-space:normal !important; letter-spacing:0 !important; line-height:1.42;}
.dl-root .dl-dores .dl-par__hoje, .dl-root .dl-dores .dl-par__doonly{align-items:start;}
.dl-root .dl-dores .dl-par__ic{margin-top:2px;}
@media (max-width:599px){ .dl-root .dl-dores .dl-par__txt{font-size:.9375rem !important;} }
.p2-hero-acao .dl-btn .dl-ico{margin-left:2px;}
/* (21/11) funcionalidade 01 = área rosa; cartões 02–04 em seção própria */
.dl-root .dl-secao.dl-recursos#funcionalidades{padding-bottom:clamp(34px,4vw,56px);}
.dl-root .dl-secao.dl-recursos#funcs-b{padding-top:clamp(40px,5vw,72px);}
.dl-root #funcs-b .dl-passos4{margin-top:0;}
.dl-root .dl-cardapio .dl-onda{fill:#0B0710; height:clamp(16px,1.9vw,34px);}
.dl-root #cardapio-digital.dl-cardapio{padding-top:clamp(56px,6.2vw,104px);}
@media (max-width:1023px){ .dl-root .dl-cardapio .dl-cardapio__grade{gap:18px;} .dl-root .dl-cardapio .dl-cabeca{margin-bottom:12px;} .dl-root .dl-cardapio .dl-vantagens{margin-top:0;} }
.dl-root .dl-cardapio .dl-vantagens__texto{white-space:normal; text-wrap:pretty;} .dl-root .dl-cardapio .dl-vantagens__item{align-items:start;}
.dl-root .p2-selo-rosa{display:inline-flex; align-items:center; gap:10px; margin:0 0 16px; padding:5px 16px 5px 5px; border-radius:999px; background:#FFF6EE;}
.dl-root .p2-selo-rosa b{display:grid; place-items:center; width:30px; height:30px; border-radius:50%; background:#3A1220; color:#fff; font-size:.8125rem; font-weight:700;}
.dl-root .p2-selo-rosa span{color:#3A1220; font-size:.8125rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; white-space:nowrap;}
@media (min-width:1000px){ .dl-root #funcs-b .dl-passos4{grid-template-columns:repeat(3,minmax(0,1fr)) !important; max-width:1180px;} .dl-root #funcs-b .p2-func{padding:26px 24px 28px;} .dl-root #funcs-b .p2-func .dl-passo4__video{max-width:290px;} .dl-root #funcs-b .p2-func .dl-passo4__titulo{font-size:1.4rem !important;} }
/* (21/11) funcionalidade 02 Pedidos: mesmo modelo da área rosa, em fundo escuro */
.dl-root #pedidos.dl-cardapio{background:#0B0710; color:rgba(255,246,238,.8); padding-top:clamp(64px,6.6vw,112px); padding-bottom:clamp(48px,5vw,84px);}
.dl-root #pedidos .dl-onda{fill:#F42C7A;}
.dl-root #pedidos .dl-cardapio__fundo{display:none;}
.dl-root #pedidos .dl-h2{color:#FFF6EE;}
.dl-root #pedidos .dl-lead{color:rgba(255,246,238,.78);}
.dl-root #pedidos .p2-selo-rosa b{background:linear-gradient(135deg,#FF5C9A,#F42C7A);}
.dl-root #pedidos .dl-vantagens{grid-template-columns:minmax(0,1fr) !important; background:rgba(255,255,255,.05); border-color:rgba(255,255,255,.1);}
.dl-root #pedidos .dl-vantagens__item{align-items:center;}
.dl-root #pedidos .dl-vantagens__titulo{white-space:normal; font-weight:500; color:#FFF6EE; text-wrap:balance;}
.dl-root #pedidos .dl-vantagens__icone{background:#F42C7A; color:#fff;}
.dl-root #pedidos .dl-camadas{aspect-ratio:1/1.1;}
.dl-root #pedidos .dl-h2 .dl-h2__rosa{display:block;}
@media (max-width:599px){ .dl-root #pedidos .dl-h2{font-size:min(1.75rem,6.25vw); white-space:nowrap;} }
.dl-root #pedidos .dl-camadas__img{aspect-ratio:600/1300;}
.dl-root #pedidos .dl-camadas__img--3{aspect-ratio:600/900; top:26%;}
@media (min-width:1000px){ .dl-root #funcs-b .dl-passos4{grid-template-columns:repeat(2,minmax(0,1fr)) !important; max-width:860px;} }
/* (21/11) mockup animado de Pedidos */
.dl-root #pedidos .p2-anim{clip-path:inset(-46px -30px -18px -30px);}
.dl-root #pedidos .p2-cel{background:none; overflow:visible; transform-origin:0 0;}
.dl-root #pedidos .p2-cel__base{display:block; width:100%; height:100%; border-radius:inherit;}
.dl-root #pedidos .p2-cel__av{position:absolute; height:auto; max-width:none; filter:drop-shadow(0 5px 8px rgba(0,0,0,.4));}
.dl-root #pedidos .p2-cel__av1{left:3.33%; top:6.31%; width:93.33%;}
.dl-root #pedidos .p2-cel__av2{left:4.97%; top:20.63%; width:90.07%; opacity:.94;}
.dl-root #pedidos .p2-mao{position:absolute; left:64%; top:13%; width:20%; opacity:0; pointer-events:none; transform-origin:30% 10%;}
.dl-root #pedidos .p2-mao svg{display:block; width:100%; height:auto; filter:drop-shadow(0 4px 6px rgba(0,0,0,.45));}
.dl-root #pedidos .p2-mao i{position:absolute; left:14%; top:-6%; width:60%; aspect-ratio:1; border-radius:50%; border:2px solid #F42C7A; opacity:0;}
.dl-root #pedidos .p2-pdf{background:none; box-shadow:none; overflow:visible; perspective:900px; transform-origin:100% 30%;}
.dl-root #pedidos .p2-pdf__vira{position:relative; width:100%; height:100%; transform-style:preserve-3d;}
.dl-root #pedidos .p2-pdf__frente, .dl-root #pedidos .p2-pdf__verso{position:absolute; max-width:none; -webkit-backface-visibility:hidden; backface-visibility:hidden;}
.dl-root #pedidos .p2-pdf__verso{left:0; top:0; width:100%; height:100%; border-radius:22px; box-shadow:0 0 0 1px rgba(255,255,255,.55),0 28px 50px -26px rgba(0,0,0,.8);}
.dl-root #pedidos .p2-pdf__frente{left:4%; top:36%; width:92%; height:auto; transform:rotateY(180deg); filter:drop-shadow(0 10px 16px rgba(0,0,0,.5));}
@media (max-width:559px){ .dl-root #pedidos .p2-pdf__verso{border-radius:16px;} }
.dl-root #pedidos .p2-pronta .p2-cel__av, .dl-root #pedidos .p2-pronta .dl-camadas__img--2, .dl-root #pedidos .p2-pronta .p2-pdf{opacity:0;}
.dl-root #pedidos .p2-pronta .p2-pdf__vira{transform:rotateY(180deg);}
.dl-root #pedidos .p2-vai .p2-cel{animation:p2-cel 4.3s cubic-bezier(.4,0,.2,1) both;}
.dl-root #pedidos .p2-vai .p2-cel__av1{animation:p2-cai .55s .45s cubic-bezier(.2,.9,.3,1.2) both, p2-toque .35s 2.55s ease;}
.dl-root #pedidos .p2-vai .p2-cel__av2{animation:p2-av2 .5s 4.1s ease both;}
.dl-root #pedidos .p2-vai .p2-mao{animation:p2-mao 1.75s 1.75s ease both;}
.dl-root #pedidos .p2-vai .p2-mao i{animation:p2-onda .6s 2.6s ease-out both;}
.dl-root #pedidos .p2-vai .dl-camadas__img--2{animation:p2-tela2 .6s 4.4s ease both;}
.dl-root #pedidos .p2-vai .p2-pdf{animation:p2-ap .45s 5s ease both, p2-zoom 3.6s 6.9s cubic-bezier(.4,0,.2,1) both;}
.dl-root #pedidos .p2-vai .p2-pdf__vira{animation:p2-vira .85s 5.9s cubic-bezier(.4,0,.2,1) both;}
@keyframes p2-cel{0%,14%{transform:rotate(-4deg) scale(1); z-index:6} 32%,80%{transform:rotate(0deg) scale(2.15); z-index:6} 99%{transform:rotate(-4deg) scale(1); z-index:6} 100%{transform:rotate(-4deg) scale(1); z-index:0}}
@keyframes p2-cai{from{opacity:0; transform:translateY(-70%)} to{opacity:1; transform:none}}
@keyframes p2-toque{50%{transform:scale(.965)}}
@keyframes p2-av2{from{opacity:0; transform:translateY(-30%)} to{opacity:.94; transform:none}}
@keyframes p2-mao{0%{opacity:0; transform:translate(45%,70%)} 30%{opacity:1; transform:none} 46%{opacity:1; transform:scale(.86)} 58%{opacity:1; transform:none} 82%{opacity:1; transform:none} 100%{opacity:0; transform:translate(20%,30%)}}
@keyframes p2-onda{from{opacity:.9; transform:scale(.3)} to{opacity:0; transform:scale(1.9)}}
@keyframes p2-tela2{from{opacity:0; transform:rotate(-.5deg) translateY(22px)} to{opacity:1; transform:rotate(-.5deg)}}
@keyframes p2-ap{from{opacity:0} to{opacity:1}}
@keyframes p2-vira{from{transform:rotateY(180deg)} to{transform:rotateY(0deg)}}
@keyframes p2-zoom{0%{transform:rotate(3.5deg) scale(1); z-index:6} 20%,78%{transform:rotate(0deg) scale(1.85); z-index:6} 99%{transform:rotate(3.5deg) scale(1); z-index:6} 100%{transform:rotate(3.5deg) scale(1); z-index:0}}
.p2-fim{display:flex; flex-direction:column; align-items:center; gap:12px; margin-top:6px;}
</style>`
  const HERO_P2 = `<div class="p2-hero-acao">${BT_P2('Quero o PRO por R$ 1', 'dl-btn--medio')}<small>1º mês por R$ 1. Depois, R$ 29,90 por mês.</small><span class="p2-prazo">Oferta de Black Friday · até 30/11</span></div>`
  const MEIO_P2 = `<section id="p2-meio" class="alignfull" aria-labelledby="p2-meio-t">
  <h2 id="p2-meio-t">Pare de vender no escuro. <span>Saiba quanto sobra de cada pedido.</span></h2>
  <p>Cardápio, pedidos, agenda, financeiro e ficha técnica no mesmo lugar, a partir de hoje.</p>
  ${BT_P2('Quero o PRO', 'dl-btn--grande')}
</section>
`
  const DUVIDAS_P2 = `<div class="p2-duvidas">
  <h3>Dúvidas antes de começar</h3>
  <details><summary>Como funciona o R$ 1?</summary><p>Você paga R$ 1 no primeiro mês e usa tudo do Doonly PRO. A partir do segundo mês, o valor é R$ 29,90 por mês.</p></details>
  <details><summary>Preciso instalar alguma coisa?</summary><p>Não. O Doonly funciona no celular, no computador e no tablet, direto pelo navegador. Se quiser, dá para deixar o ícone na tela do celular como um aplicativo.</p></details>
  <details><summary>Serve para quem vende só por encomenda, pelo WhatsApp?</summary><p>Sim. Você manda o link do seu cardápio, a cliente monta o pedido sozinha e ele chega organizado para você aceitar, com data, sabores e endereço.</p></details>
  <details><summary>Não tenho tempo de cadastrar tudo. E agora?</summary><p>A equipe do Doonly monta para você: você manda as fotos e os preços e a gente cadastra os produtos e deixa o cardápio pronto.</p></details>
</div>
`
  corpoPro2 = corpoPro2
    .replace('<section class="dl-secao dl-secao--escura dl-doo" id="doo-ia"', MEIO_P2 + '<section class="dl-secao dl-secao--escura dl-doo" id="doo-ia"')
    .replace('<div class="dl-comece__acao">', DUVIDAS_P2 + '<div class="dl-comece__acao p2-fim"><span class="p2-prazo">Oferta de Black Friday · até 30/11</span>')
  // (21/11) barra do topo da /pro2: a frase de posicionamento no lugar da oferta, sem a coroa, em degradê suave
  const BARRA_DE = '<img class="dl-barra__coroa" src="/site/media/coroa-barra.webp" width="30" height="20" alt="" decoding="async"><span>PRO por apenas R$ 1 no 1º mês.</span>'
  if (!corpoPro2.includes(BARRA_DE)) throw new Error('pro2: barra do topo não encontrada')
  corpoPro2 = corpoPro2.replace(BARRA_DE, '<span class="p2-unico">O único app feito só para confeitaria</span>')
  // (21/11) abertura da /pro2: título em forma de pergunta (a dor), subtítulo que responde, e sem o selo (a barra do topo já diz)
  const H1_P2 = /<h1 class="dl-titulo" id="dl-hero-titulo">[\s\S]*?<\/h1>/
  const SUB_P2 = /<p class="dl-subtitulo">[\s\S]*?<\/p>/
  const SELO_P2 = /<p class="dl-semtaxa">[\s\S]*?<\/p>\n?/
  for (const r of [H1_P2, SUB_P2, SELO_P2]) if (!r.test(corpoPro2)) throw new Error('pro2: abertura não encontrada ' + r)
  corpoPro2 = corpoPro2
    .replace(H1_P2, '<h1 class="dl-titulo p2-titulo" id="dl-hero-titulo">Se você fechar o WhatsApp agora, sua confeitaria <span>continua vendendo?</span></h1>')
    .replace(SUB_P2, '<p class="dl-subtitulo">Com o Doonly, a cliente monta o pedido sozinha no seu cardápio e ele chega organizado para você aceitar. Mesmo quando você não pode responder.</p>')
    .replace(SELO_P2, '')
  // (21/11) preço só no final: antes da seção "Comece agora" ninguém fala de valor. Os botões de cima viram "Quero o PRO"
  // e levam até a oferta (#comece), onde o preço aparece pela primeira vez. A barra fixa do celular segue a mesma regra.
  {
    const semPreco = (t: string) => t
      .replace(/href="[^"]*" data-dl-url="cadastro"( tabindex="-1")?/g, 'href="#comece"$1')
      .split('Quero o PRO por R$ 1 no 1º mês').join('Quero o PRO')
      .split('Quero o PRO por R$ 1').join('Quero o PRO')
      .split('PRO por R$ 1').join('Quero o PRO')
    const iC = corpoPro2.indexOf('<section class="dl-secao dl-secao--branca dl-comece" id="comece"')
    const iF = corpoPro2.indexOf('<div class="dl-fixa"')
    if (iC < 0 || iF < iC) throw new Error('pro2: seção da oferta ou barra fixa não encontrada')
    corpoPro2 = semPreco(corpoPro2.slice(0, iC)) + corpoPro2.slice(iC, iF) + semPreco(corpoPro2.slice(iF))
  }
  // a barra fixa do celular some enquanto a seção da oferta está na tela (ali já tem o botão de verdade)
  corpoPro2 += `<style>.dl-root .dl-fixa.p2-some{display:none !important;}</style><script>(function(){var o=document.getElementById('comece'),f=document.querySelector('.dl-fixa');if(!o||!f||!('IntersectionObserver' in window))return;new IntersectionObserver(function(e){f.classList.toggle('p2-some',e[0].isIntersecting)}).observe(o)})()</script>`
  // (21/11) seção "Você cuida da produção": os quatro cartões mostram funcionalidades (não mais o caminho de um pedido).
  // Os vídeos são os mesmos, do app real; saem os números 01–04, que davam ideia de sequência.
  {
    const TROCAS_FUNCS: [string, string][] = [
      ['<p class="dl-olho">Do pedido ao lucro</p>', ''],
      ['Veja o caminho de um pedido: da escolha da cliente ao dinheiro no caixa.', 'Conheça os recursos do app e descubra como usar cada um na sua confeitaria.'],
      ['Você cuida da produção. <span class="dl-h2__rosa">O Doonly cuida do resto.</span>', 'Veja o que o Doonly <span class="dl-h2__rosa">faz por você.</span>'],
      ['>A cliente pede sozinha</h3>', '>Cardápio que vende por você</h3>'],
      ['Escolhe o bolo, o sabor e a data no seu cardápio, e já paga no Pix. Sem você parar a produção para responder.', 'Sua loja com logo, capa, fotos, descrições, cupons e promoções. A cliente abre o link, escolhe sozinha e o pedido chega pronto.'],
      ['>Você só aceita</h3>', '>Pedidos</h3>'],
      ['O aviso chega no celular. Um toque e o pedido vai para a produção, com tudo anotado.', 'O aviso chega no celular. Um toque para aceitar e o pedido fica organizado, com tudo anotado.'],
      ['>Nenhuma entrega esquecida</h3>', '>Agenda</h3>'],
      ['No dia, a agenda mostra quem vem, a que horas e o valor de cada pedido.', 'Cada dia mostra quem vem, a que horas e o valor de cada pedido. Nenhuma entrega esquecida.'],
      ['>Entregou, está no caixa</h3>', '>Financeiro</h3>'],
      ['Marcou como retirado, o valor já entra no financeiro. ', 'Entregou, o valor entra no caixa sozinho. Você vê quanto já recebeu e quanto falta receber.'],
    ]
    for (const [de, para] of TROCAS_FUNCS) {
      if (!corpoPro2.includes(de)) throw new Error('pro2: trecho das funcionalidades não encontrado: ' + de)
      corpoPro2 = corpoPro2.split(de).join(para)
    }
    // (21/11) os números 01–04 ficam: agora numeram as funcionalidades
    // sai o mascote da divisa; no lugar, uma faixa com o texto passando sem parar (sai de um lado e volta do outro)
    const MASCOTE = /<img class="dl-recursos__mascote"[^>]*>/
    if (!MASCOTE.test(corpoPro2)) throw new Error('pro2: mascote da divisa não encontrado')
    const FRASE = '<span>Conheça as funcionalidades do Doonly</span><i aria-hidden="true">✦</i><span>Perfeitas para confeitaria</span><i aria-hidden="true">✦</i>'
    corpoPro2 = corpoPro2.replace(MASCOTE, `<div class="p2-faixa" role="presentation"><div class="p2-faixa__trilho"><div class="p2-faixa__grupo">${FRASE.repeat(4)}</div><div class="p2-faixa__grupo" aria-hidden="true">${FRASE.repeat(4)}</div></div></div>`)
  }
  // (21/11) cartão "Cardápio digital" da /pro2: no lugar do vídeo do pedido, o cardápio real do Doce Formiga rolando devagar.
  // O vídeo antigo (video-01/02 e img-08) continua na pasta e na /pro: NÃO apagar.
  {
    const TROCAS_VIDEO: [string, string][] = [
      ['/site/media/video-01-0517432868.webm', '/site/media/cardapio-rolando.webm'],
      ['/site/media/video-02-165429e200.mp4', '/site/media/cardapio-rolando.mp4'],
      ['poster="/site/media/img-08-feec6a0105.webp"', 'poster="/site/media/cardapio-rolando.webp"'],
      ['aria-label="A cliente escolhe o Bolo Floresta Negra no cardápio, marca a retirada e paga no Pix"', 'aria-label="O cardápio digital do Doce Formiga rolando: capa, logo, cupons, destaques e a lista de bolos"'],
    ]
    for (const [de, para] of TROCAS_VIDEO) {
      if (!corpoPro2.includes(de)) throw new Error('pro2: vídeo do cardápio não encontrado: ' + de)
      corpoPro2 = corpoPro2.split(de).join(para)
    }
  }
  // (21/11) fecho da seção das dores: frase mais forte, sem a seta para baixo e com menos espaço até a faixa das funcionalidades
  {
    const PONTE = /<p class="dl-ponte">[\s\S]*?<\/p>/
    if (!PONTE.test(corpoPro2)) throw new Error('pro2: frase de passagem não encontrada')
    corpoPro2 = corpoPro2.replace(PONTE, '<p class="dl-ponte p2-ponte"><span class="dl-ponte__texto">Você não abriu uma confeitaria <em>para virar atendente.</em></span><svg class="p2-tinta" viewBox="0 0 360 44" width="360" height="44" aria-hidden="true" focusable="false"><path d="M6 20c38-7 71-9 112-8 49 1 86 6 131 4 22-1 41-4 62-9-17 7-37 12-60 14-46 4-84-2-132-3-41-1-74 2-113 8z" fill="currentColor"/><path d="M318 10c6-5 15-6 21-2 6 4 8 12 4 18-3 5-10 8-16 6-3-1-4 3-8 3-3 0-4-4-2-6 2-3-3-5-3-9 0-4 1-8 4-10z" fill="currentColor"/><circle cx="350" cy="33" r="3.2" fill="currentColor"/><circle cx="341" cy="40" r="1.7" fill="currentColor"/><circle cx="356" cy="22" r="1.4" fill="currentColor"/><circle cx="304" cy="30" r="1.3" fill="currentColor"/></svg></p>')
  }
  // (21/11) pares "Hoje / Com o Doonly": cabeçalho das colunas uma vez só (no computador)
  {
    const LISTA = '<ul class="dl-dores__lista dl-pares">'
    if (!corpoPro2.includes(LISTA)) throw new Error('pro2: lista das dores não encontrada')
    corpoPro2 = corpoPro2.replace(LISTA, LISTA + '<li class="p2-par-cab" aria-hidden="true"><span>Hoje</span><span>Com o Doonly</span></li>')
  }
  // (21/11) cartões das funcionalidades no modelo: selo com número e nome em cima, título, celular no meio, frase e três pontos embaixo
  {
    const FUNCS = [
      { nome: 'Cardápio digital', titulo: 'Cardápio que vende por você', frase: 'A cliente abre o link, escolhe sozinha e o pedido chega pronto.',
        pontos: ['Logo, capa e descrição da sua loja', 'Banners, promoções e cupons', 'Tamanhos, sabores e adicionais'] },
      { nome: 'Pedidos', titulo: 'Todo pedido chega pronto para aceitar', frase: 'O aviso chega no celular e você aceita com um toque.',
        pontos: ['Aviso a cada pedido novo', 'Data, sabores e endereço anotados', 'Acompanhe do aceite à entrega'] },
      { nome: 'Agenda', titulo: 'Nenhuma entrega esquecida', frase: 'Cada dia mostra quem vem, a que horas e o valor de cada pedido.',
        pontos: ['Entregas e retiradas no calendário', 'Pedidos atrasados em destaque', 'Busca por cliente ou número'] },
      { nome: 'Financeiro', titulo: 'Saiba quanto entrou e quanto falta', frase: 'Entregou, o valor entra no caixa sozinho.',
        pontos: ['Quanto recebeu e quanto falta', 'Pix, dinheiro, crédito e débito', 'Sinal e saldo de cada pedido'] },
    ]
    const CK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
    const CARTAO = /<li class="dl-passo4"><span class="dl-passo4__num">(\d+)<\/span><h3 class="dl-passo4__titulo">[\s\S]*?<\/h3><p class="dl-passo4__texto">[\s\S]*?<\/p>(<div class="dl-passo4__tela">[\s\S]*?<\/div>)<\/li>/g
    let feitos = 0
    corpoPro2 = corpoPro2.replace(CARTAO, (_t, num: string, tela: string) => {
      const f = FUNCS[Number(num) - 1]; if (!f) return _t; feitos++
      return `<li class="dl-passo4 p2-func"><p class="p2-func__selo"><b>${num}</b><span>${f.nome}</span></p><h3 class="dl-passo4__titulo">${f.titulo}</h3>${tela}<p class="dl-passo4__texto">${f.frase}</p><ul class="p2-func__lista">${f.pontos.map(x => `<li><i>${CK}</i><span>${x}</span></li>`).join('')}</ul></li>`
    })
    if (feitos !== 4) throw new Error('pro2: esperava 4 cartões de funcionalidade, achei ' + feitos)
  }
  // (21/11) abertura: botão "Conheça o Doonly" entre o texto e a imagem, levando à demonstração (funcionalidades)
  // dores: sem o parágrafo de apoio, e os cinco pares com textos novos (a fala da confeiteira × o que o Doonly faz)
  {
    const SUB = /(<p class="dl-subtitulo">[\s\S]*?<\/p>)/
    if (!SUB.test(corpoPro2)) throw new Error('pro2: subtítulo da abertura não encontrado')
    corpoPro2 = corpoPro2.replace(SUB, '$1\n<div class="p2-hero-acao"><a class="dl-btn dl-btn--primario dl-btn--medio" href="#funcionalidades"><span>Conheça o Doonly</span><svg class="dl-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M6 13l6 6 6-6"/></svg></a></div>')
    const LEAD_DORES = /(<header class="dl-cabeca dl-dores__cabeca">[\s\S]*?<\/h2>)\s*<p class="dl-lead">[\s\S]*?<\/p>/
    if (!LEAD_DORES.test(corpoPro2)) throw new Error('pro2: parágrafo das dores não encontrado')
    corpoPro2 = corpoPro2.replace(LEAD_DORES, '$1')
    const PARES = [
      'Um pedido no WhatsApp, outro no Instagram. Um de boca a boca, outro por ligação.',
      'Um só cardápio pra compartilhar e todos os pedidos organizados no app.',
      '“Tem foto? Quanto custa? Fica pronto pra sábado?”',
      'A cliente vê fotos, sabores, preços e prazos no cardápio. Passa menos tempo perguntando e mais tempo escolhendo o que vai pedir.',
      '“A entrega era sexta ou sábado?” Lá vai você procurar na conversa.',
      'Você abre a agenda e vê o que precisa entregar em cada dia da semana.',
      '“Gastei R$ 30 nos ingredientes. Se cobrar R$ 60, lucrei R$ 30?” E a embalagem, o gás e o seu tempo?',
      'Você coloca esses custos na ficha técnica e vê quanto realmente sobra em cada bolo.',
      '“Passei o mês fazendo encomenda. Cadê o dinheiro?” O Pix caiu, você comprou ingredientes, pagou as contas… e perdeu a conta do que sobrou.',
      'Você abre o caixa e vê quanto entrou das encomendas, pra onde foi o dinheiro e quanto tem ali hoje.',
    ]
    let k = 0
    corpoPro2 = corpoPro2.replace(/<p class="dl-par__txt">[\s\S]*?<\/p>/g, t => (k < PARES.length ? `<p class="dl-par__txt">${PARES[k++]}</p>` : t))
    if (k !== 10) throw new Error('pro2: esperava 10 textos nos pares, achei ' + k)
  }
  // (21/11) a área rosa do cardápio vira a funcionalidade 01 (com o mockup dela, parado) e sobe para logo depois do título
  // "Veja o que o Doonly faz por você"; o cartão 01 sai, e os cartões 02–04 continuam numa seção escura logo abaixo.
  {
    const ROSA = /<section class="dl-secao dl-secao--rosa dl-cardapio"[\s\S]*?<\/section>\n?/
    const achou = corpoPro2.match(ROSA)
    if (!achou) throw new Error('pro2: área rosa do cardápio não encontrada')
    const OLHO = '<p class="dl-olho">Seu cardápio digital</p>'
    if (!achou[0].includes(OLHO)) throw new Error('pro2: chamada da área rosa não encontrada')
    let rosa = achou[0].replace(OLHO, '<p class="p2-selo-rosa"><b>01</b><span>Cardápio digital</span></p>')
    // textos novos da funcionalidade 01 (21/11)
    const PONTOS_ROSA: [string, string][] = [
      ['Cardápio profissional', 'Pensado pra quem vende bolos, doces e salgados.'],
      ['Banners de promoção', 'Para anunciar ofertas e datas especiais logo no topo.'],
      ['Produtos em destaque', 'Com fotos grandes dos seus campeões de venda.'],
      ['Cupons de desconto', 'Em reais ou em porcentagem pra incentivar a próxima compra.'],
      ['Foto de referência', 'Que a cliente pode enviar junto com o pedido.'],
      ['Adicionais', 'Como topo de bolo, vela e embalagem pra presente.'],
      ['Sua marca no cardápio', 'Com sua logo, suas cores e sua capa.'],
      ['Link e QR Code', 'Pra compartilhar no WhatsApp ou imprimir.'],
    ]
    let kt = 0, kx = 0
    rosa = rosa
      .replace('pronto para vender.', 'pronto pra vender.')
      .replace(/(<p class="dl-lead">)[\s\S]*?(<\/p>)/, '$1Mande o link uma vez. A cliente vê as fotos e os preços, escolhe o sabor, personaliza a encomenda e envia o pedido completo, sem aquele vai e volta no WhatsApp.$2')
      .replace(/(<h3 class="dl-vantagens__titulo">)[\s\S]*?(<\/h3>)/g, (t, a1: string, a2: string) => (kt < 8 ? a1 + PONTOS_ROSA[kt++][0] + a2 : t))
      .replace(/(<p class="dl-vantagens__texto">)[\s\S]*?(<\/p>)/g, (t, a1: string, a2: string) => (kx < 8 ? a1 + PONTOS_ROSA[kx++][1] + a2 : t))
    if (kt !== 8 || kx !== 8) throw new Error('pro2: esperava 8 pontos na área rosa, achei ' + kt + '/' + kx)
    corpoPro2 = corpoPro2.replace(ROSA, '')
    const CARTAO1 = /<li class="dl-passo4 p2-func"><p class="p2-func__selo"><b>01<\/b>[\s\S]*?<\/ul><\/li>/
    if (!CARTAO1.test(corpoPro2)) throw new Error('pro2: cartão 01 não encontrado')
    corpoPro2 = corpoPro2.replace(CARTAO1, '')
    // (21/11) funcionalidade 02 Pedidos, no mesmo modelo da área rosa (selo, título, texto, pontos e três telas em camadas), em fundo escuro.
    // As três peças (21/11): 1) tela de celular com os avisos do Doonly (montada); 2) a tela real do pedido no app, sem o bloco do cliente; 3) o PDF real do pedido, fechado e aberto.
    const ICONE = (rosa.match(/<span class="dl-vantagens__icone dl-vantagens__icone--ck">[\s\S]*?<\/span>/) || [''])[0]
    if (!ICONE) throw new Error('pro2: ícone dos pontos não encontrado')
    const pontosPed = ['Receba um aviso a cada novo pedido.', 'Confira data, sabores e endereço na mesma tela.', 'Acompanhe a encomenda do aceite à entrega.']
      .map(t => `<li class="dl-vantagens__item">${ICONE}<div><h3 class="dl-vantagens__titulo">${t}</h3></div></li>`).join('')
    const trocaPed: [RegExp, string][] = [
      [/class="dl-secao dl-secao--rosa dl-cardapio" id="cardapio-digital" aria-labelledby="dl-cardapio-titulo"/, 'class="dl-secao dl-secao--escura dl-cardapio p2-f02" id="pedidos" aria-labelledby="p2-ped-t"'],
      [/<p class="p2-selo-rosa">[\s\S]*?<\/p>/, '<p class="p2-selo-rosa p2-selo--rosa"><b>02</b><span>Pedidos</span></p>'],
      [/<h2 class="dl-h2" id="dl-cardapio-titulo">[\s\S]*?<\/h2>/, '<h2 class="dl-h2" id="p2-ped-t">O pedido chega completo. <span class="dl-h2__rosa">Você só precisa aceitar.</span></h2>'],
      [/(<p class="dl-lead">)[\s\S]*?(<\/p>)/, '$1Assim que a cliente faz o pedido pelo cardápio, o aviso chega no seu celular. Você confere os detalhes e aceita com um toque.$2'],
      [/<ul class="dl-vantagens">[\s\S]*?<\/ul>/, `<ul class="dl-vantagens">${pontosPed}</ul>`],
      [/aria-label="Cardápio digital da Doce Formiga:[^"]*"/, 'aria-label="O aviso de pedido novo na tela do celular, o pedido aberto no app com os três itens e o pedido em PDF"'],
      [/src="\/site\/media\/camada-1-[^"]*" width="600" height="1300"/, 'src="/site/media/pedidos-a.webp" width="600" height="1300"'],
      [/src="\/site\/media\/camada-2-[^"]*" width="600" height="1300"/, 'src="/site/media/pedidos-b.webp" width="600" height="1300"'],
      [/src="\/site\/media\/camada-3-[^"]*" width="600" height="1300"/, 'src="/site/media/pedidos-c.webp" width="600" height="900"'],
    ]
    let ped = rosa
    for (const [de, para] of trocaPed) { if (!de.test(ped)) throw new Error('pro2: peça da área de pedidos não encontrada: ' + de); ped = ped.replace(de, para) }
    // (21/11) animação do mockup de Pedidos: o aviso chega no celular, o celular aproxima para ler, uma mãozinha toca;
    // aparecem o pedido aberto e o PDF fechado, que vira, abre, aproxima para ler e volta. Depois ficam os três parados.
    // Sem JavaScript ou com "reduzir movimento", aparece direto o estado final.
    const MAO = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M24 30V13a5 5 0 0 1 10 0v15l13 3a6 6 0 0 1 4.6 6.8L49 52a8 8 0 0 1-8 7H31a8 8 0 0 1-6.400-3.200L14 41a4.2 4.2 0 0 1 6.500-5.300L24 39z" fill="#fff" stroke="#2A1830" stroke-width="3" stroke-linejoin="round"/></svg>'
    const IMG1 = /<img class="dl-camadas__img dl-camadas__img--1"[^>]*>/
    const IMG3 = /<img class="dl-camadas__img dl-camadas__img--3"[^>]*>/
    if (!IMG1.test(ped) || !IMG3.test(ped)) throw new Error('pro2: telas da área de pedidos não encontradas')
    ped = ped
      .replace(IMG1, `<div class="dl-camadas__img dl-camadas__img--1 p2-cel"><img class="p2-cel__base" src="/site/media/pedidos-a0.webp" width="600" height="1300" alt="" loading="lazy" decoding="async"><img class="p2-cel__av p2-cel__av1" src="/site/media/pedidos-aviso1.webp" width="560" height="172" alt="" loading="lazy" decoding="async"><img class="p2-cel__av p2-cel__av2" src="/site/media/pedidos-aviso2.webp" width="560" height="172" alt="" loading="lazy" decoding="async"><span class="p2-mao" aria-hidden="true"><i></i>${MAO}</span></div>`)
      .replace(IMG3, '<div class="dl-camadas__img dl-camadas__img--3 p2-pdf"><div class="p2-pdf__vira"><img class="p2-pdf__frente" src="/site/media/pedidos-pdf-fechado.webp" width="552" height="136" alt="" loading="lazy" decoding="async"><img class="p2-pdf__verso" src="/site/media/pedidos-c.webp" width="600" height="900" alt="" loading="lazy" decoding="async"></div></div>')
      .replace('<div class="dl-camadas" role="img"', '<div class="dl-camadas p2-anim" role="img"')
    ped += `<script>(function(){var c=document.querySelector('#pedidos .p2-anim');if(!c||!('IntersectionObserver' in window)||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;c.classList.add('p2-pronta');new IntersectionObserver(function(e,o){if(e[0].isIntersecting){o.disconnect();var im=c.querySelectorAll('img'),n=0,foi=false,vai=function(){if(foi)return;foi=true;c.classList.add('p2-vai')};for(var i=0;i<im.length;i++){im[i].loading='eager';if(!im[i].complete){n++;im[i].addEventListener('load',function(){if(--n<=0)vai()});im[i].addEventListener('error',function(){if(--n<=0)vai()})}}if(!n)vai();setTimeout(vai,2500)}},{threshold:.45}).observe(c)})()</script>`
    const CARTAO2 = /<li class="dl-passo4 p2-func"><p class="p2-func__selo"><b>02<\/b>[\s\S]*?<\/ul><\/li>/
    if (!CARTAO2.test(corpoPro2)) throw new Error('pro2: cartão 02 não encontrado')
    corpoPro2 = corpoPro2.replace(CARTAO2, '')
    const CORTE = /(<\/header>)\s*(<ol class="dl-passos4">)/
    if (!CORTE.test(corpoPro2)) throw new Error('pro2: ponto de corte das funcionalidades não encontrado')
    corpoPro2 = corpoPro2.replace(CORTE, (_t, a: string, b: string) => `${a}\n\t</div>\n</section>\n${rosa}${ped}<section class="dl-secao dl-secao--escura dl-recursos" id="funcs-b" aria-label="Agenda e financeiro">\n\t<div class="dl-container">\n\t\t${b}`)
  }
  corpoPro2 = CSS_P2.split('#funcionalidades').join(':is(#funcionalidades,#funcs-b)') + corpoPro2
  fs.writeFileSync(path.join(dist, 'pro2.html'), fazerHtml(corpoPro2))   // doonly.com.br/pro2: PRO com 1º mês por R$ 1
  fs.writeFileSync(path.join(dist, 'testes.html'), fazerHtml(corpoProFinal, true)) // doonly.com.br/testes = igual /pro, sem redirect
}
