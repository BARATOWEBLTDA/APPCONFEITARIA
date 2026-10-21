/**
 * (18/10) Cores do cardápio público: só três, todas no topo da loja.
 *  · Borda da logo (cor_borda)
 *  · Nome da loja (cor_nome)
 *  · Faixa do topo (cor_navbar): atrás da logo, no lugar da foto do topo; no computador, a barra de cima.
 * Botões, ícones, "Sobre a loja" e o resto ficam sempre no rosa do Doonly.
 * Grátis: escolhe entre as cores prontas de cada uma. PRO: qualquer cor.
 * cor_botao, cor_background, cor_sacola e cor_rodape não são mais usadas (ficam no banco).
 */
export type CampoCor = "cor_borda" | "cor_nome" | "cor_navbar";

export const COR_BOTOES = "#EC4899";

export const PADRAO: Record<CampoCor, string> = { cor_borda: "#EC4899", cor_nome: "#2C1219", cor_navbar: "#BF6B84" };

export const PRONTAS: Record<CampoCor, { nome: string; cor: string }[]> = {
  cor_borda: [
    { nome: "Rosa", cor: "#EC4899" }, { nome: "Roxo", cor: "#7C3AED" }, { nome: "Azul", cor: "#2563EB" },
    { nome: "Verde", cor: "#16A34A" }, { nome: "Laranja", cor: "#EA580C" }, { nome: "Chocolate", cor: "#7B4A36" },
  ],
  cor_nome: [
    { nome: "Chocolate", cor: "#2C1219" }, { nome: "Preto", cor: "#111111" }, { nome: "Rosa", cor: "#BE185D" },
    { nome: "Roxo", cor: "#6D28D9" }, { nome: "Azul", cor: "#1D4ED8" }, { nome: "Verde", cor: "#15803D" },
  ],
  cor_navbar: [
    { nome: "Rosa antigo", cor: "#BF6B84" }, { nome: "Rosa", cor: "#EC4899" }, { nome: "Roxo", cor: "#7C3AED" },
    { nome: "Azul", cor: "#2563EB" }, { nome: "Verde", cor: "#16A34A" }, { nome: "Chocolate", cor: "#7B4A36" },
  ],
};

const hex6 = (c?: string | null) => (c && /^#[0-9a-fA-F]{6}$/.test(c.trim()) ? c.trim().toUpperCase() : null);

/* (21/10) o que o banco grava sozinho numa conta nova (o padrão antigo das colunas): não é escolha da loja.
 * Antes o PRO usava esse valor (topo branco caía na cor da borda e virava um roxo forte do nada ao ativar o PRO). */
const DO_BANCO: Record<CampoCor, string[]> = { cor_navbar: ["#FFFFFF", "#FEFEFE"], cor_nome: ["#1F2937"], cor_borda: [] };

/** A cor que vale no cardápio: PRO usa a que escolheu; grátis só se for uma das prontas daquele item. */
export function corDoItem(campo: CampoCor, salva: string | null | undefined, isPro: boolean): string {
  const h = hex6(salva);
  if (h && DO_BANCO[campo].includes(h)) return PADRAO[campo];
  if (h && (isPro || PRONTAS[campo].some(p => p.cor === h))) return h;
  return PADRAO[campo];
}

const lum = (c: string) => { const h = hex6(c); if (!h) return 0; const n = parseInt(h.slice(1), 16); return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
/** Cor clara? (pra decidir se o texto em cima é escuro ou branco) */
export const corClara = (c: string) => lum(c) > 170;
/** O nome em cima do topo (computador): a cor escolhida se der pra ler; senão branco ou chocolate. */
export function nomeSobreTopo(nome: string, topo: string): string {
  return Math.abs(lum(nome) - lum(topo)) >= 90 ? nome : (corClara(topo) ? "#2C1219" : "#FFFFFF");
}

/* (20/10) Faixa do topo "premium": a cor da loja escurecida pelo app, no mesmo tom,
 * até o texto branco ficar bem legível (contraste 8,5 : 1). Cor já escura fica como está.
 * Amarelo e bege viram marrom feio quando escurecem: nesses casos usa o chocolate do Doonly. */
const canal = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const contrasteBranco = (r: number, g: number, b: number) => 1.05 / (0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b) + 0.05);
const hslParaRgb = (h: number, s: number, l: number): [number, number, number] => {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
};
const paraHex = (r: number, g: number, b: number) => "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
export function topoEscurecido(cor: string, alvo = 8.5): string {
  const h6 = hex6(cor);
  if (!h6) return cor;
  const n = parseInt(h6.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (contrasteBranco(r, g, b) >= alvo) return h6;
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let l = (mx + mn) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), h = 0;
  if (d) h = (mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4) / 6;
  if (h < 0) h += 1;
  if (h * 360 >= 40 && h * 360 <= 75 && s > 0.3) return "#3A2219";
  if (s > 0.08) s = Math.max(Math.min(s, 0.7), 0.3);
  l = Math.min(l, 0.5);
  while (l > 0.16) {
    const [rr, gg, bb] = hslParaRgb(h, s, l);
    if (contrasteBranco(rr, gg, bb) >= alvo) return paraHex(rr, gg, bb);
    l -= 0.01;
  }
  return paraHex(...hslParaRgb(h, s, 0.16));
}
