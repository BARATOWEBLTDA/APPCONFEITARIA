import { useState, useEffect } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { Produto } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
  corBotao?: string
}

export function ProductModal({ isOpen, onClose, product, corBotao = '#ec4899' }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [observations, setObservations] = useState('')
  const [selectedMassa, setSelectedMassa] = useState('')
  const [selectedRecheio, setSelectedRecheio] = useState('')
  const [selectedCobertura, setSelectedCobertura] = useState('')
  const [selectedTamanho, setSelectedTamanho] = useState<any>(null)
  const [showObs, setShowObs] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchDelta, setTouchDelta] = useState(0)
  const [dragging, setDragging] = useState(false)


  useEffect(() => {
    if (product) {
      setQuantity(1); setObservations(''); setSelectedMassa('')
      setSelectedRecheio(''); setSelectedCobertura(''); setShowObs(false)
      const imgs = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
      setImgIndex(0)
      const tamanhos = (product as any).tamanhos_disponiveis
      setSelectedTamanho(tamanhos?.length > 0 ? tamanhos[0] : null)
    }
  }, [product])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen || !product) return null

  const isKg = product.forma_venda === 'kg'
  const step = isKg ? 0.5 : 1
  const min = isKg ? 0.5 : 1
  const inc = () => setQuantity(q => Math.min(q + step, 50))
  const dec = () => setQuantity(q => Math.max(q - step, min))

  const basePrice = product.promocao && product.preco_promocional ? product.preco_promocional : product.preco_normal
  const descPct = (product as any).tipo_promocao === 'percentual' && product.promocao
    ? ((product as any).desconto_percentual || 0) / 100
    : product.promocao && product.preco_promocional && product.preco_normal > 0
      ? 1 - (product.preco_promocional / product.preco_normal)
      : 0
  const applyDiscount = (price: number) => descPct > 0 ? parseFloat((price * (1 - descPct)).toFixed(2)) : price
  const unitPrice = selectedTamanho ? applyDiscount(selectedTamanho.preco) : basePrice
  const adicionais = 0
  const total = (unitPrice * quantity) + adicionais

  const tamanhos: any[] = (product as any).tamanhos_disponiveis || []
  const prontaEntrega = (product as any).pronta_entrega !== false
  const images = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []

  const FORMA_LABEL: Record<string, string> = {
    unidade: 'unidade', fatia: 'fatia', kg: 'kg', cento: 'cento',
    'tamanho': 'unidade', 'kit-caixa': 'kit', 'sob-encomenda': 'encomenda', outros: 'un'
  }

  const SelectGroup = ({ label, options, value, onChange }: any) => (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>{label}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: '50px' }}>Opcional</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {options.map((opt: string) => (
          <button key={opt} onClick={() => onChange(value === opt ? '' : opt)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px',
            border: `2px solid ${value === opt ? corBotao : 'var(--border)'}`,
            background: value === opt ? `${corBotao}15` : 'var(--bg-card)', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{opt}</span>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${value === opt ? corBotao : '#d1d5db'}`, background: value === opt ? corBotao : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {value === opt && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  const handleAdd = () => {
    addItem({
      id: product.id, name: product.nome, description: product.descricao || '',
      price: unitPrice, imageUrl: product.imagem_url,
      saleType: product.forma_venda, quantity, observations,
      selectedMassa, selectedRecheio, selectedCobertura,
    })
    onClose()
  }

  const isDesktop = window.innerWidth >= 768

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--bg-overlay)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 50 }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 51,
        background: 'var(--bg-card)', borderRadius: '24px',
        width: isDesktop ? '90vw' : '92vw',
        maxWidth: isDesktop ? '860px' : '400px',
        maxHeight: '88vh',
        display: 'flex', flexDirection: isDesktop ? 'row' : 'column',
        boxShadow: 'var(--shadow-lg)',
        animation: 'popIn 0.25s ease',
        overflow: 'hidden',
      }}>

        {/* ── Coluna Esquerda: Imagem ── */}
        <div style={{
          width: isDesktop ? '45%' : '100%',
          flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: '#f3f4f6',
          borderRadius: isDesktop ? '24px 0 0 24px' : '24px 24px 0 0',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Imagem principal */}
          <div style={{ flex: 1, position: 'relative', minHeight: isDesktop ? '300px' : '200px', overflow: 'hidden' }}
            onTouchStart={e => { setTouchStart(e.touches[0].clientX); setTouchDelta(0); setDragging(true); }}
            onTouchMove={e => { if (touchStart === null) return; setTouchDelta(e.touches[0].clientX - touchStart); }}
            onTouchEnd={() => {
              if (Math.abs(touchDelta) > 40) {
                if (touchDelta < 0) setImgIndex(i => (i + 1) % images.length);
                if (touchDelta > 0) setImgIndex(i => (i - 1 + images.length) % images.length);
              }
              setTouchStart(null); setTouchDelta(0); setDragging(false);
            }}
          >
            {images.length > 0 ? (
              <img
                src={images[imgIndex]}
                alt={product.nome}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'all 0.3s ease' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🧁</div>
            )}

            {/* Faixa diagonal promoção */}
            {product.promocao && (
              <div style={{ position: 'absolute', top: '22px', left: '-32px', background: `linear-gradient(135deg, ${corBotao}, ${corBotao}cc)`, color: 'white', fontSize: '10px', fontWeight: 800, padding: '5px 40px', transform: 'rotate(-45deg)', zIndex: 4, letterSpacing: '0.05em', boxShadow: `0 2px 8px ${corBotao}66` }}>PROMOÇÃO</div>
            )}
          </div>

          {/* Miniaturas */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '6px', padding: '8px', background: 'rgba(0,0,0,0.04)', flexShrink: 0, overflowX: 'auto' }}>
              {images.map((img, i) => (
                <button key={i} onClick={() => setImgIndex(i)} style={{
                  width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0,
                  border: `2px solid ${i === imgIndex ? corBotao : 'transparent'}`,
                  cursor: 'pointer', padding: 0, transition: 'all 0.2s',
                  opacity: i === imgIndex ? 1 : 0.6,
                }}>
                  <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Coluna Direita: Conteúdo ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

          {/* Botão fechar */}
          <button onClick={onClose} style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'var(--bg-body)', border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5,
          }}>
            <X size={16} color="var(--text-secondary)" strokeWidth={2.5} />
          </button>

          {/* Conteúdo scrollável */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Nome, badge e preço */}
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-title)', margin: '0 0 8px', paddingRight: '36px' }}>{product.nome}</h3>
              {prontaEntrega ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${corBotao}15`, color: corBotao, fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: `1px solid ${corBotao}30`, marginBottom: '8px' }}>✓ Pronta entrega</span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--border)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', marginBottom: '8px' }}>⏱ Sob encomenda</span>
              )}
              {product.descricao && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 10px' }}>{product.descricao}</p>}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {product.promocao && unitPrice < product.preco_normal ? (
                  <>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatCurrency(product.preco_normal)}</span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: corBotao }}>{formatCurrency(unitPrice)}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '22px', fontWeight: 800, color: corBotao }}>{formatCurrency(basePrice)}</span>
                )}
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>/ {FORMA_LABEL[product.forma_venda] || product.forma_venda}</span>
              </div>
            </div>

            {/* Kit Festa */}
            {product.forma_venda === 'kit-festa' && (product as any).kit_itens?.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>🎉 O que está incluso</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(product as any).kit_serve_pessoas && (
                      <span style={{ fontSize: '11px', background: `${corBotao}15`, color: corBotao, fontWeight: 700, padding: '3px 8px', borderRadius: '50px' }}>👥 {(product as any).kit_serve_pessoas}</span>
                    )}
                    {(product as any).kit_prazo_encomenda && (
                      <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '3px 8px', borderRadius: '50px' }}>⏱ {(product as any).kit_prazo_encomenda}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(product as any).kit_itens.map((item: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-body)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>✓ {item.nome}</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: corBotao }}>× {item.quantidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tamanhos */}
            {tamanhos.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)', display: 'block', marginBottom: '10px' }}>Escolha o tamanho</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {tamanhos.map((t: any, i: number) => (
                    <button key={i} onClick={() => setSelectedTamanho(t)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '10px',
                      border: `2px solid ${selectedTamanho?.label === t.label ? corBotao : 'var(--border)'}`,
                      background: selectedTamanho?.label === t.label ? `${corBotao}15` : 'var(--bg-card)', cursor: 'pointer',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          {descPct > 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through', display: 'block' }}>{formatCurrency(t.preco)}</span>}
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(applyDiscount(t.preco))}</span>
                        </div>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${selectedTamanho?.label === t.label ? corBotao : '#d1d5db'}`, background: selectedTamanho?.label === t.label ? corBotao : 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {selectedTamanho?.label === t.label && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Personalizações */}
            {product.permite_personalizacao && product.massas_disponiveis?.length > 0 && (
              <SelectGroup label="Massa" options={product.massas_disponiveis} value={selectedMassa} onChange={setSelectedMassa} />
            )}
            {product.permite_personalizacao && product.recheios_disponiveis?.length > 0 && (
              <SelectGroup label="Sabor / Recheio" options={product.recheios_disponiveis} value={selectedRecheio} onChange={setSelectedRecheio} />
            )}
            {product.permite_personalizacao && product.coberturas_disponiveis?.length > 0 && (
              <SelectGroup label="Cobertura" options={product.coberturas_disponiveis} value={selectedCobertura} onChange={setSelectedCobertura} />
            )}

            {/* Observações */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-title)', display: 'block', marginBottom: '8px' }}>Alguma observação?</span>
              <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: sem cereja, embalagem para presente..." style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '12px', fontSize: '13px', color: 'var(--text-primary)', resize: 'none', minHeight: '64px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            </div>

            <div style={{ height: '4px' }} />
          </div>

          {/* Rodapé */}
          <div style={{ padding: '12px 20px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                <button onClick={dec} style={{ width: '40px', height: '44px', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={16} color="var(--text-primary)" />
                </button>
                <span style={{ minWidth: '36px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: 'var(--text-title)' }}>
                  {isKg ? `${quantity}kg` : quantity}
                </span>
                <button onClick={inc} style={{ width: '40px', height: '44px', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={16} color="var(--text-primary)" />
                </button>
              </div>
              <button onClick={handleAdd} style={{ flex: 1, height: '44px', background: corBotao, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontFamily: 'inherit' }}>
                <span>Adicionar</span>
                <span>{formatCurrency(total)}</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes popIn { from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 2px 8px rgba(249,115,22,0.5); } 50% { box-shadow: 0 2px 16px rgba(249,115,22,0.9); } }
      `}</style>
    </>
  )
}
