// ── pdfDoonly.ts ─────────────────────────────────────────────────────────────
// Modelo padrão de PDF do Doonly (03/11: estilo de sistema, compacto). Todos os
// documentos usam este modelo: cabeçalho numa faixa baixa (logo, nome, contato numa
// linha só, e o número do documento à direita) com uma linha rosa embaixo, quadros
// com título cinza, tabela com títulos que se repetem em cada página e o mesmo
// rodapé em todas as páginas (quando foi gerado · "Feito com Doonly" no grátis ·
// Página X de Y). Da 2ª página em diante, o topo diz de quem é e qual documento.
// Abre uma janela com o documento e chama a impressão (dá pra salvar em PDF,
// inclusive no iPhone). A janela é aberta ANTES de buscar os dados, senão o
// navegador bloqueia como pop-up. O nome do arquivo salvo é o título ("Pedido #148").
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";
import { fotoDaLoja } from "@/hooks/useProfile";
import { arrobaInstagram } from "@/lib/redesSociais";

import { avisar } from "@/components/base";
export type Loja = { nome: string; contato: string; logo: string | null; inicial: string; isPro: boolean };

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
export const brl = (v: unknown): string => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (iso?: string | null): string => {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};
/** "Sábado, 21/11/2026 às 15:30" (sem hora: só o dia; sem data: "") */
export function diaLongo(data?: string | null, hora?: string | null): string {
  if (!data) return "";
  const d = new Date(String(data).slice(0, 10) + "T12:00:00");
  if (isNaN(d.getTime())) return "";
  const sem = d.toLocaleDateString("pt-BR", { weekday: "long" });
  const h = hora ? String(hora).slice(0, 5) : "";
  return `${sem.charAt(0).toUpperCase()}${sem.slice(1)}, ${d.toLocaleDateString("pt-BR")}${h ? ` às ${h}` : ""}`;
}
/** (41) 99876-5432 a partir de qualquer jeito que o número foi digitado */
export const telBR = (v?: string | null): string => {
  const t = String(v || "").replace(/\D/g, "");
  const n = t.length === 13 && t.startsWith("55") ? t.slice(2) : t;
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : String(v || "").trim();
};

/** Dados da loja pro cabeçalho: logo da Aparência → foto do perfil → inicial. */
export async function buscarLoja(): Promise<Loja> {
  const { data: { user } } = await supabase.auth.getUser();
  let p: { nome?: string | null; nome_loja?: string | null; telefone?: string | null; instagram?: string | null; endereco?: string | { cidade?: string; estado?: string } | null; logo_url?: string | null; foto_url?: string | null; plano?: string | null; pro_expira_em?: string | null } | null = null;
  if (user) {
    const { data, error } = await supabase.from("profiles")
      .select("nome, nome_loja, telefone, instagram, endereco, logo_url, foto_url, plano, pro_expira_em").eq("id", user.id).maybeSingle();
    // (27/10) não leu o perfil: para com o aviso de "tente de novo" (antes o PDF de uma conta PRO saía com a marca do Doonly)
    if (error || !data) throw error || new Error("perfil não carregou");
    p = data;
  }
  const nome = (p?.nome_loja || p?.nome || "Minha confeitaria").trim();
  let cidade = "";
  try { const e = typeof p?.endereco === "string" ? JSON.parse(p.endereco) : p?.endereco; cidade = [e?.cidade, e?.estado].filter(Boolean).join(", "); } catch { /* endereço inválido: sai sem a cidade */ }
  const expira = p?.pro_expira_em ? new Date(p.pro_expira_em) : null;
  return {
    // (03/11) contato numa linha só: WhatsApp · @instagram · cidade
    nome, contato: [telBR(p?.telefone), arrobaInstagram(p?.instagram), cidade].filter(Boolean).join(" · "),
    logo: fotoDaLoja(p) || null, inicial: nome.charAt(0).toUpperCase() || "D",
    isPro: p?.plano === "pro" && (!expira || expira > new Date()),
  };
}

/** Abre a janela já (no clique) e mostra "Preparando…" até o documento ficar pronto. */
export function abrirJanela(): Window | null {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;color:#776B71;padding:40px;text-align:center">Preparando o documento…</p>'); } catch { /* janela já fechada: só não mostra o aviso */ } }
  else avisar("Libere as janelas (pop-up) do navegador para gerar o PDF.", { tipo: "erro" });
  return w;
}

