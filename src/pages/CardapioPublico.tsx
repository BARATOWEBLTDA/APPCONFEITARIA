import { useState, useEffect } from 'react'
import { SeloVerificado } from '@/components/cardapio/SeloVerificado'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getCardapioByCodigo, getCardapioBySlug } from '@/services/cardapio'
import { supabase } from '@/lib/supabase'
import { useDeviceDetection } from '@/hooks/useDeviceDetection'
import { BannerAd } from '@/components/cardapio/BannerAd'
import { Logo } from '@/components/cardapio/Logo'
import { ProductList } from '@/components/cardapio/ProductList'
import { contarItens, qtdItem } from '@/lib/itemSacola'
import { NavigationMenu } from '@/components/cardapio/NavigationMenu'
import { EmptyState } from '@/components/cardapio/EmptyState'
import { Footer } from '@/components/cardapio/Footer'
import { CardapioModelo1, getStatusLoja, getEnderecoData } from '@/components/cardapio/CardapioModelo1'
import { DesktopProductCard } from '@/components/desktop/ProductCard'
import { CartProvider } from '@/context/CartContext'
import { DesignSettings, Configuracoes, Produto } from '@/types/database'
import { PerfilTab } from '@/components/cardapio/PerfilTab'
import { PedidosTab } from '@/components/cardapio/PedidosTab'
import { ClockCountdown, House, MagnifyingGlass, MapPin, ShoppingBag, Storefront, Truck, User, WhatsappLogo, X } from '@phosphor-icons/react'
import { Janela } from '@/components/base'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/utils/helpers'
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
const corNomeComputador = (c?: string | null) => corNomeEscolhida(c) || "#ffffff";
const corNomeCelular = (c?: string | null) => corNomeEscolhida(c) || "#000000";
const corValida = (c: string | undefined | null): boolean => {
  if (!c) return false
  const norm = c.trim().toLowerCase().replace(/\s/g, '')
  return !['', '#fff', '#ffffff', '#fefefe', 'white', 'transparent', 'rgb(255,255,255)', 'rgba(255,255,255,1)'].includes(norm)
}
const corDoTopo = (design: DesignSettings) => corValida(design.cor_navbar) ? design.cor_navbar! : (corValida(design.cor_borda) ? design.cor_borda! : '#E85A8C')

/* Horário em texto: "Segunda a sexta · 08:00 às 18:00" */
const ORDEM = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta']
function linhasHorario(horario: any): string[] {
  try {
    const h = typeof horario === 'string' ? JSON.parse(horario) : horario
    if (!h) return []
    const out: string[] = []
    const dias = ORDEM.filter(d => (h.dias || []).includes(d))
    if (dias.length) {
      const nome = dias.length === 5 ? 'Segunda a sexta' : dias.map(d => d.slice(0, 3)).join(', ')
      out.push(`${nome} · ${h.abertura || '08:00'} às ${h.fechamento || '18:00'}`)
    }
    if (h.abre_sabado) out.push(`Sábado · ${h.sabado_abertura || '09:00'} às ${h.sabado_fechamento || '14:00'}`)
    if (h.abre_domingo) out.push(`Domingo · ${h.domingo_abertura || '09:00'} às ${h.domingo_fechamento || '14:00'}`)
    return out
  } catch { return [] }
}
function comoReceber(config: any): string {
  const f: string[] = config?.formas_entrega || []
  const entrega = f.some(x => x === 'entrega_propria' || x === 'motoboy' || x === 'uber_flash')
  const retira = f.includes('retirada')
  if (retira && entrega) return 'Retirada na loja ou entrega'
  if (entrega) return 'Entrega'
  if (retira) return 'Retirada na loja'
  return f.includes('combinar') ? 'Combinado pelo WhatsApp' : ''
}

