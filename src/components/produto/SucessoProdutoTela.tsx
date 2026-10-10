/**
 * Tela de sucesso depois de publicar um produto novo (aprovada 30/09).
 *  - Primeiro produto: comemoração (confete + 🎉)
 *  - Demais: confirmação sóbria (✓)
 * Próximos passos: Ver no cardápio · Cadastrar outro · Calcular o custo · Fechar
 */
interface Props {
  primeiro: boolean;
  nome: string;
  categoria?: string;
  imagem?: string;
  preco: number;
  aPartir: boolean;
  tipoLabel: string;        // "Bolo", "Doce", "Kit", "Produto"...
  onVerCardapio: () => void;
  onOutro: () => void;
  onCusto: () => void;
  onFechar: () => void;
}

import { Calculator, CaretRight, Check, Package, X } from "@phosphor-icons/react";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CONFETE: [number, number, string, number][] = [[12, 30, "#E85A8C", 20], [25, 10, "#FCD34D", -30], [40, 40, "#86EFAC", 45], [60, 14, "#93C5FD", -15], [75, 36, "#F5B8CD", 60], [88, 12, "#C4B5FD", -40], [18, 70, "#FCD34D", 10], [82, 72, "#E85A8C", -60]];

export default function SucessoProdutoTela(p: Props) {
  const genero = /^(bolo|doce|salgado|kit|produto|combo)/i.test(p.tipoLabel) ? "o" : "a";
  return (
    <div className="spt">
      <div className="spt-top"><span /><button type="button" className="spt-x" onClick={p.onFechar} aria-label="Fechar"><X size={20} weight="bold" /></button></div>
      <div className="spt-body">
        {p.primeiro && (
          <div className="spt-confete" aria-hidden="true">
            {CONFETE.map(([l, t, c, r], i) => <i key={i} style={{ left: `${l}%`, top: t, background: c, transform: `rotate(${r}deg)`, animationDelay: `${i * 0.06}s` }} />)}
          </div>
        )}
        <div className={`spt-ok${p.primeiro ? " spt-ok--festa" : ""}`} aria-hidden="true"><Check size={34} weight="bold" /></div>
        <h1 className="spt-h">{p.primeiro ? <>Seu primeiro produto<br />está no ar!</> : `${p.tipoLabel} publicad${genero}!`}</h1>
        <p className="spt-sub">
          {p.primeiro
            ? <>Agora seus clientes já podem ver e pedir {genero === "o" ? "o" : "a"} <b>{p.nome}</b> pelo cardápio.</>
            : <>{genero === "o" ? "O" : "A"} <b>{p.nome}</b> já está no seu cardápio.</>}
        </p>

        <div className="spt-prev">
          {p.imagem ? <img src={p.imagem} alt="" /> : <span className="spt-prev-sem" aria-hidden="true"><Package size={28} weight="bold" /></span>}
          <div>
            {p.categoria && <small>{p.categoria}</small>}
            <b>{p.nome}</b>
            {p.preco > 0 && <span>{p.aPartir ? "a partir de " : ""}<em>{brl(p.preco)}</em></span>}
          </div>
        </div>

        <div className="spt-acts">
          <button type="button" className="spt-a1" onClick={p.onVerCardapio}>Ver no cardápio</button>
          <button type="button" className="spt-a2" onClick={p.onOutro}>Cadastrar outro produto</button>
          <button type="button" className="spt-ft" onClick={p.onCusto}>
            <span className="spt-ft-ic" aria-hidden="true"><Calculator size={20} weight="bold" /></span>
            <span className="spt-ft-tx"><b>Calcular o custo {genero === "o" ? "desse" : "dessa"} {p.tipoLabel.toLowerCase()}</b>
              <small>{p.primeiro ? "Descubra quanto ele te custa e quanto você lucra" : "Monte a ficha técnica e veja seu lucro real"}</small></span>
            <span className="spt-ft-ar" aria-hidden="true"><CaretRight size={16} weight="bold" /></span>
          </button>
          <button type="button" className="spt-a3" onClick={p.onFechar}>Fechar</button>
        </div>
      </div>
      <style>{`
        .spt { font-family: var(--font-base); color: #2C1219; display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .spt-top { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px 0; }
        .spt-x { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: none; background: #F5F0F2; color: #6B5D64; font-size: 15px; cursor: pointer; }
        .spt-body { flex: 1; overflow-y: auto; padding: 0 22px 24px; text-align: center; position: relative; max-width: 460px; width: 100%; margin: 0 auto; }
        .spt-confete { position: absolute; left: 0; right: 0; top: -20px; height: 110px; pointer-events: none; }
        .spt-confete i { position: absolute; width: 8px; height: 14px; border-radius: 2px; opacity: 0; animation: spt-cai .9s ease-out forwards; }
        @keyframes spt-cai { from { opacity: 0; translate: 0 -24px; } to { opacity: .9; translate: 0 0; } }
        .spt-ok { width: 72px; height: 72px; border-radius: 50%; background: #DCFCE7; color: #15803D; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 700; margin: 18px auto 16px; box-shadow: 0 0 0 10px #F0FDF4; animation: spt-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
        .spt-ok--festa { background: #FCE7F3; color: #C33A6E; box-shadow: 0 0 0 10px #FFF1F6; margin-top: 30px; }
        @keyframes spt-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spt-h { font-size: 23px; font-weight: 700; line-height: 1.2; margin: 0; color: #2C1219; }
        .spt-sub { font-size: 14px; color: #6B5D64; line-height: 1.5; margin: 8px auto 0; max-width: 300px; }
        .spt-sub b { color: #2C1219; }
        .spt-prev { display: flex; gap: 12px; align-items: center; text-align: left; border: 1px solid #F0EBED; border-radius: 14px; padding: 10px; margin: 22px 0 18px; box-shadow: 0 6px 18px rgba(60,20,35,.06); }
        .spt-prev img, .spt-prev-sem { width: 68px; height: 68px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .spt-prev-sem { background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; }
        .spt-prev small { display: block; font-size: 12.5px; font-weight: 700; color: #6B5D64; }
        .spt-prev b { display: block; font-size: 14.5px; margin: 2px 0 3px; }
        .spt-prev span { font-size: 13px; color: #6B5D64; } .spt-prev em { font-style: normal; font-weight: 700; color: #2C1219; }
        .spt-acts { display: flex; flex-direction: column; gap: 8px; }
        .spt-a1 { min-height: 48px; border: none; background: #E85A8C; color: #fff; font-family: inherit; font-weight: 700; font-size: 15px; border-radius: 13px; padding: 0 14px; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; }
        .spt-a1:active { transform: translateY(2px); box-shadow: 0 1px 0 #C33A6E; }
        .spt-a2 { min-height: 48px; border: 0; background: #F3EEF1; color: #2C1219; font-family: inherit; font-weight: 700; font-size: 15px; border-radius: 13px; padding: 0 13px; cursor: pointer; }
        .spt-ft { display: flex; align-items: center; gap: 12px; text-align: left; background: #FAF7F8; border: none; border-radius: 12px; padding: 12px; margin-top: 4px; font-family: inherit; cursor: pointer; color: #2C1219; }
        .spt-ft-ic { width: 40px; height: 40px; border-radius: 12px; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .spt-ft-tx { flex: 1; min-width: 0; } .spt-ft-tx b { display: block; font-size: 15px; } .spt-ft-tx small { display: block; font-size: 13px; color: #6B5D64; margin-top: 2px; line-height: 1.4; }
        .spt-ft-ar { color: #9A8E94; display: flex; }
        .spt-a3 { min-height: 44px; border: none; background: none; font-family: inherit; font-size: 15px; font-weight: 700; color: #6B5D64; padding: 0 10px; cursor: pointer; }
      `}</style>
    </div>
  );
}
