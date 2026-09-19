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
      background:'var(--bg-card)', borderRadius:'12px',
      border:'1px solid var(--border)',
    }}>
      {/* Imagem */}
      <div style={{
        width:'72px', height:'72px', borderRadius:'10px',
        overflow:'hidden', flexShrink:0, background:'var(--bg-body)',
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
          <X size={10} color="var(--text-inverse)" />
        </button>
      </div>

      {/* Conteúdo */}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
        {/* Nome */}
        <h4 style={{
          margin:0, fontWeight:700, fontSize:'14px', color:'var(--text-primary)',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          lineHeight:'1.3',
        }}>
          {item.name}
        </h4>

        {/* Opcionais — V3 (escolhas ricas) ou legado (strings) */}
        {(() => {
          const escolhas = item.escolhas
          const chips: Array<{ label: string; valor: string }> = []

          if (escolhas) {
            // V3 — dados ricos
            if (escolhas.tamanho?.nome) {
              const peso = escolhas.tamanho.peso_kg ? ` (~${escolhas.tamanho.peso_kg.toString().replace('.', ',')}kg)` : ''
              chips.push({ label: 'Tamanho', valor: escolhas.tamanho.nome + peso })
            }
            if (escolhas.sabor?.nome) chips.push({ label: 'Sabor', valor: escolhas.sabor.nome })
            if (escolhas.massa?.nome) chips.push({ label: 'Massa', valor: escolhas.massa.nome })
            if (escolhas.recheios && escolhas.recheios.length > 0) {
              chips.push({
                label: escolhas.recheios.length > 1 ? 'Recheios' : 'Recheio',
                valor: escolhas.recheios.map(r => r.nome).join(', ')
              })
            }
            if (escolhas.cobertura?.nome) chips.push({ label: 'Cobertura', valor: escolhas.cobertura.nome })
          } else {
            // Legado — strings antigas
            if (item.selectedMassa) chips.push({ label: 'Massa', valor: item.selectedMassa })
            if (item.selectedRecheio) chips.push({ label: 'Recheio', valor: item.selectedRecheio })
            if (item.selectedCobertura) chips.push({ label: 'Cobertura', valor: item.selectedCobertura })
          }

          if (chips.length === 0) return null

          return (
            <div style={{display:'flex',flexWrap:'wrap',gap:'4px',marginTop:'2px'}}>
              {chips.map((c, i) => (
                <span key={i} style={{fontSize:'11px',color:'var(--text-secondary)',background:'var(--bg-body)',padding:'1px 6px',borderRadius:'4px'}}>
                  <b style={{color:'#831843'}}>{c.label}:</b> {c.valor}
                </span>
              ))}
            </div>
          )
        })()}

        {/* Peso/Tamanho */}
        <span style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'2px'}}>
          {formatCurrency(item.price)}{unitLabel}
        </span>

        {/* Preço + stepper */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'6px'}}>
          <span style={{fontWeight: 700, fontSize:'16px', color:'var(--text-primary)'}}>
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
              fontSize:'14px', fontWeight: 700, color:'#ea1d2c',
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
