import type { ReactNode } from "react";

/**
 * (09/11) Estado vazio grande com o Doo — o mesmo de Produtos ("Vamos começar · Cadastre seu primeiro produto").
 * Celular: o Doo em cima e o texto centralizado. Computador: texto à esquerda e o Doo à direita, no meio da tela.
 */
export default function HeroVazio({ etiqueta, titulo, texto, botao, aoClicar, imagem = "/Sistema/produtos-vazio.webp" }: {
  etiqueta: string; titulo: ReactNode; texto: string; botao: string; aoClicar: () => void; imagem?: string;
}) {
  return (
    <div className="hv">
      <div className="hv-tx">
        <span className="hv-et">{etiqueta}</span>
        <h1 className="hv-t">{titulo}</h1>
        <p className="hv-d">{texto}</p>
        <div className="hv-ac">
          <button type="button" className="hv-bt" onClick={aoClicar}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            {botao}
          </button>
        </div>
      </div>
      <div className="hv-masc" aria-hidden="true"><img src={imagem} alt="" width={200} height={200} /></div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .hv { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-6) var(--space-4); }
  .hv-tx { display: flex; flex-direction: column; gap: var(--space-3); order: 2; text-align: center; align-items: center; }
  .hv-masc { order: 1; align-self: center; }
  .hv-masc img { width: auto; height: 170px; max-width: 220px; object-fit: contain; display: block; margin: 0 auto; } /* mesma altura do Doo em todas as telas */
  .hv-et { font-size: var(--text-sm); font-weight: var(--fw-black); color: #B02C5F; line-height: 1; }
  .hv-t { font-size: 2rem; font-weight: var(--fw-black); letter-spacing: -0.03em; line-height: 1.1; color: var(--text-title); margin: var(--space-1) 0 0; }
  .hv-d { font-size: var(--text-md); color: var(--text-secondary); line-height: 1.55; margin: var(--space-2) 0 0; max-width: 480px; }
  .hv-ac { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3); justify-content: center; }
  .hv-bt { display: inline-flex; align-items: center; gap: var(--space-2); background: var(--ui-rosa-botao, #CC2E66); color: var(--text-inverse); border: none; padding: var(--space-4) var(--space-6); border-radius: var(--radius-md); font-size: var(--text-md); font-weight: 600; cursor: pointer; font-family: var(--font-base) !important; box-shadow: none; transition: background-color var(--dur-fast) linear; white-space: nowrap; } /* (09/11) chapado, igual ao Começar dos Primeiros passos */
  .hv-bt:hover, .hv-bt:active { background: var(--ui-rosa-botao-sombra, #A51E50); }
  @media (min-width: 900px) {
    .hv { min-height: calc(100dvh - 170px); flex-direction: row; align-items: center; justify-content: center; gap: var(--space-6); padding: 0 var(--space-4); }
    .hv-tx { order: 1; gap: var(--space-4); flex: 1.3 1 440px; max-width: 560px; min-width: 0; text-align: left; align-items: flex-start; }
    .hv-masc { order: 2; flex: 0 0 220px; width: 220px; }
    .hv-masc img { height: 200px; }
    .hv-et { font-size: var(--text-sm); }
    .hv-t { font-size: 2.5rem; line-height: 1.05; }
    .hv-d { font-size: var(--text-lg); }
    .hv-ac { justify-content: flex-start; }
  }
`;
