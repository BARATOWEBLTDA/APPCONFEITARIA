import { useState } from 'react'
import { createPortal } from 'react-dom'
import CampoData from '@/components/CampoData'
import { useTravarRolagem } from '@/hooks/useTravarRolagem'
import type { Pedido } from './pedidoTexto'
import { grupoDoStatus as getStatusGroup } from './pedidoTexto'

/** Situações que aparecem marcadas quando a tela abre (todas menos Cancelado) */
export const STATUS_PADRAO = ['aguardando_pagamento', 'aguardando_aceite', 'agendado', 'em_producao', 'finalizado', 'aguardando_retirada', 'em_entrega', 'entregue']

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// ══════════════ Filtro em gaveta lateral (03/10) — sai da direita, altura toda ══════════════
const SITUACOES_FILTRO = [
  { k: 'novo', label: 'Novo pedido', grupos: ['aguardando_pagamento', 'aguardando_aceite'], cor: '#854F0B' },
  { k: 'agendado', label: 'Agendado', grupos: ['agendado'], cor: '#185FA5' },
  { k: 'producao', label: 'Em produção', grupos: ['em_producao'], cor: '#993556' },
  { k: 'pronto', label: 'Pronto', grupos: ['finalizado', 'aguardando_retirada'], cor: '#0F6E56' },
  { k: 'saiu', label: 'Saiu pra entrega', grupos: ['em_entrega'], cor: '#185FA5' },
  { k: 'entregue', label: 'Entregue', grupos: ['entregue'], cor: '#5F5E5A' },
  { k: 'cancelado', label: 'Cancelado', grupos: ['cancelado'], cor: '#791F1F' },
]
const DATAS_FILTRO: [string, string][] = [['todos', 'Todas as datas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['personalizado', 'Escolher período']]
/** A mesma regra de data da lista (uma só, pra a contagem bater) */
export function bateData(p: any, periodo: string, ini: string, fim: string): boolean {
  if (periodo === 'todos') return true
  if (!p.data_entrega) return false
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const data = parseLocalDate(p.data_entrega)
  if (periodo === 'hoje') return data.getTime() === hoje.getTime()
  if (periodo === 'amanha') { const a = new Date(hoje); a.setDate(a.getDate() + 1); return data.getTime() === a.getTime() }
  if (periodo === 'semana') { const f = new Date(hoje); f.setDate(f.getDate() + 7); return data >= hoje && data <= f }
  if (periodo === 'mes') return data.getMonth() === hoje.getMonth() && data.getFullYear() === hoje.getFullYear()
  if (periodo === 'personalizado') return (!ini || data >= parseLocalDate(ini)) && (!fim || data <= parseLocalDate(fim))
  return true
}
export default function FiltroLateral({ statusSelecionados, setStatusSelecionados, periodoFiltro, setPeriodoFiltro, dataInicio, setDataInicio, dataFim, setDataFim, onClose, pedidos }: {
  statusSelecionados: string[]; setStatusSelecionados: (v: string[]) => void; periodoFiltro: string; setPeriodoFiltro: (v: string) => void
  dataInicio: string; setDataInicio: (v: string) => void; dataFim: string; setDataFim: (v: string) => void; onClose: () => void; pedidos: Pedido[]
}) {
  useTravarRolagem(true) // a lista atrás não rola enquanto a gaveta está aberta
  const [st, setSt] = useState<string[]>(statusSelecionados)
  const [per, setPer] = useState(periodoFiltro === 'custom' ? 'personalizado' : periodoFiltro)
  const [ini, setIni] = useState(dataInicio)
  const [fim, setFim] = useState(dataFim)
  const [saindo, setSaindo] = useState(false)
  const fechar = () => { setSaindo(true); setTimeout(onClose, 180) }
  const marcada = (s: typeof SITUACOES_FILTRO[number]) => s.grupos.every(g => st.includes(g))
  const alternar = (s: typeof SITUACOES_FILTRO[number]) => setSt(prev => marcada(s) ? prev.filter(g => !s.grupos.includes(g)) : [...new Set([...prev, ...s.grupos])])
  const todasMarcadas = SITUACOES_FILTRO.every(marcada)
  const contaSit = (s: typeof SITUACOES_FILTRO[number]) => pedidos.filter(p => s.grupos.includes(getStatusGroup(p.status))).length
  const resultado = pedidos.filter(p => st.includes(getStatusGroup(p.status)) && bateData(p, per, ini, fim)).length
  const aplicar = () => { setStatusSelecionados(st); setPeriodoFiltro(per); setDataInicio(per === 'personalizado' ? ini : ''); setDataFim(per === 'personalizado' ? fim : ''); fechar() }
  const limpar = () => { setSt(STATUS_PADRAO); setPer('todos'); setIni(''); setFim('') }
  return createPortal(
    <div className={`fl-ov ${saindo ? 'saindo' : ''}`} onClick={fechar}>
      <div className="fl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Filtros">
        <div className="fl-h"><b>Filtros</b><button className="fl-x" onClick={fechar} aria-label="Fechar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button></div>
        <div className="fl-b">
          <div className="fl-sec"><b>Situação</b><button className="fl-lk" onClick={() => setSt(todasMarcadas ? [] : [...new Set(SITUACOES_FILTRO.flatMap(s => s.grupos))])}>{todasMarcadas ? 'Desmarcar todas' : 'Marcar todas'}</button></div>
          <div className="fl-grp">
            {SITUACOES_FILTRO.map(s => (
              <button key={s.k} className={`fl-ln ${marcada(s) ? 'on' : ''}`} onClick={() => alternar(s)} aria-pressed={marcada(s)}>
                <i className="fl-cb">{marcada(s) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}</i>
                <em style={{ background: s.cor }} /><span>{s.label}</span><u>{contaSit(s)}</u>
              </button>
            ))}
          </div>
          <div className="fl-sec"><b>Data da entrega</b></div>
          <div className="fl-grp">
            {DATAS_FILTRO.map(([k, l]) => (
              <div key={k}>
                <button className={`fl-ln rd ${per === k ? 'on' : ''}`} onClick={() => setPer(k)} aria-pressed={per === k}><i className="fl-rb" /><span>{l}</span></button>
                {k === 'personalizado' && per === 'personalizado' && (
                  <div className="fl-per">
                    <div><small>De</small><CampoData valor={ini} onChange={setIni} max={fim || undefined} titulo="Início do período" placeholder="Escolher" curto /></div>
                    <div><small>Até</small><CampoData valor={fim} onChange={setFim} min={ini || undefined} titulo="Fim do período" placeholder="Escolher" curto /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="fl-f"><button className="fl-limpar" onClick={limpar}>Limpar</button><button className="fl-ver" onClick={aplicar}>Ver {resultado} {resultado === 1 ? 'pedido' : 'pedidos'}</button></div>
      </div>
      <style>{`
        .fl-ov { position: fixed; inset: 0; z-index: 10040; background: rgba(45,31,38,.45); animation: flFundo .2s ease; font-family: var(--font-base); }
        .fl { position: absolute; top: 0; right: 0; bottom: 0; width: min(86vw, 400px); background: #fff; display: flex; flex-direction: column; border-radius: 20px 0 0 20px; box-shadow: -12px 0 30px -12px rgba(44,18,25,.4); animation: flEntra .22s ease; }
        .fl-ov.saindo { animation: flFundoSai .18s ease forwards; } .fl-ov.saindo .fl { animation: flSai .18s ease forwards; }
        @keyframes flEntra { from { transform: translateX(100%); } to { transform: none; } } @keyframes flSai { to { transform: translateX(100%); } }
        @keyframes flFundo { from { background: rgba(45,31,38,0); } } @keyframes flFundoSai { to { background: rgba(45,31,38,0); } }
        .fl-h { display: flex; justify-content: space-between; align-items: center; padding: calc(16px + env(safe-area-inset-top, 0px)) 16px 12px; border-bottom: 1px solid #F3EEF1; }
        .fl-h b { font-size: 19px; font-weight: 800; color: #2C1219; }
        .fl-x { width: 36px; height: 36px; border-radius: 10px; border: none; background: #F5F0F2; color: #4B3A42; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .fl-b { flex: 1; overflow-y: auto; overscroll-behavior: contain; padding: 4px 16px 14px; }
        .fl-sec { display: flex; justify-content: space-between; align-items: baseline; margin: 16px 2px 7px; }
        .fl-sec b { font-size: 12px; font-weight: 700; color: #9A8E94; }
        .fl-lk { border: none; background: none; padding: 0; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #C33A6E; cursor: pointer; }
        .fl-grp { border: 1px solid #F0EBED; border-radius: 14px; overflow: hidden; }
        .fl-ln { display: flex; align-items: center; gap: 10px; width: 100%; border: none; border-top: 1px solid #F5F0F2; background: #fff; padding: 12px; font-family: inherit; font-size: 14.5px; color: #2C1219; text-align: left; cursor: pointer; }
        .fl-grp > .fl-ln:first-child, .fl-grp > div:first-child > .fl-ln { border-top: none; }
        .fl-ln span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .fl-cb { width: 22px; height: 22px; border-radius: 6px; border: 1.8px solid #D6CBD0; background: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .fl-ln.on .fl-cb { background: #E85A8C; border-color: #E85A8C; }
        .fl-ln em { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .fl-ln u { text-decoration: none; font-size: 12px; font-weight: 700; color: #9A8E94; background: #F5F0F2; border-radius: 6px; min-width: 24px; text-align: center; padding: 1px 6px; }
        .fl-rb { width: 22px; height: 22px; border-radius: 50%; border: 1.8px solid #D6CBD0; flex-shrink: 0; position: relative; }
        .fl-ln.rd.on .fl-rb { border-color: #E85A8C; } .fl-ln.rd.on .fl-rb::after { content: ""; position: absolute; inset: 4px; border-radius: 50%; background: #E85A8C; }
        .fl-ln.rd.on span { font-weight: 700; color: #C33A6E; }
        .fl-per { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; padding: 10px 12px 12px; background: #FCF8F9; border-top: 1px solid #F5F0F2; }
        .fl-per small { display: block; font-size: 12px; font-weight: 700; color: #8A7E84; margin-bottom: 4px; }
        .fl-per .cdata { padding: 0 10px; font-size: 14px; gap: 6px; } /* De/Até lado a lado, sem quebrar */
        .fl-f { display: flex; align-items: center; gap: 10px; padding: 12px 16px calc(14px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #F3EEF1; }
        .fl-limpar { border: none; background: none; padding: 10px 6px; font-family: inherit; font-size: 14.5px; font-weight: 700; color: #9A8E94; cursor: pointer; }
        .fl-ver { flex: 1; border: none; border-radius: 13px; padding: 14px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
      `}</style>
    </div>, document.body)
}
