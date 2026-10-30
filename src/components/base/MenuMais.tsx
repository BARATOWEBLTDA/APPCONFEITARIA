/**
 * (30/10 · 5.43) Menu dos três pontinhos (⋮), o mesmo em todo o app: abre colado no botão, sem escurecer a tela
 * (o mesmo visual do "Mais" do produto: ícone numa caixinha, título e uma linha explicando). Clicou fora ou Esc, fecha.
 *   <MenuMais rotulo="Opções de Topo de Bolo" itens={[{ Ic: PencilSimple, t: "Editar", sub: "Nome, preço e onde aparece", aoTocar: ... }]} />
 */
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { DotsThreeVertical } from '@phosphor-icons/react'

export type ItemMenuMais = { Ic: ComponentType<{ size?: number; weight?: 'bold' | 'regular' | 'fill' }>; t: string; sub?: string; perigo?: boolean; aoTocar: () => void }

export function MenuMais({ itens, rotulo, className = '' }: { itens: ItemMenuMais[]; rotulo: string; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const bt = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLDivElement>(null)

  // posição: embaixo do botão, alinhado pela direita; sem espaço embaixo, abre para cima
  useLayoutEffect(() => {
    if (!aberto || !bt.current || !caixa.current) return
    const r = bt.current.getBoundingClientRect(), c = caixa.current.getBoundingClientRect()
    const larg = window.innerWidth, alt = window.innerHeight
    let top = r.bottom + 6
    if (top + c.height > alt - 8) top = Math.max(8, r.top - c.height - 6)
    const left = Math.min(Math.max(8, r.right - c.width), larg - c.width - 8)
    setPos({ top, left })
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    const fora = (e: Event) => { if (!caixa.current?.contains(e.target as Node) && !bt.current?.contains(e.target as Node)) setAberto(false) }
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAberto(false); bt.current?.focus() } }
    const fechar = () => setAberto(false)
    document.addEventListener('pointerdown', fora, true)
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('pointerdown', fora, true)
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  return (
    <>
      <button ref={bt} type="button" className={`ui-mais-bt ${className}`.trim()} aria-label={rotulo} aria-haspopup="menu" aria-expanded={aberto}
        onClick={e => { e.stopPropagation(); setPos(null); setAberto(v => !v) }}>
        <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
      </button>
      {aberto && createPortal(
        <div ref={caixa} className="ui-mais" role="menu" aria-label={rotulo} style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
          onClick={e => e.stopPropagation()}>
          {itens.map(it => (
            <button key={it.t} type="button" role="menuitem" className={`ui-mais-it${it.perigo ? ' ui-mais-it--perigo' : ''}`}
              onClick={() => { setAberto(false); it.aoTocar() }}>
              <span className="ui-mais-ic" aria-hidden="true"><it.Ic size={18} weight="bold" /></span>
              <span className="ui-mais-tx"><b>{it.t}</b>{it.sub && <small>{it.sub}</small>}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
