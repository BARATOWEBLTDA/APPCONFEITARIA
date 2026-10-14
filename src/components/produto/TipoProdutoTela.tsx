import { useState } from "react";
import { Cake, Check, Confetti, Cookie, ForkKnife, IceCream, Info, PencilSimple, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import "./escolhas.css";

/**
 * Primeira tela do cadastro novo: "Que tipo de produto você quer cadastrar?"
 * Cada tipo já prepara o cadastro (categoria, opções sugeridas, kit pronto).
 * (08/10 · 3.22) No padrão do guia: topo "Novo produto · Passo 1", ícones no lugar dos emojis, rodapé claro igual nos dois tamanhos.
 */
export type TipoProduto = "bolos" | "doces" | "salgados" | "sobremesas" | "kitfesta" | "outros";

export const TIPOS: { id: TipoProduto; img?: string; emoji: string; titulo: string; sub: string; curto: string; dica: string; bg: [string, string]; cor: string }[] = [
  { id: "bolos", curto: "Aniversário, caseiro, naked cake", img: "/Sistema/bolocard.png", emoji: "🎂", titulo: "Bolos", sub: "Aniversário, caseiros, naked cake — com tamanhos e recheios", dica: "a categoria Bolos já vem marcada e o cadastro sugere tamanhos, massas e recheios", bg: ["#FCE7F3", "#F9D1E0"], cor: "#9D174D" },
  { id: "doces", curto: "Brigadeiro, beijinho, bombom", img: "/Sistema/brigadeiro.jpeg", emoji: "🍬", titulo: "Doces", sub: "Brigadeiro, beijinho, bombom — em kit ou por unidade", dica: "o cadastro sugere quantidades (50, 100 unidades) e sabores. Se vender por unidade, é só não marcar nada", bg: ["#FEF3C7", "#FDE68A"], cor: "#92400E" },
  { id: "salgados", curto: "Coxinha, risole, kibe", img: "/Sistema/salgados.png", emoji: "🥟", titulo: "Salgados", sub: "Coxinha, risole, kibe — no cento ou no atacado", dica: "o cadastro sugere as quantidades (de 100 a 4.000, preço do cento) e os sabores", bg: ["#FFEDD5", "#FED7AA"], cor: "#9A3412" },
  { id: "sobremesas", curto: "Pudim, mousse, torta, pote", img: "/Sistema/pudim.webp", emoji: "🍮", titulo: "Sobremesas", sub: "Pudim, mousse, torta, bolo no pote", dica: "a categoria Sobremesas já vem marcada, pra um produto simples (pote, fatia, unidade)", bg: ["#E0E7FF", "#C7D2FE"], cor: "#3730A3" },
  { id: "kitfesta", curto: "Combo de bolo, doces e salgados", img: "/Sistema/kitfesta.webp", emoji: "🎉", titulo: "Kit festa", sub: "Combos de festa com bolo, salgados e doces", dica: "o cadastro sugere os tamanhos do combo (20, 40, 60 pessoas…), cada um com seu preço. Conte o que vem em cada um na descrição", bg: ["#DCFCE7", "#BBF7D0"], cor: "#166534" },
  { id: "outros", curto: "Cestas, cookies, cupcakes…", emoji: "✏️", titulo: "Outros", sub: "Cestas, caixas de presente, cookies, cupcakes…", dica: "o cadastro começa em branco — bom pra cestas, caixas de presente, cookies, cupcakes, pães e o que mais você vender", bg: ["#F5F0F2", "#E9E1E5"], cor: "#4B3A42" },
];

/** Ícone de quando a foto do tipo não carrega (no lugar do emoji) */
const ICONE_TIPO: Record<TipoProduto, Icon> = { bolos: Cake, doces: Cookie, salgados: ForkKnife, sobremesas: IceCream, kitfesta: Confetti, outros: PencilSimple };

interface Props { onEscolher: (t: TipoProduto) => void; onFechar: () => void }

export default function TipoProdutoTela({ onEscolher, onFechar }: Props) {
  const [sel, setSel] = useState<TipoProduto | null>(null);
  // Se a foto não carregar, o cartão mostra o ícone
  const [fotoFalhou, setFotoFalhou] = useState<Record<string, boolean>>({});
  const tipo = TIPOS.find(t => t.id === sel);
  // (13/10) mesmo topo, mesma barra e mesmo rodapé dos outros passos; tipos em lista (foto pequena + nome + uma linha)
  return (
    <>
      <div className="prod-modal-header-novo">
        <div style={{ width: 44, flex: "none" }} />
        <div className="prod-modal-title-wrap">
          <div className="prod-modal-title-novo">Novo produto</div>
          <div className="prod-wiz-passo">Passo 1 de 5 · Tipo</div>
          <div className="prod-wiz-barra" aria-hidden="true"><i style={{ width: "20%" }} /></div>
        </div>
        <button className="prod-modal-close-novo" onClick={onFechar} aria-label="Fechar"><X size={20} weight="bold" aria-hidden="true" /></button>
      </div>
      <div className="prod-modal-body">
        <div className="esc tpp">
          <h2 className="esc-h">Que tipo de produto é?</h2>
          <p className="esc-s">A gente já prepara o cadastro certinho pra ele.</p>
          <div className="tpp-lista" role="radiogroup" aria-label="Tipo de produto">
            {TIPOS.map(t => {
              const Ic = ICONE_TIPO[t.id];
              const on = sel === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on}
                  className={`tpp-linha${on ? " sel" : ""}`}
                  onClick={() => setSel(t.id)} onDoubleClick={() => onEscolher(t.id)}>
                  <span className="tpp-img">
                    {t.img && !fotoFalhou[t.id]
                      ? <img src={t.img} alt="" onError={() => setFotoFalhou(f => ({ ...f, [t.id]: true }))} />
                      : <Ic size={24} aria-hidden="true" />}
                  </span>
                  <span className="esc-tx"><b>{t.titulo}</b><small>{t.curto}</small></span>
                  <i className="tpp-radio" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                </button>
              );
            })}
          </div>
          {tipo && <p className="tpp-dica"><Info size={18} aria-hidden="true" /><span>Com <b>{tipo.titulo}</b>, {tipo.dica}. Dá pra mudar tudo depois.</span></p>}
        </div>
      </div>
      <div className="prod-modal-footer prod-modal-footer--novo">
        <button className="prod-btn-cancelar-novo" onClick={onFechar}>Cancelar</button>
        <button className="prod-btn-avancar-novo" disabled={!sel} onClick={() => sel && onEscolher(sel)}>Continuar</button>
      </div>
      <style>{`
        .tpp-lista { display: flex; flex-direction: column; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco); overflow: hidden; }
        .tpp-linha { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 72px; margin: 0; padding: 10px 14px 10px 10px; border: 0; background: none; font-family: inherit; text-align: left; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; box-shadow: inset 3px 0 0 transparent; transition: background .12s, box-shadow .12s; }
        .tpp-linha + .tpp-linha { border-top: 1px solid var(--ui-linha); }
        .tpp-linha.sel { background: #FFF6F9; box-shadow: inset 3px 0 0 var(--ui-rosa); }
        .tpp-linha.sel .esc-tx b { color: var(--ui-rosa-escuro); }
        @media (hover: hover) and (pointer: fine) { .tpp-linha:hover:not(.sel) { background: #FCFAFB; } }
        .tpp-linha:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
        .tpp-img { flex: none; display: flex; align-items: center; justify-content: center; width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: var(--ui-cinza); color: var(--ui-texto-2); }
        .tpp-img img { width: 100%; height: 100%; object-fit: cover; }
        .tpp-radio { flex: none; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border: 2px solid #D6CBD0; border-radius: 6px; color: var(--ui-branco); }
        .tpp-linha.sel .tpp-radio { border-color: var(--ui-rosa); background: var(--ui-rosa); }
        .tpp-dica { display: flex; gap: 8px; margin: 12px 0 0; padding: 12px; border-radius: 8px; background: var(--ui-cinza); font-size: 13px; line-height: 1.45; color: var(--ui-texto); }
        .tpp-dica svg { flex: none; margin-top: 1px; color: var(--ui-texto-2); }
        .tpp-dica b { font-weight: 600; }
      `}</style>
    </>
  );
}
