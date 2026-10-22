import { useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { ArrowRight, Bag, CaretDown, DotsThreeVertical } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Linha } from '@/components/base'
import type { Pedido } from './pedidoTexto'
import { pixDoPedido, acaoDe, atrasado, precisaAceitar, criadoEm, dataCurta, dataLonga, enderecoCurto, formaDoItem, fotoDoPedido, horaCurta, itensOrdenados, nomeCliente, nomeDoItem, partesDaQtd, recebidoPedido, resumoItens, rs, saldoPedido, situacaoDe, telefoneBonito, grupoDoStatus } from './pedidoTexto'
import { r2 } from '@/lib/moeda'

/**
 * Pedido na lista (08/10 · 3.11, no padrão do guia).
 *   CartaoPedido: celular e tablet. Rótulo + texto, botão do próximo passo, setinha que abre os detalhes.
 *   LinhaPedido: computador. Uma linha por pedido, com as mesmas palavras do cartão.
 * O cartão inteiro abre a tela do pedido; os botões de dentro fazem só o que dizem.
 * (08/10 · 3.14) O botão do próximo passo é cinza chumbo (parece botão e não disputa com o "Novo", rosa).
 * Pedido pra aceitar fica em destaque: borda laranja e o "Aceitar" em rosa.
 */
type Props = {
  p: Pedido
  aoAbrir: (p: Pedido) => void
  aoAvancar: (p: Pedido) => void
  aoMenu: (p: Pedido) => void
  aoEndereco: (p: Pedido) => void
  mudando?: boolean
  /** (09/10 · 3.72) as boas-vindas abrem o cartão sozinhas e mostram o recado do item dentro dele */
  abertoFixo?: boolean
  extra?: ReactNode
  /** (20/10) "Confirmar Pix": o cliente disse que pagou pelo cardápio */
  aoConfirmarPix?: (p: Pedido) => void
}

const parar = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn() }
const teclaAbre = (fn: () => void) => (e: KeyboardEvent<HTMLElement>) => {
  if (e.target !== e.currentTarget) return
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

/** Nome do item com a quantidade em destaque, conforme a forma de venda: "<b>2x</b> Brownie", "Bolo red velvet <b>1,5 kg</b>" */
export function NomeComQtd({ nome, qtd, forma, semUm = false, Destaque = 'b' }: { nome: string; qtd: number; forma?: string | null; semUm?: boolean; Destaque?: 'b' | 'em' }) {
  const { antes, depois, sep } = partesDaQtd(qtd, forma, semUm)
  return <>{antes && <><Destaque>{antes}</Destaque> </>}{nome}{depois && <>{sep}<Destaque>{depois}</Destaque></>}</>
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

/** Pagamento na lista: o Pix pelo cardápio tem os passos dele (Aguardando Pix → Pix a conferir); o resto é Falta / Pago */
function textoPagamento(p: Pedido, falta: number): { texto: string; tom: 'laranja' | 'verde' } {
  const px = pixDoPedido(p)
  if (px?.estado === 'conferir') return { texto: px.tipo === 'sinal' ? 'Sinal no Pix a conferir' : 'Pix a conferir', tom: 'laranja' }
  if (px?.estado === 'aguardando') return { texto: 'Aguardando Pix', tom: 'laranja' }
  return falta > 0.009 ? { texto: `Falta ${rs(falta, true)}`, tom: 'laranja' } : { texto: 'Pago', tom: 'verde' }
}

export function CartaoPedido({ p, aoAbrir, aoAvancar, aoMenu, aoEndereco, mudando, abertoFixo, extra, aoConfirmarPix }: Props) {
  const [abertoAqui, setAberto] = useState(false)
  const aberto = abertoFixo ?? abertoAqui
  const sit = situacaoDe(p)
  const acao = acaoDe(p)
  const atr = atrasado(p)
  const aceitar = precisaAceitar(p)
  const falta = saldoPedido(p)
  const recebido = recebidoPedido(p)
  const entrega = p.tipo_entrega === 'entrega'
  const cancelado = grupoDoStatus(p.status) === 'cancelado'
  const tel = telefoneBonito(p.cliente_telefone)
  const end = enderecoCurto(p)
  const px = pixDoPedido(p)
  const pixConferir = px?.estado === 'conferir' ? px : null
  return (
    <article className={`pdc${atr ? ' atr' : ''}${aceitar ? ' aceitar' : ''}`} tabIndex={0} aria-label={`Pedido #${p.numero || ''} de ${nomeCliente(p)}`} onClick={() => aoAbrir(p)} onKeyDown={teclaAbre(() => aoAbrir(p))}>
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
          {acao && <Botao className={aceitar ? undefined : 'pd-passo'} tamanho="p" carregando={mudando} onClick={parar(() => aoAvancar(p))}>{acao.rotulo}</Botao>}
        </div>
        {!cancelado && <Linha rotulo="Pagamento" tom={textoPagamento(p, falta).tom}>{textoPagamento(p, falta).texto}</Linha>}
        <Linha rotulo={entrega ? 'Entrega' : 'Retirada'} tom={atr ? 'vermelho' : undefined}>{dataLonga(p.data_entrega, p.horario_entrega)}</Linha>
        {entrega && <button type="button" className="pdc-end" onClick={parar(() => aoEndereco(p))}>Ver endereço</button>}
        {/* (20/10) o cliente disse que pagou o Pix do cardápio: ela confere no banco e confirma aqui */}
        {pixConferir && aoConfirmarPix && <Botao className="pdc-pix" variante="suave" tamanho="m" cheio onClick={parar(() => aoConfirmarPix(p))}>Confirmar Pix de {rs(pixConferir.valor)}</Botao>}
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
                <p key={i}><span><NomeComQtd nome={nomeDoItem(it)} qtd={it.quantidade} forma={formaDoItem(it)} /></span><span>{rs(r2((it.valor_unitario || 0) * (it.quantidade || 1)))}</span></p>
              ))}
            </div>
          )}
          {extra}
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
  const aceitar = precisaAceitar(p)
  const falta = saldoPedido(p)
  const entrega = p.tipo_entrega === 'entrega'
  const cancelado = grupoDoStatus(p.status) === 'cancelado'
  // dentro do grupo do dia, basta a hora; atrasado e concluído mostram a data
  const quando = atr || comDia ? dataLonga(p.data_entrega, p.horario_entrega).replace(/ \(.*\)$/, '') : (horaCurta(p.horario_entrega) || 'Sem hora')
  return (
    <div className={`pdl${aceitar ? ' aceitar' : ''}`} role="row" tabIndex={0} aria-label={`Pedido #${p.numero || ''} de ${nomeCliente(p)}`} onClick={() => aoAbrir(p)} onKeyDown={teclaAbre(() => aoAbrir(p))}>
      <div className="pdl-quem" role="cell">
        <Foto p={p} />
        <div className="pdc-quem">
          <p className="pdc-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
          <p className="pdc-res">{resumoItens(p)}</p>
        </div>
      </div>
      <p className={`pdl-cel${sit.tom ? ` t-${sit.tom}` : ''}`} role="cell"><b>{sit.nome}</b></p>
      <p className={`pdl-cel ${cancelado ? '' : `t-${textoPagamento(p, falta).tom}`}`} role="cell">
        <b>{cancelado ? '—' : textoPagamento(p, falta).texto}</b>
        <small>de {rs(p.valor_total)}</small>
      </p>
      <p className={`pdl-cel${atr ? ' t-vermelho' : ''}`} role="cell">
        <b>{quando}</b>
        <small>{entrega ? 'Entrega' : 'Retirada'}{entrega && <> · <button type="button" className="pdl-end" onClick={parar(() => aoEndereco(p))}>ver endereço</button></>}</small>
      </p>
      <div className="pdl-acao" role="cell">
        {acao && <Botao className={aceitar ? undefined : 'pd-passo'} tamanho="p" carregando={mudando} onClick={parar(() => aoAvancar(p))}>{acao.rotulo}</Botao>}
      </div>
      <div role="cell">
        <BotaoIcone rotulo="Mais ações" variante="limpo" tamanho="p" onClick={parar(() => aoMenu(p))}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
      </div>
    </div>
  )
}

