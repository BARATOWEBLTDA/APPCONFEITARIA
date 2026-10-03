/**
 * Regras do agendamento na "Finalizar encomenda" do cardápio (02/10).
 *  - Dias e horários: os de funcionamento da loja (Dados da loja → Horário), de hora em hora.
 *  - Antecedência: a MAIOR entre os produtos do pedido (24h, 48h, 3 dias…). Produto de pronta
 *    entrega e produto sem antecedência marcada não pedem antecedência (definida no cadastro do produto).
 *  - Horário de corte: com produto de encomenda, pedido feito depois do fechamento de hoje não pega
 *    amanhã ("a produção de amanhã já fechou") — a primeira data vira o próximo dia de atendimento.
 *  - Pronta entrega com a loja aberta e antes do fechamento: já vem marcado hoje, no próximo horário.
 */
export type HorarioLoja = {
  dias?: string[]; abertura?: string; fechamento?: string;
  abre_sabado?: boolean; sabado_abertura?: string; sabado_fechamento?: string;
  abre_domingo?: boolean; domingo_abertura?: string; domingo_fechamento?: string;
} | null | undefined;

export type InfoEntregaProduto = { ant?: string | null; pronta?: boolean | null };

const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const HORAS_ANT: Record<string, number> = { "24h": 24, "48h": 48, "3d": 72, "5d": 120, "7d": 168, "15d": 360 };
const PADRAO = { dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"], abertura: "08:00", fechamento: "18:00", abre_sabado: true, sabado_abertura: "08:00", sabado_fechamento: "14:00", abre_domingo: false };

const minutos = (hhmm?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const somarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const deIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function lerHorario(h: any): NonNullable<HorarioLoja> {
  let x = h;
  if (typeof x === "string") { try { x = JSON.parse(x); } catch { x = null; } }
  if (!x || typeof x !== "object") return PADRAO;
  return { ...PADRAO, ...x };
}

/** Abre e fecha (em minutos do dia) naquele dia, ou null se a loja não abre. */
export function expediente(d: Date, horarioBruto: any): { abre: number; fecha: number } | null {
  const h = lerHorario(horarioBruto);
  const dia = d.getDay();
  let a: string | undefined, f: string | undefined;
  if (dia === 6) { if (!h.abre_sabado) return null; a = h.sabado_abertura || h.abertura; f = h.sabado_fechamento || h.fechamento; }
  else if (dia === 0) { if (!h.abre_domingo) return null; a = h.domingo_abertura || h.abertura; f = h.domingo_fechamento || h.fechamento; }
  else { if (!(h.dias || []).includes(DIAS_SEMANA[dia])) return null; a = h.abertura; f = h.fechamento; }
  const abre = minutos(a), fecha = minutos(f);
  if (isNaN(abre) || isNaN(fecha) || fecha <= abre) return null;
  return { abre, fecha };
}

/** Antecedência do pedido, em horas: a maior entre os produtos. */
export function antecedenciaHoras(itensIds: string[], info: Record<string, InfoEntregaProduto> | undefined, prazoMinimoLoja: number, aceitaAgendamento: boolean): number {
  let maior = 0;
  for (const id of itensIds) {
    const p = info?.[id];
    let h = 0;
    if (p?.ant && HORAS_ANT[p.ant]) h = HORAS_ANT[p.ant];
    else if (p?.pronta === true) h = 0;
    else h = 0; // 02/10: o agendamento é definido no produto (o prazo geral da loja saiu de Entrega e pagamento)
    maior = Math.max(maior, h);
  }
  return maior;
}

export type RegrasAgenda = {
  horas: number;          // antecedência do pedido
  minimo: Date;           // a partir de quando pode (data e hora)
  cortado: boolean;       // passou do horário de corte (só com produto de encomenda)
  fechamentoHoje: string; // "18:00" (pra mostrar no aviso)
  sugestao: { data: string; hora: string } | null; // pronta entrega: já vem marcado
};

export function calcularRegras(agora: Date, horario: any, horas: number): RegrasAgenda {
  let minimo = new Date(agora.getTime() + horas * 3600_000);
  const hoje = expediente(agora, horario);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  let cortado = false;
  if (horas > 0 && hoje && agoraMin >= hoje.fecha) {
    // Produção de amanhã já fechou: amanhã não vale
    const depoisDeAmanha = somarDias(inicioDoDia(agora), 2);
    if (minimo < depoisDeAmanha) { minimo = depoisDeAmanha; cortado = true; }
  }
  let sugestao: RegrasAgenda["sugestao"] = null;
  if (horas === 0 && hoje && agoraMin < hoje.fecha) {
    const h = horariosDoDia(agora, horario, minimo);
    if (h.length) sugestao = { data: isoDia(agora), hora: h[0] };
  }
  return { horas, minimo, cortado, fechamentoHoje: hoje ? hhmm(hoje.fecha) : "", sugestao };
}

/** Horários do dia, de hora em hora, a partir do mínimo (o último é 1h antes de fechar). */
export function horariosDoDia(d: Date, horario: any, minimo: Date): string[] {
  const ex = expediente(d, horario);
  if (!ex) return [];
  const dia = inicioDoDia(d).getTime();
  const out: string[] = [];
  const ultimo = Math.max(ex.abre, ex.fecha - 60);
  for (let m = ex.abre; m <= ultimo; m += 60) {
    const quando = new Date(dia + m * 60_000);
    if (quando >= minimo) out.push(hhmm(m));
  }
  return out;
}

/** "Outro horário": de 15 em 15 minutos, da abertura até o fechamento, a partir do mínimo. */
export function horariosLivres(d: Date, horario: any, minimo: Date): string[] {
  const ex = expediente(d, horario);
  if (!ex) return [];
  const dia = inicioDoDia(d).getTime();
  const out: string[] = [];
  for (let m = ex.abre; m <= ex.fecha; m += 15) {
    if (new Date(dia + m * 60_000) >= minimo) out.push(hhmm(m));
  }
  return out;
}

export const diaDisponivel = (d: Date, horario: any, minimo: Date) => horariosDoDia(d, horario, minimo).length > 0;

export function primeiraData(horario: any, minimo: Date, limiteDias = 90): Date | null {
  for (let i = 0; i <= limiteDias; i++) {
    const d = somarDias(inicioDoDia(minimo), i);
    if (diaDisponivel(d, horario, minimo)) return d;
  }
  return null;
}

export function rotuloData(iso: string): string {
  if (!iso) return "";
  const d = deIso(iso);
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function rotuloCurto(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return s;
}
