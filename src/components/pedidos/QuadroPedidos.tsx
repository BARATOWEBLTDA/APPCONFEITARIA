import { useState } from 'react'
import type { DragEvent } from 'react'
import { Botao, Linha, Titulo } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { SITUACOES, acaoDe, atrasado, dataCurta, grupoDoStatus, nomeCliente, resumoItens, rs, saldoPedido } from './pedidoTexto'

/**
 * Quadro (08/10 · 3.11 — antes "Kanban"): uma coluna por situação, só no tablet e no computador.
 * Mesmas palavras e o mesmo botão do cartão da lista. Dá pra arrastar o pedido de uma coluna pra outra, como antes.
 */
type Props = { pedidos: Pedido[]; aoAbrir: (p: Pedido) => void; aoAvancar: (p: Pedido) => void; aoMover: (id: string, status: string) => void; mudando: string | null }

export default function QuadroPedidos({ pedidos, aoAbrir, aoAvancar, aoMover, mudando }: Props) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const porColuna: Record<string, Pedido[]> = Object.fromEntries(SITUACOES.map(s => [s.chave, [] as Pedido[]]))
  pedidos.forEach(p => { porColuna[grupoDoStatus(p.status)]?.push(p) })
  Object.values(porColuna).forEach(l => l.sort((a, b) => String(a.data_entrega || '9').localeCompare(String(b.data_entrega || '9')) || String(a.horario_entrega || '').localeCompare(String(b.horario_entrega || ''))))

  const soltar = (e: DragEvent, coluna: string) => {
    e.preventDefault()
    const p = pedidos.find(x => x.id === arrastando)
    if (p && grupoDoStatus(p.status) !== coluna) aoMover(p.id, coluna)
    setArrastando(null); setSobre(null)
  }

  return (
    <div className="pdq" role="list">
      {SITUACOES.map(col => {
        const lista = porColuna[col.chave] || []
        return (
          <section
            key={col.chave} role="listitem" aria-label={col.nome}
            className={`pdq-col${sobre === col.chave ? ' sobre' : ''}`}
            onDragOver={e => { e.preventDefault(); if (sobre !== col.chave) setSobre(col.chave) }}
            onDragLeave={() => sobre === col.chave && setSobre(null)}
            onDrop={e => soltar(e, col.chave)}
          >
            <Titulo contagem={lista.length}>{col.nome}</Titulo>
            {lista.length === 0 ? <p className="pdq-vazio">Nenhum pedido aqui.</p> : lista.map(p => {
              const acao = acaoDe(p); const atr = atrasado(p); const falta = saldoPedido(p)
              const cancelado = col.chave === 'cancelado'
              return (
                <article
                  key={p.id} className={`pdq-cartao${atr ? ' atr' : ''}${arrastando === p.id ? ' arrastando' : ''}`} tabIndex={0}
                  draggable onDragStart={e => { setArrastando(p.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setArrastando(null); setSobre(null) }}
                  onClick={() => aoAbrir(p)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoAbrir(p) } }}
                >
                  <p className="pdc-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
                  <p className="pdc-res">{resumoItens(p)}</p>
                  <div className="pdq-linhas">
                    <Linha rotulo={p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'} tom={atr ? 'vermelho' : undefined}>{dataCurta(p.data_entrega, p.horario_entrega)}</Linha>
                    {!cancelado && (falta > 0.009 ? <Linha rotulo="Pagamento" tom="laranja">Falta {rs(falta, true)}</Linha> : <Linha rotulo="Pagamento" tom="verde">Pago</Linha>)}
                  </div>
                  {acao && <Botao variante="suave" tamanho="p" cheio carregando={mudando === p.id} onClick={e => { e.stopPropagation(); aoAvancar(p) }}>{acao.rotulo}</Botao>}
                </article>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
