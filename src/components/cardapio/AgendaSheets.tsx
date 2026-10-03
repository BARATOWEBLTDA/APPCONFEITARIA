import { useEffect, useMemo, useState, type ReactNode } from "react";
import { diaDisponivel, horariosDoDia, horariosLivres, inicioDoDia, isoDia, deIso, somarDias } from "@/lib/agendaCardapio";

/** Janelinha que sobe de baixo (no computador, fica centralizada). */
function Folha({ titulo, sub, onClose, children }: { titulo: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="ags-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="ags" onClick={e => e.stopPropagation()}>
        <span className="ags-alca" aria-hidden="true" />
        <div className="ags-hd"><b>{titulo}</b>{sub && <small>{sub}</small>}</div>
        {children}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Calendário do mês: dias sem horário possível ficam apagados e riscados. */
export function CalendarioSheet({ titulo, horario, minimo, valor, onEscolher, onClose }: {
  titulo: string; horario: any; minimo: Date; valor: string; onEscolher: (iso: string) => void; onClose: () => void;
}) {
  const hoje = inicioDoDia(new Date());
  const base = valor ? deIso(valor) : (inicioDoDia(minimo) > hoje ? inicioDoDia(minimo) : hoje);
  const [mes, setMes] = useState(new Date(base.getFullYear(), base.getMonth(), 1));
  const [sel, setSel] = useState(valor);
  const limite = somarDias(hoje, 120);
  const celulas = useMemo(() => {
    const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(primeiro.getDay()).fill(null);
    for (let d = 1; d <= total; d++) out.push(new Date(mes.getFullYear(), mes.getMonth(), d));
    return out;
  }, [mes]);
  const nomeMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const podeVoltar = mes > new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const podeAvancar = new Date(mes.getFullYear(), mes.getMonth() + 1, 1) <= limite;
  const rotSel = sel ? deIso(sel).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }) : "";
  return (
    <Folha titulo={titulo} sub="Os dias apagados não estão disponíveis" onClose={onClose}>
      <div className="ags-mes">
        <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} disabled={!podeVoltar} aria-label="Mês anterior">‹</button>
        <b>{nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}</b>
        <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} disabled={!podeAvancar} aria-label="Próximo mês">›</button>
      </div>
      <div className="ags-cal">
        {SEMANA.map((s, i) => <span key={i} className="ags-wd">{s}</span>)}
        {celulas.map((d, i) => {
          if (!d) return <span key={i} />;
          const iso = isoDia(d);
          const ok = d <= limite && diaDisponivel(d, horario, minimo);
          return (
            <button type="button" key={i} disabled={!ok} onClick={() => setSel(iso)}
              className={`ags-d${sel === iso ? " sel" : ""}${isoDia(hoje) === iso ? " hoje" : ""}`} aria-label={d.toLocaleDateString("pt-BR")}>{d.getDate()}</button>
          );
        })}
      </div>
      <div className="ags-leg"><span><i className="l1" />Disponível</span><span><i className="l2" />Fechado ou sem antecedência</span></div>
      <button type="button" className="ags-ok" disabled={!sel} onClick={() => { onEscolher(sel); onClose(); }}>
        {sel ? `Confirmar ${rotSel}` : "Escolha um dia"}
      </button>
    </Folha>
  );
}

