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
  const cor = design.cor_borda || '#ec4899'

  const links = [
    { icon: <Home size={15}/>, label: 'Início', active: true },
    { icon: <Store size={15}/>, label: 'Produtos', active: false },
    { icon: <Tag size={15}/>, label: 'Promoções', active: false },
    { icon: <ClipboardList size={15}/>, label: 'Pedidos', active: false },
    { icon: <Users size={15}/>, label: 'Sobre nós', active: false },
  ]

  return (
    <div style={{ background:'#fff', borderBottom:'1px solid #f0f0f0', position:'sticky', top:0, zIndex:40 }}>
      <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'0 32px', display:'flex', alignItems:'center', height:'64px', gap:'8px' }}>
        {/* Logo + nome */}
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginRight:'16px', flexShrink:0 }}>
          {design.logo_url && <img src={design.logo_url} alt="" style={{ width:'40px', height:'40px', borderRadius:'50%', objectFit:'cover' }}/>}
          <div>
            <span style={{ fontWeight:800, fontSize:'16px', color:'#1f2937', fontStyle:'italic' }}>{design.nome_loja}</span>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ display:'flex', gap:'4px' }}>
          {links.map(l => (
            <button key={l.label} style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'8px 14px', borderRadius:'50px', border:'none',
              background: l.active ? cor : 'transparent',
              color: l.active ? '#fff' : '#4b5563',
              fontSize:'13px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              transition:'background 0.15s',
            }}>
              {l.icon} {l.label}
            </button>
          ))}
        </nav>

        <div style={{ flex:1 }}/>

        {/* Search */}
        <div style={{ position:'relative', width:'240px' }}>
          <Search size={15} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#9ca3af' }}/>
          <input value={searchTerm} onChange={(e: any) => onSearchChange(e.target.value)} placeholder="Busque por um produto..."
            style={{ width:'100%', padding:'9px 12px 9px 36px', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'13px', color:'#374151', outline:'none', fontFamily:'inherit', boxSizing:'border-box', background:'#f9fafb' }}
            onFocus={(e: any) => (e.target.style.borderColor=cor)} onBlur={(e: any) => (e.target.style.borderColor='#e5e7eb')}
          />
        </div>

        {/* Sacola */}
        <button onClick={() => window.dispatchEvent(new Event('open-cart'))} style={{
          display:'flex', alignItems:'center', gap:'6px', padding:'9px 18px', borderRadius:'50px',
          border:'1.5px solid #e5e7eb', background:'#fff', color:'#374151', fontSize:'13px', fontWeight:700,
          cursor:'pointer', fontFamily:'inherit', position:'relative', marginLeft:'8px',
        }}>
          <ShoppingBag size={16}/>
          Sacola
          {count > 0 && <span style={{ position:'absolute', top:'-4px', right:'-4px', background:'#ef4444', color:'#fff', borderRadius:'50%', width:'20px', height:'20px', fontSize:'11px', fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{count}</span>}
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
    <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'20px 32px 0' }}>
      <div style={{ width:'100%', height:'280px', borderRadius:'16px', overflow:'hidden', position:'relative', background:'#1a1a1a' }}>
        <img src={banners[0]!} alt="Banner" style={{ width:'100%', height:'100%', objectFit:'cover', opacity:0.9 }}/>
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
    <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'0 32px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0', background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', overflow:'hidden' }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding:'18px 20px', display:'flex', alignItems:'center', gap:'12px', borderRight: i < 3 ? '1px solid #f0f0f0' : 'none' }}>
            <span style={{ fontSize:'28px', flexShrink:0 }}>{item.icon}</span>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:'13px', color:'#1f2937' }}>{item.title}</p>
              <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#9ca3af' }}>{item.sub}</p>
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
    <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'0 32px' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:'12px' }}>
        {/* Loja */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'18px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'64px', height:'64px', borderRadius:'14px', overflow:'hidden', flexShrink:0, border:`2px solid ${design.cor_borda||'#ec4899'}` }}>
            {design.logo_url
              ? <img src={design.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:design.cor_borda||'#ec4899', color:'#fff', fontSize:'24px', fontWeight:800 }}>{design.nome_loja?.charAt(0)}</div>
            }
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:'18px', fontWeight:800, color:'#1f2937' }}>{design.nome_loja}</h2>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'4px', flexWrap:'wrap' }}>
              {locationText && <span style={{ fontSize:'12px', color:'#6b7280', display:'flex', alignItems:'center', gap:'3px' }}><MapPin size={11}/> {locationText}</span>}
              {statusText && <span style={{ fontSize:'12px', fontWeight:600, color:isOpen?'#16a34a':'#ef4444' }}>● {statusText}</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'4px' }}>
              {renderStars(config?.avaliacao_media||5)}
              <span style={{ fontSize:'12px', fontWeight:600, color:'#6b7280', marginLeft:'2px' }}>{config?.avaliacao_media||5}/5</span>
            </div>
          </div>
        </div>

        {/* Fidelidade */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>🏆</div>
            <span style={{ fontWeight:700, fontSize:'13px', color:'#1f2937' }}>Programa de fidelidade</span>
          </div>
          <p style={{ margin:0, fontSize:'12px', color:'#6b7280', lineHeight:1.5 }}>A cada <strong>R$ 100,00</strong> em compras você ganha <strong>1 ponto</strong> que pode ser trocado por prêmios.</p>
          <p style={{ margin:'4px 0 0', fontSize:'11px', color:'#9ca3af' }}>Novos clientes ganham automaticamente 50 pontos.</p>
        </div>

        {/* Entrega */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'18px 20px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#dbeafe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px' }}>🚚</div>
            <span style={{ fontWeight:700, fontSize:'13px', color:'#1f2937' }}>Entrega e retirada</span>
          </div>
          <p style={{ margin:0, fontSize:'12px', color:'#6b7280', lineHeight:1.5 }}>Finalize pelo WhatsApp. Escolha entrega ou retirada no checkout.</p>
        </div>

        {/* Sacola */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #f0f0f0', padding:'18px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
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
      </div>
    </div>
  )
}