/**
 * titulo: nome do arquivo ao salvar ("Pedido #148").
 * tipo + numero: o que vai no canto direito do cabeçalho. Número com "#" sai junto
 * ("Pedido #148"); texto (nome do produto, dia) sai embaixo do tipo.
 */
export type Doc = { titulo: string; tipo: string; numero: string; sub?: string; destaque?: string; alerta?: boolean; corpo: string };

/** Texto pronto pra ir dentro de content: "…" no CSS (sem quebrar a regra nem fechar o <style>) */
const cssTexto = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ").replace(/</g, "\\3C ")}"`;

/** Chrome, Edge, Android: sabem pôr o rodapé e o "Página X de Y" em todas as páginas. Safari/iPhone e Firefox não. */
const sabeRodapeDePagina = () => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /Chrome\/|Chromium\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
};

export function montarHtml(loja: Loja, d: Doc, rodapeDePagina = sabeRodapeDePagina()): string {
  const gerado = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  const av = loja.logo ? `<img src="${esc(loja.logo)}" alt="">` : `<span>${esc(loja.inicial)}</span>`;
  const comNumero = d.numero.startsWith("#");
  const titulo = comNumero ? `${d.tipo} ${d.numero}` : d.tipo;
  const linhasDireita = [comNumero ? "" : d.numero, d.sub || ""].filter(Boolean);
  const marca = "Feito com Doonly · doonly.com.br";
  // (03/11) cabeçalho e rodapé de página: o Chrome os desenha em todas as páginas (e some o cabeçalho do próprio navegador)
  const pagina = rodapeDePagina ? `
@page {
  @top-left { content: ${cssTexto(`${loja.nome} · ${d.titulo}`)}; ${MARGEM_CIMA} }
  @top-right { content: "Página " counter(page) " de " counter(pages); ${MARGEM_CIMA} }
  @bottom-left { content: ${cssTexto(`Gerado em ${gerado}`)}; ${MARGEM_BAIXO} }
  ${loja.isPro ? "" : `@bottom-center { content: ${cssTexto(marca)}; ${MARGEM_BAIXO} color: #C33A6E; font-weight: 500; }`}
  @bottom-right { content: "Página " counter(page) " de " counter(pages); ${MARGEM_BAIXO} }
}
@page :first { @top-left { content: none; } @top-right { content: none; } }
@media print { .ft { display: none; } }` : "";
  // os títulos das colunas viram <thead>: o navegador repete a linha no topo de cada página
  const corpo = d.corpo.replace(/<table class="tb">\s*(<tr>\s*<th[\s\S]*?<\/tr>)/g, '<table class="tb"><thead>$1</thead>');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.titulo)}</title>
<meta name="viewport" content="width=840">
<style>${fontesPoppins()}</style>
<style>${CSS}${pagina}</style></head><body>
<div class="bar-acoes"><button onclick="window.print()">Salvar PDF / Imprimir</button></div>
<div class="pg">
<div class="hd"><div class="av">${av}</div>
<div class="lj"><b>${esc(loja.nome)}</b>${loja.contato ? `<span>${esc(loja.contato)}</span>` : ""}</div>
<div class="nr"><b>${esc(titulo)}</b>${linhasDireita.map(l => `<span>${esc(l)}</span>`).join("")}${d.destaque ? `<em${d.alerta ? ' class="al"' : ""}>${esc(d.destaque)}</em>` : ""}</div></div>
${corpo}
<div class="ft"><span>Gerado em ${esc(gerado)}</span>${loja.isPro ? "" : `<span class="fb">${esc(marca)}</span>`}</div>
</div>
<script>${ESPERA_E_IMPRIME}<\/script>
</body></html>`;
}

/** Fluxo completo: janela aberta no clique → busca a loja → escreve o documento. */
export async function gerarDocumento(montarCorpo: (loja: Loja) => Promise<Doc> | Doc, janela?: Window | null): Promise<void> {
  const w = janela ?? abrirJanela();
  if (!w) return;
  try {
    const loja = await buscarLoja();
    const doc = await montarCorpo(loja);
    w.document.open(); w.document.write(montarHtml(loja, doc)); w.document.close();
  } catch (e) {
    console.error("Erro ao gerar PDF:", e);
    try { w.document.body.innerHTML = '<p style="font-family:sans-serif;color:#B91C1C;padding:40px;text-align:center">Não foi possível gerar o documento. Tente de novo.</p>'; } catch { /* janela já fechada pela pessoa */ }
  }
}

