import { Cake } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
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
      <span>{zap ? 'Volte mais tarde ou chame no WhatsApp.' : 'Volte daqui a pouco para ver as delícias da loja.'}</span>
      {zap && (
        <a className="cl-vazio-zap" href={zap} target="_blank" rel="noopener noreferrer">
          <IconeWhatsApp size={20} />Chamar no WhatsApp
        </a>
      )}
    </div>
  )
}
