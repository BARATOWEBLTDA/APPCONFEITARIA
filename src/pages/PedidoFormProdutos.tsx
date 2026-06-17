import { useState, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { type Pedido, type PedidoItem, EMPTY_ITEM, formatMoney } from '@/pages/pedidoFormTypes'

type Props = {
  pedido: Pedido
  set: (field: keyof Pedido, value: any) => void
  itens: PedidoItem[]
  setItens: React.Dispatch<React.SetStateAction<PedidoItem[]>>
  produtos: any[]
  onNext: () => void
  onBack: () => void
}

// ── Modal de produto (desktop) ───────────────────────────────────────────────
function ProdutoModal({ produtos, onSelect, onClose }: {
  produtos: any[]
  onSelect: (p: any) => void
  onClose: () => void
}) {
  const [busca, setBusca] = useState('')
  const [selecionado, setSelecionado] = useState<any>(null)

  const filtrados = produtos.filter(p =>
    !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
  )

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
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
        width: 500, maxWidth: '90vw',
        background: 'var(--bg-card,#fff)',
        borderRadius: 18,
        border: '1.5px solid var(--border,#ECC2D0)',
        boxShadow: '0 24px 64px rgba(67,21,36,0.18)',
        zIndex: 1001,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '80vh',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.85rem', borderBottom: '1px solid var(--border,#ECC2D0)' }}>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-title,#431524)', fontFamily: "'Geist',sans-serif" }}>Adicionar produto</p>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--border,#ECC2D0)', background: 'var(--bg-subtle,#F7EEF1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary,#6E3548)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border,#ECC2D0)', background: 'var(--bg-subtle,#F7EEF1)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted,#C39EAA)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            autoFocus
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar produto..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.9rem', fontFamily: "'Geist',sans-serif", color: 'var(--text-primary,#431524)', background: 'transparent' }}
          />
          {busca && (
            <button onClick={() => setBusca('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted,#C39EAA)', display: 'flex', padding: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtrados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted,#C39EAA)', fontSize: '0.85rem' }}>Nenhum produto encontrado</div>
          ) : filtrados.map(p => (
            <button
              key={p.id}
              onClick={() => setSelecionado(selecionado?.id === p.id ? null : p)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.85rem 1.25rem',
                border: 'none', borderBottom: '1px solid var(--border,#ECC2D0)',
                background: selecionado?.id === p.id ? 'var(--primary-light,#F7EEF1)' : 'var(--bg-card,#fff)',
                cursor: 'pointer', transition: 'background 0.1s',
                textAlign: 'left', fontFamily: "'Geist',sans-serif",
              }}
            >
              {p.imagem_url
                ? <img src={p.imagem_url} alt={p.nome} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border,#ECC2D0)' }} />
                : <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-subtle,#F7EEF1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>🎂</div>
              }
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-title,#431524)' }}>{p.nome}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--primary,#986274)', fontWeight: 600 }}>{(p.preco_normal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selecionado?.id === p.id ? 'var(--primary,#986274)' : 'var(--border,#ECC2D0)'}`,
                background: selecionado?.id === p.id ? 'var(--primary,#986274)' : 'transparent',
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
        <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border,#ECC2D0)', background: 'var(--bg-subtle,#F7EEF1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary,#6E3548)', fontFamily: "'Geist',sans-serif" }}>
            {selecionado ? <><strong style={{ color: 'var(--text-title,#431524)' }}>{selecionado.nome}</strong> selecionado</> : 'Selecione um produto'}
          </p>
          <button
            disabled={!selecionado}
            onClick={() => selecionado && onSelect(selecionado)}
            style={{
              background: selecionado ? 'var(--primary,#986274)' : 'var(--border,#ECC2D0)',
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
              <p className="pf2-item-meta">{item.quantidade}x {formatMoney(item.valor_unitario)}</p>
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
              /* Busca de produto */
              <div className="pf2-field" style={{ position: 'relative' }}>
                <label className="pf2-label">Produto *</label>
                <input
                  className="pf2-input"
                  placeholder="Buscar produto cadastrado..."
                  value={buscaProduto}
                  onChange={e => { setBuscaProduto(e.target.value); setShowProdDrop(true) }}
                  onFocus={() => setShowProdDrop(true)}
                  onBlur={() => setTimeout(() => setShowProdDrop(false), 180)}
                  autoComplete="off"
                />
                {showProdDrop && (
                  <div className="pf2-dropdown" onMouseDown={e => e.preventDefault()}>
                    {prodsFiltrados.length > 0 ? prodsFiltrados.map(p => (
                      <button
                        key={p.id}
                        className="pf2-drop-item pf2-drop-item--produto"
                        onMouseDown={() => {
                          setNovoItem(prev => ({
                            ...prev,
                            produto_id: p.id,
                            nome_produto: p.nome,
                            valor_unitario: p.preco_normal || 0,
                            imagem_url: p.imagem_url || '',
                          }))
                          setBuscaProduto('')
                          setShowProdDrop(false)
                          if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
                        }}
                      >
                        {p.imagem_url
                          ? <img src={p.imagem_url} alt={p.nome} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-subtle,#F7EEF1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎂</div>
                        }
                        <div style={{ flex: 1 }}>
                          <div className="pf2-drop-name">{p.nome}</div>
                          <div className="pf2-drop-sub" style={{ color: 'var(--primary,#986274)', fontWeight: 600 }}>{formatMoney(p.preco_normal)}</div>
                        </div>
                      </button>
                    )) : (
                      <div className="pf2-drop-empty">Nenhum produto encontrado</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Produto selecionado — card + quantidade */
              <>
                <div className="pf2-add-produto-selecionado">
                  {novoItem.imagem_url
                    ? <img src={novoItem.imagem_url} alt={novoItem.nome_produto} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-subtle,#F7EEF1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎂</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-title,#431524)' }}>{novoItem.nome_produto}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--primary,#986274)', fontWeight: 600 }}>{formatMoney(novoItem.valor_unitario)} / un.</p>
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
                      onClick={() => setNovoItem(p => ({ ...p, quantidade: Math.max(0.5, parseFloat((p.quantidade - 0.5).toFixed(1))) }))}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <span className="pf2-stepper-val">{novoItem.quantidade}</span>
                    <button
                      type="button"
                      className="pf2-stepper-btn"
                      onClick={() => setNovoItem(p => ({ ...p, quantidade: parseFloat((p.quantidade + 0.5).toFixed(1)) }))}
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
            onSelect={(p) => {
              setItens(prev => [...prev, {
                ...EMPTY_ITEM,
                produto_id: p.id,
                nome_produto: p.nome,
                valor_unitario: p.preco_normal || 0,
                imagem_url: p.imagem_url || '',
                quantidade: 1,
              }])
              setShowModal(false)
            }}
            onClose={() => setShowModal(false)}
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
        .pf2-add-produto-selecionado {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          background: var(--bg-card,#fff);
          border: 1.5px solid var(--border,#ECC2D0);
          border-radius: 12px;
        }
        .pf2-stepper {
          display: flex; align-items: center;
          border: 1.5px solid var(--border,#ECC2D0);
          border-radius: 12px; overflow: hidden;
          width: fit-content;
        }
        .pf2-stepper-btn {
          width: 44px; height: 44px;
          background: var(--bg-subtle,#F7EEF1);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--primary,#986274); transition: background 0.15s;
        }
        .pf2-stepper-btn:hover { background: #ECC2D0; }
        .pf2-stepper-val {
          min-width: 52px; text-align: center;
          font-size: 1rem; font-weight: 700;
          color: var(--text-title,#431524);
          font-family: 'Geist',sans-serif;
          border-left: 1px solid var(--border,#ECC2D0);
          border-right: 1px solid var(--border,#ECC2D0);
          padding: 0 8px; line-height: 44px;
        }
        @media (min-width: 768px) {
          .pf2-add-form { overflow: visible; }
          .step-root .pf2-card { overflow: visible; }
          .pf2-dropdown { z-index: 9999; max-height: 160px !important; overflow-y: auto !important; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        }
      `}</style>
    </div>
  )
}
