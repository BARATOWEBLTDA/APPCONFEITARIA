import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { BotaoIcone } from '@/components/base'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import { DocLegal } from './DocLegal'
import { DOCS_LEGAIS } from './textosLegais'
import type { DocLegalId } from './textosLegais'
import './legal.css'

/**
 * Página dos Termos de Uso e da Política de Privacidade (/termos e /privacidade) — 07/10.
 * Topo no vinho da marca, o texto num cartão e, no computador, o índice das seções ao lado.
 * Trocar de um documento pro outro não recarrega o app.
 */
export default function PaginaLegal({ doc }: { doc: DocLegalId }) {
  const navegar = useNavigate()
  const d = DOCS_LEGAIS[doc]

  useEffect(() => {
    const antes = document.title
    document.title = `${d.titulo} · Doonly`
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [d.titulo])

  // veio de dentro do app (login, cadastro): volta pra onde estava. Abriu direto pelo link: vai pro login.
  const voltar = () => { if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) navegar(-1); else navegar('/login') }
  const irPara = (i: number) => document.getElementById(`pg-${doc}-${i}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="lg-pag">
      <header className="lg-topo">
        <div className="lg-topo-in">
          <div className="lg-barra">
            <BotaoIcone rotulo="Voltar" variante="claro" onClick={voltar}><ArrowLeft size={20} weight="bold" /></BotaoIcone>
            <NomeDoonly cor="branco" />
          </div>
          <div className="lg-heroi">
            <div className="lg-heroi-t">
              <h1 className="lg-h1">{d.titulo}</h1>
              <p className="lg-data">{d.atualizado}</p>
              <nav className="lg-abas lg-abas--vinho" aria-label="Documentos">
                <Link className="lg-aba" to="/termos" replace aria-current={doc === 'termos' ? 'page' : undefined}>{DOCS_LEGAIS.termos.curto}</Link>
                <Link className="lg-aba" to="/privacidade" replace aria-current={doc === 'privacidade' ? 'page' : undefined}>{DOCS_LEGAIS.privacidade.curto}</Link>
              </nav>
            </div>
          </div>
        </div>
        <Mascote pose="acenando" className="lg-masc" />
      </header>

      <main className="lg-corpo">
        <nav className="lg-indice" aria-label="Seções deste documento">
          <p className="lg-indice-t">Neste documento</p>
          {d.secoes.map((s, i) => (
            <a key={s.titulo} href={`#pg-${doc}-${i + 1}`} onClick={e => { e.preventDefault(); irPara(i + 1) }}><i>{i + 1}</i><span>{s.titulo}</span></a>
          ))}
        </nav>
        <article className="lg-cartao"><DocLegal doc={doc} prefixo="pg" /></article>
      </main>

      <footer className="lg-pe">
        <span>© {new Date().getFullYear()} Doonly</span>
        <Link to={doc === 'termos' ? '/privacidade' : '/termos'} replace>{doc === 'termos' ? 'Ler a Política de Privacidade' : 'Ler os Termos de Uso'}</Link>
      </footer>
    </div>
  )
}
