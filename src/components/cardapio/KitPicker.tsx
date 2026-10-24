import { formatCurrency } from '@/utils/helpers'
import { KitQtdConfig, KitSelecao, calcularKit, kitsValidos, kitUnico, palavraKit, precoLivre, proximaQtdLivre, anteriorQtdLivre } from '@/lib/kitQuantidade'
import { comDesconto } from '@/lib/precoCardapio'

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
  const palavra = palavraKit(kit)
  const muitos = c.usados > (kit.max_sabores || 1)

  return (
    <div className="kp">
      {/* (21/10) um tamanho só: o cartão some (a quantidade aparece do lado do preço) */}
      {kit.modo === 'fechado' ? (kitUnico(kit) ? null : (
        <div className="kp-kits" role="radiogroup" aria-label="Tamanho do kit">
          {kits.map(k => (
            <button key={k.id} type="button" role="radio" aria-checked={sel.kitId === k.id}
              className={sel.kitId === k.id ? 'on' : ''} onClick={() => onChange({ ...sel, kitId: k.id })}>
              <b>{k.qtd} un</b>
              {/* (11/10) a mesma conta do botão "Adicionar" */}
              <span>{formatCurrency(comDesconto(k.preco, desconto))}</span>
              {desconto > 0 && <s className="kp-cheio">{formatCurrency(k.preco)}</s>}
            </button>
          ))}
        </div>
      )) : (
        <div className="kp-livre">
          <span>Quantidade</span>
          <div className="kp-stp">
            {/* (11/10) o último passo vai até o máximo (antes o "+" parava antes do "até X" do texto) */}
            <button type="button" aria-label="Diminuir" disabled={anteriorQtdLivre(l, sel.qtdLivre) >= sel.qtdLivre} onClick={() => onChange({ ...sel, qtdLivre: anteriorQtdLivre(l, sel.qtdLivre) })}>−</button>
            <b>{sel.qtdLivre}</b>
            <button type="button" aria-label="Aumentar" disabled={proximaQtdLivre(l, sel.qtdLivre) <= sel.qtdLivre} onClick={() => onChange({ ...sel, qtdLivre: proximaQtdLivre(l, sel.qtdLivre) })}>+</button>
          </div>
          {/* (11/10) com promoção, mostra o preço que o botão cobra (e o cheio riscado) */}
          <em>{desconto > 0 && <s className="kp-cheio">{formatCurrency(precoLivre(kit, sel.qtdLivre))}</s>}{formatCurrency(comDesconto(precoLivre(kit, sel.qtdLivre), desconto))}</em>
        </div>
      )}

      {/* (21/10) as regras dos sabores foram pro título da seção; aqui fica só o kit livre (mínimo e de quanto em quanto) */}
      {kit.modo === 'livre' && <div className="kp-regra">Mínimo <b>{Number(l.min).toLocaleString('pt-BR')}</b>, de {l.passo} em {l.passo}, até {Number(l.max).toLocaleString('pt-BR')}.</div>}

      {/* (21/10) um contador só (antes: regra, "Total do kit" e "Faltam X unidades") */}
      <div className="kp-tot">
        <span>Sabores escolhidos</span>
        <span className={c.completo ? 'ok' : passou ? 'erro' : ''}><b>{c.soma}</b> de {c.alvo} {palavra}</span>
      </div>
      <div className="kp-barra"><i className={c.completo ? 'ok' : passou ? 'erro' : ''} style={{ width: `${pct}%` }} /></div>

      {kit.sabores.filter(s => s.nome.trim()).map(s => {
        const q = sel.qtds[s.id] || 0
        // 10/10: quando falta menos que o passo, o "+" soma só o que falta (kit de 30 com passo 25 travava em 25).
        // O "−" tira primeiro essa sobra e depois volta a descer de passo em passo.
        const falta = c.alvo - c.soma
        const mais = Math.min(passo, falta)
        const menos = q % passo > 0 ? q % passo : Math.min(passo, q)
        const podeMais = falta > 0 && (q > 0 || c.usados < (kit.max_sabores || 1))
        return (
          <div className="kp-sabor" key={s.id}>
            <span className="kp-sab-nome">{s.nome}</span>
            <div className="kp-stp">
              <button type="button" aria-label={`Menos ${s.nome}`} disabled={q <= 0} onClick={() => setQtd(s.id, q - menos)}>−</button>
              <b>{q} un</b>
              {/* (21/10) o botão mostra de quanto ele soma */}
              <button type="button" className="kp-mais" aria-label={`Mais ${mais > 0 ? mais : passo} de ${s.nome}`} disabled={!podeMais} onClick={() => setQtd(s.id, q + mais)}>+{mais > 0 ? mais : passo}</button>
            </div>
          </div>
        )
      })}

      {/* (21/10) o aviso só aparece quando tem algo errado; o que falta vai no botão de baixo */}
      {(passou || muitos) && (
        <p className="kp-status erro">
          {passou ? `Passou ${c.soma - c.alvo} ${palavra}. Tire um pouco de algum sabor` : `Escolha no máximo ${kit.max_sabores} sabores`}
        </p>
      )}

      <style>{`
        .kp { display: flex; flex-direction: column; gap: 8px; font-family: var(--font-base); }
        .kp-kits { display: flex; gap: 8px; flex-wrap: wrap; }
        .kp-kits button { flex: 1; min-width: 110px; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 9px 8px; border: 1.5px solid #EAE3E6; border-radius: var(--ui-raio-p); background: var(--ui-branco); font-family: inherit; cursor: pointer; color: var(--ui-texto); }
        .kp-kits button b { font-size: 14px; } .kp-kits button span { font-size: 12px; color: var(--ui-texto-2); font-weight: 700; }
        .kp-kits button.on { border-color: var(--ui-texto); background: var(--ui-vinho-escuro); color: var(--ui-branco); } .kp-kits button.on span { color: var(--ui-branco); }
        .kp-livre { display: flex; align-items: center; gap: 10px; }
        .kp-livre > span { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); } .kp-livre em { font-style: normal; margin-left: auto; font-weight: 700; color: var(--ui-texto); }
        .kp-regra { background: #FFF5F9; border: 1px solid #F9D1E0; border-radius: var(--ui-raio-p); padding: 9px 11px; font-size: 12.5px; color: var(--ui-cinza-texto); line-height: 1.4; }
        .kp-tot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14px; color: var(--ui-texto-2); margin-top: 2px; white-space: nowrap; }
        .kp-tot b { font-size: 20px; color: var(--ui-texto); }
        .kp-tot .ok, .kp-tot .ok b { color: #16a34a; } .kp-tot .erro, .kp-tot .erro b { color: var(--ui-vermelho); }
        .kp-barra { height: 6px; background: #EFE9EB; border-radius: 3px; overflow: hidden; }
        .kp-barra i { display: block; height: 100%; background: var(--ui-rosa); transition: width .15s; } .kp-barra i.ok { background: #16a34a; } .kp-barra i.erro { background: var(--ui-vermelho); }
        .kp-sabor { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--ui-linha); }
        .kp-sabor > span { font-size: 14px; font-weight: 700; color: var(--ui-texto); }
        .kp-sab-nome { display: inline-flex; align-items: center; gap: 8px; }
        .kp-sab-nome svg { color: var(--ui-rosa); flex-shrink: 0; }
        .kp-kits .kp-cheio { font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
        .kp-kits button.on .kp-cheio { color: rgba(255,255,255,.6); }
        .kp-livre .kp-cheio { margin-right: 6px; font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
        .kp-stp { display: flex; align-items: center; border: 1px solid #EAE3E6; border-radius: 9px; overflow: hidden; background: var(--ui-branco); }
        .kp-stp button { width: 34px; height: 34px; border: none; background: none; font-size: 18px; font-weight: 700; color: var(--ui-rosa-escuro); cursor: pointer; }
        .kp-stp button:last-child { color: #16a34a; } .kp-stp button:disabled { color: #D6CBD0; cursor: default; }
        .kp-stp b { min-width: 48px; text-align: center; font-size: 14px; white-space: nowrap; }
        .kp-stp .kp-mais { width: auto; min-width: 44px; padding: 0 10px; font-size: 14px; }
        .kp-status { font-size: 12.5px; font-weight: 700; color: var(--ui-laranja); margin: 2px 0 0; } .kp-status.ok { color: #16a34a; } .kp-status.erro { color: var(--ui-vermelho); }
      `}</style>
    </div>
  )
}
