import { useState, useEffect } from 'react'
import { explicarErro } from '@/lib/erros'
import { SeloVerificado } from '@/components/cardapio/SeloVerificado'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getCardapioByCodigo, getCardapioBySlug } from '@/services/cardapio'
import { supabase } from '@/lib/supabase'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { BannerAd } from '@/components/cardapio/BannerAd'
import { Logo } from '@/components/cardapio/Logo'
import { ProductList } from '@/components/cardapio/ProductList'
import { montarSecoes, SecaoCardapio, LinhaProduto } from '@/components/cardapio/ItensCardapio'
import { contarItens, qtdItem, valorLinha, detalhesItem } from '@/lib/itemSacola'
import { NavigationMenu } from '@/components/cardapio/NavigationMenu'
import { definirLojaAtual } from '@/components/cardapio/lojaAtual'
import { EmptyState } from '@/components/cardapio/EmptyState'
import { Footer } from '@/components/cardapio/Footer'
import { CardapioModelo1, getStatusLoja } from '@/components/cardapio/CardapioModelo1'
import { unidadeItem } from '@/components/cart/CartItemComponent'
import { CartProvider } from '@/context/CartContext'
import { DesignSettings, Configuracoes, Produto } from '@/types/database'
import { PerfilTab } from '@/components/cardapio/PerfilTab'
import { PedidosTab } from '@/components/cardapio/PedidosTab'
import { MapPin, House, MagnifyingGlass, ShoppingBag, Storefront, User, X } from '@phosphor-icons/react'
import { SobreLoja } from '@/components/cardapio/SobreLoja'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/utils/helpers'
import { corClara, nomeSobreTopo } from '@/lib/coresCardapio'
import { Touquinha, useClasseTema } from '@/components/tema/Natal'
import './cardapioPublico.css'

/* ══════════════════════════════════════════════ */
/*     COMPUTADOR (08/10 · 3.28, no padrão do guia) */
/*     Topo: Início · Sobre nós · Minha conta.       */
/*     Saíram "Promoções" (não fazia nada), "Calcular */
/*     taxa" e o cupom de mentira da sacola.          */
/* ══════════════════════════════════════════════ */

// Cor do nome da loja (02/10): sem cor escolhida, branco no computador (faixa) e escuro no celular.
const COR_NOME_PADRAO = ["", "#1f2937", "#000000", "#000", "#111111"];
const corNomeEscolhida = (c?: string | null) => (c && !COR_NOME_PADRAO.includes(c.trim().toLowerCase()) ? c : null);
const corNomeCelular = (c?: string | null) => corNomeEscolhida(c) || "#000000";
const corValida = (c: string | undefined | null): boolean => {
  if (!c) return false
  const norm = c.trim().toLowerCase().replace(/\s/g, '')
  return !['', '#fff', '#ffffff', '#fefefe', 'white', 'transparent', 'rgb(255,255,255)', 'rgba(255,255,255,1)'].includes(norm)
}
const corDoTopo = (design: DesignSettings) => corValida(design.cor_navbar) ? design.cor_navbar! : (corValida(design.cor_borda) ? design.cor_borda! : '#BF6B84')

