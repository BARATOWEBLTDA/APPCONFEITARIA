import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getCardapioBySlug } from '@/services/cardapio'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { BannerAd } from '@/components/cardapio/BannerAd'
import { Logo } from '@/components/cardapio/Logo'
import { CategoryFilter } from '@/components/cardapio/CategoryFilter'
import { ProductList } from '@/components/cardapio/ProductList'
import { NavigationMenu } from '@/components/cardapio/NavigationMenu'
import { EmptyState } from '@/components/cardapio/EmptyState'
import { Footer } from '@/components/cardapio/Footer'
import { DesktopProductCard } from '@/components/desktop/ProductCard'
import { DesktopFooter } from '@/components/desktop/Footer'
import { CartProvider } from '@/context/CartContext'
import { DesignSettings, Configuracoes, Produto } from '@/types/database'
import { Star, MapPin, MagnifyingGlass, ShoppingBag, House, Tag, Info, User } from '@phosphor-icons/react'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/utils/helpers'

/* ══════════════════════════════════════════════ */
/*     DESKTOP COMPONENTS — Layout profissional   */
/* ══════════════════════════════════════════════ */

/* ── Nav Link com hover/active ── */
function NavLink({ label, icon, defaultActive, navBg }: any) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)

  const isActive = defaultActive || active
  const bg = isActive ? '#ffffff' : hovered ? 'rgba(255,255,255,0.15)' : 'transparent'
  const color = isActive ? (navBg || '#ec4899') : '#ffffff'

  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setActive(false) }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        padding: '10px 22px',
        border: 'none',
        borderRadius: '8px',
        background: bg,
        color: color,
        fontSize: '18px',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s, color 0.15s',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

