import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { Camera, Check, X } from "@phosphor-icons/react";
import { salvarFotoInsumoDoo, type RascunhoFotoInsumo } from "@/lib/insumosDoo";
import { CSS_CID } from "@/components/doo/CartaoInsumoDoo";

/**
 * Cartão da foto do ingrediente (08/11): a Doo pede, o app busca na internet sozinho (a mesma busca do cadastro),
 * já deixa a MELHOR foto marcada e a confeiteira confirma com um toque. Pode trocar por outra das opções.
 * Nada é salvo sem o "Usar esta foto".
 */
export default function CartaoFotoInsumoDoo({ uid, rascunho, estado, onFeito }: {
  uid: string;
  rascunho: RascunhoFotoInsumo;
  estado: "pendente" | "salvo" | "cancelado";
  onFeito: (estado: "salvo" | "cancelado", nome?: string) => void;
}) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [escolhida, setEscolhida] = useState("");
  const [buscando, setBuscando] = useState(estado === "pendente");
  const [semResultado, setSemResultado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const buscou = useRef(false);

  const buscar = () => {
    setBuscando(true); setSemResultado(false); setErro("");
    apiFetch(`/api/buscar-imagem?q=${encodeURIComponent(`${rascunho.nome} ${rascunho.marca || ""}`.trim())}`)
      .then(x => x.json())
      .then(d => {
        const l: string[] = Array.isArray(d?.images) ? d.images.filter((u: unknown) => typeof u === "string").slice(0, 4) : [];
        setFotos(l); setSemResultado(!l.length); setEscolhida(l[0] || "");
        if (d?.error === "limit" || d?.error === "limite") setErro("Você chegou ao limite de buscas de foto de hoje. Tente amanhã.");
      })
      .catch(() => { setSemResultado(true); setErro("Não deu para buscar agora. Tente de novo."); })
      .finally(() => setBuscando(false));
  };
  useEffect(() => {
    if (estado !== "pendente" || buscou.current) return;
    buscou.current = true; buscar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    if (!escolhida) return;
    setSalvando(true); setErro("");
    const res = await salvarFotoInsumoDoo(uid, rascunho, escolhida);
    setSalvando(false);
    if (res.ok === false) { setErro(res.erro); return; }
    onFeito("salvo", res.nome);
  };

  if (estado !== "pendente") {
    return (
      <div className={`cid cid--fim${estado === "cancelado" ? " cid--cancel" : ""}`}>
        <span className="cid-ok">{estado === "salvo" ? <Check size={16} weight="bold" /> : <X size={14} weight="bold" />}</span>
        <span>{estado === "salvo" ? `Foto de ${rascunho.nome} salva nos seus ingredientes` : "Foto cancelada"}</span>
        <style>{CSS_CID}</style>
      </div>
    );
  }

  return (
    <div className="cid">
      <div className="cid-hd"><span className="cid-ic"><Camera size={20} /></span>
        <div><p className="cid-k">Foto do ingrediente</p><b>{rascunho.nome}</b></div></div>

      {buscando && (
        <div className="cid-fotos">
          <p className="cid-fl">Procurando a melhor foto…</p>
          <div className="cid-fg">{[0, 1, 2].map(k => <span key={k} className="cid-f cid-f--load" />)}</div>
        </div>
      )}

      {!buscando && escolhida && (
        <div className="cid-fotos">
          <img src={escolhida} alt="" referrerPolicy="no-referrer" className="cfd-gr"
            onError={() => { const resto = fotos.filter(f => f !== escolhida); setFotos(resto); setEscolhida(resto[0] || ""); if (!resto.length) setSemResultado(true); }} />
          {fotos.length > 1 && (
            <>
              <p className="cid-fl cfd-ou">Outras opções (toque para trocar)</p>
              <div className="cid-fg">
                {fotos.map(f => (
                  <button type="button" key={f} className={`cid-f${escolhida === f ? " on" : ""}`} onClick={() => setEscolhida(f)} aria-label="Usar esta foto">
                    <img src={f} alt="" loading="lazy" referrerPolicy="no-referrer" onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
                    {escolhida === f && <i><Check size={12} weight="bold" /></i>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!buscando && semResultado && !escolhida && <p className="cid-erro cfd-sem">{erro || "Não achei foto boa para esse ingrediente. Você pode escolher da galeria em Ingredientes."}</p>}
      {erro && escolhida && <p className="cid-erro">{erro}</p>}

      <div className="cid-bts">
        {!buscando && (semResultado || !escolhida)
          ? <button type="button" className="cid-b2" onClick={buscar}>Buscar de novo</button>
          : <button type="button" className="cid-b2" onClick={buscar} disabled={buscando}>Outras fotos</button>}
        <button type="button" className="cid-b1" onClick={salvar} disabled={salvando || buscando || !escolhida}>{salvando ? "Salvando…" : "Usar esta foto"}</button>
      </div>
      <button type="button" className="cid-x" onClick={() => onFeito("cancelado")}>Cancelar</button>
      <style>{CSS_CID}{CSS}</style>
    </div>
  );
}

const CSS = `
  .cfd-gr { display: block; width: 100%; max-width: 220px; aspect-ratio: 1; object-fit: cover; border-radius: var(--ui-raio); border: 1px solid var(--ui-borda); background: #FAF7F8; }
  .cfd-ou { margin-top: 12px !important; }
  .cfd-sem { margin-top: 12px; font-weight: 500; }
`;
