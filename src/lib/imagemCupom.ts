/**
 * (23/10) Imagem do cupom para postar no status do WhatsApp e no Instagram (1080×1350, PNG).
 * Desenhada direto no canvas (sem biblioteca): logo e nome da loja em cima, o cupom em um cartão branco
 * (desconto grande, regra, validade e o código) e o link do cardápio embaixo. Usa a cor dos botões do cardápio.
 */
export type DadosImagemCupom = {
  nomeLoja: string;
  logo?: string;
  cor?: string;
  desconto: string;   // "10% OFF"
  regra: string;      // "no seu 1º pedido"
  validade?: string;  // "Válido até 25/12"
  codigo: string;
  link: string;       // https://doonly.com.br/c/7gyb/cardapio
};

const L = 1080, A = 1350;

const hex = (c?: string) => {
  const s = String(c || "").replace("#", "").trim();
  const h = s.length === 3 ? s.split("").map(x => x + x).join("") : s;
  return /^[0-9a-f]{6}$/i.test(h) ? h : "";
};
/** cor branca ou clara demais não serve de fundo para letra branca: volta para o rosa do Doonly */
function corDeFundo(c?: string) {
  const h = hex(c);
  if (!h) return "#EC4899";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72 ? "#EC4899" : `#${h}`;
}
function escurecer(c: string, f: number) {
  const h = hex(c) || "EC4899";
  const v = [0, 2, 4].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - f)));
  return `rgb(${v.join(",")})`;
}
function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => {
    if (!src) return res(null);
    const img = new Image();
    img.crossOrigin = "anonymous"; // sem isso o canvas fica "sujo" e não exporta
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
    window.setTimeout(() => res(null), 6000);
  });
}
/** corta com "…" para caber na largura */
function caber(ctx: CanvasRenderingContext2D, t: string, max: number) {
  if (ctx.measureText(t).width <= max) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}
/** diminui a letra até o texto caber */
function fonteQueCabe(ctx: CanvasRenderingContext2D, t: string, peso: number, maior: number, max: number, familia: string) {
  let px = maior;
  ctx.font = `${peso} ${px}px ${familia}`;
  while (px > 40 && ctx.measureText(t).width > max) { px -= 4; ctx.font = `${peso} ${px}px ${familia}`; }
  return px;
}
function retanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const espacar = (ctx: CanvasRenderingContext2D, px: number) => { if ("letterSpacing" in ctx) (ctx as any).letterSpacing = `${px}px`; };

export async function gerarImagemCupom(d: DadosImagemCupom): Promise<Blob> {
  try { await (document as any).fonts?.ready; } catch { /* segue com a fonte que tiver */ }
  const familia = `${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
  const cv = document.createElement("canvas");
  cv.width = L; cv.height = A;
  const ctx = cv.getContext("2d")!;
  const cor = corDeFundo(d.cor);
  const corForte = escurecer(cor, 0.22);

  // fundo
  const g = ctx.createLinearGradient(0, 0, L, A);
  g.addColorStop(0, cor); g.addColorStop(1, corForte);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L, A);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";

  // logo (sem logo: a primeira letra do nome)
  const cx = L / 2, cy = 190, r = 96;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.22)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 8;
  ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();
  const logo = await carregarImagem(d.logo || "");
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  if (logo) {
    const s = Math.max((2 * r) / logo.width, (2 * r) / logo.height);
    const w = logo.width * s, h = logo.height * s;
    ctx.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = "#fff"; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = cor; ctx.font = `800 96px ${familia}`; ctx.textBaseline = "middle";
    ctx.fillText((d.nomeLoja.trim()[0] || "D").toUpperCase(), cx, cy + 4);
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // nome da loja
  ctx.fillStyle = "#fff"; ctx.font = `800 58px ${familia}`;
  ctx.fillText(caber(ctx, d.nomeLoja.trim() || "Minha confeitaria", 920), cx, 372);

  // cartão do cupom
  const cxCard = 90, cyCard = 430, wCard = 900, hCard = 620;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  retanguloRedondo(ctx, cxCard, cyCard, wCard, hCard, 44); ctx.fillStyle = "#fff"; ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#7A6A70"; ctx.font = `700 34px ${familia}`; espacar(ctx, 5);
  ctx.fillText("CUPOM DE DESCONTO", cx, cyCard + 96);
  espacar(ctx, 0);

  ctx.fillStyle = corForte;
  fonteQueCabe(ctx, d.desconto, 900, 156, 800, familia);
  ctx.fillText(d.desconto, cx, cyCard + 262);

  ctx.fillStyle = "#5F5257"; ctx.font = `500 46px ${familia}`;
  ctx.fillText(caber(ctx, d.regra, 800), cx, cyCard + 340);
  if (d.validade) {
    ctx.fillStyle = "#8B7F84"; ctx.font = `500 36px ${familia}`;
    ctx.fillText(caber(ctx, d.validade, 800), cx, cyCard + 394);
  }

  // código na caixa tracejada
  ctx.font = `800 66px ${familia}`; espacar(ctx, 6);
  const cod = caber(ctx, d.codigo, 680);
  const wCod = Math.min(780, ctx.measureText(cod).width + 120), hCod = 118, yCod = cyCard + hCard - hCod - 54;
  retanguloRedondo(ctx, cx - wCod / 2, yCod, wCod, hCod, 22);
  ctx.fillStyle = "#FFF5F9"; ctx.fill();
  ctx.setLineDash([16, 12]); ctx.lineWidth = 4; ctx.strokeStyle = cor; ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#2C1219"; ctx.textBaseline = "middle";
  ctx.fillText(cod, cx + 3, yCod + hCod / 2 + 3);
  ctx.textBaseline = "alphabetic"; espacar(ctx, 0);

  // link do cardápio
  ctx.fillStyle = "#fff"; ctx.font = `700 44px ${familia}`;
  ctx.fillText("Peça pelo cardápio online", cx, 1180);
  ctx.globalAlpha = 0.92; ctx.font = `500 36px ${familia}`;
  ctx.fillText(caber(ctx, d.link.replace(/^https?:\/\//, "").replace(/\/cardapio$/, ""), 920), cx, 1236);
  ctx.globalAlpha = 1;

  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}
