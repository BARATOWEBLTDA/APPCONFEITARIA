import { useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Janela } from '@/components/base'
import './dataHora.css'

/**
 * Calendário do app — a mesma janela em todo lugar que precisa escolher uma data.
 * 09/10 (3.53): no padrão do guia (Janela do app, setas Phosphor, dias de 44px, cores --ui-*).
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

export default function CalendarioSheet({ valor, titulo = 'Escolha a data', min, max, cor, onClose, onConfirmar }: {
  valor?: string | null; titulo?: string; min?: string; max?: string; cor?: string; onClose: () => void; onConfirmar: (iso: string) => void
}) {
  const inicial = valor || (min && min > hojeIso() ? min : max && max < hojeIso() ? max : hojeIso())
  const [mes, setMes] = useState({ a: Number(inicial.slice(0, 4)), m: Number(inicial.slice(5, 7)) - 1 })
  const [dia, setDia] = useState<string>(valor || '')
  const vazios = new Date(mes.a, mes.m, 1).getDay(), totalDias = new Date(mes.a, mes.m + 1, 0).getDate()
  const iso = (d: number) => `${mes.a}-${String(mes.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const fora = (s: string) => (!!min && s < min) || (!!max && s > max)
  const mudar = (n: number) => setMes(x => { const d = new Date(x.a, x.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() } })
  const podeVoltar = !min || iso(1) > min, podeAvancar = !max || iso(totalDias) < max
  const hoje = hojeIso()
  return (
    <Janela aberta aoFechar={onClose} tipo="conteudo" titulo={titulo}
      acoes={<>
        <Botao variante="secundario" onClick={onClose}>Cancelar</Botao>
        <Botao disabled={!dia} onClick={() => dia && onConfirmar(dia)} data-foco-inicial>{dia ? `Usar ${dataPorExtenso(dia, true)}` : 'Escolha um dia'}</Botao>
      </>}>
      <div className="dh-cal" style={cor ? { ['--dh-cor' as any]: cor } : undefined}>
        <div className="dh-mes">
          <BotaoIcone rotulo="Mês anterior" onClick={() => mudar(-1)} disabled={!podeVoltar}><CaretLeft size={20} weight="bold" /></BotaoIcone>
          <b aria-live="polite">{MESES[mes.m]} {mes.a}</b>
          <BotaoIcone rotulo="Próximo mês" onClick={() => mudar(1)} disabled={!podeAvancar}><CaretRight size={20} weight="bold" /></BotaoIcone>
        </div>
        <div className="dh-grade" role="grid" aria-label={`${MESES[mes.m]} de ${mes.a}`}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x, i) => <i key={i} aria-hidden="true">{x}</i>)}
          {Array.from({ length: vazios }, (_, i) => <span key={'v' + i} />)}
          {Array.from({ length: totalDias }, (_, i) => {
            const d = i + 1, s = iso(d)
            return (
              <button key={d} type="button" className={`${s === dia ? 'sel' : ''}${s === hoje ? ' hj' : ''}`} disabled={fora(s)}
                aria-pressed={s === dia} aria-label={dataPorExtenso(s)} onClick={() => setDia(s)}>{d}</button>
            )
          })}
        </div>
      </div>
    </Janela>
  )
}
