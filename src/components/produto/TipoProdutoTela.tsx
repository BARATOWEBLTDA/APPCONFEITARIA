import { useState } from "react";

/**
 * Primeira tela do cadastro novo: "Que tipo de produto você quer cadastrar?"
 * Cada tipo já prepara o cadastro (categoria, opções sugeridas, kit pronto).
 */
export type TipoProduto = "bolos" | "doces" | "salgados" | "sobremesas" | "outros";

export const TIPOS: { id: TipoProduto; emoji: string; titulo: string; sub: string; dica: string; bg: [string, string]; cor: string }[] = [
  { id: "bolos", emoji: "🎂", titulo: "Bolos", sub: "Tamanhos, massas e recheios", dica: "a categoria Bolos já vem marcada e o cadastro sugere tamanhos, massas e recheios", bg: ["#FCE7F3", "#F9D1E0"], cor: "#9D174D" },
  { id: "doces", emoji: "🍬", titulo: "Doces", sub: "Docinhos em kit ou por unidade", dica: "o cadastro já abre o kit de docinhos (50 e 100 unidades, até 2 sabores). Se vender por unidade, é só desligar o kit", bg: ["#FEF3C7", "#FDE68A"], cor: "#92400E" },
  { id: "salgados", emoji: "🥟", titulo: "Salgados", sub: "Cento, kits e atacado", dica: "o cadastro já abre o kit de salgados (de 100 a 4.000, preço do cento)", bg: ["#FFEDD5", "#FED7AA"], cor: "#9A3412" },
  { id: "sobremesas", emoji: "🍮", titulo: "Sobremesas", sub: "Potes, fatias, tortas", dica: "a categoria Sobremesas já vem marcada, pra um produto simples (pote, fatia, unidade)", bg: ["#E0E7FF", "#C7D2FE"], cor: "#3730A3" },
  { id: "outros", emoji: "✏️", titulo: "Outros", sub: "Monte do seu jeito", dica: "o cadastro começa em branco, do seu jeito", bg: ["#F5F0F2", "#E9E1E5"], cor: "#4B3A42" },
];

interface Props { onEscolher: (t: TipoProduto) => void; onFechar: () => void }

