import { useState } from 'react'
import { Copy, Check, Storefront } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { useProfile, getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import { useLojaPronta } from '@/lib/primeirosPassos'
import './loja.css'

/** Seu link de vendas (4.27) · no Início do computador: o link do cardápio sempre à mão, (o abrir/pausar fica no menu da esquerda).
 *  (21/10) virou a faixa de destaque do Início (cinza escuro): copiar e mandar no WhatsApp. O "Ver cardápio" foi pro topo. */
export function LinkDeVendas() {
  const { profile } = useProfile()
  const [copiado, setCopiado] = useState(false)
  const link = getCardapioUrl(profile)
  // (13/10) conta nova: o link só aparece quando o cardápio tem o que mostrar (antes abria um cardápio vazio)
  const pronta = useLojaPronta(profile?.id)
  if (!profile?.id || !link || pronta === false) return null

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu pra copiar. Segure no link pra copiar.', { tipo: 'erro' }) }
  }

  const zap = `https://wa.me/?text=${encodeURIComponent(`Faça seu pedido pelo nosso cardápio: ${link}`)}`
  return (
    <section className="lj-link" aria-label="Seu link de vendas">
      <span className="lj-link-ic"><Storefront size={26} aria-hidden="true" /></span>
      <span className="lj-link-tx">
        <small>Seu link de vendas</small>
        <b title={link}>{link.replace(/^https?:\/\//, '')}</b>
        <em>Mande pros clientes pedirem pelo cardápio</em>
      </span>
      <span className="lj-link-bts">
        <button type="button" className="lj-bt" onClick={copiar}>{copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copiado ? 'Copiado' : 'Copiar link'}</button>
        <a className="lj-bt lj-bt--pri" href={zap} target="_blank" rel="noopener noreferrer"><IconeWhatsApp size={18} />Mandar no WhatsApp</a>
      </span>
    </section>
  )
}
