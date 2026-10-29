import { useRef } from 'react'
import { Bell, Calculator, CalendarDots, Check, ListBullets, Sparkle, Wallet } from '@phosphor-icons/react'
import { Botao } from '@/components/base'
import { Mascote } from '@/components/marca/Mascote'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import { nomeApresentavel } from '@/lib/nomeApresentavel'
import './termos.css'

/**
 * Conta ativa (4.26) · confirmação logo depois do aceite dos termos, só pra quem acabou de criar a conta.
 * Mostra o que já está liberado (tudo do plano grátis, sem falar do PRO) e leva pra apresentação.
 */
// (28/10) só o que é do plano grátis e acontece de verdade: o aviso de pedido novo (push) e o A receber entraram;
// "lucro na mão" saiu (o relatório de lucro é PRO) e Clientes foi para as outras funcionalidades
const RECURSOS = [
  { Ic: ListBullets, t: 'Cardápio digital vendendo 24h' },
  { Ic: Bell, t: 'Aviso no celular a cada pedido' },
  { Ic: CalendarDots, t: 'Agenda com todas as entregas' },
  { Ic: Wallet, t: 'Quem já pagou e quem falta' },
  { Ic: Calculator, t: 'Preço certo pela ficha técnica' },
]
// confete parado no cabeçalho: [left %, top px, cor, giro]
const CONFETE: [number, number, string, number][] = [[44, 12, '#FCD34D', 25], [70, 20, '#FFFFFF', -30], [90, 9, '#86EFAC', 50], [94, 72, '#FCD34D', -15], [62, 98, '#93C5FD', 35]]

export function ContaAtiva({ nome, aoContinuar }: { nome?: string; aoContinuar: () => void }) {
  const primeiro = nomeApresentavel(nome) // "bruno" vira "Bruno"; nome que não parece nome fica de fora
  const caixa = useRef<HTMLDivElement>(null)
  useSobreposicao(true, aoContinuar, caixa)
  return (
    <div className="ca-veu">
      <div ref={caixa} tabIndex={-1} className="ca-jan" role="dialog" aria-modal="true" aria-labelledby="ca-titulo">
        {/* (15/10) cabeçalho rosa com o mascote e confete; texto de venda (o que ela ganha), sem quebrar linha a 360px */}
        <div className="ca-hd">
          {CONFETE.map(([l, t, c, g], i) => <i key={i} className="ca-cf" aria-hidden="true" style={{ left: `${l}%`, top: t, background: c, transform: `rotate(${g}deg)` }} />)}
          <Mascote pose="acenando" className="ca-masc" />
          <span className="ca-tag"><i aria-hidden="true" />Conta ativa</span>
          {/* (15/10) o título não repete a etiqueta "Conta ativa"; o nome sempre com a primeira letra maiúscula */}
          <h2 id="ca-titulo">{primeiro ? `Tudo pronto, ${primeiro}!` : 'Tudo pronto!'}</h2>
          <p className="ca-sub">Isso tudo já é seu:</p>
        </div>
        <ul className="ca-lista">
          {RECURSOS.map(({ Ic, t }) => (
            <li key={t}><span className="ca-ic"><Ic size={20} aria-hidden="true" /></span>{t}<Check size={16} weight="bold" className="ca-v" aria-hidden="true" /></li>
          ))}
          <li className="ca-mais"><span className="ca-ic"><Sparkle size={18} weight="fill" aria-hidden="true" /></span>+ 15 funcionalidades incríveis</li>
        </ul>
        <div className="ca-pe"><Botao cheio onClick={aoContinuar}>Continuar</Botao>{/* (28/10) "Ver como funciona" é o botão da tela seguinte */}</div>
      </div>
    </div>
  )
}