export default function TipoProdutoTela({ onEscolher, onFechar }: Props) {
  const [sel, setSel] = useState<TipoProduto | null>(null);
  const tipo = TIPOS.find(t => t.id === sel);
  return (
    <div className="tpp">
      <div className="tpp-top">
        <span />
        <div className="tpp-steps" aria-hidden="true"><i className="on" /><i /><i /><i /><i /></div>
        <button type="button" className="tpp-x" onClick={onFechar} aria-label="Fechar">✕</button>
      </div>
      <div className="tpp-body">
        <div className="tpp-h">
          <h1>Que tipo de produto você quer cadastrar?</h1>
          <p>A gente já prepara o cadastro certinho pra ele.</p>
        </div>
        <div className="tpp-grid" role="radiogroup" aria-label="Tipo de produto">
          {TIPOS.map(t => (
            <button key={t.id} type="button" role="radio" aria-checked={sel === t.id}
              className={`tpp-card${sel === t.id ? " sel" : ""}${t.id === "outros" ? " tpp-card--outros" : ""}`}
              onClick={() => setSel(t.id)} onDoubleClick={() => onEscolher(t.id)}>
              <span className="tpp-img" style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})` }}>
                <span className="tpp-emo" aria-hidden="true">{t.emoji}</span>
                {sel === t.id && <i className="tpp-ck" aria-hidden="true">✓</i>}
              </span>
              <span className="tpp-tx">
                <b style={sel === t.id ? { color: t.cor } : undefined}>{t.titulo}</b>
                <small>{t.sub}</small>
              </span>
            </button>
          ))}
        </div>
        {tipo && <p className="tpp-dica">💡 Escolhendo <b>{tipo.titulo}</b>, {tipo.dica}. Dá pra mudar tudo depois.</p>}
      </div>
      <div className="tpp-foot">
        <button type="button" className="tpp-cancel" onClick={onFechar}>Cancelar</button>
        <button type="button" className="tpp-go" disabled={!sel} onClick={() => sel && onEscolher(sel)}>
          {tipo ? `Continuar com ${tipo.titulo}` : "Escolha um tipo"} →
        </button>
      </div>
      <style>{`
        .tpp { display: flex; flex-direction: column; min-height: 0; height: 100%; font-family: var(--font-base); color: #2C1219; }
        .tpp-top { display: flex; justify-content: space-between; align-items: center; padding: 16px 22px 0; }
        .tpp-top > span { width: 36px; }
        .tpp-steps { display: flex; gap: 6px; } .tpp-steps i { width: 26px; height: 4px; border-radius: 2px; background: #EDE5E8; } .tpp-steps i.on { background: #E85A8C; }
        .tpp-x { width: 36px; height: 36px; border-radius: 50%; border: none; background: #F5F0F2; color: #6B5D64; font-size: 15px; cursor: pointer; }
        .tpp-body { flex: 1; overflow-y: auto; padding: 0 22px 16px; }
        .tpp-h { text-align: center; padding: 16px 0 6px; }
        .tpp-h h1 { font-size: 23px; font-weight: 900; letter-spacing: -.01em; margin: 0; line-height: 1.2; }
        .tpp-h p { font-size: 14px; color: #6B5D64; margin: 5px 0 0; }
        .tpp-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; padding-top: 16px; }
        .tpp-card { border: 1.5px solid #EDE5E8; border-radius: 18px; overflow: hidden; background: #fff; cursor: pointer; padding: 0; text-align: left; font-family: inherit; display: flex; flex-direction: column; transition: transform .15s, box-shadow .15s; }
        .tpp-card:hover { border-color: #E5C7D3; }
        .tpp-card.sel { border-color: #E85A8C; box-shadow: 0 10px 26px rgba(232,90,140,.2); transform: translateY(-2px); }
        .tpp-img { height: 128px; display: flex; align-items: center; justify-content: center; position: relative; }
        .tpp-emo { font-size: 56px; filter: drop-shadow(0 6px 10px rgba(0,0,0,.12)); }
        .tpp-ck { position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%; background: #E85A8C; color: #fff; font-style: normal; font-weight: 900; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .tpp-tx { padding: 10px 12px 13px; display: flex; flex-direction: column; }
        .tpp-tx b { font-size: 15.5px; font-weight: 900; color: #2C1219; }
        .tpp-tx small { font-size: 12px; color: #888780; margin-top: 2px; line-height: 1.35; }
        .tpp-dica { margin: 16px 0 0; background: #FAF7F8; border-radius: 12px; padding: 10px 14px; font-size: 13px; color: #4B3A42; line-height: 1.45; }
        .tpp-foot { display: flex; align-items: center; gap: 12px; padding: 14px 22px; border-top: 1px solid #F3ECEE; background: #fff; }
        .tpp-cancel { border: none; background: none; font-family: inherit; font-weight: 700; font-size: 14px; color: #2C1219; padding: 0 12px; cursor: pointer; }
        .tpp-go { flex: 1; height: 48px; border: none; border-radius: 12px; background: #E85A8C; color: #fff; font-family: inherit; font-weight: 800; font-size: 14.5px; cursor: pointer; }
        .tpp-go:disabled { background: #F6D4E1; cursor: default; }
        @media (max-width: 767px) {
          .tpp-top { padding: calc(env(safe-area-inset-top, 0px) + 14px) 14px 0; }
          .tpp-body { padding: 0 14px 16px; }
          .tpp-h h1 { font-size: 20px; } .tpp-h p { font-size: 12.5px; }
          .tpp-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .tpp-img { height: 96px; } .tpp-emo { font-size: 42px; }
          .tpp-tx { padding: 8px 10px 10px; } .tpp-tx b { font-size: 14px; } .tpp-tx small { font-size: 11px; }
          .tpp-card--outros { grid-column: 1 / -1; flex-direction: row; align-items: center; }
          .tpp-card--outros .tpp-img { width: 90px; height: 64px; flex-shrink: 0; } .tpp-card--outros .tpp-emo { font-size: 30px; }
          .tpp-foot { background: #3B1620; border-top: none; padding: 14px 14px calc(14px + env(safe-area-inset-bottom, 0px)); }
          .tpp-cancel { color: #fff; } .tpp-go { flex: 0 0 auto; padding: 0 26px; background: #fff; color: #2C1219; }
          .tpp-go:disabled { background: rgba(255,255,255,.35); color: #fff; }
        }
      `}</style>
    </div>
  );
}
