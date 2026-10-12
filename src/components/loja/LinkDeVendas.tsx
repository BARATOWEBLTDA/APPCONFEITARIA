import { useState } from 'react'
import { ArrowSquareOut, Copy, Check, Storefront } from '@phosphor-icons/react'
import { useProfile, getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import './loja.css'

/** Seu link de vendas (4.27) · no Início do computador: o link do cardápio sempre à mão, (o abrir/pausar fica no menu da esquerda). */
export function LinkDeVendas() {
  const { profile } = useProfile()
  const [copiado, setCopiado] = useState(false)
  const link = getCardapioUrl(profile)
  if (!profile?.id || !link) return null

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu pra copiar. Segure no link pra copiar.', { tipo: 'erro' }) }
  }

  return (
    <section className="lj-link" aria-label="Seu link de vendas">
      <div className="lj-link-cab">
        <span className="lj-link-ic"><Storefront size={20} aria-hidden="true" /></span>
        <span><b>Seu link de vendas</b><small>Mande pros clientes pedirem pelo cardápio</small></span>
      </div>
      <p className="lj-link-url" title={link}>{link.replace(/^https?:\/\//, '')}</p>
      <div className="lj-link-bts">
        <button type="button" className="lj-bt" onClick={copiar}>{copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copiado ? 'Copiado' : 'Copiar'}</button>
        <a className="lj-bt lj-bt--pri" href={link} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={18} aria-hidden="true" />Abrir</a>
      </div>
    </section>
  )
}
