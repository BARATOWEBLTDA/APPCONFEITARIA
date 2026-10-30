import { useMemo, useState } from 'react'
import { Campo } from './Campo'

/**
 * (29/10 · 5.14) Campo com sugestões que aparecem embaixo enquanto digita (a partir de 3 letras, no máximo 6).
 * É só uma ajuda: dá para escrever qualquer coisa. No lugar da lista do navegador (datalist), que abria do lado
 * com todas as opções. Setas escolhem, Enter confirma, Esc fecha.
 */
const sem = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function CampoSugestao({ valor, aoMudar, opcoes, rotulo = '', placeholder, ariaLabel, minimo = 3 }: {
  valor: string; aoMudar: (v: string) => void; opcoes: string[]; rotulo?: string; placeholder?: string; ariaLabel?: string; minimo?: number
}) {
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const lista = useMemo(() => {
    const q = sem(valor)
    if (q.length < minimo) return []
    const comeca = opcoes.filter(o => sem(o).startsWith(q))
    const contem = opcoes.filter(o => !sem(o).startsWith(q) && sem(o).includes(q))
    return [...comeca, ...contem].filter(o => sem(o) !== q).slice(0, 6)
  }, [valor, opcoes, minimo])
  const mostrar = aberto && lista.length > 0
  const escolher = (o: string) => { aoMudar(o); setAberto(false) }
  return (
    <div className="ui-sug">
      <Campo rotulo={rotulo} aria-label={ariaLabel} placeholder={placeholder} autoComplete="off" value={valor}
        role="combobox" aria-expanded={mostrar} aria-autocomplete="list"
        onChange={e => { aoMudar(e.target.value); setAberto(true); setAtivo(0) }}
        onFocus={() => setAberto(true)} onBlur={() => window.setTimeout(() => setAberto(false), 120)}
        onKeyDown={e => {
          if (!mostrar) return
          if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(lista.length - 1, a + 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(0, a - 1)) }
          else if (e.key === 'Enter') { e.preventDefault(); escolher(lista[ativo]) }
          else if (e.key === 'Escape') setAberto(false)
        }} />
      {mostrar && (
        <ul className="ui-sug-l" role="listbox">
          {lista.map((o, i) => (
            <li key={o} role="option" aria-selected={i === ativo} className={i === ativo ? 'on' : undefined}
              onMouseDown={e => { e.preventDefault(); escolher(o) }} onMouseEnter={() => setAtivo(i)}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
