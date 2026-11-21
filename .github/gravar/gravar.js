const puppeteer = require('puppeteer-core'); const fs = require('fs');
const URL = 'https://doonly.com.br/c/bm9w/cardapio';
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const dorme = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--hide-scrollbars', '--lang=pt-BR'] });
  const p = await b.newPage(); await p.setUserAgent(UA);
  await p.emulateTimezone('America/Sao_Paulo');
  await p.setViewport({ width: 390, height: 550, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); await dorme(4000);
  await p.screenshot({ path: 'a-topo.png' });
  const info = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 200; })
      .map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 80), sh: e.scrollHeight, ch: e.clientHeight }));
    return { doc: document.scrollingElement.scrollHeight, vh: innerHeight, cands, titulo: document.title,
      textos: [...document.querySelectorAll('h1,h2,h3,button')].map(e => e.innerText.trim()).filter(Boolean).slice(0, 60) };
  });
  const usaPainel = info.doc <= info.vh + 50 && info.cands.length > 0;
  await p.evaluate(usa => { window.__rola = usa ? [...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 200; }).sort((a, b) => b.scrollHeight - a.scrollHeight)[0] : null;
    window.__ir = y => window.__rola ? (window.__rola.scrollTop = y) : scrollTo(0, y);
    window.__tot = () => (window.__rola ? window.__rola.scrollHeight - window.__rola.clientHeight : document.scrollingElement.scrollHeight - innerHeight); }, usaPainel);
  let total = await p.evaluate(() => window.__tot());
  for (let y = 0; y <= total; y += 300) { await p.evaluate(v => window.__ir(v), y); await dorme(350); }
  await dorme(2500); total = await p.evaluate(() => window.__tot());
  await p.screenshot({ path: 'b-fim.png' });
  await p.evaluate(() => window.__ir(0)); await dorme(1500);
  const p2 = await b.newPage(); await p2.setUserAgent(UA); await p2.setViewport({ width: 390, height: Math.min(total + 550, 6000), deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await p2.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 }); await dorme(6000); await p2.screenshot({ path: 'c-inteira.png' }); await p2.close();
  fs.mkdirSync('frames', { recursive: true });
  const fim = Math.min(total, 2700); let n = 0;
  const quadro = async () => { await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await p.screenshot({ path: `frames/f${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 }); };
  for (let i = 0; i < 30; i++) await quadro();
  let y = 0, v = 0;
  while (y < fim) { const falta = fim - y; v = Math.min(v + 0.1, 3, Math.max(0.4, falta / 30)); y = Math.min(fim, y + v); await p.evaluate(val => window.__ir(val), y); await quadro(); }
  for (let i = 0; i < 30; i++) await quadro();
  info.total = total; info.fim = fim; info.quadros = n; info.usaPainel = usaPainel;
  fs.writeFileSync('info.json', JSON.stringify(info, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
