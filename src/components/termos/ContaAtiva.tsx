import { useRef } from 'react'
import { CalendarDots, CurrencyDollar, Check, ListBullets, Users } from '@phosphor-icons/react'
import { Botao } from '@/components/base'
import { Mascote } from '@/components/marca/Mascote'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import './termos.css'

/**
 * Conta ativa (4.26) · confirmação logo depois do aceite dos termos, só pra quem acabou de criar a conta.
 * Mostra o que já está liberado (tudo do plano grátis, sem falar do PRO) e leva pra apresentação.
 */
const RECURSOS = [
  { Ic: ListBullets, t: 'Cardápio online com seu link' },
  { Ic: CalendarDots, t: 'Pedidos e entregas na agenda' },
  { Ic: Users, t: 'Clientes e o que compraram' },
  { Ic: CurrencyDollar, t: 'Lucro e preço certo dos doces' },
]

export function ContaAtiva({ nome, aoContinuar }: { nome?: string; aoContinuar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  useSobreposicao(true, aoContinuar, caixa)
  return (
    <div className="ca-veu">
      <div ref={caixa} tabIndex={-1} className="ca-jan" role="dialog" aria-modal="true" aria-labelledby="ca-titulo">
        {/* (15/10) sem a barrinha de arrastar (não arrasta) e sem "Tudo pronto" (ainda vêm a apresentação e os primeiros passos) */}
        <Mascote pose="acenando" className="ca-masc" />
        <h2 id="ca-titulo"><i className="ca-pt" aria-hidden="true" />Sua conta está ativa!</h2>
        <p>{nome ? `${nome}, já está tudo liberado pra você:` : 'Já está tudo liberado pra você:'}</p>
        <ul className="ca-lista">
          {RECURSOS.map(({ Ic, t }) => (
            <li key={t}><span className="ca-ic"><Ic size={20} aria-hidden="true" /></span>{t}<Check size={16} weight="bold" className="ca-v" aria-hidden="true" /></li>
          ))}
        </ul>
        <Botao cheio onClick={aoContinuar}>Conhecer o Doonly</Botao>
      </div>
    </div>
  )
}
