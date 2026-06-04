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
  const [showObs, setShowObs] = useState(false)

  useEffect(() => {
    if (product) {
      setQuantity(1)
      setObservations('')
      setSelectedMassa('')
      setSelectedRecheio('')
      setSelectedCobertura('')
      setShowObs(false)
    }
  }, [product])

  if (!isOpen || !product) return null

  const isKg = product.forma_venda === 'kg'
  const step = isKg ? 0.5 : 1
  const min = isKg ? 0.5 : 1
  const inc = () => setQuantity(q => Math.min(q + step, 50))
  const dec = () => setQuantity(q => Math.max(q - step, min))

  const price = product.promocao && product.preco_promocional ? product.preco_promocional : product.preco_normal
  const total = price * quantity

  const handleAdd = () => {
    addItem({
      id: product.id,
      name: product.nome,
      description: product.descricao || '',
      price,
      imageUrl: product.imagem_url,
      saleType: product.forma_venda,
      quantity,
      observations,
      selectedMassa,
      selectedRecheio,
      selectedCobertura,
    })
    onClose()
  }

  const images = product.imagem_url?.split(',').map(s => s.trim()).filter(Boolean) || []
  const firstImage = images[0]

  const SelectGroup = ({ label, options, value, onChange }: { label: string, options: string[], value: string, onChange: (v: string) => void }) => (
    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>{label}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: '50px' }}>Opcional</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {options.map(opt => (
          <button key={opt} onClick={() => onChange(value === opt ? '' : opt)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: '12px', border: `2px solid ${value === opt ? '#ec4899' : '#f3f4f6'}`,
              background: value === opt ? '#fdf2f8' : 'white', cursor: 'pointer', transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500 }}>{opt}</span>
            <div style={{
              width: '20px', height: '20px', borderRadius: '50%',
              border: `2px solid ${value === opt ? '#ec4899' : '#d1d5db'}`,
              background: value === opt ? '#ec4899' : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {value === opt && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />

      {/* Modal — sobe de baixo */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
        background: 'white', borderRadius: '20px 20px 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s ease',
      }}>

        {/* Imagem */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: '100%', height: '220px', background: '#fdf2f8', overflow: 'hidden' }}>
            {firstImage
              ? <img src={firstImage} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '72px' }}>🧁</div>
            }
          </div>
          {/* Botão fechar */}
          <button onClick={onClose} style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} color="white" />
          </button>
          {/* Tag promoção */}
          {product.promocao && (
            <div style={{ position: 'absolute', top: '12px', left: '12px', background: '#ef4444', color: 'white', fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '50px' }}>
              PROMOÇÃO
            </div>
          )}
        </div>

        {/* Conteúdo scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Nome e preço */}
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>{product.nome}</h3>
            {product.descricao && <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 10px' }}>{product.descricao}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {product.promocao && product.preco_promocional ? (
                <>
                  <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(product.preco_normal)}</span>
                  <span style={{ fontSize: '22px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(product.preco_promocional)}</span>
                </>
              ) : (
                <span style={{ fontSize: '22px', fontWeight: 800, color: '#ec4899' }}>{formatCurrency(product.preco_normal)}</span>
              )}
            </div>
          </div>

          {/* Personalizações */}
          {product.permite_personalizacao && product.massas_disponiveis?.length > 0 && (
            <SelectGroup label="Massa" options={product.massas_disponiveis} value={selectedMassa} onChange={setSelectedMassa} />
          )}
          {product.permite_personalizacao && product.recheios_disponiveis?.length > 0 && (
            <SelectGroup label="Recheio" options={product.recheios_disponiveis} value={selectedRecheio} onChange={setSelectedRecheio} />
          )}
          {product.permite_personalizacao && product.coberturas_disponiveis?.length > 0 && (
            <SelectGroup label="Cobertura" options={product.coberturas_disponiveis} value={selectedCobertura} onChange={setSelectedCobertura} />
          )}

          {/* Observações */}
          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
            <button onClick={() => setShowObs(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937' }}>Alguma observação?</span>
              {showObs ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
            </button>
            {showObs && (
              <textarea
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Ex: sem cereja, embalagem para presente..."
                style={{ width: '100%', marginTop: '10px', padding: '12px', border: '1.5px solid #e5e7eb', borderRadius: '12px', fontSize: '14px', color: '#374151', resize: 'none', minHeight: '80px', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }}
              />
            )}
          </div>

          <div style={{ height: '8px' }} />
        </div>

        {/* Rodapé fixo — quantidade + adicionar */}
        <div style={{ padding: '12px 16px 24px', borderTop: '1px solid #f3f4f6', background: 'white', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Quantidade */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0', border: '1.5px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              <button onClick={dec} style={{ width: '40px', height: '44px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={16} color="#374151" />
              </button>
              <span style={{ minWidth: '40px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                {isKg ? `${quantity}kg` : quantity}
              </span>
              <button onClick={inc} style={{ width: '40px', height: '44px', background: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} color="#374151" />
              </button>
            </div>

            {/* Botão adicionar */}
            <button onClick={handleAdd} style={{
              flex: 1, height: '44px', background: '#ec4899', color: 'white',
              border: 'none', borderRadius: '12px', fontWeight: 800, fontSize: '15px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 16px', fontFamily: 'inherit',
            }}>
              <span>Adicionar</span>
              <span>{formatCurrency(total)}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </>
  )
}
