import { useState, useRef, useEffect, useMemo } from 'react'
import { MagnifyingGlass, List, Check, X } from '@phosphor-icons/react'
import { Produto } from '@/types/database'
import { EmptyState } from './EmptyState'
import { montarSecoes, SecaoCardapio, LinhaProduto } from './ItensCardapio'
import './cardapioLista.css'
import './itensCardapio.css'

/**
 * Lista de produtos do cardápio no celular (10/10 · 4.05), no estilo de app de delivery.
 * Em cima, presa ao rolar: a busca e as abas das seções (Promoções e as categorias), com o ☰ que abre a lista.
 * Promoções em cartões, 2 por linha, com o selo de desconto; as categorias em lista (texto à esquerda, foto à direita).
 * Tocar numa aba rola até a seção; a aba acompanha a rolagem.
 */
interface Props {
  produtos: Produto[]
  favorites: string[]
  onToggleFavorite: (id: string) => void
  backgroundColor: string
  borderColor: string
  corBotao?: string
  selectedCategory: string | null
  searchTerm: string
  onSearchChange: (t: string) => void
  categories?: string[]
  onCategorySelect?: (cat: string | null) => void
  categoryCounts?: Record<string, number>
  /** WhatsApp da loja (pro estado de cardápio em montagem) */
  telefone?: string | null
}

export function ProductList({ produtos, corBotao = '#E85A8C', searchTerm, onSearchChange, categories = [], onCategorySelect, telefone }: Props) {
  const [menuAberto, setMenuAberto] = useState(false)
  const [ativa, setAtiva] = useState<string | null>(null)
  const presaRef = useRef<HTMLDivElement>(null)
  const abasRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const travaAte = useRef(0)

  const cats = categories.filter(c => c && c !== 'Todos')
  const agrupar = !!onCategorySelect && cats.length > 0
  const busca = searchTerm.trim().toLowerCase()
  const achados = busca ? produtos.filter(p => p.nome.toLowerCase().includes(busca) || p.descricao?.toLowerCase().includes(busca)) : []
  const secoes = useMemo(() => montarSecoes(produtos, cats, agrupar), [produtos, cats.join('|'), agrupar])

  // fecha o menu ☰ ao tocar fora ou no Esc
  useEffect(() => {
    if (!menuAberto) return
    const fora = (e: MouseEvent | TouchEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAberto(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('touchstart', fora); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('touchstart', fora); document.removeEventListener('keydown', esc) }
  }, [menuAberto])

  // a aba acompanha a seção que está na tela
  useEffect(() => {
    if (busca || secoes.length < 2) return
    const medir = () => {
      if (Date.now() < travaAte.current) return
      const topo = (presaRef.current?.getBoundingClientRect().height || 0) + 24
      let atual = secoes[0].id
      for (const s of secoes) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= topo) atual = s.id
      }
      setAtiva(atual)
    }
    medir()
    window.addEventListener('scroll', medir, { passive: true })
    return () => window.removeEventListener('scroll', medir)
  }, [secoes, busca])

  // deixa a aba ativa visível na faixa das abas
  useEffect(() => {
    const el = ativa && abasRef.current?.querySelector<HTMLElement>(`[data-sec="${ativa}"]`)
    if (el && abasRef.current) abasRef.current.scrollTo({ left: el.offsetLeft - abasRef.current.offsetLeft - 16, behavior: 'smooth' })
  }, [ativa])

  const irPara = (id: string) => {
    setMenuAberto(false)
    // a aba tocada fica marcada mesmo quando a seção é a última e a página não rola até ela
    setAtiva(id); travaAte.current = Date.now() + 900
    const el = document.getElementById(id)
    if (!el) return
    const topo = (presaRef.current?.getBoundingClientRect().height || 0) + 8
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - topo, behavior: 'smooth' })
  }

  const temAbas = !busca && secoes.length > 1

  return (
    <div className="cl">
      <div ref={presaRef} className="ic-presa">
        <div className="cl-busca">
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input type="search" placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" value={searchTerm} onChange={e => onSearchChange(e.target.value)} />
          {searchTerm && <button type="button" aria-label="Limpar a busca" onClick={() => onSearchChange('')}><X size={18} weight="bold" /></button>}
        </div>
        {temAbas && (
          <div ref={menuRef} className="ic-abas" style={{ position: 'relative' }}>
            <button type="button" className="ic-abas-menu" aria-label="Ver todas as seções" aria-expanded={menuAberto} onClick={() => setMenuAberto(v => !v)}>
              <List size={22} weight="bold" />
            </button>
            <div ref={abasRef} className="ic-abas-lista" role="tablist" aria-label="Seções do cardápio">
              {secoes.map(s => (
                <button key={s.id} type="button" role="tab" data-sec={s.id} aria-selected={ativa === s.id}
                  className={`ic-aba${ativa === s.id ? ' on' : ''}`} onClick={() => irPara(s.id)}>{s.nome}</button>
              ))}
            </div>
            {menuAberto && (
              <div className="cl-cat-menu" role="menu">
                {secoes.map(s => (
                  <button key={s.id} type="button" role="menuitemradio" aria-checked={ativa === s.id}
                    style={ativa === s.id ? { color: corBotao, background: `${corBotao}12` } : undefined} onClick={() => irPara(s.id)}>
                    <span>{ativa === s.id && <Check size={16} weight="bold" aria-hidden="true" />}{s.nome}</span>
                    <small style={ativa === s.id ? { background: corBotao, color: '#fff' } : undefined}>{s.produtos.length}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {busca ? (
        achados.length > 0 ? (
          <section className="ic-sec">
            <h2 className="ic-h2">{achados.length === 1 ? '1 produto' : `${achados.length} produtos`}</h2>
            <div className="ic-lista">{achados.map(p => <LinhaProduto key={p.id} produto={p} cor={corBotao} />)}</div>
          </section>
        ) : (
          <div className="cl-vazio">
            <MagnifyingGlass size={32} aria-hidden="true" />
            <b>Nenhum produto com “{searchTerm.trim()}”</b>
            <span>Tente buscar com outra palavra.</span>
          </div>
        )
      ) : secoes.length > 0
        ? secoes.map(s => <SecaoCardapio key={s.id} secao={s} cor={corBotao} />)
        : <EmptyState telefone={telefone} />}
    </div>
  )
}
