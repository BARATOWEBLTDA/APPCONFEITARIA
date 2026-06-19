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

export type EnderecoSalvo = {
  rua: string; numero: string; complemento: string; bairro: string; cidade: string; cep: string
}

type Cliente = { id: string; nome: string; telefone: string }
type Pedido = {
  id: string; numero: number; status: string; created_at: string; valor_total: number
  forma_pagamento: string; status_pagamento: string; tipo_entrega: string
  data_entrega?: string; horario_entrega?: string
  endereco_rua?: string; endereco_numero?: string; endereco_complemento?: string
  endereco_bairro?: string; endereco_cidade?: string; endereco_cep?: string
  pedido_itens?: { nome_produto: string; quantidade: number; valor_unitario: number; produtos?: { imagem_url?: string } }[]
}

export function PerfilTab({ accent, confeteiraUserId }: { accent: string; confeteiraUserId: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [aba, setAba] = useState<'pedidos' | 'dados'>('pedidos')
  const [loading, setLoading] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showCadastro, setShowCadastro] = useState(false)
  const [showAddEndereco, setShowAddEndereco] = useState(false)
  const [loginTel, setLoginTel] = useState('')
  const [cadNome, setCadNome] = useState('')
  const [cadTel, setCadTel] = useState('')
  const [erro, setErro] = useState('')
  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>([])

  // Form novo endereço
  const [novoCep, setNovoCep] = useState('')
  const [novoRua, setNovoRua] = useState('')
  const [novoNumero, setNovoNumero] = useState('')
  const [novoComplemento, setNovoComplemento] = useState('')
  const [novoBairro, setNovoBairro] = useState('')
  const [novoCidade, setNovoCidade] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  const maskTel = (v: string) => {
    const n = v.replace(/\D/g,'').slice(0,11)
    if (n.length > 10) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
    if (n.length > 6) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
    if (n.length > 2) return `(${n.slice(0,2)}) ${n.slice(2)}`
    return n.length ? `(${n}` : n
  }

  const buscarCepNovo = async (v: string) => {
    const c = v.replace(/\D/g,'')
    if (c.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`)
      const d = await res.json()
      if (!d.erro) { setNovoRua(d.logradouro||''); setNovoBairro(d.bairro||''); setNovoCidade(d.localidade||'') }
    } catch {}
    setCepLoading(false)
  }

  const carregarEnderecos = (tel: string) => {
    try {
      const key = `enderecos_${confeteiraUserId}_${tel.replace(/\D/g,'')}`
      const saved = localStorage.getItem(key)
      if (saved) setEnderecos(JSON.parse(saved))
    } catch {}
  }

  const salvarEnderecos = (tel: string, list: EnderecoSalvo[]) => {
    const key = `enderecos_${confeteiraUserId}_${tel.replace(/\D/g,'')}`
    localStorage.setItem(key, JSON.stringify(list))
    setEnderecos(list)
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`cardapio_cliente_${confeteiraUserId}`)
      if (saved) {
        const c = JSON.parse(saved)
        setCliente(c)
        buscarPedidos(c.telefone)
        carregarEnderecos(c.telefone)
      }
    } catch {}
  }, [confeteiraUserId])

  const buscarPedidos = async (telefone: string) => {
    if (!telefone || !confeteiraUserId) return
    setLoading(true)
    try {
      const tel = telefone.replace(/\D/g,'')
      const sufixo = tel.slice(-8)

      // Busca pedidos diretamente pelo telefone do cliente, sem depender de cliente_id
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

  const handleLogin = async () => {
    setErro('')
    const tel = loginTel.replace(/\D/g,'')
    if (tel.length < 10) { setErro('Digite um telefone válido'); return }
    setLoading(true)
    try {
      // Tenta buscar pelos últimos 8 dígitos em telefone ou whatsapp
      const sufixo = tel.slice(-8)
      const { data } = await supabase
        .from('clientes').select('id, nome, telefone, email')
        .eq('user_id', confeteiraUserId)
        .or(`telefone.ilike.%${sufixo}%,whatsapp.ilike.%${sufixo}%`)
        .maybeSingle()
      if (data) {
        const c = { id: data.id, nome: data.nome, telefone: data.telefone, email: data.email }
        setCliente(c)
        localStorage.setItem(`cardapio_cliente_${confeteiraUserId}`, JSON.stringify(c))
        buscarPedidos(data.telefone)
        carregarEnderecos(data.telefone)
        setShowLogin(false); setLoginTel('')
      } else { setErro('Telefone não encontrado. Faça seu cadastro!') }
    } catch { setErro('Erro ao buscar conta') }
    setLoading(false)
  }

  const handleCadastro = async () => {
    setErro('')
    if (!cadNome.trim()) { setErro('Digite seu nome'); return }
    const tel = cadTel.replace(/\D/g,'')
    if (tel.length < 10) { setErro('Digite um telefone válido'); return }
    setLoading(true)
    try {
      const { data: existe } = await supabase.from('clientes').select('id, nome, telefone')
        .eq('user_id', confeteiraUserId).like('telefone', `%${tel.slice(-8)}%`).maybeSingle()
      const c = existe
        ? { id: existe.id, nome: existe.nome, telefone: existe.telefone }
        : await supabase.from('clientes').insert({ user_id: confeteiraUserId, nome: cadNome.trim(), telefone: tel, whatsapp: tel })
            .select('id, nome, telefone').single().then(r => r.data ? { id: r.data.id, nome: r.data.nome, telefone: r.data.telefone } : null)
      if (c) {
        setCliente(c); localStorage.setItem(`cardapio_cliente_${confeteiraUserId}`, JSON.stringify(c))
        buscarPedidos(c.telefone); carregarEnderecos(c.telefone); setShowCadastro(false)
      }
    } catch { setErro('Erro ao criar conta') }
    setLoading(false)
  }

  const handleSair = () => {
    localStorage.removeItem(`cardapio_cliente_${confeteiraUserId}`)
    setCliente(null); setPedidos([]); setEnderecos([])
  }

  const handleSalvarEndereco = () => {
    if (!novoRua.trim() || !novoNumero.trim()) { alert('Preencha rua e número'); return }
    const novo: EnderecoSalvo = { rua: novoRua, numero: novoNumero, complemento: novoComplemento, bairro: novoBairro, cidade: novoCidade, cep: novoCep }
    const lista = [novo, ...enderecos.filter(e => e.rua !== novoRua || e.numero !== novoNumero)].slice(0, 5)
    salvarEnderecos(cliente!.telefone, lista)
    setShowAddEndereco(false); setNovoCep(''); setNovoRua(''); setNovoNumero(''); setNovoComplemento(''); setNovoBairro(''); setNovoCidade('')
  }

  const inp = (placeholder: string, value: string, onChange: (v:string)=>void, tel?: boolean) => (
    <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'14px',border:'1.5px solid #f0f0f0',borderRadius:'12px',background:'#fafafa'}}>
      <input value={value} onChange={e => onChange(tel ? maskTel(e.target.value) : e.target.value)}
        placeholder={placeholder} inputMode={tel ? 'numeric' : 'text'}
        style={{flex:1,border:'none',background:'transparent',fontSize:'14px',color:'#3e3e3e',outline:'none',fontFamily:'inherit'}} />
    </div>
  )

  const inpField = (placeholder: string, value: string, onChange: (v:string)=>void, opts?: { numeric?: boolean; half?: boolean }) => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      inputMode={opts?.numeric ? 'numeric' : 'text'}
      style={{width: opts?.half ? 'calc(50% - 4px)' : '100%', padding:'12px',border:'1.5px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit',background:'#fafafa'}} />
  )

  // ── Não logado ──────────────────────────────────────────────────────────────
  if (!cliente) return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'20px 20px 16px',borderBottom:'1px solid #f0f0f0'}}>
        <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Meu Perfil</p>
          <p style={{margin:0,fontSize:'12px',color:'#a0a0a0'}}>Pedidos e dados da sua conta</p>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',gap:'12px',textAlign:'center'}}>
        <div style={{width:'72px',height:'72px',borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'4px'}}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <p style={{margin:0,fontWeight:700,fontSize:'18px',color:'#3e3e3e'}}>Acesse sua conta</p>
        <p style={{margin:0,fontSize:'13px',color:'#a0a0a0',lineHeight:'1.5'}}>Faça login ou crie uma conta para acompanhar pedidos e gerenciar seus dados.</p>
        <button onClick={() => { setShowLogin(true); setErro('') }}
          style={{marginTop:'8px',padding:'14px 32px',background:accent,color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'15px',cursor:'pointer',fontFamily:'inherit',width:'100%'}}>
          Entrar ou Cadastrar
        </button>
      </div>

      {showLogin && (<>
        <div onClick={() => setShowLogin(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300}} />
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#fff',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px',maxWidth:'480px',margin:'0 auto'}}>
          <div style={{width:'36px',height:'4px',background:'#e5e7eb',borderRadius:'4px',margin:'0 auto 20px'}} />
          <button onClick={() => setShowLogin(false)} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',cursor:'pointer',color:'#a0a0a0',fontSize:'20px'}}>✕</button>
          <p style={{margin:'0 0 4px',fontWeight:800,fontSize:'20px',color:'#3e3e3e',textAlign:'center'}}>Acesse sua conta</p>
          <p style={{margin:'0 0 20px',fontSize:'13px',color:'#a0a0a0',textAlign:'center',lineHeight:'1.5'}}>Informe seu telefone para continuar.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {inp('Telefone (obrigatório)', loginTel, v => setLoginTel(maskTel(v)), true)}
          </div>
          {erro && <p style={{margin:'8px 0 0',fontSize:'12px',color:'#ef4444',textAlign:'center'}}>{erro}</p>}
          <button onClick={handleLogin} disabled={loading}
            style={{marginTop:'16px',width:'100%',padding:'15px',background:accent,color:'white',border:'none',borderRadius:'12px',fontWeight:800,fontSize:'16px',cursor:'pointer',fontFamily:'inherit'}}>
            {loading ? 'Buscando...' : 'Continuar'}
          </button>
          <p style={{margin:'16px 0 0',textAlign:'center',fontSize:'13px',color:'#a0a0a0'}}>
            Não tem conta?{' '}
            <button onClick={() => { setShowLogin(false); setShowCadastro(true); setErro('') }}
              style={{background:'none',border:'none',color:accent,fontWeight:700,cursor:'pointer',fontSize:'13px',fontFamily:'inherit'}}>Criar cadastro</button>
          </p>
        </div>
      </>)}

      {showCadastro && (<>
        <div onClick={() => setShowCadastro(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300}} />
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#fff',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px',maxWidth:'480px',margin:'0 auto'}}>
          <div style={{width:'36px',height:'4px',background:'#e5e7eb',borderRadius:'4px',margin:'0 auto 20px'}} />
          <button onClick={() => setShowCadastro(false)} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',cursor:'pointer',color:'#a0a0a0',fontSize:'20px'}}>✕</button>
          <p style={{margin:'0 0 4px',fontWeight:800,fontSize:'20px',color:'#3e3e3e',textAlign:'center'}}>Crie sua conta</p>
          <p style={{margin:'0 0 20px',fontSize:'13px',color:'#a0a0a0',textAlign:'center',lineHeight:'1.5'}}>Preencha seus dados para criar uma conta.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            {inp('Nome completo', cadNome, setCadNome)}
            {inp('Telefone', cadTel, v => setCadTel(maskTel(v)), true)}
          </div>
          {erro && <p style={{margin:'8px 0 0',fontSize:'12px',color:'#ef4444',textAlign:'center'}}>{erro}</p>}
          <button onClick={handleCadastro} disabled={loading}
            style={{marginTop:'16px',width:'100%',padding:'15px',background:accent,color:'white',border:'none',borderRadius:'12px',fontWeight:800,fontSize:'16px',cursor:'pointer',fontFamily:'inherit'}}>
            {loading ? 'Criando...' : 'Finalizar Cadastro'}
          </button>
          <p style={{margin:'16px 0 0',textAlign:'center',fontSize:'13px',color:'#a0a0a0'}}>
            Já tem conta?{' '}
            <button onClick={() => { setShowCadastro(false); setShowLogin(true); setErro('') }}
              style={{background:'none',border:'none',color:accent,fontWeight:700,cursor:'pointer',fontSize:'13px',fontFamily:'inherit'}}>Fazer login</button>
          </p>
        </div>
      </>)}
    </div>
  )

  // ── Logado ──────────────────────────────────────────────────────────────────
  const pedidosAndamento = pedidos.filter(p => !['concluido','entregue','cancelado'].includes(p.status))
  const pedidosAnteriores = pedidos.filter(p => ['concluido','entregue','cancelado'].includes(p.status))

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'20px 20px 16px',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
        <div style={{width:'44px',height:'44px',borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <p style={{margin:0,fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Meu Perfil</p>
          <p style={{margin:0,fontSize:'12px',color:'#a0a0a0'}}>Pedidos e dados da sua conta</p>
        </div>
      </div>

      <div style={{display:'flex',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
        {(['pedidos','dados'] as const).map(a => (
          <button key={a} onClick={() => setAba(a)} style={{flex:1,padding:'12px',background:'none',border:'none',cursor:'pointer',fontSize:'14px',fontWeight:aba===a?700:500,color:aba===a?accent:'#a0a0a0',borderBottom:aba===a?`2px solid ${accent}`:'2px solid transparent',fontFamily:'inherit',transition:'all 0.15s'}}>
            {a === 'pedidos' ? `Meus Pedidos${pedidos.length > 0 ? ` ${pedidos.length}` : ''}` : 'Dados Pessoais'}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'16px 16px 80px'}}>
        {aba === 'pedidos' && (<>
          {loading && <div style={{textAlign:'center',padding:'40px',color:'#a0a0a0'}}>Carregando...</div>}
          {!loading && pedidos.length === 0 && (
            <div style={{textAlign:'center',padding:'48px 20px'}}>
              <div style={{width:'64px',height:'64px',borderRadius:'50%',background:'#f5f5f5',margin:'0 auto 16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.5"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              </div>
              <p style={{margin:'0 0 4px',fontWeight:700,fontSize:'16px',color:'#3e3e3e'}}>Nenhum pedido encontrado</p>
              <p style={{margin:0,fontSize:'13px',color:'#a0a0a0'}}>Seus pedidos aparecerão aqui.</p>
            </div>
          )}
          {pedidosAndamento.length > 0 && (<div style={{marginBottom:'16px'}}>
            <p style={{margin:'0 0 10px',fontSize:'11px',fontWeight:700,color:'#a0a0a0',textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>Em Andamento</p>
            {pedidosAndamento.map(p => <PedidoCard key={p.id} p={p} accent={accent} />)}
          </div>)}
          {pedidosAnteriores.length > 0 && (<div>
            <p style={{margin:'0 0 10px',fontSize:'11px',fontWeight:700,color:'#a0a0a0',textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>Anteriores</p>
            {pedidosAnteriores.map(p => <PedidoCard key={p.id} p={p} accent={accent} />)}
          </div>)}
        </>)}

        {aba === 'dados' && (
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            {/* Info cliente */}
            <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'16px',background:'#f9fafb',borderRadius:'12px'}}>
              <div style={{width:'42px',height:'42px',borderRadius:'50%',background:'#e5e7eb',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div>
                <p style={{margin:0,fontWeight:700,fontSize:'15px',color:'#3e3e3e'}}>{cliente.nome}</p>
                <p style={{margin:0,fontSize:'13px',color:'#a0a0a0'}}>{cliente.telefone}</p>
              </div>
            </div>

            {/* Endereços */}
            <div style={{background:'#f9fafb',borderRadius:'12px',padding:'16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
                <p style={{margin:0,fontWeight:700,fontSize:'14px',color:'#3e3e3e'}}>Endereços de Entrega</p>
                <button onClick={() => setShowAddEndereco(true)}
                  style={{display:'flex',alignItems:'center',gap:'4px',background:'none',border:'none',color:accent,fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>
                  + Novo Endereço
                </button>
              </div>
              {enderecos.length === 0 ? (
                <div style={{textAlign:'center',padding:'20px 0'}}>
                  <p style={{margin:'0 0 4px',fontSize:'13px',color:'#a0a0a0'}}>Nenhum endereço cadastrado</p>
                  <button onClick={() => setShowAddEndereco(true)}
                    style={{marginTop:'8px',padding:'10px 20px',background:accent,color:'white',border:'none',borderRadius:'10px',fontWeight:600,fontSize:'13px',cursor:'pointer',fontFamily:'inherit'}}>
                    + Adicionar endereço
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {enderecos.map((e, i) => (
                    <div key={i} style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',padding:'12px',background:'#fff',borderRadius:'10px',border:'1.5px solid #f0f0f0'}}>
                      <div style={{display:'flex',gap:'10px',flex:1,minWidth:0}}>
                        <div style={{width:'32px',height:'32px',borderRadius:'8px',background:`${accent}15`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <div style={{minWidth:0}}>
                          <p style={{margin:0,fontSize:'13px',fontWeight:600,color:'#3e3e3e'}}>{e.rua}, {e.numero}{e.complemento ? ` - ${e.complemento}` : ''}</p>
                          <p style={{margin:'2px 0 0',fontSize:'12px',color:'#a0a0a0'}}>{e.bairro}{e.cidade ? ` · ${e.cidade}` : ''}{e.cep ? ` · ${e.cep}` : ''}</p>
                        </div>
                      </div>
                      <button onClick={() => { const l = enderecos.filter((_,j) => j !== i); salvarEnderecos(cliente.telefone, l) }}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#d1d5db',padding:'4px',flexShrink:0}}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={handleSair}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',padding:'14px',background:'none',border:'1.5px solid #fee2e2',borderRadius:'12px',color:'#dc2626',fontWeight:600,fontSize:'14px',cursor:'pointer',fontFamily:'inherit'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sair da Conta
            </button>
          </div>
        )}
      </div>

      {/* Modal adicionar endereço */}
      {showAddEndereco && (<>
        <div onClick={() => setShowAddEndereco(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:300}} />
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#fff',borderRadius:'24px 24px 0 0',padding:'24px 20px 32px',maxWidth:'480px',margin:'0 auto',maxHeight:'90vh',overflowY:'auto'}}>
          <div style={{width:'36px',height:'4px',background:'#e5e7eb',borderRadius:'4px',margin:'0 auto 20px'}} />
          <button onClick={() => setShowAddEndereco(false)} style={{position:'absolute',top:'16px',right:'16px',background:'none',border:'none',cursor:'pointer',color:'#a0a0a0',fontSize:'20px'}}>✕</button>
          <p style={{margin:'0 0 4px',fontWeight:800,fontSize:'20px',color:'#3e3e3e'}}>Adicionar endereço</p>
          <p style={{margin:'0 0 20px',fontSize:'13px',color:'#a0a0a0'}}>Preencha o endereço para entregas. Você pode buscar pelo CEP.</p>
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <div style={{position:'relative'}}>
              <input value={novoCep} placeholder="CEP (00000-000)" inputMode="numeric"
                onChange={e => {
                  let v = e.target.value.replace(/\D/g,'').slice(0,8)
                  if (v.length > 5) v = v.slice(0,5)+'-'+v.slice(5)
                  setNovoCep(v)
                  if (v.replace(/\D/g,'').length === 8) buscarCepNovo(v)
                }}
                style={{width:'100%',padding:'12px 40px 12px 12px',border:'1.5px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit',background:'#fafafa'}} />
              {cepLoading && <div style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',width:'16px',height:'16px',border:'2px solid #f0f0f0',borderTopColor:accent,borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              {inpField('Rua / Avenida', novoRua, setNovoRua)}
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <input value={novoNumero} onChange={e=>setNovoNumero(e.target.value)} placeholder="Número"
                style={{width:'30%',padding:'12px',border:'1.5px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit',background:'#fafafa'}} />
              <input value={novoComplemento} onChange={e=>setNovoComplemento(e.target.value)} placeholder="Complemento"
                style={{flex:1,padding:'12px',border:'1.5px solid #f0f0f0',borderRadius:'10px',fontSize:'14px',color:'#3e3e3e',outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit',background:'#fafafa'}} />
            </div>
            {inpField('Bairro', novoBairro, setNovoBairro)}
            {inpField('Cidade', novoCidade, setNovoCidade)}
          </div>
          <div style={{display:'flex',gap:'10px',marginTop:'16px'}}>
            <button onClick={() => setShowAddEndereco(false)}
              style={{flex:1,padding:'14px',background:'#f5f5f5',border:'none',borderRadius:'12px',fontWeight:600,fontSize:'14px',color:'#717171',cursor:'pointer',fontFamily:'inherit'}}>
              Cancelar
            </button>
            <button onClick={handleSalvarEndereco}
              style={{flex:2,padding:'14px',background:accent,color:'white',border:'none',borderRadius:'12px',fontWeight:700,fontSize:'14px',cursor:'pointer',fontFamily:'inherit'}}>
              Salvar endereço
            </button>
          </div>
        </div>
      </>)}
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
              {item.produtos?.imagem_url ? <img src={item.produtos.imagem_url} alt={item.nome_produto} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : '🎂'}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:'13px',fontWeight:600,color:'#3e3e3e',whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'}}>{item.nome_produto}</p>
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
        <div style={{textAlign:'right' as const}}>
          <p style={{margin:0,fontSize:'14px',fontWeight:800,color:'#3e3e3e'}}>{formatMoney(p.valor_total)}</p>
          <p style={{margin:0,fontSize:'11px',color:p.status_pagamento==='pago'?'#16a34a':'#f59e0b',fontWeight:600}}>
            {p.status_pagamento === 'pago' ? 'Pago' : 'Pendente'}
          </p>
        </div>
      </div>
    </div>
  )
}
