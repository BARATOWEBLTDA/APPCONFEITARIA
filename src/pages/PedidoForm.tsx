import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type Pedido, type PedidoItem, EMPTY_PEDIDO, EMPTY_ITEM } from '@/pages/pedidoFormTypes'
import StepCliente from '@/pages/PedidoFormCliente'
import StepProdutos from '@/pages/PedidoFormProdutos'
import StepPagamento from '@/pages/PedidoFormPagamento'

// ─── Labels das etapas ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'cliente',   label: 'Cliente' },
  { id: 'produtos',  label: 'Produtos' },
  { id: 'pagamento', label: 'Pagamento' },
] as const

type StepId = typeof STEPS[number]['id']

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PedidoForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdicao = !!id && id !== 'novo'

  // Estado global do wizard
  const [step, setStep]       = useState<StepId>('cliente')
  const [pedido, setPedido]   = useState<Pedido>(EMPTY_PEDIDO)
  const [itens, setItens]     = useState<PedidoItem[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [produtos, setProdutos] = useState<any[]>([])
  const [cupons, setCupons]   = useState<any[]>([])
  const [userId, setUserId]   = useState('')
  const [salvarComoNovo, setSalvarComoNovo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const isMobile = useIsMobile()
  const [toast, setToast]     = useState('')

  // ── Cálculo automático do total ──────────────────────────────────────────
  useEffect(() => {
    const totalItens = itens.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0)
    const total = totalItens + pedido.taxa_entrega - pedido.desconto - pedido.cupom_desconto
    setPedido(p => ({ ...p, valor_produtos: totalItens, valor_total: Math.max(0, total) }))
  }, [itens, pedido.taxa_entrega, pedido.desconto, pedido.cupom_desconto])

  // ── Carregamento inicial ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      carregarDados(user.id)
      if (isEdicao) carregarPedido(user.id)
    })
  }, [id])

  const carregarDados = async (uid: string) => {
    const [{ data: cls }, { data: prds }] = await Promise.all([
      supabase.from('clientes').select('id,nome,telefone,whatsapp,como_conheceu,endereco').eq('user_id', uid).order('nome'),
      supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url').eq('user_id', uid).eq('disponivel', true).order('nome'),
    ])
    setClientes(cls || [])
    setProdutos(prds || [])
    setCupons([]) // tabela cupons não existe ainda

    // Trava: bloqueia criação de pedido sem produtos cadastrados — volta para Pedidos que mostra o modal
    if (!isEdicao && (!prds || prds.length === 0)) {
      navigate('/pedidos')
    }
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  const set = (field: keyof Pedido, value: any) =>
    setPedido(p => ({ ...p, [field]: value }))

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cadastrarNovoCliente = async (nome: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .insert({ user_id: userId, nome, whatsapp: pedido.cliente_whatsapp || null })
      .select('id,nome,telefone,whatsapp,como_conheceu')
      .single()
    if (!error && data) {
      setClientes(prev => [...prev, data])
      set('cliente_id', data.id)
      set('cliente_nome', data.nome)
      showToast(`"${data.nome}" cadastrado!`)
    } else {
      showToast('Erro ao cadastrar cliente.')
    }
  }

  // ── Salvamento ───────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!pedido.cliente_nome) { showToast('Informe o nome do cliente'); setStep('cliente'); return }
    if (itens.length === 0)   { showToast('Adicione pelo menos um produto'); setStep('produtos'); return }
    if (!pedido.data_entrega) { showToast('Informe a data de entrega'); setStep('cliente'); return }

    setSaving(true)
    try {
      const totalPago = pedido.valor_sinal + pedido.valor_recebido
      const valorRestante = Math.max(0, pedido.valor_total - totalPago)
      const statusPagamentoAuto =
        valorRestante === 0 && pedido.valor_total > 0 ? 'pago'
        : totalPago > 0 ? 'parcial'
        : 'pendente'

      // Cria novo cliente se marcou a opção
      if (salvarComoNovo && !pedido.cliente_id && pedido.cliente_nome) {
        const { data: novoCliente } = await supabase
          .from('clientes')
          .insert({ user_id: userId, nome: pedido.cliente_nome, whatsapp: pedido.cliente_whatsapp || null })
          .select('id')
          .single()
        if (novoCliente?.id) {
          setPedido(p => ({ ...p, cliente_id: novoCliente.id }))
        }
      }

      // Payload com exatamente os campos que existem no banco
      const payload = {
        user_id: userId,
        cliente_id: pedido.cliente_id || null,
        cliente_nome: pedido.cliente_nome,
        cliente_telefone: pedido.cliente_telefone || null,
        cliente_whatsapp: pedido.cliente_whatsapp || null,
        cliente_email: pedido.cliente_email || null,
        status: pedido.status || 'confirmado',
        prioridade: pedido.prioridade || 'media',
        origem: pedido.origem || null,
        etiquetas: pedido.etiquetas || [],
        data_entrega: pedido.data_entrega,
        horario_entrega: pedido.horario_entrega || null,
        tipo_entrega: pedido.tipo_entrega || 'retirada',
        taxa_entrega: pedido.taxa_entrega || 0,
        responsavel_entrega: pedido.responsavel_entrega || null,
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
        valor_produtos: pedido.valor_produtos || 0,
        desconto: pedido.desconto || 0,
        cupom_codigo: pedido.cupom_codigo || null,
        cupom_desconto: pedido.cupom_desconto || 0,
        valor_total: pedido.valor_total || 0,
        forma_pagamento: pedido.forma_pagamento || 'pix',
        status_pagamento: statusPagamentoAuto,
        valor_sinal: pedido.valor_sinal || 0,
        data_sinal: pedido.data_sinal || null,
        valor_recebido: pedido.valor_recebido || 0,
        status_producao: pedido.status_producao || null,
        data_prevista_producao: pedido.data_prevista_producao || null,
        responsavel_producao: pedido.responsavel_producao || null,
        checklist_producao: pedido.checklist_producao || [],
        observacoes: pedido.observacoes || null,
      }

      let pedidoId = id
      if (isEdicao) {
        await supabase.from('pedidos').update(payload).eq('id', id)
      } else {
        const { data } = await supabase.from('pedidos').insert(payload).select('id').single()
        pedidoId = data?.id
        if (pedidoId) {
          // pedido_historico é opcional — não falha se tabela não existir
          supabase.from('pedido_historico').insert({
            pedido_id: pedidoId, user_id: userId,
            evento: 'Pedido criado', descricao: 'Pedido criado manualmente',
          }).then(() => {}, () => {})
        }
      }

      if (pedidoId && itens.length > 0) {
        await supabase.from('pedido_itens').delete().eq('pedido_id', pedidoId)
        await supabase.from('pedido_itens').insert(
          itens.map(item => ({
            pedido_id: pedidoId,
            user_id: userId,
            produto_id: item.produto_id || null,
            nome_produto: item.nome_produto,
            quantidade: item.quantidade || 1,
            valor_unitario: item.valor_unitario || 0,
            desconto: item.desconto || 0,
            observacoes: item.observacoes || null,
            personalizacoes: item.personalizacoes || {},
            imagem_url: item.imagem_url || null,
          }))
        )
      }

      if (pedido.cliente_id && pedido.origem) {
        await supabase.from('clientes').update({ como_conheceu: pedido.origem }).eq('id', pedido.cliente_id)
      }

      navigate('/pedidos')
    } catch (err) {
      console.error('Erro ao salvar pedido:', err)
      showToast('Erro ao salvar pedido.')
    }
    setSaving(false)
  }

  const salvarEIniciar = async () => { await salvar(); navigate('/pedidos/novo') }

  // ── Navegação entre steps ────────────────────────────────────────────────
  const goNext = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (step === 'cliente')  setStep('produtos')
    if (step === 'produtos') setStep('pagamento')
  }
  const goBack = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (step === 'produtos')  setStep('cliente')
    if (step === 'pagamento') setStep('produtos')
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="pf2-loader">
      <div className="pf2-spinner" />
    </div>
  )

  return (
    <div className="pf2-root">

      {/* ── Header ── */}
      <div className="pf2-header">
        <button className="pf2-back" onClick={() => navigate('/pedidos')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Pedidos
        </button>
        <h1 className="pf2-title">{isEdicao ? 'Editar pedido' : 'Novo pedido'}</h1>
        {/* Espaço reservado para simetria */}
        <div style={{ width: 64 }} />
      </div>

      {/* ── Barra de progresso ── */}
      <div className="pf2-steps">
        {STEPS.map((s, i) => {
          const isDone    = i < stepIndex
          const isActive  = i === stepIndex
          return (
            <div key={s.id} className="pf2-step-item">
              <div
                className={`pf2-step-dot${isDone ? ' pf2-step-dot--done' : isActive ? ' pf2-step-dot--active' : ''}`}
                onClick={() => isDone && setStep(s.id)}
                style={{ cursor: isDone ? 'pointer' : 'default' }}
              >
                {isDone
                  ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  : <span>{i + 1}</span>
                }
              </div>
              <span className={`pf2-step-label${isActive ? ' pf2-step-label--active' : isDone ? ' pf2-step-label--done' : ''}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`pf2-step-line${isDone ? ' pf2-step-line--done' : ''}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Conteúdo ── */}
      <div className="pf2-content">
        {isMobile ? (
          /* ── Mobile: wizard de etapas ── */
          <>
            {step === 'cliente' && (
              <StepCliente
                pedido={pedido} set={set} clientes={clientes}
                salvarComoNovo={salvarComoNovo} setSalvarComoNovo={setSalvarComoNovo}
                onNext={goNext}
              />
            )}
            {step === 'produtos' && (
              <StepProdutos
                pedido={pedido} set={set} itens={itens} setItens={setItens}
                produtos={produtos} onNext={goNext} onBack={goBack}
              />
            )}
            {step === 'pagamento' && (
              <StepPagamento
                pedido={pedido} set={set} cupons={cupons} saving={saving}
                onSalvar={salvar} onSalvarEIniciar={salvarEIniciar}
                onBack={goBack} isEdicao={isEdicao}
              />
            )}
          </>
        ) : (
          /* ── Desktop: tudo numa página, 2 colunas ── */
          <div className="pf2-desktop-form">
            {/* Coluna esquerda: Cliente + Entrega + Produtos */}
            <div className="pf2-desktop-col">
              <StepCliente
                pedido={pedido} set={set} clientes={clientes}
                salvarComoNovo={salvarComoNovo} setSalvarComoNovo={setSalvarComoNovo}
                onNext={goNext}
              />
              <StepProdutos
                pedido={pedido} set={set} itens={itens} setItens={setItens}
                produtos={produtos} onNext={goNext} onBack={goBack}
              />
            </div>
            {/* Coluna direita: Pagamento + Resumo + Salvar */}
            <div className="pf2-desktop-col">
              <StepPagamento
                pedido={pedido} set={set} cupons={cupons} saving={saving}
                onSalvar={salvar} onSalvarEIniciar={salvarEIniciar}
                onBack={goBack} isEdicao={isEdicao}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && <div className="pf2-toast">{toast}</div>}

      <style>{`
        /* ── Reset base ── */
        .pf2-root { font-family: 'Geist', sans-serif; display: flex; flex-direction: column; min-height: 100dvh; background: var(--bg-body); }

        /* ── Header ── */
        .pf2-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1.25rem 1rem 0.85rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 40;
        }
        .pf2-back {
          display: flex; align-items: center; gap: 0.3rem;
          background: none; border: none; cursor: pointer;
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-secondary);
          font-family: 'Geist', sans-serif; padding: 0;
        }
        .pf2-back:hover { color: var(--primary); }
        .pf2-title {
          font-size: var(--font-modal-title); font-weight: var(--fw-bold);
          color: var(--text-title); margin: 0;
        }

        /* ── Barra de progresso ── */
        .pf2-steps {
          display: flex; align-items: center; justify-content: center;
          gap: 0; padding: 1rem 1.25rem;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .pf2-step-item { display: flex; align-items: center; gap: 0; }
        .pf2-step-dot {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          border: 2px solid var(--border);
          background: var(--bg-body);
          color: var(--text-muted);
          transition: all var(--dur-normal);
        }
        .pf2-step-dot--done {
          background: var(--success);
          border-color: var(--success); color: white;
        }
        .pf2-step-dot--active {
          background: var(--primary);
          border-color: var(--primary); color: white;
          box-shadow: 0 0 0 4px var(--primary-light);
          animation: pf2Pulse 2s ease-in-out infinite;
        }
        @keyframes pf2Pulse {
          0%, 100% { box-shadow: 0 0 0 4px var(--primary-light); }
          50% { box-shadow: 0 0 0 7px var(--primary-light); }
        }
        .pf2-step-line {
          width: 40px; height: 2px;
          background: var(--border);
          flex-shrink: 0; margin: 0 4px;
          transition: background var(--dur-normal);
        }
        .pf2-step-line--done { background: var(--success); }
        .pf2-step-label {
          font-size: var(--font-caption); font-weight: var(--fw-medium);
          color: var(--text-muted);
          margin-left: 6px; white-space: nowrap;
          transition: color var(--dur-normal);
        }
        .pf2-step-label--active { color: var(--primary); font-weight: var(--fw-bold); }
        .pf2-step-label--done   { color: var(--success); }

        /* ── Conteúdo ── */
        .pf2-content { flex: 1; padding: 1rem; padding-bottom: 5rem; }
        .step-root { display: flex; flex-direction: column; gap: var(--gap-stack); }

        /* ── Cards ── */
        .pf2-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-card, 18px);
          overflow: hidden;
          padding-bottom: 1rem;
        }
        .pf2-card-eyebrow {
          font-size: var(--font-caption); font-weight: var(--fw-bold); text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-muted);
          padding: 0.85rem 1rem 0;
          margin: 0 0 0.75rem;
        }
        .pf2-card-head-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem 0; margin-bottom: 0.75rem;
        }

        /* ── Campos ── */
        .pf2-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; padding: 0 1rem; }
        .pf2-card > .pf2-field:last-child { padding-bottom: 1rem; }
        .pf2-row   { display: flex; gap: var(--gap-stack); padding: 0 1rem 0.75rem; }
        .pf2-row .pf2-field { padding: 0; }
        .pf2-field:first-child:not(:only-child) .pf2-label,
        .pf2-field:first-child:not(:only-child) .pf2-input { }
        .pf2-label {
          font-size: var(--font-caption); font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          padding: 0;
        }
        .pf2-label ~ .pf2-input,
        .pf2-label ~ div > .pf2-input { /* via wrapper */ }

        /* Quando field está dentro de .pf2-row, o label/input não tem padding lateral */
        .pf2-row .pf2-label  { padding: 0; }
        .pf2-row .pf2-error-msg { padding: 0; }

        .pf2-input {
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.6rem 0.9rem;
          font-size: var(--font-button); font-family: 'Geist', sans-serif;
          color: var(--text-primary);
          background: var(--bg-input);
          outline: none; width: 100%;
          transition: border-color 0.15s, box-shadow var(--dur-fast);
          box-sizing: border-box;
        }
        .pf2-input:focus {
          border-color: var(--primary);
          box-shadow: var(--focus-ring);
        }
        .pf2-input--error  { border-color: var(--error) !important; background: #fff8f8 !important; }
        .pf2-input--readonly {
          background: var(--bg-subtle); cursor: default;
          display: flex; align-items: center;
          border-radius: var(--radius-md);
          padding: 0.6rem 0.9rem;
          font-size: var(--font-button); font-family: 'Geist', sans-serif;
          border: 1.5px solid var(--border);
          box-sizing: border-box; width: 100%;
        }
        .pf2-textarea {
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.6rem 0.9rem;
          font-size: var(--font-button); font-family: 'Geist', sans-serif;
          color: var(--text-primary);
          background: var(--bg-input);
          outline: none; width: 100%; resize: vertical;
          transition: border-color var(--dur-fast);
          box-sizing: border-box;
        }
        .pf2-textarea:focus { border-color: var(--primary); box-shadow: var(--focus-ring); }
        .pf2-error-msg { font-size: var(--font-caption); color: var(--error); font-weight: var(--fw-medium); padding: 0 1rem; }

        /* Campo standalone (dentro do card, sem .pf2-row) */
        .pf2-card > .pf2-field { padding: 0 1rem 0.75rem; }
        .pf2-card > .pf2-field .pf2-label { padding: 0; }

        /* ── Badges ── */
        .pf2-required { color: var(--error); margin-left: 2px; }
        .pf2-badge {
          margin-left: 0.4rem; font-size: var(--font-caption); font-weight: var(--fw-bold);
          padding: 1px 8px; border-radius: var(--radius-full); vertical-align: middle;
        }
        .pf2-badge--ok  { color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; }
        .pf2-badge--new { color: #d97706; background: #fef9c3; border: 1px solid #fde68a; }

        /* ── Dropdown ── */
        .pf2-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg); z-index: 9999;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          max-height: 240px;
        }
        @media (min-width: 768px) {
          .pf2-dropdown { max-height: 160px; overflow-y: auto; }
        }
        .pf2-drop-item {
          width: 100%; display: flex; flex-direction: column; align-items: flex-start;
          padding: 0.6rem 0.9rem; background: none; border: none;
          border-bottom: 1px solid var(--border);
          cursor: pointer; font-family: 'Geist', sans-serif;
          transition: background 0.1s; text-align: left;
        }
        .pf2-drop-item:last-child { border-bottom: none; }
        .pf2-drop-item:hover { background: var(--bg-subtle); }
        .pf2-drop-item--produto { flex-direction: row; align-items: center; gap: var(--gap-tight); }
        .pf2-drop-name { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); }
        .pf2-drop-sub  { font-size: var(--font-helper); color: var(--text-muted); margin-top: 1px; }
        .pf2-drop-empty { padding: 0.65rem 0.9rem; font-size: var(--font-helper); color: var(--text-muted); }
        .pf2-drop-new {
          width: 100%; display: flex; align-items: center; gap: var(--gap-tight);
          padding: 0.65rem 0.9rem;
          background: var(--bg-subtle);
          border: none; border-top: 1px solid var(--border);
          border-radius: 0 0 14px 14px;
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: var(--font-helper); color: var(--primary);
          transition: background 0.1s;
        }
        .pf2-drop-new:hover { background: var(--border); }
        .pf2-drop-new strong { font-weight: var(--fw-bold); }

        /* ── Itens de produto ── */
        .pf2-item {
          display: flex; align-items: center; gap: var(--gap-stack);
          padding: 0.65rem 1rem;
          border-bottom: 1px solid var(--border);
        }
        .pf2-item:last-of-type { border-bottom: none; }
        .pf2-item-img {
          width: 44px; height: 44px; border-radius: var(--radius-md);
          object-fit: cover; flex-shrink: 0;
          border: 1.5px solid var(--border);
        }
        .pf2-item-img--placeholder {
          background: var(--bg-subtle);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--font-modal-title);
        }
        .pf2-item-info { flex: 1; min-width: 0; }
        .pf2-item-name {
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          color: var(--text-title);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 0;
        }
        .pf2-item-meta { font-size: var(--font-helper); color: var(--text-muted); margin: 2px 0 0; }
        .pf2-item-price-unit {
          font-size: var(--font-helper);
          color: var(--text-muted);
          font-weight: var(--fw-medium);
          margin: 2px 0 6px;
        }
        .pf2-item-total { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); flex-shrink: 0; }
        .pf2-item-remove {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: 4px; border-radius: var(--radius-sm);
          transition: color var(--dur-fast); flex-shrink: 0;
          display: flex; align-items: center;
        }
        .pf2-item-remove:hover { color: var(--error); }
        .pf2-subtotal {
          display: flex; justify-content: space-between;
          padding: 0.6rem 1rem;
          font-size: var(--font-helper); color: var(--text-secondary); font-weight: var(--fw-semibold);
          border-top: 1px solid var(--border);
          background: var(--bg-subtle);
        }

        /* Formulário de adicionar item */
        .pf2-add-form {
          padding: 0.85rem 1rem;
          background: var(--bg-subtle);
          border-top: 1px solid var(--border);
          position: relative;
        }
        .pf2-add-form .pf2-field { padding: 0; }
        .pf2-add-actions { display: flex; gap: var(--gap-tight); margin-top: 0.75rem; }

        /* Empty state */
        .pf2-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.4rem; padding: 1.75rem 1rem;
        }
        .pf2-empty-icon { font-size: var(--text-2xl); }
        .pf2-empty-text { font-size: var(--font-button); color: var(--text-muted); margin: 0; }

        /* Botão adicionar produto */
        .pf2-btn-add {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          width: calc(100% - 2rem); margin: 0.65rem 1rem;
          padding: 0.55rem;
          border: 1.5px dashed var(--primary);
          border-radius: var(--radius-md);
          background: none; color: var(--primary);
          font-size: var(--font-helper); font-weight: var(--fw-semibold);
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: background var(--dur-fast);
        }
        .pf2-btn-add:hover { background: var(--primary-light); }

        /* ── Opcionais (checkbox toggle) ── */
        .pf2-optional-toggle {
          display: flex; align-items: center; gap: var(--gap-stack);
          padding: 0.7rem 1rem;
          border-top: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.12s;
          user-select: none;
        }
        .pf2-optional-toggle:hover { background: var(--bg-subtle); }
        .pf2-optional-toggle--on { background: var(--bg-subtle); }
        .pf2-check {
          width: 18px; height: 18px; border-radius: var(--radius-sm); flex-shrink: 0;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          display: flex; align-items: center; justify-content: center;
          transition: all var(--dur-fast);
        }
        .pf2-check--on { background: var(--primary); border-color: var(--primary); }
        .pf2-opt-label { font-size: var(--font-helper); font-weight: var(--fw-medium); color: var(--text-secondary); flex: 1; }
        .pf2-opt-badge {
          font-size: var(--font-caption); font-weight: var(--fw-semibold);
          background: var(--primary-light);
          color: var(--primary);
          padding: 2px 8px; border-radius: var(--radius-full);
          white-space: nowrap; max-width: 120px;
          overflow: hidden; text-overflow: ellipsis;
        }
        .pf2-optional-body {
          padding: 0.85rem 1rem;
          background: var(--bg-subtle);
          border-top: 1px solid var(--border);
          display: flex; flex-direction: column; gap: var(--gap-stack);
          animation: pf2Expand 0.18s ease;
        }
        .pf2-optional-body .pf2-field  { padding: 0; }
        .pf2-optional-body .pf2-label  { padding: 0; }
        .pf2-optional-body .pf2-row    { padding: 0; }
        @keyframes pf2Expand {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Toggle tipo de entrega ── */
        .pf2-toggle-group { display: flex; gap: var(--gap-tight); padding: 0 1rem 0.85rem; }
        .pf2-toggle-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          padding: 0.55rem 0.75rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-full);
          background: var(--bg-body);
          font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-secondary); cursor: pointer;
          transition: all var(--dur-fast);
        }
        .pf2-toggle-btn--on {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--primary); font-weight: var(--fw-bold);
        }

        /* ── Pagamento ── */
        .pf2-pay-grid {
          display: grid; grid-template-columns: repeat(5, 1fr);
          gap: 0.4rem; padding: 0 1rem 0.75rem;
        }
        .pf2-pay-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
          padding: 0.5rem 0.2rem;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-body);
          font-family: 'Geist', sans-serif;
          font-size: var(--font-caption); font-weight: var(--fw-medium); color: var(--text-secondary);
          cursor: pointer; transition: all var(--dur-fast);
        }
        .pf2-pay-btn:hover { border-color: var(--primary); color: var(--primary); }
        .pf2-pay-btn--on {
          border-color: var(--primary);
          background: var(--primary-light);
          color: var(--primary); font-weight: var(--fw-bold);
        }
        .pf2-pag-badge {
          display: flex; align-items: center; gap: 5px;
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          padding: 3px 10px; border-radius: var(--radius-full);
        }
        .pf2-pag-dot { width: 7px; height: 7px; border-radius: 50%; }

        /* ── Total bar ── */
        .pf2-total-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--primary-dark);
          border-radius: var(--radius-card, 18px);
          padding: 1rem 1.25rem;
        }
        .pf2-total-label {
          font-size: var(--font-caption); font-weight: var(--fw-semibold); text-transform: uppercase;
          letter-spacing: 0.06em; color: rgba(255,255,255,0.65); margin: 0;
        }
        .pf2-total-original {
          font-size: var(--font-helper); color: rgba(255,255,255,0.4);
          text-decoration: line-through; margin: 2px 0 0;
        }
        .pf2-total-value {
          font-size: var(--text-2xl); font-weight: var(--fw-black); color: #fff;
          letter-spacing: -0.02em; margin: 0;
        }

        /* ── Resumo financeiro ── */
        .pf2-resumo {
          border: 1.5px solid var(--border);
          border-radius: var(--radius-card, 18px); overflow: hidden;
        }
        .pf2-resumo-row {
          display: flex; justify-content: space-between;
          padding: 0.55rem 1rem;
          font-size: var(--font-helper); color: var(--text-secondary);
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .pf2-resumo-row--desconto { color: var(--success); background: #f0fdf4; font-weight: var(--fw-semibold); }
        .pf2-resumo-total {
          display: flex; justify-content: space-between;
          padding: 0.75rem 1rem;
          font-size: var(--font-button); font-weight: var(--fw-bold);
          background: var(--bg-subtle);
          color: var(--text-title);
        }

        /* ── Botões ── */
        .pf2-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          background: var(--btn-primary-bg, var(--primary));
          color: var(--btn-primary-text, #fff);
          border: none; border-radius: var(--radius-md);
          padding: 0.75rem 1.25rem;
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: opacity var(--dur-fast); white-space: nowrap;
        }
        .pf2-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .pf2-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf2-btn-salvar {
          display: flex; align-items: center; justify-content: center;
          background: var(--success); color: #fff;
          border: none; border-radius: var(--radius-md);
          padding: 0.75rem 1.25rem;
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: opacity var(--dur-fast);
        }
        .pf2-btn-salvar:hover:not(:disabled) { opacity: 0.88; }
        .pf2-btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf2-btn-ghost {
          display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 0.75rem 1rem;
          font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-secondary);
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: background var(--dur-fast);
          white-space: nowrap;
        }
        .pf2-btn-ghost:hover:not(:disabled) { background: var(--bg-subtle); }
        .pf2-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Rodapé fixo ── */
        .pf2-footer {
          display: flex; flex-direction: column; gap: 8px;
          padding: 0.85rem 0 0;
        }
        .pf2-footer .pf2-btn-primary { width: 100%; }
        .pf2-btn-back { flex-shrink: 0; }
        .pf2-footer-hint {
          font-size: var(--font-caption); color: var(--text-muted);
          margin: 0; text-align: center;
          display: inline-flex; align-items: center; justify-content: center; gap: 5px;
        }
        .pf2-footer-hint svg { color: var(--text-muted); flex-shrink: 0; }

        /* ── Desktop: layout 2 colunas ── */
        @media (min-width: 768px) {
          .pf2-header { padding: 1rem 2rem; }
          .pf2-steps  { display: none; }
          .pf2-card { overflow: visible; }
          .pf2-content { padding: 1.5rem 2rem; padding-bottom: 2rem; max-width: 100%; }

          /* Wizard oculto no desktop — mostra tudo de uma vez */
          .pf2-desktop-form {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: var(--space-4);
            align-items: start;
          }
          .pf2-desktop-col { display: flex; flex-direction: column; gap: var(--space-4); }

          /* Steps bar mais compacta no desktop */
          .pf2-steps { justify-content: flex-start; gap: 0; }

          /* Footer inline no desktop */
          .pf2-footer { position: static; padding: 0; border: none; box-shadow: none; background: none; margin-top: 1rem; justify-content: flex-end; }
          .pf2-btn-primary { padding: 0.7rem 1.5rem; }
          .pf2-btn-ghost   { padding: 0.7rem 1.25rem; }
          .pf2-btn-salvar  { padding: 0.7rem 1.5rem; flex: none; }

          /* Total bar e resumo largura normal */
          .pf2-total-bar { margin: 0; }
          .pf2-resumo    { margin: 0; }

          /* Pay grid 5 colunas no desktop */
          .pf2-pay-grid { grid-template-columns: repeat(5, 1fr); }
        }

        /* ── Loading ── */
        .pf2-loader { display: flex; align-items: center; justify-content: center; height: 60vh; }
        .pf2-spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--primary-light);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: pf2Spin 0.7s linear infinite;
        }
        @keyframes pf2Spin { to { transform: rotate(360deg); } }

        /* ── Toast ── */
        .pf2-toast {
          position: fixed; bottom: 5rem; left: 50%; transform: translateX(-50%);
          background: var(--text-title); color: #fff;
          padding: 0.65rem 1.25rem; border-radius: var(--radius-full);
          font-size: var(--font-helper); font-family: 'Geist', sans-serif;
          z-index: 300; white-space: nowrap;
          box-shadow: var(--shadow-lg);
          animation: pf2ToastIn 0.2s ease;
        }
        @keyframes pf2ToastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        /* ── Mobile tweaks ── */
        @media (max-width: 640px) {
          .pf2-step-label { display: none; }
          .pf2-step-label--active { display: block; }
          .pf2-step-line { width: 28px; }
          .pf2-pay-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  )
}
