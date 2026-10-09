/* Pedidos da cliente (08/10 · 3.31): em andamento com o passo a passo, depois os anteriores */
import { useState } from 'react'
import { ArrowClockwise, Receipt } from '@phosphor-icons/react'
import { CartaoPedido, JanelaEntrar, SemConta, lerCliente, pedidoAberto, usePedidosCliente, type Cliente } from './contaCliente'

export function PedidosTab({ accent, confeteiraUserId }: {
  accent: string
  confeteiraUserId: string
  /** (antigo: levava pra aba Perfil pra entrar; agora entra daqui mesmo) */
  onIrParaPerfil?: () => void
}) {
  const [cliente, setCliente] = useState<Cliente | null>(() => lerCliente(confeteiraUserId))
  const [entrar, setEntrar] = useState(false)
  const { pedidos, carregando, buscar } = usePedidosCliente(confeteiraUserId, cliente)
  const andamento = pedidos.filter(pedidoAberto)
  const anteriores = pedidos.filter(p => !pedidoAberto(p))

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
          <SemConta cor={accent} titulo="Acompanhe seus pedidos" texto="Entre com o seu WhatsApp pra ver o andamento e o histórico dos seus pedidos." aoEntrar={() => setEntrar(true)} />
        ) : carregando && pedidos.length === 0 ? (
          <div className="cc-carregando">{[0, 1].map(i => <span key={i} className="cc-ped cc-ped--esq" />)}</div>
        ) : pedidos.length === 0 ? (
          <div className="cc-sem">
            <span className="cc-sem-ic"><Receipt size={36} weight="duotone" /></span>
            <b>Nenhum pedido ainda</b>
            <p>Quando você fizer um pedido, ele aparece aqui.</p>
          </div>
        ) : (
          <>
            {andamento.length > 0 && <h3 className="cc-sec">Em andamento</h3>}
            {andamento.map(p => <CartaoPedido key={p.id} p={p} cor={accent} />)}
            {anteriores.length > 0 && <h3 className="cc-sec">Anteriores</h3>}
            {anteriores.map(p => <CartaoPedido key={p.id} p={p} cor={accent} />)}
          </>
        )}
      </div>

      <JanelaEntrar aberta={entrar} aoFechar={() => setEntrar(false)} loja={confeteiraUserId} cor={accent} aoEntrar={setCliente} />
    </div>
  )
}
