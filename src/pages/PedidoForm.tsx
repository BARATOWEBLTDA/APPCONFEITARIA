import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

type PedidoItem = {
  id?: string
  produto_id?: string
  nome_produto: string
  quantidade: number
  valor_unitario: number
  desconto: number
  observacoes: string
  personalizacoes: Record<string, string>
}

type Pedido = {
  id?: string
  cliente_id?: string
  cliente_nome: string
  cliente_telefone: string
  cliente_whatsapp: string
  cliente_email: string
  status: string
  prioridade: string
  origem: string
  data_entrega: string
  horario_entrega: string
  tipo_entrega: string
  taxa_entrega: number
  endereco_cep: string
  endereco_rua: string
  endereco_numero: string
  endereco_complemento: string
  endereco_bairro: string
  endereco_cidade: string
  personalizacao_tema: string
  personalizacao_nome: string
  personalizacao_idade: string
  personalizacao_cor: string
  personalizacao_referencia: string
  personalizacao_obs: string
  valor_produtos: number
  desconto: number
  taxa_extra: number
  cupom_codigo: string
  cupom_desconto: number
  valor_total: number
  forma_pagamento: string
  status_pagamento: string
  valor_sinal: number
  data_sinal: string
  valor_recebido: number
  observacoes: string
  etiquetas: string[]
}

const EMPTY_PEDIDO: Pedido = {
  cliente_nome: '', cliente_telefone: '', cliente_whatsapp: '', cliente_email: '',
  status: 'novo', prioridade: 'media', origem: 'manual',
  data_entrega: '', horario_entrega: '', tipo_entrega: 'retirada', taxa_entrega: 0,
  endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '',
  endereco_bairro: '', endereco_cidade: '',
  personalizacao_tema: '', personalizacao_nome: '', personalizacao_idade: '',
  personalizacao_cor: '', personalizacao_referencia: '', personalizacao_obs: '',
  valor_produtos: 0, desconto: 0, taxa_extra: 0, cupom_codigo: '', cupom_desconto: 0,
  valor_total: 0, forma_pagamento: 'pix', status_pagamento: 'pendente',
  valor_sinal: 0, data_sinal: '', valor_recebido: 0, observacoes: '', etiquetas: [],
}

const EMPTY_ITEM: PedidoItem = {
  nome_produto: '', quantidade: 1, valor_unitario: 0,
  desconto: 0, observacoes: '', personalizacoes: {},
}

const ABAS = [
  { key: 'geral',      label: 'Geral',      icon: '📋' },
  { key: 'produtos',   label: 'Produtos',   icon: '🎂' },
  { key: 'financeiro', label: 'Financeiro', icon: '💰' },
  { key: 'entrega',    label: 'Entrega',    icon: '🚚' },
  { key: 'mais',       label: 'Mais',       icon: '⚙️' },
]

