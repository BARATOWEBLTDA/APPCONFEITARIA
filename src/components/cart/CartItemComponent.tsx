import { Plus, Minus, X } from 'lucide-react'
import { CartItem } from '@/types/cart'
import { formatCurrency } from '@/utils/helpers'

interface Props {
  item: CartItem
  onUpdateQuantity: (id: string, quantity: number) => void
  onUpdateObservations: (id: string, observations: string) => void
  onRemove: (id: string) => void
}

export function CartItemComponent({ item, onUpdateQuantity, onRemove }: Props) {
  const dec = () => {
    const d = item.saleType === 'kg' ? 0.5 : 1
    if (item.quantity > d) onUpdateQuantity(item.id, item.quantity - d)
    else onRemove(item.id)
  }
  const inc = () => onUpdateQuantity(item.id, item.quantity + (item.saleType === 'kg' ? 0.5 : 1))
  const qtyLabel = item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity}`
  const unitLabel = item.saleType === 'kg' ? '/kg' : '/un'

  return (
    <div style={{
      display:'flex', gap:'12px', padding:'12px',
      background:'#fff', borderRadius:'12px',
      border:'1px solid #f0f0f0',
    }}>
      {/* Imagem */}
      <div style={{
        width:'72px', height:'72px', borderRadius:'10px',
        overflow:'hidden', flexShrink:0, background:'#f5f5f5',
        position:'relative',
      }}>
        {item.imageUrl
          ? <img src={item.imageUrl.split(',')[0]} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px'}}>🧁</div>
        }
        {/* Botão remover sobre a imagem */}
        <button
          onClick={() => onRemove(item.id)}
          style={{
            position:'absolute', top:'4px', right:'4px',
            width:'20px', height:'20px', borderRadius:'50%',
            background:'rgba(0,0,0,0.5)', border:'none',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'pointer',
          }}
        >
          <X size={10} color="#fff" />
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
        {/* Nome */}
        <h4 style={{
          margin:0, fontWeight:700, fontSize:'14px', color:'#3e3e3e',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          lineHeight:'1.3',
        }}>
          {item.name}
        </h4>

        {/* Opcionais */}
        {(item.selectedMassa || item.selectedRecheio || item.selectedCobertura) && (
          <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'2px'}}>
            {item.selectedMassa && <span style={{fontSize:'11px',color:'#717171',background:'#f5f5f5',padding:'1px 6px',borderRadius:'4px'}}>🎂 {item.selectedMassa}</span>}
            {item.selectedRecheio && <span style={{fontSize:'11px',color:'#717171',background:'#f5f5f5',padding:'1px 6px',borderRadius:'4px'}}>🥄 {item.selectedRecheio}</span>}
            {item.selectedCobertura && <span style={{fontSize:'11px',color:'#717171',background:'#f5f5f5',padding:'1px 6px',borderRadius:'4px'}}>✨ {item.selectedCobertura}</span>}
          </div>
        )}

        {/* Peso/Tamanho */}
        <span style={{fontSize:'11px',color:'#a0a0a0',marginTop:'2px'}}>
          {formatCurrency(item.price)}{unitLabel}
        </span>

        {/* Preço + stepper */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'6px'}}>
          <span style={{fontWeight:800, fontSize:'16px', color:'#3e3e3e'}}>
            {formatCurrency(item.price * item.quantity)}
          </span>

          {/* Stepper */}
          <div style={{
            display:'flex', alignItems:'center',
            border:'1.5px solid #ea1d2c', borderRadius:'8px',
            overflow:'hidden',
          }}>
            <button onClick={dec} style={{
              width:'32px', height:'32px', background:'transparent',
              border:'none', display:'flex', alignItems:'center',
              justifyContent:'center', cursor:'pointer',
            }}>
              <Minus size={14} color="#ea1d2c" />
            </button>
            <span style={{
              minWidth:'38px', textAlign:'center',
              fontSize:'14px', fontWeight:800, color:'#ea1d2c',
              borderLeft:'1.5px solid #fecaca', borderRight:'1.5px solid #fecaca',
              padding:'6px 0', background:'#fff5f5',
            }}>
              {qtyLabel}
            </span>
            <button onClick={inc} style={{
              width:'32px', height:'32px', background:'transparent',
              border:'none', display:'flex', alignItems:'center',
              justifyContent:'center', cursor:'pointer',
            }}>
              <Plus size={14} color="#ea1d2c" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
