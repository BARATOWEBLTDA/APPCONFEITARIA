import { useLayoutEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { ReactNode } from 'react'
import { Storefront, Truck, Wallet } from '@phosphor-icons/react'
import { Botao, Titulo } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { SITUACOES, pixDoPedido, acaoDe, precisaAceitar, atrasado, dataCurta, grupoDoStatus, nomeCliente, resumoItens, rs, saldoPedido, passoDeDepois } from './pedidoTexto'

/**
 * Quadro (08/10 · 3.11 — antes "Kanban"): uma coluna por situação, só no tablet e no computador.
 * Mesmas palavras e o mesmo botão do cartão da lista. Dá pra arrastar o pedido de uma coluna pra outra, como antes.
 */
const FIXAS = ['aguardando_aceite', 'agendado', 'em_producao', 'finalizado', 'entregue']
const LIMITE_ENTREGUES = 10

// (6.01) no quadro o cartão é estreito: ícone no lugar de "Retirada:"/"Pagamento:", pra data e valor caberem inteiros
function LinhaIcone({ icone, rotulo, tom, children }: { icone: ReactNode; rotulo: string; tom?: string; children: ReactNode }) {
  return <p className={`ui-linha pdq-l${tom ? ` ui-linha--${tom}` : ''}`}><span className="pdq-ic" title={rotulo}>{icone}<span className="ui-so-leitor">{rotulo}:</span></span><b>{children}</b></p>
}

type Props = { pedidos: Pedido[]; aoAbrir: (p: Pedido) => void; aoAvancar: (p: Pedido) => void; aoMover: (id: string, status: string) => void; mudando: string | null }

export default function QuadroPedidos({ pedidos, aoAbrir, aoAvancar, aoMover, mudando }: Props) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  // (28/10) as colunas vão até o fim da tela: mede onde o quadro começa e usa o resto da altura
  const ref = useRef<HTMLDivElement>(null)
  const [altura, setAltura] = useState<number | null>(null)
  useLayoutEffect(() => {
    const medir = () => { const el = ref.current; if (el) setAltura(Math.max(320, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 24))) }
    medir(); window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  const porColuna: Record<string, Pedido[]> = Object.fromEntries(SITUACOES.map(s => [s.chave, [] as Pedido[]]))
  pedidos.forEach(p => { porColuna[grupoDoStatus(p.status)]?.push(p) })
  Object.values(porColuna).forEach(l => l.sort((a, b) => String(a.data_entrega || '9').localeCompare(String(b.data_entrega || '9')) || String(a.horario_entrega || '').localeCompare(String(b.horario_entrega || ''))))

  // (4.29) "Pronto" e "Pronto pra retirar" viram uma coluna só; entregues do mais novo pro mais antigo, até 10
  porColuna.finalizado = [...(porColuna.finalizado || []), ...(porColuna.aguardando_retirada || [])]
  porColuna.aguardando_retirada = []
  // "Aguardando pagamento" e "Novo pedido" viram "Novos"
  porColuna.aguardando_aceite = [...(porColuna.aguardando_pagamento || []), ...(porColuna.aguardando_aceite || [])]
  porColuna.aguardando_pagamento = []
  const entregues = [...(porColuna.entregue || [])].reverse()
  porColuna.entregue = entregues.slice(0, LIMITE_ENTREGUES)
  const entreguesFora = Math.max(0, entregues.length - LIMITE_ENTREGUES)
  // as colunas fixas aparecem sempre; as outras, só quando têm pedido (antes eram 9 colunas e um scroll enorme pro lado)
  // cancelados ficam só na Lista
  const colunas = SITUACOES.filter(s => !['aguardando_retirada', 'aguardando_pagamento', 'cancelado'].includes(s.chave) && (FIXAS.includes(s.chave) || (porColuna[s.chave] || []).length > 0))

  const soltar = (e: DragEvent, coluna: string) => {
    e.preventDefault()
    const p = pedidos.find(x => x.id === arrastando)
    // pedido de retirada solto em "Pronto" fica "Pronto pra retirar" (o mesmo caminho do botão)
    const destino = coluna === 'finalizado' && p && p.tipo_entrega !== 'entrega' ? 'aguardando_retirada' : coluna
    if (p && grupoDoStatus(p.status) !== destino) aoMover(p.id, destino)
    setArrastando(null); setSobre(null)
  }

  return (
    <div ref={ref} className="pdq" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(208px, 1fr))`, height: altura ?? undefined }}>
      {colunas.map(col => {
        const lista = porColuna[col.chave] || []
        return (
          <section
            key={col.chave} aria-label={col.nome}
            className={`pdq-col${sobre === col.chave ? ' sobre' : ''}`}
            onDragOver={e => { e.preventDefault(); if (sobre !== col.chave) setSobre(col.chave) }}
            onDragLeave={() => sobre === col.chave && setSobre(null)}
            onDrop={e => soltar(e, col.chave)}
          >
            <Titulo contagem={col.chave === 'entregue' ? lista.length + entreguesFora : lista.length}>{col.chave === 'finalizado' ? 'Pronto' : col.chave === 'aguardando_aceite' ? 'Novos' : col.nome}</Titulo>
            <div className="pdq-lista">
            {lista.length === 0 ? <p className="pdq-solta">Arraste um pedido para cá</p> : lista.map(p => {
              const acao = acaoDe(p); const atr = atrasado(p); const falta = saldoPedido(p)
              const cancelado = col.chave === 'cancelado'
              return (
                <article
                  key={p.id} className={`pdq-cartao${atr ? ' atr' : ''}${precisaAceitar(p) ? ' aceitar' : ''}${arrastando === p.id ? ' arrastando' : ''}`} tabIndex={0}
                  draggable onDragStart={e => { setArrastando(p.id); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { setArrastando(null); setSobre(null) }}
                  onClick={() => aoAbrir(p)} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoAbrir(p) } }}
                >
                  <p className="pdc-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
                  <p className="pdc-res">{resumoItens(p)}</p>
                  <div className="pdq-linhas">
                    <LinhaIcone icone={p.tipo_entrega === 'entrega' ? <Truck size={16} aria-hidden="true" /> : <Storefront size={16} aria-hidden="true" />} rotulo={p.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'} tom={atr ? 'vermelho' : undefined}>{dataCurta(p.data_entrega, p.horario_entrega)}</LinhaIcone>
                    {!cancelado && (() => { const px = pixDoPedido(p); const pg = (tom: string, txt: ReactNode) => <LinhaIcone icone={<Wallet size={16} aria-hidden="true" />} rotulo="Pagamento" tom={tom}>{txt}</LinhaIcone>; return px ? pg('laranja', px.estado === 'conferir' ? 'Pix a conferir' : 'Aguardando Pix') : falta > 0.009 ? pg('laranja', `Falta ${rs(falta, true)}`) : pg('verde', 'Pago') })()}
                  </div>
                  {acao && <Botao className={precisaAceitar(p) ? undefined : `pd-passo${passoDeDepois(p) ? ' pd-passo--depois' : ''}`} tamanho="p" cheio carregando={mudando === p.id} onClick={e => { e.stopPropagation(); aoAvancar(p) }}>{acao.rotulo}</Botao>}
                </article>
              )
            })}
            {col.chave === 'entregue' && entreguesFora > 0 && <p className="pdq-vazio">E mais {entreguesFora} {entreguesFora === 1 ? 'entregue' : 'entregues'}. Veja todos na Lista.</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
