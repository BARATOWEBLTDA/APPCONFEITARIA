/**
 * (27/10) "Como é a tela" da Central de Ajuda: o esquema desenhado da tela (no lugar do print), com números discretos.
 * Tocar num número (no esquema ou na lista) acende a parte e a explicação; "Mostrar na tela" abre a tela de verdade
 * com essa parte acesa (AcenderDaAjuda, no Layout).
 */
import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import type { EsquemaTela, LinhaEsquema } from '@/lib/ajuda'

const lista = (t: string) => t.split(',').map(x => x.trim()).filter(Boolean)

function Linha({ l }: { l: LinhaEsquema }) {
  switch (l.tipo) {
    case 'campo': return <div className="ce-campo"><MagnifyingGlass size={14} weight="bold" aria-hidden="true" /><span>{l.t}</span></div>
    case 'check': return <div className="ce-linha ce-linha--ok"><Check size={14} weight="bold" aria-hidden="true" /><span>{l.t}</span><i /></div>
    case 'botao': return <div className="ce-bt">{l.t}</div>
    case 'botao2': return <div className="ce-bt ce-bt--2">{l.t}</div>
    case 'barra': return <div className="ce-barra"><i /></div>
    case 'nota': return <div className="ce-nota">{l.t}</div>
    case 'dias': return <div className="ce-dias">{lista(l.t).map(d => <span key={d}><i />{d}</span>)}</div>
    case 'grade': return <div className="ce-grade">{lista(l.t).map(g => <span key={g}><i />{g}</span>)}</div>
    case 'nav': return <div className="ce-nav">{lista(l.t).map(g => g === '+' ? <span key={g} className="ce-nav-mais"><Plus size={14} weight="bold" aria-hidden="true" /></span> : <span key={g}><i />{g}</span>)}</div>
    default: return <div className="ce-linha"><span>{l.t}</span><i /></div>
  }
}

export default function AjudaEsquema({ e }: { e: EsquemaTela }) {
  const navigate = useNavigate()
  const [sel, setSel] = useState(1)
  const parte = e.partes[sel - 1]
  const mostrar = () => navigate(e.rota, parte?.el ? { state: { acender: { el: parte.el, titulo: parte.titulo, texto: parte.texto } } } : undefined)
  return (
    <section className="ca-card ce">
      <p className="ce-rot">Como é a tela</p>
      <p className="ce-sub">Toque num número para ver o que cada parte faz.</p>
      <div className="ce-tela" role="group" aria-label={`Esquema da tela ${e.tela}`}>
        <div className="ce-cab"><b>{e.tela}</b><small>Esquema da tela</small></div>
        {e.blocos.map((b, i) => (
          <Fragment key={i}>
            {b.n ? (
              <div role="button" tabIndex={0} className={`ce-bloco${b.escuro ? ' ce-bloco--escuro' : ''}${sel === b.n ? ' on' : ''}`} onClick={() => setSel(b.n!)}
                onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSel(b.n!) } }}
                aria-pressed={sel === b.n} aria-label={`Parte ${b.n}: ${e.partes[b.n - 1]?.titulo || ''}`}>
                <i className="ce-n" aria-hidden="true">{b.n}</i>
                {b.titulo && <b className="ce-bloco-t">{b.titulo}</b>}
                {b.linhas.map((l, k) => <Linha key={k} l={l} />)}
              </div>
            ) : (
              <div className={`ce-bloco ce-bloco--neutro${b.escuro ? ' ce-bloco--escuro' : ''}`}>
                {b.titulo && <b className="ce-bloco-t">{b.titulo}</b>}
                {b.linhas.map((l, k) => <Linha key={k} l={l} />)}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <ol className="ce-partes">
        {e.partes.map((p, i) => (
          <li key={p.titulo}>
            <button type="button" className={sel === i + 1 ? 'on' : ''} onClick={() => setSel(i + 1)} aria-pressed={sel === i + 1}>
              <i aria-hidden="true">{i + 1}</i>
              <span><b>{p.titulo}</b><small>{p.texto}</small></span>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="ce-mostrar" onClick={mostrar}>
        <span>Mostrar na tela</span><ArrowUpRight size={18} weight="bold" aria-hidden="true" />
      </button>
    </section>
  )
}
