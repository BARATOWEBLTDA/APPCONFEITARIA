/**
 * Apoio das telas de Notícias (07/10 · 3.10).
 * quandoFoi: "hoje", "ontem", "há 3 dias", "há 2 semanas"… por extenso e contando dias do calendário (não blocos de 24h).
 * semAcento: pra busca achar "pao" em "pão".
 */
export function quandoFoi(iso: string, agora: Date = new Date()): string {
  if (!iso) return "";
  const soData = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = soData ? new Date(Number(soData[1]), Number(soData[2]) - 1, Number(soData[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const meiaNoite = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.max(0, Math.round((meiaNoite(agora) - meiaNoite(d)) / 86400000));
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) { const s = Math.floor(dias / 7); return `há ${s} ${s === 1 ? "semana" : "semanas"}`; }
  if (dias < 365) { const m = Math.floor(dias / 30); return `há ${m} ${m === 1 ? "mês" : "meses"}`; }
  const a = Math.floor(dias / 365);
  return `há ${a} ${a === 1 ? "ano" : "anos"}`;
}

export function semAcento(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "há 6 dias · 4 min de leitura" */
export function linhaDeTempo(publicadoEm: string, minutos: number | null | undefined): string {
  return [quandoFoi(publicadoEm), minutos ? `${minutos} min de leitura` : ""].filter(Boolean).join(" · ");
}
