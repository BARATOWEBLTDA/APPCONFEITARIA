import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bell, Cake, CalendarDots, Calculator, Camera, CaretLeft, ChartLineUp, CurrencyDollar, Info, Invoice, Lightbulb,
  ListDashes, Newspaper, Package, PaintBrush, Receipt, ShoppingBag, ShoppingCart, SquaresFour, User, Users,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Janela } from '@/components/base'
import MenuConta from '@/components/MenuConta'
import { useProfile } from '@/hooks/useProfile'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import './appPageHeader.css'

/**
 * Cabeçalho das telas (guia A4): faixa rosa com voltar, título, (i), subtítulo e a foto.
 * (07/10 · 2.98) Refeito no padrão do guia, sem mudar o que cada tela passa pra ele:
 *   · voltar e (i) com área de toque de 44px e ícones Phosphor
 *   · título numa linha só (corta com "…"), 22px peso 900
 *   · alinhado com a página no tablet em pé e no celular deitado (antes passava 24px de cada lado)
 *   · a janela do (i) é a janela padrão, com ícone desenhado no lugar do emoji
 *   · o menu da foto é o MenuConta, o mesmo do Início e de Pedidos
 */
interface AppPageHeaderProps {
  title: string
  subtitle: string
  /** título da janela do (i); sem ele, usa o nome da tela */
  infoTitle?: string
  /** as telas ainda mandam um emoji aqui; o cabeçalho troca pelo ícone desenhado equivalente */
  infoIcon?: string
  infoContent?: ReactNode
  infoTip?: ReactNode
  rightActions?: ReactNode
  /** Mostra botão de voltar à esquerda do título */
  onBack?: () => void
}

const ICONE_DO_EMOJI: Record<string, Icon> = {
  '🎂': Cake, '🎨': PaintBrush, '🏷️': SquaresFour, '👥': Users, '💰': CurrencyDollar, '📅': CalendarDots, '📈': ChartLineUp,
  '📑': ListDashes, '📦': Package, '📰': Newspaper, '🔔': Bell, '🛍️': ShoppingBag, '🛒': ShoppingCart, '🧮': Calculator, '🧾': Invoice, '📋': Receipt,
}

/** celular (até 767px): a foto abre o menu da conta; de 768px pra cima ela troca a foto */
function useCelular() {
  const [celular, setCelular] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const ouvir = () => setCelular(mq.matches)
    ouvir()
    mq.addEventListener('change', ouvir)
    return () => mq.removeEventListener('change', ouvir)
  }, [])
  return celular
}

export default function AppPageHeader({ title, subtitle, infoTitle, infoIcon, infoContent, infoTip, rightActions, onBack }: AppPageHeaderProps) {
  const [mostrarInfo, setMostrarInfo] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const { profile } = useProfile()
  const { fileInputRef, uploading: enviandoFoto, handleFileSelected } = useAvatarUpload()
  const foto = useRef<HTMLButtonElement>(null)
  const celular = useCelular()
  const IconeInfo = (infoIcon && ICONE_DO_EMOJI[infoIcon]) || Info

  return (
    <>
      <header className="cab">
        {onBack && (
          <BotaoIcone rotulo="Voltar" variante="claro" className="cab-voltar" onClick={onBack}><CaretLeft size={24} weight="bold" /></BotaoIcone>
        )}
        <div className="cab-txt">
          <div className="cab-linha">
            <h1 className="cab-t">{title}</h1>
            {infoContent && (
              <button type="button" className="cab-i" onClick={() => setMostrarInfo(true)} aria-label="Sobre esta tela" title="Sobre esta tela" aria-haspopup="dialog">
                <Info size={20} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="cab-s">{subtitle}</p>
        </div>
        {rightActions && <div className="cab-acoes">{rightActions}</div>}
        <div className="cab-foto-area">
          <button
            ref={foto} type="button" className="cab-foto" disabled={enviandoFoto}
            onClick={() => { if (celular) setMenuAberto(a => !a); else if (!enviandoFoto) fileInputRef.current?.click() }}
            aria-label={celular ? 'Abrir o menu da conta' : (profile?.foto_url ? 'Trocar a foto' : 'Colocar uma foto')}
            aria-haspopup={celular ? 'dialog' : undefined} aria-expanded={celular ? menuAberto : undefined}
          >
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="" className="cab-foto-img" />
              : <User size={24} weight="bold" aria-hidden="true" />}
          </button>
          {!profile?.foto_url && <span className="cab-foto-cam" aria-hidden="true"><Camera size={16} weight="bold" /></span>}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
        </div>
      </header>

      {infoContent && (
        <Janela
          aberta={mostrarInfo} aoFechar={() => setMostrarInfo(false)} titulo={infoTitle || title}
          icone={<IconeInfo size={32} />} umaAcao
          acoes={<Botao onClick={() => setMostrarInfo(false)} data-foco-inicial>Entendi</Botao>}
        >
          <div className="cab-info">{infoContent}</div>
          {infoTip && (
            <div className="cab-dica">
              <Lightbulb size={20} weight="bold" aria-hidden="true" />
              <span>{infoTip}</span>
            </div>
          )}
        </Janela>
      )}

      <MenuConta aberto={menuAberto} aoFechar={() => setMenuAberto(false)} ancora={foto} />
    </>
  )
}
