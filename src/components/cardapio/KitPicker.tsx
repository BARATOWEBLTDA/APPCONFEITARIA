import { Heart } from '@phosphor-icons/react'
import { formatCurrency } from '@/utils/helpers'
import { KitQtdConfig, KitSelecao, calcularKit, kitsValidos, precoLivre } from '@/lib/kitQuantidade'

/**
 * Cardápio: o cliente monta o kit escolhendo quantos de cada sabor.
 * Controlado de fora (ProductModal guarda a seleção e usa o cálculo pro preço e pro carrinho).
 */
interface Props { kit: KitQtdConfig; sel: KitSelecao; onChange: (s: KitSelecao) => void   /** desconto da promoção (0 a 1) — mostra o preço com desconto nos botões (02/10) */
  desconto?: number
}

export default function KitPicker({ kit, sel, onChange, desconto = 0 }: Props) {
  const c = calcularKit(kit, sel)
  const passo = Math.max(1, kit.passo_sabor || 1)
  const kits = kitsValidos(kit)
  const l = kit.livre
  const pct = c.alvo > 0 ? Math.min(100, (c.soma / c.alvo) * 100) : 0
  const passou = c.soma > c.alvo
  const setQtd = (id: string, v: number) => onChange({ ...sel, qtds: { ...sel.qtds, [id]: Math.max(0, v) } })

  return (
    <div className="kp">
      {kit.modo === 'fechado' ? (
        <div className="kp-kits" role="radiogroup" aria-label="Tamanho do kit">
          {kits.map(k => (
            <button key={k.id} type="button" role="radio" aria-checked={sel.kitId === k.id}
              className={sel.kitId === k.id ? 'on' : ''} onClick={() => onChange({ ...sel, kitId: k.id })}>
              <b>{k.qtd} un</b>
              <span>{formatCurrency(desconto > 0 ? parseFloat((k.preco - parseFloat((k.preco * desconto).toFixed(2))).toFixed(2)) : k.preco)}</span>
              {desconto > 0 && <s className="kp-cheio">{formatCurrency(k.preco)}</s>}
            </button>
          ))}
        </div>
      ) : (
        <div className="kp-livre">
          <span>Quantidade</span>
          <div className="kp-stp">
            <button type="button" aria-label="Diminuir" disabled={sel.qtdLivre - l.passo < l.min} onClick={() => onChange({ ...sel, qtdLivre: sel.qtdLivre - l.passo })}>−</button>
            <b>{sel.qtdLivre}</b>
            <button type="button" aria-label="Aumentar" disabled={sel.qtdLivre + l.passo > l.max} onClick={() => onChange({ ...sel, qtdLivre: sel.qtdLivre + l.passo })}>+</button>
          </div>
          <em>{formatCurrency(precoLivre(kit, sel.qtdLivre))}</em>
        </div>
      )}

      <div className="kp-regra">
        {kit.modo === 'livre' && <>Mínimo <b>{l.min}</b>, de {l.passo} em {l.passo}, até {l.max}. </>}
        Escolha até <b>{kit.max_sabores} sabor{kit.max_sabores === 1 ? '' : 'es'}</b>, de {passo} em {passo}.
      </div>

      <div className="kp-tot">
        <span>Total do kit</span>
        <b className={c.completo ? 'ok' : passou ? 'erro' : ''}>{c.soma} <small>/ {c.alvo} un</small></b>
      </div>
      <div className="kp-barra"><i className={c.completo ? 'ok' : passou ? 'erro' : ''} style={{ width: `${pct}%` }} /></div>

      {kit.sabores.filter(s => s.nome.trim()).map(s => {
        const q = sel.qtds[s.id] || 0
        const podeMais = c.soma + passo <= c.alvo && (q > 0 || c.usados < (kit.max_sabores || 1))
        return (
          <div className="kp-sabor" key={s.id}>
            <span className="kp-sab-nome"><Heart size={16} weight="duotone" aria-hidden="true" />{s.nome}</span>
            <div className="kp-stp">
              <button type="button" aria-label={`Menos ${s.nome}`} disabled={q <= 0} onClick={() => setQtd(s.id, q - passo)}>−</button>
              <b>{q}</b>
              <button type="button" aria-label={`Mais ${s.nome}`} disabled={!podeMais} onClick={() => setQtd(s.id, q + passo)}>+</button>
            </div>
          </div>
        )
      })}

      <p className={`kp-status${c.completo ? ' ok' : passou ? ' erro' : ''}`}>
        {c.completo ? '✓ Kit completo'
          : passou ? `Passou ${c.soma - c.alvo} unidades — tire um pouco de algum sabor`
          : c.usados > (kit.max_sabores || 1) ? `Escolha no máximo ${kit.max_sabores} sabores`
          : `Faltam ${c.restante} unidades`}
      </p>

      <style>{`
        .kp { display: flex; flex-direction: column; gap: 8px; font-family: var(--font-base); }
        .kp-kits { display: flex; gap: 8px; flex-wrap: wrap; }
        .kp-kits button { flex: 1; min-width: 110px; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 9px 8px; border: 1.5px solid #EAE3E6; border-radius: 10px; background: #fff; font-family: inherit; cursor: pointer; color: #2C1219; }
        .kp-kits button b { font-size: 14px; } .kp-kits button span { font-size: 12px; color: #6B5D64; font-weight: 700; }
        .kp-kits button.on { border-color: #2C1219; background: #2C1219; color: #fff; } .kp-kits button.on span { color: #fff; }
        .kp-livre { display: flex; align-items: center; gap: 10px; }
        .kp-livre > span { font-size: 13px; font-weight: 700; color: #6B5D64; } .kp-livre em { font-style: normal; margin-left: auto; font-weight: 700; color: #2C1219; }
        .kp-regra { background: #FFF5F9; border: 1px solid #F9D1E0; border-radius: 10px; padding: 9px 11px; font-size: 12.5px; color: #4B3A42; line-height: 1.4; }
        .kp-tot { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; font-weight: 700; color: #6B5D64; margin-top: 2px; }
        .kp-tot b { font-size: 22px; color: #2C1219; } .kp-tot b small { font-size: 12px; color: #6B5D64; }
        .kp-tot b.ok { color: #16a34a; } .kp-tot b.erro { color: #DC2626; }
        .kp-barra { height: 6px; background: #EFE9EB; border-radius: 3px; overflow: hidden; }
        .kp-barra i { display: block; height: 100%; background: #E85A8C; transition: width .15s; } .kp-barra i.ok { background: #16a34a; } .kp-barra i.erro { background: #DC2626; }
        .kp-sabor { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F5F0F2; }
        .kp-sabor > span { font-size: 14px; font-weight: 700; color: #2C1219; }
        .kp-sab-nome { display: inline-flex; align-items: center; gap: 8px; }
        .kp-sab-nome svg { color: #E85A8C; flex-shrink: 0; }
        .kp-kits .kp-cheio { font-size: 12px; font-weight: 600; color: #9A8E94; }
        .kp-kits button.on .kp-cheio { color: rgba(255,255,255,.6); }
        .kp-stp { display: flex; align-items: center; border: 1px solid #EAE3E6; border-radius: 9px; overflow: hidden; background: #fff; }
        .kp-stp button { width: 34px; height: 34px; border: none; background: none; font-size: 18px; font-weight: 700; color: #C33A6E; cursor: pointer; }
        .kp-stp button:last-child { color: #16a34a; } .kp-stp button:disabled { color: #D6CBD0; cursor: default; }
        .kp-stp b { min-width: 40px; text-align: center; font-size: 14px; }
        .kp-status { font-size: 12.5px; font-weight: 700; color: #B45309; margin: 2px 0 0; } .kp-status.ok { color: #16a34a; } .kp-status.erro { color: #DC2626; }
      `}</style>
    </div>
  )
}
