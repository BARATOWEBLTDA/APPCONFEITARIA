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
import { Star, MapPin, Clock, Search, ShoppingBag, Home, Tag, ClipboardList, ChevronDown } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/utils/helpers'

/* ══════════════════════════════════════════════ */
/*          DESKTOP COMPONENTS                    */
/* ══════════════════════════════════════════════ */

function DesktopNavBar({ color, searchTerm, onSearchChange }: { color: string; searchTerm: string; onSearchChange: (t: string) => void }) {
  const { items, totalPrice } = useCart()
  const count = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  return (
    <div style={{ background: color, padding: '0 32px', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '52px', gap: '6px' }}>
        {/* Nav links */}
        {[
          { icon: <Home size={14} />, label: 'Início' },
          { icon: <Tag size={14} />, label: 'Promoções' },
          { icon: <ClipboardList size={14} />, label: 'Pedidos' },
        ].map(t => (
          <button key={t.label} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '50px',
            background: t.label === 'Início' ? 'rgba(255,255,255,0.25)' : 'transparent',
            border: 'none', color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
          <input
            value={searchTerm} onChange={e => onSearchChange(e.target.value)}
            placeholder="Busque por um produto"
            style={{
              width: '100%', padding: '7px 12px 7px 32px',
              border: '1.5px solid rgba(255,255,255,0.3)', borderRadius: '8px',
              fontSize: '12px', color: 'white', outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.15)',
            }}
          />
        </div>

        {/* Sacola */}
        <button
          onClick={() => window.dispatchEvent(new Event('open-cart'))}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '50px',
            background: 'rgba(255,255,255,0.2)', border: '1.5px solid rgba(255,255,255,0.3)',
            color: 'white', fontSize: '13px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            position: 'relative',
          }}
        >
          <ShoppingBag size={15} />
          Sacola
          {count > 0 && (
            <span style={{
              position: 'absolute', top: '-6px', right: '-6px',
              background: '#ef4444', color: 'white', borderRadius: '50%',
              width: '20px', height: '20px', fontSize: '11px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{count}</span>
          )}
        </button>
      </div>
    </div>
  )
}

function DesktopHeroBanner({ design, config }: { design: DesignSettings; config: Configuracoes | null }) {
  const banners = [design.banner_url, design.banner1_url, design.banner2_url, design.banner3_url].filter(Boolean)
  const hasBanner = banners.length > 0

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
    if (e?.cidade) locationText = `${e.bairro ? e.bairro + ', ' : ''}${e.cidade} - ${e.estado}`
  } catch {}

  const renderStars = (r: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={14} fill={i < Math.floor(r) ? '#fbbf24' : 'none'} color={i < Math.ceil(r) ? '#fbbf24' : '#d1d5db'} />
  ))

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 32px' }}>
      {/* Banner */}
      <div style={{
        width: '100%', height: hasBanner ? '240px' : '120px',
        borderRadius: '0 0 16px 16px', overflow: 'hidden',
        background: hasBanner ? '#f5f5f5' : (design.cor_borda || '#ec4899'),
        position: 'relative',
      }}>
        {hasBanner && <img src={banners[0]!} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        {!hasBanner && <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${design.cor_borda || '#ec4899'}, ${design.cor_borda || '#ec4899'}dd)` }} />}
      </div>

      {/* Info overlay */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: '16px',
        marginTop: '-36px', padding: '0 24px', position: 'relative', zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          width: '80px', height: '80px', borderRadius: '16px',
          border: '4px solid white', background: '#fff',
          overflow: 'hidden', flexShrink: 0,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        }}>
          {design.logo_url
            ? <img src={design.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: design.cor_borda || '#ec4899', color: 'white', fontSize: '32px', fontWeight: 800 }}>{design.nome_loja?.charAt(0)}</div>
          }
        </div>

        {/* Store info */}
        <div style={{ paddingBottom: '4px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1f2937' }}>{design.nome_loja}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
            {statusText && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: isOpen ? '#16a34a' : '#ef4444' }}>
                {isOpen ? '●' : '●'} {statusText}
              </span>
            )}
            {locationText && (
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MapPin size={11} /> {locationText}
              </span>
            )}
            {!design.hide_stars && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                {renderStars(config?.avaliacao_media || 5)}
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>{config?.avaliacao_media || 5}/5.0</span>
              </span>
            )}
          </div>
          {design.descricao_loja && (
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280', maxWidth: '500px' }}>{design.descricao_loja}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function DesktopSidebar({ design }: { design: DesignSettings }) {
  const { items, totalPrice } = useCart()
  const count = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: '80px' }}>
      {/* Sacola */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #f0f0f0',
        padding: '20px', textAlign: 'center',
      }}>
        {count === 0 ? (
          <>
            <ShoppingBag size={36} color="#d4d4d4" style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#3e3e3e' }}>Sacola vazia</p>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>Adicione itens do cardápio</p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#3e3e3e' }}>🛒 Sacola</span>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>{count} {count === 1 ? 'item' : 'itens'}</span>
            </div>
            {items.slice(0, 3).map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', textAlign: 'left' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', overflow: 'hidden', background: '#f5f5f5', flexShrink: 0 }}>
                  {item.imageUrl
                    ? <img src={item.imageUrl.split(',')[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🧁</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#3e3e3e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{item.saleType === 'kg' ? `${item.quantity}kg` : `${item.quantity}x`} · {formatCurrency(item.price * item.quantity)}</p>
                </div>
              </div>
            ))}
            {items.length > 3 && <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 8px' }}>+{items.length - 3} {items.length - 3 === 1 ? 'item' : 'itens'}</p>}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '10px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#3e3e3e' }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: '16px', color: '#16a34a' }}>{formatCurrency(totalPrice)}</span>
            </div>
            <button
              onClick={() => window.dispatchEvent(new Event('open-cart'))}
              style={{
                width: '100%', marginTop: '12px', padding: '11px',
                background: design.cor_botao || '#ec4899', color: 'white',
                border: 'none', borderRadius: '10px', fontWeight: 700,
                fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ver sacola
            </button>
          </>
        )}
      </div>

      {/* Programa de fidelidade */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #f0f0f0',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏆</div>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#3e3e3e' }}>Programa de fidelidade</span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
          A cada <strong>R$ 100,00</strong> em compras você ganha <strong>1 ponto</strong> que pode ser trocado por prêmios.
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#9ca3af' }}>
          Novos clientes ganham automaticamente 50 pontos.
        </p>
      </div>

      {/* Calcular entrega */}
      <div style={{
        background: '#fff', borderRadius: '12px', border: '1px solid #f0f0f0',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <span style={{ fontSize: '16px' }}>🚚</span>
          <span style={{ fontWeight: 700, fontSize: '13px', color: '#3e3e3e' }}>Entrega e retirada</span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>
          Finalize pelo WhatsApp. Escolha entrega ou retirada no checkout.
        </p>
      </div>
    </div>
  )
}

function DesktopCategoryBar({ categories, selected, onSelect, categoryImages, borderColor, searchTerm, onSearchChange }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '16px 0', borderBottom: '1px solid #f0f0f0', marginBottom: '20px',
    }}>
      {/* Dropdown categorias */}
      <div style={{ position: 'relative' }}>
        <select
          value={selected || ''}
          onChange={e => onSelect(e.target.value || null)}
          style={{
            padding: '9px 32px 9px 14px', borderRadius: '8px',
            border: '1.5px solid #e8e8e8', fontSize: '13px', fontWeight: 600,
            color: '#3e3e3e', appearance: 'none', background: '#fff',
            fontFamily: 'inherit', cursor: 'pointer', minWidth: '180px',
          }}
        >
          <option value="">Todas as categorias</option>
          {categories.filter((c: any) => c.name !== 'Todos').map((c: any) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: '320px', position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          value={searchTerm} onChange={(e: any) => onSearchChange(e.target.value)}
          placeholder="Busque por um produto"
          style={{
            width: '100%', padding: '9px 12px 9px 34px',
            border: '1.5px solid #e8e8e8', borderRadius: '8px',
            fontSize: '13px', color: '#3e3e3e', outline: 'none',
            fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onFocus={(e: any) => (e.target.style.borderColor = borderColor || '#ec4899')}
          onBlur={(e: any) => (e.target.style.borderColor = '#e8e8e8')}
        />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════ */
/*          MAIN CONTENT                          */
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

  /* ═══ MOBILE ═══ */
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

  /* ═══ DESKTOP — Layout estilo Cardápio Web / Anota Aí ═══ */
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* NavigationMenu renderiza só o modal do carrinho no desktop */}
      <NavigationMenu />

      {/* Top nav colorida */}
      <DesktopNavBar color={design.cor_borda || '#ec4899'} searchTerm={searchTerm} onSearchChange={setSearchTerm} />

      {/* Banner hero + info da loja */}
      <DesktopHeroBanner design={design} config={config} />

      {/* Conteúdo principal: 2 colunas */}
      <div style={{
        maxWidth: '1200px', margin: '24px auto 0', padding: '0 32px 48px',
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* Coluna esquerda: categorias + produtos */}
        <div>
          {!design.ocultar_categorias && (
            <DesktopCategoryBar
              categories={getCategories()} selected={selectedCategory}
              onSelect={setSelectedCategory} categoryImages={categoryImages}
              borderColor={design.cor_borda}
              searchTerm={searchTerm} onSearchChange={setSearchTerm}
            />
          )}

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

        {/* Coluna direita: sidebar */}
        <DesktopSidebar design={design} />
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
