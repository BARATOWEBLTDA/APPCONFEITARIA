import { useState, useEffect } from 'react'
import { X, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { Produto } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
}

export function ProductModal({ isOpen, onClose, product }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [observations, setObservations] = useState('')
  const [selectedMassa, setSelectedMassa] = useState('')
  const [selectedRecheio, setSelectedRecheio] = useState('')
  const [selectedCobertura, setSelectedCobertura] = useState('')
  const [selectedTamanho, setSelectedTamanho] = useState<any>(null)
  const [showObs, setShowObs] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)

  useEffect(() => {
    if (product) {
      setQuantity(1); setObservations(''); setSelectedMassa('')
      setSelectedRecheio(''); setSelectedCobertura(''); setShowObs(false)
      setImgIndex(0)
      const tamanhos = (product as any).tamanhos_disponiveis
      setSelectedTamanho(tamanhos?.length > 0 ? tamanhos[0] : null)
    }
  }, [product])

  // Scroll automático entre imagens
  useEffect(() => {
    if (images.length <= 1) return
    const timer = setInterval(() => {
      setImgIndex(i => (i + 1) % images.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [images.length, isOpen])

  // Bloquear scroll do body quando modal aberto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const isKg = product.forma_venda === 'kg'
  const step = isKg ? 0.5 : 1
  const min = isKg ? 0.5 : 1
  const inc = () => setQuantity(q => Math.min(q + step, 50))
  const dec = () => setQuantity(q => Math.max(q - step, min))

  const basePrice = product.promocao && product.preco_promocional ? product.preco_promocional : product.preco_normal
  const unitPrice = selectedTamanho ? selectedTamanho.preco : basePrice
  const total = unitPrice * quantity

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

        {/* Imagem com carrossel */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '100%', height: '260px', background: '#fdf2f8', overflow: 'hidden', borderRadius: '24px 24px 0 0', position: 'relative' }}>
            {/* Slides */}
            <div style={{ display: 'flex', height: '100%', transition: 'transform 0.4s ease', transform: `translateX(-${imgIndex * 100}%)` }}>
              {images.length > 0 ? images.map((img, i) => (
                <img key={i} src={img} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'cover', flexShrink: 0 }} />
              )) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', flexShrink: 0 }}>🧁</div>
              )}
            </div>

            {/* Setas de navegação se tiver mais de 1 foto */}
            {images.length > 1 && imgIndex > 0 && (
              <button onClick={() => setImgIndex(i => i - 1)} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            )}
            {images.length > 1 && imgIndex < images.length - 1 && (
              <button onClick={() => setImgIndex(i => i + 1)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>

          {/* Pontos indicadores */}
          {images.length > 1 && (
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIndex(i)} style={{ width: i === imgIndex ? '20px' : '8px', height: '8px', borderRadius: '4px', background: i === imgIndex ? 'white' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s' }} />
              ))}
            </div>
          )}

          <button onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', width: '32px', height: '32px', borderRadius: '50%', background: '#ec4899', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(236,72,153,0.4)' }}>
            <X size={16} color="white" strokeWidth={2.5} />
          </button>

          {product.promocao && (
            <div style={{ position: 'absolute', top: '10px', left: '10px', background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '50px' }}>PROMOÇÃO</div>
          )}

          {/* Badge pronta entrega / encomenda */}
          {prontaEntrega ? (
            <div style={{ position: 'absolute', bottom: images.length > 1 ? '28px' : '10px', left: '10px', background: 'linear-gradient(135deg, #f97316, #ef4444)', color: 'white', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 8px rgba(249,115,22,0.5)', animation: 'pulse 1.5s ease-in-out infinite' }}>
              🔥 Pronta entrega
            </div>
          ) : (
            <div style={{ position: 'absolute', bottom: images.length > 1 ? '28px' : '10px', left: '10px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', backdropFilter: 'blur(4px)' }}>
              ⏱ Sob encomenda
            </div>
          )}
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Nome, forma de venda e preço */}
          <div>
            <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#111827', margin: '0 0 4px' }}>{product.nome}</h3>
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 500 }}>
              Vendido por {FORMA_LABEL[product.forma_venda] || product.forma_venda}
            </span>
            {product.descricao && <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '6px 0 0' }}>{product.descricao}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              {product.promocao && product.preco_promocional ? (
                <>
                  <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(product.preco_normal)}</span>
                  <span style={{ fontSize: '20px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(product.preco_promocional)}</span>
                </>
              ) : (
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(basePrice)}</span>
              )}
            </div>
          </div>

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
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(t.preco)}</span>
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

          {/* Observações */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '14px' }}>
            <button onClick={() => setShowObs(v => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Alguma observação?</span>
              {showObs ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
            </button>
            {showObs && (
              <textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Ex: sem cereja, embalagem para presente..." style={{ width: '100%', marginTop: '10px', padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', color: '#374151', resize: 'none', minHeight: '70px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }} />
            )}
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
            <button onClick={handleAdd} style={{ flex: 1, height: '44px', background: '#ec4899', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontFamily: 'inherit' }}>
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
