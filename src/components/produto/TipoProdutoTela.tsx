import { useState } from "react";
import { Cake, Check, Confetti, Cookie, ForkKnife, IceCream, Info, PencilSimple, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Botao, BotaoIcone } from "@/components/base";

/**
 * Primeira tela do cadastro novo: "Que tipo de produto você quer cadastrar?"
 * Cada tipo já prepara o cadastro (categoria, opções sugeridas, kit pronto).
 * (08/10 · 3.22) No padrão do guia: topo "Novo produto · Passo 1", ícones no lugar dos emojis, rodapé claro igual nos dois tamanhos.
 */
export type TipoProduto = "bolos" | "doces" | "salgados" | "sobremesas" | "kitfesta" | "outros";

export const TIPOS: { id: TipoProduto; img?: string; emoji: string; titulo: string; sub: string; dica: string; bg: [string, string]; cor: string }[] = [
  { id: "bolos", img: "/Sistema/bolocard.png", emoji: "🎂", titulo: "Bolos", sub: "Aniversário, caseiros, naked cake — com tamanhos e recheios", dica: "a categoria Bolos já vem marcada e o cadastro sugere tamanhos, massas e recheios", bg: ["#FCE7F3", "#F9D1E0"], cor: "#9D174D" },
  { id: "doces", img: "/Sistema/brigadeiro.jpeg", emoji: "🍬", titulo: "Doces", sub: "Brigadeiro, beijinho, bombom — em kit ou por unidade", dica: "o cadastro já abre o kit de docinhos (50 e 100 unidades, até 2 sabores). Se vender por unidade, é só desligar o kit", bg: ["#FEF3C7", "#FDE68A"], cor: "#92400E" },
  { id: "salgados", img: "/Sistema/salgados.png", emoji: "🥟", titulo: "Salgados", sub: "Coxinha, risole, kibe — no cento ou no atacado", dica: "o cadastro já abre o kit de salgados (de 100 a 4.000, preço do cento)", bg: ["#FFEDD5", "#FED7AA"], cor: "#9A3412" },
  { id: "sobremesas", img: "/Sistema/pudim.webp", emoji: "🍮", titulo: "Sobremesas", sub: "Pudim, mousse, torta, bolo no pote", dica: "a categoria Sobremesas já vem marcada, pra um produto simples (pote, fatia, unidade)", bg: ["#E0E7FF", "#C7D2FE"], cor: "#3730A3" },
  { id: "kitfesta", img: "/Sistema/kitfesta.webp", emoji: "🎉", titulo: "Kit festa", sub: "Combos de festa com bolo, salgados e doces", dica: "o cadastro já vem com os tamanhos do combo (20, 40, 60 pessoas…), cada um com seu preço. Conte o que vem em cada um na descrição", bg: ["#DCFCE7", "#BBF7D0"], cor: "#166534" },
  { id: "outros", emoji: "✏️", titulo: "Outros", sub: "Cestas, caixas de presente, cookies, cupcakes…", dica: "o cadastro começa em branco — bom pra cestas, caixas de presente, cookies, cupcakes, pães e o que mais você vender", bg: ["#F5F0F2", "#E9E1E5"], cor: "#4B3A42" },
];

/** Ícone de quando a foto do tipo não carrega (no lugar do emoji) */
const ICONE_TIPO: Record<TipoProduto, Icon> = { bolos: Cake, doces: Cookie, salgados: ForkKnife, sobremesas: IceCream, kitfesta: Confetti, outros: PencilSimple };

interface Props { onEscolher: (t: TipoProduto) => void; onFechar: () => void }

