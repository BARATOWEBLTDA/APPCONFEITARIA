import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  novo:        { label: 'Novo',        color: '#534AB7', bg: '#EEEDFE' },
  confirmado:  { label: 'Confirmado',  color: '#534AB7', bg: '#EEEDFE' },
  em_producao: { label: 'Em Produção', color: '#9a3412', bg: '#ffedd5' },
  pronto:      { label: 'Pronto',      color: '#14532d', bg: '#dcfce7' },
  a_caminho:   { label: 'A Caminho',   color: '#0369a1', bg: '#e0f2fe' },
  concluido:   { label: 'Concluído',   color: '#374151', bg: '#f3f4f6' },
  entregue:    { label: 'Entregue',    color: '#374151', bg: '#f3f4f6' },
  cancelado:   { label: 'Cancelado',   color: '#991b1b', bg: '#fee2e2' },
}

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type Pedido = {
  id: string; numero: number; status: string; created_at: string
  valor_total: number; forma_pagamento: string; status_pagamento: string
  tipo_entrega: string; data_entrega?: string; horario_entrega?: string
  pedido_itens?: { nome_produto: string; quantidade: number; valor_unitario: number; produtos?: { imagem_url?: string } }[]
}

export function PedidosTab({ accent, confeteiraUserId, onIrParaPerfil }: {
  accent: string
  confeteiraUserId: string
  onIrParaPerfil: () => void
}) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)
  const [clienteNome, setClienteNome] = useState('')
  const [logado, setLogado] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cardapio_cliente_${confeteiraUserId}`)
      if (saved) {
        const c = JSON.parse(saved)
        setClienteNome(c.nome)
        setLogado(true)
        buscarPedidos(c.telefone)
      }
    } catch {}
  }, [confeteiraUserId])

  const buscarPedidos = async (telefone: string) => {
    setLoading(true)
    try {
      const tel = telefone.replace(/\D/g,'')
      const sufixo = tel.slice(-8)

      const { data, error } = await supabase
        .from('pedidos')
        .select('*, pedido_itens(nome_produto, quantidade, valor_unitario, produtos(imagem_url))')
        .eq('user_id', confeteiraUserId)
        .or(`cliente_telefone.ilike.%${sufixo}%,cliente_whatsapp.ilike.%${sufixo}%`)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) console.error('Erro ao buscar pedidos:', error)
      setPedidos(data || [])
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err)
    }
    setLoading(false)
  }

  const pedidosAndamento = pedidos.filter(p => !['concluido','entregue','cancelado'].includes(p.status))
  const pedidosAnteriores = pedidos.filter(p => ['concluido','entregue','cancelado'].includes(p.status))

  // Não logado
  if (!logado) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{padding:'20px 20px 16px',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
        <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Meus Pedidos</p>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',gap:'12px',textAlign:'center'}}>
        <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px'}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <p style={{margin:0,fontWeight:700,fontSize:'18px',color:'#3e3e3e'}}>Seus pedidos aqui</p>
        <p style={{margin:0,fontSize:'13px',color:'#a0a0a0',lineHeight:'1.5'}}>
          Faça login para acompanhar seus pedidos e ver o histórico de compras.
        </p>
        <button
          onClick={onIrParaPerfil}
          style={{marginTop:'8px',padding:'14px 32px',background:accent,color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'15px',cursor:'pointer',fontFamily:'inherit',width:'100%'}}>
          Entrar ou Cadastrar
        </button>
      </div>
    </div>
  )

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'20px 20px 16px',borderBottom:'1px solid #f0f0f0',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Meus Pedidos</p>
          <p style={{margin:0,fontSize:'12px',color:'#a0a0a0'}}>{clienteNome}</p>
        </div>
        <button onClick={() => buscarPedidos(JSON.parse(localStorage.getItem(`cardapio_cliente_${confeteiraUserId}`)!).telefone)}
          style={{background:'none',border:'none',cursor:'pointer',color:'#a0a0a0',display:'flex',alignItems:'center',gap:'4px',fontSize:'12px',fontFamily:'inherit'}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.88-3.56"/></svg>
          Atualizar
        </button>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px 16px 80px'}}>
        {loading && (
          <div style={{textAlign:'center',padding:'40px',color:'#a0a0a0'}}>
            <div style={{width:'24px',height:'24px',border:`2px solid #f0f0f0`,borderTopColor:accent,borderRadius:'50%',animation:'spin 0.6s linear infinite',margin:'0 auto 8px'}} />
            Carregando pedidos...
          </div>
        )}

        {!loading && pedidos.length === 0 && (
          <div style={{textAlign:'center',padding:'48px 20px'}}>
            <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'#f5f5f5',margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <p style={{margin:'0 0 4px',fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Nenhum pedido encontrado</p>
            <p style={{margin:0,fontSize:'13px',color:'#a0a0a0'}}>Seus pedidos aparecerão aqui após sua primeira compra.</p>
          </div>
        )}

        {!loading && pedidosAndamento.length > 0 && (
          <div style={{marginBottom:'16px'}}>
            <p style={{margin:'0 0 10px',fontSize:'11px',fontWeight:700,color:'#a0a0a0',textTransform:'uppercase',letterSpacing:'0.06em'}}>Em Andamento</p>
            {pedidosAndamento.map(p => <PedidoCard key={p.id} p={p} accent={accent} />)}
          </div>
        )}

        {!loading && pedidosAnteriores.length > 0 && (
          <div>
            <p style={{margin:'0 0 10px',fontSize:'11px',fontWeight:700,color:'#a0a0a0',textTransform:'uppercase',letterSpacing:'0.06em'}}>Anteriores</p>
            {pedidosAnteriores.map(p => <PedidoCard key={p.id} p={p} accent={accent} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function PedidoCard({ p, accent }: { p: Pedido; accent: string }) {
  const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG['novo']
  const data = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) : ''
  const hora = p.created_at ? new Date(p.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : ''

  return (
    <div style={{background:'#fff',border:'1.5px solid #f0f0f0',borderRadius:'14px',marginBottom:'10px',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderBottom:'1px solid #f5f5f5'}}>
        <div>
          <span style={{fontWeight:700,fontSize:'14px',color:'#3e3e3e'}}>#{p.numero}</span>
          <span style={{fontSize:'12px',color:'#a0a0a0',marginLeft:'8px'}}>{data}{hora ? `, ${hora}` : ''}</span>
        </div>
        <span style={{fontSize:'11px',fontWeight:700,padding:'4px 10px',borderRadius:'20px',color:sc.color,background:sc.bg}}>{sc.label}</span>
      </div>

      <div style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:'8px'}}>
        {(p.pedido_itens || []).map((item, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'8px',background:'#f5f5f5',overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem'}}>
              {item.produtos?.imagem_url
                ? <img src={item.produtos.imagem_url} alt={item.nome_produto} style={{width:'100%',height:'100%',objectFit:'cover'}} />
                : '🎂'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:'13px',fontWeight:600,color:'#3e3e3e',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{item.nome_produto}</p>
              <p style={{margin:0,fontSize:'12px',color:'#a0a0a0'}}>Qtd {item.quantidade} · {formatMoney(item.valor_unitario)}</p>
            </div>
            <p style={{margin:0,fontSize:'13px',fontWeight:700,color:'#3e3e3e',flexShrink:0}}>{formatMoney(item.quantidade * item.valor_unitario)}</p>
          </div>
        ))}
      </div>

      <div style={{padding:'10px 14px',background:'#fafafa',borderTop:'1px solid #f5f5f5',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{fontSize:'12px',color:'#a0a0a0'}}>
          {p.tipo_entrega === 'retirada' ? '🏪 Retirada' : '🚗 Entrega'}
          {p.data_entrega && ` · ${new Date(p.data_entrega+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`}
          {p.horario_entrega && ` ${p.horario_entrega.slice(0,5)}`}
        </div>
        <div style={{textAlign:'right'}}>
          <p style={{margin:0,fontSize:'14px',fontWeight:800,color:'#3e3e3e'}}>{formatMoney(p.valor_total)}</p>
          <p style={{margin:0,fontSize:'11px',color:p.status_pagamento==='pago'?'#16a34a':'#f59e0b',fontWeight:600}}>
            {p.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
          </p>
        </div>
      </div>
    </div>
  )
}
