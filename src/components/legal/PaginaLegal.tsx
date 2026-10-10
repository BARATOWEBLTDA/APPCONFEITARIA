import { useEffect, useRef } from 'react'
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
 *
 * Dois jeitos de usar:
 *   · como página (rotas /termos e /privacidade): <PaginaLegal doc="termos" />
 *   · em camada, por cima do login no computador (07/10): <PaginaLegal doc={doc} camada={{ aoFechar, aoTrocar }} />
 *     Aí o "voltar" fecha a camada e as abas trocam o documento sem mudar de endereço: o login continua
 *     aberto por baixo, com tudo o que a pessoa já digitou.
 */
type Camada = { aoFechar: () => void; aoTrocar: (doc: DocLegalId) => void }

export default function PaginaLegal({ doc, camada }: { doc: DocLegalId; camada?: Camada }) {
  const navegar = useNavigate()
  const raiz = useRef<HTMLDivElement>(null)
  const d = DOCS_LEGAIS[doc]
  const emCamada = !!camada

  useEffect(() => {
    if (emCamada) { raiz.current?.parentElement?.scrollTo(0, 0); return }
    const antes = document.title
    document.title = `${d.titulo} · Doonly`
    window.scrollTo(0, 0)
    return () => { document.title = antes }
  }, [d.titulo, emCamada])

  // em camada: fecha. Veio de dentro do app: volta pra onde estava. Abriu direto pelo link: vai pro login.
  const voltar = () => {
    if (camada) camada.aoFechar()
    else if (window.history.state && typeof window.history.state.idx === 'number' && window.history.state.idx > 0) navegar(-1)
    else navegar('/login')
  }
  const outro: DocLegalId = doc === 'termos' ? 'privacidade' : 'termos'
  const irPara = (i: number) => document.getElementById(`pg-${doc}-${i}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })

  return (
    <div className="lg-pag" ref={raiz}>
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
                {(['termos', 'privacidade'] as DocLegalId[]).map(id => camada
                  ? <button key={id} type="button" className="lg-aba" aria-current={doc === id ? 'page' : undefined} onClick={() => camada.aoTrocar(id)}>{DOCS_LEGAIS[id].curto}</button>
                  : <Link key={id} className="lg-aba" to={`/${id}`} replace aria-current={doc === id ? 'page' : undefined}>{DOCS_LEGAIS[id].curto}</Link>)}
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
        {camada
          ? <button type="button" className="lg-pe-link" onClick={() => camada.aoTrocar(outro)}>{doc === 'termos' ? 'Ler a Política de privacidade' : 'Ler os Termos de uso'}</button>
          : <Link className="lg-pe-link" to={`/${outro}`} replace>{doc === 'termos' ? 'Ler a Política de privacidade' : 'Ler os Termos de uso'}</Link>}
      </footer>
    </div>
  )
}
