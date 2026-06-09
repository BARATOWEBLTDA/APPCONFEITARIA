import { Trash2, Plus, Minus } from 'lucide-react'
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

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:'12px',
      padding:'12px', borderRadius:'16px',
      background:'#fff',
      border:'1.5px solid #f3f4f6',
      boxShadow:'0 1px 4px rgba(0,0,0,0.05)',
    }}>
      {/* Imagem */}
      <div style={{
        width:'58px', height:'58px', borderRadius:'12px',
        overflow:'hidden', flexShrink:0,
        background:'linear-gradient(135deg,#fdf2f8,#fce7f3)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {item.imageUrl
          ? <img src={item.imageUrl.split(',')[0]} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <span style={{fontSize:'24px'}}>🧁</span>
        }
      </div>

      {/* Info */}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:'4px'}}>
        <h4 style={{margin:0, fontWeight:700, fontSize:'14px', color:'#111827', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
          {item.name}
        </h4>
        {item.selectedMassa && (
          <span style={{fontSize:'11px', color:'#ec4899', fontWeight:500}}>🎂 {item.selectedMassa}</span>
        )}
        {item.selectedRecheio && (
          <span style={{fontSize:'11px', color:'#8b5cf6', fontWeight:500}}>🥄 {item.selectedRecheio}</span>
        )}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'2px'}}>
          {/* Preço */}
          <span style={{fontWeight:800, fontSize:'15px', color:'#16a34a'}}>
            {formatCurrency(item.price * item.quantity)}
          </span>

          {/* Quantidade */}
          <div style={{
            display:'flex', alignItems:'center', gap:'6px',
            background:'#fdf2f8', borderRadius:'50px',
            padding:'3px 6px', border:'1px solid #fce7f3',
          }}>
            <button
              onClick={dec}
              style={{
                width:'24px', height:'24px', borderRadius:'50%',
                background:'#fff', border:'1.5px solid #fce7f3',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', flexShrink:0,
              }}
            >
              <Minus size={11} color="#ec4899" />
            </button>
            <span style={{
              fontSize:'13px', fontWeight:700, color:'#ec4899',
              minWidth:'32px', textAlign:'center',
            }}>
              {item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity}un`}
            </span>
            <button
              onClick={inc}
              style={{
                width:'24px', height:'24px', borderRadius:'50%',
                background:'#ec4899', border:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', flexShrink:0,
              }}
            >
              <Plus size={11} color="#fff" />
            </button>
          </div>
        </div>
      </div>

      {/* Lixeira */}
      <button
        onClick={() => onRemove(item.id)}
        style={{
          width:'32px', height:'32px', borderRadius:'10px',
          background:'#fff5f5', border:'1.5px solid #fee2e2',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', flexShrink:0,
        }}
      >
        <Trash2 size={14} color="#ef4444" />
      </button>
    </div>
  )
}