// Peças prontas pro corpo dos documentos
/** Quadro com título cinza. Com tabela dentro, pode continuar na página seguinte. */
export const card = (titulo: string, html: string, extra = "") =>
  `<div class="card${/<table class="tb[" ]/.test(html) ? " tab" : ""}${extra ? ` ${extra}` : ""}">${titulo ? `<p class="ctt">${esc(titulo)}</p>` : ""}<div class="cc">${html}</div></div>`;
export const kv = (pares: [string, string][]) => `<dl class="kv">${pares.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
export const kpis = (itens: [string, string, boolean?][]) =>
  `<div class="kpis k${itens.length}">${itens.map(([l, v, hi]) => `<div class="${hi ? "hi" : ""}"><small>${esc(l)}</small><b>${v}</b></div>`).join("")}</div>`;
export const pill = (txt: string, cor: "ok" | "am" | "rd" | "bl" = "bl") => `<span class="pill ${cor}">${esc(txt)}</span>`;

/** (27/10) a Poppins do próprio app (os arquivos já estão no site), sem depender do Google Fonts */
function fontesPoppins(): string {
  const base = typeof location !== "undefined" ? location.origin : "";
  const f = (arq: string, peso: string) => `@font-face{font-family:'Poppins';src:url('${base}/fonts/Poppins-${arq}.woff2') format('woff2');font-weight:${peso};font-display:swap}`;
  return f("400", "400") + f("500", "500") + f("600", "600 700") + f("700", "800 900");
}

/**
 * (03/11) só imprime com a Poppins e o logo já carregados (antes podia sair com outra
 * fonte e o logo em branco: a fonte só começa a baixar quando é usada). No máximo 5 s
 * de espera: se a internet falhar, imprime assim mesmo.
 */
const ESPERA_E_IMPRIME = `(function(){
var feito=false;function imprime(){if(feito)return;feito=true;setTimeout(function(){window.print()},300)}
function some(m){var p=m.parentNode;(p&&p.className==="av"?p:m).style.display="none"}
function imagens(){return Promise.all([].slice.call(document.images).map(function(m){if(m.complete)return m.naturalWidth?1:(some(m),1);return new Promise(function(r){m.onload=r;m.onerror=function(){some(m);r()}})}))}
function fontes(){var f=document.fonts;if(!f||!f.load)return Promise.resolve();return Promise.all(["400","500","600"].map(function(p){return f.load(p+" 12px Poppins").catch(function(){})})).then(function(){return f.ready})}
function vai(){Promise.all([fontes(),imagens()]).then(imprime,imprime);setTimeout(imprime,5000)}
if(document.readyState==="complete")vai();else window.addEventListener("load",vai);
})();`;

const MARGEM = `font-family: "Poppins", sans-serif; font-size: 8px; font-weight: 400; color: #8A7F84;`;
const MARGEM_CIMA = `${MARGEM} vertical-align: bottom; padding-bottom: 4mm;`;
const MARGEM_BAIXO = `${MARGEM} vertical-align: top; padding-top: 4mm;`;

