import { Cake, WhatsappLogo } from '@phosphor-icons/react'
import { linkWhatsApp } from '@/lib/telefone'
import './cardapioLista.css'

/** Loja ainda sem produto no cardápio: cardápio em montagem (com o WhatsApp da loja quando tem). */
export function EmptyState({ telefone }: { telefone?: string | null }) {
  // 10/10: o link trata o +55 e o DDD 55 num lugar só (lib/telefone)
  const zap = linkWhatsApp(telefone)
  return (
    <div className="cl-vazio cl-vazio--loja">
      <span className="cl-vazio-ic"><Cake size={36} weight="duotone" aria-hidden="true" /></span>
      <b>O cardápio está sendo preparado</b>
      <span>{zap ? 'Volte daqui a pouco ou fale com a loja pelo WhatsApp.' : 'Volte daqui a pouco pra ver as delícias da loja.'}</span>
      {zap && (
        <a className="cl-vazio-zap" href={zap} target="_blank" rel="noopener noreferrer">
          <WhatsappLogo size={20} weight="bold" aria-hidden="true" />Chamar no WhatsApp
        </a>
      )}
    </div>
  )
}