/* ── Sobre a loja (Sobre nós no computador) ── */
function SobreLoja({ aberta, fechar, design, config }: { aberta: boolean; fechar: () => void; design: DesignSettings; config: Configuracoes | null }) {
  const end = getEnderecoData(config)
  const horas = linhasHorario((config as any)?.horario)
  const receber = comoReceber(config)
  const fone = String(config?.telefone || '').replace(/\D/g, '')
  const zap = fone ? `https://wa.me/${fone.startsWith('55') ? fone : '55' + fone}` : ''
  return (
    <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" titulo={`Sobre a ${design.nome_loja || 'loja'}`} umaAcao={!!zap}
      acoes={zap ? <a className="cp-zap" href={zap} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={20} weight="bold" />Chamar no WhatsApp</a> : undefined}>
      <div className="cp-sobre">
        {design.descricao_loja && <p>{design.descricao_loja}</p>}
        {end && (
          <div className="cp-sobre-l"><MapPin size={20} weight="bold" /><span><b>{end.completo}</b>
            <span className="cp-sobre-mapa">
              <a href={`https://maps.google.com/?q=${encodeURIComponent(end.completo)}`} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a>
              <a href={`https://waze.com/ul?q=${encodeURIComponent(end.completo)}`} target="_blank" rel="noopener noreferrer">Abrir no Waze</a>
            </span></span></div>
        )}
        {horas.length > 0 && <div className="cp-sobre-l"><ClockCountdown size={20} weight="bold" /><span><b>Horário</b>{horas.map(h => <small key={h}>{h}</small>)}</span></div>}
        {receber && <div className="cp-sobre-l"><Truck size={20} weight="bold" /><span><b>Como receber</b><small>{receber}</small></span></div>}
      </div>
    </Janela>
  )
}

