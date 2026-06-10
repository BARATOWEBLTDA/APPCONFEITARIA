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
import { Star, MapPin, Search, ShoppingBag, Home, Store, Tag, ClipboardList, Users, ChevronDown, Clock, Truck, CreditCard, Shield, Heart, MessageCircle } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/utils/helpers'

/* ══════════════════════════════════════════════ */
/*     DESKTOP COMPONENTS — Layout profissional   */
/* ══════════════════════════════════════════════ */

/* ── Top Nav Bar ── */
function DeskNav({ design, searchTerm, onSearchChange }: any) {
  const { items } = useCart()
  const count = items.reduce((a: number, i: any) => a + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)
  const corBorda = design.cor_borda || '#ec4899'
  const corBotao = design.cor_botao || '#ec4899'
  const corSacola = design.cor_sacola || design.cor_botao || '#ec4899'
  const navBg = design.cor_navbar || '#ffffff'

  // Detecta se o fundo do navbar é escuro para adaptar cores
  const isNavDark = (() => {
    const hex = navBg.replace('#', '')
    if (hex.length < 6) return false
    const r = parseInt(hex.slice(0,2), 16)
    const g = parseInt(hex.slice(2,4), 16)
    const b = parseInt(hex.slice(4,6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance < 0.5
  })()

  // Cor do texto adaptada ao fundo
  const textColor = isNavDark ? '#ffffff' : '#1f2937'
  const textMuted = isNavDark ? 'rgba(255,255,255,0.55)' : '#9ca3af'
  const textNav   = isNavDark ? 'rgba(255,255,255,0.75)' : '#4b5563'
  // Hover: fundo levemente mais claro/escuro que o navbar
  const hoverBg   = isNavDark ? 'rgba(255,255,255,0.12)' : '#f3f4f6'
  // Ativo: um pouco mais destacado que o hover mas ainda na paleta do navbar
  const activeBg  = isNavDark ? 'rgba(255,255,255,0.2)' : corBotao
  const activeText = isNavDark ? '#ffffff' : '#ffffff'

  const links = [
    { icon: <Home size={15}/>, label: 'Início', active: true },
    { icon: <Store size={15}/>, label: 'Produtos', active: false },
    { icon: <Tag size={15}/>, label: 'Promoções', active: false },
    { icon: <ClipboardList size={15}/>, label: 'Pedidos', active: false },
    { icon: <Users size={15}/>, label: 'Sobre nós', active: false },
  ]

  return (
    <div style={{ background: navBg, borderBottom: isNavDark ? 'none' : '1px solid #f0f0f0', position:'sticky', top:0, zIndex:40, boxShadow:'0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ width:'100%', padding:'0 48px', boxSizing:'border-box', display:'flex', alignItems:'center', height:'72px', gap:'16px' }}>

        {/* Logo + nome + cidade */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginRight:'8px', flexShrink:0 }}>
          {design.logo_url
            ? <img src={design.logo_url} alt="" style={{ width:'48px', height:'48px', borderRadius:'50%', objectFit:'cover', border:`2px solid ${corBorda}` }}/>
            : <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:corBorda, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'20px', fontWeight:800, flexShrink:0 }}>{design.nome_loja?.charAt(0)}</div>
          }
          <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
            <span style={{ fontWeight:800, fontSize:'16px', color: design.cor_nome || textColor, lineHeight:1, fontFamily:'inherit' }}>{design.nome_loja}</span>
            <span style={{ fontSize:'11px', color: textMuted, fontWeight:500, lineHeight:1 }}>
              {design.cidade_estado || 'Doces que encantam'}
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ display:'flex', gap:'2px' }}>
          {links.map(l => (
            <button key={l.label} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'8px 14px', borderRadius:'6px', border:'none',
              background: l.active ? activeBg : 'transparent',
              color: l.active ? activeText : textNav,
              fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.15s',
            }}
              onMouseOver={e => { if (!l.active) (e.currentTarget as HTMLElement).style.background = hoverBg }}
              onMouseOut={e => { if (!l.active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {l.icon} {l.label}
            </button>
          ))}
        </nav>

        <div style={{ flex:1 }}/>

        {/* Search */}
        <div style={{ position:'relative', width:'300px' }}>
          <Search size={15} style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', color: textMuted }}/>
          <input value={searchTerm} onChange={(e: any) => onSearchChange(e.target.value)}
            placeholder="Busque por um produto..."
            style={{ width:'100%', padding:'10px 14px 10px 40px', border: isNavDark ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', color: isNavDark ? '#fff' : '#374151', outline:'none', fontFamily:'inherit', boxSizing:'border-box', background: isNavDark ? 'rgba(255,255,255,0.1)' : '#f9fafb' }}
            onFocus={(e: any) => { e.target.style.borderColor = corBotao; e.target.style.background = isNavDark ? 'rgba(255,255,255,0.15)' : '#fff' }}
            onBlur={(e: any) => { e.target.style.borderColor = isNavDark ? 'rgba(255,255,255,0.2)' : '#e5e7eb'; e.target.style.background = isNavDark ? 'rgba(255,255,255,0.1)' : '#f9fafb' }}
          />
        </div>

        {/* Sacola */}
        <button onClick={() => window.dispatchEvent(new Event('open-cart'))} style={{
          display:'flex', alignItems:'center', gap:'8px', padding:'10px 22px', borderRadius:'8px',
          border:'none', background: corSacola, color:'#fff', fontSize:'14px', fontWeight:700,
          cursor:'pointer', fontFamily:'inherit', position:'relative', flexShrink:0,
          boxShadow:`0 2px 8px ${corSacola}44`, transition:'opacity 0.15s',
        }}
          onMouseOver={e => (e.currentTarget.style.opacity='0.9')}
          onMouseOut={e => (e.currentTarget.style.opacity='1')}
        >
          <ShoppingBag size={17}/>
          Sacola
          {count > 0 && (
            <span style={{ background:'#fff', color:corSacola, borderRadius:'4px', width:'20px', height:'20px', fontSize:'11px', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', marginLeft:'2px' }}>{count}</span>
          )}
        </button>

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

  const renderStars = (r: number) => Array.from({length:5},(_,i) => <Star key={i} size={14} fill={i<Math.floor(r)?'#fbbf24':'none'} color={i<Math.ceil(r)?'#fbbf24':'#d1d5db'}/>)

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
                  color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
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
function DeskCategoryDropdown({ categories, selectedCategory, onSelectCategory, corBotao }: any) {
  const [open, setOpen] = useState(false)
  const cats = categories.filter((c: any) => c.name !== 'Todos')
  const activeLabel = selectedCategory || 'Categorias'

  return (
    <div style={{ padding:'0 24px', boxSizing:'border-box', width:'100%' }}>
      <div style={{ position:'relative', display:'inline-block' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display:'flex', alignItems:'center', gap:'8px', padding:'9px 16px',
            background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:'8px',
            fontSize:'13px', fontWeight:600, color:'#374151', cursor:'pointer',
            fontFamily:'inherit', transition:'border-color 0.15s',
            borderColor: open ? corBotao : '#e5e7eb',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="9" y2="18"/>
          </svg>
          {activeLabel}
          {selectedCategory && (
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:corBotao, flexShrink:0 }}/>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {open && (
          <div style={{
            position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:50,
            background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:'10px',
            boxShadow:'0 8px 24px rgba(0,0,0,0.1)', minWidth:'180px', overflow:'hidden',
          }}>
            {/* Todos */}
            <button
              onClick={() => { onSelectCategory(null); setOpen(false) }}
              style={{
                width:'100%', padding:'10px 16px', textAlign:'left', border:'none',
                background: !selectedCategory ? `${corBotao}12` : '#fff',
                color: !selectedCategory ? corBotao : '#374151',
                fontSize:'13px', fontWeight: !selectedCategory ? 700 : 500,
                cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'8px',
                borderBottom:'1px solid #f3f4f6',
              }}
              onMouseOver={e => { if (selectedCategory) (e.currentTarget as HTMLElement).style.background='#f9fafb' }}
              onMouseOut={e => { if (selectedCategory) (e.currentTarget as HTMLElement).style.background='#fff' }}
            >
              {!selectedCategory && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:corBotao, flexShrink:0 }}/>}
              Todos os produtos
            </button>

            {cats.map((c: any) => (
              <button
                key={c.name}
                onClick={() => { onSelectCategory(c.name); setOpen(false) }}
                style={{
                  width:'100%', padding:'10px 16px', textAlign:'left', border:'none',
                  background: selectedCategory === c.name ? `${corBotao}12` : '#fff',
                  color: selectedCategory === c.name ? corBotao : '#374151',
                  fontSize:'13px', fontWeight: selectedCategory === c.name ? 700 : 500,
                  cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'8px',
                  borderBottom:'1px solid #f3f4f6',
                }}
                onMouseOver={e => { if (selectedCategory !== c.name) (e.currentTarget as HTMLElement).style.background='#f9fafb' }}
                onMouseOut={e => { if (selectedCategory !== c.name) (e.currentTarget as HTMLElement).style.background='#fff' }}
              >
                {selectedCategory === c.name && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:corBotao, flexShrink:0 }}/>}
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Products Section ── */
function DeskProducts({ produtos, favorites, onToggleFavorite, design }: any) {
  const cor = design.cor_borda || '#ec4899'

  return (
    <div style={{ width:'100%', boxSizing:'border-box' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:'16px' }}>
        <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#1f2937' }}>Nosso Cardápio</h2>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'16px', width:'100%' }}>
        {produtos.map((p: Produto) => (
          <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={onToggleFavorite}
            backgroundColor={design.cor_background||'#fff'} borderColor={cor} corBotao={design.cor_botao||'#1f2937'} />
        ))}
      </div>

      {produtos.length === 0 && (
        <div style={{ textAlign:'center', padding:'48px', color:'#9ca3af' }}>
          <Search size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.3 }}/>
          <p style={{ fontWeight:700, fontSize:'16px', color:'#6b7280' }}>Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  )
}

/* ── Desktop Footer ── */
function DeskFooterBar({ design, config }: any) {
  const whatsapp = config?.telefone || ''
  return (
    <div style={{ background:'#1f2937', marginTop:'48px' }}>
      <div style={{ width:'100%', padding:'28px 24px', display:'grid', boxSizing:'border-box', gridTemplateColumns:'repeat(4,1fr)', gap:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#25D366', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <MessageCircle size={20} color="#fff"/>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#fff' }}>Fale conosco pelo WhatsApp</p>
            <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Tire dúvidas e faça seu pedido</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <CreditCard size={20} color="#9ca3af"/>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#fff' }}>Formas de pagamento</p>
            <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Pix, Cartão de crédito, Débito e Dinheiro</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Heart size={20} color="#9ca3af"/>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#fff' }}>Aceitamos encomendas</p>
            <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Encomende sua festa, evento ou data especial</p>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <Shield size={20} color="#9ca3af"/>
          </div>
          <div>
            <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#fff' }}>Curta nossas redes</p>
            <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Siga-nos e fique por dentro das novidades!</p>
          </div>
        </div>
      </div>
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
      <div className="min-h-screen relative" style={{ backgroundColor: design.cor_background || '#fef2f2' }}>
        <NavigationMenu />
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
    <div style={{ minHeight:'100vh', background:'#fafafa', fontFamily:'Inter, system-ui, sans-serif' }}>
      <NavigationMenu />
      <DeskNav design={{...design, cidade_estado: (() => { try { const e = config?.endereco ? JSON.parse(config.endereco) : null; return e?.cidade ? `${e.cidade} - ${e.estado}` : '' } catch { return '' } })() }} searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div style={{ display:'flex', flexDirection:'column', gap:'20px', paddingBottom:'0', width:'100%' }}>
        <DeskHero design={design} />
        <DeskTrustBar />

        {/* Dropdown de categorias — entre trust bar e produtos */}
        <DeskCategoryDropdown
          categories={getCategories()}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          corBotao={design.cor_botao || '#ec4899'}
        />

        {/* Layout principal: produtos à esquerda, sidebar à direita */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px', padding:'0 24px', boxSizing:'border-box', width:'100%', alignItems:'start' }}>

          {/* COLUNA ESQUERDA — Produtos */}
          <DeskProducts
            produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite}
            design={design}
          />

          {/* COLUNA DIREITA — Sacola + Fidelidade + Entrega */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', position:'sticky', top:'80px' }}>

            {/* Sacola */}
            <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'24px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              {cartCount === 0 ? (
                <>
                  <ShoppingBag size={28} color="#d4d4d4" style={{ marginBottom:'6px' }}/>
                  <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#3e3e3e' }}>Sacola vazia</p>
                  <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>Adicione itens do cardápio e monte seu pedido.</p>
                </>
              ) : (
                <>
                  <ShoppingBag size={24} color={design.cor_borda||'#ec4899'} style={{ marginBottom:'4px' }}/>
                  <p style={{ margin:0, fontWeight:700, fontSize:'14px', color:'#3e3e3e' }}>{cartCount} {cartCount===1?'item':'itens'}</p>
                  <p style={{ margin:'2px 0 6px', fontWeight:800, fontSize:'16px', color:'#16a34a' }}>{formatCurrency(cartTotal)}</p>
                  <button onClick={() => window.dispatchEvent(new Event('open-cart'))} style={{
                    padding:'8px 20px', borderRadius:'8px', border:'none', background:design.cor_botao||'#ec4899',
                    color:'#fff', fontSize:'12px', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
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
