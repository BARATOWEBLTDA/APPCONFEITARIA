import type { Icon } from "@phosphor-icons/react";

/** (20/11) Dois quadrados lado a lado, no padrão da Nova venda: ícone na caixinha, bolinha de escolha, título e uma linha. */
export default function Quadrados({ rotulo, valor, opcoes, onMudar }: { rotulo: string; valor: string; opcoes: { v: string; t: string; sub: string; Ic: Icon }[]; onMudar: (v: string) => void }) {
  return (
    <div className="esc-quad" role="radiogroup" aria-label={rotulo}>
      {opcoes.map(o => {
        const on = valor === o.v;
        return (
          <button key={o.v} type="button" role="radio" aria-checked={on} className={on ? "on" : undefined} onClick={() => { if (!on) onMudar(o.v); }}>
            <span className="esc-quad-topo"><span className="esc-quad-ic" aria-hidden="true"><o.Ic size={20} weight={on ? "fill" : "regular"} /></span><i aria-hidden="true" /></span>
            <b>{o.t}</b><small>{o.sub}</small>
          </button>
        );
      })}
    </div>
  );
}
