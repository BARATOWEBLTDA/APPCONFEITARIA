import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Janela } from "@/components/base";
import "./dataHora.css";

/**
 * Calendário do aniversário (02/10) — o mesmo visual do agendamento do cardápio,
 * com mês e ano no topo (pra não precisar voltar mês a mês até o ano em que a pessoa nasceu).
 * Datas no futuro ficam apagadas. Valor no formato AAAA-MM-DD.
 * 09/10 (3.53): na Janela do app, com o mesmo visual do calendário (CalendarioSheet).
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
    <Janela aberta aoFechar={onClose} tipo="conteudo" titulo="Aniversário"
      acoes={<>
        {valor ? <Botao variante="secundario" onClick={() => { onEscolher(""); onClose(); }}>Tirar a data</Botao> : <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>}
        <Botao disabled={!sel} onClick={() => { onEscolher(sel); onClose(); }} data-foco-inicial>{sel ? `Usar ${deIso(sel).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : "Escolha o dia"}</Botao>
      </>}>
      <div className="dh-cal">
        <p className="dh-apoio">Escolha o mês e o ano, depois o dia</p>
        <div className="dh-mes dh-mes--sel">
          <BotaoIcone rotulo="Mês anterior" onClick={voltar}><CaretLeft size={20} weight="bold" /></BotaoIcone>
          <select value={mes} onChange={e => setMes(Number(e.target.value))} aria-label="Mês">
            {MESES.map((m, i) => <option key={m} value={i} disabled={ano === hoje.getFullYear() && i > hoje.getMonth()}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => { const y = Number(e.target.value); setAno(y); if (y === hoje.getFullYear() && mes > hoje.getMonth()) setMes(hoje.getMonth()); }} aria-label="Ano">
            {anos.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <BotaoIcone rotulo="Próximo mês" onClick={avancar} disabled={!podeAvancar}><CaretRight size={20} weight="bold" /></BotaoIcone>
        </div>
        <div className="dh-grade">
          {SEMANA.map((s, i) => <i key={i} aria-hidden="true">{s}</i>)}
          {celulas.map((d, i) => {
            if (!d) return <span key={i} />;
            const v = iso(d);
            return <button type="button" key={i} disabled={d > hoje} aria-pressed={sel === v} onClick={() => setSel(v)} className={sel === v ? "sel" : ""}>{d.getDate()}</button>;
          })}
        </div>
      </div>
    </Janela>
  );
}
