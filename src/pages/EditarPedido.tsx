// ── EditarPedido.tsx ─────────────────────────────────────────────────────────
// Tela de edição de pedido — design novo estilo Dora
// FASE 1: casca (header + tabs + footer sticky)
// Próximas fases preenchem cada tab
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────
type PedidoItem = {
  id?: string
  produto_id?: string | null
  nome_produto: string
  quantidade: number
  valor_unitario: number
  observacoes?: string
  imagem_url?: string | null
}

type Pedido = {
  id: string
  numero?: number
  cliente_id?: string | null
  cliente_nome: string
  cliente_telefone: string
  status: string
  status_pagamento: string
  valor_total: number
  valor_recebido: number
  valor_produtos?: number
  desconto?: number
  acrescimo?: number
  taxa_entrega?: number
  forma_pagamento: string
  tipo_entrega: string
  tipo_venda?: string
  data_entrega: string
  horario_entrega: string
  endereco_rua?: string
  endereco_numero?: string
  endereco_bairro?: string
  endereco_cidade?: string
  endereco_complemento?: string
  observacoes?: string
  origem?: string
  data_prevista_pagamento?: string
  created_at?: string
  pedido_itens?: PedidoItem[]
}

type Tab = 'cliente' | 'itens' | 'valores' | 'pagar'