/**
 * (22/10) Celular: o pedido numa linha (estilo iFood Gestor). Foto, cliente, itens, quando, pagamento,
 * valor e um botão só, o da próxima etapa. O resto (Pix, endereço, detalhes) fica ao abrir o pedido.
 */
export function LinhaCompacta({ p, aoAbrir, aoAvancar, mudando }: Props) {
  const acao = acaoDe(p)
  const atr = atrasado(p)
  const aceitar = precisaAceitar(p)
  const cancelado = grupoDoStatus(p.status) === 'cancelado'
  const falta = saldoPedido(p)
  const pg = textoPagamento(p, falta)
  const quando = !p.data_entrega && p.tipo_venda === 'pronta_entrega' ? 'Pronta entrega' : dataCurta(p.data_entrega, p.horario_entrega)
  const dm = p.data_entrega ? `${p.data_entrega.slice(8, 10)}/${p.data_entrega.slice(5, 7)}` : ''
  // botão curto pra caber na linha: "Marcar pronto" vira "Pronto", "Marcar entregue" vira "Entregue"
  const rot = acao ? acao.rotulo.replace(/^Marcar /, '').replace(/^./, c => c.toUpperCase()) : ''
  return (
    <div className={`pdk${atr ? ' atr' : ''}`} role="button" tabIndex={0} aria-label={`Pedido #${p.numero || ''} de ${nomeCliente(p)}`} onClick={() => aoAbrir(p)} onKeyDown={teclaAbre(() => aoAbrir(p))}>
      <Foto p={p} />
      <div className="pdk-tx">
        <p className="pdk-nome"><b>{nomeCliente(p)}</b><span>#{p.numero || '—'}</span></p>
        <p className="pdk-s">{resumoItens(p)}</p>
        <p className={`pdk-s pdk-q${atr ? ' t-vermelho' : ''}`}>{atr ? `Atrasado · era pra ${dm}` : quando}</p>
        {cancelado
          ? <p className="pdk-pg">Cancelado</p>
          : <p className={`pdk-pg t-${pg.tom}`}>{pg.texto}</p>}
      </div>
      <div className="pdk-dir">
        <b className="pdk-v">{rs(p.valor_total)}</b>
        {acao && <Botao className={aceitar ? 'pdk-bt' : 'pdk-bt pd-passo'} tamanho="p" carregando={mudando} onClick={parar(() => aoAvancar(p))}>{rot}</Botao>}
      </div>
    </div>
  )
}
