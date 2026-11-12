/*!
 * Doonly Landing — comportamento do cabeçalho e da navegação.
 * JavaScript puro, sem bibliotecas.
 */
(function () {
  'use strict';

  var raiz = document.querySelector('.dl-root');
  if (!raiz) { return; }

  raiz.classList.add('dl-com-js');

  var cabecalho = raiz.querySelector('[data-dl-cabecalho]');
  var botaoMenu = raiz.querySelector('[data-dl-abrir-menu]');
  var menu = raiz.querySelector('[data-dl-menu]');
  var rotuloMenu = raiz.querySelector('[data-dl-rotulo-menu]');
  var poucoMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── URLs configuráveis ───────────────────────────────────────
     No WordPress os links já saem prontos do PHP (Configurações → Doonly Landing).
     Na prévia em HTML, basta preencher window.DOONLY_LANDING no index.html:
       window.DOONLY_LANDING = { urlCadastro: 'https://…', urlEntrar: 'https://…' };
  */
  var config = window.DOONLY_LANDING || {};
  var urls = { cadastro: config.urlCadastro, entrar: config.urlEntrar };
  Array.prototype.forEach.call(raiz.querySelectorAll('[data-dl-url]'), function (link) {
    var url = urls[link.getAttribute('data-dl-url')];
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      link.setAttribute('href', url);
    }
  });

  /* ── Cabeçalho: ganha fundo quando a página rola ───────────── */
  var agendado = false;
  function conferirRolagem() {
    agendado = false;
    if (cabecalho) {
      cabecalho.classList.toggle('dl-rolou', window.scrollY > 8);
    }
  }
  window.addEventListener('scroll', function () {
    if (!agendado) {
      agendado = true;
      window.requestAnimationFrame(conferirRolagem);
    }
  }, { passive: true });
  conferirRolagem();

  /* ── Celular: botão "Começar grátis" aparece no cabeçalho quando o da Hero sai da tela ── */
  var ctaPrincipal = raiz.querySelector('[data-dl-cta-principal]');
  if (ctaPrincipal && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (itens) {
      raiz.classList.toggle('dl-cta-fora', !itens[0].isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(ctaPrincipal);
  } else {
    raiz.classList.add('dl-cta-fora');
  }

  /* (26/10) menu: marca a seção que está na tela (Início, Funcionalidades, Como funciona, Planos, Dúvidas) */
  (function () {
    var links = Array.prototype.slice.call(raiz.querySelectorAll('.dl-nav__link'));
    var alvos = links.map(function (l) { return document.querySelector(l.getAttribute('href')); });
    function marcar() {
      var linha = (cabecalho ? cabecalho.offsetHeight : 80) + window.innerHeight * 0.3;
      var atual = 0;
      alvos.forEach(function (sec, i) { if (sec && sec.getBoundingClientRect().top <= linha) { atual = i; } });
      links.forEach(function (l, i) { l.classList.toggle('dl-ativo', i === atual); });
    }
    var esperando = false;
    window.addEventListener('scroll', function () { if (!esperando) { esperando = true; requestAnimationFrame(function () { esperando = false; marcar(); }); } }, { passive: true });
    marcar();
  })();

  /* ── Menu do celular ───────────────────────────────────────── */
  function menuAberto() {
    return raiz.classList.contains('dl-menu-aberto');
  }

  function definirMenu(abrir, devolverFoco) {
    if (!botaoMenu || !menu) { return; }
    raiz.classList.toggle('dl-menu-aberto', abrir);
    botaoMenu.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    if (rotuloMenu) { rotuloMenu.textContent = abrir ? 'Fechar menu' : 'Abrir menu'; }
    if (!abrir && devolverFoco) { botaoMenu.focus(); }
    // (26/10) com o menu aberto a página não rola por trás
    document.documentElement.classList.toggle('dl-sem-rolagem', abrir);
  }

  if (botaoMenu && menu) {
    botaoMenu.addEventListener('click', function () {
      definirMenu(!menuAberto(), false);
    });

    // tocar num item do menu: fecha (e destrava a rolagem) antes de ir para a seção
    Array.prototype.forEach.call(menu.querySelectorAll('a'), function (link) {
      link.addEventListener('click', function () { definirMenu(false, false); });
    });

    // Esc fecha e devolve o foco para o botão
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && menuAberto()) {
        definirMenu(false, true);
      }
    });

    // tocar fora (inclusive no fundo escurecido, que pertence ao cabeçalho) fecha
    document.addEventListener('click', function (evento) {
      if (menuAberto() && cabecalho && (evento.target === cabecalho || !cabecalho.contains(evento.target))) {
        definirMenu(false, false);
      }
    });

    // sair do menu pelo teclado (Tab) fecha
    menu.addEventListener('focusout', function (evento) {
      if (menuAberto() && evento.relatedTarget && !cabecalho.contains(evento.relatedTarget)) {
        definirMenu(false, false);
      }
    });

    // virou computador com o menu aberto: volta ao normal
    if (window.matchMedia) {
      var telaGrande = window.matchMedia('(min-width: 1024px)');
      var aoMudar = function (e) { if (e.matches) { definirMenu(false, false); } };
      if (telaGrande.addEventListener) { telaGrande.addEventListener('change', aoMudar); }
      else if (telaGrande.addListener) { telaGrande.addListener(aoMudar); }
    }
  }

  /* ── Perguntas frequentes: abre e fecha (várias podem ficar abertas) ── */
  Array.prototype.forEach.call(raiz.querySelectorAll('[data-dl-faq] .dl-faq__botao'), function (botao) {
    botao.addEventListener('click', function () {
      var item = botao.closest('.dl-faq__item');
      if (!item) { return; }
      var abrir = !item.classList.contains('dl-aberta');
      item.classList.toggle('dl-aberta', abrir);
      botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
    });
  });

  /* ── Links de âncora: rolagem suave, respeitando "reduzir movimento" ── */
  raiz.addEventListener('click', function (evento) {
    var link = evento.target.closest ? evento.target.closest('a[href^="#"]') : null;
    if (!link || !raiz.contains(link)) { return; }

    var id = link.getAttribute('href').slice(1);
    if (!id) { return; } // "#" puro: URL ainda não configurada

    var destino = document.getElementById(id);
    if (!destino) { return; }

    evento.preventDefault();
    if (menuAberto()) { definirMenu(false, false); }

    destino.scrollIntoView({ behavior: poucoMovimento ? 'auto' : 'smooth', block: 'start' });

    // leva o foco junto, para o teclado e o leitor de tela continuarem do lugar certo
    if (!destino.hasAttribute('tabindex')) { destino.setAttribute('tabindex', '-1'); }
    destino.focus({ preventScroll: true });

    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '#' + id);
    }
  });
})();


