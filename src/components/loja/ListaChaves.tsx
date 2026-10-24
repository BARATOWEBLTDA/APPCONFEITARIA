import type { ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";

/**
 * (23/10) Lista de opções com chave (liga e desliga), no estilo dos apps de delivery:
 * ícone, nome, uma linha explicando e a chave à direita. Desligada fica cinza.
 * Usada no passo "Pagamento e entrega", nas janelas de Pagamento e Entrega da Minha loja e no Horário.
 */
export type ItemChave = { chave: string; Ic: Icon; rotulo: string; sub?: string; on: boolean; aoTocar: () => void; depois?: ReactNode };

export function Chave({ on }: { on: boolean }) {
  return <span className={`lch-sw${on ? " on" : ""}`} aria-hidden="true"><i /></span>;
}

export default function ListaChaves({ titulo, itens, id }: { titulo?: string; itens: ItemChave[]; id?: string }) {
  return (
    <div className="lch">
      {titulo && <p className="lch-t" id={id}>{titulo}</p>}
      <div className="lch-c" role="group" aria-labelledby={titulo ? id : undefined}>
        {itens.map(it => (
          <div className="lch-it" key={it.chave}>
            <button type="button" role="switch" aria-checked={it.on} className={`lch-l${it.on ? " on" : ""}`} onClick={it.aoTocar}>
              <span className="lch-ic" aria-hidden="true"><it.Ic size={20} weight="bold" /></span>
              <span className="lch-tx"><b>{it.rotulo}</b>{it.sub && <small>{it.sub}</small>}</span>
              <Chave on={it.on} />
            </button>
            {it.on && it.depois && <div className="lch-dep">{it.depois}</div>}
          </div>
        ))}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .lch { font-family: var(--font-base); }
  .lch-t { margin: 18px 2px 8px; font-size: 15px; font-weight: 700; color: var(--ui-texto); }
  .lch-c { overflow: hidden; border: 1px solid var(--ui-borda); border-radius: 14px; background: var(--ui-branco); }
  .lch-it + .lch-it { border-top: 1px solid var(--ui-linha); }
  .lch-l { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 62px; margin: 0; padding: 8px 12px; border: 0; background: none; font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .lch-l:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
  .lch-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: #F3EEF1; color: var(--ui-texto-3); transition: background .2s, color .2s; }
  .lch-l.on .lch-ic { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
  .lch-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .lch-tx b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lch-tx small { font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lch-l:not(.on) .lch-tx small { color: var(--ui-texto-3); }
  .lch-sw { flex: none; position: relative; width: 46px; height: 28px; border-radius: 999px; background: #D9D2D5; transition: background .2s; }
  .lch-sw i { position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: var(--ui-branco); box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: left .2s; }
  .lch-sw.on { background: var(--ui-rosa); }
  .lch-sw.on i { left: 21px; }
  .lch-dep { padding: 0 12px 12px 62px; }
  @media (prefers-reduced-motion: reduce) { .lch-sw, .lch-sw i, .lch-ic { transition: none; } }
`;
