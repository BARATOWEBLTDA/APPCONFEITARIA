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
import { DesktopProductList } from '@/components/desktop/ProductList'
import { DesktopFooter } from '@/components/desktop/Footer'
import { CartProvider } from '@/context/CartContext'
import { DesignSettings, Configuracoes, Produto } from '@/types/database'
import { Star, MapPin, Clock, Search, ShoppingBag } from 'lucide-react'
import { useCart } from '@/hooks/useCart'

/* ── Desktop Top Bar ── */
function DesktopTopBar({ design, config, searchTerm, onSearchChange, onCartClick }: any) {
  const { items } = useCart()
  const count = items.reduce((acc: number, i: any) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  // Parse horário
  let statusText = ''
  let isOpen = false
  try {
    const h = config?.horario ? JSON.parse(config.horario) : null
    if (h) {
      const now = new Date()
      const hh = now.getHours()
      const mm = now.getMinutes()
      const current = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`
      if (h.abertura && h.fechamento) {
        isOpen = current >= h.abertura && current <= h.fechamento
        statusText = isOpen ? `Aberto até ${h.fechamento}` : `Abre às ${h.abertura}`
      }
    }
  } catch {}

  // Parse endereço
  let locationText = ''
  try {
    const e = config?.endereco ? JSON.parse(config.endereco) : null
    if (e) {
      if (config?.mostrar_apenas_cidade && e.cidade) locationText = `${e.cidade} - ${e.estado}`
      else if (config?.mostrar_localizacao && e.bairro) locationText = `${e.bairro}, ${e.cidade} - ${e.estado}`
      else if (e.cidade) locationText = `${e.cidade} - ${e.estado}`
    }
  } catch {}

  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: '#fff',
      borderBottom: '1px solid #f0f0f0',
      padding: '0 32px',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '64px', gap: '20px' }}>
        {/* Logo + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {design.logo_url && (
            <img src={design.logo_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${design.cor_borda || '#ec4899'}` }} />
          )}
          <div>
            <span style={{ fontWeight: 800, fontSize: '16px', color: '#1f2937' }}>{design.nome_loja}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px' }}>
              {isOpen && <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>{statusText}</span>}
              {locationText && (
                <span style={{ fontSize: '11px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <MapPin size={10} /> {locationText}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={searchTerm} onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar no cardápio..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              border: '1.5px solid #e8e8e8', borderRadius: '8px',
              fontSize: '13px', color: '#3e3e3e', outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
            onFocus={e => (e.target.style.borderColor = design.cor_borda || '#ec4899')}
            onBlur={e => (e.target.style.borderColor = '#e8e8e8')}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Cart */}
        <button
          onClick={onCartClick}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '10px',
            border: count > 0 ? 'none' : '1.5px solid #e8e8e8',
            background: count > 0 ? (design.cor_botao || '#ec4899') : '#fff',
            color: count > 0 ? '#fff' : '#3e3e3e',
            cursor: 'pointer', fontWeight: 700, fontSize: '13px',
            fontFamily: 'inherit', position: 'relative',
          }}
        >
          <ShoppingBag size={18} />
          {count > 0 ? `Sacola (${count})` : 'Sacola'}
        </button>
      </div>
    </div>
  )
}