/* ── Topo do computador ── */
function DeskNav({ design, config, isPro = false }: { design: DesignSettings; config: Configuracoes | null; isPro?: boolean }) {
  const navBg = corDoTopo(design)
  const corBorda = design.cor_borda || '#E85A8C'
  const [aba, setAba] = useState<'inicio' | 'sobre' | 'conta'>('inicio')
  const [contaAba, setContaAba] = useState<'pedidos' | 'perfil'>('pedidos')
  const confeteiraUserId = localStorage.getItem('cardapio_user_id') || ''
  const accent = design.cor_botao || design.cor_borda || '#E85A8C'
  const status = getStatusLoja((config as any)?.horario || null)
  let cidade = ''
  try { const e = config?.endereco ? (typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco) : null; if (e?.cidade && ((config as any)?.mostrar_localizacao || (config as any)?.mostrar_apenas_cidade)) cidade = [e.cidade, e.estado].filter(Boolean).join(' - ') } catch {}
  const sub = [status?.msg, cidade].filter(Boolean).join(' · ')

  return (
    <>
      <header className="cp-topo" style={{ background: navBg }}>
        <div className="cp-topo-in">
          <div className="cp-topo-loja">
            <span className="cp-topo-logo" style={{ borderColor: corBorda }}>
              {design.logo_url ? <img src={design.logo_url} alt="" /> : <b style={{ background: corBorda }}>{design.nome_loja?.charAt(0)}</b>}
            </span>
            <div>
              <p className="cp-topo-nome" style={{ color: corNomeComputador(design.cor_nome) }}>{design.nome_loja}{isPro && <SeloVerificado tamanho={20} />}</p>
              {sub && <p className="cp-topo-sub">{status && <i className={status.aberto ? 'aberto' : ''} aria-hidden="true" />}{sub}</p>}
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

      {/* Minha conta (pedidos e perfil da cliente — revisão na 8.4) */}
      {aba === 'conta' && (
        <>
          <div onClick={() => setAba('inicio')} style={{ position: 'fixed', inset: 0, background: 'rgba(44,18,25,0.5)', zIndex: 200 }} />
          <div className="cp-conta" role="dialog" aria-modal="true" aria-label="Minha conta">
            <div className="cp-conta-topo">
              <div className="cp-conta-abas">
                {(['pedidos', 'perfil'] as const).map(a => (
                  <button key={a} type="button" aria-pressed={contaAba === a} style={contaAba === a ? { background: accent, color: '#fff' } : undefined} onClick={() => setContaAba(a)}>
                    {a === 'pedidos' ? 'Pedidos' : 'Perfil'}
                  </button>
                ))}
              </div>
              <button type="button" className="cp-conta-x" aria-label="Fechar" onClick={() => setAba('inicio')}><X size={20} weight="bold" /></button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {contaAba === 'pedidos'
                ? <PedidosTab accent={accent} confeteiraUserId={confeteiraUserId} onIrParaPerfil={() => setContaAba('perfil')} />
                : <PerfilTab accent={accent} confeteiraUserId={confeteiraUserId} />}
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
            <div key={item.id} className="cp-it">
              {img ? <img src={img} alt="" /> : <span className="cp-it-sem"><ShoppingBag size={20} /></span>}
              <span><b>{qtdItem(item)} {item.name}</b><small>{formatCurrency(item.price * item.quantity)}</small></span>
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
      if (!design) { setError('Cardápio não encontrado'); setLoading(false); return }

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
      setIsPro(isPro || false); setCardapioModelo(modelo === 'padrao' && isPro ? 'padrao' : 'modelo1'); setCategoryImages(categoryImages || {})
      setCategoriasList(categoriasList || [])
      if (config?.telefone) localStorage.setItem('cardapio_whatsapp', config.telefone)
      if (design?.nome_loja) localStorage.setItem('cardapio_nome', design.nome_loja)
      if (design?.user_id) {
        localStorage.setItem('cardapio_user_id', design.user_id)
        // Registra a visita (1x por sessão de navegador, pra não inflar o número)
        const visitKey = `cardapio_visita_${design.user_id}`
        if (!sessionStorage.getItem(visitKey)) {
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
      if (config) {
        localStorage.setItem('cardapio_checkout_config', JSON.stringify({
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
          // Finalizar encomenda (02/10): horário da loja e antecedência de cada produto, pro agendamento
          horario: (config as any).horario || null,
          antecedencias: Object.fromEntries((produtos || []).map((p: any) => [p.id, { ant: p.antecedencia || null, pronta: p.pronta_entrega ?? null }])),
        }))
      }
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
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
          ::-webkit-scrollbar-thumb { background: #E85A8C; border-radius: 99px; opacity: 0.6; }
          ::-webkit-scrollbar-thumb:hover { opacity: 1; }
          * { scrollbar-width: thin; scrollbar-color: #E85A8C transparent; }
        `}</style>
      </div>
    </div>
  )

  if (error || !design) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-body)' }}>
      <div style={{ textAlign:'center' }}>
        <h1 style={{ fontSize:'24px', fontWeight:800, color:'var(--text-title)' }}>Cardápio não encontrado</h1>
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
        <NavigationMenu corBotao={design.cor_botao || design.cor_borda || '#E85A8C'} />

        {cardapioModelo === 'modelo1' ? (
          <>
            <CardapioModelo1 design={design} config={config} verificada={isPro} produtos={produtos} />
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
            <Logo verificada={isPro} logoUrl={design.logo_url} borderColor={design.cor_borda} storeName={design.nome_loja} storeDescription={design.descricao_loja} corNome={corNomeCelular(design.cor_nome)} avaliacaoMedia={config?.avaliacao_media} configuracoes={config} hideStars={design.hide_stars} />
            <div className="cp-banner-wrap">
              <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
            </div>
          </>
        )}
        <div style={{ padding: '0 10px 112px' }}>
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
            />
          ) : <EmptyState />}
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
      <NavigationMenu corBotao={cor} />
      <DeskNav isPro={isPro} design={design} config={config} />

      <div className="cp-corpo">
        {!design.ocultar_categorias && categorias.length > 1 && (
          <aside className="cp-esq">
            <DeskCategorias categories={categorias} counts={contagem} total={produtos.length} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} cor={corDoTopo(design)} />
          </aside>
        )}

        <main className="cp-meio">
          {temBanner && (
            <div className="desk-banner cp-banner">
              <BannerAd bannerUrl={design.banner_url} banner1Url={design.banner1_url} banner2Url={design.banner2_url} banner3Url={design.banner3_url} isPro={isPro} />
            </div>
          )}
          <div className="cp-busca">
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
            <input type="search" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" />
            {searchTerm && <button type="button" aria-label="Limpar a busca" onClick={() => setSearchTerm('')}><X size={18} weight="bold" /></button>}
          </div>
          <h2 className="cp-h2">{selectedCategory || 'Cardápio'}<small>{filteredProdutos.length} {filteredProdutos.length === 1 ? 'produto' : 'produtos'}</small></h2>
          {filteredProdutos.length > 0 ? (
            <div className="cp-grade">
              {filteredProdutos.map((p: Produto) => (
                <DesktopProductCard key={p.id} product={p} isFavorite={favorites.includes(p.id)} onToggleFavorite={toggleFavorite}
                  backgroundColor={design.cor_background || '#fff'} borderColor={design.cor_borda || '#E85A8C'} corBotao={cor} />
              ))}
            </div>
          ) : (
            <div className="cp-nada"><MagnifyingGlass size={32} aria-hidden="true" /><b>Nenhum produto encontrado</b><span>{searchTerm ? 'Tente buscar com outra palavra.' : 'Escolha outra categoria.'}</span></div>
          )}
        </main>

        <aside className="cp-dir">
          <DeskSacola cartCount={cartCount} cartTotal={cartTotal} design={design} items={cartItems} />
          {(config as any).programa_fidelidade_ativo !== false && (
            <section className="cp-box cp-fid">
              <b>Programa de fidelidade</b>
              <small>A cada R$ 50,00 em compras, você acumula 5% de cashback pra usar no próximo pedido.</small>
            </section>
          )}
        </aside>
      </div>

      <DeskFooterBar design={design} config={config} isPro={isPro} />
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