(function(){
  var v=document.querySelectorAll('.dl-passo4__video'); if(!v.length) return;
  var parado=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(parado || !('IntersectionObserver' in window)) return;
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var x=e.target;
    if(e.isIntersecting){ if(x.preload==='none'){x.preload='auto';} var p=x.play(); if(p&&p.catch)p.catch(function(){}); } else { x.pause(); }
  });},{threshold:.35});
  /* (12/11) mais devagar pra dar tempo de entender (o 1º é o mais rápido) */
  v.forEach(function(x,i){ var r=i===0?0.6:0.75; x.defaultPlaybackRate=r; x.playbackRate=r; x.addEventListener('play',function(){ x.playbackRate=r; }); io.observe(x);});
})();

(function(){
  var box=document.querySelector('.dl-rola2'); var fonte=document.querySelector('.dl-rolando'); var navF=document.querySelector('.dl-rolando__nav');
  if(!box||!fonte) return;
  var img=box.querySelector('.dl-rola2__img'), topo=box.querySelector('.dl-rola2__topo'), nav=box.querySelector('.dl-rola2__nav');
  var fImg=fonte.tagName==='IMG'?fonte:fonte.querySelector('img'); img.src=fImg?(fImg.currentSrc||fImg.src):''; if(navF) nav.src=navF.src;
  var anim=null, parado=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches, visivel=false;
  function monta(){
    if(!img.naturalWidth||!box.clientWidth) return;
    var k=box.clientWidth/img.naturalWidth, H=img.naturalHeight*k, topoH=box.clientWidth*324/780, navH=nav.naturalHeight?box.clientWidth*nav.naturalHeight/nav.naturalWidth:0;
    var ini=-(1462*k-topoH), fim=-(H-box.clientHeight+navH);
    if(anim) anim.cancel();
    if(parado){ img.style.transform='translateY('+ini+'px)'; return; }
    var dur=Math.max(20000,(ini-fim)/42*1000);
    anim=img.animate([{transform:'translateY('+ini+'px)',offset:0},{transform:'translateY('+ini+'px)',offset:.03},{transform:'translateY('+fim+'px)',offset:.97},{transform:'translateY('+fim+'px)',offset:1}],{duration:dur,iterations:Infinity,direction:'alternate',easing:'linear'});
    if(!visivel) anim.pause();
  }
  if(img.complete) monta(); else img.addEventListener('load',monta);
  nav.addEventListener('load',monta);
  var t; window.addEventListener('resize',function(){clearTimeout(t);t=setTimeout(monta,200);});
  if('IntersectionObserver' in window){ new IntersectionObserver(function(es){ visivel=es[0].isIntersecting; if(anim){ visivel?anim.play():anim.pause(); } },{threshold:.15}).observe(box); } else visivel=true;
})();

