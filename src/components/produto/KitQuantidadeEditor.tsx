import { useEffect, useState } from "react";
import KitPicker from "@/components/cardapio/KitPicker";
import {
  KIT_VAZIO, KitQtdConfig, KitSelecao, SUGESTOES_SABORES, erroKit, kitsValidos, novoId, presetKit, selecaoInicial,
} from "@/lib/kitQuantidade";

/**
 * Kit por quantidade no cadastro (aprovado 30/09 — "cadastro fácil").
 *  - modo "compacto": só o cartão com o botão de ligar (na lista de opções)
 *  - modo "completo": tela "Monte seu kit": modelo pronto → 3 perguntas → prévia do cardápio
 */
interface Props {
  kit?: KitQtdConfig | null;
  onChange: (k: KitQtdConfig) => void;
  modo: "compacto" | "completo";
  nomeProduto?: string;
}

const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? 0 : n; };
const moeda = (v: number) => v > 0 ? v.toFixed(2).replace(".", ",") : "";

export default function KitQuantidadeEditor({ kit, onChange, modo, nomeProduto }: Props) {
  const k: KitQtdConfig = { ...KIT_VAZIO, ...(kit || {}), livre: { ...KIT_VAZIO.livre, ...(kit?.livre || {}) } };
  const set = (patch: Partial<KitQtdConfig>) => onChange({ ...k, ...patch });
  const [novoSabor, setNovoSabor] = useState("");
  const [sel, setSel] = useState<KitSelecao>(() => selecaoInicial(k));
  // Mantém a prévia coerente quando mudam os kits/quantidades
  useEffect(() => {
    setSel(s => {
      const validos = kitsValidos(k);
      const kitId = validos.some(x => x.id === s.kitId) ? s.kitId : (validos[0]?.id || "");
      const qtdLivre = Math.min(Math.max(s.qtdLivre || k.livre.min, k.livre.min), k.livre.max || k.livre.min);
      return { ...s, kitId, qtdLivre };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(k.kits), k.livre.min, k.livre.max, k.modo]);

  const cabecalho = (
    <div className={`kq-card${k.ativo ? " kq-card--on" : ""}`}>
      <div className="kq-head">
        <span className="kq-ico" aria-hidden="true">🧺</span>
        <div className="kq-head-t">
          <b>Kit por quantidade <em>NOVO</em></b>
          <small>{k.ativo && modo === "compacto" ? "Na próxima tela você escolhe os sabores e os kits." : "O cliente escolhe quantos quer de cada sabor."}</small>
        </div>
        <button type="button" className={`kq-tg${k.ativo ? " on" : ""}`} role="switch" aria-checked={k.ativo}
          aria-label="Ligar kit por quantidade" onClick={() => set({ ativo: !k.ativo })}><i /></button>
      </div>
    </div>
  );

  if (modo === "compacto") return <>{cabecalho}<style>{CSS}</style></>;

  // ═══ Tela "Monte seu kit" ═══
  const precisaModelo = !k.modelo && k.sabores.length === 0;
  if (precisaModelo) {
    // 02/10: nomes mais específicos e os desenhos das categorias (sem emoji); toque no cartão escolhe
    const modelos: { id: "docinhos" | "salgados" | "livre"; img: string; t: string; d: string }[] = [
      { id: "docinhos", img: "/categoriaicones/icone (1).png", t: "Brigadeiro", d: "Brigadeiro, beijinho e docinhos de festa" },
      { id: "salgados", img: "/categoriaicones/icone (3).png", t: "Salgadinhos", d: "Coxinha, risole, kibe e outros de festa" },
      { id: "livre", img: "/categoriaicones/icone (35).png", t: "Personalizado", d: "Você monta do zero, com os seus sabores e quantidades" },
    ];
    return (
      <div className="kq-tela">
        <h2 className="kq-q">O que vai nesse kit?</h2>
        <p className="kq-qs">Escolha o mais parecido. A gente já sugere os sabores e os tamanhos de kit.</p>
        <div className="kq-modelos">
          {modelos.map(m => (
            <button type="button" key={m.id} className={`kq-mod${m.id === "livre" ? " kq-mod--wide" : ""}`} onClick={() => onChange(presetKit(m.id, k))}>
              <span className="kq-mod-e" aria-hidden="true"><img src={m.img} alt="" /></span>
              <b>{m.t}</b><small>{m.d}</small>
            </button>
          ))}
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  const modeloInfo = k.modelo === "docinhos" ? { t: "Brigadeiro", img: "/categoriaicones/icone (1).png" }
    : k.modelo === "salgados" ? { t: "Salgadinhos", img: "/categoriaicones/icone (3).png" }
    : { t: "Personalizado", img: "/categoriaicones/icone (35).png" };
  const sabores = k.sabores.filter(s => s.nome.trim());
  const okSabores = sabores.length > 0;
  const okPreco = k.modo === "fechado" ? kitsValidos(k).length > 0 : k.livre.preco_cento > 0 && k.livre.min > 0 && k.livre.passo > 0 && k.livre.max >= k.livre.min;
  const okRegras = (k.max_sabores || 0) >= 1 && (k.passo_sabor || 0) >= 1;
  const sugestoes = (SUGESTOES_SABORES[k.modelo || "livre"] || []).filter(n => !k.sabores.some(s => s.nome.trim().toLowerCase() === n.toLowerCase()));
  const addSabor = (nome: string) => { const n = nome.trim(); if (!n) return; set({ sabores: [...k.sabores, { id: novoId(), nome: n }] }); setNovoSabor(""); };
  const kitEx = kitsValidos(k)[0]?.qtd || (k.modo === "livre" ? k.livre.min : 50);
  const ex1 = sabores[0]?.nome.toLowerCase() || "brigadeiro", ex2 = sabores[1]?.nome.toLowerCase() || "beijinho";

  return (
    <div className="kq-tela">
      <div className="kq-modelo-on"><span>Modelo</span><b><img src={modeloInfo.img} alt="" />{modeloInfo.t}</b>
        {k.sabores.length === 0 && <button type="button" className="kq-trocar" onClick={() => set({ modelo: undefined })}>Trocar</button>}
      </div>

      <div className="kq-grid2">
        <div>
          {/* 1 · Sabores */}
          <section className="kq-st">
            <div className="kq-sth"><span className={`kq-n${okSabores ? " ok" : ""}`}>1</span><div><b>Quais sabores entram no kit?</b></div></div>
            {sabores.length > 0 && (
              <div className="kq-chips">
                {k.sabores.map(s => s.nome.trim() && (
                  <span className="kq-chip" key={s.id}>{s.nome}
                    <button type="button" onClick={() => set({ sabores: k.sabores.filter(x => x.id !== s.id) })} aria-label={`Tirar ${s.nome}`}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="kq-addrow">
              <input placeholder={k.modelo === "salgados" ? "Ex: Coxinha de frango" : "Ex: Brigadeiro de Ninho"} value={novoSabor}
                onChange={e => setNovoSabor(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSabor(novoSabor); } }} />
              <button type="button" onClick={() => addSabor(novoSabor)} disabled={!novoSabor.trim()}>Adicionar</button>
            </div>
            {sugestoes.length > 0 && (
              <>
                <p className="kq-sug-l">Sugestões</p>
                <div className="kq-sug">{sugestoes.slice(0, 8).map(n => <button type="button" key={n} onClick={() => addSabor(n)}>+ {n}</button>)}</div>
              </>
            )}
          </section>

          {/* 2 · Como compra */}
          <section className="kq-st">
            <div className="kq-sth"><span className={`kq-n${okPreco ? " ok" : ""}`}>2</span><div><b>Como o cliente compra?</b></div></div>
            <div className="kq-opts" role="radiogroup">
              <button type="button" role="radio" aria-checked={k.modo === "fechado"} className={`kq-op${k.modo === "fechado" ? " on" : ""}`}
                onClick={() => set({ modo: "fechado", kits: k.kits.length ? k.kits : [{ id: novoId(), qtd: 50, preco: 0 }, { id: novoId(), qtd: 100, preco: 0 }] })}>
                <b><i />Pacotes prontos</b><small>Kit de 50, de 100… cada um com seu preço</small></button>
              <button type="button" role="radio" aria-checked={k.modo === "livre"} className={`kq-op${k.modo === "livre" ? " on" : ""}`} onClick={() => set({ modo: "livre" })}>
                <b><i />Ele escolhe a quantidade</b><small>Mínimo, de quanto em quanto e preço do cento</small></button>
            </div>
            {k.modo === "fechado" ? (
              <>
                {k.kits.map(x => (
                  <div className="kq-frase kq-frase--kit" key={x.id}>
                    <span className="kq-t">Kit de</span><input className="kq-box kq-box--qtd" inputMode="numeric" value={x.qtd || ""} placeholder="50" aria-label="Unidades do kit"
                      onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, qtd: Math.round(num(e.target.value)) } : y) })} />
                    <span className="kq-t">un. por</span>
                    <span className={`kq-box kq-box--rs${x.preco > 0 ? " ok" : " falta"}`}>R$ <input inputMode="decimal" defaultValue={moeda(x.preco)} placeholder="0,00" aria-label="Preço do kit"
                      onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, preco: num(e.target.value) } : y) })} /></span>
                    <button type="button" className="kq-x" onClick={() => set({ kits: k.kits.filter(y => y.id !== x.id) })} aria-label="Remover kit">✕</button>
                  </div>
                ))}
                <button type="button" className="kq-link" onClick={() => set({ kits: [...k.kits, { id: novoId(), qtd: 0, preco: 0 }] })}>+ Outro tamanho de kit</button>
              </>
            ) : (
              <>
                <div className="kq-frase">O cliente pede de <input className="kq-box" inputMode="numeric" value={k.livre.min || ""} aria-label="Mínimo"
                  onChange={e => set({ livre: { ...k.livre, min: Math.round(num(e.target.value)) } })} /> até <input className="kq-box" inputMode="numeric" value={k.livre.max || ""} aria-label="Máximo"
                  onChange={e => set({ livre: { ...k.livre, max: Math.round(num(e.target.value)) } })} /> unidades</div>
                <div className="kq-frase">Subindo de <input className="kq-box" inputMode="numeric" value={k.livre.passo || ""} aria-label="De quanto em quanto"
                  onChange={e => set({ livre: { ...k.livre, passo: Math.round(num(e.target.value)) } })} /> em {k.livre.passo || "–"}</div>
                <div className="kq-frase">O cento custa <span className={`kq-box kq-box--rs${k.livre.preco_cento > 0 ? " ok" : " falta"}`}>R$ <input inputMode="decimal" defaultValue={moeda(k.livre.preco_cento)} placeholder="0,00" aria-label="Preço do cento"
                  onChange={e => set({ livre: { ...k.livre, preco_cento: num(e.target.value) } })} /></span></div>
              </>
            )}
          </section>

          {/* 3 · Regras */}
          <section className="kq-st">
            <div className="kq-sth"><span className={`kq-n${okRegras ? " ok" : ""}`}>3</span><div><b>Como ele pode montar?</b></div></div>
            <div className="kq-frase">O cliente pode misturar até <input className="kq-box" inputMode="numeric" value={k.max_sabores || ""} aria-label="Máximo de sabores"
              onChange={e => set({ max_sabores: Math.round(num(e.target.value)) })} /> sabores</div>
            <div className="kq-frase">Cada sabor vem de <input className="kq-box" inputMode="numeric" value={k.passo_sabor || ""} aria-label="De quanto em quanto cada sabor"
              onChange={e => set({ passo_sabor: Math.round(num(e.target.value)) })} /> em {k.passo_sabor || "–"}</div>
            <p className="kq-ex">Exemplo no kit de {kitEx}: <b>{Math.floor(kitEx / 2 / (k.passo_sabor || 1)) * (k.passo_sabor || 1)} {ex1} + {kitEx - Math.floor(kitEx / 2 / (k.passo_sabor || 1)) * (k.passo_sabor || 1)} {ex2}</b>, ou {kitEx} de um sabor só.</p>
          </section>
        </div>

      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .kq-card { border: 1px solid #F0EBED; border-radius: 14px; padding: 12px; margin: 10px 0 12px; background: #fff; font-family: var(--font-base); }
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

  .kq-tela { font-family: var(--font-base); color: #2C1219; padding-bottom: 8px; }
  .kq-q { font-size: 22px; font-weight: 900; text-align: left; margin: 18px 0 4px; color: #2C1219; letter-spacing: -.02em; text-wrap: balance; }
  .kq-qs { text-align: left; font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 0 0 16px; text-wrap: balance; }
  .kq-modelos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kq-mod { border: 1.5px solid #EDE6E9; border-radius: 16px; padding: 16px 12px; background: #fff; display: flex; flex-direction: column; align-items: center; text-align: center; font-family: inherit; color: #2C1219; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .kq-mod:hover { border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-mod-e { width: 52px; height: 52px; border-radius: 15px; background: #FFF1F6; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .kq-mod-e img { width: 36px; height: 36px; object-fit: contain; }
  .kq-mod b { font-size: 15px; font-weight: 800; } .kq-mod small { font-size: 12px; color: #888780; line-height: 1.35; margin-top: 3px; text-wrap: balance; }
  .kq-mod--wide { grid-column: 1 / -1; display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; text-align: left; align-items: center; }
  .kq-mod--wide .kq-mod-e { grid-row: span 2; margin: 0; } .kq-mod--wide small { margin-top: 0; }
  .kq-mod ul { list-style: none; margin: 10px 0 0; padding: 0; flex: 1; } .kq-mod li { font-size: 12px; color: #4B3A42; padding: 3px 0; } .kq-mod li::before { content: "✓ "; color: #16a34a; font-weight: 800; }
  .kq-mod button { margin-top: 12px; height: 40px; border: none; border-radius: 10px; background: #2C1219; color: #fff; font-family: inherit; font-weight: 800; font-size: 13px; cursor: pointer; }
  .kq-mod--cm button { background: #F5F0F2; color: #2C1219; }
  .kq-modelo-on { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #888780; margin-top: 18px; padding: 10px 12px; background: #FAF7F8; border-radius: 12px; }
  .kq-modelo-on b { display: inline-flex; align-items: center; gap: 5px; color: #2C1219; font-weight: 800; } .kq-modelo-on b img { width: 20px; height: 20px; object-fit: contain; }
  .kq-trocar { margin-left: auto; border: none; background: none; color: #C33A6E; font-family: inherit; font-weight: 800; font-size: 13px; cursor: pointer; }
  .kq-chk { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 4px; }
  .kq-chk span { font-size: 12px; font-weight: 800; padding: 5px 10px; border-radius: 999px; background: #FFF7ED; color: #B45309; } .kq-chk span.ok { background: #F0FDF4; color: #15803D; }
  .kq-grid2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; margin-top: 8px; }
  @media (min-width: 900px) {
    .kq-grid2 { grid-template-columns: minmax(0, 1fr) 290px; } .kq-prev { position: sticky; top: 0; align-self: start; }
    .kq-frase { flex-wrap: nowrap; gap: 6px; font-size: 14px; }
    .kq-box { width: 58px; padding: 7px 4px; }
    .kq-box--rs input { width: 60px; }
  }
  .kq-st { border: 1px solid #F0EBED; border-radius: 16px; padding: 14px; margin-top: 12px; background: #fff; }
  .kq-sth { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .kq-n { width: 28px; height: 28px; border-radius: 50%; background: #2C1219; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 13px; flex-shrink: 0; } .kq-n.ok { background: #16a34a; }
  .kq-sth b { font-size: 15px; display: block; } .kq-sth small { font-size: 12px; color: #888780; }
  .kq-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .kq-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 8px 7px 12px; border-radius: 999px; background: #FCE7F3; color: #9D174D; font-weight: 800; font-size: 13px; }
  .kq-chip button { border: none; background: none; color: #C4789C; font-size: 11px; cursor: pointer; padding: 0 2px; }
  .kq-addrow { display: flex; gap: 8px; margin-top: 10px; }
  .kq-addrow input { flex: 1; min-width: 0; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 11px 12px; font-family: inherit; font-size: 16px; color: #2C1219; }
  .kq-addrow input:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-addrow button { border: none; border-radius: 10px; background: #2C1219; color: #fff; font-family: inherit; font-weight: 800; font-size: 13px; padding: 0 14px; cursor: pointer; white-space: nowrap; } .kq-addrow button:disabled { opacity: .35; cursor: default; }
  .kq-sug-l { margin: 12px 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #9A8E94; }
  .kq-sug { display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
  .kq-sug::-webkit-scrollbar { display: none; }
  .kq-sug button { flex-shrink: 0; white-space: nowrap; padding: 6px 11px; border: 1.5px dashed #F3C9DA; border-radius: 999px; background: none; color: #C33A6E; font-family: inherit; font-weight: 700; font-size: 12.5px; cursor: pointer; }
  .kq-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
  .kq-op { border: 1.5px solid #EAE3E6; border-radius: 14px; padding: 11px; background: #fff; text-align: left; font-family: inherit; cursor: pointer; color: #2C1219; }
  .kq-op.on { border-color: #2C1219; background: #FAF7F8; }
  .kq-op b { font-size: 13.5px; display: flex; align-items: center; gap: 8px; }
  .kq-op b i { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #C4B8BE; display: inline-block; flex-shrink: 0; } .kq-op.on b i { border: 5px solid #2C1219; }
  .kq-op small { display: block; font-size: 11.5px; color: #6B5D64; margin-top: 3px; line-height: 1.4; }
  .kq-frase { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14.5px; padding: 9px 0; border-bottom: 1px solid #F5F0F2; }
  .kq-box { width: 72px; border: 1.5px solid #EAE3E6; border-radius: 10px; padding: 7px 8px; font-family: inherit; font-weight: 900; font-size: 14.5px; text-align: center; color: #2C1219; background: #fff; }
  .kq-box:focus, .kq-box--rs:focus-within { outline: none; border-color: #2C1219; }
  .kq-box--rs { width: auto; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; font-size: 13px; color: #6B5D64; }
  .kq-box--rs input { width: 70px; border: none; outline: none; padding: 7px 0; font-family: inherit; font-weight: 900; font-size: 14.5px; color: #2C1219; background: none; }
  .kq-box--rs.ok input { color: #16a34a; } .kq-box--rs.falta { border-color: #FDBA74; background: #FFF7ED; }
  .kq-x { margin-left: auto; border: none; background: none; color: #C4B8BE; font-size: 12px; cursor: pointer; padding: 4px; }
  .kq-link { border: none; background: none; color: #C33A6E; font-family: inherit; font-size: 13px; font-weight: 800; padding: 8px 0 0; cursor: pointer; }
  .kq-ex { font-size: 12px; color: #888780; margin: 8px 0 0; } .kq-ex b { color: #4B3A42; }
  .kq-prev { border-radius: 18px; background: #FAF7F8; padding: 14px; }
  .kq-prev h4 { font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; color: #888780; margin: 0 0 10px; }
  .kq-prev > p { font-size: 12px; color: #6B5D64; line-height: 1.45; margin: 10px 2px 0; }
  .kq-ph { background: #fff; border-radius: 20px; box-shadow: 0 0 0 6px #1b1b1d, 0 12px 26px rgba(0,0,0,.16); padding: 14px 12px; margin: 6px; }
  .kq-ph-t { display: block; font-size: 15px; font-weight: 900; margin-bottom: 8px; }
  .kq-ph-vazio { font-size: 12.5px; color: #888780; margin: 6px 0; line-height: 1.45; }
  /* Kit pronto numa linha: "Kit de [50] un. por [R$ 90,00] ×" */
  .kq-frase--kit { flex-wrap: nowrap; gap: 6px; }
  .kq-frase--kit .kq-t { white-space: nowrap; font-size: 14px; }
  .kq-box--qtd { width: 54px; padding: 7px 4px; flex-shrink: 0; }
  .kq-frase--kit .kq-box--rs { flex: 1; min-width: 0; max-width: 130px; }
  .kq-frase--kit .kq-box--rs input { width: 100%; min-width: 0; }
  @media (max-width: 767px) { .kq-opts { grid-template-columns: 1fr; } }
`;
