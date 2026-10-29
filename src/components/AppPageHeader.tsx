import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowSquareOut, Bell, Cake, CalendarDots, Calculator, Camera, CaretLeft, ChartLineUp, Crown, CurrencyDollar, Info, Invoice, Lightbulb,
  ListDashes, MagnifyingGlass, Newspaper, Package, PaintBrush, Receipt, ShoppingBag, ShoppingCart, SquaresFour, User, Users,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Botao, BotaoIcone, Janela } from '@/components/base'
import MenuConta from '@/components/MenuConta'
import { abrirBuscaRapida } from '@/components/BuscaRapida'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { useProfile, avatarDaConta, getCardapioUrl } from '@/hooks/useProfile'
import { useLojaPronta } from '@/lib/primeirosPassos'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useNavigate } from 'react-router-dom'
import { usePlano } from '@/hooks/usePlano'
import { useNotifications } from '@/context/NotificationContext'
import { BotaoAjuda, type Como } from '@/components/como/ComoFunciona'
import type { PassoTour } from '@/components/como/tour'
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
  /** (28/10) computador: complemento do título em cinza, sem negrito ("Pedido #65 · Bruno Eduardo Pacheco"). No celular não aparece (lá vai no subtítulo) */
  titleExtra?: string
  /** (29/10 · 4.92) uma linha embaixo do título, só no computador (o Início usa pro resumo do dia) */
  resumo?: React.ReactNode
  /** título da janela do (i); sem ele, usa o nome da tela */
  infoTitle?: string
  /** as telas ainda mandam um emoji aqui; o cabeçalho troca pelo ícone desenhado equivalente */
  infoIcon?: string
  infoContent?: ReactNode
  infoTip?: ReactNode
  /** (22/10) o (i) no formato da Dora: abre uma janelinha embaixo do título (exemplo, caminho e dicas). Tem preferência sobre infoContent */
  infoComo?: Como
  /** (22/10) passos do tour da tela (aparece "Fazer o tour" embaixo do (i)) */
  infoTour?: PassoTour[]
  rightActions?: ReactNode
  /** Mostra botão de voltar à esquerda do título */
  onBack?: () => void
  /** (22/10) celular: seta de voltar (volta pra tela anterior do app; se abriu direto, vai pra este caminho). No computador não aparece */
  voltar?: string
  /** (23/10) celular: título no meio e sem coroa e sino (Novidades, no jeito do iFood) */
  centro?: boolean
}

const ICONE_DO_EMOJI: Record<string, Icon> = {
  '🎂': Cake, '🎨': PaintBrush, '🏷️': SquaresFour, '👥': Users, '💰': CurrencyDollar, '📅': CalendarDots, '📈': ChartLineUp,
  '📑': ListDashes, '📦': Package, '📰': Newspaper, '🔔': Bell, '🛍️': ShoppingBag, '🛒': ShoppingCart, '🧮': Calculator, '🧾': Invoice, '📋': Receipt,
}

