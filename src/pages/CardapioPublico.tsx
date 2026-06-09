import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getCardapioBySlug } from '@/services/cardapio'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { BannerAd } from '@/components/cardapio/BannerAd'
import { Logo } from '@/components/cardapio/Logo'
import { DesktopLogo } from '@/components/desktop/Logo'
import { CategoryFilter } from '@/components/cardapio/CategoryFilter'
import { DesktopCategoryFilter } from '@/components/desktop/CategoryFilter'
import { ProductList } from '@/components/cardapio/ProductList'
import { DesktopProductList } from '@/components/desktop/ProductList'
import { NavigationMenu } from '@/components/cardapio/NavigationMenu'
import { EmptyState } from '@/components/cardapio/EmptyState'
import { DesktopEmptyState } from '@/components/desktop/EmptyState'
import { Footer } from '@/components/cardapio/Footer'
import { DesktopFooter } from '@/components/desktop/Footer'
import { CartProvider } from '@/context/CartContext'
import { DesignSettings, Configuracoes } from '@/types/database'
import { Produto } from '@/types/database'

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
      setDesign(design)
      setConfig(config)
      setProdutos(produtos)
      setIsPro(isPro || false)
      setCategoryImages(categoryImages || {})
      setCategoriasList(categoriasList || [])
      if (config?.telefone) localStorage.setItem('cardapio_whatsapp', config.telefone)
      if (design?.nome_loja) localStorage.setItem('cardapio_nome', design.nome_loja)
      // Salva config de checkout para o modal do carrinho
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
    const cats = [{ name: 'Todos', icon: '/icons/TODOS.png' }]
    categoriasList.forEach(c => cats.push({ name: c, icon: '/icons/1.png' }))
    return cats
  }

  const filteredProdutos = produtos.filter(p => {
    const s = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    const c = !selectedCategory || p.categoria === selectedCategory
    return s && c
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-pink-600 mx-auto mb-4" />
        <p className="text-gray-600">Carregando cardápio...</p>
      </div>
    </div>
  )

  if (error || !design) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Cardápio não encontrado</h1>
        <p className="text-gray-600">{error || 'Verifique o link e tente novamente.'}</p>
      </div>
    </div>
  )

  const isDesktop = device === 'desktop'
  const LogoC = isDesktop ? DesktopLogo : Logo
  const CategoryC = isDesktop ? DesktopCategoryFilter : CategoryFilter
  const ProductC = isDesktop ? DesktopProductList : ProductList
  const NavC = NavigationMenu // Checkout compartilhado mobile/desktop
  const EmptyC = isDesktop ? DesktopEmptyState : EmptyState
  const FooterC = isDesktop ? DesktopFooter : Footer

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: design.cor_background || '#fef2f2' }}>
      <NavC />

      <div style={{ height: '160px', backgroundColor: design.cor_borda || '#ec4899' }} />

      <LogoC
        logoUrl={design.logo_url}
        borderColor={design.cor_borda}
        storeName={design.nome_loja}
        storeDescription={design.descricao_loja}
        corNome={design.cor_nome}
        avaliacaoMedia={config?.avaliacao_media}
        configuracoes={config}
        hideStars={design.hide_stars}
      />

      <div style={{ marginTop: '16px' }}>
        <BannerAd
          bannerUrl={design.banner_url}
          banner1Url={design.banner1_url}
          banner2Url={design.banner2_url}
          banner3Url={design.banner3_url}
          isPro={isPro}
        />
      </div>

      <div className={`container mx-auto px-4 py-4 pb-24 ${isDesktop ? 'max-w-6xl' : ''}`}>
        {!design.ocultar_categorias && (
          <CategoryC
            categories={getCategories()}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            categoryIcons={design.category_icons || {}}
            categoryImages={categoryImages}
          />
        )}

        {filteredProdutos.length > 0 ? (
          <ProductC
            produtos={filteredProdutos}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            backgroundColor={design.cor_background || '#ffffff'}
            borderColor={design.cor_borda || '#ec4899'}
            corBotao={design.cor_botao || '#ec4899'}
            selectedCategory={selectedCategory}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        ) : (
          <EmptyC />
        )}
      </div>

      <FooterC textoRodape={design.texto_rodape} />
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
