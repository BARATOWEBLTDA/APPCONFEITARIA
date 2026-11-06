/**
 * (6.179) Férias e feriados: dias em que a loja não entrega nem retira.
 * Fica em profiles.dias_fechados (lista de { inicio, fim, tipo, nome }). O cardápio risca esses dias no calendário,
 * mostra o aviso no topo e o banco recusa pedido para eles (pedido_data_ok → data_fechada).
 */
/** avisar: quantos dias antes o cardápio mostra o aviso (0 = só quando fechar · 999 = desde já) */
export type DiaFechado = { inicio: string; fim: string; tipo: "ferias" | "feriado"; nome?: string; avisar?: number };
export const AVISO_PADRAO = 15;
export const avisarDe = (f: DiaFechado) => typeof f.avisar === "number" && f.avisar >= 0 ? f.avisar : AVISO_PADRAO;
/** "Avisa 15 dias antes" · "Avisa desde já" · "Avisa quando fechar" */
export const textoAviso = (f: DiaFechado) => { const n = avisarDe(f); return n >= 999 ? "Avisa desde já" : n === 0 ? "Avisa quando fechar" : `Avisa ${n} ${n === 1 ? "dia" : "dias"} antes`; };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isoDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const somar = (iso: string, n: number) => { const d = deIso(iso); d.setDate(d.getDate() + n); return isoDe(d); };
export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** Hoje no horário de Brasília (aaaa-mm-dd) */
export function hojeBr(): string {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  } catch { return isoDe(new Date()); }
}

/** Lê a lista do banco (aceita texto JSON, ignora o que estiver quebrado) e devolve em ordem */
export function lerFechados(bruto: unknown): DiaFechado[] {
  let x = bruto;
  if (typeof x === "string") { try { x = JSON.parse(x); } catch { x = null; } }
  if (!Array.isArray(x)) return [];
  const out: DiaFechado[] = [];
  for (const e of x) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const inicio = String(o.inicio || "");
    if (!ISO.test(inicio)) continue;
    let fim = ISO.test(String(o.fim || "")) ? String(o.fim) : inicio;
    if (fim < inicio) fim = inicio;
    const av = Number(o.avisar);
    out.push({ inicio, fim, tipo: o.tipo === "feriado" || (fim === inicio && o.tipo !== "ferias") ? "feriado" : "ferias",
      ...(o.nome ? { nome: String(o.nome).slice(0, 60) } : {}), ...(o.avisar != null && Number.isFinite(av) && av >= 0 ? { avisar: Math.min(999, Math.round(av)) } : {}) });
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** O período fechado que pega esse dia (ou null) */
export function fechadoEm(iso: string, lista: DiaFechado[]): DiaFechado | null {
  return lista.find(f => iso >= f.inicio && iso <= f.fim) || null;
}

/** Os que ainda não acabaram (de hoje em diante) */
export const fechadosAtivos = (lista: DiaFechado[], hoje = hojeBr()) => lista.filter(f => f.fim >= hoje);

/** "20/12 a 05/01" ou "25/12" */
export const textoPeriodo = (f: DiaFechado) => f.inicio === f.fim ? ddmm(f.inicio) : `${ddmm(f.inicio)} a ${ddmm(f.fim)}`;
/** Dia seguinte ao fim (quando volta) */
export const diaDeVolta = (f: DiaFechado) => somar(f.fim, 1);

/**
 * Aviso do cardápio: fechado agora (hoje dentro do período) ou um período que já entrou na antecedência que a loja escolheu
 * (dias antes: avisar de cada período; `janela` força um prazo, ex.: os próximos passos da loja).
 * Junta períodos colados (ex.: férias até 31/12 e feriado 01/01) pra dizer o dia certo da volta.
 */
export function avisoFechado(lista: DiaFechado[], hoje = hojeBr(), janela?: number): { agora: boolean; f: DiaFechado } | null {
  const ativos = fechadosAtivos(lista, hoje);
  const i = ativos.findIndex(o => o.inicio <= hoje || o.inicio <= somar(hoje, janela ?? Math.min(avisarDe(o), 400)));
  if (i < 0) return null;
  const prox = ativos[i];
  const agora = prox.inicio <= hoje;
  let f = { ...prox };
  for (const o of ativos.slice(i + 1)) { if (o.inicio <= somar(f.fim, 1)) { if (o.fim > f.fim) f = { ...f, fim: o.fim, tipo: "ferias" }; } else break; }
  return { agora, f };
}

/** Junta a lista no horário (assim o calendário, os horários e o "Aberto agora" já pulam esses dias) */
export function horarioComFechados(horario: unknown, fechados: unknown): unknown {
  const lista = fechadosAtivos(lerFechados(fechados));
  if (!lista.length) return horario;
  let h = horario;
  if (typeof h === "string") { try { h = JSON.parse(h); } catch { h = null; } }
  return { ...(h && typeof h === "object" ? h as object : {}), fechados: lista };
}

/* ─── Feriados nacionais ─── */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
export type Feriado = { data: string; nome: string };
export function feriadosNacionais(ano: number): Feriado[] {
  const p = isoDe(pascoa(ano));
  const fixos: [string, string][] = [["01-01", "Ano Novo"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"], ["09-07", "Independência"],
    ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"], ["11-15", "Proclamação da República"], ["11-20", "Consciência Negra"], ["12-25", "Natal"]];
  return [
    ...fixos.map(([md, nome]) => ({ data: `${ano}-${md}`, nome })),
    { data: somar(p, -48), nome: "Carnaval" }, { data: somar(p, -47), nome: "Carnaval" },
    { data: somar(p, -2), nome: "Sexta-feira Santa" }, { data: somar(p, 60), nome: "Corpus Christi" },
  ].sort((a, b) => a.data.localeCompare(b.data));
}
/** Os próximos feriados a partir de hoje (inclusive), até `dias` dias */
export function proximosFeriados(hoje = hojeBr(), dias = 120): Feriado[] {
  const ano = Number(hoje.slice(0, 4)), ate = somar(hoje, dias);
  return [...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)].filter(f => f.data >= hoje && f.data <= ate);
}

/** Dias entre hoje e a data (0 = hoje) */
export const diasAte = (iso: string, hoje = hojeBr()) => Math.round((deIso(iso).getTime() - deIso(hoje).getTime()) / 86400000);
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const diaDaSemana = (iso: string) => SEMANA[deIso(iso).getDay()];

/** Acrescenta (ou tira) um período e grava. Lê do banco antes pra não apagar o que outro aparelho salvou. */
export async function salvarFechados(uid: string, mudar: (l: DiaFechado[]) => DiaFechado[]): Promise<{ ok: boolean; lista: DiaFechado[]; erro?: string }> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase.from("profiles").select("dias_fechados").eq("id", uid).maybeSingle();
  if (error) return { ok: false, lista: [], erro: error.message };
  const atual = fechadosAtivos(lerFechados((data as { dias_fechados?: unknown } | null)?.dias_fechados));
  const nova = fechadosAtivos(mudar(atual)).slice(0, 40);
  const { error: e2 } = await supabase.from("profiles").update({ dias_fechados: nova }).eq("id", uid);
  if (e2) return { ok: false, lista: atual, erro: e2.message };
  return { ok: true, lista: nova };
}
