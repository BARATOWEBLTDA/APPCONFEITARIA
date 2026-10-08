import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Bell, Cake, CalendarDots, Calculator, Camera, CaretLeft, ChartLineUp, CurrencyDollar, Info, Invoice, Lightbulb,
  ListDashes, Newspaper, Package, PaintBrush, Receipt, ShoppingBag, ShoppingCart, SquaresFour, User, Users,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Janela } from '@/components/base'
import MenuConta from '@/components/MenuConta'
import { ImageCropper } from '@/components/ui/ImageCropper'
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
 *   · a foto sempre abre esse menu; a câmera (quando não tem foto) abre a escolha da foto
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

export default function AppPageHeader({ title, subtitle, infoTitle, infoIcon, infoContent, infoTip, rightActions, onBack }: AppPageHeaderProps) {
  const [mostrarInfo, setMostrarInfo] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const { profile } = useProfile()
  const { fileInputRef, uploading: enviandoFoto, handleFileSelected, cropSrc, cancelCrop, handleCropDone } = useAvatarUpload()
  const foto = useRef<HTMLButtonElement>(null)
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
          {/* (07/10 · 3.07) a foto abre o menu da conta em todo lugar onde aparece (celular e tablet, até 900px).
              Antes, de 768px pra cima, ela trocava a foto, e no tablet em pé não havia caminho pra "Sair". */}
          <button
            ref={foto} type="button" className="cab-foto" onClick={() => setMenuAberto(a => !a)}
            aria-label="Abrir o menu da conta" aria-haspopup="dialog" aria-expanded={menuAberto}
          >
            {profile?.foto_url
              ? <img src={profile.foto_url} alt="" className="cab-foto-img" />
              : <User size={24} weight="bold" aria-hidden="true" />}
          </button>
          {/* sem foto: a câmera é o atalho pra colocar uma (agora é um botão de verdade; antes era só enfeite) */}
          {!profile?.foto_url && (
            <button type="button" className="cab-foto-cam" disabled={enviandoFoto} onClick={() => fileInputRef.current?.click()} aria-label="Colocar uma foto" title="Colocar uma foto">
              <Camera size={16} weight="bold" aria-hidden="true" />
            </button>
          )}
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

      {/* (07/10 · 3.05) faltava a janela de recortar: no tablet, escolher a foto pelo cabeçalho não fazia nada */}
      {cropSrc && <ImageCropper imageSrc={cropSrc} aspect={1} cropShape="round" onCancel={cancelCrop} onCropDone={handleCropDone} />}
    </>
  )
}
