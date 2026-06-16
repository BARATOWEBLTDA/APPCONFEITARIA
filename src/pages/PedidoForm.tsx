import { useState, useEffect, useRef } from 'react'
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
  imagem_url?: string
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
  data_pagamento_restante: string
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
  status: 'novo', prioridade: 'media', origem: '',
  data_entrega: '', horario_entrega: '', tipo_entrega: 'retirada', taxa_entrega: 0,
  endereco_cep: '', endereco_rua: '', endereco_numero: '', endereco_complemento: '',
  endereco_bairro: '', endereco_cidade: '',
  personalizacao_tema: '', personalizacao_nome: '', personalizacao_idade: '',
  personalizacao_cor: '', personalizacao_referencia: '', personalizacao_obs: '',
  valor_produtos: 0, desconto: 0, taxa_extra: 0, cupom_codigo: '', cupom_desconto: 0,
  responsavel_entrega: '', responsavel_producao: '', data_prevista_producao: '',
  status_producao: 'nao_iniciado', checklist_producao: [],
  valor_total: 0, forma_pagamento: 'pix', status_pagamento: 'pendente',
  valor_sinal: 0, data_sinal: '', valor_recebido: 0, data_pagamento_restante: '',
  observacoes: '', etiquetas: [],
}

const EMPTY_ITEM: PedidoItem = {
  nome_produto: '', quantidade: 1, valor_unitario: 0,
  desconto: 0, observacoes: '', imagem_url: '', personalizacoes: {},
}

