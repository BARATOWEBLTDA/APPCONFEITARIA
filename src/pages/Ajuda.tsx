/**
 * (25/10) Central de Ajuda (/ajuda e /ajuda/tema/:tema): os assuntos em cartões, a busca e a lista de artigos de cada assunto.
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CalendarCheck, CaretRight, ChartLineUp, Crown, CurrencyDollar, FileText, MagnifyingGlass, Notebook, Sparkle, Storefront, X,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { ARTIGOS, TEMAS, artigosDoTema, semAcentoAjuda, textoDoArtigo, type TemaId } from '@/lib/ajuda'
import { voltarOuIr } from '@/lib/voltar'
import './centralAjuda.css'

export const ICONE_TEMA: Record<TemaId, Icon> = {
  primeiros: Sparkle, vendas: CalendarCheck, cardapio: Storefront, cadastros: Notebook,
  preco: ChartLineUp, financeiro: CurrencyDollar, orcamentos: FileText, conta: Crown,
}
const WHATS = `https://wa.me/5511978414991?text=${encodeURIComponent('Olá! Preciso de ajuda com o Doonly.')}`
const qtd = (n: number) => (n ? `${n} ${n === 1 ? 'artigo' : 'artigos'}` : 'Em breve')

function Linha({ slug, titulo, resumo }: { slug: string; titulo: string; resumo: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" className="ca-art" onClick={() => navigate(`/ajuda/${slug}`)}>
      <span className="ca-art-tx"><b>{titulo}</b><small>{resumo}</small></span>
      <CaretRight size={18} weight="bold" aria-hidden="true" />
    </button>
  )
}

export function CartaoSuporte() {
  return (
    <section className="ca-sup">
      <span className="ca-sup-ic" aria-hidden="true"><IconeWhatsApp size={22} /></span>
      <span className="ca-sup-tx"><b>Ainda com dúvida?</b><small>Fale com a equipe</small></span>
      <a className="ca-sup-bt" href={WHATS} target="_blank" rel="noopener noreferrer">Falar</a>
    </section>
  )
}

export default function Ajuda() {
  const navigate = useNavigate()
  const { tema } = useParams()
  const [busca, setBusca] = useState('')
  const temaAtual = TEMAS.find(t => t.id === tema)

  const achados = useMemo(() => {
    const q = semAcentoAjuda(busca.trim())
    if (!q) return []
    // (31/10 · 5.83) procura no artigo inteiro (antes não achava os artigos sem "seções", como Primeiros passos)
    return ARTIGOS.filter(a => semAcentoAjuda(textoDoArtigo(a)).includes(q))
  }, [busca])


  // ── um assunto ──
  if (temaAtual) {
    const lista = artigosDoTema(temaAtual.id)
    const Ic = ICONE_TEMA[temaAtual.id]
    return (<>
      <AppPageHeader title={temaAtual.nome} subtitle="Central de Ajuda" voltar="/ajuda" />
      <div className="ca">
        <div className="ca-tema-cab"><span className="ca-tema-ic" aria-hidden="true"><Ic size={24} weight="bold" /></span><span><b>{temaAtual.nome}</b><small>{temaAtual.apoio}</small></span></div>
        {lista.length ? <section className="ca-lista">{lista.map(a => <Linha key={a.slug} {...a} />)}</section>
          : <p className="ca-vazio">Os artigos deste assunto estão sendo escritos. Enquanto isso, o (i) de cada tela explica como ela funciona.</p>}
        <CartaoSuporte />
      </div>
    </>)
  }

  // ── início ──
  return (<>
    <AppPageHeader title="Central de Ajuda" subtitle="Artigos que explicam cada tela" onBack={() => voltarOuIr(navigate, "/configuracoes")} />
    <div className="ca">
      <label className="ca-busca">
        <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar na ajuda" aria-label="Buscar na ajuda" />
        {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca('')}><X size={18} weight="bold" /></button>}
      </label>

      {busca.trim() ? (
        achados.length ? <section className="ca-lista">{achados.map(a => <Linha key={a.slug} {...a} />)}</section>
          : <p className="ca-vazio">Nenhum artigo com “{busca.trim()}”. Tente outra palavra ou fale com a gente.</p>
      ) : (<>
        <h2 className="ca-h2">Os assuntos</h2>
        <div className="ca-temas">
          {TEMAS.map(t => {
            const Ic = ICONE_TEMA[t.id]
            const n = artigosDoTema(t.id).length
            return (
              <button key={t.id} type="button" className={`ca-tema${n ? '' : ' ca-tema--breve'}`} onClick={() => navigate(`/ajuda/tema/${t.id}`)}>
                <span className="ca-tema-ic" aria-hidden="true"><Ic size={22} weight="bold" /></span>
                <b>{t.nome}</b>
                <small>{qtd(n)}</small>
              </button>
            )
          })}
        </div>
      </>)}
      <CartaoSuporte />
    </div>
  </>)
}
