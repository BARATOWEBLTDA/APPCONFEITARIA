import { useEffect, useMemo, useState } from "react";

/**
 * Calendário do aniversário (02/10) — o mesmo visual do agendamento do cardápio,
 * com mês e ano no topo (pra não precisar voltar mês a mês até o ano em que a pessoa nasceu).
 * Datas no futuro ficam apagadas. Valor no formato AAAA-MM-DD.
 */
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

export function rotuloNascimento(v: string): string {
  if (!v) return "";
  const d = deIso(v);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function DataNascimentoSheet({ valor, onEscolher, onClose }: { valor: string; onEscolher: (v: string) => void; onClose: () => void }) {
  const hoje = new Date();
  const base = valor ? deIso(valor) : new Date(hoje.getFullYear() - 30, hoje.getMonth(), 1);
  const [ano, setAno] = useState(base.getFullYear());
  const [mes, setMes] = useState(base.getMonth());
  const [sel, setSel] = useState(valor);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  const anos = useMemo(() => { const a: number[] = []; for (let y = hoje.getFullYear(); y >= hoje.getFullYear() - 100; y--) a.push(y); return a; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const celulas = useMemo(() => {
    const primeiro = new Date(ano, mes, 1);
    const total = new Date(ano, mes + 1, 0).getDate();
    const out: (Date | null)[] = Array(primeiro.getDay()).fill(null);
    for (let d = 1; d <= total; d++) out.push(new Date(ano, mes, d));
    return out;
  }, [ano, mes]);
  const voltar = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };
  const avancar = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };
  const podeAvancar = new Date(ano, mes + 1, 1) <= hoje;
  return (
    <div className="dns-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Data de aniversário">
      <div className="dns" onClick={e => e.stopPropagation()}>
        <span className="dns-alca" aria-hidden="true" />
        <div className="dns-hd"><b>Aniversário</b><small>Escolha o mês e o ano, depois o dia</small></div>
        <div className="dns-mes">
          <button type="button" onClick={voltar} aria-label="Mês anterior">‹</button>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} aria-label="Mês">
            {MESES.map((m, i) => <option key={m} value={i} disabled={ano === hoje.getFullYear() && i > hoje.getMonth()}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => { const y = Number(e.target.value); setAno(y); if (y === hoje.getFullYear() && mes > hoje.getMonth()) setMes(hoje.getMonth()); }} aria-label="Ano">
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" onClick={avancar} disabled={!podeAvancar} aria-label="Próximo mês">›</button>
        </div>
        <div className="dns-cal">
          {SEMANA.map((s, i) => <span key={i} className="dns-wd">{s}</span>)}
          {celulas.map((d, i) => {
            if (!d) return <span key={i} />;
            const v = iso(d);
            return <button type="button" key={i} disabled={d > hoje} onClick={() => setSel(v)} className={`dns-d${sel === v ? " sel" : ""}`}>{d.getDate()}</button>;
          })}
        </div>
        <div className="dns-bts">
          {valor && <button type="button" className="dns-limpar" onClick={() => { onEscolher(""); onClose(); }}>Tirar a data</button>}
          <button type="button" className="dns-ok" disabled={!sel} onClick={() => { onEscolher(sel); onClose(); }}>
            {sel ? `Confirmar ${deIso(sel).toLocaleDateString("pt-BR")}` : "Escolha o dia"}
          </button>
        </div>
      </div>
      <style>{`
        .dns-ov { position: fixed; inset: 0; z-index: 1400; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base, inherit); }
        @media (min-width: 768px) { .dns-ov { align-items: center; } }
        .dns { width: 100%; max-width: 440px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px)); color: #2C1219; animation: dnsSobe .25s ease; }
        @media (min-width: 768px) { .dns { border-radius: 22px; } }
        @keyframes dnsSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .dns-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
        .dns-hd b { display: block; font-size: 18px; font-weight: 900; } .dns-hd small { font-size: 13px; color: #6B5D64; }
        .dns-mes { display: flex; align-items: center; gap: 8px; margin: 14px 0 8px; }
        .dns-mes button { width: 38px; height: 40px; flex-shrink: 0; border: none; border-radius: 11px; background: #F5F0F2; font-size: 20px; color: #2C1219; cursor: pointer; font-family: inherit; }
        .dns-mes button:disabled { opacity: .35; cursor: default; }
        .dns-mes select { flex: 1; min-width: 0; height: 40px; border: 1.5px solid #EDE6E9; border-radius: 11px; background: #fff; font-family: inherit; font-size: 15px; font-weight: 800; color: #2C1219; padding: 0 8px; }
        .dns-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
        .dns-wd { height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #9A8E94; }
        .dns-d { height: 40px; border: none; border-radius: 11px; background: none; font-family: inherit; font-size: 14.5px; font-weight: 700; color: #2C1219; cursor: pointer; }
        .dns-d:disabled { color: #D6CBD0; cursor: default; }
        .dns-d.sel { background: #E85A8C; color: #fff; box-shadow: 0 4px 10px rgba(232,90,140,.35); }
        .dns-bts { display: flex; gap: 8px; margin-top: 14px; }
        .dns-limpar { border: 1.5px solid #EAE3E6; background: #fff; border-radius: 12px; padding: 0 14px; font-family: inherit; font-weight: 800; font-size: 14px; color: #6B5D64; cursor: pointer; }
        .dns-ok { flex: 1; border: none; border-radius: 12px; padding: 14px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
        .dns-ok:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
      `}</style>
    </div>
  );
}
