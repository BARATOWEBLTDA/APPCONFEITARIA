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
// (11/10) o mesmo padrão da tela Dados da loja: sábado e domingo fechados até a loja marcar.
// Antes o sábado vinha aberto aqui: loja sem horário salvo (ou salvo sem esses campos) aceitava agendamento no sábado.
const PADRAO = {
  dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"], abertura: "08:00", fechamento: "18:00",
  abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
  abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00",
};

const minutos = (hhmm?: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
// (24:00 aparece como "00:00")
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
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
  // 10/10: fechar às "00:00" é fechar no fim do dia (24:00). Antes a loja ficava sempre fechada.
  const abre = minutos(a), fecha = minutos(f) === 0 ? 1440 : minutos(f);
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
    // (11/10) na última hora antes de fechar a lista de hora em hora vem vazia: sugere o primeiro horário livre
    const h = horariosDoDia(agora, horario, minimo);
    const primeiro = h.length ? h[0] : horariosLivres(agora, horario, minimo)[0];
    if (primeiro) sugestao = { data: isoDia(agora), hora: primeiro };
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
  for (let m = ex.abre; m <= ex.fecha && m < 1440; m += 15) {
    if (new Date(dia + m * 60_000) >= minimo) out.push(hhmm(m));
  }
  return out;
}

/**
 * O dia tem algum horário possível? (11/10) Vale a lista de hora em hora OU a de 15 em 15.
 * Antes só olhava a de hora em hora (que para 1h antes de fechar): às 17:01, com a loja aberta até 18:00,
 * "hoje" ficava riscado no calendário mesmo tendo 17:15, 17:30, 17:45 e 18:00 livres.
 */
export const diaDisponivel = (d: Date, horario: any, minimo: Date) =>
  horariosDoDia(d, horario, minimo).length > 0 || horariosLivres(d, horario, minimo).length > 0;

/** Os horários que a tela mostra como botões: de hora em hora; se não sobrou nenhum, os de 15 em 15. */
export function horariosParaMostrar(d: Date, horario: any, minimo: Date): string[] {
  const deHora = horariosDoDia(d, horario, minimo);
  return deHora.length ? deHora : horariosLivres(d, horario, minimo);
}

/** A data (aaaa-mm-dd) e a hora (hh:mm) escolhidas ainda valem? Dentro do expediente e a partir do mínimo. */
export function horarioPermitido(dataIso: string, hora: string, horario: any, minimo: Date): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso || "") || !/^\d{2}:\d{2}$/.test(hora || "")) return false;
  const d = deIso(dataIso);
  return horariosLivres(d, horario, minimo).includes(hora) || horariosDoDia(d, horario, minimo).includes(hora);
}

/**
 * Situação da loja agora (11/10): UMA conta pro topo do cardápio (celular e computador) e pra Visão geral.
 * Usa o mesmo expediente do agendamento, então o horário é sempre o DO DIA (sábado e domingo têm o deles).
 * Devolve null quando a loja não salvou horário (aí o selo não aparece).
 *  - aberto: `fecha` em minutos do dia (1440 = meia-noite)
 *  - fechado: `abre` diz quando abre de novo (dias = 0 hoje, 1 amanhã…); null = não abre em nenhum dia
 */
export type SituacaoLoja = {
  aberto: boolean;
  fecha: number; // só quando está aberto (senão 0)
  abre: { dias: number; diaSemana: number; minutos: number } | null; // só quando está fechado
};

export function situacaoDaLoja(horarioBruto: any, agora: Date = new Date()): SituacaoLoja | null {
  if (!horarioBruto) return null;
  let h = horarioBruto;
  if (typeof h === "string") { try { h = JSON.parse(h); } catch { return null; } }
  if (!h || typeof h !== "object") return null;
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const hoje = expediente(agora, h);
  if (hoje && agoraMin >= hoje.abre && agoraMin < hoje.fecha) return { aberto: true, fecha: hoje.fecha, abre: null };
  if (hoje && agoraMin < hoje.abre) return { aberto: false, fecha: 0, abre: { dias: 0, diaSemana: agora.getDay(), minutos: hoje.abre } };
  for (let i = 1; i <= 7; i++) {
    const d = somarDias(inicioDoDia(agora), i);
    const ex = expediente(d, h);
    if (ex) return { aberto: false, fecha: 0, abre: { dias: i, diaSemana: d.getDay(), minutos: ex.abre } };
  }
  return { aberto: false, fecha: 0, abre: null };
}

/** "08:00" a partir dos minutos do dia (meia-noite aparece como "00:00"). */
export const horaTexto = (min: number) => hhmm(min);

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
