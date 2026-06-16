import { useState, useEffect } from 'react'
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
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
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

      const { id: _id, numero: _numero, ...pedidoSemId } = pedido as any
      const payload = {
        ...pedidoSemId,
        user_id: userId,
        taxa_entrega: pedido.taxa_entrega || 0,
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
            pedido_id: pedidoId, user_id: userId,
            evento: 'Pedido criado', descricao: 'Pedido criado manualmente',
          })
        }
      }

      if (pedidoId && itens.length > 0) {
        await supabase.from('pedido_itens').delete().eq('pedido_id', pedidoId)
        await supabase.from('pedido_itens').insert(
          itens.map(item => ({ ...item, pedido_id: pedidoId, user_id: userId }))
        )
      }

      if (pedido.cliente_id && pedido.origem) {
        await supabase.from('clientes').update({ como_conheceu: pedido.origem }).eq('id', pedido.cliente_id)
      }

      navigate('/pedidos')
    } catch {
      showToast('Erro ao salvar pedido.')
    }
    setSaving(false)
  }

  const salvarEIniciar = async () => { await salvar(); navigate('/pedidos/novo') }

  // ── Navegação entre steps ────────────────────────────────────────────────
  const goNext = () => {
    if (step === 'cliente')  setStep('produtos')
    if (step === 'produtos') setStep('pagamento')
  }
  const goBack = () => {
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

      {/* ── Conteúdo da etapa ── */}
      <div className="pf2-content">
        {step === 'cliente' && (
          <StepCliente
            pedido={pedido}
            set={set}
            clientes={clientes}
            onNovoCliente={cadastrarNovoCliente}
            onNext={goNext}
          />
        )}
        {step === 'produtos' && (
          <StepProdutos
            pedido={pedido}
            set={set}
            itens={itens}
            setItens={setItens}
            produtos={produtos}
            onNext={goNext}
            onBack={goBack}
          />
        )}
        {step === 'pagamento' && (
          <StepPagamento
            pedido={pedido}
            set={set}
            cupons={cupons}
            saving={saving}
            onSalvar={salvar}
            onSalvarEIniciar={salvarEIniciar}
            onBack={goBack}
            isEdicao={isEdicao}
          />
        )}
      </div>

      {/* ── Toast ── */}
      {toast && <div className="pf2-toast">{toast}</div>}

      <style>{`
        /* ── Reset base ── */
        .pf2-root { font-family: 'Geist', sans-serif; display: flex; flex-direction: column; min-height: 100dvh; background: var(--bg-body, #FAFAFA); }

        /* ── Header ── */
        .pf2-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem;
          background: var(--bg-card, #fff);
          border-bottom: 1px solid var(--border, #ECC2D0);
          position: sticky; top: 0; z-index: 40;
        }
        .pf2-back {
          display: flex; align-items: center; gap: 0.3rem;
          background: none; border: none; cursor: pointer;
          font-size: 0.85rem; font-weight: 500;
          color: var(--text-secondary, #6E3548);
          font-family: 'Geist', sans-serif; padding: 0;
        }
        .pf2-back:hover { color: var(--primary, #986274); }
        .pf2-title {
          font-size: 1.05rem; font-weight: 700;
          color: var(--text-title, #431524); margin: 0;
        }

        /* ── Barra de progresso ── */
        .pf2-steps {
          display: flex; align-items: center; justify-content: center;
          gap: 0; padding: 1rem 1.25rem;
          background: var(--bg-card, #fff);
          border-bottom: 1px solid var(--border, #ECC2D0);
        }
        .pf2-step-item { display: flex; align-items: center; gap: 0; }
        .pf2-step-dot {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem; font-weight: 700;
          border: 2px solid var(--border, #ECC2D0);
          background: var(--bg-body, #FAFAFA);
          color: var(--text-muted, #C39EAA);
          transition: all 0.2s;
        }
        .pf2-step-dot--done {
          background: var(--success, #22C55E);
          border-color: var(--success, #22C55E); color: white;
        }
        .pf2-step-dot--active {
          background: var(--primary, #986274);
          border-color: var(--primary, #986274); color: white;
          box-shadow: 0 0 0 4px var(--primary-light, #F7EEF1);
        }
        .pf2-step-line {
          width: 40px; height: 2px;
          background: var(--border, #ECC2D0);
          flex-shrink: 0; margin: 0 4px;
          transition: background 0.2s;
        }
        .pf2-step-line--done { background: var(--success, #22C55E); }
        .pf2-step-label {
          font-size: 0.72rem; font-weight: 500;
          color: var(--text-muted, #C39EAA);
          margin-left: 6px; white-space: nowrap;
          transition: color 0.2s;
        }
        .pf2-step-label--active { color: var(--primary, #986274); font-weight: 700; }
        .pf2-step-label--done   { color: var(--success, #22C55E); }

        /* ── Conteúdo ── */
        .pf2-content { flex: 1; padding: 1rem; padding-bottom: 6rem; }
        .step-root { display: flex; flex-direction: column; gap: 0.85rem; }

        /* ── Cards ── */
        .pf2-card {
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: var(--radius-card, 18px);
          overflow: hidden;
        }
        .pf2-card-eyebrow {
          font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--text-muted, #C39EAA);
          padding: 0.85rem 1rem 0;
          margin: 0 0 0.75rem;
        }
        .pf2-card-head-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.85rem 1rem 0; margin-bottom: 0.75rem;
        }

        /* ── Campos ── */
        .pf2-field { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
        .pf2-row   { display: flex; gap: 0.65rem; padding: 0 1rem 0.75rem; }
        .pf2-field:first-child:not(:only-child) .pf2-label,
        .pf2-field:first-child:not(:only-child) .pf2-input { }
        .pf2-label {
          font-size: 0.72rem; font-weight: 600;
          color: var(--text-secondary, #6E3548);
          padding: 0 1rem;
        }
        .pf2-label ~ .pf2-input,
        .pf2-label ~ div > .pf2-input { /* via wrapper */ }

        /* Quando field está dentro de .pf2-row, o label/input não tem padding lateral */
        .pf2-row .pf2-label  { padding: 0; }
        .pf2-row .pf2-error-msg { padding: 0; }

        .pf2-input {
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: var(--radius-input, 50px);
          padding: 0.6rem 0.9rem;
          font-size: 0.88rem; font-family: 'Geist', sans-serif;
          color: var(--text-primary, #431524);
          background: var(--bg-input, #fff);
          outline: none; width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .pf2-input:focus {
          border-color: var(--primary, #986274);
          box-shadow: var(--focus-ring);
        }
        .pf2-input--error  { border-color: var(--error, #EF4444) !important; background: #fff8f8 !important; }
        .pf2-input--readonly {
          background: var(--bg-subtle, #F7EEF1); cursor: default;
          display: flex; align-items: center;
          border-radius: var(--radius-input, 50px);
          padding: 0.6rem 0.9rem;
          font-size: 0.88rem; font-family: 'Geist', sans-serif;
          border: 1.5px solid var(--border, #ECC2D0);
          box-sizing: border-box; width: 100%;
        }
        .pf2-textarea {
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: 12px;
          padding: 0.6rem 0.9rem;
          font-size: 0.88rem; font-family: 'Geist', sans-serif;
          color: var(--text-primary, #431524);
          background: var(--bg-input, #fff);
          outline: none; width: 100%; resize: vertical;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .pf2-textarea:focus { border-color: var(--primary, #986274); box-shadow: var(--focus-ring); }
        .pf2-error-msg { font-size: 0.72rem; color: var(--error, #EF4444); font-weight: 500; padding: 0 1rem; }

        /* Campo standalone (dentro do card, sem .pf2-row) */
        .pf2-card > .pf2-field { padding: 0 1rem 0.75rem; }
        .pf2-card > .pf2-field .pf2-label { padding: 0; }

        /* ── Badges ── */
        .pf2-required { color: var(--error, #EF4444); margin-left: 2px; }
        .pf2-badge {
          margin-left: 0.4rem; font-size: 0.68rem; font-weight: 700;
          padding: 1px 8px; border-radius: 999px; vertical-align: middle;
        }
        .pf2-badge--ok  { color: #16a34a; background: #dcfce7; border: 1px solid #bbf7d0; }
        .pf2-badge--new { color: #d97706; background: #fef9c3; border: 1px solid #fde68a; }

        /* ── Dropdown ── */
        .pf2-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: 14px; z-index: 50;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
        }
        .pf2-drop-item {
          width: 100%; display: flex; flex-direction: column; align-items: flex-start;
          padding: 0.6rem 0.9rem; background: none; border: none;
          border-bottom: 1px solid var(--border, #ECC2D0);
          cursor: pointer; font-family: 'Geist', sans-serif;
          transition: background 0.1s; text-align: left;
        }
        .pf2-drop-item:last-child { border-bottom: none; }
        .pf2-drop-item:hover { background: var(--bg-subtle, #F7EEF1); }
        .pf2-drop-item--produto { flex-direction: row; align-items: center; gap: 0.6rem; }
        .pf2-drop-name { font-size: 0.88rem; font-weight: 600; color: var(--text-title, #431524); }
        .pf2-drop-sub  { font-size: 0.75rem; color: var(--text-muted, #C39EAA); margin-top: 1px; }
        .pf2-drop-empty { padding: 0.65rem 0.9rem; font-size: 0.8rem; color: var(--text-muted, #C39EAA); }
        .pf2-drop-new {
          width: 100%; display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 0.9rem;
          background: var(--bg-subtle, #F7EEF1);
          border: none; border-top: 1px solid var(--border, #ECC2D0);
          cursor: pointer; font-family: 'Geist', sans-serif;
          font-size: 0.8rem; color: var(--primary, #986274);
          transition: background 0.1s;
        }
        .pf2-drop-new:hover { background: #ECC2D0; }
        .pf2-drop-new strong { font-weight: 700; }

        /* ── Itens de produto ── */
        .pf2-item {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.65rem 1rem;
          border-bottom: 1px solid var(--border, #ECC2D0);
        }
        .pf2-item:last-of-type { border-bottom: none; }
        .pf2-item-img {
          width: 44px; height: 44px; border-radius: 10px;
          object-fit: cover; flex-shrink: 0;
          border: 1.5px solid var(--border, #ECC2D0);
        }
        .pf2-item-img--placeholder {
          background: var(--bg-subtle, #F7EEF1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem;
        }
        .pf2-item-info { flex: 1; min-width: 0; }
        .pf2-item-name {
          font-size: 0.88rem; font-weight: 600;
          color: var(--text-title, #431524);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin: 0;
        }
        .pf2-item-meta { font-size: 0.75rem; color: var(--text-muted, #C39EAA); margin: 2px 0 0; }
        .pf2-item-total { font-size: 0.9rem; font-weight: 700; color: var(--text-title, #431524); flex-shrink: 0; }
        .pf2-item-remove {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted, #C39EAA); padding: 4px; border-radius: 6px;
          transition: color 0.15s; flex-shrink: 0;
          display: flex; align-items: center;
        }
        .pf2-item-remove:hover { color: var(--error, #EF4444); }
        .pf2-subtotal {
          display: flex; justify-content: space-between;
          padding: 0.6rem 1rem;
          font-size: 0.82rem; color: var(--text-secondary, #6E3548); font-weight: 600;
          border-top: 1px solid var(--border, #ECC2D0);
          background: var(--bg-subtle, #F7EEF1);
        }

        /* Formulário de adicionar item */
        .pf2-add-form {
          padding: 0.85rem 1rem;
          background: var(--bg-subtle, #F7EEF1);
          border-top: 1px solid var(--border, #ECC2D0);
          position: relative;
        }
        .pf2-add-form .pf2-field { padding: 0; }
        .pf2-add-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }

        /* Empty state */
        .pf2-empty {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.4rem; padding: 1.75rem 1rem;
        }
        .pf2-empty-icon { font-size: 1.75rem; }
        .pf2-empty-text { font-size: 0.85rem; color: var(--text-muted, #C39EAA); margin: 0; }

        /* Botão adicionar produto */
        .pf2-btn-add {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          width: calc(100% - 2rem); margin: 0.65rem 1rem;
          padding: 0.55rem;
          border: 1.5px dashed var(--primary, #986274);
          border-radius: var(--radius-btn, 50px);
          background: none; color: var(--primary, #986274);
          font-size: 0.82rem; font-weight: 600;
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: background 0.15s;
        }
        .pf2-btn-add:hover { background: var(--primary-light, #F7EEF1); }

        /* ── Opcionais (checkbox toggle) ── */
        .pf2-optional-toggle {
          display: flex; align-items: center; gap: 0.65rem;
          padding: 0.7rem 1rem;
          border-top: 1px solid var(--border, #ECC2D0);
          cursor: pointer;
          transition: background 0.12s;
          user-select: none;
        }
        .pf2-optional-toggle:hover { background: var(--bg-subtle, #F7EEF1); }
        .pf2-optional-toggle--on { background: var(--bg-subtle, #F7EEF1); }
        .pf2-check {
          width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
          border: 1.5px solid var(--border, #ECC2D0);
          background: var(--bg-card, #fff);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.15s;
        }
        .pf2-check--on { background: var(--primary, #986274); border-color: var(--primary, #986274); }
        .pf2-opt-label { font-size: 0.82rem; font-weight: 500; color: var(--text-secondary, #6E3548); flex: 1; }
        .pf2-opt-badge {
          font-size: 0.7rem; font-weight: 600;
          background: var(--primary-light, #F7EEF1);
          color: var(--primary, #986274);
          padding: 2px 8px; border-radius: 999px;
          white-space: nowrap; max-width: 120px;
          overflow: hidden; text-overflow: ellipsis;
        }
        .pf2-optional-body {
          padding: 0.85rem 1rem;
          background: var(--bg-subtle, #F7EEF1);
          border-top: 1px solid var(--border, #ECC2D0);
          display: flex; flex-direction: column; gap: 0.65rem;
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
        .pf2-toggle-group { display: flex; gap: 0.5rem; padding: 0 1rem 0.85rem; }
        .pf2-toggle-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          padding: 0.55rem 0.75rem;
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: var(--radius-btn, 50px);
          background: var(--bg-body, #FAFAFA);
          font-family: 'Geist', sans-serif; font-size: 0.85rem; font-weight: 500;
          color: var(--text-secondary, #6E3548); cursor: pointer;
          transition: all 0.15s;
        }
        .pf2-toggle-btn--on {
          border-color: var(--primary, #986274);
          background: var(--primary-light, #F7EEF1);
          color: var(--primary, #986274); font-weight: 700;
        }

        /* ── Pagamento ── */
        .pf2-pay-grid {
          display: grid; grid-template-columns: repeat(5, 1fr);
          gap: 0.4rem; padding: 0 1rem 0.75rem;
        }
        .pf2-pay-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
          padding: 0.5rem 0.2rem;
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: 10px;
          background: var(--bg-body, #FAFAFA);
          font-family: 'Geist', sans-serif;
          font-size: 0.68rem; font-weight: 500; color: var(--text-secondary, #6E3548);
          cursor: pointer; transition: all 0.15s;
        }
        .pf2-pay-btn:hover { border-color: var(--primary, #986274); color: var(--primary, #986274); }
        .pf2-pay-btn--on {
          border-color: var(--primary, #986274);
          background: var(--primary-light, #F7EEF1);
          color: var(--primary, #986274); font-weight: 700;
        }
        .pf2-pag-badge {
          display: flex; align-items: center; gap: 5px;
          font-size: 0.72rem; font-weight: 700;
          padding: 3px 10px; border-radius: 999px;
        }
        .pf2-pag-dot { width: 7px; height: 7px; border-radius: 50%; }

        /* ── Total bar ── */
        .pf2-total-bar {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--primary-dark, #6E3548);
          border-radius: var(--radius-card, 18px);
          padding: 1rem 1.25rem;
        }
        .pf2-total-label {
          font-size: 0.72rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.06em; color: rgba(255,255,255,0.65); margin: 0;
        }
        .pf2-total-original {
          font-size: 0.75rem; color: rgba(255,255,255,0.4);
          text-decoration: line-through; margin: 2px 0 0;
        }
        .pf2-total-value {
          font-size: 1.6rem; font-weight: 800; color: #fff;
          letter-spacing: -0.02em; margin: 0;
        }

        /* ── Resumo financeiro ── */
        .pf2-resumo {
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: var(--radius-card, 18px); overflow: hidden;
        }
        .pf2-resumo-row {
          display: flex; justify-content: space-between;
          padding: 0.55rem 1rem;
          font-size: 0.82rem; color: var(--text-secondary, #6E3548);
          background: var(--bg-card, #fff);
          border-bottom: 1px solid var(--border, #ECC2D0);
        }
        .pf2-resumo-row--desconto { color: var(--success, #22C55E); background: #f0fdf4; font-weight: 600; }
        .pf2-resumo-total {
          display: flex; justify-content: space-between;
          padding: 0.75rem 1rem;
          font-size: 0.9rem; font-weight: 700;
          background: var(--bg-subtle, #F7EEF1);
          color: var(--text-title, #431524);
        }

        /* ── Botões ── */
        .pf2-btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 0.4rem;
          background: var(--btn-primary-bg, #986274);
          color: var(--btn-primary-text, #fff);
          border: none; border-radius: var(--radius-btn, 50px);
          padding: 0.75rem 1.25rem;
          font-size: 0.88rem; font-weight: 600;
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: opacity 0.15s; white-space: nowrap;
        }
        .pf2-btn-primary:hover:not(:disabled) { opacity: 0.88; }
        .pf2-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf2-btn-salvar {
          display: flex; align-items: center; justify-content: center;
          background: var(--success, #22C55E); color: #fff;
          border: none; border-radius: var(--radius-btn, 50px);
          padding: 0.75rem 1.25rem;
          font-size: 0.88rem; font-weight: 600;
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: opacity 0.15s;
        }
        .pf2-btn-salvar:hover:not(:disabled) { opacity: 0.88; }
        .pf2-btn-salvar:disabled { opacity: 0.5; cursor: not-allowed; }
        .pf2-btn-ghost {
          display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #ECC2D0);
          border-radius: var(--radius-btn, 50px);
          padding: 0.75rem 1rem;
          font-size: 0.85rem; font-weight: 600; color: var(--text-secondary, #6E3548);
          font-family: 'Geist', sans-serif; cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .pf2-btn-ghost:hover:not(:disabled) { background: var(--bg-subtle, #F7EEF1); }
        .pf2-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── Rodapé fixo ── */
        .pf2-footer {
          position: fixed; bottom: 0; left: 0; right: 0;
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.85rem 1rem;
          background: var(--bg-card, #fff);
          border-top: 1px solid var(--border, #ECC2D0);
          box-shadow: var(--topbar-shadow);
          z-index: 40;
        }
        .pf2-btn-back { flex-shrink: 0; }
        .pf2-footer-hint {
          font-size: 0.72rem; color: var(--text-muted, #C39EAA);
          margin: 0; text-align: center;
        }

        /* ── Desktop: rodapé não-fixo, largura controlada ── */
        @media (min-width: 768px) {
          .pf2-content  { max-width: 640px; margin: 0 auto; }
          .pf2-footer   { position: static; border-top: none; box-shadow: none; padding: 0; background: none; margin-top: 0.5rem; }
          .pf2-total-bar { max-width: 640px; margin: 0 auto; }
          .pf2-resumo   { max-width: 640px; }
        }

        /* ── Loading ── */
        .pf2-loader { display: flex; align-items: center; justify-content: center; height: 60vh; }
        .pf2-spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--primary-light, #F7EEF1);
          border-top-color: var(--primary, #986274);
          border-radius: 50%;
          animation: pf2Spin 0.7s linear infinite;
        }
        @keyframes pf2Spin { to { transform: rotate(360deg); } }

        /* ── Toast ── */
        .pf2-toast {
          position: fixed; bottom: 5rem; left: 50%; transform: translateX(-50%);
          background: var(--text-title, #431524); color: #fff;
          padding: 0.65rem 1.25rem; border-radius: 50px;
          font-size: 0.82rem; font-family: 'Geist', sans-serif;
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
