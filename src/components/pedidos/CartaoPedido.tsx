import { useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { ArrowRight, Bag, CaretDown, DotsThreeVertical } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Linha } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { acaoDe, atrasado, criadoEm, dataLonga, enderecoCurto, fotoDoPedido, horaCurta, itensOrdenados, nomeCliente, nomeDeProduto, qtdCurta, recebidoPedido, resumoItens, rs, saldoPedido, situacaoDe, telefoneBonito, grupoDoStatus } from './pedidoTexto'

/**
 * Pedido na lista (08/10 · 3.11, no padrão do guia).
 *   CartaoPedido: celular e tablet. Rótulo + texto, botão do próximo passo, setinha que abre os detalhes.
 *   LinhaPedido: computador. Uma linha por pedido, com as mesmas palavras do cartão.
 * O cartão inteiro abre a tela do pedido; os botões de dentro fazem só o que dizem.
 * (08/10 · 3.12) O botão do próximo passo voltou a ser rosa forte: o rosa clarinho parecia etiqueta.
 */
type Props = {
  p: Pedido
  aoAbrir: (p: Pedido) => void
  aoAvancar: (p: Pedido) => void
  aoMenu: (p: Pedido) => void
  aoEndereco: (p: Pedido) => void
  mudando?: boolean
}