/* ── Topo do computador ── */
function DeskNav({ design, config, isPro = false }: { design: DesignSettings; config: Configuracoes | null; isPro?: boolean }) {
  const navBg = corDoTopo(design)
  const corBorda = design.cor_borda || '#E85A8C'
  const [aba, setAba] = useState<'inicio' | 'sobre' | 'conta'>('inicio')
  const [contaAba, setContaAba] = useState<'pedidos' | 'perfil'>('pedidos')
  // 10/10: a loja desta página (antes vinha do localStorage, que é do navegador inteiro)
  const confeteiraUserId = design.user_id || ''
  const accent = design.cor_botao || design.cor_borda || '#E85A8C'
  const status = (config as any)?.loja_pausada ? { aberto: false, msg: 'Pedidos pausados no momento', curto: 'Pedidos pausados' } : getStatusLoja((config as any)?.horario || null)
  let cidade = ''
  try { const e = config?.endereco ? (typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco) : null; if (e?.cidade && ((config as any)?.mostrar_localizacao || (config as any)?.mostrar_apenas_cidade)) cidade = [e.cidade, e.estado].filter(Boolean).join(' - ') } catch {}
  const sub = status?.msg || '' // (14/10) a cidade vai numa linha só dela

  return (
    <>
      <header className={`cp-topo${corClara(navBg) ? ' cp-topo--clara' : ''}`} style={{ background: navBg }}>
        <div className="cp-topo-in">
          <div className="cp-topo-loja">
            <span className="cp-topo-logo-w">
              <span className="cp-topo-logo" style={{ borderColor: corBorda }}>
                {design.logo_url ? <img src={design.logo_url} alt="" /> : <b style={{ background: corBorda }}>{design.nome_loja?.charAt(0)}</b>}
              </span>
              {design.tema === 'natal' && <Touquinha className="cp-touca" tamanho={46} />}
            </span>
            <div>
              <p className="cp-topo-nome" style={{ color: nomeSobreTopo(design.cor_nome, navBg) }}>{design.nome_loja}{isPro && <SeloVerificado tamanho={20} />}</p>
              {sub && <p className="cp-topo-sub">{status && <i className={status.aberto ? 'aberto' : ''} aria-hidden="true" />}{sub}</p>}
              {cidade && <p className="cp-topo-cid"><MapPin size={15} weight="bold" aria-hidden="true" />{cidade}</p>}
              {design.tema === 'natal' && design.tema_aviso && <p className="cp-topo-aviso">{design.tema_aviso}</p>}
            </div>
          </div>
          <nav className="cp-topo-nav" aria-label="Menu da loja">
            <button type="button" aria-current={aba === 'inicio' ? 'page' : undefined} style={aba === 'inicio' ? { color: navBg } : undefined} onClick={() => setAba('inicio')}><House size={20} weight="bold" />Início</button>
            <button type="button" aria-current={aba === 'sobre' ? 'page' : undefined} style={aba === 'sobre' ? { color: navBg } : undefined} onClick={() => setAba('sobre')}><Storefront size={20} weight="bold" />Sobre nós</button>
            <button type="button" aria-current={aba === 'conta' ? 'page' : undefined} style={aba === 'conta' ? { color: navBg } : undefined} onClick={() => setAba('conta')}><User size={20} weight="bold" />Minha conta</button>
          </nav>
        </div>
      </header>

      <SobreLoja aberta={aba === 'sobre'} fechar={() => setAba('inicio')} design={design} config={config} />

      {/* Minha conta (pedidos e perfil do cliente — revisão na 8.4) */}
      {aba === 'conta' && (
        <>
          <div onClick={() => setAba('inicio')} style={{ position: 'fixed', inset: 0, background: 'rgba(44,18,25,0.5)', zIndex: 200 }} />
          <div className="cp-conta" role="dialog" aria-modal="true" aria-label="Minha conta">
            <div className="cp-conta-topo">
              <h2 className="cp-conta-t">Minha conta</h2>
              <button type="button" className="cp-conta-x" aria-label="Fechar" onClick={() => setAba('inicio')}><X size={20} weight="bold" /></button>
            </div>
            {/* (14/10) abas com a linha embaixo, iguais às do "Sobre nós", na cor do topo */}
            <div className="cp-conta-abas" role="tablist">
              {(['pedidos', 'perfil'] as const).map(a => (
                <button key={a} type="button" role="tab" aria-selected={contaAba === a} style={contaAba === a ? { color: navBg, borderBottomColor: navBg } : undefined} onClick={() => setContaAba(a)}>
                  {a === 'pedidos' ? 'Pedidos' : 'Perfil'}
                </button>
              ))}
            </div>
            <div className="cp-conta-corpo">
              {contaAba === 'pedidos'
                ? <PedidosTab accent={navBg} confeteiraUserId={confeteiraUserId} onIrParaPerfil={() => setContaAba('perfil')} onVerCardapio={() => setAba('inicio')} />
                : <PerfilTab accent={navBg} confeteiraUserId={confeteiraUserId} />}
            </div>
          </div>
        </>
      )}
    </>
  )
}

/* ── Categorias (coluna da esquerda) ── */
function DeskCategorias({ categories, counts, total, selectedCategory, onSelectCategory, cor }: any) {
  const cats = categories.filter((c: any) => c.name !== 'Todos')
  const item = (nome: string | null, rotulo: string, n: number) => {
    const sel = selectedCategory === nome
    return (
      <button key={rotulo} type="button" aria-current={sel ? 'true' : undefined} style={sel ? { color: cor, background: `${cor}14` } : undefined} onClick={() => onSelectCategory(nome)}>
        <span>{rotulo}</span><small>{n}</small>
      </button>
    )
  }
  return (
    <nav className="cp-cats" aria-label="Categorias">
      <p>Categorias</p>
      {item(null, 'Todos os produtos', total)}
      {cats.map((c: any) => item(c.name, c.name, counts[c.name] || 0))}
    </nav>
  )
}