const STATUS_OPTIONS = [
  { value: 'novo',        label: 'Novo',        color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { value: 'em_producao', label: 'Em produção', color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
  { value: 'pronto',      label: 'Finalizado',  color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
]

// Origens unificadas (antigo "origem" + "como nos conheceu")
const ORIGENS = ['Instagram', 'Indicação', 'Google', 'Facebook', 'TikTok', 'WhatsApp', 'Cardápio Digital', 'Outro']

// Formata valor monetário brasileiro durante digitação
function parseMoney(v: string): number {
  const digits = v.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) / 100 : 0
}

function formatMoneyInput(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Input de dinheiro controlado: exibe "5.000,00", armazena 5000
function MoneyInput({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder?: string }) {
  const [display, setDisplay] = useState(value > 0 ? formatMoneyInput(value) : '')
  const prevValue = useRef(value)

  // Sincroniza de fora quando o valor muda (ex: recalculo automático)
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value
      setDisplay(value > 0 ? formatMoneyInput(value) : '')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const numeric = parseMoney(raw)
    prevValue.current = numeric
    setDisplay(formatMoneyInput(numeric))
    onChange(numeric)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <span style={{
        position: 'absolute', left: '0.75rem',
        fontSize: '0.85rem', fontWeight: 600,
        color: 'var(--text-secondary,#6B7280)',
        pointerEvents: 'none', userSelect: 'none',
      }}>R$</span>
      <input
        className="pf-input"
        inputMode="numeric"
        placeholder={placeholder || '0,00'}
        value={display}
        onChange={handleChange}
        onFocus={e => e.target.select()}
        style={{ paddingLeft: '2.2rem' }}
      />
    </div>
  )
}

function formatTelefone(tel: string): string {
  if (!tel) return ''
  const digits = tel.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 11) return `(${digits.slice(0,2)}) ${digits[2]} ${digits.slice(3,7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
  if (digits.length > 6) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`
  if (digits.length > 2) return `(${digits.slice(0,2)}) ${digits.slice(2)}`
  return digits
}

export default function PedidoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdicao = !!id && id !== 'novo'

  const [pedido, setPedido] = useState<Pedido>(EMPTY_PEDIDO)
  const [itens, setItens] = useState<PedidoItem[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [cupons, setCupons] = useState<any[]>([])
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
  const [buscaProduto, setBuscaProduto] = useState('')
  const [showProdutoDropdown, setShowProdutoDropdown] = useState(false)
  const [showSinal, setShowSinal] = useState(false)
  const [showDesconto, setShowDesconto] = useState(false)
  const [showCupom, setShowCupom] = useState(false)

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
    const [{ data: cls }, { data: prds }, { data: cups }] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,whatsapp,como_conheceu,endereco').eq('user_id', uid).order('nome'),
      supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url').eq('user_id', uid).eq('disponivel', true).order('nome'),
      supabase.from('cupons').select('id,codigo,desconto,tipo').eq('user_id', uid).eq('ativo', true).order('codigo'),
    ])
    setClientes(cls || [])
    setProdutos(prds || [])
    setCupons(cups || [])
  }

  const carregarPedido = async (uid: string) => {
    setLoading(true)
    const [{ data: ped }, { data: its }] = await Promise.all([
      supabase.from('pedidos').select('*').eq('id', id).eq('user_id', uid).single(),
      supabase.from('pedido_itens').select('*').eq('pedido_id', id),
    ])
    if (ped) {
      setPedido(ped)
    }
    if (its) setItens(its)
    setLoading(false)
  }

  const set = (field: keyof Pedido, value: any) => setPedido(p => ({ ...p, [field]: value }))

  // formatTelefone definida fora do componente (ver acima do export default)

  const selecionarCliente = (c: any) => {
    let endereco: Record<string, string> = {}
    if (c.endereco) {
      try {
        endereco = typeof c.endereco === 'string' ? JSON.parse(c.endereco) : c.endereco
      } catch { /* ignora se não for JSON */ }
    }

    // Resolve whatsapp: tenta campo whatsapp, depois telefone, depois limpa o campo
    const whatsappRaw = c.whatsapp || c.telefone || ''
    const whatsappFormatado = formatTelefone(whatsappRaw)

    setPedido(p => ({
      ...p,
      cliente_id: c.id,
      cliente_nome: c.nome,
      cliente_telefone: formatTelefone(c.telefone || ''),
      cliente_whatsapp: whatsappFormatado,
      ...(endereco.rua ? {
        endereco_cep: endereco.cep || p.endereco_cep,
        endereco_rua: endereco.rua || p.endereco_rua,
        endereco_numero: endereco.numero || p.endereco_numero,
        endereco_complemento: endereco.complemento || p.endereco_complemento,
        endereco_bairro: endereco.bairro || p.endereco_bairro,
        endereco_cidade: endereco.cidade || p.endereco_cidade,
      } : {}),
    }))
    setBuscaCliente(c.nome)
    setShowClienteDropdown(false)
  }

  const cadastrarNovoCliente = async () => {
    if (!buscaCliente.trim()) return
    const { data, error } = await supabase.from('clientes').insert({
      user_id: userId,
      nome: buscaCliente.trim(),
      whatsapp: pedido.cliente_whatsapp || null,
    }).select('id,nome,telefone,whatsapp,como_conheceu').single()

    if (!error && data) {
      selecionarCliente(data)
      setClientes(prev => [...prev, data])
      showToast(`Cliente "${data.nome}" cadastrado com sucesso!`)
    } else {
      showToast('Erro ao cadastrar cliente. Tente novamente.')
    }
  }

  const aplicarCupom = (cup: any) => {
    if (!cup) {
      set('cupom_codigo', '')
      set('cupom_desconto', 0)
      return
    }
    const desconto = cup.tipo === 'percentual'
      ? (pedido.valor_total * cup.desconto) / 100
      : cup.desconto
    setPedido(p => ({ ...p, cupom_codigo: cup.codigo, cupom_desconto: desconto }))
  }

  const adicionarItem = () => {
    if (!novoItem.nome_produto) return
    setItens(prev => [...prev, { ...novoItem }])
    setNovoItem({ ...EMPTY_ITEM })
    setBuscaProduto('')
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
      imagem_url: p.imagem_url || '',
    }))
  }

  const salvar = async () => {
    if (!pedido.cliente_nome) { showToast('Informe o nome do cliente'); return }
    if (itens.length === 0) { showToast('Adicione pelo menos um item ao pedido'); return }
    if (!pedido.data_entrega) { showToast('Informe a data de entrega'); return }

    setSaving(true)
    try {
      const { id: _id, numero: _numero, ...pedidoSemId } = pedido as any
      const payload = {
        ...pedidoSemId,
        user_id: userId,
        taxa_entrega: pedido.taxa_entrega || 0,
        taxa_extra: pedido.taxa_extra || 0,
        desconto: pedido.desconto || 0,
        cupom_desconto: pedido.cupom_desconto || 0,
        valor_produtos: pedido.valor_produtos || 0,
        valor_total: pedido.valor_total || 0,
        valor_sinal: pedido.valor_sinal || 0,
        valor_recebido: pedido.valor_recebido || 0,
        status_pagamento: statusPagamentoAuto,
        cliente_id: pedido.cliente_id || null,
        horario_entrega: pedido.horario_entrega || null,
        data_sinal: pedido.data_sinal || null,
        data_pagamento_restante: pedido.data_pagamento_restante || null,
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

        if (pedidoId) {
          await supabase.from('pedido_historico').insert({
            pedido_id: pedidoId,
            user_id: userId,
            evento: 'Pedido criado',
            descricao: `Pedido criado manualmente`,
          })
        }
      }

      if (pedidoId && itens.length > 0) {
        await supabase.from('pedido_itens').delete().eq('pedido_id', pedidoId)
        await supabase.from('pedido_itens').insert(
          itens.map(item => ({ ...item, pedido_id: pedidoId, user_id: userId }))
        )
      }

      // Atualiza origem/como_conheceu no cadastro do cliente
      if (pedido.cliente_id && pedido.origem) {
        await supabase.from('clientes').update({ como_conheceu: pedido.origem }).eq('id', pedido.cliente_id)
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

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const clientesFiltrados = buscaCliente.length >= 3
    ? clientes.filter(c => c.nome?.toLowerCase().includes(buscaCliente.toLowerCase()))
    : []

  const clienteSelecionado = !!(pedido.cliente_id && pedido.cliente_nome && buscaCliente === pedido.cliente_nome)

  // Valor restante = total - sinal - recebido (sinal já é parte do recebido em muitos casos)
  // Restante = total - sinal - valor pago na entrega
  const totalPago = pedido.valor_sinal + pedido.valor_recebido
  const valorRestante = Math.max(0, pedido.valor_total - totalPago)

  // Status derivado automaticamente
  const statusPagamentoAuto = valorRestante === 0 && pedido.valor_total > 0
    ? 'pago'
    : totalPago > 0
      ? 'parcial'
      : 'pendente'

  const STATUS_PAG_CONFIG = {
    pendente: { label: 'Pendente',        color: '#d97706', bg: '#fef3c7', dot: '#f59e0b' },
    parcial:  { label: 'Sinal recebido',  color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
    pago:     { label: 'Pago',            color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  } as const

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

            {/* Nome + Origem unificada */}
            <div className="pf-row2">
              <div className="pf-field" style={{ position: 'relative', flex: 2 }}>
                <label className="pf-label">
                  Nome do cliente<span className="pf-required-badge">Obrigatório</span>
                  {clienteSelecionado && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: '999px', padding: '1px 8px', verticalAlign: 'middle' }}>
                      ✓ Cadastrado
                    </span>
                  )}
                  {!clienteSelecionado && pedido.cliente_nome && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 600, color: '#d97706', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: '999px', padding: '1px 8px', verticalAlign: 'middle' }}>
                      + Novo cliente
                    </span>
                  )}
                </label>
                <input
                  className="pf-input"
                  placeholder="Buscar pelo nome (mín. 3 letras)..."
                  value={buscaCliente || pedido.cliente_nome}
                  onChange={e => {
                    const val = e.target.value
                    setBuscaCliente(val)
                    // Limpa cliente_id ao editar manualmente
                    setPedido(p => ({ ...p, cliente_nome: val, cliente_id: undefined }))
                    setShowClienteDropdown(val.length >= 3)
                  }}
                  onBlur={() => setTimeout(() => setShowClienteDropdown(false), 200)}
                />
                {showClienteDropdown && (clientesFiltrados.length > 0 || buscaCliente.length >= 3) && (
                  <div className="pf-dropdown" onMouseDown={e => e.preventDefault()}>
                    {clientesFiltrados.slice(0, 5).map(c => (
                      <button key={c.id} className="pf-dropdown-item" onMouseDown={() => selecionarCliente(c)}>
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
                    <button className="pf-dropdown-cadastrar" onMouseDown={e => { e.preventDefault(); cadastrarNovoCliente() }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Cadastrar <strong>"{buscaCliente}"</strong> como novo cliente
                    </button>
                  </div>
                )}
              </div>

              {/* Origem unificada (substitui "Como nos conheceu" + card separado) */}
              <div className="pf-field">
                <label className="pf-label">Origem do pedido</label>
                <select
                  className="pf-input"
                  value={pedido.origem}
                  onChange={e => set('origem', e.target.value)}
                >
                  <option value="">Selecionar...</option>
                  {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* WhatsApp — ocupa metade (não 100%) */}
            <div className="pf-row2" style={{ marginTop: '0.75rem' }}>
              <div className="pf-field">
                <label className="pf-label">WhatsApp / Contato</label>
                <input
                  className="pf-input"
                  placeholder="(41) 9 9929-1790"
                  value={pedido.cliente_whatsapp}
                  onChange={e => set('cliente_whatsapp', formatTelefone(e.target.value))}
                  inputMode="numeric"
                  maxLength={16}
                />
              </div>
              {/* Coluna vazia para manter metade */}
              <div className="pf-field" />
            </div>
          </div>

          {/* ── Bloco Entrega ── */}
          <div className="pf-card">
            <h3 className="pf-card-title">Entrega</h3>

            {/* Data + Hora */}
            <div className="pf-row2" style={{ marginBottom: '0.85rem' }}>
              <DatePickerField
                label="Data de entrega / Pedido"
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

            {/* Tipo de entrega — toggle visual (só Entrega / Retirada) */}
            <label className="pf-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Tipo de entrega</label>
            <div className="pf-toggle-entrega">
              {[
                { value: 'retirada', label: 'Retirada' },
                { value: 'entrega',  label: 'Entrega' },
              ].map(t => {
                const isActive = pedido.tipo_entrega === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('tipo_entrega', t.value)}
                    className={`pf-entrega-toggle${isActive ? ' ativo' : ''}`}
                  >
                    <span className="pf-entrega-label">{t.label}</span>
                    <span className="pf-entrega-check">{isActive ? '✓' : ''}</span>
                  </button>
                )
              })}
            </div>

            {/* Endereço — só aparece quando Entrega */}
            {pedido.tipo_entrega === 'entrega' && (
              <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--border,#E9E9EE)', paddingTop: '0.85rem' }}>
                <label className="pf-label" style={{ marginBottom: '0.5rem', display: 'block', color: 'var(--text-title,#1F2937)', fontWeight: 700 }}>
                  Endereço de entrega
                </label>
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
                <div style={{ maxWidth: '50%' }}>
                  <div className="pf-field">
                    <label className="pf-label">Taxa de entrega (R$)</label>
                    <MoneyInput value={pedido.taxa_entrega} onChange={v => set('taxa_entrega', v)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Bloco Itens do pedido ── */}
          <div className="pf-card">
            {/* Cabeçalho sem botão "+ Adicionar" no topo */}
            <h3 className="pf-card-title" style={{ marginBottom: '1rem' }}>
              Itens do pedido<span className="pf-required-badge">Obrigatório</span>
            </h3>

            {itens.length === 0 && !adicionandoItem && (
              <div className="pf-empty-items">
                <p>Nenhum produto adicionado</p>
                <button className="pf-btn-add" onClick={() => setAdicionandoItem(true)}>Adicionar produto</button>
              </div>
            )}

            {itens.map((item, idx) => (
              <div key={idx} className="pf-item-card">
                {/* Thumbnail do produto */}
                {item.imagem_url ? (
                  <img
                    src={item.imagem_url}
                    alt={item.nome_produto}
                    style={{
                      width: 48, height: 48, borderRadius: 8,
                      objectFit: 'cover', flexShrink: 0,
                      border: '1.5px solid var(--border,#E9E9EE)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                    background: 'var(--border,#E9E9EE)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.3rem',
                  }}>🎂</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-title,#1F2937)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nome_produto}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-muted,#9CA3AF)' }}>
                    {item.quantidade}x {formatMoney(item.valor_unitario)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-title,#1F2937)' }}>
                    {formatMoney(item.valor_unitario * item.quantidade)}
                  </span>
                  <button className="pf-btn-remove" onClick={() => removerItem(idx)}>✕</button>
                </div>
              </div>
            ))}

            {adicionandoItem && (
              <div className="pf-add-item-form">
                <div className="pf-field" style={{ position: 'relative' }}>
                  <label className="pf-label">Produto</label>
                  <input
                    className="pf-input"
                    placeholder="Buscar produto..."
                    value={buscaProduto}
                    onChange={e => {
                      setBuscaProduto(e.target.value)
                      setShowProdutoDropdown(true)
                      if (!e.target.value) {
                        setNovoItem(p => ({ ...p, produto_id: undefined, nome_produto: '', imagem_url: '' }))
                      }
                    }}
                    onFocus={() => setShowProdutoDropdown(true)}
                    onBlur={() => setTimeout(() => setShowProdutoDropdown(false), 200)}
                  />
                  {showProdutoDropdown && (
                    <div className="pf-dropdown" onMouseDown={e => e.preventDefault()}>
                      {produtos
                        .filter(p => !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))
                        .slice(0, 6)
                        .map(p => (
                          <button
                            key={p.id}
                            className="pf-dropdown-item pf-dropdown-produto"
                            onMouseDown={() => {
                              selecionarProduto(p)
                              setBuscaProduto(p.nome)
                              setShowProdutoDropdown(false)
                            }}
                          >
                            {p.imagem_url ? (
                              <img src={p.imagem_url} alt={p.nome} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--border,#E9E9EE)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🎂</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-title,#1F2937)' }}>{p.nome}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--primary,#FF6FA9)', fontWeight: 700 }}>{formatMoney(p.preco_normal)}</div>
                            </div>
                          </button>
                        ))
                      }
                      {produtos.filter(p => !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase())).length === 0 && (
                        <div style={{ padding: '0.6rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-muted,#9CA3AF)' }}>
                          Nenhum produto encontrado
                        </div>
                      )}
                    </div>
                  )}
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
                    <MoneyInput value={novoItem.valor_unitario} onChange={v => setNovoItem(p => ({ ...p, valor_unitario: v }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="pf-btn-salvar" onClick={adicionarItem}>Adicionar</button>
                  <button className="pf-btn-cancel" onClick={() => { setAdicionandoItem(false); setNovoItem({ ...EMPTY_ITEM }); setBuscaProduto('') }}>Cancelar</button>
                </div>
              </div>
            )}

            {itens.length > 0 && (
              <>
                <div className="pf-item-total">
                  <span>Total dos produtos</span>
                  <span style={{ fontWeight: 700 }}>{formatMoney(pedido.valor_produtos)}</span>
                </div>
                {!adicionandoItem && (
                  <button
                    className="pf-btn-add"
                    onClick={() => setAdicionandoItem(true)}
                    style={{ marginTop: '0.75rem', width: '100%' }}
                  >
                    + Adicionar produto
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Status do pedido ── */}
          <div className="pf-card">
            <h3 className="pf-card-title" style={{ marginBottom: '0.85rem' }}>Status do pedido</h3>

            <div className="pf-status-list" style={{ marginBottom: '1rem' }}>
              {STATUS_OPTIONS.map(s => {
                const isActive = pedido.status === s.value
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('status', s.value)}
                    className={`pf-status-item${isActive ? ' ativo' : ''}`}
                  >
                    <span className="pf-status-dot" style={{ background: s.color }} />
                    <span className="pf-status-name">{s.label}</span>
                    {isActive && (
                      <span className="pf-status-check">✓</span>
                    )}
                  </button>
                )
              })}
            </div>


          </div>

          {/* ── Pagamento + Valores (lado a lado) ── */}
          <div className="pf-row-cards">
            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
              {/* Título + badge de status automático */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <h3 className="pf-card-title" style={{ margin: 0 }}>Pagamento</h3>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px',
                  borderRadius: '999px',
                  color: STATUS_PAG_CONFIG[statusPagamentoAuto].color,
                  background: STATUS_PAG_CONFIG[statusPagamentoAuto].bg,
                  display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_PAG_CONFIG[statusPagamentoAuto].dot, display: 'inline-block' }} />
                  {STATUS_PAG_CONFIG[statusPagamentoAuto].label}
                </span>
              </div>

              {/* Forma de pagamento — botões visuais */}
              <label className="pf-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Forma de pagamento</label>
              <div className="pf-pagamento-grid" style={{ marginBottom: '0.85rem' }}>
                {[
                  { value: 'pix',      label: 'PIX',      img: '/pix.png' },
                  { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                  { value: 'credito',  label: 'Crédito',  img: '/credito.webp' },
                  { value: 'debito',   label: 'Débito',   img: '/debito.png' },
                  { value: 'fiado',    label: 'Fiado',    icon: '🤝' },
                ].map(f => {
                  const isActive = pedido.forma_pagamento === f.value
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => set('forma_pagamento', f.value)}
                      className={`pf-pagamento-btn${isActive ? ' ativo' : ''}`}
                    >
                      {'img' in f
                        ? <img src={f.img} alt={f.label} style={{ width: 28, height: 28, objectFit: 'contain' }} />
                        : <span className="pf-pagamento-icon">{f.icon}</span>
                      }
                      <span>{f.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Toggle sinal */}
              <button
                type="button"
                className={`pf-sinal-toggle${showSinal || pedido.valor_sinal > 0 ? ' ativo' : ''}`}
                onClick={() => {
                  if (showSinal && pedido.valor_sinal === 0) {
                    setShowSinal(false)
                  } else {
                    setShowSinal(v => !v)
                  }
                }}
              >
                <span className="pf-sinal-check">
                  {(showSinal || pedido.valor_sinal > 0)
                    ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : null
                  }
                </span>
                <span>Sinal recebido</span>
                {pedido.valor_sinal > 0 && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: '#3b82f6' }}>
                    {formatMoney(pedido.valor_sinal)}
                  </span>
                )}
              </button>

              {(showSinal || pedido.valor_sinal > 0) && (
                <div className="pf-row2" style={{ marginTop: '0.65rem' }}>
                  <div className="pf-field">
                    <label className="pf-label">Valor do sinal (R$)</label>
                    <MoneyInput value={pedido.valor_sinal} onChange={v => set('valor_sinal', v)} />
                  </div>
                  <div className="pf-field">
                    <label className="pf-label">Data do sinal</label>
                    <input className="pf-input" type="date" value={pedido.data_sinal} onChange={e => set('data_sinal', e.target.value)} />
                  </div>
                </div>
              )}

              {/* Valor pago na entrega + Restante */}
              <div className="pf-row2" style={{ marginTop: '0.75rem' }}>
                <div className="pf-field">
                  <label className="pf-label">Valor pago na entrega (R$)</label>
                  <MoneyInput value={pedido.valor_recebido} onChange={v => set('valor_recebido', v)} />
                </div>
                <div className="pf-field">
                  <label className="pf-label">Restante</label>
                  <div
                    className="pf-input pf-input-readonly"
                    style={{ color: valorRestante > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}
                  >
                    {formatMoney(valorRestante)}
                  </div>
                </div>
              </div>

              {valorRestante > 0 && (
                <div style={{ maxWidth: '50%', marginTop: '0.1rem' }}>
                  <div className="pf-field">
                    <label className="pf-label">Receber restante em</label>
                    <input
                      className="pf-input"
                      type="date"
                      value={pedido.data_pagamento_restante}
                      onChange={e => set('data_pagamento_restante', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pf-card" style={{ flex: 1, minWidth: 0 }}>
              <h3 className="pf-card-title">Valores</h3>
              <div className="pf-resumo-fin">
                <div className="pf-fin-row">
                  <span>Produtos</span>
                  <span>{formatMoney(pedido.valor_produtos)}</span>
                </div>
                {pedido.taxa_entrega > 0 && (
                  <div className="pf-fin-row">
                    <span>Taxa de entrega</span>
                    <span>{formatMoney(pedido.taxa_entrega)}</span>
                  </div>
                )}
                {pedido.taxa_extra > 0 && (
                  <div className="pf-fin-row">
                    <span>Taxa extra</span>
                    <span>{formatMoney(pedido.taxa_extra)}</span>
                  </div>
                )}
                {pedido.desconto > 0 && (
                  <div className="pf-fin-row pf-fin-row-desconto">
                    <span>↓ Desconto</span>
                    <span>- {formatMoney(pedido.desconto)}</span>
                  </div>
                )}
                {pedido.cupom_desconto > 0 && (
                  <div className="pf-fin-row pf-fin-row-desconto">
                    <span>🏷️ {pedido.cupom_codigo}</span>
                    <span>- {formatMoney(pedido.cupom_desconto)}</span>
                  </div>
                )}
                <div className="pf-fin-total-bloco">
                  <span className="pf-fin-total-label">Total do pedido</span>
                  <span className="pf-fin-total-valor">{formatMoney(pedido.valor_total)}</span>
                </div>
              </div>

              {/* Toggle desconto */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className={`pf-sinal-toggle${showDesconto || pedido.desconto > 0 ? ' ativo' : ''}`}
                  onClick={() => {
                    if (showDesconto && pedido.desconto === 0) setShowDesconto(false)
                    else setShowDesconto(v => !v)
                  }}
                >
                  <span className="pf-sinal-check">
                    {(showDesconto || pedido.desconto > 0) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </span>
                  <span>Aplicar desconto</span>
                  {pedido.desconto > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>
                      - {formatMoney(pedido.desconto)}
                    </span>
                  )}
                </button>
                {(showDesconto || pedido.desconto > 0) && (
                  <div className="pf-row2" style={{ paddingLeft: '0.25rem' }}>
                    <div className="pf-field">
                      <label className="pf-label">Valor do desconto (R$)</label>
                      <MoneyInput value={pedido.desconto} onChange={v => set('desconto', v)} />
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Taxa extra (R$)</label>
                      <MoneyInput value={pedido.taxa_extra} onChange={v => set('taxa_extra', v)} />
                    </div>
                  </div>
                )}

                {/* Toggle cupom */}
                <button
                  type="button"
                  className={`pf-sinal-toggle${showCupom || pedido.cupom_codigo ? ' ativo' : ''}`}
                  onClick={() => {
                    if (showCupom && !pedido.cupom_codigo) setShowCupom(false)
                    else setShowCupom(v => !v)
                  }}
                >
                  <span className="pf-sinal-check">
                    {(showCupom || pedido.cupom_codigo) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </span>
                  <span>Aplicar cupom</span>
                  {pedido.cupom_codigo && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 700, color: '#16a34a' }}>
                      {pedido.cupom_codigo} — - {formatMoney(pedido.cupom_desconto)}
                    </span>
                  )}
                </button>
                {(showCupom || pedido.cupom_codigo) && (
                  <div className="pf-row2" style={{ paddingLeft: '0.25rem' }}>
                    <div className="pf-field" style={{ flex: 2 }}>
                      <label className="pf-label">Cupom</label>
                      {cupons.length > 0 ? (
                        <select
                          className="pf-input"
                          value={pedido.cupom_codigo}
                          onChange={e => {
                            const cup = cupons.find(c => c.codigo === e.target.value)
                            aplicarCupom(cup || null)
                          }}
                        >
                          <option value="">Selecionar cupom...</option>
                          {cupons.map(c => (
                            <option key={c.id} value={c.codigo}>
                              {c.codigo} — {c.tipo === 'percentual' ? `${c.desconto}%` : formatMoney(c.desconto)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="pf-input"
                          placeholder="Código do cupom"
                          value={pedido.cupom_codigo}
                          onChange={e => set('cupom_codigo', e.target.value)}
                        />
                      )}
                    </div>
                    <div className="pf-field">
                      <label className="pf-label">Desconto cupom (R$)</label>
                      <MoneyInput value={pedido.cupom_desconto} onChange={v => set('cupom_desconto', v)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Personalização (opcional) ── */}
          <div className="pf-card pf-card-toggle">
            <button
              className={`pf-toggle-btn${showPersonalizacao ? ' ativo' : ''}`}
              onClick={() => {
                if (showPersonalizacao) {
                  setPedido(p => ({
                    ...p,
                    personalizacao_tema: '',
                    personalizacao_nome: '',
                    personalizacao_idade: '',
                    personalizacao_cor: '',
                    personalizacao_obs: '',
                  }))
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
        .pf-input { border: 1.5px solid var(--border,#E9E9EE); border-radius: 8px; padding: 0.55rem 0.75rem; font-size: 0.85rem; font-family: 'Geist', sans-serif; color: var(--text-primary,#1F2937); background: var(--bg-body,#FAFAFA); outline: none; width: 100%; transition: border-color 0.15s; box-sizing: border-box; }
        .pf-input:focus { border-color: var(--primary,#FF6FA9); }
        .pf-input-readonly { display: flex; align-items: center; background: var(--bg-body,#F7F7F8); cursor: default; border-radius: 8px; padding: 0.55rem 0.75rem; font-size: 0.85rem; font-family: 'Geist', sans-serif; border: 1.5px solid var(--border,#E9E9EE); }
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

        /* Toggle entrega */
        .pf-toggle-entrega { display: flex; gap: 0.6rem; }
        .pf-entrega-toggle {
          flex: 1; display: flex; align-items: center; gap: 0.6rem;
          padding: 0.75rem 1rem; border-radius: 10px;
          border: 1.5px solid var(--border,#E9E9EE);
          background: var(--bg-body,#FAFAFA);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.85rem; font-weight: 500;
          color: var(--text-secondary,#6B7280);
          transition: all 0.15s; text-align: left;
        }
        .pf-entrega-toggle.ativo {
          border-color: var(--primary,#FF6FA9);
          background: var(--primary-light,#FFF1F7);
          color: var(--primary,#FF6FA9);
          font-weight: 700;
        }
        .pf-entrega-icon { font-size: 1.1rem; }
        .pf-entrega-label { flex: 1; }

        /* Status lista */
        .pf-status-list { display: flex; flex-direction: column; border: 1.5px solid var(--border,#E9E9EE); border-radius: 10px; overflow: hidden; }
        .pf-status-item {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.7rem 1rem; background: none; border: none;
          border-bottom: 1px solid var(--border,#E9E9EE);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.85rem; font-weight: 500;
          color: var(--text-secondary,#6B7280);
          transition: background 0.12s; text-align: left;
        }
        .pf-status-item:last-child { border-bottom: none; }
        .pf-status-item:hover { background: var(--bg-body,#F7F7F8); }
        .pf-status-item.ativo { background: #3d1a24; font-weight: 700; color: #fff; }
        .pf-status-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
        .pf-status-name { flex: 1; }
        .pf-status-check { font-size: 0.75rem; color: var(--primary,#FF6FA9); font-weight: 800; }
        .pf-status-item.ativo .pf-status-check { color: #fff; }
        .pf-status-item.ativo:hover { background: #3d1a24; }
        .pf-entrega-check {
          width: 18px; height: 18px; border-radius: 50%;
          border: 1.5px solid var(--border,#E9E9EE);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 800;
          transition: all 0.15s;
        }
        .pf-entrega-toggle.ativo .pf-entrega-check {
          background: var(--primary,#FF6FA9);
          border-color: var(--primary,#FF6FA9);
          color: white;
        }

        .pf-item-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--bg-body,#F7F7F8); border-radius: 10px; margin-bottom: 0.5rem; }
        .pf-btn-remove { background: none; border: none; cursor: pointer; color: var(--text-muted,#9CA3AF); font-size: 0.85rem; padding: 4px; border-radius: 6px; transition: color 0.15s; }
        .pf-btn-remove:hover { color: #ef4444; }
        .pf-btn-add { background: none; border: 1.5px solid var(--primary,#FF6FA9); border-radius: 8px; padding: 0.35rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: var(--primary,#FF6FA9); cursor: pointer; font-family: 'Geist', sans-serif; white-space: nowrap; }
        .pf-empty-items { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2rem 0; }
        .pf-empty-items p { color: var(--text-muted,#9CA3AF); font-size: 0.85rem; margin: 0; }
        .pf-add-item-form { background: var(--bg-body,#F7F7F8); border-radius: 10px; padding: 0.85rem; margin-top: 0.5rem; }
        .pf-item-total { display: flex; justify-content: space-between; padding: 0.75rem 0 0; border-top: 1.5px solid var(--border,#E9E9EE); margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary,#6B7280); }

        .pf-resumo-fin { border-radius: 12px; overflow: hidden; border: 1.5px solid var(--border,#E9E9EE); display: flex; flex-direction: column; }
        .pf-fin-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.83rem; color: var(--text-secondary,#6B7280); padding: 0.55rem 0.9rem; border-bottom: 1px solid var(--border,#E9E9EE); background: var(--bg-body,#FAFAFA); }
        .pf-fin-row:last-of-type { border-bottom: none; }
        .pf-fin-row-desconto { color: #16a34a; background: #f0fdf4; font-weight: 600; }
        .pf-fin-total-bloco {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.85rem 0.9rem;
          background: #3d1a24;
          border-top: none;
        }
        .pf-fin-total-label { font-size: 0.8rem; font-weight: 600; color: rgba(255,255,255,0.75); letter-spacing: 0.02em; text-transform: uppercase; }
        .pf-fin-total-valor { font-size: 1.25rem; font-weight: 800; color: #fff; letter-spacing: -0.01em; }

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

        /* Pagamento */
        .pf-pagamento-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; }
        .pf-pagamento-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
          padding: 0.5rem 0.25rem; border-radius: 8px;
          border: 1.5px solid var(--border,#E9E9EE);
          background: var(--bg-body,#FAFAFA);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.7rem; font-weight: 600;
          color: var(--text-secondary,#6B7280);
          transition: all 0.15s;
        }
        .pf-pagamento-btn:hover { border-color: var(--primary,#FF6FA9); color: var(--primary,#FF6FA9); }
        .pf-pagamento-btn.ativo { border-color: var(--primary,#FF6FA9); background: var(--primary-light,#FFF1F7); color: var(--primary,#FF6FA9); font-weight: 700; }
        .pf-pagamento-icon { font-size: 1.1rem; }

        /* Toggle sinal */
        .pf-sinal-toggle {
          width: 100%; display: flex; align-items: center; gap: 0.6rem;
          padding: 0.6rem 0.75rem; border-radius: 8px;
          border: 1.5px solid var(--border,#E9E9EE);
          background: var(--bg-body,#FAFAFA);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.83rem; font-weight: 500;
          color: var(--text-secondary,#6B7280);
          transition: all 0.15s;
        }
        .pf-sinal-toggle.ativo { border-color: #3b82f6; background: #eff6ff; color: #1d4ed8; font-weight: 600; }
        .pf-sinal-check {
          width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
          border: 1.5px solid var(--border,#D1D5DB);
          background: white;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .pf-sinal-toggle.ativo .pf-sinal-check { background: #3b82f6; border-color: #3b82f6; }

        /* Dropdown produto */
        .pf-dropdown-produto { flex-direction: row; align-items: center; gap: 0.6rem; }

        @media (max-width: 640px) {
          .pf-row2 { flex-direction: column; gap: 0.5rem; }
          .pf-row3 { flex-direction: row; }
          .pf-row-cards { flex-direction: column; }
          .pf-toggle-entrega { flex-direction: column; }
          .pf-pagamento-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  )
}
