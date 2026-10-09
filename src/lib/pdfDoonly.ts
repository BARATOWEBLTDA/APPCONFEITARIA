// ── pdfDoonly.ts ─────────────────────────────────────────────────────────────
// Modelo padrão de PDF do Doonly (aprovado 02/10). Todos os relatórios usam este
// modelo: faixa rosa da loja (logo, nome, WhatsApp, cidade), cartões claros, os
// números importantes num bloco vinho e o mesmo rodapé. Fonte Geist.
// Abre uma janela com o documento e chama a impressão (dá pra salvar em PDF,
// inclusive no iPhone). A janela é aberta ANTES de buscar os dados, senão o
// navegador bloqueia como pop-up.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "@/lib/supabase";

import { avisar } from "@/components/base";
export type Loja = { nome: string; contato: string; logo: string | null; inicial: string; isPro: boolean };

export const esc = (s: any): string =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
export const brl = (v: any): string => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (iso?: string | null): string => {
  if (!iso) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
};

/** Dados da loja pro cabeçalho: logo da Aparência → foto do perfil → inicial. */
export async function buscarLoja(): Promise<Loja> {
  const { data: { user } } = await supabase.auth.getUser();
  let p: any = null;
  if (user) {
    const { data } = await supabase.from("profiles")
      .select("nome, nome_loja, telefone, endereco, logo_url, foto_url, plano, pro_expira_em").eq("id", user.id).maybeSingle();
    p = data;
  }
  const nome = (p?.nome_loja || p?.nome || "Minha confeitaria").trim();
  let cidade = "";
  try { const e = typeof p?.endereco === "string" ? JSON.parse(p.endereco) : p?.endereco; cidade = [e?.cidade, e?.estado].filter(Boolean).join(", "); } catch {}
  const tel = String(p?.telefone || "").replace(/\D/g, "");
  const telFmt = tel.length === 11 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}` : tel.length === 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}` : (p?.telefone || "");
  const expira = p?.pro_expira_em ? new Date(p.pro_expira_em) : null;
  return {
    nome, contato: [telFmt, cidade].filter(Boolean).join(" · "),
    logo: p?.logo_url || p?.foto_url || null, inicial: nome.charAt(0).toUpperCase() || "D",
    isPro: p?.plano === "pro" && (!expira || expira > new Date()),
  };
}

/** Abre a janela já (no clique) e mostra "Preparando…" até o documento ficar pronto. */
export function abrirJanela(): Window | null {
  const w = window.open("", "_blank");
  if (w) { try { w.document.write('<p style="font-family:sans-serif;color:#9A8E94;padding:40px;text-align:center">Preparando o documento…</p>'); } catch {} }
  else avisar("Libere as janelas (pop-up) do navegador pra gerar o PDF.", { tipo: "erro" });
  return w;
}

export type Doc = { titulo: string; tipo: string; numero: string; sub?: string; tag?: string; corpo: string };

export function montarHtml(loja: Loja, d: Doc): string {
  const gerado = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " às");
  const av = loja.logo ? `<img src="${esc(loja.logo)}" alt="">` : esc(loja.inicial);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(d.titulo)} · ${esc(loja.nome)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="bar-acoes"><button onclick="window.print()">Salvar PDF / Imprimir</button></div>
<div class="pg">
<div class="hd"><div class="hb"><div class="av">${av}</div><div><p class="lj">${esc(loja.nome)}</p>${loja.contato ? `<p class="ct">${esc(loja.contato)}</p>` : ""}</div></div>
<div class="hn"><p class="hl">${esc(d.tipo)}</p><p class="hv">${esc(d.numero)}</p>${d.sub ? `<p class="hs">${esc(d.sub)}</p>` : ""}${d.tag ? `<span class="tag">${esc(d.tag)}</span>` : ""}</div></div>
${d.corpo}
<div class="ft"><span>Gerado em ${esc(gerado)}</span>${loja.isPro ? "" : `<span class="fb">Feito com <b>Doonly</b> · doonly.com.br</span>`}</div>
</div>
<script>window.onload=function(){var i=[].slice.call(document.images);Promise.all(i.map(function(m){return m.complete?1:new Promise(function(r){m.onload=m.onerror=r})})).then(function(){setTimeout(function(){window.print()},350)})}<\/script>
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
    try { w.document.body.innerHTML = '<p style="font-family:sans-serif;color:#B91C1C;padding:40px;text-align:center">Não foi possível gerar o documento. Tente de novo.</p>'; } catch {}
  }
}

// Peças prontas pro corpo dos documentos
export const card = (titulo: string, html: string, extra = "") => `<div class="card ${extra}"><p class="ctt">${esc(titulo)}</p>${html}</div>`;
export const kv = (pares: [string, string][]) => `<dl class="kv">${pares.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>`;
export const kpis = (itens: [string, string, boolean?][]) =>
  `<div class="kpis k${itens.length}">${itens.map(([l, v, hi]) => `<div class="${hi ? "hi" : ""}"><small>${esc(l)}</small><b>${v}</b></div>`).join("")}</div>`;
export const pill = (txt: string, cor: "ok" | "am" | "rd" | "bl" = "bl") => `<span class="pill ${cor}">${esc(txt)}</span>`;

