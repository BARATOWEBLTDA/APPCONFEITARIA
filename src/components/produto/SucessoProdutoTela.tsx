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
  /** (14/10) loja toda configurada (primeiros passos completos): só então mostra "Ver no cardápio" */
  lojaPronta?: boolean | null;
  onTerminarLoja?: () => void;
  onOutro: () => void;
  onCusto: () => void;
  onFechar: () => void;
}

import { useEffect } from "react";
import { Calculator, CaretRight, Check, Package, X } from "@phosphor-icons/react";
import { tocarSom } from "@/hooks/useSom";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CONFETE: [number, number, string, number][] = [[12, 30, "#E85A8C", 20], [25, 10, "#FCD34D", -30], [40, 40, "#86EFAC", 45], [60, 14, "#93C5FD", -15], [75, 36, "#F5B8CD", 60], [88, 12, "#C4B5FD", -40], [18, 70, "#FCD34D", 10], [82, 72, "#E85A8C", -60]];

export default function SucessoProdutoTela(p: Props) {
  useEffect(() => { tocarSom("sucesso"); }, []); // (14/10) som de sucesso (respeita os sons desligados)
  return (
    <div className="spt">
      {/* (14/10) header rosa no padrão do cadastro; a tela inteira fica rosa */}
      <div className="spt-cab">
        <span className="spt-cab-ic" aria-hidden="true"><Check size={22} weight="bold" /></span>
        <div className="spt-cab-tx"><b>{p.primeiro ? "Primeiro produto" : "Produto publicado"}</b><small>Cadastro concluído</small></div>
        <button type="button" className="spt-x" onClick={p.onFechar} aria-label="Fechar"><X size={22} weight="bold" /></button>
      </div>
      <div className="spt-body">
        {p.primeiro && (
          <div className="spt-confete" aria-hidden="true">
            {CONFETE.map(([l, t, c, r], i) => <i key={i} style={{ left: `${l}%`, top: t, background: c, transform: `rotate(${r}deg)`, animationDelay: `${i * 0.06}s` }} />)}
          </div>
        )}
        <div className={`spt-ok${p.primeiro ? " spt-ok--festa" : ""}`} aria-hidden="true"><Check size={34} weight="bold" /></div>
        {/* (14/10) sem artigo antes do nome ("A Pudim" saía errado) e sem dizer "no cardápio" quando a loja ainda não abriu */}
        <h1 className="spt-h">{p.primeiro ? <>Seu primeiro produto<br />está pronto!</> : "Tudo certo!"}</h1>
        <p className="spt-sub">
          {p.lojaPronta === false
            ? <><b>{p.nome}</b> foi cadastrado. Termine de abrir o cardápio pra os clientes verem.</>
            : <><b>{p.nome}</b> já aparece no seu cardápio.</>}
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
          {p.lojaPronta !== false
            ? <button type="button" className="spt-a1" onClick={p.onVerCardapio}>Ver no cardápio</button>
            : <button type="button" className="spt-a1" onClick={p.onTerminarLoja}>Terminar de abrir o cardápio</button>}
          <button type="button" className="spt-a2" onClick={p.onOutro}>Cadastrar outro produto</button>
          <button type="button" className="spt-ft" onClick={p.onCusto}>
            <span className="spt-ft-ic" aria-hidden="true"><Calculator size={20} weight="bold" /></span>
            <span className="spt-ft-tx"><b>Calcular o custo</b>
              <small>Monte a ficha técnica e veja o lucro</small></span>
            <span className="spt-ft-ar" aria-hidden="true"><CaretRight size={16} weight="bold" /></span>
          </button>
          <button type="button" className="spt-a3" onClick={p.onFechar}>Fechar</button>
        </div>
      </div>
      <style>{`
        .spt { font-family: var(--font-base); color: var(--ui-texto); display: flex; flex-direction: column; height: 100%; min-height: 0; }
        .spt-top { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px 0; }
        .spt-x { width: 44px; height: 44px; border-radius: var(--ui-raio); display: flex; align-items: center; justify-content: center; border: none; background: var(--ui-linha); color: var(--ui-texto-2); font-size: 15px; cursor: pointer; }
        .spt-body { flex: 1; overflow-y: auto; padding: 0 22px 24px; text-align: center; position: relative; max-width: 460px; width: 100%; margin: 0 auto; }
        .spt-confete { position: absolute; left: 0; right: 0; top: -20px; height: 110px; pointer-events: none; }
        .spt-confete i { position: absolute; width: 8px; height: 14px; border-radius: 2px; opacity: 0; animation: spt-cai .9s ease-out forwards; }
        @keyframes spt-cai { from { opacity: 0; translate: 0 -24px; } to { opacity: .9; translate: 0 0; } }
        .spt-ok { width: 72px; height: 72px; border-radius: 50%; background: var(--ui-verde-fundo); color: var(--ui-verde); display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 700; margin: 18px auto 16px; box-shadow: 0 0 0 10px #F0FDF4; animation: spt-pop .45s cubic-bezier(.2,1.4,.4,1) both; }
        .spt-ok--festa { background: #FCE7F3; color: var(--ui-rosa-escuro); box-shadow: 0 0 0 10px #FFF1F6; margin-top: 30px; }
        @keyframes spt-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spt-h { font-size: 23px; font-weight: 700; line-height: 1.2; margin: 0; color: var(--ui-texto); }
        .spt-sub { font-size: 14px; color: var(--ui-texto-2); line-height: 1.5; margin: 8px auto 0; max-width: 300px; }
        .spt-sub b { color: var(--ui-texto); }
        .spt-prev { display: flex; gap: 12px; align-items: center; text-align: left; border: 1px solid #F0EBED; border-radius: 14px; padding: 10px; margin: 22px 0 18px; box-shadow: 0 6px 18px rgba(60,20,35,.06); }
        .spt-prev img, .spt-prev-sem { width: 68px; height: 68px; border-radius: var(--ui-raio-p); object-fit: cover; flex-shrink: 0; }
        .spt-prev-sem { background: #FCE7F3; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; }
        .spt-prev small { display: block; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); }
        .spt-prev b { display: block; font-size: 14.5px; margin: 2px 0 3px; }
        .spt-prev span { font-size: 13px; color: var(--ui-texto-2); } .spt-prev em { font-style: normal; font-weight: 700; color: var(--ui-texto); }
        .spt-acts { display: flex; flex-direction: column; gap: 8px; }
        .spt-a1 { min-height: 48px; border: none; background: var(--ui-rosa); color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 15px; border-radius: var(--ui-raio-botao); padding: 0 14px; box-shadow: 0 3px 0 var(--ui-rosa-escuro); cursor: pointer; }
        .spt-a1:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--ui-rosa-escuro); }
        .spt-a2 { min-height: 48px; border: 0; background: var(--ui-cinza); color: var(--ui-texto); font-family: inherit; font-weight: 700; font-size: 15px; border-radius: var(--ui-raio-botao); padding: 0 13px; cursor: pointer; }
        .spt-ft { display: flex; align-items: center; gap: 12px; text-align: left; background: #FAF7F8; border: none; border-radius: var(--ui-raio); padding: 12px; margin-top: 4px; font-family: inherit; cursor: pointer; color: var(--ui-texto); }
        .spt-ft-ic { width: 40px; height: 40px; border-radius: var(--ui-raio); background: #FCE7F3; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .spt-ft-tx { flex: 1; min-width: 0; } .spt-ft-tx b { display: block; font-size: 15px; } .spt-ft-tx small { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 2px; line-height: 1.4; }
        .spt-ft-ar { color: var(--ui-texto-3); display: flex; }
        .spt-a3 { min-height: 44px; border: none; background: none; font-family: inherit; font-size: 15px; font-weight: 700; color: var(--ui-texto-2); padding: 0 10px; cursor: pointer; }
        /* (14/10) tela toda rosa com header */
        .spt { background: var(--ui-rosa); color: #fff; }
        .spt-cab { display: flex; align-items: center; gap: 10px; min-height: 76px; padding: calc(env(safe-area-inset-top, 0px) + 14px) 8px 14px 16px; border-bottom: 1px solid rgba(255,255,255,.22); }
        .spt-cab-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 2px solid rgba(255,255,255,.6); border-radius: 50%; background: #fff; color: var(--ui-rosa-escuro); }
        .spt-cab-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; text-align: left; }
        .spt-cab-tx b { font-size: 20px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spt-cab-tx small { font-size: 13px; font-weight: 500; color: rgba(255,255,255,.92); }
        .spt-x { width: 40px; height: 40px; background: none; color: #fff; }
        .spt-ok, .spt-ok--festa { background: #fff; color: var(--ui-rosa-escuro); box-shadow: 0 0 0 10px rgba(255,255,255,.22); }
        .spt-h { color: #fff; }
        .spt-sub, .spt-sub b { color: rgba(255,255,255,.95); }
        .spt-prev { background: #fff; border: 0; color: var(--ui-texto); box-shadow: 0 8px 24px rgba(60,20,35,.18); }
        .spt-a1 { background: #fff; color: var(--ui-rosa-escuro); box-shadow: 0 3px 0 rgba(120,20,60,.35); }
        .spt-a1:active { box-shadow: 0 1px 0 rgba(120,20,60,.35); }
        .spt-a2 { background: rgba(255,255,255,.18); color: #fff; border: 1.5px solid rgba(255,255,255,.55); }
        .spt-ft { background: rgba(255,255,255,.14); color: #fff; }
        .spt-ft-ic { background: #fff; }
        .spt-ft-tx b, .spt-ft-tx small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spt-ft-tx small, .spt-ft-ar { color: rgba(255,255,255,.88); }
        .spt-a3 { color: #fff; }
      `}</style>
    </div>
  );
}
