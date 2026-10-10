import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import TermosModal from '@/components/TermosModal'
import { Mascote, NomeDoonly } from '@/components/marca/Mascote'
import type { PoseMascote } from '@/components/marca/Mascote'
import '@/components/base/base.css'
import './telaConta.css'

/**
 * A moldura das telas de conta fora do app (07/10): Esqueci a senha e Criar nova senha.
 * É o desenho do login: fundo vinho, mascote saindo do cartão e, no computador (900px ou mais),
 * o cartão dividido, com a marca à esquerda e o formulário à direita.
 *   pose: a pose do mascote · frase e sub: o que aparece no lado da marca, no computador
 */
type Props = { pose?: PoseMascote; frase: string; sub: string; children: ReactNode; /** cartão só da altura do conteúdo (ex.: "Conferindo seu link…") */ compacto?: boolean }

export function TelaConta({ pose = 'acenando', frase, sub, children, compacto = false }: Props) {
  const [doc, setDoc] = useState<null | 'termos' | 'privacidade'>(null)
  const abrir = (qual: 'termos' | 'privacidade') => (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setDoc(qual)
  }
  return (
    <div className={compacto ? 'tc-root tc-root--compacto' : 'tc-root'}>
      <div className="tc-fundo" />
      <div className="tc-layout">
        <aside className="tc-marca" aria-hidden="true">
          <div className="tc-marca-in">
            <Mascote pose={pose} className="tc-marca-masc" />
            <NomeDoonly cor="branco" />
            <p className="tc-marca-frase">{frase}</p>
            <p className="tc-marca-sub">{sub}</p>
          </div>
        </aside>
        <main className="tc-cartao">
          <Mascote pose={pose} className="tc-masc" />
          <NomeDoonly className="tc-nome" />
          {children}
        </main>
      </div>
      <footer className="tc-rodape">
        <div><a href="/privacidade" onClick={abrir('privacidade')}>Política de privacidade</a><span aria-hidden="true">·</span><a href="/termos" onClick={abrir('termos')}>Termos de uso</a></div>
        <em>© {new Date().getFullYear()} Doonly</em>
      </footer>
      <TermosModal open={!!doc} initialTab={doc || 'termos'} onClose={() => setDoc(null)} paginaNoComputador />
    </div>
  )
}
