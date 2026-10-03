import { Plus, Minus, X } from 'lucide-react'
import { sufixoVenda } from '@/lib/formaVenda'
import { CartItem } from '@/types/cart'
import { formatCurrency } from '@/utils/helpers'


/** "Brigadeiro" → "brigadeiros", "Beijinho de coco" → "beijinhos de coco", "Pão de mel" → "pães de mel" */
function pluralSabor(nome: string, qtd: number): string {
  const n = String(nome || '').trim()
  if (!n) return ''
  const [p1, ...resto] = n.split(' ')
  let w = p1.charAt(0).toLowerCase() + p1.slice(1)
  if (qtd > 1) {
    if (/^pão$/i.test(w)) w = 'pães'
    else if (/ão$/i.test(w)) w = w.replace(/ão$/i, 'ões')
    else if (/[aeiouáéíóú]$/i.test(w)) w = w + 's'
    else if (/[rzs]$/i.test(w)) w = /s$/i.test(w) ? w : w + 'es'
    else if (/l$/i.test(w)) w = w.replace(/l$/i, 'is')
    else if (/m$/i.test(w)) w = w.replace(/m$/i, 'ns')
  }
  return [w, ...resto].join(' ')
}

interface Props {
  item: CartItem
  onUpdateQuantity: (id: string, quantity: number) => void
  onUpdateObservations: (id: string, observations: string) => void
  onRemove: (id: string) => void
}

export function CartItemComponent({ item, onUpdateQuantity, onRemove }: Props) {
  // Age só nesta linha da sacola (mesmo produto com opções diferentes = linhas separadas)
  const linha = (item as any).lineId ?? item.id
  const dec = () => {
    const d = item.saleType === 'kg' ? 0.5 : 1
    if (item.quantity > d) onUpdateQuantity(linha, item.quantity - d)
    else onRemove(linha)
  }
  const inc = () => onUpdateQuantity(linha, item.quantity + (item.saleType === 'kg' ? 0.5 : 1))
  const qtyLabel = item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity}`
  const unitLabel = '/' + sufixoVenda(item.saleType) // caixa, kg, fatia… (antes tudo virava /un)

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
        {/* (o × em cima da foto saiu em 02/10: pra tirar, é só diminuir a quantidade até zero) */}
      </div>

      {/* Conteúdo */}
      <div style={{flex:1, minWidth:0, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
        {/* Nome */}
        <h4 style={{
          margin:0, fontWeight:700, fontSize:'14px', color:'var(--text-primary)',
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          lineHeight:'1.3',
        }}>
          {item.name}{item.escolhas?.kit?.total ? ` · ${item.escolhas.kit.total} un.` : ''}
        </h4>
        {/* Sabores do kit em lista: "25 brigadeiros / 25 beijinhos" (02/10) */}
        {item.escolhas?.kit?.sabores?.length ? (
          <ul style={{ listStyle: 'none', margin: '3px 0 0', padding: 0 }}>
            {item.escolhas.kit.sabores.filter((x: any) => x.qtd > 0).map((x: any, i: number) => (
              <li key={i} style={{ fontSize: '12.5px', color: '#6B5D64', lineHeight: 1.45 }}>{x.qtd} {pluralSabor(x.nome, x.qtd)}</li>
            ))}
          </ul>
        ) : null}

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