const STATUS_OPTIONS = [
  { value: 'novo',                 label: 'Novo' },
  { value: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { value: 'confirmado',           label: 'Confirmado' },
  { value: 'em_producao',          label: 'Em produção' },
  { value: 'pronto',               label: 'Pronto' },
  { value: 'saiu_entrega',         label: 'Saiu para entrega' },
  { value: 'entregue',             label: 'Entregue' },
  { value: 'cancelado',            label: 'Cancelado' },
]

const ETIQUETAS_SUGERIDAS = [
  'URGENTE', 'VIP', 'PIX', 'ENTREGA', 'RETIRADA',
  'ANIVERSÁRIO', 'CASAMENTO', 'TOPPER', 'PAPELARIA',
  'BOLO', 'DOCES', 'KIT FESTA',
]

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PedidoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdicao = !!id && id !== 'novo'

  const [aba, setAba] = useState('geral')
  const [pedido, setPedido] = useState<Pedido>(EMPTY_PEDIDO)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [novoItem, setNovoItem] = useState<PedidoItem>({ ...EMPTY_ITEM })
  const [adicionandoItem, setAdicionandoItem] = useState(false)
  const [showPersonalizacao, setShowPersonalizacao] = useState(false)
  const [showObservacoes, setShowObservacoes] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      carregarDados(user.id)
      if (isEdicao) carregarPedido(user.id)
    })
  }, [id])

  // Recalcula total automaticamente
  useEffect(() => {
    const totalItens = itens.reduce((acc, i) => acc + (i.valor_unitario * i.quantidade - i.desconto), 0)
    const total = totalItens + pedido.taxa_entrega + pedido.taxa_extra - pedido.desconto - pedido.cupom_desconto
    setPedido(p => ({ ...p, valor_produtos: totalItens, valor_total: Math.max(0, total) }))
  }, [itens, pedido.taxa_entrega, pedido.taxa_extra, pedido.desconto, pedido.cupom_desconto])

  const carregarDados = async (uid: string) => {
    const [{ data: cls }, { data: prds }] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,whatsapp').eq('user_id', uid).order('nome'),
      supabase.from('produtos').select('id,nome,preco_normal,forma_venda').eq('user_id', uid).eq('disponivel', true).order('nome'),
    ])
    setClientes(cls || [])
    setProdutos(prds || [])
  }

  const carregarPedido = async (uid: string) => {
    setLoading(true)
    const [{ data: ped }, { data: its }] = await Promise.all([
      supabase.from('pedidos').select('*').eq('id', id).eq('user_id', uid).single(),
      supabase.from('pedido_itens').select('*').eq('pedido_id', id),
    ])
    if (ped) setPedido(ped)
    if (its) setItens(its)
    setLoading(false)
  }

  const set = (field: keyof Pedido, value: any) => setPedido(p => ({ ...p, [field]: value }))

  const selecionarCliente = (c: any) => {
    setPedido(p => ({
      ...p,
      cliente_id: c.id,
      cliente_nome: c.nome,
      cliente_telefone: c.telefone || '',
      cliente_whatsapp: c.whatsapp || c.telefone || '',
    }))
    setBuscaCliente(c.nome)
    setShowClienteDropdown(false)
  }

  const toggleEtiqueta = (e: string) => {
    const atual = pedido.etiquetas || []
    setPedido(p => ({
      ...p,
      etiquetas: atual.includes(e) ? atual.filter(x => x !== e) : [...atual, e]
    }))
  }

  const adicionarItem = () => {
    if (!novoItem.nome_produto) return
    setItens(prev => [...prev, { ...novoItem }])
    setNovoItem({ ...EMPTY_ITEM })
    setAdicionandoItem(false)
  }

  const removerItem = (idx: number) => {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  const selecionarProduto = (p: any) => {
    setNovoItem(prev => ({
      ...prev,
      produto_id: p.id,
      nome_produto: p.nome,
      valor_unitario: p.preco_normal || 0,
    }))
  }

  const salvar = async () => {
    if (!pedido.cliente_nome) { setAba('geral'); showToast('Informe o nome do cliente'); return }
    if (!pedido.data_entrega) { setAba('geral'); showToast('Informe a data de entrega'); return }

    setSaving(true)
    try {
      const payload = { ...pedido, user_id: userId }

      let pedidoId = id
      if (isEdicao) {
        await supabase.from('pedidos').update(payload).eq('id', id)
      } else {
        const { data } = await supabase.from('pedidos').insert(payload).select('id').single()
        pedidoId = data?.id

        // Registra histórico de criação
        if (pedidoId) {
          await supabase.from('pedido_historico').insert({
            pedido_id: pedidoId,
            user_id: userId,
            evento: 'Pedido criado',
            descricao: `Pedido criado manualmente`,
          })
        }
      }

      // Salva itens
      if (pedidoId && itens.length > 0) {
        await supabase.from('pedido_itens').delete().eq('pedido_id', pedidoId)
        await supabase.from('pedido_itens').insert(
          itens.map(item => ({ ...item, pedido_id: pedidoId, user_id: userId }))
        )
      }

      navigate('/pedidos')
    } catch {
      showToast('Erro ao salvar pedido. Tente novamente.')
    }
    setSaving(false)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const clientesFiltrados = buscaCliente.length >= 3
    ? clientes.filter(c => c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()))
    : []

  const formatTelefone = (tel: string) => {
    if (!tel) return ''
    const digits = tel.replace(/\D/g, '').slice(0, 11)
    if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`
    if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
    if (digits.length > 6) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
    if (digits.length > 2) return `(${digits.slice(0,2)}) ${digits.slice(2)}`
    return digits
  }

  const handleTelefone = (value: string, field: 'cliente_telefone' | 'cliente_whatsapp') => {
    set(field, formatTelefone(value))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="pf-spinner" />
    </div>
  )

  return (
    <div className="pf-root">

      {/* ── Header ── */}
      <div className="pf-header">
        <button className="pf-back" onClick={() => navigate('/pedidos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Pedidos
        </button>
        <h1 className="pf-title">{isEdicao ? 'Editar pedido' : 'Novo pedido'}</h1>
        <button className="pf-btn-salvar" onClick={salvar} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* ── Abas ── */}
      <div className="pf-abas">
        {ABAS.map(a => (
          <button
            key={a.key}
            className={`pf-aba${aba === a.key ? ' ativa' : ''}`}
            onClick={() => setAba(a.key)}
          >
            <span className="pf-aba-icon">{a.icon}</span>
            <span className="pf-aba-label">{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── Conteúdo ── */}
      <div className="pf-content">

        {/* ─── ABA GERAL ─── */}
        {aba === 'geral' && (
          <div className="pf-section-list">

            <div className="pf-card">
              <h3 className="pf-card-title">Cliente</h3>

              <div className="pf-field" style={{ position: 'relative' }}>
                <label className="pf-label">Nome do cliente *</label>
                <input
                  className="pf-input"
                  placeholder="Buscar pelo nome (mín. 3 letras)..."
                  value={buscaCliente || pedido.cliente_nome}
                  onChange={e => {
                    const val = e.target.value
                    setBuscaCliente(val)
                    set('cliente_nome', val)
                    setShowClienteDropdown(val.length >= 3)
                  }}
                  onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)}
                />
                {showClienteDropdown && clientesFiltrados.length > 0 && (
                  <div className="pf-dropdown">
                    {clientesFiltrados.slice(0, 5).map(c => (
                      <button key={c.id} className="pf-dropdown-item" onClick={() => selecionarCliente(c)}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-title,#1F2937)' }}>{c.nome}</span>
                        {(c.telefone || c.whatsapp) && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#9CA3AF)', marginTop: '1px' }}>
                            {formatTelefone(c.telefone || c.whatsapp)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pf-row2" style={{ marginTop: '0.75rem' }}>
                <div className="pf-field">
                  <label className="pf-label">Telefone</label>
                  <input
                    className="pf-input"
                    placeholder="(41) 9 9929-1790"
                    value={pedido.cliente_telefone}
                    onChange={e => handleTelefone(e.target.value, 'cliente_telefone')}
                    inputMode="numeric"
                    maxLength={16}
                  />
                </div>
                <div className="pf-field">
                  <label className="pf-label">WhatsApp</label>
                  <input
                    className="pf-input"
                    placeholder="(41) 9 9929-1790"
                    value={pedido.cliente_whatsapp}
                    onChange={e => handleTelefone(e.target.value, 'cliente_whatsapp')}
                    inputMode="numeric"
                    maxLength={16}
                  />
                </div>
              </div>
            </div>

            <div className="pf-card">
              <h3 className="pf-card-title">Datas e Status</h3>
              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Data de entrega *</label>
                  <input className="pf-input" type="date" value={pedido.data_entrega} onChange={e => set('data_entrega', e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Horário</label>
                  <input className="pf-input" type="time" value={pedido.horario_entrega} onChange={e => set('horario_entrega', e.target.value)} />
                </div>
              </div>
              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Status</label>
                  <select className="pf-input" value={pedido.status} onChange={e => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Prioridade</label>
                  <select className="pf-input" value={pedido.prioridade} onChange={e => set('prioridade', e.target.value)}>
                    <option value="baixa">↓ Baixa</option>
                    <option value="media">→ Média</option>
                    <option value="alta">↑ Alta</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pf-card pf-card-toggle">
              <button
                className={`pf-toggle-btn${showPersonalizacao ? ' ativo' : ''}`}
                onClick={() => {
                  if (showPersonalizacao) {
                    set('personalizacao_tema', '')
                    set('personalizacao_nome', '')
                    set('personalizacao_idade', '')
                    set('personalizacao_cor', '')
                    set('personalizacao_obs', '')
                  }
                  setShowPersonalizacao(v => !v)
                }}
              >
                <span className="pf-toggle-icon">
                  {showPersonalizacao ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  )}
                </span>
                <span>Personalização</span>
                {(pedido.personalizacao_tema || pedido.personalizacao_nome) && !showPersonalizacao && (
                  <span className="pf-toggle-badge">preenchida</span>
                )}
              </button>

              {showPersonalizacao && (
                <div className="pf-toggle-content">
                  <div className="pf-row2">
                    <div className="pf-field">
                      <label className="pf-label">Tema</label>
                      <input className="pf-input" placeholder="Ex: Fazendinha, Frozen..." value={pedido.personalizacao_tema} onChange={e => set('personalizacao_tema', e.target.value)} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Nome no bolo</label>
                      <input className="pf-input" placeholder="Ex: Maria" value={pedido.personalizacao_nome} onChange={e => set('personalizacao_nome', e.target.value)} />
                    </div>
                  </div>
                  <div className="pf-row2">
                    <div className="pf-field">
                      <label className="pf-label">Idade</label>
                      <input className="pf-input" placeholder="Ex: 5 anos" value={pedido.personalizacao_idade} onChange={e => set('personalizacao_idade', e.target.value)} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Cor principal</label>
                      <input className="pf-input" placeholder="Ex: Rosa e dourado" value={pedido.personalizacao_cor} onChange={e => set('personalizacao_cor', e.target.value)} />
                    </div>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Observações de personalização</label>
                    <textarea className="pf-textarea" placeholder="Detalhes extras sobre a decoração..." value={pedido.personalizacao_obs} onChange={e => set('personalizacao_obs', e.target.value)} rows={3} />
                  </div>
                </div>
              )}
            </div>

            <div className="pf-card pf-card-toggle">
              <button
                className={`pf-toggle-btn${showObservacoes ? ' ativo' : ''}`}
                onClick={() => {
                  if (showObservacoes) set('observacoes', '')
                  setShowObservacoes(v => !v)
                }}
              >
                <span className="pf-toggle-icon">
                  {showObservacoes ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  )}
                </span>
                <span>Observações gerais</span>
                {pedido.observacoes && !showObservacoes && (
                  <span className="pf-toggle-badge">preenchida</span>
                )}
              </button>

              {showObservacoes && (
                <div className="pf-toggle-content">
                  <textarea className="pf-textarea" placeholder="Anotações sobre o pedido..." value={pedido.observacoes} onChange={e => set('observacoes', e.target.value)} rows={4} />
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─── ABA PRODUTOS ─── */}
        {aba === 'produtos' && (
          <div className="pf-section-list">
            <div className="pf-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 className="pf-card-title" style={{ margin: 0 }}>Itens do pedido</h3>
                <button className="pf-btn-add" onClick={() => setAdicionandoItem(true)}>+ Adicionar</button>
              </div>

              {itens.length === 0 && !adicionandoItem && (
                <div className="pf-empty-items">
                  <p>Nenhum produto adicionado</p>
                  <button className="pf-btn-add" onClick={() => setAdicionandoItem(true)}>Adicionar produto</button>
                </div>
              )}

              {itens.map((item, idx) => (
                <div key={idx} className="pf-item-card">
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-title,#1F2937)' }}>{item.nome_produto}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted,#9CA3AF)' }}>
                      {item.quantidade}x {formatMoney(item.valor_unitario)}
                      {item.desconto > 0 && ` — desc. ${formatMoney(item.desconto)}`}
                    </p>
                    {item.observacoes && <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary,#6B7280)' }}>{item.observacoes}</p>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-title,#1F2937)' }}>
                      {formatMoney(item.valor_unitario * item.quantidade - item.desconto)}
                    </span>
                    <button className="pf-btn-remove" onClick={() => removerItem(idx)}>✕</button>
                  </div>
                </div>
              ))}

              {adicionandoItem && (
                <div className="pf-add-item-form">
                  <div className="pf-field">
                    <label className="pf-label">Produto</label>
                    <select className="pf-input" value={novoItem.produto_id || ''} onChange={e => {
                      const prod = produtos.find(p => p.id === e.target.value)
                      if (prod) selecionarProduto(prod)
                    }}>
                      <option value="">Selecionar produto cadastrado...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome} — {formatMoney(p.preco_normal)}</option>)}
                    </select>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Nome (ou descreva manualmente)</label>
                    <input className="pf-input" placeholder="Ex: Bolo Red Velvet 2kg" value={novoItem.nome_produto} onChange={e => setNovoItem(p => ({ ...p, nome_produto: e.target.value }))} />
                  </div>
                  <div className="pf-row3">
                    <div className="pf-field">
                      <label className="pf-label">Qtd</label>
                      <input className="pf-input" type="number" min="0.1" step="0.1" value={novoItem.quantidade} onChange={e => setNovoItem(p => ({ ...p, quantidade: Number(e.target.value) }))} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Valor unit.</label>
                      <input className="pf-input" type="number" min="0" step="0.01" value={novoItem.valor_unitario} onChange={e => setNovoItem(p => ({ ...p, valor_unitario: Number(e.target.value) }))} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Desconto</label>
                      <input className="pf-input" type="number" min="0" step="0.01" value={novoItem.desconto} onChange={e => setNovoItem(p => ({ ...p, desconto: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Observações do item</label>
                    <input className="pf-input" placeholder="Ex: Chantininho, Nome Ana, Topo floral..." value={novoItem.observacoes} onChange={e => setNovoItem(p => ({ ...p, observacoes: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="pf-btn-salvar" onClick={adicionarItem}>Adicionar</button>
                    <button className="pf-btn-cancel" onClick={() => { setAdicionandoItem(false); setNovoItem({ ...EMPTY_ITEM }) }}>Cancelar</button>
                  </div>
                </div>
              )}

              {itens.length > 0 && (
                <div className="pf-item-total">
                  <span>Total dos produtos</span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(pedido.valor_produtos)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── ABA FINANCEIRO ─── */}
        {aba === 'financeiro' && (
          <div className="pf-section-list">
            <div className="pf-card">
              <h3 className="pf-card-title">Valores</h3>
              <div className="pf-resumo-fin">
                <div className="pf-fin-row"><span>Produtos</span><span>{formatMoney(pedido.valor_produtos)}</span></div>
                <div className="pf-fin-row"><span>Taxa de entrega</span><span>{formatMoney(pedido.taxa_entrega)}</span></div>
                {pedido.taxa_extra > 0 && <div className="pf-fin-row"><span>Taxa extra</span><span>{formatMoney(pedido.taxa_extra)}</span></div>}
                {pedido.desconto > 0 && <div className="pf-fin-row" style={{ color: '#16a34a' }}><span>Desconto</span><span>- {formatMoney(pedido.desconto)}</span></div>}
                {pedido.cupom_desconto > 0 && <div className="pf-fin-row" style={{ color: '#16a34a' }}><span>Cupom {pedido.cupom_codigo}</span><span>- {formatMoney(pedido.cupom_desconto)}</span></div>}
                <div className="pf-fin-row pf-fin-total"><span>Total</span><span>{formatMoney(pedido.valor_total)}</span></div>
              </div>

              <div className="pf-row2" style={{ marginTop: '1rem' }}>
                <div className="pf-field">
                  <label className="pf-label">Desconto (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.desconto} onChange={e => set('desconto', Number(e.target.value))} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Taxa extra (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.taxa_extra} onChange={e => set('taxa_extra', Number(e.target.value))} />
                </div>
              </div>

              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Cupom</label>
                  <input className="pf-input" placeholder="Código do cupom" value={pedido.cupom_codigo} onChange={e => set('cupom_codigo', e.target.value)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Desconto cupom (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.cupom_desconto} onChange={e => set('cupom_desconto', Number(e.target.value))} />
                </div>
              </div>
            </div>

            <div className="pf-card">
              <h3 className="pf-card-title">Pagamento</h3>
              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Forma de pagamento</label>
                  <select className="pf-input" value={pedido.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)}>
                    <option value="pix">PIX</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="credito">Cartão de crédito</option>
                    <option value="debito">Cartão de débito</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Status do pagamento</label>
                  <select className="pf-input" value={pedido.status_pagamento} onChange={e => set('status_pagamento', e.target.value)}>
                    <option value="pendente">Pendente</option>
                    <option value="parcial">Parcial</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>

              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Sinal recebido (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.valor_sinal} onChange={e => set('valor_sinal', Number(e.target.value))} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Data do sinal</label>
                  <input className="pf-input" type="date" value={pedido.data_sinal} onChange={e => set('data_sinal', e.target.value)} />
                </div>
              </div>

              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Valor recebido (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.valor_recebido} onChange={e => set('valor_recebido', Number(e.target.value))} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Valor restante</label>
                  <div className="pf-input pf-input-readonly">
                    {formatMoney(Math.max(0, pedido.valor_total - pedido.valor_recebido))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── ABA ENTREGA ─── */}
        {aba === 'entrega' && (
          <div className="pf-section-list">
            <div className="pf-card">
              <h3 className="pf-card-title">Tipo de entrega</h3>
              <div className="pf-tipo-entrega">
                {[
                  { value: 'retirada', label: 'Retirada', icon: '🏪' },
                  { value: 'entrega',  label: 'Entrega',  icon: '🛵' },
                  { value: 'local',    label: 'No local', icon: '📍' },
                ].map(t => (
                  <button
                    key={t.value}
                    className={`pf-tipo-btn${pedido.tipo_entrega === t.value ? ' ativo' : ''}`}
                    onClick={() => set('tipo_entrega', t.value)}
                  >
                    <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {pedido.tipo_entrega === 'entrega' && (
              <div className="pf-card">
                <h3 className="pf-card-title">Endereço de entrega</h3>
                <div className="pf-row2">
                  <div className="pf-field">
                    <label className="pf-label">CEP</label>
                    <input className="pf-input" placeholder="00000-000" value={pedido.endereco_cep} onChange={e => set('endereco_cep', e.target.value)} />
                  </div>
                  <div className="pf-field" style={{ flex: 2 }}>
                    <label className="pf-label">Rua / Avenida</label>
                    <input className="pf-input" placeholder="Rua..." value={pedido.endereco_rua} onChange={e => set('endereco_rua', e.target.value)} />
                  </div>
                </div>
                <div className="pf-row2">
                  <div className="pf-field">
                    <label className="pf-label">Número</label>
                    <input className="pf-input" placeholder="Nº" value={pedido.endereco_numero} onChange={e => set('endereco_numero', e.target.value)} />
                  </div>
                  <div className="pf-field" style={{ flex: 2 }}>
                    <label className="pf-label">Complemento</label>
                    <input className="pf-input" placeholder="Apto, bloco..." value={pedido.endereco_complemento} onChange={e => set('endereco_complemento', e.target.value)} />
                  </div>
                </div>
                <div className="pf-row2">
                  <div className="pf-field">
                    <label className="pf-label">Bairro</label>
                    <input className="pf-input" value={pedido.endereco_bairro} onChange={e => set('endereco_bairro', e.target.value)} />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Cidade</label>
                    <input className="pf-input" value={pedido.endereco_cidade} onChange={e => set('endereco_cidade', e.target.value)} />
                  </div>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Taxa de entrega (R$)</label>
                  <input className="pf-input" type="number" min="0" step="0.01" value={pedido.taxa_entrega} onChange={e => set('taxa_entrega', Number(e.target.value))} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ABA MAIS ─── */}
        {aba === 'mais' && (
          <div className="pf-section-list">
            <div className="pf-card">
              <h3 className="pf-card-title">Etiquetas</h3>
              <div className="pf-etiquetas">
                {ETIQUETAS_SUGERIDAS.map(e => (
                  <button
                    key={e}
                    className={`pf-etiqueta-btn${(pedido.etiquetas || []).includes(e) ? ' ativa' : ''}`}
                    onClick={() => toggleEtiqueta(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="pf-card">
              <h3 className="pf-card-title">Produção</h3>
              <div className="pf-row2">
                <div className="pf-field">
                  <label className="pf-label">Status de produção</label>
                  <select className="pf-input" value={pedido.status || 'nao_iniciado'} onChange={e => set('status', e.target.value)}>
                    <option value="nao_iniciado">Não iniciado</option>
                    <option value="em_producao">Em produção</option>
                    <option value="pronto">Finalizado</option>
                  </select>
                </div>
                <div className="pf-field">
                  <label className="pf-label">Responsável</label>
                  <input className="pf-input" placeholder="Nome da responsável" value={pedido.observacoes} onChange={e => set('observacoes', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="pf-card">
              <h3 className="pf-card-title">Origem do pedido</h3>
              <div className="pf-tipo-entrega">
                {[
                  { value: 'manual',   label: 'Manual',          icon: '✏️' },
                  { value: 'cardapio', label: 'Cardápio Digital', icon: '📱' },
                  { value: 'whatsapp', label: 'WhatsApp',         icon: '💬' },
                  { value: 'instagram',label: 'Instagram',        icon: '📸' },
                ].map(o => (
                  <button
                    key={o.value}
                    className={`pf-tipo-btn${pedido.origem === o.value ? ' ativo' : ''}`}
                    onClick={() => set('origem', o.value)}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{o.icon}</span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Botão salvar mobile ── */}
      <div className="pf-footer-mobile">
        <button className="pf-btn-salvar pf-btn-full" onClick={salvar} disabled={saving}>
          {saving ? 'Salvando...' : isEdicao ? 'Salvar alterações' : 'Criar pedido'}
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && <div className="pf-toast">{toast}</div>}

      <style>{`
        .pf-root { font-family: 'Geist', sans-serif; display: flex; flex-direction: column; gap: 1rem; padding-bottom: 5rem; }

        .pf-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
        .pf-back { display: flex; align-items: center; gap: 0.3rem; background: none; border: none; cursor: pointer; font-size: 0.85rem; color: var(--text-secondary,#6B7280); font-family: 'Geist', sans-serif; padding: 0; }
        .pf-back:hover { color: var(--primary,#FF6FA9); }
        .pf-title { flex: 1; font-size: 1.3rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0; }
        .pf-btn-salvar { background: var(--primary,#FF6FA9); color: white; border: none; border-radius: 10px; padding: 0.6rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: 'Geist', sans-serif; white-space: nowrap; transition: opacity 0.15s; }
        .pf-btn-salvar:hover { opacity: 0.88; }
        .pf-btn-salvar:disabled { opacity: 0.6; cursor: not-allowed; }
        .pf-btn-full { width: 100%; padding: 0.85rem; font-size: 0.95rem; border-radius: 14px; }
        .pf-btn-cancel { background: var(--bg-body,#F7F7F8); color: var(--text-secondary,#6B7280); border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; padding: 0.6rem 1.2rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: 'Geist', sans-serif; }

        .pf-abas { display: flex; gap: 0; overflow-x: auto; background: var(--bg-card,#fff); border: 1.5px solid var(--border,#E9E9EE); border-radius: 12px; padding: 4px; scrollbar-width: none; }
        .pf-abas::-webkit-scrollbar { display: none; }
        .pf-aba { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: none; border-radius: 8px; padding: 0.5rem 0.25rem; cursor: pointer; font-family: 'Geist', sans-serif; transition: background 0.15s; min-width: 60px; white-space: nowrap; }
        .pf-aba.ativa { background: var(--primary,#FF6FA9); }
        .pf-aba-icon { font-size: 1rem; }
        .pf-aba-label { font-size: 0.68rem; font-weight: 600; color: var(--text-secondary,#6B7280); white-space: nowrap; }
        .pf-aba.ativa .pf-aba-label { color: white; }

        .pf-content { display: flex; flex-direction: column; }
        .pf-section-list { display: flex; flex-direction: column; gap: 0.85rem; }

        .pf-card { background: var(--bg-card,#fff); border: 1.5px solid var(--border,#E9E9EE); border-radius: 14px; padding: 1.1rem; }
        .pf-card-title { font-size: 0.88rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0 0 0.85rem; }

        .pf-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
        .pf-label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary,#6B7280); }
        .pf-input { border: 1.5px solid var(--border,#E9E9EE); border-radius: 8px; padding: 0.55rem 0.75rem; font-size: 0.85rem; font-family: 'Geist', sans-serif; color: var(--text-primary,#1F2937); background: var(--bg-body,#FAFAFA); outline: none; width: 100%; transition: border-color 0.15s; }
        .pf-input:focus { border-color: var(--primary,#FF6FA9); }
        .pf-input-readonly { display: flex; align-items: center; font-weight: 700; color: var(--text-title,#1F2937); background: var(--bg-body,#F7F7F8); cursor: default; }
        .pf-textarea { border: 1.5px solid var(--border,#E9E9EE); border-radius: 8px; padding: 0.55rem 0.75rem; font-size: 0.85rem; font-family: 'Geist', sans-serif; color: var(--text-primary,#1F2937); background: var(--bg-body,#FAFAFA); outline: none; width: 100%; resize: vertical; transition: border-color 0.15s; }
        .pf-textarea:focus { border-color: var(--primary,#FF6FA9); }
        .pf-row2 { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
        .pf-row3 { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }

        .pf-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card,#fff); border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.1); margin-top: 2px; overflow: hidden; }
        .pf-dropdown-item { width: 100%; display: flex; flex-direction: column; align-items: flex-start; padding: 0.6rem 0.85rem; background: none; border: none; border-bottom: 1px solid var(--border,#E9E9EE); cursor: pointer; font-family: 'Geist', sans-serif; transition: background 0.1s; text-align: left; }
        .pf-dropdown-item:last-child { border-bottom: none; }
        .pf-dropdown-item:hover { background: var(--bg-body,#F7F7F8); }

        .pf-tipo-entrega { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.6rem; }
        .pf-tipo-btn { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; background: var(--bg-body,#F7F7F8); border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; padding: 0.75rem 0.5rem; cursor: pointer; font-family: 'Geist', sans-serif; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary,#6B7280); transition: all 0.15s; }
        .pf-tipo-btn.ativo { background: var(--primary-light,#FFF1F7); border-color: var(--primary,#FF6FA9); color: var(--primary,#FF6FA9); }

        .pf-item-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-body,#F7F7F8); border-radius: 10px; margin-bottom: 0.5rem; }
        .pf-btn-remove { background: none; border: none; cursor: pointer; color: var(--text-muted,#9CA3AF); font-size: 0.85rem; padding: 4px; border-radius: 6px; transition: color 0.15s; }
        .pf-btn-remove:hover { color: #ef4444; }
        .pf-btn-add { background: none; border: 1.5px solid var(--primary,#FF6FA9); border-radius: 8px; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: var(--primary,#FF6FA9); cursor: pointer; font-family: 'Geist', sans-serif; white-space: nowrap; }
        .pf-empty-items { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem 0; }
        .pf-empty-items p { color: var(--text-muted,#9CA3AF); font-size: 0.85rem; margin: 0; }
        .pf-add-item-form { background: var(--bg-body,#F7F7F8); border-radius: 10px; padding: 0.85rem; margin-top: 0.5rem; }
        .pf-item-total { display: flex; justify-content: space-between; padding: 0.75rem 0 0; border-top: 1.5px solid var(--border,#E9E9EE); margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary,#6B7280); }

        .pf-resumo-fin { background: var(--bg-body,#F7F7F8); border-radius: 10px; padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .pf-fin-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary,#6B7280); }
        .pf-fin-total { font-size: 1rem; font-weight: 700; color: var(--text-title,#1F2937); padding-top: 0.5rem; border-top: 1.5px solid var(--border,#E9E9EE); margin-top: 0.25rem; }

        .pf-etiquetas { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .pf-etiqueta-btn { background: var(--bg-body,#F7F7F8); border: 1.5px solid var(--border,#E9E9EE); border-radius: 20px; padding: 0.3rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary,#6B7280); cursor: pointer; font-family: 'Geist', sans-serif; transition: all 0.15s; }
        .pf-etiqueta-btn.ativa { background: var(--primary-light,#FFF1F7); border-color: var(--primary,#FF6FA9); color: var(--primary,#FF6FA9); }

        .pf-card-toggle { padding: 0; overflow: hidden; }
        .pf-toggle-btn {
          width: 100%; display: flex; align-items: center; gap: 0.5rem;
          background: none; border: none; cursor: pointer;
          padding: 0.9rem 1.1rem; font-family: 'Geist', sans-serif;
          font-size: 0.88rem; font-weight: 600; color: var(--text-secondary,#6B7280);
          transition: color 0.15s;
        }
        .pf-toggle-btn:hover { color: var(--primary,#FF6FA9); }
        .pf-toggle-btn.ativo { color: var(--text-title,#1F2937); }
        .pf-toggle-icon {
          width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
          background: var(--bg-body,#F7F7F8); border: 1.5px solid var(--border,#E9E9EE);
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s, border-color 0.15s;
        }
        .pf-toggle-btn.ativo .pf-toggle-icon {
          background: var(--primary-light,#FFF1F7);
          border-color: var(--primary,#FF6FA9);
          color: var(--primary,#FF6FA9);
        }
        .pf-toggle-badge {
          margin-left: auto; font-size: 0.68rem; font-weight: 600;
          background: var(--primary-light,#FFF1F7); color: var(--primary,#FF6FA9);
          padding: 2px 8px; border-radius: 10px;
        }
        .pf-toggle-content {
          padding: 0 1.1rem 1.1rem;
          animation: pfExpandIn 0.18s ease;
        }
        @keyframes pfExpandIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pf-footer-mobile { position: fixed; bottom: 0; left: 0; right: 0; padding: 0.75rem 1rem; background: var(--bg-card,#fff); border-top: 1px solid var(--border,#E9E9EE); z-index: 50; }
        @media (min-width: 768px) { .pf-footer-mobile { display: none; } }

        .pf-toast { position: fixed; bottom: 5rem; left: 50%; transform: translateX(-50%); background: #1F2937; color: white; padding: 0.65rem 1.25rem; border-radius: 10px; font-size: 0.83rem; font-family: 'Geist', sans-serif; z-index: 300; white-space: nowrap; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }

        .pf-spinner { width: 32px; height: 32px; border: 3px solid var(--primary-light,#FFF1F7); border-top-color: var(--primary,#FF6FA9); border-radius: 50%; animation: pfSpin 0.7s linear infinite; }
        @keyframes pfSpin { to { transform: rotate(360deg); } }

        @media (max-width: 640px) {
          .pf-row2 { flex-direction: column; gap: 0.5rem; }
          .pf-row3 { flex-direction: row; }
          .pf-tipo-entrega { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>
    </div>
  )
}
