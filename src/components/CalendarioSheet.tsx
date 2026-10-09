import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTravarRolagem } from '@/hooks/useTravarRolagem'

/**
 * Calendário do app (03/10) — a mesma janela em todo lugar que precisa escolher uma data.
 * (O horário usa o HorarioSheet, também compartilhado.)
 *   valor / min / max: 'AAAA-MM-DD'. Dias fora do limite ficam apagados.
 *   cor: cor de destaque (no cardápio, a cor da loja).
 */
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const isoDeData = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const hojeIso = () => isoDeData(new Date())
/** "Sábado, 17/10/2026" (longo) ou "Sáb, 17/10" (curto) */
export function dataPorExtenso(iso: string, curto = false): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dia = DIAS[new Date(y, m - 1, d).getDay()]
  return curto ? `${dia.slice(0, 3)}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}` : `${dia}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export default function CalendarioSheet({ valor, titulo = 'Escolha a data', min, max, cor = '#E85A8C', onClose, onConfirmar }: {
  valor?: string | null; titulo?: string; min?: string; max?: string; cor?: string; onClose: () => void; onConfirmar: (iso: string) => void
}) {
  useTravarRolagem(true)
  const inicial = valor || (min && min > hojeIso() ? min : max && max < hojeIso() ? max : hojeIso())
  const [mes, setMes] = useState({ a: Number(inicial.slice(0, 4)), m: Number(inicial.slice(5, 7)) - 1 })
  const [dia, setDia] = useState<string>(valor || '')
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onClose])
  const vazios = new Date(mes.a, mes.m, 1).getDay(), totalDias = new Date(mes.a, mes.m + 1, 0).getDate()
  const iso = (d: number) => `${mes.a}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const fora = (s: string) => (!!min && s < min) || (!!max && s > max)
  const mudar = (n: number) => setMes(x => { const d = new Date(x.a, x.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() } })
  const primeiroDoMes = iso(1), ultimoDoMes = iso(totalDias)
  const podeVoltar = !min || primeiroDoMes > min, podeAvancar = !max || ultimoDoMes < max
  const hoje = hojeIso()
  return createPortal(
    <div className="cal2-ov" onClick={onClose} style={{ ['--cal2' as any]: cor }}>
      <div className="cal2" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <span className="cal2-alca" />
        <b className="cal2-t">{titulo}</b>
        <div className="cal2-h">
          <button onClick={() => mudar(-1)} disabled={!podeVoltar} aria-label="Mês anterior">‹</button>
          <b>{MESES[mes.m]} {mes.a}</b>
          <button onClick={() => mudar(1)} disabled={!podeAvancar} aria-label="Próximo mês">›</button>
        </div>
        <div className="cal2-g">
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x, i) => <i key={i}>{x}</i>)}
          {Array.from({ length: vazios }, (_, i) => <span key={'v' + i} />)}
          {Array.from({ length: totalDias }, (_, i) => { const d = i + 1, s = iso(d); return (
            <button key={d} className={`${s === dia ? 'sel' : ''} ${s === hoje ? 'hj' : ''}`} disabled={fora(s)} onClick={() => setDia(s)} aria-label={s}>{d}</button>) })}
        </div>
        <button className="cal2-ok" disabled={!dia} onClick={() => dia && onConfirmar(dia)}>{dia ? `Confirmar · ${dataPorExtenso(dia, true)}` : 'Escolha um dia'}</button>
      </div>
      <style>{`
        .cal2-ov { position: fixed; inset: 0; z-index: 10060; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
        @media (min-width: 768px) { .cal2-ov { align-items: center; } }
        .cal2 { width: 100%; max-width: 440px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px)); color: #2C1219; animation: cal2Sobe .2s ease; }
        @media (min-width: 768px) { .cal2 { border-radius: 22px; } }
        @keyframes cal2Sobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .cal2-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
        .cal2-t { display: block; font-size: 18px; font-weight: 800; }
        .cal2-h { display: flex; justify-content: space-between; align-items: center; margin: 12px 2px 8px; } .cal2-h b { font-size: 15px; }
        .cal2-h button { width: 34px; height: 34px; border-radius: 10px; border: none; background: #FFF1F6; color: var(--cal2); font-size: 19px; font-weight: 800; cursor: pointer; }
        .cal2-h button:disabled { opacity: .3; cursor: default; }
        .cal2-g { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; text-align: center; }
        .cal2-g i { font-style: normal; font-size: 12px; font-weight: 700; color: #9A8E94; padding: 4px 0; }
        .cal2-g button { border: none; background: none; border-radius: 10px; padding: 9px 0; font-family: inherit; font-size: 15px; color: #2C1219; cursor: pointer; }
        .cal2-g button.hj { box-shadow: inset 0 0 0 1.5px var(--cal2); }
        .cal2-g button.sel { background: var(--cal2); color: #fff; font-weight: 700; }
        .cal2-g button:disabled { color: #D6CBD0; cursor: default; box-shadow: none; }
        .cal2-ok { width: 100%; margin-top: 14px; border: none; border-radius: 14px; padding: 15px; background: var(--cal2); color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.15); }
        .cal2-ok:disabled { opacity: .5; cursor: default; }
      `}</style>
    </div>, document.body)
}
