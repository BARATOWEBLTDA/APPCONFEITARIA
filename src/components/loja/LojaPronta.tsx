import { useNavigate } from 'react-router-dom'
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { Check, Eye, ShareNetwork, X } from '@phosphor-icons/react'
import { getCardapioUrl } from '@/hooks/useProfile'
import './loja.css'

/**
 * (16/10) Loja pronta: cartão pequeno no topo do Início (antes ocupava quase a tela toda, com mascote, link,
 * Copiar, Abrir e WhatsApp). "Compartilhar" abre o compartilhar do celular (WhatsApp, Instagram...);
 * onde ele não existe (computador), copia o link. "Ver cardápio" mostra como o cliente vê. O X fecha de vez.
 */
export function LojaProntaCartao({ profile, onFechar }: { profile: any; onFechar: () => void }) {
  const navigate = useNavigate()
  const link = getCardapioUrl(profile)

  const compartilhar = () => { void compartilharCardapio(link, profile?.nome_loja) } // (16/10) nativo; no computador copia

  return (
    <div className="lpc">
      <button type="button" className="lpc-x" onClick={onFechar} aria-label="Fechar"><X size={14} weight="bold" /></button>
      <div className="lpc-top">
        <span className="lpc-ic" aria-hidden="true"><Check size={22} weight="bold" /></span>
        <span className="lpc-tx"><b>Seu cardápio está no ar!</b><small>Mande o link para os seus clientes</small></span>
      </div>
      <div className="lpc-bts">
        <button type="button" className="lpc-b lpc-b--pri" onClick={compartilhar}><ShareNetwork size={18} weight="bold" aria-hidden="true" />Compartilhar</button>
        <button type="button" className="lpc-b" onClick={() => navigate('/cardapio-preview')}><Eye size={18} weight="bold" aria-hidden="true" />Ver cardápio</button>
      </div>
    </div>
  )
}