/* ── Desktop Hero ── */
function DesktopHero({ design, config }: any) {
  const banners = [design.banner_url, design.banner1_url, design.banner2_url, design.banner3_url].filter(Boolean)
  const hasBanner = banners.length > 0

  const renderStars = (r: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={13} fill={i < Math.floor(r) ? '#fbbf24' : 'none'} color={i < Math.ceil(r) ? '#fbbf24' : '#d1d5db'} />
  ))

  return (
    <div style={{
      maxWidth: '1200px', margin: '0 auto', padding: '20px 32px',
      display: 'flex', gap: '24px', alignItems: 'stretch',
    }}>
      {/* Banner */}
      {hasBanner && (
        <div style={{
          flex: '1 1 60%', borderRadius: '16px', overflow: 'hidden',
          maxHeight: '260px', background: '#f5f5f5',
        }}>
          <img src={banners[0]} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      {/* Info card */}
      <div style={{
        flex: hasBanner ? '1 1 40%' : '1 1 100%',
        background: '#fff', borderRadius: '16px',
        padding: '24px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        border: '1px solid #f0f0f0',
        maxWidth: hasBanner ? '420px' : '600px',
        margin: hasBanner ? 0 : '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          {design.logo_url && (
            <img src={design.logo_url} alt="" style={{
              width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover',
              border: `3px solid ${design.cor_borda || '#ec4899'}`,
              flexShrink: 0,
            }} />
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: design.cor_nome || '#1f2937' }}>
              {design.nome_loja}
            </h1>
            {!design.hide_stars && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                {renderStars(config?.avaliacao_media || 5)}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginLeft: '2px' }}>
                  {config?.avaliacao_media || 5}/5.0
                </span>
              </div>
            )}
          </div>
        </div>
        {design.descricao_loja && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
            {design.descricao_loja}
          </p>
        )}
        {/* Info chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <InfoChip icon={<Clock size={12} />} config={config} type="horario" color={design.cor_borda} />
          <InfoChip icon={<MapPin size={12} />} config={config} type="local" />
        </div>
      </div>
    </div>
  )
}

function InfoChip({ icon, config, type, color }: any) {
  let text = ''
  try {
    if (type === 'horario') {
      const h = config?.horario ? JSON.parse(config.horario) : null
      if (h?.abertura && h?.fechamento) {
        const now = new Date()
        const current = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
        const isOpen = current >= h.abertura && current <= h.fechamento
        text = isOpen ? `Aberto até ${h.fechamento}` : `Fechado · Abre às ${h.abertura}`
      }
    }
    if (type === 'local') {
      const e = config?.endereco ? JSON.parse(config.endereco) : null
      if (e?.cidade) text = `${e.bairro ? e.bairro + ', ' : ''}${e.cidade} - ${e.estado}`
    }
  } catch {}
  if (!text) return null

  const isOpen = type === 'horario' && text.startsWith('Aberto')
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '4px 10px', borderRadius: '50px', fontSize: '11px', fontWeight: 600,
      background: isOpen ? '#f0fdf4' : '#f5f5f5',
      color: isOpen ? '#16a34a' : '#6b7280',
      border: isOpen ? '1px solid #bbf7d0' : '1px solid #e8e8e8',
    }}>
      {icon} {text}
    </span>
  )
}

/* ── Desktop Categories (chips) ── */
function DesktopCategories({ categories, selected, onSelect, categoryImages, borderColor }: any) {
  return (
    <div style={{
      maxWidth: '1200px', margin: '0 auto', padding: '0 32px 16px',
      display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'wrap',
    }}>
      {categories.map((c: any) => {
        const active = (c.name === 'Todos' && !selected) || c.name === selected
        return (
          <button
            key={c.name}
            onClick={() => onSelect(c.name === 'Todos' ? null : c.name)}
            style={{
              padding: '7px 16px', borderRadius: '50px',
              border: active ? `2px solid ${borderColor || '#ec4899'}` : '1.5px solid #e8e8e8',
              background: active ? `${borderColor || '#ec4899'}10` : '#fff',
              color: active ? borderColor || '#ec4899' : '#3e3e3e',
              fontSize: '13px', fontWeight: active ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            {categoryImages[c.name] && (
              <img src={categoryImages[c.name]} alt="" style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
            )}
            {c.name}
          </button>
        )
      })}
    </div>
  )
}

/* ── Main Content ── */
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
  const [cartOpen, setCartOpen] = useState(false)
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #fce7f3', borderTopColor: '#ec4899', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Carregando cardápio...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (error || !design) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1f2937', marginBottom: '8px' }}>Cardápio não encontrado</h1>
        <p style={{ color: '#6b7280' }}>{error || 'Verifique o link e tente novamente.'}</p>
      </div>
    </div>
  )

  const isDesktop = device === 'desktop'

  // ═══ MOBILE ═══
  if (!isDesktop) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: design.cor_background || '#fef2f2' }}>
        <NavigationMenu />
        <div style={{ height: '160px', backgroundColor: design.cor_borda || '#ec4899' }} />
        <Logo
          logoUrl={design.logo_url} borderColor={design.cor_borda}
          storeName={design.nome_loja} storeDescription={design.descricao_loja}
          corNome={design.cor_nome} avaliacaoMedia={config?.avaliacao_media}
          configuracoes={config} hideStars={design.hide_stars}
        />
        <div style={{ marginTop: '16px' }}>
          <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
        </div>
        <div className="container mx-auto px-4 py-4 pb-24">
          {!design.ocultar_categorias && (
            <CategoryFilter
              categories={getCategories()} selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              categoryIcons={design.category_icons || {}} categoryImages={categoryImages}
            />
          )}
          {filteredProdutos.length > 0 ? (
            <ProductList
              produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite}
              backgroundColor={design.cor_background || '#fff'} borderColor={design.cor_borda || '#ec4899'}
              corBotao={design.cor_botao || '#ec4899'} selectedCategory={selectedCategory}
              searchTerm={searchTerm} onSearchChange={setSearchTerm}
            />
          ) : <EmptyState />}
        </div>
        <Footer textoRodape={design.texto_rodape} />
      </div>
    )
  }

  // ═══ DESKTOP ═══
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa' }}>
      {/* Nav com modal do carrinho */}
      <NavigationMenu />

      {/* Top bar */}
      <DesktopTopBar design={design} config={config} searchTerm={searchTerm} onSearchChange={setSearchTerm} onCartClick={() => window.dispatchEvent(new Event('open-cart'))} />

      {/* Hero */}
      <DesktopHero design={design} config={config} />

      {/* Categories */}
      {!design.ocultar_categorias && (
        <DesktopCategories
          categories={getCategories()} selected={selectedCategory}
          onSelect={setSelectedCategory} categoryImages={categoryImages}
          borderColor={design.cor_borda}
        />
      )}

      {/* Products */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px 48px' }}>
        {filteredProdutos.length > 0 ? (
          <DesktopProductList
            produtos={filteredProdutos} favorites={favorites} onToggleFavorite={toggleFavorite}
            backgroundColor={design.cor_background || '#fff'} borderColor={design.cor_borda || '#ec4899'}
            corBotao={design.cor_botao || '#ec4899'} selectedCategory={selectedCategory}
            searchTerm={searchTerm} onSearchChange={setSearchTerm}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <Search size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.3 }} />
            <p style={{ fontWeight: 700, fontSize: '16px', color: '#6b7280' }}>Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      <DesktopFooter textoRodape={design.texto_rodape} />
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
