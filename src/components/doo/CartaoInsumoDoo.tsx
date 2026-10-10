import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Package, Check } from "@phosphor-icons/react";
import CampoNumero from "@/components/ui/CampoNumero";
import { custoLegivel, salvarInsumoDoo, UNIDADES_INSUMO, EMBALAGENS_INSUMO, type RascunhoInsumo, type InsumoResumo } from "@/lib/insumosDoo";

/**
 * Cartão de conferência do insumo (02/10): a Doo entende, mostra o que entendeu,
 * a confeiteira confere (pode corrigir ali mesmo) e só então o app salva.
 */
export default function CartaoInsumoDoo({ uid, rascunho, existente, estado, onFeito }: {
  uid: string;
  rascunho: RascunhoInsumo;
  existente?: InsumoResumo | null;
  estado: "pendente" | "salvo" | "cancelado";
  onFeito: (estado: "salvo" | "cancelado", final?: RascunhoInsumo) => void;
}) {
  const [r, setR] = useState<RascunhoInsumo>(rascunho);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Foto: a mesma busca de imagem do cadastro manual, já feita ao abrir o cartão (insumo novo)
  const [fotos, setFotos] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    if (estado !== "pendente" || rascunho.insumo_id || rascunho.nome.trim().length < 3) return;
    let cancel = false;
    setBuscando(true);
    apiFetch(`/api/buscar-imagem?q=${encodeURIComponent(`${rascunho.nome} ${rascunho.marca || ""}`.trim())}`)
      .then(r => r.json())
      .then(d => { if (!cancel && Array.isArray(d?.images)) { const l = d.images.slice(0, 3); setFotos(l); if (l[0]) setR(x => ({ ...x, imagem_url: x.imagem_url || l[0] })); } })
      .catch(() => {})
      .finally(() => { if (!cancel) setBuscando(false); });
    return () => { cancel = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const atualizar = !!r.insumo_id;
  const custo = custoLegivel(r.unidade, r.qtd_embalagem, r.valor_compra);
  const custoAntes = existente ? custoLegivel(existente.unidade, existente.qtd_embalagem, existente.valor_compra) : "";
  const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtQtd = (q: number, u: string) => `${String(q).replace(".", ",")} ${u}`;

  const salvar = async () => {
    setSalvando(true); setErro("");
    const res = await salvarInsumoDoo(uid, r);
    setSalvando(false);
    if (res.ok === false) { setErro(res.erro); return; }
    onFeito("salvo", r);
  };

  if (estado !== "pendente") {
    return (
      <div className={`cid cid--fim${estado === "cancelado" ? " cid--cancel" : ""}`}>
        <span className="cid-ok">{estado === "salvo" ? <Check size={16} weight="bold" /> : "×"}</span>
        <span>{estado === "salvo" ? `${r.nome} ${atualizar ? "atualizado" : "cadastrado"} nos seus insumos` : "Cadastro cancelado"}</span>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div className="cid">
      <div className="cid-hd"><span className="cid-ic"><Package size={20} /></span>
        <div><p className="cid-k">{atualizar ? "ATUALIZAR PREÇO" : "NOVO INSUMO"}</p><b>{r.nome || "Insumo"}</b></div></div>

      {!editando ? (
        <dl className="cid-kv">
          <dt>Embalagem</dt><dd>{fmtQtd(r.qtd_embalagem, r.unidade)}{r.embalagem_tipo && r.embalagem_tipo !== "Avulso" ? ` · ${r.embalagem_tipo}` : ""}</dd>
          <dt>Você pagou</dt><dd>{brl(r.valor_compra)}</dd>
          {atualizar && existente && <><dt>Antes</dt><dd className="cid-antes">{brl(existente.valor_compra)} · {custoAntes}</dd></>}
          <dt>Custo</dt><dd className="cid-custo">{custo || "—"}</dd>
        </dl>
      ) : (
        <div className="cid-ed">
          <label className="cid-l">Nome<input className="cid-in" value={r.nome} onChange={e => setR({ ...r, nome: e.target.value })} /></label>
          <div className="cid-row">
            <label className="cid-l">Quantidade<CampoNumero className="cid-in" value={r.qtd_embalagem} onValor={n => setR({ ...r, qtd_embalagem: n })} /></label>
            <label className="cid-l">Unidade<select className="cid-in" value={r.unidade} onChange={e => setR({ ...r, unidade: e.target.value })}>{UNIDADES_INSUMO.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
          </div>
          <div className="cid-row">
            <label className="cid-l">Valor pago (R$)<CampoNumero className="cid-in" value={r.valor_compra} onValor={n => setR({ ...r, valor_compra: n })} /></label>
            <label className="cid-l">Embalagem<select className="cid-in" value={r.embalagem_tipo} onChange={e => setR({ ...r, embalagem_tipo: e.target.value })}>{EMBALAGENS_INSUMO.map(u => <option key={u} value={u}>{u}</option>)}</select></label>
          </div>
          <p className="cid-custo cid-custo--ed">{custo ? `Custo: ${custo}` : "Preencha a quantidade e o valor"}</p>
        </div>
      )}

      {(buscando || fotos.length > 0) && (
        <div className="cid-fotos">
          <p className="cid-fl">Foto do insumo</p>
          <div className="cid-fg">
            {buscando && !fotos.length ? [0, 1, 2].map(k => <span key={k} className="cid-f cid-f--load" />) : fotos.map(f => (
              <button type="button" key={f} className={`cid-f${r.imagem_url === f ? " on" : ""}`} onClick={() => setR(x => ({ ...x, imagem_url: f }))} aria-label="Usar esta foto">
                <img src={f} alt="" loading="lazy" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                {r.imagem_url === f && <i><Check size={12} weight="bold" /></i>}
              </button>
            ))}
            {fotos.length > 0 && <button type="button" className={`cid-f cid-f--sem${!r.imagem_url ? " on" : ""}`} onClick={() => setR(x => ({ ...x, imagem_url: "" }))}>Sem foto</button>}
          </div>
        </div>
      )}

      {erro && <p className="cid-erro">{erro}</p>}
      <div className="cid-bts">
        <button type="button" className="cid-b2" onClick={() => setEditando(e => !e)}>{editando ? "Pronto" : "Editar"}</button>
        <button type="button" className="cid-b1" onClick={salvar} disabled={salvando || !(r.qtd_embalagem > 0) || !(r.valor_compra > 0) || !r.nome.trim()}>
          {salvando ? "Salvando…" : atualizar ? "Atualizar preço" : "Cadastrar insumo"}
        </button>
      </div>
      <button type="button" className="cid-x" onClick={() => onFeito("cancelado")}>Cancelar</button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .cid { margin-top: 10px; background: #fff; border: 1.5px solid #F7C6D9; border-radius: 16px; padding: 14px; font-family: var(--font-base); color: #2C1219; max-width: 340px; }
  .cid-hd { display: flex; gap: 11px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #F5F0F2; }
  .cid-ic { width: 40px; height: 40px; border-radius: 10px; background: #FCE0E9; color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cid-k { margin: 0; font-size: 12px; font-weight: 700; color: #E85A8C; }
  .cid-hd b { display: block; font-size: 16px; font-weight: 700; margin-top: 1px; }
  .cid-kv { display: grid; grid-template-columns: 96px 1fr; gap: 7px 10px; margin: 12px 0 0; font-size: 14px; }
  .cid-kv dt { color: #888780; font-weight: 500; } .cid-kv dd { margin: 0; font-weight: 700; }
  .cid-antes { color: #9A8E94 !important; font-weight: 500 !important; text-decoration: line-through; }
  .cid-custo { color: #15803D; font-weight: 700 !important; }
  .cid-custo--ed { margin: 8px 0 0; font-size: 13px; }
  .cid-ed { margin-top: 6px; }
  .cid-l { display: block; flex: 1; min-width: 0; font-size: 13px; font-weight: 700; color: #4B3A42; margin-top: 10px; }
  .cid-in { display: block; width: 100%; box-sizing: border-box; margin-top: 5px; min-height: 44px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 10px 12px; font-family: inherit; font-size: 16px; color: #2C1219; background: #fff; }
  .cid-in:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .cid-row { display: flex; gap: 8px; }
  .cid-fotos { margin-top: 12px; }
  .cid-fl { margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #4B3A42; }
  .cid-fg { display: flex; gap: 8px; }
  .cid-f { position: relative; width: 56px; height: 56px; border-radius: 12px; border: 2px solid #EDE6E9; background: #FAF7F8; padding: 0; overflow: hidden; cursor: pointer; flex-shrink: 0; }
  .cid-f img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cid-f.on { border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.15); }
  .cid-f i { position: absolute; right: 3px; bottom: 3px; width: 18px; height: 18px; border-radius: 50%; background: #E85A8C; color: #fff; display: flex; align-items: center; justify-content: center; }
  .cid-f--sem { font-family: inherit; font-size: 12px; font-weight: 700; color: #9A8E94; }
  .cid-f--load { background: linear-gradient(90deg, #F5F0F2, #FBF7F9, #F5F0F2); background-size: 200% 100%; animation: cidLoad 1.2s infinite; }
  @keyframes cidLoad { to { background-position: -200% 0; } }
  .cid-erro { margin: 10px 0 0; font-size: 13px; color: #B91C1C; font-weight: 700; }
  .cid-bts { display: flex; gap: 8px; margin-top: 14px; }
  .cid-b1, .cid-b2 { flex: 1; border-radius: 12px; padding: 12px 10px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .cid-b1 { border: none; background: #E85A8C; color: #fff; box-shadow: 0 3px 0 #C33A6E; flex: 2; }
  .cid-b2 { flex: 1; }
  .cid-b1:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
  .cid-b2 { border: 1.5px solid #EAE3E6; background: #fff; color: #2C1219; }
  .cid-x { display: block; width: 100%; margin-top: 4px; padding: 8px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 500; color: #9A8E94; cursor: pointer; }
  .cid--fim { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13.5px; font-weight: 700; border-color: #BBF7D0; background: #F0FDF4; color: #15803D; }
  .cid--cancel { border-color: #EDE6E9; background: #FAF7F8; color: #9A8E94; }
  .cid-ok { width: 24px; height: 24px; border-radius: 50%; background: #DCFCE7; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cid--cancel .cid-ok { background: #F0EBED; }
`;
