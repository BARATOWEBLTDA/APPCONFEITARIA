import { Cake, WhatsappLogo } from '@phosphor-icons/react'
import './cardapioLista.css'

/** Loja ainda sem produto no cardápio: cardápio em montagem (com o WhatsApp da loja quando tem). */
export function EmptyState({ telefone }: { telefone?: string | null }) {
  const fone = String(telefone || '').replace(/\D/g, '')
  const zap = fone ? `https://wa.me/${fone.startsWith('55') ? fone : '55' + fone}` : ''
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
