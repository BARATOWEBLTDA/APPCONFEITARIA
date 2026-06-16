import { useState, useRef } from 'react'
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

export default function StepProdutos({ pedido, set, itens, setItens, produtos, onNext, onBack }: Props) {
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

  const canNext = itens.length > 0

  const prodsFiltrados = produtos.filter(p =>
    !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  ).slice(0, 6)

  return (
    <div className="step-root">

      {/* ── Bloco: Produtos ── */}
      <div className="pf2-card">
        <p className="pf2-card-eyebrow">O que foi pedido?</p>

        {/* Lista de itens */}
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
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}

        {/* Formulário de novo item */}
        {adicionando && (
          <div className="pf2-add-form">
            {/* Busca de produto */}
            <div className="pf2-field" style={{ position: 'relative', marginBottom: '0.6rem' }}>
              <label className="pf2-label">Buscar produto</label>
              <input
                className="pf2-input"
                placeholder="Digite o nome..."
                value={buscaProduto}
                onChange={e => { setBuscaProduto(e.target.value); setShowProdDrop(true) }}
                onFocus={() => setShowProdDrop(true)}
                onBlur={() => setTimeout(() => setShowProdDrop(false), 180)}
                autoComplete="off"
              />
              {showProdDrop && prodsFiltrados.length > 0 && (
                <div className="pf2-dropdown" onMouseDown={e => e.preventDefault()}>
                  {prodsFiltrados.map(p => (
                    <button
                      key={p.id}
                      className="pf2-drop-item pf2-drop-item--produto"
                      onMouseDown={() => {
                        setNovoItem(prev => ({ ...prev, produto_id: p.id, nome_produto: p.nome, valor_unitario: p.preco_normal || 0, imagem_url: p.imagem_url || '' }))
                        setBuscaProduto(p.nome)
                        setShowProdDrop(false)
                      }}
                    >
                      {p.imagem_url
                        ? <img src={p.imagem_url} alt={p.nome} style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🎂</div>
                      }
                      <div>
                        <div className="pf2-drop-name">{p.nome}</div>
                        <div className="pf2-drop-sub" style={{ color: 'var(--primary)' }}>{formatMoney(p.preco_normal)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nome manual */}
            <div className="pf2-field" style={{ marginBottom: '0.6rem' }}>
              <label className="pf2-label">Nome do produto</label>
              <input
                className="pf2-input"
                placeholder="Ex: Bolo Red Velvet 2kg"
                value={novoItem.nome_produto}
                onChange={e => setNovoItem(p => ({ ...p, nome_produto: e.target.value }))}
              />
            </div>

            <div className="pf2-row">
              <div className="pf2-field">
                <label className="pf2-label">Qtd</label>
                <input
                  className="pf2-input"
                  type="number" min="0.1" step="0.1"
                  value={novoItem.quantidade}
                  onChange={e => setNovoItem(p => ({ ...p, quantidade: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="pf2-add-actions">
              <button className="pf2-btn-primary" onClick={adicionarItem} disabled={!novoItem.nome_produto}>
                Adicionar
              </button>
              <button className="pf2-btn-ghost" onClick={() => { setAdicionando(false); setNovoItem({ ...EMPTY_ITEM }); setBuscaProduto('') }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Total dos produtos */}
        {itens.length > 0 && (
          <div className="pf2-subtotal">
            <span>Subtotal</span>
            <span>{formatMoney(pedido.valor_produtos)}</span>
          </div>
        )}

        {/* Botão adicionar */}
        {!adicionando && (
          <button className="pf2-btn-add" onClick={() => setAdicionando(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            {itens.length === 0 ? 'Adicionar produto' : 'Adicionar outro'}
          </button>
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

        {/* Opcional: Observação geral */}
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
            <textarea
              className="pf2-textarea"
              placeholder="Anotações sobre o pedido..."
              value={pedido.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={4}
            />
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
    </div>
  )
}
