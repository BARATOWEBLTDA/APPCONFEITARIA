import { useState } from "react";
import { KIT_VAZIO, KitQtdConfig, erroKit, novoId } from "@/lib/kitQuantidade";

/**
 * Cartão "Kit por quantidade" na etapa "Vamos montar as opções" do cadastro.
 * Mesma lógica pra docinhos, salgados, bombons: muda só a lista de sabores.
 */
interface Props {
  kit?: KitQtdConfig | null;
  onChange: (k: KitQtdConfig) => void;
  /** Celular: "checklist" mostra só o cartão com o botão de ligar */
  mobileMode?: "checklist" | "fill";
}

const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; };

export default function KitQuantidadeEditor({ kit, onChange, mobileMode }: Props) {
  const k: KitQtdConfig = { ...KIT_VAZIO, ...(kit || {}), livre: { ...KIT_VAZIO.livre, ...(kit?.livre || {}) } };
  const [novoSabor, setNovoSabor] = useState("");
  const set = (patch: Partial<KitQtdConfig>) => onChange({ ...k, ...patch });
  const erro = k.ativo ? erroKit(k) : null;

  const addSabor = () => {
    const nome = novoSabor.trim();
    if (!nome) return;
    set({ sabores: [...k.sabores, { id: novoId(), nome }] });
    setNovoSabor("");
  };

  return (
    <div className={`kq-card${k.ativo ? " kq-card--on" : ""}`}>
      <div className="kq-head">
        <span className="kq-ico" aria-hidden="true">🧺</span>
        <div className="kq-head-t">
          <b>Kit por quantidade <em>NOVO</em></b>
          <small>Docinhos e salgados: o cliente escolhe quantos de cada sabor</small>
        </div>
        <button type="button" className={`kq-tg${k.ativo ? " on" : ""}`} role="switch" aria-checked={k.ativo}
          aria-label="Ligar kit por quantidade" onClick={() => set({ ativo: !k.ativo })}><i /></button>
      </div>

      {k.ativo && mobileMode !== "checklist" && (
        <div className="kq-body">
          <p className="kq-aviso">Com o kit ligado, <b>Tamanhos</b> e <b>Sabores</b> ficam desligados neste produto — o kit já tem os dele.</p>

          <p className="kq-lb">Sabores do kit</p>
          {k.sabores.map(s => (
            <div className="kq-sabor" key={s.id}>
              <input value={s.nome} onChange={e => set({ sabores: k.sabores.map(x => x.id === s.id ? { ...x, nome: e.target.value } : x) })} aria-label="Nome do sabor" />
              <button type="button" onClick={() => set({ sabores: k.sabores.filter(x => x.id !== s.id) })} aria-label={`Remover ${s.nome}`}>✕</button>
            </div>
          ))}
          <div className="kq-add">
            <input placeholder="Ex: Brigadeiro, Coxinha..." value={novoSabor} onChange={e => setNovoSabor(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSabor(); } }} />
            <button type="button" onClick={addSabor} disabled={!novoSabor.trim()}>+ Adicionar</button>
          </div>

          <p className="kq-lb">Como vende?</p>
          <div className="kq-seg">
            <button type="button" className={k.modo === "fechado" ? "on" : ""} onClick={() => set({ modo: "fechado" })}>Kits fechados</button>
            <button type="button" className={k.modo === "livre" ? "on" : ""} onClick={() => set({ modo: "livre" })}>Quantidade livre</button>
          </div>

          {k.modo === "fechado" ? (
            <>
              {k.kits.map(x => (
                <div className="kq-kit" key={x.id}>
                  <label><input inputMode="numeric" value={x.qtd || ""} placeholder="50" onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, qtd: Math.round(num(e.target.value)) } : y) })} /><span>unidades</span></label>
                  <label className="kq-preco"><span>R$</span><input inputMode="decimal" value={x.preco || ""} placeholder="0,00" onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, preco: num(e.target.value) } : y) })} /></label>
                  <button type="button" onClick={() => set({ kits: k.kits.filter(y => y.id !== x.id) })} aria-label="Remover kit">✕</button>
                </div>
              ))}
              <button type="button" className="kq-link" onClick={() => set({ kits: [...k.kits, { id: novoId(), qtd: 0, preco: 0 }] })}>+ Outro tamanho de kit</button>
            </>
          ) : (
            <div className="kq-grid">
              <label><small>Mínimo</small><span><input inputMode="numeric" value={k.livre.min || ""} onChange={e => set({ livre: { ...k.livre, min: Math.round(num(e.target.value)) } })} /> un</span></label>
              <label><small>Sobe de</small><span><input inputMode="numeric" value={k.livre.passo || ""} onChange={e => set({ livre: { ...k.livre, passo: Math.round(num(e.target.value)) } })} /> em {k.livre.passo || "–"}</span></label>
              <label><small>Máximo</small><span><input inputMode="numeric" value={k.livre.max || ""} onChange={e => set({ livre: { ...k.livre, max: Math.round(num(e.target.value)) } })} /> un</span></label>
              <label><small>Preço do cento</small><span>R$ <input inputMode="decimal" value={k.livre.preco_cento || ""} placeholder="0,00" onChange={e => set({ livre: { ...k.livre, preco_cento: num(e.target.value) } })} /></span></label>
            </div>
          )}

          <p className="kq-lb">Regras</p>
          <div className="kq-grid">
            <label><small>Máx. de sabores</small><span><input inputMode="numeric" value={k.max_sabores || ""} onChange={e => set({ max_sabores: Math.round(num(e.target.value)) })} /></span></label>
            <label><small>Cada sabor sobe de</small><span><input inputMode="numeric" value={k.passo_sabor || ""} onChange={e => set({ passo_sabor: Math.round(num(e.target.value)) })} /> em {k.passo_sabor || "–"}</span></label>
          </div>
          {erro && <p className="kq-erro">{erro}</p>}
        </div>
      )}

      <style>{`
        .kq-card { border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; margin-top: 10px; background: #fff; font-family: var(--font-base); }
        .kq-card--on { border-color: #E85A8C; background: #FFF9FB; }
        .kq-head { display: flex; align-items: center; gap: 10px; }
        .kq-ico { width: 36px; height: 36px; border-radius: 10px; background: #FCE7F3; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .kq-head-t { flex: 1; min-width: 0; }
        .kq-head-t b { display: block; font-size: 14px; color: var(--text-title); }
        .kq-head-t em { font-style: normal; font-size: 9px; background: #E85A8C; color: #fff; padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: 2px; }
        .kq-head-t small { font-size: 12px; color: #888780; line-height: 1.35; display: block; }
        .kq-tg { width: 40px; height: 23px; border-radius: 12px; border: none; background: #E5DDE0; position: relative; cursor: pointer; flex-shrink: 0; padding: 0; }
        .kq-tg i { position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: #fff; transition: left .15s; }
        .kq-tg.on { background: #E85A8C; } .kq-tg.on i { left: 20px; }
        .kq-body { margin-top: 10px; border-top: 1px solid #F3ECEE; padding-top: 6px; }
        .kq-aviso { font-size: 12px; color: #6B5D64; background: #FAF7F8; border-radius: 8px; padding: 8px 10px; margin: 6px 0 0; line-height: 1.4; }
        .kq-lb { font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #888780; margin: 14px 0 6px; }
        .kq-sabor, .kq-add, .kq-kit { display: flex; gap: 6px; margin-bottom: 6px; align-items: center; }
        .kq-sabor input, .kq-add input { flex: 1; min-width: 0; border: 1px solid #EAE3E6; border-radius: 8px; padding: 9px 10px; font-family: inherit; font-size: 14px; color: var(--text-title); background: #fff; }
        .kq-sabor button, .kq-kit > button { border: none; background: none; color: #C4B8BE; font-size: 13px; cursor: pointer; padding: 6px; }
        .kq-add button { border: none; border-radius: 8px; background: #2C1219; color: #fff; font-family: inherit; font-size: 13px; font-weight: 800; padding: 0 12px; height: 38px; cursor: pointer; white-space: nowrap; }
        .kq-add button:disabled { opacity: .4; cursor: default; }
        .kq-seg { display: flex; gap: 3px; padding: 3px; background: #EFE9EB; border-radius: 9px; }
        .kq-seg button { flex: 1; border: none; background: none; border-radius: 7px; padding: 8px 4px; font-family: inherit; font-size: 12.5px; font-weight: 700; color: #7C7A8E; cursor: pointer; }
        .kq-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(44,18,25,.08); }
        .kq-kit { margin-top: 6px; }
        .kq-kit label { flex: 1; display: flex; align-items: center; gap: 6px; border: 1px solid #EAE3E6; border-radius: 8px; padding: 0 10px; background: #fff; min-width: 0; }
        .kq-kit label input { flex: 1; min-width: 0; border: none; outline: none; padding: 9px 0; font-family: inherit; font-size: 14px; font-weight: 700; color: var(--text-title); background: none; }
        .kq-kit label span { font-size: 12px; color: #888780; }
        .kq-link { border: none; background: none; color: #C33A6E; font-family: inherit; font-size: 12.5px; font-weight: 800; padding: 4px 2px; cursor: pointer; }
        .kq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px; }
        .kq-grid label { border: 1px solid #EAE3E6; border-radius: 8px; padding: 6px 9px; background: #fff; }
        .kq-grid small { display: block; font-size: 10.5px; color: #888780; font-weight: 700; }
        .kq-grid span { display: flex; align-items: center; gap: 4px; font-size: 12.5px; color: #6B5D64; }
        .kq-grid input { width: 100%; min-width: 0; border: none; outline: none; padding: 2px 0; font-family: inherit; font-size: 14px; font-weight: 800; color: var(--text-title); background: none; }
        .kq-erro { font-size: 12px; font-weight: 700; color: #B45309; margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
