/**
 * (29/10 · 5.04) Escolha em caixinhas, uma embaixo da outra: bolinha, nome e uma linha dizendo o que acontece.
 * Padrão do app no lugar do seletor de várias partes quando a escolha muda como as coisas funcionam
 * (o Bruno aprovou no "O que aparece no cardápio" do endereço). Valores curtos (kg/g, 7/15/30 dias) seguem no seletor.
 */
export type OpcaoCaixa<V extends string> = { v: V; t: string; sub?: string; desativada?: boolean }

export function CaixasEscolha<V extends string>({ opcoes, valor, onMudar, rotulo, rotuloId, className = '' }: {
  opcoes: OpcaoCaixa<V>[]; valor: V; onMudar: (v: V) => void
  /** nome do grupo para leitores de tela (ou rotuloId, o id do título que já aparece na tela) */
  rotulo?: string; rotuloId?: string; className?: string
}) {
  return (
    <div className={`ui-cx ${className}`.trim()} role="radiogroup" aria-label={rotuloId ? undefined : rotulo} aria-labelledby={rotuloId}>
      {opcoes.map(o => (
        <button type="button" role="radio" aria-checked={valor === o.v} key={o.v} className={valor === o.v ? 'on' : ''} disabled={o.desativada}
          onClick={() => { if (valor !== o.v) onMudar(o.v) }}>
          <i aria-hidden="true" /><span><b>{o.t}</b>{o.sub && <small>{o.sub}</small>}</span>
        </button>
      ))}
    </div>
  )
}
