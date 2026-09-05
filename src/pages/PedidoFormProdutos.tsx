import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { type Pedido, type PedidoItem, EMPTY_ITEM, formatMoney, getQuantityStep } from '@/pages/pedidoFormTypes'

type Props = {
  pedido: Pedido
  set: (field: keyof Pedido, value: any) => void
  itens: PedidoItem[]
  setItens: React.Dispatch<React.SetStateAction<PedidoItem[]>>
  produtos: any[]
  onNext: () => void
  onBack: () => void
}

// ── Bottom Sheet de produto (mobile) ─────────────────────────────────────────
function ProdutoSheet({ produtos, onSelect, onClose }: {
  produtos: any[]
  onSelect: (p: any) => void
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')

  const filtrados = produtos.filter(p =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  useEffect(() => {
    // Trava scroll do fundo
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  return (
    <>
      <div className="ps-overlay" onClick={onClose} />
      <div className="ps-sheet" role="dialog" aria-modal="true" aria-label="Escolher produto">
        <div className="ps-handle" />
        <div className="ps-header">
          <p className="ps-title">Escolher produto</p>
          <button className="ps-close" onClick={onClose} aria-label="Fechar" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="ps-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="ps-search-input"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            autoFocus
          />
          {busca && (
            <button className="ps-search-clear" onClick={() => setBusca('')} type="button" aria-label="Limpar busca">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        <div className="ps-list">
          {filtrados.length > 0 ? filtrados.map(p => (
            <button
              key={p.id}
              className="ps-row"
              onClick={() => { onSelect(p); onClose() }}
              type="button"
            >
              {p.imagem_url
                ? <img src={p.imagem_url} alt={p.nome} className="ps-row-img" />
                : <div className="ps-row-img ps-row-img--empty">🎂</div>
              }
              <div className="ps-row-info">
                <p className="ps-row-name">{p.nome}</p>
                <p className="ps-row-price">{formatMoney(p.preco_normal)}</p>
              </div>
              <span className="ps-row-plus" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
            </button>
          )) : (
            <div className="ps-empty">
              <span className="ps-empty-icon">🔍</span>
              <p className="ps-empty-txt">{busca ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
              {busca && <p className="ps-empty-sub">Tente buscar com outro nome</p>}
            </div>
          )}
        </div>

        <style>{`
          .ps-overlay {
            position: fixed; inset: 0;
            background: rgba(45, 31, 38, 0.55);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            z-index: 200;
            animation: psFadeIn 0.2s ease;
          }
          @keyframes psFadeIn { from { opacity: 0; } to { opacity: 1; } }

          .ps-sheet {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: var(--bg-card);
            border-radius: 20px 20px 0 0;
            z-index: 201;
            max-height: 82vh;
            display: flex; flex-direction: column;
            box-shadow: 0 -8px 32px rgba(0,0,0,0.18);
            animation: psSlideUp 0.28s cubic-bezier(0.32, 0.72, 0, 1);
            font-family: 'Geist', sans-serif;
          }
          @keyframes psSlideUp {
            from { transform: translateY(100%); }
            to   { transform: translateY(0); }
          }

          .ps-handle {
            width: 40px; height: 4px; border-radius: 999px;
            background: var(--border);
            margin: 10px auto 4px;
            flex-shrink: 0;
          }
          .ps-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 16px 8px 20px;
            flex-shrink: 0;
          }
          .ps-title {
            margin: 0;
            font-size: 15px;
            font-weight: 800;
            color: var(--text-title);
          }
          .ps-close {
            width: 30px; height: 30px; border-radius: 50%;
            background: var(--bg-subtle); border: none;
            display: flex; align-items: center; justify-content: center;
            color: var(--text-secondary); cursor: pointer;
            transition: background 0.15s;
          }
          .ps-close:hover { background: var(--primary-light); color: var(--primary); }

          .ps-search {
            display: flex; align-items: center; gap: 8px;
            padding: 10px 14px;
            margin: 0 16px 8px;
            background: var(--primary-light);
            border-radius: 12px;
            color: var(--primary-dark);
            flex-shrink: 0;
          }
          .ps-search-input {
            border: none; background: none; outline: none;
            flex: 1; font-size: 14px;
            color: var(--text-title);
            font-family: inherit;
          }
          .ps-search-input::placeholder { color: var(--text-muted); }
          .ps-search-clear {
            width: 22px; height: 22px; border-radius: 50%;
            background: rgba(255,255,255,0.7); border: none;
            color: var(--text-secondary); cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }

          .ps-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 8px 20px;
            overscroll-behavior: contain;
          }
          .ps-list::-webkit-scrollbar { display: none; }

          .ps-row {
            display: flex; align-items: center; gap: 12px;
            width: 100%;
            padding: 10px 12px;
            background: none; border: none;
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
            transition: background 0.15s;
          }
          .ps-row:hover, .ps-row:active { background: var(--primary-light); }
          .ps-row-img {
            width: 48px; height: 48px;
            border-radius: 10px;
            object-fit: cover;
            flex-shrink: 0;
            background: var(--bg-subtle);
          }
          .ps-row-img--empty {
            display: flex; align-items: center; justify-content: center;
            font-size: 22px;
          }
          .ps-row-info { flex: 1; min-width: 0; }
          .ps-row-name {
            margin: 0;
            font-size: 14px;
            font-weight: 700;
            color: var(--text-title);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .ps-row-price {
            margin: 2px 0 0;
            font-size: 12px;
            font-weight: 700;
            color: var(--primary);
          }
          .ps-row-plus {
            width: 32px; height: 32px; border-radius: 50%;
            background: var(--primary); color: #fff;
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
            box-shadow: 0 2px 0 var(--primary-dark);
            transition: transform 0.1s;
          }
          .ps-row:active .ps-row-plus { transform: translateY(1px); box-shadow: 0 1px 0 var(--primary-dark); }

          .ps-empty {
            text-align: center;
            padding: 40px 20px;
          }
          .ps-empty-icon { font-size: 34px; display: block; margin-bottom: 8px; }
          .ps-empty-txt {
            margin: 0;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-secondary);
          }
          .ps-empty-sub {
            margin: 4px 0 0;
            font-size: 12px;
            color: var(--text-muted);
          }
        `}</style>
      </div>
    </>
  )
}

// ── Modal de produto (desktop) ───────────────────────────────────────────────
function ProdutoModal({ produtos, onSelect, onClose }: {
  produtos: any[]
  onSelect: (p: any, quantidade: number) => void
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<any>(null)
  const [quantidade, setQuantidade] = useState(1)
  const step = getQuantityStep(selecionado?.forma_venda)

  const filtrados = produtos.filter(p =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  // Reseta a quantidade sempre que o produto selecionado muda
  useEffect(() => {
    setQuantidade(1)
  }, [selecionado?.id])

  useEffect(() => {
    // Bloqueia scroll do fundo
    document.body.style.overflow = 'hidden'
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  return (
    <>
      {/* Overlay com blur */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(67, 21, 36, 0.25)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 520, maxWidth: '90vw',
        height: 520,
        background: 'var(--bg-card)',
        borderRadius: 18,
        border: '1.5px solid var(--border)',
        boxShadow: '0 24px 64px rgba(67,21,36,0.18)',
        zIndex: 1001,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.85rem', borderBottom: '1px solid var(--border)' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-title)', fontFamily: "'Geist',sans-serif" }}>Adicionar produto</p>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--bg-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem', fontFamily: "'Geist',sans-serif", color: 'var(--text-primary)', background: 'transparent' }}
          />
          {busca && (
            <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum produto encontrado</div>
          ) : filtrados.map(p => (
            <button
              key={p.id}
              onClick={() => setSelecionado(selecionado?.id === p.id ? null : p)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.85rem 1.25rem',
                border: 'none', borderBottom: '1px solid var(--border)',
                background: selecionado?.id === p.id ? 'var(--primary-light)' : 'var(--bg-card)',
                cursor: 'pointer', transition: 'background 0.1s',
                textAlign: 'left', fontFamily: "'Geist',sans-serif",
              }}
            >
              {p.imagem_url
                ? <img src={p.imagem_url} alt={p.nome} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
                : <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🎂</div>
              }
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-title)' }}>{p.nome}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>{(p.preco_normal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selecionado?.id === p.id ? 'var(--primary)' : 'var(--border)'}`,
                background: selecionado?.id === p.id ? 'var(--primary)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {selecionado?.id === p.id && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
            </button>
          ))}
        </div>
        {/* Footer */}
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: "'Geist',sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selecionado ? <><strong style={{ color: 'var(--text-title)' }}>{selecionado.nome}</strong> selecionado</> : 'Selecione um produto'}
            </p>
            {selecionado && (
              <div className="pf2-stepper" style={{ flexShrink: 0 }}>
                <button
                  type="button"
                  className="pf2-stepper-btn"
                  onClick={() => setQuantidade(q => Math.max(step, parseFloat((q - step).toFixed(2))))}
                  aria-label="Diminuir quantidade"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span className="pf2-stepper-val">{quantidade}</span>
                <button
                  type="button"
                  className="pf2-stepper-btn"
                  onClick={() => setQuantidade(q => parseFloat((q + step).toFixed(2)))}
                  aria-label="Aumentar quantidade"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
            )}
          </div>
          <button
            disabled={!selecionado}
            onClick={() => selecionado && onSelect(selecionado, quantidade)}
            style={{
              width: '100%',
              background: selecionado ? 'var(--primary)' : 'var(--border)',
              color: 'white', border: 'none', borderRadius: 10,
              padding: '0.65rem 1.25rem',
              fontSize: '0.88rem', fontWeight: 600,
              fontFamily: "'Geist',sans-serif",
              cursor: selecionado ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            Adicionar produto →
          </button>
        </div>
      </div>
    </>
  )
}

export default function StepProdutos({ pedido, set, itens, setItens, produtos, onNext, onBack }: Props) {
  const isMobile = useIsMobile()
  const [showModal, setShowModal] = useState(false)
  const [novoItem, setNovoItem] = useState<PedidoItem>({ ...EMPTY_ITEM })
  const [adicionando, setAdicionando] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [showProdDrop, setShowProdDrop] = useState(false)
  const [showProdSheet, setShowProdSheet] = useState(false)
  const [showPersonalizacao, setShowPersonalizacao] = useState(
    !!(pedido.personalizacao_tema || pedido.personalizacao_nome || pedido.personalizacao_cor)
  )
  const [showObs, setShowObs] = useState(!!pedido.observacoes)

  const removerItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx))

  const adicionarItem = () => {
    if (!novoItem.nome_produto) return
    setItens(prev => [...prev, { ...novoItem }])
    setNovoItem({ ...EMPTY_ITEM })
    setBuscaProduto('')
    setAdicionando(false)
  }

  const cancelarAdicao = () => {
    setAdicionando(false)
    setNovoItem({ ...EMPTY_ITEM })
    setBuscaProduto('')
  }

  const prodsFiltrados = produtos.filter(p =>
    !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  ).slice(0, 8)

  // Passo certo pro produto que está sendo adicionado no fluxo mobile
  const novoItemStep = getQuantityStep(produtos.find(p => p.id === novoItem.produto_id)?.forma_venda)

  // Edita a quantidade de um item já lançado na lista, sem precisar remover e adicionar de novo
  const alterarQuantidadeItem = (idx: number, delta: number) => {
    setItens(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const step = getQuantityStep(produtos.find(p => p.id === item.produto_id)?.forma_venda)
      const nova = parseFloat((item.quantidade + delta * step).toFixed(2))
      return { ...item, quantidade: Math.max(step, nova) }
    }))
  }

  const canNext = itens.length > 0

  return (
    <div className="step-root">

      {/* ── Bloco: Produtos ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">O que foi pedido?</p>

        {/* Lista de itens adicionados */}
        {itens.length === 0 && !adicionando && (
          <div className="pf2-empty">
            <span className="pf2-empty-icon">🎂</span>
            <p className="pf2-empty-text">Nenhum produto adicionado</p>
          </div>
        )}

        {itens.map((item, idx) => (
          <div key={idx} className="pf2-item">
            {item.imagem_url
              ? <img src={item.imagem_url} alt={item.nome_produto} className="pf2-item-img" />
              : <div className="pf2-item-img pf2-item-img--placeholder">🎂</div>
            }
            <div className="pf2-item-info">
              <p className="pf2-item-name">{item.nome_produto}</p>
              <div className="pf2-item-qty-row">
                <div className="pf2-item-stepper">
                  <button type="button" onClick={() => alterarQuantidadeItem(idx, -1)} aria-label="Diminuir quantidade">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  <span>{item.quantidade}</span>
                  <button type="button" onClick={() => alterarQuantidadeItem(idx, 1)} aria-label="Aumentar quantidade">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>
                <span className="pf2-item-meta">× {formatMoney(item.valor_unitario)}</span>
              </div>
            </div>
            <span className="pf2-item-total">{formatMoney(item.valor_unitario * item.quantidade)}</span>
            <button className="pf2-item-remove" onClick={() => removerItem(idx)} aria-label="Remover">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}

        {/* Formulário de novo item */}
        {adicionando && (
          <div className="pf2-add-form">
            {!novoItem.nome_produto ? (
              /* Trigger que abre o bottom sheet */
              <div className="pf2-field">
                <label className="pf2-label">Produto *</label>
                <button
                  type="button"
                  className="pf2-input pf2-produto-trigger"
                  onClick={() => setShowProdSheet(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)', flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <span style={{ color: 'var(--text-muted)' }}>Buscar produto...</span>
                </button>
              </div>
            ) : (
              /* Produto selecionado — card + quantidade */
              <>
                <div className="pf2-add-produto-selecionado">
                  {novoItem.imagem_url
                    ? <img src={novoItem.imagem_url} alt={novoItem.nome_produto} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎂</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-title)' }}>{novoItem.nome_produto}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>{formatMoney(novoItem.valor_unitario)} / un.</p>
                  </div>
                  <button className="pf2-item-remove" onClick={() => { setNovoItem({ ...EMPTY_ITEM }); setBuscaProduto('') }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>

                <div style={{ marginTop: '0.85rem' }}>
                  <label className="pf2-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Quantidade</label>
                  <div className="pf2-stepper">
                    <button
                      type="button"
                      className="pf2-stepper-btn"
                      onClick={() => setNovoItem(p => ({ ...p, quantidade: Math.max(novoItemStep, parseFloat((p.quantidade - novoItemStep).toFixed(2))) }))}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span className="pf2-stepper-val">{novoItem.quantidade}</span>
                    <button
                      type="button"
                      className="pf2-stepper-btn"
                      onClick={() => setNovoItem(p => ({ ...p, quantidade: parseFloat((p.quantidade + novoItemStep).toFixed(2)) }))}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="pf2-add-actions">
              <button className="pf2-btn-primary" onClick={adicionarItem} disabled={!novoItem.nome_produto}>
                Adicionar
              </button>
              <button className="pf2-btn-ghost" onClick={cancelarAdicao}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Subtotal */}
        {itens.length > 0 && (
          <div className="pf2-subtotal">
            <span>Subtotal</span>
            <span>{formatMoney(pedido.valor_produtos)}</span>
          </div>
        )}

        {/* Botão adicionar */}
        {!adicionando && (
          <button className="pf2-btn-add" onClick={() => isMobile ? setAdicionando(true) : setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {itens.length === 0 ? 'Adicionar produto' : 'Adicionar outro'}
          </button>
        )}

        {/* Modal de produto — desktop only */}
        {showModal && (
          <ProdutoModal
            produtos={produtos}
            onSelect={(p, quantidade) => {
              setItens(prev => [...prev, {
                ...EMPTY_ITEM,
                produto_id: p.id,
                nome_produto: p.nome,
                valor_unitario: p.preco_normal || 0,
                imagem_url: p.imagem_url || '',
                quantidade,
              }])
              setShowModal(false)
            }}
            onClose={() => setShowModal(false)}
          />
        )}

        {/* Bottom Sheet de produto — mobile */}
        {showProdSheet && (
          <ProdutoSheet
            produtos={produtos}
            onSelect={(p) => {
              setNovoItem(prev => ({
                ...prev,
                produto_id: p.id,
                nome_produto: p.nome,
                valor_unitario: p.preco_normal || 0,
                imagem_url: p.imagem_url || '',
              }))
              setBuscaProduto('')
              setShowProdSheet(false)
            }}
            onClose={() => setShowProdSheet(false)}
          />
        )}

        {/* Opcional: Personalização */}
        <div
          className={`pf2-optional-toggle${showPersonalizacao ? ' pf2-optional-toggle--on' : ''}`}
          style={{ marginTop: '0.5rem' }}
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
          <div className={`pf2-check${showPersonalizacao ? ' pf2-check--on' : ''}`}>
            {showPersonalizacao && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Personalização (tema, nome, cor…)</span>
          {(pedido.personalizacao_tema || pedido.personalizacao_nome) && !showPersonalizacao && (
            <span className="pf2-opt-badge">{pedido.personalizacao_tema || pedido.personalizacao_nome}</span>
          )}
        </div>
        {showPersonalizacao && (
          <div className="pf2-optional-body">
            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Tema</label>
                <input className="pf2-input" placeholder="Ex: Fazendinha, Frozen..." value={pedido.personalizacao_tema} onChange={e => set('personalizacao_tema', e.target.value)} />
              </div>
              <div className="pf2-field">
                <label className="pf2-label">Nome no bolo</label>
                <input className="pf2-input" placeholder="Ex: Maria" value={pedido.personalizacao_nome} onChange={e => set('personalizacao_nome', e.target.value)} />
              </div>
            </div>
            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Idade</label>
                <input className="pf2-input" placeholder="Ex: 5 anos" value={pedido.personalizacao_idade} onChange={e => set('personalizacao_idade', e.target.value)} />
              </div>
              <div className="pf2-field">
                <label className="pf2-label">Cor principal</label>
                <input className="pf2-input" placeholder="Ex: Rosa e dourado" value={pedido.personalizacao_cor} onChange={e => set('personalizacao_cor', e.target.value)} />
              </div>
            </div>
            <div className="pf2-field">
              <label className="pf2-label">Observações de decoração</label>
              <textarea className="pf2-textarea" placeholder="Detalhes extras..." value={pedido.personalizacao_obs} onChange={e => set('personalizacao_obs', e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {/* Opcional: Observação */}
        <div
          className={`pf2-optional-toggle${showObs ? ' pf2-optional-toggle--on' : ''}`}
          onClick={() => { if (showObs) set('observacoes', ''); setShowObs(v => !v) }}
        >
          <div className={`pf2-check${showObs ? ' pf2-check--on' : ''}`}>
            {showObs && <svg width="9" height="9" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span className="pf2-opt-label">Observação do pedido</span>
          {pedido.observacoes && !showObs && <span className="pf2-opt-badge">preenchida</span>}
        </div>
        {showObs && (
          <div className="pf2-optional-body">
            <textarea className="pf2-textarea" placeholder="Anotações sobre o pedido..." value={pedido.observacoes} onChange={e => set('observacoes', e.target.value)} rows={4} />
          </div>
        )}
      </div>

      {/* ── Rodapé ── */}
      <div className="pf2-footer">
        <button className="pf2-btn-ghost pf2-btn-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <button className="pf2-btn-primary" onClick={onNext} disabled={!canNext}>
          Próximo: Pagamento
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      {!canNext && <p className="pf2-footer-hint" style={{ textAlign: 'center', marginTop: '0.4rem' }}>Adicione pelo menos um produto</p>}

      <style>{`@media (min-width: 768px) { .pf2-footer { display: none !important; } }`}</style>

      <style>{`
        /* Trigger que abre o bottom sheet de produto (mobile) */
        .pf2-produto-trigger {
          display: flex !important;
          align-items: center;
          gap: 8px;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
        }
        .pf2-produto-trigger:hover { border-color: var(--primary); }

        .pf2-add-produto-selecionado {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
        }
        .pf2-stepper {
          display: flex; align-items: center;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md); overflow: hidden;
          width: fit-content;
        }
        .pf2-stepper-btn {
          width: 44px; height: 44px;
          background: var(--bg-subtle);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--primary); transition: background var(--dur-fast);
        }
        .pf2-stepper-btn:hover { background: var(--border); }
        .pf2-stepper-val {
          min-width: 52px; text-align: center;
          font-size: var(--font-input); font-weight: var(--fw-bold);
          color: var(--text-title);
          font-family: 'Geist',sans-serif;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
          padding: 0 8px; line-height: 44px;
        }

        /* ── Mini-stepper inline (editar item já lançado) ── */
        .pf2-item-qty-row { display: flex; align-items: center; gap: var(--gap-tight); margin-top: 3px; }
        .pf2-item-qty-row .pf2-item-meta { margin: 0; }
        .pf2-item-stepper {
          display: flex; align-items: center;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm); overflow: hidden; flex-shrink: 0;
        }
        .pf2-item-stepper button {
          width: 20px; height: 20px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-subtle);
          border: none; cursor: pointer; padding: 0;
          color: var(--primary); transition: background var(--dur-fast);
        }
        .pf2-item-stepper button:hover { background: var(--border); }
        .pf2-item-stepper span {
          min-width: 22px; text-align: center;
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          color: var(--text-title);
          font-family: 'Geist',sans-serif;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
          padding: 0 2px;
        }
        @media (min-width: 768px) {
          .pf2-add-form { overflow: visible; }
          .step-root .pf2-card { overflow: visible; }
          .pf2-dropdown { z-index: 9999; max-height: 160px !important; overflow-y: auto !important; border-radius: var(--radius-md); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        }
      `}</style>
    </div>
  )
}
