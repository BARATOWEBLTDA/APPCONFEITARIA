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
  { Ic: ListBullets, t: 'Cardápio digital com link próprio' },
  { Ic: CalendarDots, t: 'Pedidos e agenda de entregas' },
  { Ic: Users, t: 'Clientes e histórico de compras' },
  { Ic: CurrencyDollar, t: 'Financeiro e preço dos produtos' },
]

export function ContaAtiva({ nome, aoContinuar }: { nome?: string; aoContinuar: () => void }) {
  const caixa = useRef<HTMLDivElement>(null)
  useSobreposicao(true, aoContinuar, caixa)
  return (
    <div className="ca-veu">
      <div ref={caixa} tabIndex={-1} className="ca-jan" role="dialog" aria-modal="true" aria-labelledby="ca-titulo">
        <span className="ca-alca" aria-hidden="true" />
        <Mascote pose="acenando" className="ca-masc" />
        <span className="ca-ok"><i aria-hidden="true" />Conta ativa</span>
        <h2 id="ca-titulo">{nome ? `Tudo pronto, ${nome}!` : 'Tudo pronto!'}</h2>
        <p>Sua conta está ativa e estes recursos já estão liberados pra você usar agora:</p>
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
