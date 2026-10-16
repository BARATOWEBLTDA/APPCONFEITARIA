import { useNavigate } from 'react-router-dom'
import { Check, Eye, ShareNetwork, X } from '@phosphor-icons/react'
import { getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import './loja.css'

/**
 * (16/10) Loja pronta: cartão pequeno no topo do Início (antes ocupava quase a tela toda, com mascote, link,
 * Copiar, Abrir e WhatsApp). "Compartilhar" abre o compartilhar do celular (WhatsApp, Instagram...);
 * onde ele não existe (computador), copia o link. "Ver cardápio" mostra como o cliente vê. O X fecha de vez.
 */
export function LojaProntaCartao({ profile, onFechar }: { profile: any; onFechar: () => void }) {
  const navigate = useNavigate()
  const link = getCardapioUrl(profile)
  const texto = 'Oi! Agora você pode fazer sua encomenda pelo meu cardápio:'

  const compartilhar = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ title: profile?.nome_loja || 'Meu cardápio', text: texto, url: link }); return }
      catch (e: any) { if (e?.name === 'AbortError') return } // ela fechou a janela: nada a fazer
    }
    try { await navigator.clipboard.writeText(link); avisar('Link do cardápio copiado', { tipo: 'ok' }) }
    catch { avisar('Não deu pra copiar. Abra o cardápio e copie o link de lá.', { tipo: 'erro' }) }
  }

  return (
    <div className="lpc">
      <button type="button" className="lpc-x" onClick={onFechar} aria-label="Fechar"><X size={14} weight="bold" /></button>
      <div className="lpc-top">
        <span className="lpc-ic" aria-hidden="true"><Check size={22} weight="bold" /></span>
        <span className="lpc-tx"><b>Seu cardápio está no ar!</b><small>Mande o link pros seus clientes</small></span>
      </div>
      <div className="lpc-bts">
        <button type="button" className="lpc-b lpc-b--pri" onClick={compartilhar}><ShareNetwork size={18} weight="bold" aria-hidden="true" />Compartilhar</button>
        <button type="button" className="lpc-b" onClick={() => navigate('/cardapio-preview')}><Eye size={18} weight="bold" aria-hidden="true" />Ver cardápio</button>
      </div>
    </div>
  )
}