export default function TipoProdutoTela({ onEscolher, onFechar }: Props) {
  const [sel, setSel] = useState<TipoProduto | null>(null);
  // Se a foto não carregar, o cartão mostra o ícone
  const [fotoFalhou, setFotoFalhou] = useState<Record<string, boolean>>({});
  const tipo = TIPOS.find(t => t.id === sel);
  return (
    <div className="tpp">
      <div className="tpp-top">
        <span className="tpp-vz" />
        <div className="tpp-tt"><b>Novo produto</b><small>Passo 1 · Tipo</small></div>
        <BotaoIcone rotulo="Fechar" variante="limpo" onClick={onFechar}><X size={20} weight="bold" /></BotaoIcone>
      </div>
      <div className="tpp-barra" aria-hidden="true"><i className="on" /><i /><i /><i /><i /></div>
      <div className="tpp-body">
        <div className="tpp-h">
          <h1>Que tipo de produto é?</h1>
          <p>A gente já prepara o cadastro certinho pra ele.</p>
        </div>
        <div className="tpp-grid" role="radiogroup" aria-label="Tipo de produto">
          {TIPOS.map(t => {
            const Ic = ICONE_TIPO[t.id];
            return (
              <button key={t.id} type="button" role="radio" aria-checked={sel === t.id}
                className={`tpp-card${sel === t.id ? " sel" : ""}`}
                onClick={() => setSel(t.id)} onDoubleClick={() => onEscolher(t.id)}>
                <span className="tpp-img">
                  {t.img && !fotoFalhou[t.id]
                    ? <img src={t.img} alt="" className="tpp-foto" onError={() => setFotoFalhou(f => ({ ...f, [t.id]: true }))} />
                    : <span className="tpp-emo" aria-hidden="true"><Ic size={32} weight="bold" /></span>}
                  {sel === t.id && <i className="tpp-ck" aria-hidden="true"><Check size={16} weight="bold" /></i>}
                </span>
                <span className="tpp-tx">
                  <b>{t.titulo}</b>
                  <small>{t.sub}</small>
                </span>
              </button>
            );
          })}
        </div>
        {tipo && <p className="tpp-dica"><Info size={20} weight="bold" aria-hidden="true" /><span>Com <b>{tipo.titulo}</b>, {tipo.dica}. Dá pra mudar tudo depois.</span></p>}
      </div>
      <div className="tpp-foot">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao disabled={!sel} onClick={() => sel && onEscolher(sel)}>{tipo ? `Continuar com ${tipo.titulo}` : "Escolha um tipo"}</Botao>
      </div>
      <style>{`
        .tpp { display: flex; flex-direction: column; min-height: 0; height: 100%; font-family: var(--font-base); color: var(--ui-texto); }
        .tpp-top { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px; }
        .tpp-vz { width: 44px; flex: none; }
        .tpp-tt { flex: 1; min-width: 0; text-align: center; }
        .tpp-tt b { display: block; font-size: 16px; font-weight: 700; }
        .tpp-tt small { display: block; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .tpp-barra { display: flex; gap: 4px; padding: 0 16px 12px; border-bottom: 1px solid var(--ui-linha); }
        .tpp-barra i { flex: 1; height: 6px; border-radius: 3px; background: var(--ui-borda); }
        .tpp-barra i.on { background: var(--ui-rosa); }
        .tpp-body { flex: 1; overflow-y: auto; padding: 20px 16px 16px; }
        .tpp-h { padding: 0 0 16px; }
        .tpp-h h1 { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.25; color: var(--ui-texto); }
        .tpp-h p { margin: 4px 0 0; font-size: 15px; line-height: 1.45; color: var(--ui-texto-2); }
        .tpp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        .tpp-card { display: flex; flex-direction: column; align-items: stretch; margin: 0; padding: 0; overflow: hidden; border: 1.5px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); font-family: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .tpp-card.sel { border-color: var(--ui-rosa); background: var(--ui-rosa-claro); box-shadow: inset 0 0 0 1px var(--ui-rosa); }
        .tpp-card:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: 2px; }
        .tpp-img { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 16 / 9; overflow: hidden; background: var(--ui-cinza); color: var(--ui-texto-2); }
        .tpp-foto { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .tpp-emo { display: flex; }
        .tpp-ck { position: absolute; top: 8px; right: 8px; z-index: 1; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--ui-rosa); color: #fff; }
        .tpp-tx { display: flex; flex-direction: column; padding: 10px 12px 12px; }
        .tpp-tx b { font-size: 15px; font-weight: 700; color: var(--ui-texto); }
        .tpp-card.sel .tpp-tx b { color: var(--ui-rosa-escuro); }
        .tpp-tx small { margin-top: 2px; font-size: 13px; line-height: 1.35; color: var(--ui-texto-2); }
        .tpp-dica { display: flex; gap: 8px; margin: 16px 0 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-cinza); font-size: 13.5px; line-height: 1.45; color: var(--ui-texto); }
        .tpp-dica svg { flex: none; color: var(--ui-texto-2); }
        .tpp-foot { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.8fr); gap: 8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid var(--ui-borda); background: var(--ui-branco); }
        @media (max-width: 640px) { .tpp-top { padding-top: calc(env(safe-area-inset-top, 0px) + 8px); } }
        @media (min-width: 768px) {
          .tpp-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .tpp-body { padding: 24px; }
          .tpp-foot { padding: 12px 24px 16px; }
        }
      `}</style>
    </div>
  );
}