// ── Utils ─────────────────────────────────────────────────────────────────
function formatMoney(v: number) {
  return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function toTitleCase(s: string): string {
  if (!s) return ''
  const minusc = new Set(['de','da','do','das','dos','e','com','para','a','o','em','na','no'])
  return s.toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && minusc.has(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
}
function formatDataHora(dataStr?: string | null, horaStr?: string | null): string {
  if (!dataStr) return '—'
  const [y, m, d] = dataStr.split('-')
  const hora = horaStr ? ` às ${horaStr.slice(0, 5)}` : ''
  return `${d}/${m}${hora}`
}

// ── Ícones inline ─────────────────────────────────────────────────────────
const I = {
  cal:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clock:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  print:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  home:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  truck:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  hand:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11a1.5 1.5 0 0 1 3 0v3"/><path d="M17 12a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-2c-2 0-2.5-.4-4-2l-3.5-3.5C4 15.6 4.5 14 6 14h1"/><path d="M11 11V6a1.5 1.5 0 0 0-3 0v9"/></svg>,
  menu:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  user:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  box:    () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  dollar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  card:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  chevL:  () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function EditarPedido() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [tab, setTab] = useState<Tab>('cliente')

  // ── Load do pedido ───────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    let cancelado = false
    ;(async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*, pedido_itens(*)')
        .eq('id', id)
        .single()
      if (cancelado) return
      if (error || !data) {
        alert('Não foi possível carregar o pedido.')
        navigate('/pedidos')
        return
      }
      setPedido(data as Pedido)
      setCarregando(false)
    })()
    return () => { cancelado = true }
  }, [id])

  const totalItens = pedido?.pedido_itens?.length || 0
  const total = pedido?.valor_total || 0
  const origemLabel = pedido?.origem === 'cardapio' ? 'Cardápio' : 'Manual'
  const tipoEntregaIcon = pedido?.tipo_entrega === 'entrega' ? I.truck : I.home

  // ── Handler de salvar (próxima fase preenche) ────────────────────────
  const handleSalvar = async () => {
    setSalvando(true)
    // TODO: Fase 6 — UPDATE no pedido + reinserir itens
    alert('Salvar alterações — próxima fase')
    setSalvando(false)
  }

  // ── Loading state ────────────────────────────────────────────────────
  if (carregando || !pedido) {
    return (
      <div className="ep-loading">
        <div className="ep-spinner" />
        <p>Carregando pedido...</p>
        <style>{`
          .ep-loading { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #888780; font-family: var(--font-base) !important; }
          .ep-spinner { width: 32px; height: 32px; border: 3px solid #F1EFE8; border-top-color: #E85A8C; border-radius: 50%; animation: epspin 0.8s linear infinite; }
          @keyframes epspin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="ep-wrap">
      {/* ═══ HEADER STICKY ═══ */}
      <div className="ep-header">
        <div className="ep-header-top">
          <button className="ep-back" onClick={() => navigate('/pedidos')} aria-label="Voltar">
            <I.chevL />
          </button>
          <div className="ep-header-title-wrap">
            <div className="ep-header-title">
              <I.cal />
              Editar Pedido <span className="ep-num">#{pedido.numero || '—'}</span>
            </div>
          </div>
          <div className="ep-header-actions">
            <button className="ep-icon-btn" aria-label="Timeline" title="Acompanhar pedido">
              <I.clock />
            </button>
            <button className="ep-icon-btn" aria-label="Exportar PDF" title="Exportar PDF">
              <I.print />
            </button>
          </div>
        </div>

        <div className="ep-header-info">
          <div className="ep-header-cliente">
            {pedido.cliente_nome ? toTitleCase(pedido.cliente_nome) : <span className="ep-cliente-vazio">Cliente não informado</span>}
          </div>
          <div className="ep-header-meta">
            <span className="ep-header-meta-item">
              {tipoEntregaIcon()}
              {formatDataHora(pedido.data_entrega, pedido.horario_entrega)}
            </span>
            <span className="ep-tag-origem">
              {pedido.origem === 'cardapio' ? <I.menu /> : <I.hand />}
              {origemLabel}
            </span>
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div className="ep-tabs">
          <button className={`ep-tab ${tab === 'cliente' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('cliente')}>
            <I.user />
            <span>Cliente</span>
          </button>
          <button className={`ep-tab ${tab === 'itens' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('itens')}>
            <I.box />
            <span>Itens {totalItens > 0 && <span className="ep-tab-badge">({totalItens})</span>}</span>
          </button>
          <button className={`ep-tab ${tab === 'valores' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('valores')}>
            <I.dollar />
            <span>Valores</span>
          </button>
          <button className={`ep-tab ${tab === 'pagar' ? 'ep-tab--ativa' : ''}`} onClick={() => setTab('pagar')}>
            <I.card />
            <span>Pagar</span>
          </button>
        </div>
      </div>

      {/* ═══ BODY (conteúdo da tab) ═══ */}
      <div className="ep-body">
        {tab === 'cliente'  && <TabPlaceholder titulo="Informações do Cliente" descricao="Aqui vai o formulário de cliente, status/entrega, data. (Fase 2)" />}
        {tab === 'itens'    && <TabPlaceholder titulo="Itens do Pedido" descricao="Aqui vai a lista de itens com adicionar/remover. (Fase 3)" />}
        {tab === 'valores'  && <TabPlaceholder titulo="Valores" descricao="Desconto, acréscimo, taxa de entrega, total. (Fase 4)" />}
        {tab === 'pagar'    && <TabPlaceholder titulo="Pagamento" descricao="Forma de pagamento e situação (total/parcial/fiado). (Fase 5)" />}
      </div>

      {/* ═══ FOOTER STICKY ═══ */}
      <div className="ep-footer">
        <div className="ep-footer-total">
          <span className="ep-footer-total-label">Total:</span>
          <span className="ep-footer-total-val">{formatMoney(total)}</span>
        </div>
        <div className="ep-footer-btns">
          <button className="ep-btn ep-btn--ghost" onClick={() => navigate('/pedidos')} disabled={salvando}>
            Cancelar
          </button>
          <button className="ep-btn ep-btn--primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* ═══ STYLES ═══ */}
      <style>{`
        .ep-wrap {
          min-height: 100vh;
          background: #F8F5F1;
          padding-bottom: 120px;
          font-family: var(--font-base) !important;
        }

        /* ── HEADER ────────────────────────────────────────────────── */
        .ep-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #fff;
          border-bottom: 1px solid #F1EFE8;
        }
        .ep-header-top {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 12px 4px;
        }
        .ep-back {
          all: unset;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2C2C2A;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .ep-back:hover { background: #F5F1F3; }
        .ep-header-title-wrap {
          flex: 1;
          min-width: 0;
        }
        .ep-header-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          font-family: var(--font-base) !important;
        }
        .ep-num { color: #888780; font-weight: 700; }
        .ep-header-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .ep-icon-btn {
          all: unset;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5F5E5A;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .ep-icon-btn:hover { background: #F5F1F3; color: #2C2C2A; }

        .ep-header-info {
          padding: 4px 16px 12px;
        }
        .ep-header-cliente {
          font-size: 14px;
          font-weight: 600;
          color: #2C2C2A;
          letter-spacing: -0.005em;
          font-family: var(--font-base) !important;
        }
        .ep-cliente-vazio { color: #B4B2A9; font-style: italic; font-weight: 500; }
        .ep-header-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: 6px;
        }
        .ep-header-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #5F5E5A;
          font-family: var(--font-base) !important;
        }
        .ep-tag-origem {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: #F1EFE8;
          color: #5F5E5A;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
          font-family: var(--font-base) !important;
        }

        /* ── TABS ──────────────────────────────────────────────────── */
        .ep-tabs {
          display: flex;
          gap: 0;
          border-top: 1px solid #F1EFE8;
          background: #fff;
        }
        .ep-tab {
          all: unset;
          flex: 1;
          padding: 10px 4px;
          text-align: center;
          font-size: 12.5px;
          font-weight: 600;
          color: #888780;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          border-bottom: 2px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          font-family: var(--font-base) !important;
        }
        .ep-tab:hover { color: #5F5E5A; }
        .ep-tab--ativa {
          color: #E85A8C;
          border-bottom-color: #E85A8C;
          font-weight: 700;
        }
        .ep-tab-badge {
          font-weight: 700;
        }

        /* ── BODY ──────────────────────────────────────────────────── */
        .ep-body {
          padding: 16px 12px;
        }

        /* ── FOOTER ────────────────────────────────────────────────── */
        .ep-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 20;
          background: #fff;
          border-top: 1px solid #F1EFE8;
          padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
          box-shadow: 0 -4px 12px rgba(0,0,0,0.04);
        }
        .ep-footer-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
          font-family: var(--font-base) !important;
        }
        .ep-footer-total-label {
          font-size: 13px;
          color: #5F5E5A;
          font-weight: 600;
        }
        .ep-footer-total-val {
          font-size: 18px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .ep-footer-btns {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 8px;
        }
        .ep-btn {
          all: unset;
          box-sizing: border-box;
          text-align: center;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
          font-family: var(--font-base) !important;
        }
        .ep-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ep-btn--ghost {
          background: #F1EFE8;
          color: #2C2C2A;
        }
        .ep-btn--ghost:hover:not(:disabled) { background: #E8E5DC; }
        .ep-btn--primary {
          background: #E85A8C;
          color: #fff;
        }
        .ep-btn--primary:hover:not(:disabled) { background: #C33A6E; }

        /* Placeholder de fase */
        .ep-placeholder {
          background: #fff;
          border: 1px dashed #E8E5DC;
          border-radius: 14px;
          padding: 32px 20px;
          text-align: center;
        }
        .ep-placeholder-t {
          font-size: 15px;
          font-weight: 700;
          color: #2C2C2A;
          margin: 0 0 6px;
          font-family: var(--font-base) !important;
        }
        .ep-placeholder-d {
          font-size: 13px;
          color: #888780;
          margin: 0;
          font-family: var(--font-base) !important;
        }
      `}</style>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER TEMPORÁRIO (será substituído nas próximas fases)
// ═════════════════════════════════════════════════════════════════════════════
function TabPlaceholder({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="ep-placeholder">
      <p className="ep-placeholder-t">{titulo}</p>
      <p className="ep-placeholder-d">{descricao}</p>
    </div>
  )
}