/* ── Products Section ── */
function DeskProducts({ produtos, favorites, onToggleFavorite, design, categories, selectedCategory, onSelectCategory }: any) {
  const cor = design.cor_borda || '#ec4899'
  const cats = categories.filter((c: any) => c.name !== 'Todos')

  return (
    <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'0 32px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
        <h2 style={{ margin:0, fontSize:'20px', fontWeight:800, color:'#1f2937' }}>Nosso Cardápio</h2>
        {/* Category chips */}
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          <button onClick={() => onSelectCategory(null)} style={{
            padding:'7px 16px', borderRadius:'50px', border:'none',
            background: !selectedCategory ? '#1f2937' : '#f3f4f6',
            color: !selectedCategory ? '#fff' : '#4b5563',
            fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>Todos</button>
          {cats.map((c: any) => (
            <button key={c.name} onClick={() => onSelectCategory(c.name)} style={{
              padding:'7px 16px', borderRadius:'50px', border:'none',
              background: selectedCategory === c.name ? '#1f2937' : '#f3f4f6',
              color: selectedCategory === c.name ? '#fff' : '#4b5563',
              fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
            }}>{c.name}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'16px' }}>
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
      <div style={{ maxWidth:'1280px', margin:'0 auto', padding:'28px 32px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'24px' }}>
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
      <DeskNav design={design} searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      <div style={{ display:'flex', flexDirection:'column', gap:'20px', paddingBottom:'0' }}>
        <DeskHero design={design} />
        <DeskTrustBar />
        <DeskInfoRow design={design} config={config} />
        <DeskProducts
          produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite}
          design={design} categories={getCategories()} selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
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