/* ── Top Nav Bar ── */
function DeskNav({ design, searchTerm, onSearchChange }: any) {
  const { items } = useCart()
  const count = items.reduce((a: number, i: any) => a + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)
  const navBg = design.cor_navbar || design.cor_borda || '#ec4899'
  const corBorda = design.cor_borda || '#ec4899'

  return (
    <div style={{ background: navBg, position:'sticky', top:0, zIndex:40, boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
      <div style={{ width:'100%', padding:'0 40px', boxSizing:'border-box', display:'grid', gridTemplateColumns:'1fr auto 1fr', alignItems:'center', height:'92px', gap:'24px' }}>

        {/* ESQUERDA — Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          {design.logo_url
            ? <div style={{ width:'72px', height:'72px', borderRadius:'50%', border:`3px solid ${corBorda}`, padding:'3px', backgroundColor:'white', overflow:'hidden', flexShrink:0 }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', border:'3px solid white', overflow:'hidden' }}>
                  <img src={design.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
                </div>
              </div>
            : <div style={{ width:'72px', height:'72px', borderRadius:'50%', border:`3px solid ${corBorda}`, padding:'3px', backgroundColor:'white', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <div style={{ width:'100%', height:'100%', borderRadius:'50%', background:corBorda, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'28px', fontWeight:800 }}>{design.nome_loja?.charAt(0)}</div>
              </div>
          }
          <div>
            <p style={{ margin:0, fontWeight:800, fontSize:'18px', color: design.cor_nome || '#ffffff', lineHeight:1.2 }}>{design.nome_loja}</p>
            <p style={{ margin:'3px 0 0', fontSize:'13px', color:'rgba(255,255,255,0.75)', fontWeight:500 }}>{design.cidade_estado || 'Doces que encantam'}</p>
          </div>
        </div>

        {/* CENTRO — Links grandes */}
        <nav style={{ display:'flex', gap:'4px' }}>
          {[
            { label: 'Início',      icon: <House size={20} weight="duotone" />, defaultActive: true  },
            { label: 'Promoções',   icon: <Tag   size={20} weight="duotone" />, defaultActive: false },
            { label: 'Sobre nós',   icon: <Info  size={20} weight="duotone" />, defaultActive: false },
            { label: 'Minha conta', icon: <User  size={20} weight="duotone" />, defaultActive: false },
          ].map(({ label, icon, defaultActive }) => (
            <NavLink key={label} label={label} icon={icon} defaultActive={defaultActive} navBg={navBg} />
          ))}
        </nav>

        {/* DIREITA — vazio para manter grid centralizado */}
        <div />

      </div>
    </div>
  )
}

/* ── Hero Banner ── */
function DeskHero({ design }: any) {
  const banners = [design.banner_url, design.banner1_url, design.banner2_url, design.banner3_url].filter(Boolean)
  if (!banners.length) return null

  return (
    <div style={{ width:'100%', padding:'16px 24px 0', boxSizing:'border-box' }}>
      <div style={{ width:'100%', height:'300px', borderRadius:'16px', overflow:'hidden', background:'#1a1a1a' }}>
        <img src={banners[0]!} alt="Banner" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
      </div>
    </div>
  )
}

/* ── Trust Bar (diferenciais) ── */
function DeskTrustBar() {
  const items = [
    { icon: '🧁', title: 'Ingredientes selecionados', sub: 'Qualidade e sabor em cada detalhe' },
    { icon: '👩‍🍳', title: 'Produção artesanal', sub: 'Feito com carinho e dedicação' },
    { icon: '🚚', title: 'Entrega rápida e segura', sub: 'Receba com todo cuidado' },
    { icon: '🔒', title: 'Pagamento seguro', sub: 'Ambiente 100% seguro' },
  ]
  return (
    <div style={{ width:'100%', padding:'0 24px', boxSizing:'border-box' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0', background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', overflow:'hidden', width:'100%' }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding:'24px 28px', display:'flex', alignItems:'center', gap:'14px', borderRight: i < 3 ? '1px solid #f0f0f0' : 'none' }}>
            <span style={{ fontSize:'32px', flexShrink:0 }}>{item.icon}</span>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:'14px', color:'#1f2937' }}>{item.title}</p>
              <p style={{ margin:'3px 0 0', fontSize:'12px', color:'#9ca3af' }}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Store Info Row ── */
function DeskInfoRow({ design, config }: any) {
  const { items, totalPrice } = useCart()
  const count = items.reduce((a: number, i: any) => a + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  let statusText = '', isOpen = false, locationText = ''
  try {
    const h = config?.horario ? JSON.parse(config.horario) : null
    if (h?.abertura && h?.fechamento) {
      const now = new Date()
      const c = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
      isOpen = c >= h.abertura && c <= h.fechamento
      statusText = isOpen ? `Aberto até ${h.fechamento}` : `Abre às ${h.abertura}`
    }
  } catch {}
  try {
    const e = config?.endereco ? JSON.parse(config.endereco) : null
    if (e?.cidade) locationText = `${e.bairro ? e.bairro+', ' : ''}${e.cidade} - ${e.estado}`
  } catch {}

  const renderStars = (r: number) => Array.from({length:5},(_,i) => <Star key={i} size={14} weight={i<Math.floor(r)?"fill":"regular"} color={i<Math.floor(r)?"#fbbf24":"#d1d5db"}/>)

  return (
    <div style={{ width:'100%', padding:'0 24px', boxSizing:'border-box' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px', width:'100%', alignItems:'start' }}>

        {/* Coluna esquerda vazia — produtos vêm logo abaixo */}
        <div />

        {/* Coluna direita: Sacola + Fidelidade + Entrega empilhados */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Sacola */}
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'24px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            {count === 0 ? (
              <>
                <ShoppingBag size={28} color="#d4d4d4" style={{ marginBottom:'6px' }}/>
                <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#3e3e3e' }}>Sacola vazia</p>
                <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Adicione itens do cardápio e monte seu pedido.</p>
              </>
            ) : (
              <>
                <ShoppingBag size={24} color={design.cor_borda||'#ec4899'} style={{ marginBottom:'4px' }}/>
                <p style={{ margin:0, fontWeight:700, fontSize:'14px', color:'#3e3e3e' }}>{count} {count===1?'item':'itens'}</p>
                <p style={{ margin:'2px 0 6px', fontWeight:800, fontSize:'16px', color:'#16a34a' }}>{formatCurrency(totalPrice)}</p>
                <button onClick={() => window.dispatchEvent(new Event('open-cart'))} style={{
                  padding:'8px 20px', borderRadius:'8px', border:'none', background:design.cor_botao||'#ec4899',
                  color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif',
                }}>Ver sacola</button>
              </>
            )}
          </div>

          {/* Fidelidade */}
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>🏆</div>
              <span style={{ fontWeight:700, fontSize:'13px', color:'#1f2937' }}>Programa de fidelidade</span>
            </div>
            <p style={{ margin:0, fontSize:'11px', color:'#6b7280', lineHeight:1.5 }}>A cada <strong>R$ 100,00</strong> em compras você ganha <strong>1 ponto</strong> que pode ser trocado por prêmios.</p>
            <p style={{ margin:'4px 0 0', fontSize:'10px', color:'#9ca3af' }}>Novos clientes ganham automaticamente 50 pontos.</p>
          </div>

          {/* Entrega */}
          <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>🚚</div>
              <span style={{ fontWeight:700, fontSize:'13px', color:'#1f2937' }}>Entrega e retirada</span>
            </div>
            <p style={{ margin:0, fontSize:'11px', color:'#6b7280', lineHeight:1.5 }}>Finalize pelo WhatsApp. Escolha entrega ou retirada no checkout.</p>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ── Category Dropdown ── */
function DeskCategoryDropdown({ categories, selectedCategory, onSelectCategory, corBotao, navBg }: any) {
  const cats = categories.filter((c: any) => c.name !== 'Todos')
  const activeBg = navBg || corBotao || '#ec4899'

  return (
    <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', overflow:'hidden' }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid #f3f4f6' }}>
        <span style={{ fontSize:'12px', fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em' }}>Categorias</span>
      </div>

      {/* Todos */}
      <button
        onClick={() => onSelectCategory(null)}
        style={{
          width:'100%', padding:'11px 14px', textAlign:'left', border:'none',
          background: !selectedCategory ? activeBg : '#fff',
          color: !selectedCategory ? '#ffffff' : '#374151',
          fontSize:'13px', fontWeight: !selectedCategory ? 700 : 500,
          cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif',
          display:'flex', alignItems:'center',
          borderBottom:'1px solid #f3f4f6',
          transition:'background 0.15s, color 0.15s',
        }}
        onMouseOver={e => { if (selectedCategory) { (e.currentTarget as HTMLElement).style.background='#f3f4f6' } }}
        onMouseOut={e => { if (selectedCategory) { (e.currentTarget as HTMLElement).style.background='#fff' } }}
      >
        Todos os produtos
      </button>

      {cats.map((c: any) => (
        <button
          key={c.name}
          onClick={() => onSelectCategory(c.name)}
          style={{
            width:'100%', padding:'11px 14px', textAlign:'left', border:'none',
            background: selectedCategory === c.name ? activeBg : '#fff',
            color: selectedCategory === c.name ? '#ffffff' : '#374151',
            fontSize:'13px', fontWeight: selectedCategory === c.name ? 700 : 500,
            cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif',
            display:'flex', alignItems:'center',
            borderBottom:'1px solid #f3f4f6',
            transition:'background 0.15s, color 0.15s',
          }}
          onMouseOver={e => { if (selectedCategory !== c.name) { (e.currentTarget as HTMLElement).style.background='#f3f4f6' } }}
          onMouseOut={e => { if (selectedCategory !== c.name) { (e.currentTarget as HTMLElement).style.background='#fff' } }}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}

/* ── Products Section ── */
function DeskProducts({ produtos, favorites, onToggleFavorite, design }: any) {
  const cor = design.cor_borda || '#ec4899'

  return (
    <div style={{ width:'100%', boxSizing:'border-box' }}>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'16px', width:'100%' }}>
        {produtos.map((p: Produto) => (
          <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite}
            backgroundColor={design.cor_background||'#fff'} borderColor={cor} corBotao={design.cor_botao||'#1f2937'} />
        ))}
      </div>

      {produtos.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>
          <MagnifyingGlass size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.3 }}/>
          <p style={{ fontWeight:700, fontSize:'16px', color:'#6b7280' }}>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  )
}

/* ── Desktop Sacola Sidebar ── */
function DeskSacola({ cartCount, cartTotal, design, items }: any) {
  const [cupomAberto, setCupomAberto] = useState(false)
  const [cupomDigitado, setCupomDigitado] = useState('')
  const cor = design.cor_botao || design.cor_borda || '#ec4899'

  return (
    <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', overflow:'hidden' }}>

      {/* Calcular taxa */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid #f0f0f0', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}
        onMouseOver={e => (e.currentTarget as HTMLElement).style.background='#fafafa'}
        onMouseOut={e => (e.currentTarget as HTMLElement).style.background='#fff'}
      >
        <MapPin size={18} color={cor} weight="duotone" style={{ flexShrink:0 }}/>
        <span style={{ flex:1, fontSize:'13px', fontWeight:600, color:'#1f2937' }}>Calcular taxa e tempo de entrega</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </div>

      {/* Sacola vazia ou com itens */}
      {cartCount === 0 ? (
        <div style={{ padding:'32px 16px', display:'flex', flexDirection:'column', alignItems:'center', gap:'8px' }}>
          <div style={{ width:'64px', height:'64px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <p style={{ margin:0, fontWeight:700, fontSize:'14px', color:'#3e3e3e' }}>Sacola vazia</p>
          <p style={{ margin:0, fontSize:'12px', color:'#9ca3af', textAlign:'center', lineHeight:1.5 }}>Adicione itens do cardápio<br/>e monte seu pedido</p>
        </div>
      ) : (
        <div style={{ padding:'14px 16px' }}>
          {/* Header sacola */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <span style={{ fontWeight:700, fontSize:'14px', color:'#1f2937' }}>Sua sacola</span>
            <button
              onClick={() => window.dispatchEvent(new Event('open-cart'))}
              style={{ background:'none', border:'none', fontSize:'12px', fontWeight:600, color:cor, cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif' }}
            >LIMPAR</button>
          </div>

          {/* Itens resumidos */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
            {items.slice(0,4).map((item: any) => {
              const img = item.imageUrl?.split(',')[0]?.trim()
              return (
                <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'48px', height:'48px', borderRadius:'8px', overflow:'hidden', flexShrink:0, background:'#f3f4f6' }}>
                    {img ? <img src={img} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' }}>🧁</div>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#1f2937', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {item.saleType === 'kg' ? `${item.quantity}kg` : `${Math.floor(item.quantity)}x`} {item.name}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#9ca3af' }}>{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                </div>
              )
            })}
            {items.length > 4 && (
              <p style={{ margin:0, fontSize:'12px', color:'#9ca3af' }}>+{items.length - 4} item(ns) a mais</p>
            )}
          </div>

          {/* Subtotal / Total */}
          <div style={{ borderTop:'1px solid #f0f0f0', paddingTop:'12px', display:'flex', flexDirection:'column', gap:'4px', marginBottom:'14px' }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'13px', color:'#9ca3af' }}>Subtotal</span>
              <span style={{ fontSize:'13px', color:'#9ca3af' }}>{formatCurrency(cartTotal)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontSize:'13px', color:'#9ca3af' }}>Taxa de entrega</span>
              <span style={{ fontSize:'13px', color:'#9ca3af' }}>A definir</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
              <span style={{ fontSize:'15px', fontWeight:800, color:'#1f2937' }}>Total</span>
              <span style={{ fontSize:'15px', fontWeight:800, color:'#1f2937' }}>{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          {/* Botão finalizar */}
          <button
            onClick={() => window.dispatchEvent(new Event('open-cart'))}
            style={{ width:'100%', padding:'13px', background:cor, color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:700, cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif', marginBottom:'0' }}
          >
            Finalizar pedido
          </button>
        </div>
      )}

      {/* Cupom */}
      <div style={{ borderTop:'1px solid #f0f0f0' }}>
        <div
          onClick={() => setCupomAberto(o => !o)}
          style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}
          onMouseOver={e => (e.currentTarget as HTMLElement).style.background='#fafafa'}
          onMouseOut={e => (e.currentTarget as HTMLElement).style.background='#fff'}
        >
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#1f2937' }}>Tem um cupom?</p>
            <p style={{ margin:0, fontSize:'12px', color:'#9ca3af' }}>Clique e insira o código</p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5"
            style={{ transform: cupomAberto ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>

        {cupomAberto && (
          <div style={{ padding:'0 16px 14px', display:'flex', gap:'8px' }}>
            <input
              value={cupomDigitado}
              onChange={e => setCupomDigitado(e.target.value.toUpperCase())}
              placeholder="Digite o código"
              style={{ flex:1, padding:'10px 12px', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', color:'#1f2937', outline:'none', fontFamily:'Geist, system-ui, sans-serif', textTransform:'uppercase' }}
              onFocus={e => (e.target.style.borderColor = cor)}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
            <button style={{ padding:'10px 14px', background:cor, color:'#fff', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:700, cursor:'pointer', fontFamily:'Geist, system-ui, sans-serif', whiteSpace:'nowrap' }}>
              Aplicar
            </button>
          </div>
        )}
      </div>

    </div>
  )
}

/* ── Desktop Footer ── */
function DeskFooterBar({ design, config }: any) {
  const nome = design?.nome_loja || 'Confeitaria'
  const ano = new Date().getFullYear()

  let cnpj = ''
  let telefone = ''
  try {
    const end = config?.endereco ? JSON.parse(config.endereco) : null
    if (end?.cnpj) cnpj = end.cnpj
  } catch {}
  if (config?.telefone) telefone = config.telefone

  const cor = design?.cor_rodape || design?.cor_navbar || design?.cor_borda || '#ec4899'

  const linha2Parts = []
  if (cnpj) linha2Parts.push(`CNPJ: ${cnpj}`)

  return (
    <div style={{ background: cor, padding: '18px 24px', textAlign: 'center' }}>
      <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
        {nome} — {ano}. Todos os direitos reservados
      </p>
      {linha2Parts.length > 0 && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
          {linha2Parts.join(' | ')}
        </p>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════ */
/*              MAIN CONTENT                      */
/* ══════════════════════════════════════════════ */

function CardapioContent() {
  const { slug } = useParams<{ slug: string }>()
  const [design, setDesign] = useState<DesignSettings | null>(null)
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [isPro, setIsPro] = useState(false)
  const [categoryImages, setCategoryImages] = useState<{[key:string]:string}>({})
  const [categoriasList, setCategoriasList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const device = useDeviceDetection()
  const { items: cartItems, totalPrice: cartTotal } = useCart()
  const cartCount = cartItems.reduce((a: number, i: any) => a + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    getCardapioBySlug(slug.toLowerCase()).then(({ design, config, produtos, isPro, categoryImages, categoriasList }) => {
      if (!design) { setError('Cardápio não encontrado'); setLoading(false); return }
      setDesign(design); setConfig(config); setProdutos(produtos)
      setIsPro(isPro || false); setCategoryImages(categoryImages || {})
      setCategoriasList(categoriasList || [])
      if (config?.telefone) localStorage.setItem('cardapio_whatsapp', config.telefone)
      if (design?.nome_loja) localStorage.setItem('cardapio_nome', design.nome_loja)

      // ── Open Graph meta tags ──
      const setMeta = (prop: string, content: string) => {
        let el = document.querySelector(`meta[property="${prop}"]`) as HTMLMetaElement
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el) }
        el.setAttribute('content', content)
      }
      const setMetaName = (name: string, content: string) => {
        let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el) }
        el.setAttribute('content', content)
      }
      const pageTitle = `${design.nome_loja} — Cardápio Digital`
      const pageDesc  = design.descricao_loja || `Conheça o cardápio de ${design.nome_loja}. Encomende pelo WhatsApp!`
      const pageUrl   = window.location.href
      const ogImage   = (design as any).og_image_url || design.logo_url || ''

      document.title = pageTitle
      setMeta('og:title',       pageTitle)
      setMeta('og:description', pageDesc)
      setMeta('og:url',         pageUrl)
      setMeta('og:type',        'website')
      setMeta('og:site_name',   'Doonly')
      if (ogImage) setMeta('og:image', ogImage)
      setMetaName('description',    pageDesc)
      setMetaName('twitter:card',   'summary_large_image')
      setMetaName('twitter:title',  pageTitle)
      setMetaName('twitter:description', pageDesc)
      if (ogImage) setMetaName('twitter:image', ogImage)
      if (config) {
        localStorage.setItem('cardapio_checkout_config', JSON.stringify({
          formas_pagamento: config.formas_pagamento || ['pix'],
          formas_entrega: config.formas_entrega || ['retirada'],
          valor_entrega_propria: config.valor_entrega_propria || 0,
          entrega_por_bairro: config.entrega_por_bairro || [],
          endereco_retirada: config.endereco_retirada || '',
          horario_retirada: config.horario_retirada || '',
          exibir_campo_troco: config.exibir_campo_troco !== false,
          cupons_desconto: config.cupons_desconto || [],
          aceita_agendamento: config.aceita_agendamento !== false,
          prazo_minimo_horas: config.prazo_minimo_horas || 24,
        }))
      }
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [slug])

  const toggleFavorite = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  const getCategories = () => {
    const cats = [{ name: 'Todos', icon: '' }]
    categoriasList.forEach(c => cats.push({ name: c, icon: '' }))
    return cats
  }
  const filteredProdutos = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'40px', height:'40px', border:'3px solid #fce7f3', borderTopColor:'#ec4899', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }}/>
        <p style={{ color:'#6b7280', fontSize:'14px' }}>Carregando cardápio...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (error || !design) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb' }}>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:'24px', fontWeight:800, color:'#1f2937' }}>Cardápio não encontrado</h1>
        <p style={{ color:'#6b7280' }}>{error || 'Verifique o link e tente novamente.'}</p>
      </div>
    </div>
  )

  const isDesktop = device === 'desktop'

  /* ═══ MOBILE ═══ */
  if (!isDesktop) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: '#f8f8f8' }}>
        <NavigationMenu corBotao={design.cor_botao || design.cor_borda || '#ec4899'} />
        <div style={{ height: '160px', backgroundColor: design.cor_borda || '#ec4899' }} />
        <Logo logoUrl={design.logo_url} borderColor={design.cor_borda} storeName={design.nome_loja} storeDescription={design.descricao_loja} corNome={design.cor_nome} avaliacaoMedia={config?.avaliacao_media} configuracoes={config} hideStars={design.hide_stars} />
        <div style={{ marginTop:'16px' }}>
          <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
        </div>
        <div className="container mx-auto px-4 py-4 pb-24">
          {!design.ocultar_categorias && (
            <CategoryFilter categories={getCategories()} selectedCategory={selectedCategory} onCategorySelect={setSelectedCategory} categoryIcons={design.category_icons || {}} categoryImages={categoryImages} />
          )}
          {filteredProdutos.length > 0 ? (
            <ProductList produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite} backgroundColor={design.cor_background||'#fff'} borderColor={design.cor_borda||'#ec4899'} corBotao={design.cor_botao||'#ec4899'} selectedCategory={selectedCategory} searchTerm={searchTerm} onSearchChange={setSearchTerm} />
          ) : <EmptyState />}
        </div>
        <Footer textoRodape={design.texto_rodape} />
      </div>
    )
  }

  /* ═══ DESKTOP ═══ */
  return (
    <div style={{ minHeight:'100vh', background:'#fafafa', fontFamily:'Geist, system-ui, sans-serif', display:'flex', flexDirection:'column' }}>
      <NavigationMenu corBotao={design.cor_botao || design.cor_borda || '#ec4899'} />
      <DeskNav design={{...design, cidade_estado: (() => { try { const e = config?.endereco ? JSON.parse(config.endereco) : null; return e?.cidade ? `${e.cidade} - ${e.estado}` : '' } catch { return '' } })() }} searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div style={{ display:'flex', flexDirection:'column', gap:'16px', paddingBottom:'0', paddingTop:'24px', width:'100%', flex: 1 }}>

        {/* LINHA SUPERIOR — Categorias | Busca | Sacola */}
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 340px', gap:'16px', padding:'0 24px', boxSizing:'border-box', width:'100%', alignItems:'start' }}>

          {/* Categorias */}
          <DeskCategoryDropdown
            categories={getCategories()}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            corBotao={design.cor_botao || '#ec4899'}
            navBg={design.cor_navbar || design.cor_borda || '#ec4899'}
          />

          {/* Busca */}
          <div style={{ position:'relative' }}>
            <MagnifyingGlass size={16} style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
            <input
              value={searchTerm}
              onChange={(e: any) => setSearchTerm(e.target.value)}
              placeholder="Busque por um produto..."
              style={{
                width:'100%', padding:'13px 14px 13px 42px', boxSizing:'border-box',
                border:'1.5px solid #e5e7eb', borderRadius:'10px',
                fontSize:'14px', color:'#374151', outline:'none',
                fontFamily:'inherit', background:'#fff',
                transition:'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = design.cor_borda || '#ec4899')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:'16px', lineHeight:1 }}>✕</button>
            )}
          </div>

          {/* Sacola */}
          <DeskSacola cartCount={cartCount} cartTotal={cartTotal} design={design} items={cartItems} />

        </div>

        {/* LINHA INFERIOR — Produtos full width */}
        <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 340px', gap:'16px', padding:'0 24px', boxSizing:'border-box', width:'100%', alignItems:'start' }}>

          {/* Espaço vazio esquerda */}
          <div />

          {/* Produtos */}
          <div>
            <div style={{ display:'flex', alignItems:'center', marginBottom:'16px' }}>
              <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#1f2937' }}>Nosso Cardápio</h2>
            </div>
            <DeskProducts
              produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite}
              design={design}
            />
          </div>

          {/* Espaço vazio direita */}
          <div />

        </div>

      </div>

      <div style={{ flex: 1 }} />
      <DeskFooterBar design={design} config={config} />
    </div>
  )
}

export default function CardapioPublico() {
  return (
    <CartProvider>
      <CardapioContent />
    </CartProvider>
  )
}
