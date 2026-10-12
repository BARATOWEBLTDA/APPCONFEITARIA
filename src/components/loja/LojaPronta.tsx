import { useState } from 'react'
import { ArrowSquareOut, Check, Copy } from '@phosphor-icons/react'
import { getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import './loja.css'

/**
 * Loja pronta (4.27) · o fim dos Primeiros passos: o link do cardápio com Copiar e Abrir,
 * e o botão pra mandar o link no WhatsApp. Usado no cartão do Início e na janela que abre uma vez quando ela termina.
 */
export function LojaProntaConteudo({ profile }: { profile: any }) {
  const [copiado, setCopiado] = useState(false)
  const link = getCardapioUrl(profile)

  const texto = `Oi! Agora você pode fazer sua encomenda pelo meu cardápio: ${link}`

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu pra copiar. Segure no link pra copiar.', { tipo: 'erro' }) }
  }

  return (
    <div className="lp">
      <p className="lp-url" title={link}>{link.replace(/^https?:\/\//, '')}</p>
      <div className="lj-link-bts">
        <button type="button" className="lj-bt" onClick={copiar}>{copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copiado ? 'Copiado' : 'Copiar'}</button>
        <a className="lj-bt" href={link} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={18} aria-hidden="true" />Abrir</a>
      </div>
      <a className="lp-zap" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
        <IconeWhatsApp size={20} />Mandar o link no WhatsApp
      </a>
    </div>
  )
}
