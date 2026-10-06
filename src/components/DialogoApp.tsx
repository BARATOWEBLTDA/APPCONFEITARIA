import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ArrowCounterClockwise, WarningCircle, Info, XCircle, CheckCircle } from '@phosphor-icons/react'
import { useTravarRolagem } from '@/hooks/useTravarRolagem'

/**
 * Janela do app (03/10) — no lugar das janelinhas do navegador ("doonly diz").
 *   tipo 'aviso': só um botão (Entendi). tipo 'confirmar': confirmar + voltar.
 *   icone: o desenho no círculo do topo. perigo: botão de confirmar em vermelho.
 */
export type IconeDialogo = 'alerta' | 'erro' | 'info' | 'estorno' | 'ok'
export type DialogoOpcoes = { titulo: string; texto?: string; icone?: IconeDialogo; rotuloConfirmar?: string; perigo?: boolean }

const ICONES: Record<IconeDialogo, { el: any; cor: string; fundo: string }> = {
  alerta: { el: WarningCircle, cor: '#B45309', fundo: '#FEF3C7' },
  erro: { el: XCircle, cor: '#DC2626', fundo: '#FEE2E2' },
  info: { el: Info, cor: '#C33A6E', fundo: '#FCE7F3' },
  estorno: { el: ArrowCounterClockwise, cor: '#DC2626', fundo: '#FEE2E2' },
  ok: { el: CheckCircle, cor: '#15803D', fundo: '#DCFCE7' },
}

export default function DialogoApp({ tipo = 'aviso', titulo, texto, icone = 'info', rotuloConfirmar = 'Confirmar', perigo, onConfirmar, onFechar }: DialogoOpcoes & {
  tipo?: 'aviso' | 'confirmar'; onConfirmar?: () => void; onFechar: () => void
}) {
  useTravarRolagem(true)
  useEffect(() => { const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }; window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [onFechar])
  const ic = ICONES[icone]; const Ic = ic.el
  return createPortal(
    <div className="dlg-ov" onClick={onFechar}>
      <div className="dlg" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={titulo}>
        <span className="dlg-ic" style={{ background: ic.fundo, color: ic.cor }}><Ic size={34} weight="duotone" /></span>
        <b className="dlg-t">{titulo}</b>
        {texto && <p className="dlg-x">{texto}</p>}
        {tipo === 'confirmar' ? (
          <div className="dlg-bts">
            <button className="dlg-b2" onClick={onFechar}>Voltar</button>
            <button className={`dlg-b1 ${perigo ? 'perigo' : ''}`} onClick={() => onConfirmar?.()}>{rotuloConfirmar}</button>
          </div>
        ) : (
          <button className="dlg-b1 dlg-full" onClick={onFechar} autoFocus>Entendi</button>
        )}
      </div>
      <style>{`
        .dlg-ov { position: fixed; inset: 0; z-index: 10080; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
        @media (min-width: 768px) { .dlg-ov { align-items: center; } }
        .dlg { width: 100%; max-width: 400px; background: #fff; border-radius: 24px 24px 0 0; padding: 26px 22px calc(20px + env(safe-area-inset-bottom, 0px)); text-align: center; color: #2C1219; animation: dlgSobe .22s ease; }
        @media (min-width: 768px) { .dlg { border-radius: 24px; } }
        @keyframes dlgSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .dlg-ic { width: 68px; height: 68px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; }
        .dlg-t { display: block; font-size: 18px; font-weight: 900; line-height: 1.3; text-wrap: balance; }
        .dlg-x { margin: 8px auto 0; font-size: 14px; color: #6B5D64; line-height: 1.5; max-width: 320px; text-wrap: balance; }
        .dlg-bts { display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; margin-top: 20px; }
        .dlg-b1, .dlg-b2 { border: none; border-radius: 14px; padding: 14px; font-family: inherit; font-size: 15px; font-weight: 800; cursor: pointer; }
        .dlg-b1 { background: #E85A8C; color: #fff; box-shadow: 0 3px 0 #C33A6E; } .dlg-b1.perigo { background: #DC2626; box-shadow: 0 3px 0 #991B1B; }
        .dlg-b2 { background: #F3EEF1; color: #4B3A42; } .dlg-full { width: 100%; margin-top: 20px; }
      `}</style>
    </div>, document.body)
}