const CSS = `
@page { size: A4; margin: 14mm 12mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { font-family: "Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2C1219; background: #EFE9EC; font-size: 10.5px; line-height: 1.4; }
b, strong { font-weight: 600; }
.bar-acoes { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; padding: 10px; background: rgba(239,233,236,.92); }
.bar-acoes button { border: none; border-radius: 10px; padding: 10px 18px; background: linear-gradient(90deg,#E85A8C,#C33A6E); color: #fff; font: 600 13px "Poppins", sans-serif; cursor: pointer; }
@media (pointer: coarse) { .bar-acoes { padding: 18px; } .bar-acoes button { font-size: 28px; padding: 20px 40px; border-radius: 18px; } }
.pg { max-width: 794px; margin: 0 auto 30px; background: #fff; padding: 14mm 12mm; border-radius: 6px; box-shadow: 0 10px 30px rgba(60,20,35,.12); }
/* (03/11) no celular a tela mostra a folha inteira em miniatura (viewport 840), igual ao PDF que vai sair */
@media print { html, body { background: #fff; } .bar-acoes { display: none; } .pg { box-shadow: none; border-radius: 0; margin: 0; padding: 0; max-width: none; } }
/* cabeçalho: uma faixa baixa, linha rosa embaixo */
.hd { display: flex; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 2px solid #C33A6E; margin-bottom: 10px; }
.av { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; overflow: hidden; border: 1px solid #EEE5E9; background: #FCEFF5; color: #C33A6E; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; }
.av img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
.lj { flex: 1; min-width: 0; }
.lj b, .nr b { display: block; font-size: 15px; line-height: 1.25; }
.lj b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lj span { display: block; color: #776B71; }
.nr { text-align: right; flex-shrink: 0; max-width: 55%; }
.nr span { display: block; color: #776B71; }
.nr em { display: inline-block; margin-top: 3px; font-style: normal; font-weight: 600; font-size: 10px; color: #C33A6E; background: #FCEFF5; border-radius: 4px; padding: 1px 7px; }
.nr em.al { color: #B91C1C; background: #FEE2E2; }
/* agenda do dia */
.tb.ag td.hr { width: 46px; } .tb.ag td.ag-q { width: 36%; }
.tb .it + .it { margin-top: 4px; }
.tb small.al { color: #B91C1C; font-weight: 500; }
.tb small.ag-ob { margin-top: 4px; padding: 3px 6px; background: #FBF7F9; border-radius: 4px; color: #4A3A41; }
.tb small.ag-ob b { font-weight: 600; }
.tb td.ck { width: 44px; }
/* carimbo e assinatura */
.ass { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 46px; break-inside: avoid; }
.ass div { text-align: center; }
.ass span { display: block; border-top: 1px solid #2C1219; margin-bottom: 4px; }
.ass b { display: block; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ass small { display: block; color: #776B71; font-size: 9px; }
/* quadros com título cinza (padrão de sistema) */
.card { border: 1px solid #E6DCE1; border-radius: 6px; margin-bottom: 8px; break-inside: avoid; }
.card.tab { break-inside: auto; border: none; border-radius: 0; }
/* quadro com tabela que continua na outra página: sem moldura lateral (senão ela desce até o pé da folha) */
.card.tab > .ctt { border: 1px solid #E6DCE1; }
.card.tab > .cc { padding: 0; }
.card.tab > .cc > .tb { width: 100%; margin: 0; }
.card.tab > .cc > .tb tbody tr:last-child td { border-bottom: 1px solid #E6DCE1; }
.ctt { font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #776B71; background: #F8F3F5; padding: 4px 9px; border-bottom: 1px solid #E6DCE1; border-radius: 6px 6px 0 0; break-after: avoid; }
.cc { padding: 5px 9px; }
.cc > p + p { margin-top: 4px; }
.cc > .tb { width: calc(100% + 18px); margin: -5px -9px; }
.cc > .tb th { background: transparent; border-top: none; }
.kv { display: grid; grid-template-columns: fit-content(45%) minmax(0, 1fr); gap: 1px 10px; }
.kv dt { min-width: 64px; }
.kv dt { color: #776B71; } .kv dd { font-weight: 500; overflow-wrap: anywhere; }
.kv dd i { font-style: normal; color: #776B71; font-weight: 400; margin: 0 6px; }
/* tabela */
.tb { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.tb th { font-size: 9px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #776B71; background: #F8F3F5; text-align: left; padding: 4px 9px; border-top: 1px solid #E6DCE1; border-bottom: 1px solid #E6DCE1; }
.tb td { padding: 4px 9px; border-bottom: 1px solid #F0E8EC; vertical-align: top; overflow-wrap: anywhere; }
.tb tr { break-inside: avoid; }
.tb tbody tr:last-child td { border-bottom: 1px solid #E6DCE1; }
.cc > .tb tbody tr:last-child td { border-bottom: none; }
.tb td b { overflow-wrap: anywhere; }
.tb small { display: block; color: #776B71; font-size: 9.5px; line-height: 1.35; overflow-wrap: anywhere; }
.tb small.rc { color: #A3305E; } .tb small.rc b { font-weight: 600; }
/* (03/11) texto numa linha só, com "…" quando não cabe (a coluna fica com o espaço que sobra) */
.tb td.um { max-width: 0; width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
.tb td.n { color: #A0959A; width: 30px; white-space: nowrap; overflow-wrap: normal; }
.tb th.c { width: 64px; } .tb th.r { width: 96px; } .tb th.qt { width: 86px; }
.c { text-align: center !important; white-space: nowrap; } .r { text-align: right !important; white-space: nowrap; }
.tb .sub td { font-weight: 600; background: #F8F3F5; }
.fim { break-before: avoid; }
.prod { margin-bottom: 8px; display: flex; align-items: center; gap: 10px; } .prod > div { min-width: 0; } .prod img { width: 52px; height: 52px; border-radius: 6px; object-fit: cover; border: 1px solid #E6DCE1; flex-shrink: 0; } .prod b { display: block; font-size: 14px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .prod span { display: block; color: #776B71; } .prod i { font-style: normal; margin: 0 6px; }
/* totais e pagamento */
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; align-items: start; break-inside: avoid; }
.g2.lado { grid-template-columns: minmax(0, 1fr) 230px; }
.g2 > .card, .g2 > div { margin-bottom: 0; }
.g2 > div > .card:last-child { margin-bottom: 0; }
.tot { border: 1px solid #E6DCE1; border-radius: 6px; padding: 6px 9px; break-inside: avoid; }
.tot div { display: flex; justify-content: space-between; gap: 10px; padding: 1px 0; }
.tot span { color: #776B71; } .tot b { white-space: nowrap; }
.tot .tt { border-top: 1px solid #E6DCE1; margin-top: 4px; padding-top: 5px; font-size: 13px; }
.tot .tt span { color: #2C1219; font-weight: 600; }
.tot .rest b { color: #C33A6E; } .tot .rest b.neg { color: #B91C1C; }
.neg { color: #B91C1C; } .pos { color: #15803D; }
.pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 9.5px; font-weight: 600; white-space: nowrap; }
.ok { background: #DCFCE7; color: #15803D; } .am { background: #FEF3C7; color: #B45309; } .rd { background: #FEE2E2; color: #B91C1C; } .bl { background: #DBEAFE; color: #1D4ED8; }
.obs { margin-top: 5px; padding: 5px 8px; background: #FBF7F9; border-radius: 4px; color: #4A3A41; overflow-wrap: anywhere; }
.ob { overflow-wrap: anywhere; white-space: pre-line; }
/* números grandes (ficha técnica, agenda) */
.kpis { display: grid; gap: 8px; margin-bottom: 8px; grid-template-columns: repeat(4, 1fr); break-inside: avoid; }
.kpis.k3 { grid-template-columns: repeat(3, 1fr); } .kpis.k2 { grid-template-columns: repeat(2, 1fr); }
.kpis div { border: 1px solid #E6DCE1; border-radius: 6px; padding: 6px 9px; }
.kpis small { display: block; font-size: 9px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: #776B71; }
.kpis b { font-size: 14px; display: block; margin-top: 1px; white-space: nowrap; }
.kpis .hi b { color: #C33A6E; }
.bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; }
.bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; }
.bar i { width: 100%; border-radius: 5px 5px 2px 2px; background: #C33A6E; min-height: 2px; }
.bar span { font-size: 9.5px; color: #776B71; } .bar em { font-style: normal; font-size: 9px; color: #6B5D64; font-weight: 600; }
.hr { font-weight: 600; color: #C33A6E; white-space: nowrap; } .ck { text-align: center; font-size: 13px; color: #A0959A; }
.thx { text-align: center; margin-top: 12px; font-size: 11px; color: #776B71; }
.vazio { color: #776B71; text-align: center; padding: 10px 0; }
/* rodapé no fim do documento: só onde o navegador não põe o rodapé em cada página (Safari/iPhone) */
.ft { margin-top: 14px; display: flex; justify-content: space-between; gap: 10px; font-size: 8px; color: #8A7F84; border-top: 1px solid #E6DCE1; padding-top: 6px; }
.fb { color: #C33A6E; font-weight: 500; }
`;
