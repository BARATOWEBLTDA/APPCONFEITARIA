import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DatePickerField } from '@/components/DatePickerField'
import { TimePickerField } from '@/components/TimePickerField'
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
  responsavel_entrega: string
  responsavel_producao: string
  data_prevista_producao: string
  status_producao: string
  checklist_producao: any[]
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
  responsavel_entrega: '', responsavel_producao: '', data_prevista_producao: '',
  status_producao: 'nao_iniciado', checklist_producao: [],
  valor_total: 0, forma_pagamento: 'pix', status_pagamento: 'pendente',
  valor_sinal: 0, data_sinal: '', valor_recebido: 0, observacoes: '', etiquetas: [],
}

const EMPTY_ITEM: PedidoItem = {
  nome_produto: '', quantidade: 1, valor_unitario: 0,
  desconto: 0, observacoes: '', personalizacoes: {},
}

const STATUS_OPTIONS = [
  { value: 'novo',        label: 'Novo',        color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'em_producao', label: 'Em produção', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { value: 'pronto',      label: 'Finalizado',  color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  { value: 'cancelado',   label: 'Cancelado',   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
]

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo', em_producao: 'Em produção', pronto: 'Finalizado', cancelado: 'Cancelado',
  aguardando_pagamento: 'Aguardando', confirmado: 'Confirmado',
  saiu_entrega: 'Saiu p/ entrega', entregue: 'Entregue',
}

const ETIQUETAS_SUGERIDAS = [
  'URGENTE', 'VIP', 'PIX', 'ENTREGA', 'RETIRADA',
  'ANIVERSÁRIO', 'CASAMENTO', 'TOPPER', 'PAPELARIA',
  'BOLO', 'DOCES', 'KIT FESTA',
]

const COMO_CONHECEU = ['Instagram', 'Indicação', 'Google', 'Facebook', 'TikTok', 'Outro']

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PedidoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdicao = !!id && id !== 'novo'

  const [pedido, setPedido] = useState<Pedido>(EMPTY_PEDIDO)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState('')
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [comoConheceu, setComoConheceu] = useState('')
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
    const totalItens = itens.reduce((acc, i) => acc + (i.valor_unitario * i.quantidade), 0)
    const total = totalItens + pedido.taxa_entrega + pedido.taxa_extra - pedido.desconto - pedido.cupom_desconto
    setPedido(p => ({ ...p, valor_produtos: totalItens, valor_total: Math.max(0, total) }))
  }, [itens, pedido.taxa_entrega, pedido.taxa_extra, pedido.desconto, pedido.cupom_desconto])

  const carregarDados = async (uid: string) => {
    const [{ data: cls }, { data: prds }] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,whatsapp,como_conheceu').eq('user_id', uid).order('nome'),
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
    if (ped) {
      setPedido(ped)
      if (ped.cliente_id) {
        const { data: cli } = await supabase.from('clientes').select('como_conheceu').eq('id', ped.cliente_id).single()
        setComoConheceu(cli?.como_conheceu || '')
      }
    }
    if (its) setItens(its)
    setLoading(false)
  }

  const set = (field: keyof Pedido, value: any) => setPedido(p => ({ ...p, [field]: value }))

  const selecionarCliente = (c: any) => {
    setPedido(p => ({
      ...p,
      cliente_id: c.id,
      cliente_nome: c.nome,
      cliente_telefone: formatTelefone(c.telefone || ''),
      cliente_whatsapp: formatTelefone(c.whatsapp || c.telefone || ''),
    }))
    setComoConheceu(c.como_conheceu || '')
    setBuscaCliente(c.nome)
    setShowClienteDropdown(false)
  }

  const cadastrarNovoCliente = async () => {
    if (!buscaCliente.trim()) return
    const { data, error } = await supabase.from('clientes').insert({
      user_id: userId,
      nome: buscaCliente.trim(),
      telefone: pedido.cliente_telefone || null,
      whatsapp: pedido.cliente_whatsapp || null,
      como_conheceu: comoConheceu || null,
    }).select('id,nome,telefone,whatsapp,como_conheceu').single()

    if (!error && data) {
      selecionarCliente(data)
      setClientes(prev => [...prev, data])
      showToast(`Cliente "${data.nome}" cadastrado com sucesso!`)
    } else {
      showToast('Erro ao cadastrar cliente. Tente novamente.')
    }
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
    if (!pedido.cliente_nome) { showToast('Informe o nome do cliente'); return }
    if (itens.length === 0) { showToast('Adicione pelo menos um item ao pedido'); return }
    if (!pedido.data_entrega) { showToast('Informe a data de entrega'); return }

    setSaving(true)
    try {
      // Monta payload sem campos undefined, id vazio ou campos que o banco gera automaticamente
      const { id: _id, numero: _numero, ...pedidoSemId } = pedido as any
      const payload = {
        ...pedidoSemId,
        user_id: userId,
        // garante tipos corretos
        taxa_entrega: pedido.taxa_entrega || 0,
        taxa_extra: pedido.taxa_extra || 0,
        desconto: pedido.desconto || 0,
        cupom_desconto: pedido.cupom_desconto || 0,
        valor_produtos: pedido.valor_produtos || 0,
        valor_total: pedido.valor_total || 0,
        valor_sinal: pedido.valor_sinal || 0,
        valor_recebido: pedido.valor_recebido || 0,
        // campos opcionais — null em vez de string vazia
        cliente_id: pedido.cliente_id || null,
        horario_entrega: pedido.horario_entrega || null,
        data_sinal: pedido.data_sinal || null,
        cupom_codigo: pedido.cupom_codigo || null,
        endereco_cep: pedido.endereco_cep || null,
        endereco_rua: pedido.endereco_rua || null,
        endereco_numero: pedido.endereco_numero || null,
        endereco_complemento: pedido.endereco_complemento || null,
        endereco_bairro: pedido.endereco_bairro || null,
        endereco_cidade: pedido.endereco_cidade || null,
        personalizacao_tema: pedido.personalizacao_tema || null,
        personalizacao_nome: pedido.personalizacao_nome || null,
        personalizacao_idade: pedido.personalizacao_idade || null,
        personalizacao_cor: pedido.personalizacao_cor || null,
        personalizacao_referencia: pedido.personalizacao_referencia || null,
        personalizacao_obs: pedido.personalizacao_obs || null,
        responsavel_entrega: pedido.responsavel_entrega || null,
        responsavel_producao: pedido.responsavel_producao || null,
        data_prevista_producao: pedido.data_prevista_producao || null,
        observacoes: pedido.observacoes || null,
      }

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

      // Atualiza "como nos conheceu" no cadastro do cliente
      if (pedido.cliente_id) {
        await supabase.from('clientes').update({ como_conheceu: comoConheceu || null }).eq('id', pedido.cliente_id)
      }

      navigate('/pedidos')
    } catch {
      showToast('Erro ao salvar pedido. Tente novamente.')
    }
    setSaving(false)
  }

  const salvarEIniciarOutro = async () => {
    await salvar()
    navigate('/pedidos/novo')
  }

  const abrirWhatsApp = () => {
    const tel = (pedido.cliente_whatsapp || pedido.cliente_telefone || '').replace(/\D/g, '')
    if (!tel) { showToast('WhatsApp não informado'); return }
    window.open(`https://wa.me/55${tel}`, '_blank')
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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!isEdicao && (
            <button
              onClick={salvarEIniciarOutro}
              disabled={saving}
              style={{
                padding: '0.6rem 1rem', fontSize: '0.82rem', fontWeight: 600,
                border: '1.5px solid var(--primary,#FF6FA9)', borderRadius: '10px',
                background: 'white', color: 'var(--primary,#FF6FA9)',
                cursor: 'pointer', fontFamily: 'Geist, sans-serif', whiteSpace: 'nowrap',
              }}
            >
              Salvar e iniciar outro
            </button>
          )}
          <button className="pf-btn-salvar" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar pedido'}
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="pf-content">
        <div className="pf-section-list">

          {/* ── Bloco Cliente ── */}
          <div className="pf-card">
            <h3 className="pf-card-title">Cliente</h3>

            <div className="pf-row2">
              <div className="pf-field" style={{ position: 'relative', flex: 2 }}>
                <label className="pf-label">Nome do cliente<span className="pf-required-badge">Obrigatório</span></label>
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
                {showClienteDropdown && (clientesFiltrados.length > 0 || buscaCliente.length >= 3) && (
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
                    {clientesFiltrados.length === 0 && (
                      <div style={{ padding: '0.5rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-muted,#9CA3AF)' }}>
                        Nenhum cliente encontrado
                      </div>
                    )}
                    <button className="pf-dropdown-cadastrar" onClick={cadastrarNovoCliente}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Cadastrar <strong>"{buscaCliente}"</strong> como novo cliente
                    </button>
                  </div>
                )}
              </div>
              <div className="pf-field">
                <label className="pf-label">Como nos conheceu</label>
                <select className="pf-input" value={comoConheceu} onChange={e => setComoConheceu(e.target.value)}>
                  <option value="">Selecionar...</option>
                  {COMO_CONHECEU.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
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

          {/* ── Bloco Entrega ── */}
          <div className="pf-card">
            <h3 className="pf-card-title">Entrega</h3>

            {/* Data + Hora */}
            <div className="pf-row2" style={{ marginBottom: '0.85rem' }}>
              <DatePickerField
                label="Data de entrega"
                value={pedido.data_entrega}
                onChange={v => set('data_entrega', v)}
                required
                minDate={new Date()}
                placeholder="Selecionar data"
              />
              <TimePickerField
                label="Horário"
                value={pedido.horario_entrega}
                onChange={v => set('horario_entrega', v)}
                placeholder="Selecionar horário"
                minuteStep={10}
              />
            </div>

            {/* Tipo de entrega — botões visuais */}
            <label className="pf-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Tipo de entrega</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { value: 'retirada', label: 'Retirada' },
                { value: 'entrega',  label: 'Entrega' },
                { value: 'local',    label: 'No local' },
              ].map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set('tipo_entrega', t.value)}
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.5rem',
                    borderRadius: '8px',
                    border: `1.5px solid ${pedido.tipo_entrega === t.value ? 'var(--primary,#FF6FA9)' : 'var(--border,#E9E9EE)'}`,
                    background: pedido.tipo_entrega === t.value ? 'var(--primary-light,#FFF1F7)' : 'var(--bg-body,#FAFAFA)',
                    color: pedido.tipo_entrega === t.value ? 'var(--primary,#FF6FA9)' : 'var(--text-secondary,#6B7280)',
                    fontFamily: 'Geist, sans-serif',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >{t.label}</button>
              ))}
            </div>

            {/* Endereço — só aparece quando Entrega */}
            {pedido.tipo_entrega === 'entrega' && (
              <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border,#E9E9EE)', paddingTop: '0.85rem' }}>
                <label className="pf-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Endereço de entrega</label>
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

          {/* ── Bloco Itens do pedido ── */}
          <div className="pf-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 className="pf-card-title" style={{ margin: 0 }}>Itens do pedido<span className="pf-required-badge">Obrigatório</span></h3>
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
                  </p>
                  {item.observacoes && <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary,#6B7280)' }}>{item.observacoes}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-title,#1F2937)' }}>
                    {formatMoney(item.valor_unitario * item.quantidade)}
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
                <div className="pf-row2">
                  <div className="pf-field">
                    <label className="pf-label">Qtd</label>
                    <input className="pf-input" type="number" min="0.1" step="0.1" value={novoItem.quantidade} onChange={e => setNovoItem(p => ({ ...p, quantidade: Number(e.target.value) }))} />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Valor unit. (R$)</label>
                    <input className="pf-input" type="number" min="0" step="0.01" value={novoItem.valor_unitario} onChange={e => setNovoItem(p => ({ ...p, valor_unitario: Number(e.target.value) }))} />
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

          {/* ── Status do pedido + Origem do pedido (lado a lado) ── */}
          <div className="pf-row-cards">
            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
              <h3 className="pf-card-title" style={{ marginBottom: '0.85rem' }}>Status do pedido</h3>

              {/* Status — seleção visual */}
              <label className="pf-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Status</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                {STATUS_OPTIONS.map(s => {
                  const isActive = pedido.status === s.value
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => set('status', s.value)}
                      style={{
                        padding: '0.55rem 0.5rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${isActive ? s.border : 'var(--border,#E9E9EE)'}`,
                        background: isActive ? s.bg : 'var(--bg-body,#FAFAFA)',
                        color: isActive ? s.color : 'var(--text-secondary,#6B7280)',
                        fontFamily: 'Geist, sans-serif',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{s.label}</button>
                  )
                })}
              </div>

              {/* Prioridade — 3 botões */}
              <label className="pf-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Prioridade</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                  { value: 'baixa', label: 'Baixa',  color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
                  { value: 'media', label: 'Média',   color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
                  { value: 'alta',  label: 'Alta',    color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
                ].map(pr => {
                  const isActive = pedido.prioridade === pr.value
                  return (
                    <button
                      key={pr.value}
                      type="button"
                      onClick={() => set('prioridade', pr.value)}
                      style={{
                        flex: 1,
                        padding: '0.55rem 0.5rem',
                        borderRadius: '8px',
                        border: `1.5px solid ${isActive ? pr.border : 'var(--border,#E9E9EE)'}`,
                        background: isActive ? pr.bg : 'var(--bg-body,#FAFAFA)',
                        color: isActive ? pr.color : 'var(--text-secondary,#6B7280)',
                        fontFamily: 'Geist, sans-serif',
                        fontSize: '0.82rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >{pr.label}</button>
                  )
                })}
              </div>
            </div>

            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
              <h3 className="pf-card-title" style={{ marginBottom: '0.85rem' }}>Origem do pedido</h3>
              {pedido.origem === 'cardapio' ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.35rem 0.85rem', borderRadius: '20px',
                  border: '1.5px solid var(--primary,#FF6FA9)',
                  background: 'var(--primary-light,#FFF1F7)',
                  color: 'var(--primary,#FF6FA9)',
                  fontFamily: 'Geist, sans-serif', fontSize: '0.78rem', fontWeight: 700,
                }}>
                  Pedido feito pelo Cardápio Digital
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    { value: 'manual',    label: 'Manual / Outro' },
                    { value: 'whatsapp',  label: 'WhatsApp' },
                    { value: 'instagram', label: 'Instagram' },
                  ].map(o => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => set('origem', o.value)}
                      style={{
                        padding: '0.35rem 0.85rem', borderRadius: '20px',
                        border: `1.5px solid ${pedido.origem === o.value ? 'var(--primary,#FF6FA9)' : 'var(--border,#E9E9EE)'}`,
                        background: pedido.origem === o.value ? 'var(--primary-light,#FFF1F7)' : 'var(--bg-body,#FAFAFA)',
                        color: pedido.origem === o.value ? 'var(--primary,#FF6FA9)' : 'var(--text-secondary,#6B7280)',
                        fontFamily: 'Geist, sans-serif', fontSize: '0.78rem',
                        fontWeight: pedido.origem === o.value ? 700 : 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >{o.label}</button>
                  ))}
                </div>
              )}
              {pedido.cupom_codigo && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border,#E9E9EE)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#9CA3AF)' }}>Cupom aplicado: </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary,#FF6FA9)' }}>{pedido.cupom_codigo}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Pagamento + Valores (lado a lado) ── */}
          <div className="pf-row-cards">
            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
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

            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
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
          </div>

          {/* ── Personalização (opcional) ── */}
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
                <div className="pf-field" style={{ marginTop: '0.75rem' }}>
                  <label className="pf-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Etiquetas</label>
                  <div className="pf-etiquetas">
                    {ETIQUETAS_SUGERIDAS.map(e => (
                      <button
                        key={e}
                        className={`pf-etiqueta-btn${(pedido.etiquetas || []).includes(e) ? ' ativa' : ''}`}
                        onClick={() => toggleEtiqueta(e)}
                      >{e}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Observações gerais (opcional) ── */}
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
      </div>

      {/* ── Botão flutuante WhatsApp ── */}
      {pedido.cliente_whatsapp || pedido.cliente_telefone ? (
        <button
          onClick={abrirWhatsApp}
          style={{
            position: 'fixed', bottom: '5.5rem', left: '1.25rem',
            background: '#25D366', color: 'white', border: 'none',
            borderRadius: '50px', padding: '0.6rem 1.1rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'Geist, sans-serif', zIndex: 100,
            boxShadow: '0 4px 16px rgba(37,211,102,0.4)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Abrir WhatsApp
        </button>
      ) : null}

      <div className="pf-footer-mobile">
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="pf-btn-salvar pf-btn-full" onClick={salvar} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Salvando...' : 'Salvar pedido'}
          </button>
          {!isEdicao && (
            <button
              onClick={salvarEIniciarOutro}
              disabled={saving}
              style={{
                flex: 1, padding: '0.85rem', fontSize: '0.82rem', fontWeight: 600,
                border: '1.5px solid var(--primary,#FF6FA9)', borderRadius: '14px',
                background: 'white', color: 'var(--primary,#FF6FA9)',
                cursor: 'pointer', fontFamily: 'Geist, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Salvar e iniciar outro
            </button>
          )}
        </div>
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

        .pf-content { display: flex; flex-direction: column; }
        .pf-section-list { display: flex; flex-direction: column; gap: 0.85rem; }
        .pf-row-cards { display: flex; gap: 0.85rem; align-items: stretch; }

        .pf-card { background: var(--bg-card,#fff); border: 1.5px solid var(--border,#E9E9EE); border-radius: 14px; padding: 1.1rem; }
        .pf-card-title { font-size: 0.88rem; font-weight: 700; color: var(--text-title,#1F2937); margin: 0 0 0.85rem; }
        .pf-required-badge {
          margin-left: 0.4rem; font-size: 0.68rem; font-weight: 700;
          color: #dc2626; background: #fee2e2;
          padding: 1px 7px; border-radius: 8px; vertical-align: middle;
        }

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
        .pf-dropdown-cadastrar {
          width: 100%; display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 0.85rem; background: var(--primary-light,#FFF1F7);
          border: none; border-top: 1px solid var(--border,#E9E9EE);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.8rem; color: var(--primary,#FF6FA9);
          text-align: left; transition: background 0.1s;
        }
        .pf-dropdown-cadastrar:hover { background: #FFE4F0; }
        .pf-dropdown-cadastrar strong { font-weight: 700; }

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
          .pf-row-cards { flex-direction: column; }
          .pf-tipo-entrega { grid-template-columns: repeat(2,1fr); }
        }
      `}</style>
    </div>
  )
}
