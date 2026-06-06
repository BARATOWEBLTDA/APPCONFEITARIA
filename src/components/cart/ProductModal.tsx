import { useState, useEffect } from 'react'
import { X, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react'
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

  const [selectedVela, setSelectedVela] = useState(false)
  const [selectedTopo, setSelectedTopo] = useState(false)
  const [selectedPapelArroz, setSelectedPapelArroz] = useState(false)
  const [selectedOutro, setSelectedOutro] = useState(false)

  useEffect(() => {
    if (product) {
      setQuantity(1); setObservations(''); setSelectedMassa('')
      setSelectedRecheio(''); setSelectedCobertura(''); setShowObs(false)
      setSelectedVela(false); setSelectedTopo(false); setSelectedPapelArroz(false); setSelectedOutro(false)
      const imgs = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
      const middleIndex = Math.floor(imgs.length / 2)
      setImgIndex(middleIndex)
      const tamanhos = (product as any).tamanhos_disponiveis
      setSelectedTamanho(tamanhos?.length > 0 ? tamanhos[0] : null)
    }
  }, [product])

  // Scroll automático entre imagens
  const [imgCount, setImgCount] = useState(0)
  useEffect(() => {
    if (!product) return
    const imgs = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
    setImgCount(imgs.length)
  }, [product])

  useEffect(() => {
    if (imgCount <= 1 || !isOpen) return
    const timer = setInterval(() => setImgIndex(i => (i + 1) % imgCount), 3000)
    return () => clearInterval(timer)
  }, [imgCount, isOpen])

  // Scroll automático entre imagens
  // Bloquear scroll do body quando modal aberto
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
  const adicionais = ((product as any).tem_vela && selectedVela ? ((product as any).valor_vela || 0) : 0)
    + ((product as any).tem_topo && selectedTopo ? ((product as any).valor_topo || 0) : 0)
    + ((product as any).tem_papel_arroz && selectedPapelArroz ? ((product as any).valor_papel_arroz || 0) : 0)
    + ((product as any).tem_outro && selectedOutro ? ((product as any).valor_outro || 0) : 0)
  const total = (unitPrice * quantity) + adicionais

  const tamanhos: any[] = (product as any).tamanhos_disponiveis || []
  const prontaEntrega = (product as any).pronta_entrega !== false

  const images = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
  const firstImage = images[imgIndex] || images[0]

  const FORMA_LABEL: Record<string, string> = {
    unidade: 'unidade', fatia: 'fatia', kg: 'kg', cento: 'cento',
    'tamanho': 'unidade', 'kit-caixa': 'kit', 'sob-encomenda': 'encomenda', outros: 'un'
  }

  const SelectGroup = ({ label, options, value, onChange }: any) => (
    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '50px' }}>Opcional</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {options.map((opt: string) => (
          <button key={opt} onClick={() => onChange(value === opt ? '' : opt)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: '10px',
            border: `2px solid ${value === opt ? '#ec4899' : '#f3f4f6'}`,
            background: value === opt ? '#fdf2f8' : 'white', cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{opt}</span>
            <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${value === opt ? '#ec4899' : '#d1d5db'}`, background: value === opt ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 50 }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 51,
        background: 'white', borderRadius: '24px',
        width: '92vw', maxWidth: '400px',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        animation: 'popIn 0.25s ease',
      }}>

        {/* Imagem com carrossel coverflow */}
        <div style={{ position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
          <div
            style={{ width: '100%', height: '200px', background: '#fdf2f8', position: 'relative', cursor: images.length > 1 ? 'grab' : 'default' }}
            onTouchStart={e => { setTouchStart(e.touches[0].clientX); setTouchDelta(0); setDragging(true); }}
            onTouchMove={e => { if (touchStart === null) return; setTouchDelta(e.touches[0].clientX - touchStart); }}
            onTouchEnd={() => {
              if (Math.abs(touchDelta) > 40) {
                if (touchDelta < 0 && imgIndex < images.length - 1) setImgIndex(i => i + 1);
                if (touchDelta > 0 && imgIndex > 0) setImgIndex(i => i - 1);
              }
              setTouchStart(null); setTouchDelta(0); setDragging(false);
            }}
            onMouseDown={e => { setTouchStart(e.clientX); setDragging(true); }}
            onMouseMove={e => { if (!dragging || touchStart === null) return; setTouchDelta(e.clientX - touchStart); }}
            onMouseUp={() => {
              if (Math.abs(touchDelta) > 40) {
                if (touchDelta < 0 && imgIndex < images.length - 1) setImgIndex(i => i + 1);
                if (touchDelta > 0 && imgIndex > 0) setImgIndex(i => i - 1);
              }
              setTouchStart(null); setTouchDelta(0); setDragging(false);
            }}
            onMouseLeave={() => { setTouchStart(null); setTouchDelta(0); setDragging(false); }}
          >
            {images.length > 1 ? (
              /* Coverflow — imagens lado a lado com scale */
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {images.map((img, i) => {
                  const offset = i - imgIndex + (dragging ? touchDelta / 200 : 0)
                  const isCenter = Math.abs(offset) < 0.5
                  const scale = isCenter ? 1 : 0.75
                  const translateX = offset * 75
                  const opacity = Math.abs(offset) > 1.5 ? 0 : Math.abs(offset) > 1 ? 0.4 : 1
                  const zIndex = isCenter ? 2 : 1
                  return (
                    <div key={i} onClick={() => !dragging && setImgIndex(i)} style={{
                      position: 'absolute',
                      width: '65%',
                      height: '85%',
                      transform: `translateX(${translateX}%) scale(${scale})`,
                      transition: dragging ? 'none' : 'all 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                      opacity,
                      zIndex,
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: isCenter ? '0 8px 24px rgba(0,0,0,0.18)' : '0 4px 12px rgba(0,0,0,0.1)',
                      cursor: isCenter ? 'default' : 'pointer',
                      background: '#fdf2f8',
                    }}>
                      <img src={img} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
                    </div>
                  )
                })}
              </div>
            ) : images.length === 1 ? (
              <img src={images[0]} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fdf2f8' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px' }}>🧁</div>
            )}
          </div>

          {/* Pontos indicadores */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 3 }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIndex(i)} style={{ width: i === imgIndex ? '20px' : '8px', height: '8px', borderRadius: '4px', background: i === imgIndex ? '#ec4899' : 'rgba(236,72,153,0.35)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s' }} />
              ))}
            </div>
          )}

          <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: '#ec4899', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(236,72,153,0.4)', zIndex: 3 }}>
            <X size={16} color="white" strokeWidth={2.5} />
          </button>

          {/* Faixa diagonal promoção */}
          {product.promocao && (
            <div style={{ position: 'absolute', top: '22px', left: '-32px', background: 'linear-gradient(135deg, #ec4899, #f472b6)', color: 'white', fontSize: '10px', fontWeight: 800, padding: '5px 40px', transform: 'rotate(-45deg)', zIndex: 4, letterSpacing: '0.05em', boxShadow: '0 2px 8px rgba(236,72,153,0.4)' }}>PROMOÇÃO</div>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Nome, forma de venda e preço */}
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>{product.nome}</h3>
            {/* Badge pronta entrega abaixo do título */}
            {prontaEntrega ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fdf2f8', color: '#ec4899', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: '1px solid #fce7f3', marginBottom: '6px' }}>✓ Pronta entrega</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', color: '#6b7280', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', marginBottom: '6px' }}>⏱ Sob encomenda</span>
            )}
            {product.descricao && <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }}>{product.descricao}</p>}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              {product.promocao && unitPrice < product.preco_normal ? (
                <>
                  <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(product.preco_normal)}</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(unitPrice)}</span>
                </>
              ) : (
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(basePrice)}</span>
              )}
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>/ {FORMA_LABEL[product.forma_venda] || product.forma_venda}</span>
            </div>
          </div>

          {/* Kit Festa */}
          {product.forma_venda === 'kit-festa' && (product as any).kit_itens?.length > 0 && (
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>🎉 O que está incluso</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(product as any).kit_serve_pessoas && (
                    <span style={{ fontSize: '11px', background: '#fdf2f8', color: '#ec4899', fontWeight: 700, padding: '3px 8px', borderRadius: '50px' }}>
                      👥 {(product as any).kit_serve_pessoas}
                    </span>
                  )}
                  {(product as any).kit_prazo_encomenda && (
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', fontWeight: 700, padding: '3px 8px', borderRadius: '50px' }}>
                      ⏱ {(product as any).kit_prazo_encomenda}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(product as any).kit_itens.map((item: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>✓ {item.nome}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#ec4899' }}>× {item.quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tamanhos */}
          {tamanhos.length > 0 && (
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', display: 'block', marginBottom: '10px' }}>Escolha o tamanho</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {tamanhos.map((t: any, i: number) => (
                  <button key={i} onClick={() => setSelectedTamanho(t)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '10px',
                    border: `2px solid ${selectedTamanho?.label === t.label ? '#ec4899' : '#f3f4f6'}`,
                    background: selectedTamanho?.label === t.label ? '#fdf2f8' : 'white', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{t.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        {descPct > 0 && <span style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'line-through', display: 'block' }}>{formatCurrency(t.preco)}</span>}
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(applyDiscount(t.preco))}</span>
                      </div>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${selectedTamanho?.label === t.label ? '#ec4899' : '#d1d5db'}`, background: selectedTamanho?.label === t.label ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* Adicionais */}
          {((product as any).tem_vela || (product as any).tem_topo || (product as any).tem_papel_arroz) && (
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', display: 'block', marginBottom: '10px' }}>✨ Adicionais</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(product as any).tem_vela && (
                  <button onClick={() => setSelectedVela(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', border: `2px solid ${selectedVela ? '#ec4899' : '#f3f4f6'}`, background: selectedVela ? '#fdf2f8' : 'white', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Velas</p>
                      {(product as any).valor_vela > 0 && <p style={{ fontSize: '12px', color: '#ec4899', fontWeight: 700, margin: 0 }}>+ {formatCurrency((product as any).valor_vela)}</p>}
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedVela ? '#ec4899' : '#d1d5db'}`, background: selectedVela ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedVela && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                  </button>
                )}
                {(product as any).tem_topo && (
                  <button onClick={() => setSelectedTopo(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', border: `2px solid ${selectedTopo ? '#ec4899' : '#f3f4f6'}`, background: selectedTopo ? '#fdf2f8' : 'white', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Topo de Bolo</p>
                      {(product as any).valor_topo > 0 && <p style={{ fontSize: '12px', color: '#ec4899', fontWeight: 700, margin: 0 }}>+ {formatCurrency((product as any).valor_topo)}</p>}
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedTopo ? '#ec4899' : '#d1d5db'}`, background: selectedTopo ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedTopo && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                  </button>
                )}
                {(product as any).tem_papel_arroz && (
                  <button onClick={() => setSelectedPapelArroz(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', border: `2px solid ${selectedPapelArroz ? '#ec4899' : '#f3f4f6'}`, background: selectedPapelArroz ? '#fdf2f8' : 'white', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>Papel de Arroz</p>
                      {(product as any).valor_papel_arroz > 0 && <p style={{ fontSize: '12px', color: '#ec4899', fontWeight: 700, margin: 0 }}>+ {formatCurrency((product as any).valor_papel_arroz)}</p>}
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedPapelArroz ? '#ec4899' : '#d1d5db'}`, background: selectedPapelArroz ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedPapelArroz && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                  </button>
                )}
                {(product as any).tem_outro && (product as any).titulo_outro && (
                  <button onClick={() => setSelectedOutro((v: boolean) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', border: `2px solid ${selectedOutro ? '#ec4899' : '#f3f4f6'}`, background: selectedOutro ? '#fdf2f8' : 'white', cursor: 'pointer' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: 0 }}>{(product as any).titulo_outro}</p>
                      {(product as any).valor_outro > 0 && <p style={{ fontSize: '12px', color: '#ec4899', fontWeight: 700, margin: 0 }}>+ {formatCurrency((product as any).valor_outro)}</p>}
                    </div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${selectedOutro ? '#ec4899' : '#d1d5db'}`, background: selectedOutro ? '#ec4899' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedOutro && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Observações — sempre abertas */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1f2937', display: 'block', marginBottom: '8px' }}>Alguma observação?</span>
            <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: sem cereja, embalagem para presente..." style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '13px', color: '#374151', resize: 'none', minHeight: '64px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
          </div>

          <div style={{ height: '4px' }} />
        </div>

        {/* Rodapé */}
        <div style={{ padding: '12px 16px 24px', borderTop: '1px solid #f3f4f6', background: 'white', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <button onClick={dec} style={{ width: '40px', height: '44px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={16} color="#374151" />
              </button>
              <span style={{ minWidth: '36px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                {isKg ? `${quantity}kg` : quantity}
              </span>
              <button onClick={inc} style={{ width: '40px', height: '44px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} color="#374151" />
              </button>
            </div>
            <button onClick={handleAdd} style={{ flex: 1, height: '44px', background: corBotao, color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontFamily: 'inherit' }}>
              <span>Adicionar</span>
              <span>{formatCurrency(total)}</span>
            </button>
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