/** Horários do dia escolhido, de hora em hora, e "Outro horário" (de 15 em 15 min, dentro do expediente). */
export function HorariosSheet({ data, horario, minimo, valor, onEscolher, onClose }: {
  data: string; horario: any; minimo: Date; valor: string; onEscolher: (h: string) => void; onClose: () => void;
}) {
  const lista = horariosDoDia(deIso(data), horario, minimo);
  const livres = horariosLivres(deIso(data), horario, minimo); // de 15 em 15
  const valorFora = !!valor && !lista.includes(valor);
  const [outro, setOutro] = useState(valorFora);
  const horas = [...new Set(livres.map(h => h.slice(0, 2)))];
  const [hSel, setHSel] = useState(valorFora ? valor.slice(0, 2) : (horas[0] || ""));
  const minutosDaHora = livres.filter(h => h.startsWith(hSel + ":")).map(h => h.slice(3));
  const [mSel, setMSel] = useState(valorFora ? valor.slice(3, 5) : "");
  const mOk = minutosDaHora.includes(mSel) ? mSel : (minutosDaHora[0] || "");
  const rot = deIso(data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return (
    <Folha titulo="Horário" sub={rot.charAt(0).toUpperCase() + rot.slice(1)} onClose={onClose}>
      <div className="ags-hrs">
        {lista.map(h => (
          <button type="button" key={h} className={valor === h && !outro ? "sel" : ""} onClick={() => { onEscolher(h); onClose(); }}>{h}</button>
        ))}
        {livres.length > 0 && (
          <button type="button" className={`ags-outro${outro ? " sel" : ""}`} onClick={() => setOutro(o => !o)}>Outro horário</button>
        )}
        {!lista.length && !livres.length && <p className="ags-vazio">Nenhum horário nesse dia. Escolha outra data.</p>}
      </div>
      {outro && livres.length > 0 && (
        <div className="ags-outro-box">
          <p>Escolha um horário entre <b>{livres[0]}</b> e <b>{livres[livres.length - 1]}</b>:</p>
          <div className="ags-outro-row">
            <select value={hSel} onChange={e => setHSel(e.target.value)} aria-label="Hora">
              {horas.map(h => <option key={h} value={h}>{h}h</option>)}
            </select>
            <span>:</span>
            <select value={mOk} onChange={e => setMSel(e.target.value)} aria-label="Minutos">
              {minutosDaHora.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button type="button" className="ags-ok" onClick={() => { onEscolher(`${hSel}:${mOk}`); onClose(); }}>Confirmar {hSel}:{mOk}</button>
        </div>
      )}
    </Folha>
  );
}

const CSS = `
  .ags-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base, inherit); }
  @media (min-width: 768px) { .ags-ov { align-items: center; } }
  .ags { width: 100%; max-width: 440px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px)); color: #2C1219; animation: agsSobe .25s ease; max-height: 92vh; overflow-y: auto; }
  @media (min-width: 768px) { .ags { border-radius: 22px; } }
  @keyframes agsSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .ags-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .ags-hd b { display: block; font-size: 18px; font-weight: 900; } .ags-hd small { font-size: 13px; color: #6B5D64; }
  .ags-mes { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 8px; }
  .ags-mes b { font-size: 15px; font-weight: 800; }
  .ags-mes button { width: 36px; height: 36px; border-radius: 11px; border: none; background: #F5F0F2; font-size: 20px; color: #2C1219; cursor: pointer; font-family: inherit; }
  .ags-mes button:disabled { opacity: .35; cursor: default; }
  .ags-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
  .ags-wd { height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #9A8E94; }
  .ags-d { height: 40px; border: none; border-radius: 11px; background: none; font-family: inherit; font-size: 14.5px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .ags-d:disabled { color: #D6CBD0; text-decoration: line-through; font-weight: 500; cursor: default; }
  .ags-d.hoje { box-shadow: inset 0 0 0 1.5px #EDE6E9; }
  .ags-d.sel { background: #E85A8C; color: #fff; box-shadow: 0 4px 10px rgba(232,90,140,.35); }
  .ags-leg { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; color: #6B5D64; margin: 10px 0 12px; }
  .ags-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .ags-leg .l1 { background: #2C1219; } .ags-leg .l2 { background: #E5DDE1; }
  .ags-ok { display: block; width: 100%; border: none; border-radius: 12px; padding: 14px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
  .ags-ok:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
  .ags-hrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; }
  .ags-hrs button { height: 48px; border: 1.5px solid #EDE6E9; border-radius: 12px; background: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; color: #2C1219; cursor: pointer; }
  .ags-hrs button.sel { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .ags-hrs .ags-outro { grid-column: 1 / -1; border-style: dashed; color: #C33A6E; font-size: 14.5px; }
  .ags-outro-box { margin-top: 12px; padding: 14px; border-radius: 14px; background: #FAF7F8; }
  .ags-outro-box p { margin: 0 0 10px; font-size: 13px; color: #6B5D64; }
  .ags-outro-row { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px; font-size: 20px; font-weight: 900; }
  .ags-outro-row select { height: 48px; min-width: 96px; border: 1.5px solid #EDE6E9; border-radius: 12px; background: #fff; font-family: inherit; font-size: 18px; font-weight: 800; color: #2C1219; text-align: center; padding: 0 10px; }
  .ags-vazio { grid-column: 1 / -1; font-size: 13.5px; color: #6B5D64; text-align: center; padding: 10px 0; }
`;