/* ── Seu pedido (coluna da direita) ── */
function DeskSacola({ cartCount, cartTotal, design, items }: any) {
  // Desconto da promoção (02/10): o preço do item já vem com desconto; aqui mostra quanto ela economiza
  const economia = Math.round((items || []).reduce((s: number, it: any) => s + (Number(it?.precoBreakdown?.desconto) || 0) * (Number(it?.quantity) || 0), 0) * 100) / 100
  const cor = design.cor_botao || design.cor_borda || '#E85A8C'
  return (
    <section className="cp-box">
      <h3>Seu pedido</h3>
      {cartCount === 0 ? (
        <div className="cp-vazio"><ShoppingBag size={32} aria-hidden="true" /><b>Seu pedido está vazio</b><small>Escolha um produto pra começar.</small></div>
      ) : (<>
        {items.slice(0, 4).map((item: any) => {
          const img = item.imageUrl?.split(',')[0]?.trim()
          return (
            <div key={item.lineId ?? item.id} className="cp-it">
              {img ? <img src={img} alt="" /> : <span className="cp-it-sem"><ShoppingBag size={20} /></span>}
              <span><b>{qtdItem(item)} {item.name}</b>{detalhesItem(item).length > 0 && <small className="cp-it-det">{detalhesItem(item).join(' · ')}</small>}<small>{formatCurrency(valorLinha(item))}{unidadeItem(item) && (item.quantity === 1 ? ` ${unidadeItem(item)}` : ` · ${formatCurrency(item.price)} ${unidadeItem(item)}`)}</small></span>
            </div>
          )
        })}
        {items.length > 4 && <p className="cp-mais">+ {items.length - 4} {items.length - 4 === 1 ? 'item' : 'itens'}</p>}
        <div className="cp-contas">
          <span>Subtotal<b>{formatCurrency(cartTotal + economia)}</b></span>
          {economia > 0 && <span className="ok">Promoção<b>− {formatCurrency(economia)}</b></span>}
          <span>Entrega<b>Calculada ao finalizar</b></span>
          <span className="t">Total<b>{formatCurrency(cartTotal)}</b></span>
        </div>
        <button type="button" className="cp-finalizar" style={{ background: cor }} onClick={() => window.dispatchEvent(new Event('open-cart'))}>Finalizar pedido</button>
      </>)}
    </section>
  )
}

/* ── Rodapé do computador ── */
function DeskFooterBar({ design, config, isPro }: any) {
  const nome = design?.nome_loja || 'Confeitaria'
  const ano = new Date().getFullYear()
  let cnpj = ''
  try { const end = config?.endereco ? JSON.parse(config.endereco) : null; if (end?.cnpj) cnpj = end.cnpj } catch {}
  const extras: string[] = []
  if (cnpj) extras.push(`CNPJ: ${cnpj}`)
  if (isPro && config?.telefone) extras.push(config.telefone)
  return (
    <footer className="cp-rod">
      <span>© {ano} <b>{nome}</b> · Todos os direitos reservados{extras.length > 0 && <> · {extras.join(' · ')}</>}</span>
      {!isPro && <span>Feito com <a href="https://doonly.com.br" target="_blank" rel="noopener noreferrer">Doonly</a></span>}
    </footer>
  )
}

/* ══════════════════════════════════════════════ */
/*              MAIN CONTENT                      */
/* ══════════════════════════════════════════════ */

