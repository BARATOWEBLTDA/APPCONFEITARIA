import { Copy } from '@phosphor-icons/react'
import { avisar } from '@/components/base'
import { guardarCupomEscolhido, regraCupom, textoDesconto, type CupomVitrine } from '@/lib/cupons'
import './vouchers.css'

/**
 * (20/10) Cupons da loja no topo do cardápio, em estilo voucher (até 2, lado a lado).
 * Tocar copia o código e deixa o cupom pronto: ele já vai aplicado na sacola.
 */
export function Vouchers({ cupons, cor = '#EC4899' }: { cupons: CupomVitrine[]; cor?: string }) {
  if (!cupons?.length) return null
  const lista = cupons.slice(0, 2)
  const um = lista.length === 1
  const usar = async (c: CupomVitrine) => {
    try { await navigator.clipboard?.writeText(c.codigo) } catch { /* sem permissão: o cupom vai aplicado do mesmo jeito */ }
    guardarCupomEscolhido(c.codigo)
    avisar(`Cupom ${c.codigo} copiado. Ele já vai aplicado na sacola.`, { tipo: 'ok' })
  }
  return (
    <div className={`vc-l${um ? ' vc-l--um' : ''}${lista.length > 2 ? ' vc-l--rola' : ''}`} style={{ ['--vc-cor' as any]: cor }} aria-label="Cupons de desconto">
      {lista.map(c => (
        <button key={c.codigo} type="button" className="vc" onClick={() => usar(c)} aria-label={`Usar o cupom ${c.codigo}: ${textoDesconto(c)} ${regraCupom(c)}`}>
          <span className="vc-t"><b>{textoDesconto(c)}</b><small>{regraCupom(c)}</small></span>
          <span className="vc-c"><b>{c.codigo}</b><span className="vc-cp"><Copy size={15} weight="bold" aria-hidden="true" />{um && 'Copiar'}</span></span>
        </button>
      ))}
    </div>
  )
}