export default function AppPageHeader({ title, subtitle, titleExtra, resumo, infoTitle, infoIcon, infoContent, infoTip, infoComo, infoTour, rightActions, onBack, voltar, centro }: AppPageHeaderProps) {
  // (23/10) nome da aba do navegador: o título da tela ("Pedidos · Doonly"), no lugar de "Doonly - Confeitaria Inteligente" em todas
  useEffect(() => {
    const t = String(title || '').trim()
    if (!t) return
    const antes = document.title
    document.title = `${t} · Doonly`
    return () => { document.title = antes }
  }, [title])
  const navegar = useNavigate()
  const voltarCel = () => { if (((window.history.state as any)?.idx ?? 0) > 0) navegar(-1); else if (voltar) navegar(voltar) }
  const [mostrarInfo, setMostrarInfo] = useState(false)
  const IconeInfo = (infoIcon && ICONE_DO_EMOJI[infoIcon]) || Info

  return (
    <>
      {/* (13/10) as abas do Cardápio digital saíram da faixa: viraram um grupo no menu da esquerda */}
      <header className={`cab${centro ? " cab--centro" : ""}`}>
        {onBack && (
          <BotaoIcone rotulo="Voltar" variante="claro" className="cab-voltar" onClick={onBack}><CaretLeft size={24} weight="bold" /></BotaoIcone>
        )}
        {!onBack && voltar && (
          <BotaoIcone rotulo="Voltar" variante="claro" className="cab-voltar cab-voltar--cel" onClick={voltarCel}><CaretLeft size={24} weight="bold" /></BotaoIcone>
        )}
        <div className="cab-txt">
          <div className="cab-linha">
            <h1 className="cab-t">{title}</h1>
            {titleExtra && <span className="cab-t-x" title={titleExtra}><span aria-hidden="true">·</span> {titleExtra}</span>}
            {infoComo ? (
              <BotaoAjuda c={infoComo} rotulo={title} tour={infoTour} className="cab-ajuda" />
            ) : infoContent && (
              <button type="button" className="cab-i" onClick={() => setMostrarInfo(true)} aria-label="Sobre esta tela" title="Sobre esta tela" aria-haspopup="dialog">
                <Info size={20} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="cab-s">{subtitle}</p>
          {resumo && <div className="cab-resumo">{resumo}</div>}
        </div>
        {rightActions && <div className="cab-acoes">{rightActions}</div>}
        <LogoDaLoja />
      </header>

      {infoContent && !infoComo && (
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

    </>
  )
}

/**
 * A logo da loja (ou a foto) no canto direito da faixa rosa. Abre o menu da conta.
 * (13/10) Agora também no computador, como nos outros apps de gestão: a marca Doonly fica no topo do menu da esquerda.
 * No computador, conta grátis ganha o atalho "Seja PRO" do lado; conta PRO ganha a coroinha na logo.
 */
export function LogoDaLoja({ className = '' }: { className?: string }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const { profile } = useProfile()
  const { isPro, loading: carregandoPlano } = usePlano()
  const navigate = useNavigate()
  const { fileInputRef, uploading: enviandoFoto, handleFileSelected, cropSrc, cancelCrop, handleCropDone } = useAvatarUpload()
  const foto = useRef<HTMLButtonElement>(null)
  // (21/10) computador: atalho pro cardápio da loja (só quando ele tem o que mostrar, igual ao link de vendas)
  const linkCardapio = profile ? getCardapioUrl(profile) : ''
  const pronta = useLojaPronta(profile?.id)
  const { notifCount } = useNotifications()
  return (
    <>
      <div className={`cab-foto-area ${className}`}>
        {/* (22/10) celular: coroa e sino, iguais ao Início (no lugar da logo da loja) */}
        <div className="cab-cel-acoes">
          {profile && (
            <button type="button" className="cab-cel-ac cab-cel-ac--pro" onClick={() => navigate(isPro ? '/minha-assinatura' : '/assinar')}
              aria-label={isPro ? 'Minha assinatura PRO' : 'Assinar o plano PRO'}>
              <img src="/coroa.png" alt="" aria-hidden="true" />
            </button>
          )}
          <button type="button" className="cab-cel-ac" onClick={() => navigate('/noticias')} aria-label={notifCount > 0 ? `Novidades, ${notifCount} não lida${notifCount > 1 ? 's' : ''}` : 'Novidades'}>
            <Bell size={21} weight="regular" />
            {notifCount > 0 && <i className="cab-cel-bolinha">{notifCount > 9 ? '9+' : notifCount}</i>}
          </button>
        </div>
        {/* (22/10) busca rápida (Ctrl+K), só no computador */}
        <button type="button" className="cab-busca" onClick={abrirBuscaRapida} aria-label="Buscar no app (Ctrl+K)">
          <MagnifyingGlass size={15} weight="bold" aria-hidden="true" /><span>Buscar</span><kbd>Ctrl K</kbd>
        </button>
        {linkCardapio && pronta && (
          <a className="cab-ver-cardapio" href={linkCardapio} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={12} weight="bold" aria-hidden="true" />Ver cardápio</a>
        )}
        {!carregandoPlano && !isPro && (
          <button type="button" className="cab-seja-pro" onClick={() => navigate('/assinar')}><Crown size={13} weight="fill" aria-hidden="true" />Seja PRO</button>
        )}
        <div className="cab-foto-caixa">
          {/* (07/10 · 3.07) a foto abre o menu da conta em todo lugar onde aparece */}
          <button
            ref={foto} type="button" className="cab-foto" onClick={() => setMenuAberto(a => !a)}
            aria-label="Abrir o menu da conta" aria-haspopup="dialog" aria-expanded={menuAberto}
          >
            {avatarDaConta(profile)
              ? <img src={avatarDaConta(profile)} alt="" className="cab-foto-img" />
              : <User size={24} weight="bold" aria-hidden="true" />}
          </button>
          {isPro && <span className="cab-foto-pro" aria-label="Plano PRO"><Crown size={11} weight="fill" /></span>}
          {/* sem foto: a câmera é o atalho pra colocar uma */}
          {!avatarDaConta(profile) && (
            <button type="button" className="cab-foto-cam" disabled={enviandoFoto} onClick={() => fileInputRef.current?.click()} aria-label="Colocar uma foto" title="Colocar uma foto">
              <Camera size={16} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelected} style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
      </div>
      <MenuConta aberto={menuAberto} aoFechar={() => setMenuAberto(false)} ancora={foto} />
      {/* (07/10 · 3.05) a janela de recortar a foto */}
      {cropSrc && <ImageCropper imageSrc={cropSrc} aspect={1} cropShape="round" onCancel={cancelCrop} onCropDone={handleCropDone} />}
    </>
  )
}