(function(){
  var v=[].slice.call(document.querySelectorAll('.dl-auto-video')); if(!v.length) return;
  if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!('IntersectionObserver' in window)) return;
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var x=e.target;
    if(e.isIntersecting){ if(x.preload==='none') x.preload='auto'; var p=x.play(); if(p&&p.catch) p.catch(function(){}); } else x.pause(); });},{threshold:.3});
  v.forEach(function(x){io.observe(x);});
})();

/* (03/11) entrada suave dos cards ao rolar: um depois do outro. Sem suporte ou com "reduzir movimento", tudo aparece direto. */
(function () {
  var raiz = document.querySelector('.dl-root');
  if (!raiz || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cards = [].slice.call(raiz.querySelectorAll('.dl-par, .dl-passo4, .dl-passo, .dl-plano, .dl-trio__item, .dl-vantagens__item, .dl-func, .dl-vidro'));
  if (!cards.length) return;
  cards.forEach(function (c) { c.classList.add('dl-revela'); });
  raiz.classList.add('dl-anima');
  var io = new IntersectionObserver(function (vistos) {
    var n = 0;
    vistos.forEach(function (v) {
      if (!v.isIntersecting) return;
      var c = v.target; io.unobserve(c);
      setTimeout(function () { c.classList.add('dl-visto'); }, (n++) * 90);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  cards.forEach(function (c) { io.observe(c); });
})();

/* (04/11) Meta Pixel: clique em "Criar conta" conta como Lead. */
(function () {
  var links = document.querySelectorAll('.dl-root [data-dl-url="cadastro"]');
  Array.prototype.forEach.call(links, function (link) {
    link.addEventListener('click', function () {
      if (typeof window.fbq === 'function') { window.fbq('track', 'Lead'); }
    });
  });
})();

/* (11/11) clique no "Falar no WhatsApp": conta como contato no pixel */
(function () {
  var zaps = document.querySelectorAll('.dl-root [data-dl-zap]');
  Array.prototype.forEach.call(zaps, function (link) {
    link.addEventListener('click', function () {
      if (typeof window.fbq === 'function') { window.fbq('track', 'Contact'); }
    });
  });
})();



/* (12/11) celular da abertura: a animação começa quando ele aparece na tela e pausa quando sai */
(function () {
  var demo = document.querySelector('.dl-root .dl-demo');
  if (!demo) { return; }
  if (!('IntersectionObserver' in window)) { demo.classList.add('dl-demo--rodando'); return; }
  new IntersectionObserver(function (itens) {
    demo.classList.toggle('dl-demo--rodando', itens[0].isIntersecting);
  }, { threshold: 0.5 }).observe(demo);
})();

/* (12/11) celular: barra fixa com o botão depois que a pessoa passa do topo (some no fim da página, onde já tem o botão grande) */
(function(){
  var barra=document.querySelector('.dl-root .dl-fixa'); var hero=document.querySelector('.dl-root .dl-hero'); var fim=document.querySelector('.dl-root .dl-final');
  if(!barra||!hero||!('IntersectionObserver' in window)) return;
  var passou=false, noFim=false;
  function att(){ barra.classList.toggle('dl-fixa--on', passou && !noFim); }
  new IntersectionObserver(function(es){ passou=!es[0].isIntersecting && es[0].boundingClientRect.top<0; att(); },{threshold:0}).observe(hero);
  if(fim) new IntersectionObserver(function(es){ noFim=es[0].isIntersecting; att(); },{threshold:0}).observe(fim);
})();
