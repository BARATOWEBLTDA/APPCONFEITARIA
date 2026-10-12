import { useEffect, useState } from "react";

/**
 * Entregas de HOJE no "Seu dia" do Início (11/10).
 * Antes o destaque era sempre a entrega mais cedo do dia, mesmo com a hora já passada ("15:30 · agora" às 20h40).
 * Agora: destaque = a primeira com hora de agora em diante; as de hora já passada que continuam na lista
 * (não foram entregues) viram o aviso "N passaram do horário".
 */

/** "15:30" ou "15:30:00" → minutos desde a meia-noite (930). */
export const minutosDoDia = (hora: string): number => {
  const [h, m] = String(hora).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Separa as entregas (já na ordem: dia, depois hora) em:
 *   destaque  → de hoje, a primeira com hora >= agora; sem nenhuma, a primeira de hoje sem horário
 *   passaram  → de hoje, com hora antes de agora (ainda não entregues)
 *   restantes → o resto, na mesma ordem (as outras de hoje e as dos próximos dias)
 */
export function separarEntregasDeHoje<T extends { data: string; hora?: string | null }>(entregas: T[], hoje: string, agora: Date): { destaque: T | null; passaram: T[]; restantes: T[] } {
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const deHoje = entregas.filter(e => e.data === hoje);
  const passaram = deHoje.filter(e => e.hora && minutosDoDia(e.hora) < agoraMin);
  const aVir = deHoje.filter(e => e.hora && minutosDoDia(e.hora) >= agoraMin).sort((a, b) => minutosDoDia(a.hora!) - minutosDoDia(b.hora!));
  const destaque = aVir[0] || deHoje.find(e => !e.hora) || null;
  const restantes = entregas.filter(e => e !== destaque && !passaram.includes(e));
  return { destaque, passaram, restantes };
}

/** Quanto falta pra hora de hoje: "em 2h", "em 1h30", "em 40 min", "agora" (é este minuto). Hora já passada devolve "" (nunca "agora"). */
export function faltaPara(hora: string, agora: Date): string {
  const min = minutosDoDia(hora) - (agora.getHours() * 60 + agora.getMinutes());
  if (min < 0) return "";
  if (min === 0) return "agora";
  if (min < 60) return `em ${min} min`;
  const horas = Math.floor(min / 60), resto = min % 60;
  return resto >= 30 && horas < 3 ? `em ${horas}h${String(resto).padStart(2, "0")}` : `em ${horas}h`;
}

/** A hora de agora, que se atualiza sozinha (a cada meio minuto e quando a pessoa volta pro app). */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const bater = () => { if (document.visibilityState === "visible") setAgora(new Date()); };
    const relogio = window.setInterval(bater, 30_000);
    document.addEventListener("visibilitychange", bater);
    window.addEventListener("focus", bater);
    return () => { window.clearInterval(relogio); document.removeEventListener("visibilitychange", bater); window.removeEventListener("focus", bater); };
  }, []);
  return agora;
}