const parar = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn() }
const teclaAbre = (fn: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

function Foto({ p }: { p: Pedido }) {
  const f = fotoDoPedido(p)
  return (
    <span className="pdc-foto" aria-hidden="true">
      <Bag size={20} weight="bold" />
      {f && <img src={f} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}

export function CartaoPedido({ p, aoAbrir, aoAvancar, aoMenu, aoEndereco, mudando }: Props) {
  const [aberto, setAberto] = useState(false)
  const sit = situacaoDe(p)
  const acao = acaoDe(p)
  const atr = atrasado(p)
  const falta = saldoPedido(p)
  const recebido = recebidoPedido(p)
  const entrega = p.tipo_entrega === 'entrega'
  const cancelado = grupoDoStatus(p.status) === 'cancelado'
  const tel = telefoneBonito(p.cliente_telefone)
  const end = enderecoCurto(p)
  return (
    <article className={`pdc${atr ? ' atr' : ''}`} tabIndex={0} aria-label={`Pedido #${p.numero || ''} de ${nomeCliente(p)}`} onClick={() => aoAbrir(p)} onKeyDown={teclaAbre(() => aoAbrir(p))}>
      <div className="pdc-topo">
        <Foto p={p} />
        <div className="pdc-quem">
          <p className="pdc-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
          <p className="pdc-res">{resumoItens(p)}</p>
        </div>
        <BotaoIcone className="pdc-mais" rotulo="Mais ações" variante="limpo" tamanho="p" onClick={parar(() => aoMenu(p))}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
      </div>
      <div className="pdc-linhas">
        <div className="pdc-l1">
          <Linha rotulo="Situação" tom={sit.tom}>{sit.nome}</Linha>
          {acao && <Botao tamanho="p" carregando={mudando} onClick={parar(() => aoAvancar(p))}>{acao.rotulo}</Botao>}
        </div>
        {!cancelado && (falta > 0.009 ? <Linha rotulo="Pagamento" tom="laranja">Falta {rs(falta, true)}</Linha> : <Linha rotulo="Pagamento" tom="verde">Pago</Linha>)}
        <Linha rotulo={entrega ? 'Entrega' : 'Retirada'} tom={atr ? 'vermelho' : undefined}>{dataLonga(p.data_entrega, p.horario_entrega)}</Linha>
        {entrega && <button type="button" className="pdc-end" onClick={parar(() => aoEndereco(p))}>Ver endereço</button>}
      </div>
      {aberto && (
        <div className="pdc-det" onClick={e => e.stopPropagation()}>
          {p.created_at && <Linha rotulo="Pedido feito">{criadoEm(p.created_at)}</Linha>}
          <Linha rotulo="Origem">{p.origem === 'cardapio' ? 'Veio pelo cardápio' : 'Lançado por você'}</Linha>
          {entrega && end && <Linha rotulo="Endereço">{end}</Linha>}
          {tel && <Linha rotulo="Telefone">{tel}</Linha>}
          {itensOrdenados(p).length > 0 && (
            <div className="pdc-itens">
              {itensOrdenados(p).map((it, i) => (
                <p key={i}><span><b>{qtdCurta(it.quantidade, it.produtos?.forma_venda)}</b> {nomeDeProduto(it.nome_produto)}</span><span>{rs((it.valor_unitario || 0) * (it.quantidade || 1))}</span></p>
              ))}
            </div>
          )}
          <p className="pdc-total"><span>Total</span><span>{rs(p.valor_total)}</span></p>
          {recebido > 0.009 && <p className="pdc-rec"><span>Recebido</span><span>{rs(recebido)}</span></p>}
          {!cancelado && falta > 0.009 && <p className="pdc-rec falta"><span>Falta</span><span>{rs(falta)}</span></p>}
          <Botao variante="suave" tamanho="m" cheio iconeDepois={<ArrowRight size={20} weight="bold" />} onClick={() => aoAbrir(p)}>Abrir pedido</Botao>
        </div>
      )}
      <button type="button" className="pdc-seta" aria-expanded={aberto} aria-label={aberto ? 'Fechar detalhes' : 'Ver detalhes'} onClick={parar(() => setAberto(v => !v))}>
        <CaretDown size={20} weight="bold" className={aberto ? 'virada' : undefined} />
      </button>
    </article>
  )
}

export function LinhaPedido({ p, aoAbrir, aoAvancar, aoMenu, aoEndereco, mudando, comDia }: Props & { comDia?: boolean }) {
  const sit = situacaoDe(p)
  const acao = acaoDe(p)
  const atr = atrasado(p)
  const falta = saldoPedido(p)
  const entrega = p.tipo_entrega === 'entrega'
  const cancelado = grupoDoStatus(p.status) === 'cancelado'
  // dentro do grupo do dia, basta a hora; atrasado e concluído mostram a data
  const quando = atr || comDia ? dataLonga(p.data_entrega, p.horario_entrega).replace(/ \(.*\)$/, '') : (horaCurta(p.horario_entrega) || 'Sem hora')
  return (
    <div className="pdl" role="row" tabIndex={0} aria-label={`Pedido #${p.numero || ''} de ${nomeCliente(p)}`} onClick={() => aoAbrir(p)} onKeyDown={teclaAbre(() => aoAbrir(p))}>
      <div className="pdl-quem" role="cell">
        <Foto p={p} />
        <div className="pdc-quem">
          <p className="pdc-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
          <p className="pdc-res">{resumoItens(p)}</p>
        </div>
      </div>
      <p className={`pdl-cel${sit.tom ? ` t-${sit.tom}` : ''}`} role="cell"><b>{sit.nome}</b></p>
      <p className={`pdl-cel ${cancelado ? '' : falta > 0.009 ? 't-laranja' : 't-verde'}`} role="cell">
        <b>{cancelado ? '—' : falta > 0.009 ? `Falta ${rs(falta, true)}` : 'Pago'}</b>
        <small>de {rs(p.valor_total)}</small>
      </p>
      <p className={`pdl-cel${atr ? ' t-vermelho' : ''}`} role="cell">
        <b>{quando}</b>
        <small>{entrega ? 'Entrega' : 'Retirada'}{entrega && <> · <button type="button" className="pdl-end" onClick={parar(() => aoEndereco(p))}>ver endereço</button></>}</small>
      </p>
      <div className="pdl-acao" role="cell">
        {acao && <Botao tamanho="p" carregando={mudando} onClick={parar(() => aoAvancar(p))}>{acao.rotulo}</Botao>}
      </div>
      <div role="cell">
        <BotaoIcone rotulo="Mais ações" variante="limpo" tamanho="p" onClick={parar(() => aoMenu(p))}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
      </div>
    </div>
  )
}
