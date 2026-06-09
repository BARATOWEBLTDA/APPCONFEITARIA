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
      display:'flex', gap:'12px', padding:'14px',
      background:'#fff', borderRadius:'14px',
      border:'1px solid #f0f0f0',
      transition:'box-shadow 0.15s',
    }}>
      {/* Imagem */}
      <div style={{
        width:'64px', height:'64px', borderRadius:'12px',
        overflow:'hidden', flexShrink:0,
        background:'#f5f5f5',
      }}>
        {item.imageUrl
          ? <img src={item.imageUrl.split(',')[0]} alt={item.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />
          : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px'}}>🧁</div>
        }
      </div>

      {/* Conteúdo */}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
        {/* Nome + lixeira */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'8px'}}>
          <div style={{flex:1,minWidth:0}}>
            <h4 style={{
              margin:0, fontWeight:700, fontSize:'14px', color:'#3e3e3e',
              whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
            }}>
              {item.name}
            </h4>
            {/* Opcionais */}
            <div style={{display:'flex',flexDirection:'column',gap:'1px',marginTop:'2px'}}>
              {item.selectedMassa && (
                <span style={{fontSize:'11px', color:'#a0a0a0'}}>Massa: {item.selectedMassa}</span>
              )}
              {item.selectedRecheio && (
                <span style={{fontSize:'11px', color:'#a0a0a0'}}>Recheio: {item.selectedRecheio}</span>
              )}
              {item.selectedCobertura && (
                <span style={{fontSize:'11px', color:'#a0a0a0'}}>Cobertura: {item.selectedCobertura}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => onRemove(item.id)}
            style={{
              background:'none', border:'none', cursor:'pointer',
              padding:'4px', flexShrink:0, opacity:0.4,
              transition:'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
          >
            <Trash2 size={15} color="#ef4444" />
          </button>
        </div>

        {/* Preço + controle quantidade */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'8px'}}>
          <span style={{fontWeight:800, fontSize:'15px', color:'#3e3e3e'}}>
            {formatCurrency(item.price * item.quantity)}
          </span>

          {/* Stepper iFood-style */}
          <div style={{
            display:'flex', alignItems:'center',
            border:'1.5px solid #ea1d2c', borderRadius:'8px',
            overflow:'hidden',
          }}>
            <button
              onClick={dec}
              style={{
                width:'30px', height:'30px',
                background:'transparent', border:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer',
              }}
            >
              <Minus size={14} color="#ea1d2c" />
            </button>
            <span style={{
              minWidth:'36px', textAlign:'center',
              fontSize:'13px', fontWeight:800, color:'#ea1d2c',
              borderLeft:'1.5px solid #fecaca',
              borderRight:'1.5px solid #fecaca',
              padding:'5px 0',
              background:'#fff5f5',
            }}>
              {item.saleType === 'kg' ? `${item.quantity}kg` : item.quantity}
            </span>
            <button
              onClick={inc}
              style={{
                width:'30px', height:'30px',
                background:'transparent', border:'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer',
              }}
            >
              <Plus size={14} color="#ea1d2c" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
