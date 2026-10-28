/* Pedidos do cliente (08/10 · 3.31): em andamento com o passo a passo, depois os anteriores */
import { useState, type ReactNode } from 'react'
import PeriodoFiltro, { iso, periodoInicial, rotuloPeriodo, type Periodo } from '@/components/financeiro/PeriodoFiltro'
import { ArrowClockwise, CaretDown, Receipt } from '@phosphor-icons/react'
import { AcompanharPedido, frase } from './AcompanharPedido'
import { CartaoPedido, JanelaEntrar, SemConta, dinheiro, lerCliente, pedidoAberto, usePedidosCliente, type Cliente, type Pedido } from './contaCliente'

export function PedidosTab({ accent, corTopo, confeteiraUserId, onVerCardapio }: {
  accent: string
  /** (21/10) cor do topo da loja (topo do pedido em andamento) */
  corTopo?: string
  confeteiraUserId: string
  /** (14/10) sem pedidos: botão que fecha a janela e volta pros produtos */
  onVerCardapio?: () => void
  /** (antigo: levava pra aba Perfil pra entrar; agora entra daqui mesmo) */
  onIrParaPerfil?: () => void
}) {
  const [cliente, setCliente] = useState<Cliente | null>(() => lerCliente(confeteiraUserId))
  const [entrar, setEntrar] = useState(false)
  const { pedidos, carregando, buscar } = usePedidosCliente(confeteiraUserId, cliente)
  // (21/10) filtro por data no topo, o mesmo do app (Hoje · 7 dias · Mês ‹ › · Período), pelo dia em que o pedido foi feito
  const [periodo, setPeriodo] = useState<Periodo>(periodoInicial)
  const noPeriodo = pedidos.filter(p => { const d = p.created_at ? iso(new Date(p.created_at)) : ''; return !d || (d >= periodo.ini && d <= periodo.fim) })
  const andamento = noPeriodo.filter(pedidoAberto)
  const anteriores = noPeriodo.filter(p => !pedidoAberto(p))
  // (28/10) só um pedido aberto por vez: o mais recente em andamento (ou o mais recente de todos); os outros ficam numa linha
  const destaque = (andamento[0] || anteriores[0])?.id
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const estaAberto = (id: string) => abertos[id] ?? id === destaque
  const alternar = (id: string) => setAbertos(a => ({ ...a, [id]: !estaAberto(id) }))
  const item = (p: Pedido, conteudo: ReactNode) => estaAberto(p.id)
    ? <div key={p.id} className="cc-aberto">{p.id !== destaque && <button type="button" className="cc-fechar" onClick={() => alternar(p.id)}>Recolher<CaretDown size={16} weight="bold" aria-hidden="true" /></button>}{conteudo}</div>
    : <LinhaPedido key={p.id} p={p} cor={accent} aoAbrir={() => alternar(p.id)} />

  return (
    <div className="cc">
      <div className="cc-topo">
        <span><h2>Pedidos</h2>{cliente && <small>{cliente.nome}</small>}</span>
        {cliente && (
          <button type="button" className={`cc-bt-ic${carregando ? ' gira' : ''}`} aria-label="Atualizar os pedidos" onClick={buscar} disabled={carregando}>
            <ArrowClockwise size={22} weight="bold" />
          </button>
        )}
      </div>

      <div className="cc-rolo">
        {!cliente ? (
          <SemConta cor={accent} titulo="Acompanhe seus pedidos" texto="Entre com o seu WhatsApp para ver o andamento e o histórico dos seus pedidos." icone={<Receipt size={40} weight="duotone" />} aoEntrar={() => setEntrar(true)} />
        ) : carregando && pedidos.length === 0 ? (
          <div className="cc-carregando">{[0, 1].map(i => <span key={i} className="cc-ped cc-ped--esq" />)}</div>
        ) : pedidos.length === 0 ? (
          <div className="cc-sem">
            <span className="cc-sem-ic"><Receipt size={36} weight="duotone" /></span>
            <b>Nenhum pedido ainda</b>
            {/* (14/10) diz de onde vêm os pedidos: os feitos com o WhatsApp de quem entrou */}
            <p>Os pedidos feitos com o WhatsApp {cliente.telefone ? <b className="cc-tel">{cliente.telefone}</b> : 'que você usou'} aparecem aqui.</p>
            {onVerCardapio && <button type="button" className="cc-bt" style={{ background: accent }} onClick={onVerCardapio}>Ver o cardápio</button>}
          </div>
        ) : (
          <>
            <div className="cc-periodo"><PeriodoFiltro valor={periodo} onChange={setPeriodo} /></div>
            {noPeriodo.length === 0 && <p className="cc-filtro-vazio">Nenhum pedido {rotuloPeriodo(periodo)}.</p>}
            {andamento.length > 0 && <h3 className="cc-sec">Em andamento</h3>}
            {andamento.map(p => item(p, <AcompanharPedido p={p} cor={accent} corTopo={corTopo} aoAtualizar={buscar} />))}
            {anteriores.length > 0 && <h3 className="cc-sec">Anteriores</h3>}
            {anteriores.map(p => item(p, <CartaoPedido p={p} cor={accent} />))}
          </>
        )}
      </div>

      <JanelaEntrar aberta={entrar} aoFechar={() => setEntrar(false)} loja={confeteiraUserId} cor={accent} aoEntrar={setCliente} />
    </div>
  )
}

/** (28/10) pedido recolhido: número, a situação, o dia e o total; tocar abre */
function LinhaPedido({ p, cor, aoAbrir }: { p: Pedido; cor: string; aoAbrir: () => void }) {
  const feito = p.status === 'cancelado' ? 'Cancelado' : frase(p)
  const ok = ['concluido', 'entregue'].includes(p.status)
  const dia = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''
  return (
    <button type="button" className={`cc-linha${p.status === 'cancelado' ? ' off' : ''}`} onClick={aoAbrir} aria-expanded={false}>
      <i className="cc-linha-pt" style={!ok && p.status !== 'cancelado' ? { background: cor } : undefined} aria-hidden="true" />
      <span className="cc-linha-tx"><b>Pedido #{p.numero}{dia && <em> · {dia}</em>}</b><small>{feito}</small></span>
      <strong>{dinheiro(p.valor_total)}</strong>
      <CaretDown size={18} weight="bold" aria-hidden="true" />
    </button>
  )
}
