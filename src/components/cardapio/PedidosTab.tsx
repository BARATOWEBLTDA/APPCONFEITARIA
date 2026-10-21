/* Pedidos do cliente (08/10 · 3.31): em andamento com o passo a passo, depois os anteriores */
import { useState } from 'react'
import CampoData from '@/components/CampoData'
import { ArrowClockwise, Receipt } from '@phosphor-icons/react'
import { AcompanharPedido } from './AcompanharPedido'
import { CartaoPedido, JanelaEntrar, SemConta, lerCliente, pedidoAberto, usePedidosCliente, type Cliente } from './contaCliente'

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
  const andamento = pedidos.filter(pedidoAberto)
  // (21/10) filtro por data (dia em que o pedido foi feito) nos anteriores; os em andamento aparecem sempre
  const [filtro, setFiltro] = useState<'todos' | '30' | 'mes' | 'datas'>('todos')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const hoje = new Date()
  const faixa: [string, string] = filtro === '30' ? [isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29)), isoLocal(hoje)]
    : filtro === 'mes' ? [isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), isoLocal(hoje)]
    : filtro === 'datas' ? [de || '0000-01-01', ate || '9999-12-31'] : ['0000-01-01', '9999-12-31']
  const todosAnteriores = pedidos.filter(p => !pedidoAberto(p))
  const anteriores = todosAnteriores.filter(p => { const d = p.created_at ? isoLocal(new Date(p.created_at)) : ''; return !d || (d >= faixa[0] && d <= faixa[1]) })
  const FILTROS: [typeof filtro, string][] = [['todos', 'Todos'], ['30', 'Últimos 30 dias'], ['mes', 'Este mês'], ['datas', 'Escolher datas']]

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
          <SemConta cor={accent} titulo="Acompanhe seus pedidos" texto="Entre com o seu WhatsApp pra ver o andamento e o histórico dos seus pedidos." icone={<Receipt size={40} weight="duotone" />} aoEntrar={() => setEntrar(true)} />
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
            {andamento.length > 0 && <h3 className="cc-sec">Em andamento</h3>}
            {andamento.map(p => <AcompanharPedido key={p.id} p={p} cor={accent} corTopo={corTopo} />)}
            {todosAnteriores.length > 0 && <>
              <h3 className="cc-sec">Anteriores</h3>
              <div className="cc-filtros" role="radiogroup" aria-label="Filtrar por data">
                {FILTROS.map(([k, n]) => (
                  <button key={k} type="button" role="radio" aria-checked={filtro === k} style={filtro === k ? { background: accent, borderColor: accent } : undefined} onClick={() => setFiltro(k)}>{n}</button>
                ))}
              </div>
              {filtro === 'datas' && (
                <div className="cc-datas">
                  <CampoData valor={de} onChange={setDe} max={ate || undefined} titulo="Pedidos a partir de" placeholder="De" curto cor={accent} />
                  <CampoData valor={ate} onChange={setAte} min={de || undefined} titulo="Pedidos até" placeholder="Até" curto cor={accent} />
                </div>
              )}
              {anteriores.length === 0 && <p className="cc-filtro-vazio">Nenhum pedido nessas datas.</p>}
            </>}
            {anteriores.map(p => <CartaoPedido key={p.id} p={p} cor={accent} />)}
          </>
        )}
      </div>

      <JanelaEntrar aberta={entrar} aoFechar={() => setEntrar(false)} loja={confeteiraUserId} cor={accent} aoEntrar={setCliente} />
    </div>
  )
}