function CardapioContent() {
  // Suporta 2 formatos de URL:
  //   Nova: /c/:codigo/:slug?   → codigo é o identificador real, slug é decoração
  //   Antiga: /cardapio/:slug   → fallback por compat (slug era o UUID)
  const params = useParams<{ codigo?: string; slug?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const isRotaNova = location.pathname.startsWith('/c/')
  const codigo = params.codigo || ''
  const slugAtual = params.slug || ''

  const [design, setDesign] = useState<DesignSettings | null>(null)
  useClasseTema(design?.tema) // (18/10) liga os enfeites do tema (Natal) na página
  const [config, setConfig] = useState<Configuracoes | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [isPro, setIsPro] = useState(false)
  const [cardapioModelo, setCardapioModelo] = useState('modelo1')
  const [categoryImages, setCategoryImages] = useState<{[key:string]:string}>({})
  const [categoriasList, setCategoriasList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<string[]>([])
  const [sobreAberta, setSobreAberta] = useState(false) // (4.25) Sobre a loja no celular
  const device = useDeviceDetection()
  const { items: cartItems, totalPrice: cartTotal } = useCart()
  const cartCount = contarItens(cartItems)

  useEffect(() => {
    // Chave de busca: código na rota nova, slug (UUID legado) na antiga
    const chave = isRotaNova ? codigo : slugAtual
    if (!chave) return

    setLoading(true)
    const fetchFn = isRotaNova ? getCardapioByCodigo : getCardapioBySlug

    fetchFn(chave.toLowerCase()).then(({ design, config, produtos, isPro, categoryImages, categoriasList, slugCanonico, codigoPublico, cardapioModelo: modelo }) => {
      if (!design) { setError('Verifique o link e tente novamente.'); setLoading(false); return }

      // ── Redirect canônico ──
      // Rota antiga /cardapio/:uuid → redireciona pra nova /c/:codigo/:slug
      if (!isRotaNova && codigoPublico) {
        navigate(`/c/${codigoPublico}/${slugCanonico}`, { replace: true })
        return
      }
      // Rota nova sem slug ou com slug errado → redireciona pra canônica
      if (isRotaNova && slugAtual !== slugCanonico) {
        navigate(`/c/${codigo}/${slugCanonico}`, { replace: true })
        return
      }

      setDesign(design); setConfig(config); setProdutos(produtos)
      setIsPro(isPro || false); void modelo; setCardapioModelo('modelo1') /* (18/10) só o Clássico por enquanto */; setCategoryImages(categoryImages || {})
      setCategoriasList(categoriasList || [])
      // 10/10: a loja fica guardada nesta aba (lojaAtual); o localStorage segue gravado, só de reserva
      const checkoutConfig = config ? {
        formas_pagamento: config.formas_pagamento || ['pix'],
        formas_entrega: config.formas_entrega || ['retirada'],
        valor_entrega_propria: config.valor_entrega_propria || 0,
        entrega_por_bairro: config.entrega_por_bairro || [],
        endereco_retirada: config.endereco_retirada || '',
        horario_retirada: config.horario_retirada || '',
        exibir_campo_troco: config.exibir_campo_troco !== false,
        cupons_desconto: [],
        tem_cupom: !!config.tem_cupom,
        aceita_agendamento: config.aceita_agendamento !== false,
        prazo_minimo_horas: config.prazo_minimo_horas ?? 24,
        msg_pedido: (config as any).msg_pedido || null,
        loja_pausada: (config as any).loja_pausada === true,
        // Finalizar encomenda (02/10): horário da loja e antecedência de cada produto, pro agendamento
        horario: (config as any).horario || null,
        antecedencias: Object.fromEntries((produtos || []).map((p: any) => [p.id, { ant: p.antecedencia || null, pronta: p.pronta_entrega ?? null }])),
      } : null
      definirLojaAtual({ userId: design.user_id || '', whatsapp: config?.telefone || '', nome: design.nome_loja || '', checkout: checkoutConfig })
      if (config?.telefone) localStorage.setItem('cardapio_whatsapp', config.telefone)
      if (design?.nome_loja) localStorage.setItem('cardapio_nome', design.nome_loja)
      if (design?.user_id) {
        localStorage.setItem('cardapio_user_id', design.user_id)
        // Registra a visita (1x por sessão de navegador, pra não inflar o número)
        const visitKey = `cardapio_visita_${design.user_id}`
        // (4.27) a prévia dentro do app (?previa=1) não conta como visita
        if (!sessionStorage.getItem(visitKey) && !new URLSearchParams(window.location.search).has('previa')) {
          supabase.from('cardapio_visitas').insert({ user_id: design.user_id }).then(() => {})
          sessionStorage.setItem(visitKey, '1')
        }
      }

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
      if (checkoutConfig) localStorage.setItem('cardapio_checkout_config', JSON.stringify(checkoutConfig))
      setLoading(false)
    }).catch(e => { setError(explicarErro(e, 'Não deu pra abrir o cardápio agora. Tente de novo em instantes.')); setLoading(false) })
  }, [codigo, slugAtual, isRotaNova])

  const toggleFavorite = (id: string) => setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  const getCategories = () => {
    // Só mostra categorias que TÊM ao menos 1 produto cadastrado e visível
    const catsComProduto = new Set(produtos.map(p => p.categoria).filter(Boolean));
    const cats = [{ name: 'Todos', icon: '' }]
    categoriasList.forEach(c => { if (catsComProduto.has(c)) cats.push({ name: c, icon: '' }) })
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
        <div style={{ width:'40px', height:'40px', border:'3px solid #fce7f3', borderTopColor:'var(--primary)', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 12px' }}/>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px' }}>Carregando cardápio...</p>
        <style>{`
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
          @keyframes fadeScaleIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--ui-rosa); border-radius: 99px; opacity: 0.6; }
          ::-webkit-scrollbar-thumb:hover { opacity: 1; }
          * { scrollbar-width: thin; scrollbar-color: var(--ui-rosa) transparent; }
        `}</style>
      </div>
    </div>
  )

  if (error || !design) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-body)' }}>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:'24px', fontWeight:700, color:'var(--text-title)' }}>Cardápio não encontrado</h1>
        <p style={{ color:'var(--text-secondary)' }}>{error || 'Verifique o link e tente novamente.'}</p>
      </div>
    </div>
  )

  const isDesktop = device === 'desktop'
  const categorias = getCategories()
  const contagem = categorias.reduce((acc: Record<string, number>, c: any) => { acc[c.name] = produtos.filter(p => p.categoria === c.name).length; return acc }, {} as Record<string, number>)

  /* ═══ CELULAR ═══ */
  if (!isDesktop) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: '#F7F4F5' }}>
        {/* Caixa dos banners: some quando a loja não tem banner */}
        <style>{`.cp-banner-wrap { margin-top: 16px; } .cp-banner-wrap:empty { display: none; }`}</style>
        <NavigationMenu celular corBotao={design.cor_botao || design.cor_borda || '#E85A8C'} />
        <SobreLoja aberta={sobreAberta} fechar={() => setSobreAberta(false)} design={design} config={config} />

        {cardapioModelo === 'modelo1' ? (
          <>
            <CardapioModelo1 design={design} config={config} verificada={isPro} produtos={produtos} aoAbrirSobre={() => setSobreAberta(true)} />
            <div className="cp-banner-wrap">
              <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
            </div>
          </>
        ) : (
          /* ── Layout 'Padrão': exclusivo PRO (02/10) ── */
          <>
            <div style={{ height: '150px', position: 'relative', overflow: 'hidden',
              backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.14) 100%), radial-gradient(circle at 20% 50%, rgba(255,255,255,0.16) 1.2px, transparent 1.3px), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.16) 1.2px, transparent 1.3px), radial-gradient(circle at 50% 80%, rgba(255,255,255,0.16) 1.8px, transparent 1.9px)',
              backgroundSize: '100% 100%, 60px 60px, 80px 80px, 40px 40px',
              backgroundColor: corDoTopo(design) }} />
            <Logo verificada={isPro} logoUrl={design.logo_url} borderColor={design.cor_borda} storeName={design.nome_loja} storeDescription={design.descricao_loja} corNome={corNomeCelular(design.cor_nome)} avaliacaoMedia={config?.avaliacao_media} configuracoes={config} hideStars={design.hide_stars}  aoAbrirSobre={() => setSobreAberta(true)} />
            <div className="cp-banner-wrap">
              <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
            </div>
          </>
        )}
{(config as any)?.loja_pausada && (
          <div className="cp-pausada" role="status"><i aria-hidden="true" /><span><b>Pedidos pausados no momento</b><small>Você pode olhar o cardápio. Pra encomendar, chame a loja no WhatsApp.</small></span></div>
        )}
                {/* Espaço embaixo: menu (60px) e, com itens, a barra "Ver seu pedido" (~64px) não cobrem o último produto */}
        <div style={{ padding: `0 10px calc(${cartCount > 0 ? 148 : 84}px + env(safe-area-inset-bottom, 0px))` }}>
          {produtos.length > 0 ? (
            <ProductList
              produtos={filteredProdutos}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
              backgroundColor={design.cor_background || '#fff'}
              borderColor={design.cor_borda || '#E85A8C'}
              corBotao={design.cor_botao || '#E85A8C'}
              selectedCategory={selectedCategory}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              categories={!design.ocultar_categorias ? categorias.map((c: any) => c.name) : []}
              onCategorySelect={!design.ocultar_categorias ? setSelectedCategory : undefined}
              categoryCounts={contagem}
              telefone={config?.telefone}
            />
          ) : <EmptyState telefone={config?.telefone} />}
        </div>
        <Footer textoRodape={design.texto_rodape} />
      </div>
    )
  }

  /* ═══ COMPUTADOR ═══ */
  const temBanner = !!(design.banner_url || (isPro && (design.banner1_url || design.banner2_url || design.banner3_url)))
  const cor = design.cor_botao || design.cor_borda || '#E85A8C'
  return (
    <div className="cp-pc">
      <NavigationMenu celular={false} corBotao={cor} />
      <DeskNav isPro={isPro} design={design} config={config} />

      <div className="cp-corpo">
        {!design.ocultar_categorias && categorias.length > 1 && (
          <aside className="cp-esq">
            <DeskCategorias categories={categorias} counts={contagem} total={produtos.length} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} cor={cor} />
          </aside>
        )}

        <main className="cp-meio">
          {(config as any)?.loja_pausada && (
          <div className="cp-pausada" role="status"><i aria-hidden="true" /><span><b>Pedidos pausados no momento</b><small>Você pode olhar o cardápio. Pra encomendar, chame a loja no WhatsApp.</small></span></div>
        )}
          {produtos.length === 0 ? <EmptyState telefone={config?.telefone} /> : (<>
          <div className="cp-busca">
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
            <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" />
            {searchTerm && <button type="button" aria-label="Limpar a busca" onClick={() => setSearchTerm('')}><X size={18} weight="bold" /></button>}
          </div>
          {/* 4.05: promoções em cartões com o selo de desconto e as categorias em lista, como nos apps de delivery */}
          {filteredProdutos.length > 0 ? (
            searchTerm.trim() ? (
              <section className="ic-sec ic-sec--pc">
                <h2 className="ic-h2">{filteredProdutos.length === 1 ? '1 produto' : `${filteredProdutos.length} produtos`}</h2>
                <div className="ic-lista">{filteredProdutos.map((p: Produto) => <LinhaProduto key={p.id} produto={p} cor={cor} />)}</div>
              </section>
            ) : montarSecoes(filteredProdutos, selectedCategory ? [selectedCategory] : (!design.ocultar_categorias ? categorias.map((c: any) => c.name).filter((n: string) => n !== 'Todos') : []), !design.ocultar_categorias)
                .map(sec => <SecaoCardapio key={sec.id} secao={sec} cor={cor} pc />)
          ) : (
            <div className="cp-nada"><MagnifyingGlass size={32} aria-hidden="true" />
              <b>{searchTerm.trim() ? `Nenhum produto com “${searchTerm.trim()}”` : 'Nenhum produto nessa categoria'}</b>
              <span>{searchTerm.trim() ? 'Tente buscar com outra palavra.' : 'Escolha outra categoria.'}</span></div>
          )}
          </>)}
        </main>

        <aside className="cp-dir">
          {/* (14/10) no computador o banner fica aqui, em cima de "Seu pedido" (no meio ele ocupava a tela toda) */}
          {temBanner && (
            <div className="desk-banner cp-banner cp-banner--lado">
              <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
            </div>
          )}
          <DeskSacola cartCount={cartCount} cartTotal={cartTotal} design={design} items={cartItems} />
          {/* 10/10: saiu o aviso de "Programa de fidelidade" (a fidelidade ainda não existe no app) */}
        </aside>
      </div>

      <DeskFooterBar design={design} config={config} isPro={isPro} />
    </div>
  )
}

export default function CardapioPublico() {
  // (11/10) a sacola fica guardada por loja (código do endereço) e volta ao recarregar a página.
  // A `key` troca a sacola quando o endereço passa pra outra loja sem recarregar.
  const params = useParams<{ codigo?: string; slug?: string }>()
  const loja = (params.codigo || params.slug || '').toLowerCase()
  return (
    <CartProvider key={loja} loja={loja || undefined}>
      <CardapioContent />
    </CartProvider>
  )
}
