/**
 * TermosModal — a janela dos Termos de Uso e da Política de Privacidade (refeita em 07/10).
 * Abre por cima da tela onde a pessoa está (login, cadastro, Configurações): não recarrega o app
 * e não perde o que ela já digitou. No celular sobe de baixo; no computador aparece no centro.
 * Fecha no X, no "Entendi", tocando fora, no Esc e no "voltar" do Android.
 * O texto vem de src/components/legal/textosLegais.tsx (o mesmo da página /termos).
 */
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Titulo } from '@/components/base'
import { useFase, useSobreposicao } from '@/components/base/useSobreposicao'
import { DocLegal } from '@/components/legal/DocLegal'
import { DOCS_LEGAIS } from '@/components/legal/textosLegais'
import type { DocLegalId } from '@/components/legal/textosLegais'
import '@/components/legal/legal.css'

interface Props {
  open: boolean
  onClose: () => void
  initialTab?: DocLegalId
}

export default function TermosModal({ open, onClose, initialTab = 'termos' }: Props) {
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
