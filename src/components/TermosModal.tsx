/**
 * TermosModal — a janela dos Termos de Uso e da Política de Privacidade (refeita em 07/10).
 * Abre por cima da tela onde a pessoa está (login, cadastro, Configurações): não recarrega o app
 * e não perde o que ela já digitou. No celular sobe de baixo; no computador aparece no centro.
 * Fecha no X, no "Entendi", tocando fora, no Esc e no "voltar" do Android.
 * Com paginaNoComputador (usado no login e no cadastro), a partir de 900px de largura ela vira a página
 * inteira dos termos (com o índice ao lado), numa camada por cima: o "voltar" fecha e o login continua como estava.
 * O texto vem de src/components/legal/textosLegais.tsx (o mesmo da página /termos).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Titulo } from '@/components/base'
import { useFase, useSobreposicao } from '@/components/base/useSobreposicao'
import { DocLegal } from '@/components/legal/DocLegal'
import PaginaLegal from '@/components/legal/PaginaLegal'
import { DOCS_LEGAIS } from '@/components/legal/textosLegais'
import type { DocLegalId } from '@/components/legal/textosLegais'
import '@/components/legal/legal.css'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: DocLegalId
  /** no computador (900px ou mais), abre a página inteira em vez da janela no meio da tela */
  paginaNoComputador?: boolean
}

function useComputador(): boolean {
  const [sim, setSim] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const mudou = (e: MediaQueryListEvent) => setSim(e.matches)
    mq.addEventListener('change', mudou)
    return () => mq.removeEventListener('change', mudou)
  }, [])
  return sim
}

export default function TermosModal({ open, onClose, initialTab = 'termos', paginaNoComputador = false }: Props) {
  const computador = useComputador()
  const [aba, setAba] = useState<DocLegalId>(initialTab)
  const caixa = useRef<HTMLDivElement>(null)
  const corpo = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  const fase = useFase(open)
  useSobreposicao(open, onClose, caixa)

  useEffect(() => { if (open) setAba(initialTab) }, [open, initialTab])
  useEffect(() => { corpo.current?.scrollTo(0, 0) }, [aba])

  if (!open && fase === 'fechada') return null
  const d = DOCS_LEGAIS[aba]
  const ids: DocLegalId[] = ['termos', 'privacidade']

  if (paginaNoComputador && computador) {
    return createPortal(
      <div ref={caixa} tabIndex={-1} className={`lg-camada${open ? '' : ' lg-camada--saindo'}`} role="dialog" aria-modal="true" aria-label={d.titulo}>
        <PaginaLegal doc={aba} camada={{ aoFechar: onClose, aoTrocar: setAba }} />
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div className={`ui-veu ui-veu--centro${open ? '' : ' ui-veu--saindo'}`} onClick={onClose}>
      <div ref={caixa} tabIndex={-1} className="lg-janela" role="dialog" aria-modal="true" aria-labelledby={idTitulo} onClick={e => e.stopPropagation()}>
        <span className="lg-janela-alca" aria-hidden="true" />
        <div className="lg-janela-cab">
          <Titulo nivel="janela" id={idTitulo}>{d.titulo}</Titulo>
          <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onClose}><X size={20} weight="bold" /></BotaoIcone>
        </div>
        <div className="lg-janela-abas">
          <div className="lg-abas" role="tablist" aria-label="Documentos">
            {ids.map(id => (
              <button key={id} type="button" role="tab" className="lg-aba" aria-selected={aba === id} onClick={() => setAba(id)}>{DOCS_LEGAIS[id].curto}</button>
            ))}
          </div>
        </div>
        <div className="lg-janela-corpo" ref={corpo} role="tabpanel">
          <p className="lg-janela-data">{d.atualizado}</p>
          <DocLegal doc={aba} prefixo="jn" />
        </div>
        <div className="lg-janela-pe"><Botao cheio onClick={onClose}>Entendi</Botao></div>
      </div>
    </div>,
    document.body,
  )
}