const CSS = `
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #2C1219; background: #EFE9EC; font-size: 12.5px; line-height: 1.45; }
.bar-acoes { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; padding: 10px; background: rgba(239,233,236,.92); }
.bar-acoes button { border: none; border-radius: 10px; padding: 10px 18px; background: linear-gradient(90deg,#E85A8C,#C33A6E); color: #fff; font: 800 13px "Geist", sans-serif; cursor: pointer; }
.pg { max-width: 794px; margin: 0 auto 30px; background: #fff; padding: 32px 32px 26px; border-radius: 6px; box-shadow: 0 10px 30px rgba(60,20,35,.12); }
@media print { html, body { background: #fff; } .bar-acoes { display: none; } .pg { box-shadow: none; border-radius: 0; margin: 0; padding: 0; max-width: none; } }
.hd { display: flex; justify-content: space-between; gap: 18px; padding: 22px 24px; border-radius: 16px; color: #fff; background: linear-gradient(135deg,#E85A8C,#C33A6E); margin-bottom: 18px; }
.hb { display: flex; gap: 14px; align-items: center; min-width: 0; }
.av { width: 56px; height: 56px; border-radius: 14px; background: rgba(255,255,255,.22); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; overflow: hidden; flex-shrink: 0; }
.av img { width: 100%; height: 100%; object-fit: cover; background: #fff; }
.lj { font-size: 20px; font-weight: 900; letter-spacing: -.02em; line-height: 1.15; }
.ct { font-size: 12px; opacity: .92; margin-top: 3px; }
.hn { text-align: right; flex-shrink: 0; }
.hl { font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; opacity: .85; }
.hv { font-size: 22px; font-weight: 900; letter-spacing: -.02em; margin-top: 2px; }
.hs { font-size: 11.5px; opacity: .92; }
.tag { display: inline-block; margin-top: 7px; padding: 3px 11px; border-radius: 999px; background: rgba(255,255,255,.22); font-size: 11px; font-weight: 800; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.card { border: 1px solid #F1E6EB; background: #FFF9FB; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; break-inside: avoid; }
.g2 .card { margin-bottom: 0; }
.ctt { font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9A8E94; padding-bottom: 7px; margin-bottom: 9px; border-bottom: 1px solid #F1E6EB; }
.kv { display: grid; grid-template-columns: 112px 1fr; gap: 5px 10px; }
.kv dt { color: #9A8E94; font-weight: 600; } .kv dd { font-weight: 700; }
.tb { width: 100%; border-collapse: collapse; }
.tb th { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #9A8E94; text-align: left; padding: 5px 6px; border-bottom: 1px solid #F1E6EB; }
.tb td { padding: 8px 6px; border-bottom: 1px solid #F6EEF2; vertical-align: top; }
.tb tr { break-inside: avoid; } .tb tr:last-child td { border-bottom: none; }
.tb small { display: block; color: #7A6E74; font-size: 11px; margin-top: 2px; }
.c { text-align: center !important; } .r { text-align: right !important; white-space: nowrap; }
.tb .sub td { font-weight: 800; background: #FCEFF5; }
.tot { border-radius: 14px; padding: 14px 16px; background: #2C1219; color: #fff; display: flex; flex-direction: column; gap: 5px; justify-content: center; break-inside: avoid; }
.tot div { display: flex; justify-content: space-between; gap: 10px; }
.tot span { opacity: .75; }
.tot .tt { border-top: 1px solid rgba(255,255,255,.2); padding-top: 8px; margin-top: 3px; font-size: 16px; }
.tot .tt span { opacity: 1; font-weight: 800; } .tot .tt b { font-size: 20px; font-weight: 900; }
.tot .rest b { color: #F9A8D4; }
.neg { color: #DC2626; } .tot .neg { color: #FCA5A5; } .pos { color: #15803D; }
.pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 800; white-space: nowrap; }
.ok { background: #DCFCE7; color: #15803D; } .am { background: #FEF3C7; color: #B45309; } .rd { background: #FEE2E2; color: #B91C1C; } .bl { background: #DBEAFE; color: #1D4ED8; }
.obs { margin-top: 10px; font-size: 11.5px; color: #6B5D64; background: #fff; border: 1px dashed #F1D3E0; border-radius: 10px; padding: 8px 10px; }
.kpis { display: grid; gap: 10px; margin-bottom: 12px; grid-template-columns: repeat(4, 1fr); }
.kpis.k3 { grid-template-columns: repeat(3, 1fr); } .kpis.k2 { grid-template-columns: repeat(2, 1fr); }
.kpis div { border: 1px solid #F1E6EB; border-radius: 14px; padding: 12px 14px; background: #FFF9FB; }
.kpis small { display: block; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #9A8E94; }
.kpis b { font-size: 18px; font-weight: 900; display: block; margin-top: 3px; }
.kpis .hi { background: #2C1219; border-color: #2C1219; color: #fff; } .kpis .hi small { color: #F9A8D4; }
.bars { display: flex; align-items: flex-end; gap: 10px; height: 140px; }
.bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; }
.bar i { width: 100%; border-radius: 7px 7px 3px 3px; background: linear-gradient(180deg,#F472B6,#C33A6E); min-height: 2px; }
.bar span { font-size: 10.5px; color: #9A8E94; } .bar em { font-style: normal; font-size: 9.5px; color: #6B5D64; font-weight: 700; }
.hr { font-weight: 900; color: #C33A6E; white-space: nowrap; } .ck { text-align: center; font-size: 15px; color: #C4B8BE; }
.thx { text-align: center; margin-top: 16px; font-size: 13.5px; font-weight: 700; color: #C33A6E; }
.vazio { color: #9A8E94; text-align: center; padding: 14px 0; }
.ft { margin-top: 22px; display: flex; justify-content: space-between; gap: 10px; font-size: 10.5px; color: #9A8E94; border-top: 1px solid #F1E6EB; padding-top: 9px; }
.fb b { color: #C33A6E; }
@media (max-width: 640px) { .pg { padding: 16px; } .g2 { grid-template-columns: 1fr; } .kpis { grid-template-columns: 1fr 1fr; } .hd { flex-direction: column; } .hn { text-align: left; } }
`;
