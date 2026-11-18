import { type ReactNode } from 'react'
import { BotaoFechar } from "@/components/base";
import { useNavigate } from 'react-router-dom'
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { Eye, ShareNetwork, Basket, Camera, ImageSquare, InstagramLogo, CaretRight } from '@phosphor-icons/react'
import { getCardapioUrl, type Profile } from '@/hooks/useProfile'
import './loja.css'

/**
 * (16/10) Loja pronta: cartão pequeno no topo do Início (antes ocupava quase a tela toda, com mascote, link,
 * Copiar, Abrir e WhatsApp). "Compartilhar" abre o compartilhar do celular (WhatsApp, Instagram...);
 * onde ele não existe (computador), copia o link. "Ver cardápio" mostra como o cliente vê. O X fecha de vez.
 */
export function LojaProntaCartao({ profile, onFechar }: { profile: Profile | null; onFechar: () => void }) {
  const navigate = useNavigate()
  const link = getCardapioUrl(profile)

  const compartilhar = () => { void compartilharCardapio(link, profile?.nome_loja) } // (16/10) nativo; no computador copia

  // (18/11) "Mas ainda dá pra melhorar": próximos passos anexados no cartão do cardápio no ar
  // (18/11) "Criar um banner" some quando ela já tem algum banner de promoção (banner_url ou os 3 do PRO)
  const temBanner = !!(profile?.banner_url || profile?.banner1_url || profile?.banner2_url || profile?.banner3_url)
  type Melhoria = { ic: ReactNode; t: string; s: string; pro?: boolean; ir: () => void }
  const melhorar: Melhoria[] = [
    { ic: <Basket size={20} weight="regular" />, t: "Cadastrar mais produtos", s: "Quanto mais opções, mais pedidos", ir: () => navigate('/produtos') },
    { ic: <Camera size={20} weight="regular" />, t: "Caprichar nas fotos", s: "Foto boa vende mais", ir: () => navigate('/produtos') },
    ...(temBanner ? [] : [{ ic: <ImageSquare size={20} weight="regular" />, t: "Criar um banner", s: "Destaque promoções no topo do cardápio", ir: () => navigate('/cardapio-config') }]),
    { ic: <InstagramLogo size={20} weight="regular" />, t: "Divulgar seu cardápio", s: "Bio do Insta, status do WhatsApp", ir: compartilhar },
  ]

  return (
    <div className="lpc lpc--doo">
      {/* (6.137) o Doo comemorando, no mesmo banner dos passos */}
      <div className="lpc-topo">
        <img src="/Sistema/banner-passos-pronto.webp" alt="" aria-hidden="true" className="lpc-img" />
        <b>Cardápio no ar!</b>
        <small>Mande o link para os clientes</small>
      </div>
      <BotaoFechar className="lpc-x" onClick={onFechar} />
      <div className="lpc-bts">
        <button type="button" className="lpc-b lpc-b--pri" onClick={compartilhar}><ShareNetwork size={18} weight="bold" aria-hidden="true" />Compartilhar</button>
        <button type="button" className="lpc-b" onClick={() => navigate('/cardapio-preview')}><Eye size={18} weight="bold" aria-hidden="true" />Ver cardápio</button>
      </div>
      <div className="lpc-mel">
        <p className="lpc-mel-t">Mas ainda dá pra melhorar</p>
        {melhorar.map((m) => (
          <button type="button" key={m.t} className="lpc-mel-row" onClick={m.ir}>
            <span className="lpc-mel-ic" aria-hidden="true">{m.ic}</span>
            <span className="lpc-mel-tx">
              <b className="lpc-mel-nome">{m.t}{m.pro && <i className="lpc-mel-pro">PRO</i>}</b>
              <small>{m.s}</small>
            </span>
            <CaretRight size={16} weight="bold" className="lpc-mel-cv" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
