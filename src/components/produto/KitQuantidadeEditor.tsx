import { useEffect, useState } from "react";
import { mascaraBRL, lerBRL, textoBRL } from "@/lib/moeda";
import { Basket, Cookie, ForkKnife, PencilSimple, Plus, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import KitPicker from "@/components/cardapio/KitPicker";
import {
  KIT_VAZIO, KitQtdConfig, KitSelecao, SUGESTOES_SABORES, erroKit, kitsValidos, novoId, presetKit, selecaoInicial,
} from "@/lib/kitQuantidade";
import { parseNumBR } from "@/lib/numeroBR";

/**
 * Kit por quantidade no cadastro (aprovado 30/09 — "cadastro fácil").
 *  - modo "compacto": só o cartão com o botão de ligar (na lista de opções)
 *  - modo "completo": tela "Monte seu kit": modelo pronto → 3 perguntas → prévia do cardápio
 */
interface Props {
  kit?: KitQtdConfig | null;
  onChange: (k: KitQtdConfig) => void;
  modo: "compacto" | "completo";
  /** (14/10) sem os campos de preço (o preço dos kits vai pro passo Preço) */
  semPreco?: boolean;
  nomeProduto?: string;
}

/** Ícone de cada modelo de kit (sem emoji nem desenho que pareça emoji) */
const ICONE_MODELO: Record<"docinhos" | "salgados" | "livre", Icon> = { docinhos: Cookie, salgados: ForkKnife, livre: PencilSimple };

/**
 * O que falta pra continuar na tela "Monte seu kit", na ordem em que aparece na tela,
 * com o seletor do campo pra rolar até ele. null = tudo certo.
 */
export function faltaKit(kit?: KitQtdConfig | null, opc: { semPreco?: boolean } = {}): { msg: string; alvo?: string } | null {
  const k: KitQtdConfig = { ...KIT_VAZIO, ...(kit || {}), livre: { ...KIT_VAZIO.livre, ...(kit?.livre || {}) } };
  if (!k.sabores.filter(s => s.nome.trim()).length) return { msg: "Adicione pelo menos 1 sabor", alvo: ".kq-addrow input" };
  // (14/10) no cadastro o preço dos kits fica no passo Preço: aqui só confere quantidades e regras
  if (opc.semPreco) {
    if (k.modo === "fechado") { if (!k.kits.some(x => (x.qtd || 0) > 0)) return { msg: "Coloque quantas unidades vêm no kit", alvo: ".kq-link" }; }
    else {
      const l = k.livre;
      if (!(l.min > 0)) return { msg: "Coloque o mínimo de unidades", alvo: 'input[aria-label="Mínimo"]' };
      if (!(l.max >= l.min)) return { msg: "O máximo precisa ser maior que o mínimo", alvo: 'input[aria-label="Máximo"]' };
      if (!(l.passo > 0)) return { msg: "Coloque de quanto em quanto o cliente pode pedir", alvo: 'input[aria-label="De quanto em quanto"]' };
    }
    if ((k.max_sabores || 0) < 1) return { msg: "Coloque até quantos sabores o cliente pode misturar", alvo: 'input[aria-label="Máximo de sabores"]' };
    if ((k.passo_sabor || 0) < 1) return { msg: "Coloque de quanto em quanto cada sabor sobe", alvo: 'input[aria-label="De quanto em quanto cada sabor"]' };
    return null;
  }
  if (k.modo === "fechado") {
    if (!kitsValidos(k).length) {
      const semPreco = k.kits.find(x => (x.qtd || 0) > 0 && !(x.preco > 0));
      if (semPreco) return { msg: `Coloque o preço do kit de ${semPreco.qtd}`, alvo: `[data-falta="kit-${semPreco.id}"] input` };
      const semQtd = k.kits.find(x => !((x.qtd || 0) > 0));
      if (semQtd) return { msg: "Coloque quantas unidades vêm no kit", alvo: `[data-falta="kitqtd-${semQtd.id}"]` };
      return { msg: "Adicione pelo menos 1 kit com quantidade e preço", alvo: ".kq-link" };
    }
  } else {
    const l = k.livre;
    if (!(l.min > 0)) return { msg: "Coloque o mínimo de unidades", alvo: 'input[aria-label="Mínimo"]' };
    if (!(l.max >= l.min)) return { msg: "O máximo precisa ser maior que o mínimo", alvo: 'input[aria-label="Máximo"]' };
    if (!(l.passo > 0)) return { msg: "Coloque de quanto em quanto o cliente pode pedir", alvo: 'input[aria-label="De quanto em quanto"]' };
    if (!(l.preco_cento > 0)) return { msg: "Coloque o preço do cento", alvo: 'input[aria-label="Preço do cento"]' };
  }
  if ((k.max_sabores || 0) < 1) return { msg: "Coloque até quantos sabores o cliente pode misturar", alvo: 'input[aria-label="Máximo de sabores"]' };
  if ((k.passo_sabor || 0) < 1) return { msg: "Coloque de quanto em quanto cada sabor sobe", alvo: 'input[aria-label="De quanto em quanto cada sabor"]' };
  const outro = erroKit(k);
  return outro ? { msg: outro } : null;
}

// 10/10: parseNumBR entende ponto de milhar ("1.200,00" lia como 1,2)
const num = (v: string) => parseNumBR(v);

export default function KitQuantidadeEditor({ kit, onChange, modo, nomeProduto, semPreco = false }: Props) {
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
        <span className="kq-ico" aria-hidden="true"><Basket size={20} weight="bold" /></span>
        <div className="kq-head-t">
          <b>Kit por quantidade <em>Novo</em></b>
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
    // 02/10: nomes mais específicos; 10/10: ícones Phosphor no lugar dos desenhos (pareciam emoji)
    const modelos: { id: "docinhos" | "salgados" | "livre"; t: string; d: string }[] = [
      { id: "docinhos", t: "Brigadeiro", d: "Brigadeiro, beijinho e doces de festa" },
      { id: "salgados", t: "Salgadinhos", d: "Coxinha, risole, kibe e outros de festa" },
      { id: "livre", t: "Personalizado", d: "Você monta do zero, com os seus sabores e quantidades" },
    ];
    return (
      <div className="kq-tela">
        <h2 className="kq-q">O que vai nesse kit?</h2>
        <p className="kq-qs">Escolha o mais parecido. A gente já sugere os sabores e os tamanhos de kit.</p>
        <div className="kq-modelos">
          {modelos.map(m => { const Ic = ICONE_MODELO[m.id]; return (
            <button type="button" key={m.id} className={`kq-mod${m.id === "livre" ? " kq-mod--wide" : ""}`} onClick={() => onChange(presetKit(m.id, k))}>
              <span className="kq-mod-e" aria-hidden="true"><Ic size={28} weight="bold" /></span>
              <b>{m.t}</b><small>{m.d}</small>
            </button>
          ); })}
        </div>
        <style>{CSS}</style>
      </div>
    );
  }

  const modeloInfo = k.modelo === "docinhos" ? { t: "Brigadeiro", Ic: ICONE_MODELO.docinhos }
    : k.modelo === "salgados" ? { t: "Salgadinhos", Ic: ICONE_MODELO.salgados }
    : { t: "Personalizado", Ic: ICONE_MODELO.livre };
  const sabores = k.sabores.filter(s => s.nome.trim());
  const okSabores = sabores.length > 0;
  const okPreco = k.modo === "fechado" ? kitsValidos(k).length > 0 : k.livre.preco_cento > 0 && k.livre.min > 0 && k.livre.passo > 0 && k.livre.max >= k.livre.min;
  const okRegras = (k.max_sabores || 0) >= 1 && (k.passo_sabor || 0) >= 1;
  const sugestoes = (SUGESTOES_SABORES[k.modelo || "livre"] || []).filter(n => !k.sabores.some(s => s.nome.trim().toLowerCase() === n.toLowerCase()));
  const addSabor = (nome: string) => { const n = nome.trim(); if (!n) return; set({ sabores: [...k.sabores, { id: novoId(), nome: n }] }); setNovoSabor(""); };
  const kitEx = kitsValidos(k)[0]?.qtd || (k.modo === "livre" ? k.livre.min : 50);
  const ex1 = sabores[0]?.nome.toLowerCase() || "brigadeiro", ex2 = sabores[1]?.nome.toLowerCase() || "beijinho";
  // 10/10: exemplo e aviso de quando o total do kit não fecha no "de quanto em quanto" (só avisa, não bloqueia)
  const passoS = Math.max(1, k.passo_sabor || 1);
  const exA = Math.min(kitEx, Math.max(passoS, Math.floor(kitEx / 2 / passoS) * passoS)), exB = kitEx - exA;
  const kitQuebrado = k.modo === "fechado" ? k.kits.find(x => x.qtd > 0 && x.qtd % passoS !== 0)?.qtd : undefined;
  const livreQuebrado = k.modo === "livre" && k.livre.min > 0 && k.livre.passo > 0 && (k.livre.min % passoS !== 0 || k.livre.passo % passoS !== 0);
  // 11/10: no modo livre, (máximo − mínimo) que não é múltiplo do passo
  const maxQuebrado = k.modo === "livre" && k.livre.min > 0 && k.livre.passo > 0 && k.livre.max > k.livre.min && (k.livre.max - k.livre.min) % k.livre.passo !== 0;

  // (14/10) no padrão das outras escolhas: títulos de seção, lista com linhas, sem cartões numerados.
  // Sem preço aqui (semPreco): os preços dos kits ficam no passo Preço.
  return (
    <div className="kq-tela kq-v2">
      <p className="kq-lbl">Sabores do kit</p>
      {/* (14/10) no padrão das outras escolhas: aviso cinza + tabela com cabeçalho e "Cadastrar" na última linha (sem os botões de sugestão nem o "Trocar o modelo") */}
      <div className="esc-aviso"><span className="esc-aviso-ic" aria-hidden="true">i</span>
        <p>Os sabores que o cliente pode misturar no kit. O preço de cada kit fica no último passo.</p></div>
      <div className="esc-tab esc-tab--1" role="table" aria-label="Sabores do kit">
        <div className="esc-tab-l esc-tab-h" role="row"><span role="columnheader">Sabor</span><span role="columnheader" aria-label="Tirar" /></div>
        {k.sabores.map(s => s.nome.trim() && (
          <div key={s.id} className="esc-tab-l" role="row">
            <span role="cell" className="esc-tab-nm">{s.nome}</span>
            <span role="cell"><button type="button" className="esc-op-x" onClick={() => set({ sabores: k.sabores.filter(x => x.id !== s.id) })} aria-label={`Tirar ${s.nome}`}><X size={16} weight="bold" /></button></span>
          </div>
        ))}
        <div className="esc-tab-add kq-addrow">
          <input placeholder={k.modelo === "salgados" ? "Outro sabor… (ex.: coxinha)" : "Outro sabor…"} value={novoSabor} aria-label="Outro sabor"
            onChange={e => setNovoSabor(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSabor(novoSabor); } }} />
          <button type="button" className="esc-nova-bt esc-nova-bt--txt" onClick={() => addSabor(novoSabor)} disabled={!novoSabor.trim()}>Cadastrar</button>
        </div>
      </div>

      <p className="kq-lbl">Como o cliente compra</p>
      <div className="kq-seg" role="radiogroup" aria-label="Como o cliente compra">
        <button type="button" role="radio" aria-checked={k.modo === "fechado"} className={k.modo === "fechado" ? "on" : ""}
          onClick={() => set({ modo: "fechado", kits: k.kits.length ? k.kits : [{ id: novoId(), qtd: 50, preco: 0 }, { id: novoId(), qtd: 100, preco: 0 }] })}>Pacotes prontos</button>
        <button type="button" role="radio" aria-checked={k.modo === "livre"} className={k.modo === "livre" ? "on" : ""} onClick={() => set({ modo: "livre" })}>Ele escolhe</button>
      </div>
      <p className="kq-dica">{k.modo === "fechado" ? "Kit de 50, de 100… cada um com o seu preço." : "Ele escolhe quantos quer, entre um mínimo e um máximo."}</p>
      {k.modo === "fechado" ? (
        <>
          <ul className="kq-lista">
            {k.kits.map(x => (
              <li key={x.id} className="kq-kit">
                <span>Kit de</span>
                <input className="kq-box" data-falta={`kitqtd-${x.id}`} inputMode="numeric" value={x.qtd || ""} placeholder="50" aria-label="Unidades do kit"
                  onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, qtd: Math.round(num(e.target.value)) } : y) })} />
                <span>unidades</span>
                {!semPreco && (
                  <span data-falta={`kit-${x.id}`} className={`kq-box kq-box--rs${x.preco > 0 ? " ok" : " falta"}`}>R$ <input inputMode="numeric" value={textoBRL(x.preco)} placeholder="0,00" aria-label="Preço do kit"
                    onChange={e => set({ kits: k.kits.map(y => y.id === x.id ? { ...y, preco: lerBRL(mascaraBRL(e.target.value)) } : y) })} /></span>
                )}
                <button type="button" onClick={() => set({ kits: k.kits.filter(y => y.id !== x.id) })} aria-label="Remover kit"><X size={16} weight="bold" /></button>
              </li>
            ))}
          </ul>
          <button type="button" className="kq-link" onClick={() => set({ kits: [...k.kits, { id: novoId(), qtd: 0, preco: 0 }] })}>+ Outro tamanho de kit</button>
        </>
      ) : (
        <ul className="kq-lista">
          <li className="kq-reg"><span>Mínimo</span><input className="kq-box" inputMode="numeric" value={k.livre.min || ""} aria-label="Mínimo" onChange={e => set({ livre: { ...k.livre, min: Math.round(num(e.target.value)) } })} /><em>un.</em></li>
          <li className="kq-reg"><span>Máximo</span><input className="kq-box" inputMode="numeric" value={k.livre.max || ""} aria-label="Máximo" onChange={e => set({ livre: { ...k.livre, max: Math.round(num(e.target.value)) } })} /><em>un.</em></li>
          <li className="kq-reg"><span>Sobe de quanto em quanto</span><input className="kq-box" inputMode="numeric" value={k.livre.passo || ""} aria-label="De quanto em quanto" onChange={e => set({ livre: { ...k.livre, passo: Math.round(num(e.target.value)) } })} /><em>un.</em></li>
          {!semPreco && (
            <li className="kq-reg"><span>Preço do cento</span><span className={`kq-box kq-box--rs${k.livre.preco_cento > 0 ? " ok" : " falta"}`}>R$ <input inputMode="numeric" value={textoBRL(k.livre.preco_cento)} placeholder="0,00" aria-label="Preço do cento"
              onChange={e => set({ livre: { ...k.livre, preco_cento: lerBRL(mascaraBRL(e.target.value)) } })} /></span></li>
          )}
        </ul>
      )}
      {maxQuebrado && <p className="kq-dica">O máximo de {k.livre.max} não fecha de {k.livre.passo} em {k.livre.passo}. O último passo vai até o máximo.</p>}

      <p className="kq-lbl">Como ele pode montar</p>
      <ul className="kq-lista">
        <li className="kq-reg"><span>Sabores no mesmo kit</span><input className="kq-box" inputMode="numeric" value={k.max_sabores || ""} aria-label="Máximo de sabores" onChange={e => set({ max_sabores: Math.round(num(e.target.value)) })} /><em>no máx.</em></li>
        <li className="kq-reg"><span>Cada sabor vem de</span><input className="kq-box" inputMode="numeric" value={k.passo_sabor || ""} aria-label="De quanto em quanto cada sabor" onChange={e => set({ passo_sabor: Math.round(num(e.target.value)) })} /><em>em {k.passo_sabor || "–"}</em></li>
      </ul>
      <p className="kq-nota">Exemplo no kit de {kitEx}: {exB > 0 && <><b>{exA} {ex1} + {exB} {ex2}</b>, ou </>}{kitEx} de um sabor só.
        {kitQuebrado ? ` O kit de ${kitQuebrado} não fecha de ${passoS} em ${passoS}: o último passo completa o que faltar.` : livreQuebrado ? ` Nem toda quantidade fecha de ${passoS} em ${passoS}: o último passo completa o que faltar.` : ""}
        {semPreco ? " O preço dos kits você coloca no último passo." : ""}</p>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .kq-card { border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 12px; margin: 10px 0 12px; background: var(--ui-branco); font-family: var(--font-base); }
  .kq-card--on { border-color: var(--ui-rosa); background: #FFF9FB; }
  .kq-head { display: flex; align-items: center; gap: 10px; }
  .kq-ico { width: 36px; height: 36px; border-radius: var(--ui-raio-p); background: #FCE7F3; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .kq-head-t { flex: 1; min-width: 0; }
  .kq-head-t b { display: block; font-size: 14px; color: var(--text-title); }
  .kq-head-t em { font-style: normal; font-size: 12px; background: var(--ui-rosa); color: var(--ui-branco); padding: 1px 5px; border-radius: 4px; margin-left: 4px; vertical-align: 2px; }
  .kq-head-t small { font-size: 12px; color: #888780; line-height: 1.35; display: block; }
  .kq-tg { width: 40px; height: 23px; border-radius: var(--ui-raio); border: none; background: #E5DDE0; position: relative; cursor: pointer; flex-shrink: 0; padding: 0; }
  .kq-tg i { position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: var(--ui-branco); transition: left .15s; }
  .kq-tg.on { background: var(--ui-rosa); } .kq-tg.on i { left: 20px; }

  .kq-tela { font-family: var(--font-base); color: var(--ui-texto); padding-bottom: 8px; }
  .kq-q { font-size: 22px; font-weight: 700; text-align: left; margin: 0 0 4px; color: var(--ui-texto); letter-spacing: -.02em; text-wrap: balance; }
  .kq-qs { text-align: left; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 0 0 16px; text-wrap: balance; }
  .kq-modelos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kq-mod { border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio-cartao); padding: 16px 12px; background: var(--ui-branco); display: flex; flex-direction: column; align-items: center; text-align: center; font-family: inherit; color: var(--ui-texto); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .kq-mod:hover { border-color: var(--ui-rosa); box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-mod-e { width: 52px; height: 52px; border-radius: 15px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .kq-mod-e img { width: 36px; height: 36px; object-fit: contain; }
  .kq-mod b { font-size: 15px; font-weight: 700; } .kq-mod small { font-size: 12px; color: #888780; line-height: 1.35; margin-top: 3px; text-wrap: balance; }
  .kq-mod--wide { grid-column: 1 / -1; display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; text-align: left; align-items: center; }
  .kq-mod--wide .kq-mod-e { grid-row: span 2; margin: 0; } .kq-mod--wide small { margin-top: 0; }
  .kq-mod ul { list-style: none; margin: 10px 0 0; padding: 0; flex: 1; } .kq-mod li { font-size: 12px; color: var(--ui-cinza-texto); padding: 3px 0; } .kq-mod li::before { content: "✓ "; color: #16a34a; font-weight: 700; }
  .kq-mod button { margin-top: 12px; height: 40px; border: none; border-radius: var(--ui-raio-p); background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .kq-mod--cm button { background: var(--ui-linha); color: var(--ui-texto); }
  .kq-modelo-on { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #888780; margin-top: 0; padding: 10px 12px; background: #FAF7F8; border-radius: var(--ui-raio); }
  .kq-modelo-on b { display: inline-flex; align-items: center; gap: 5px; color: var(--ui-texto); font-weight: 700; } .kq-modelo-on b svg { flex: none; color: var(--ui-rosa-escuro); }
  .kq-trocar { margin-left: auto; border: none; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .kq-chk { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 4px; }
  .kq-chk span { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 6px; background: #FFF7ED; color: var(--ui-laranja); } .kq-chk span.ok { background: #F0FDF4; color: var(--ui-verde); }
  .kq-grid2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; margin-top: 8px; }
  @media (min-width: 900px) {
    .kq-grid2 { grid-template-columns: minmax(0, 1fr) 290px; } .kq-prev { position: sticky; top: 0; align-self: start; }
    .kq-frase { flex-wrap: nowrap; gap: 6px; font-size: 14px; }
    .kq-box { width: 58px; padding: 7px 4px; }
    .kq-box--rs input { width: 60px; }
  }
  .kq-st { border: 1px solid #F0EBED; border-radius: var(--ui-raio-cartao); padding: 14px; margin-top: 12px; background: var(--ui-branco); }
  .kq-sth { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .kq-n { width: 28px; height: 28px; border-radius: 50%; background: var(--ui-vinho-escuro); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; } .kq-n.ok { background: #16a34a; }
  .kq-sth b { font-size: 15px; display: block; } .kq-sth small { font-size: 12px; color: #888780; }
  .kq-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .kq-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 8px 7px 12px; border-radius: 8px; background: #FCE7F3; color: #9D174D; font-weight: 700; font-size: 13px; }
  .kq-chip button { border: none; background: none; color: #C4789C; font-size: 12px; cursor: pointer; padding: 0 2px; }
  .kq-addrow { display: flex; gap: 8px; margin-top: 10px; }
  .kq-addrow input { flex: 1; min-width: 0; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 11px 12px; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
  .kq-addrow input:focus { outline: none; border-color: var(--ui-rosa); box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-addrow button { border: none; border-radius: var(--ui-raio-p); background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-weight: 700; font-size: 13px; padding: 0 14px; cursor: pointer; white-space: nowrap; } .kq-addrow button:disabled { opacity: .35; cursor: default; }
  .kq-sug-l { margin: 12px 0 6px; font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
  /* 10/10: as sugestões quebram linha (antes cortavam na borda: "+ Ni") */
  .kq-sug { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 2px; }
  .kq-sug button { min-height: 36px; white-space: nowrap; padding: 6px 11px; border: 1.5px dashed #F3C9DA; border-radius: 8px; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-weight: 700; font-size: 12.5px; cursor: pointer; }
  .kq-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
  .kq-op { border: 1.5px solid #EAE3E6; border-radius: 10px; padding: 11px; background: var(--ui-branco); text-align: left; font-family: inherit; cursor: pointer; color: var(--ui-texto); }
  .kq-op.on { border-color: var(--ui-texto); background: #FAF7F8; }
  .kq-op b { font-size: 13.5px; display: flex; align-items: center; gap: 8px; }
  .kq-op b i { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #C4B8BE; display: inline-block; flex-shrink: 0; } .kq-op.on b i { border: 5px solid var(--ui-texto); }
  .kq-op small { display: block; font-size: 13px; color: var(--ui-texto-2); margin-top: 3px; line-height: 1.4; }
  .kq-frase { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14.5px; padding: 9px 0; border-bottom: 1px solid var(--ui-linha); }
  .kq-box { width: 72px; border: 1.5px solid #EAE3E6; border-radius: var(--ui-raio-p); padding: 7px 8px; font-family: inherit; font-weight: 700; font-size: 14.5px; text-align: center; color: var(--ui-texto); background: var(--ui-branco); }
  .kq-box:focus, .kq-box--rs:focus-within { outline: none; border-color: var(--ui-texto); }
  .kq-box--rs { width: auto; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; font-size: 13px; color: var(--ui-texto-2); }
  .kq-box--rs input { width: 70px; border: none; outline: none; padding: 7px 0; font-family: inherit; font-weight: 700; font-size: 16px; color: var(--ui-texto); background: none; }
  .kq-box--rs.ok input { color: #16a34a; } .kq-box--rs.falta { border-color: #FDBA74; background: #FFF7ED; }
  .kq-x { margin-left: auto; border: none; background: none; color: #C4B8BE; font-size: 12px; cursor: pointer; padding: 4px; }
  .kq-link { border: none; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 13px; font-weight: 700; padding: 8px 0 0; cursor: pointer; }
  .kq-ex { font-size: 12px; color: #888780; margin: 8px 0 0; } .kq-ex b { color: var(--ui-cinza-texto); }
  .kq-prev { border-radius: 18px; background: #FAF7F8; padding: 14px; }
  .kq-prev h4 { font-size: 13px; color: #888780; margin: 0 0 10px; }
  .kq-prev > p { font-size: 12px; color: var(--ui-texto-2); line-height: 1.45; margin: 10px 2px 0; }
  .kq-ph { background: var(--ui-branco); border-radius: 20px; box-shadow: 0 0 0 6px #1b1b1d, 0 12px 26px rgba(0,0,0,.16); padding: 14px 12px; margin: 6px; }
  .kq-ph-t { display: block; font-size: 15px; font-weight: 700; margin-bottom: 8px; }
  .kq-ph-vazio { font-size: 12.5px; color: #888780; margin: 6px 0; line-height: 1.45; }
  /* Kit pronto numa linha: "Kit de [50] un. por [R$ 90,00] ×" */
  .kq-frase--kit { flex-wrap: nowrap; gap: 6px; }
  .kq-frase--kit .kq-t { white-space: nowrap; font-size: 14px; }
  .kq-box--qtd { width: 54px; padding: 7px 4px; flex-shrink: 0; }
  .kq-frase--kit .kq-box--rs { flex: 1; min-width: 0; max-width: 130px; }
  .kq-frase--kit .kq-box--rs input { width: 100%; min-width: 0; }
  @media (max-width: 767px) { .kq-opts { grid-template-columns: 1fr; } }
  /* (14/10) kit no padrão das outras escolhas */
  .kq-v2 .kq-lbl { margin: 22px 0 10px; font-size: 16px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
  .kq-v2 .kq-lbl:first-child { margin-top: 4px; }
  .kq-v2 .kq-lista { margin: 0; padding: 0; list-style: none; border: 1px solid var(--ui-borda); border-radius: 12px; overflow: hidden; background: var(--ui-branco); }
  .kq-v2 .kq-lista > li { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 6px 0 14px; font-size: 15px; }
  .kq-v2 .kq-lista > li + li { border-top: 1px solid var(--ui-linha); }
  .kq-v2 .kq-lista > li > span:first-child { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .kq-v2 .kq-lista > li > button { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 0; background: none; color: var(--ui-texto-3); cursor: pointer; }
  .kq-v2 .kq-kit > span:first-child { flex: none; }
  .kq-v2 .kq-kit > span:nth-child(3) { flex: 1; color: var(--ui-texto-2); }
  .kq-v2 .kq-reg { padding-right: 14px; }
  .kq-v2 .kq-reg em { flex: none; min-width: 44px; font-style: normal; font-size: 13.5px; color: var(--ui-texto-2); }
  .kq-v2 .kq-box { width: 64px; height: 40px; padding: 0 6px; border-radius: 8px; font-size: 16px; }
  .kq-v2 .kq-box--rs { width: auto; height: 40px; }
  .kq-v2 .kq-sug { margin: 12px 0 0; }
  .kq-v2 .kq-sug button { display: inline-flex; align-items: center; gap: 4px; border-color: #D8D1D5; color: var(--ui-texto); font-weight: 600; }
  .kq-v2 .kq-addrow { margin-top: 12px; }
  .kq-v2 .kq-addrow input { height: 48px; padding: 0 14px; border-radius: 10px; }
  .kq-v2 .kq-addrow button { min-height: 48px; padding: 0 16px; border-radius: 10px; background: var(--ui-rosa); }
  .kq-v2 .kq-link { display: block; padding: 10px 0 0; }
  .kq-v2 .kq-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: #F1EEF0; }
  .kq-v2 .kq-seg button { min-height: 44px; border: 0; border-radius: 9px; background: none; font-family: inherit; font-size: 14.5px; font-weight: 600; color: var(--ui-texto-2); cursor: pointer; }
  .kq-v2 .kq-seg button.on { background: #fff; color: var(--ui-texto); box-shadow: 0 1px 3px rgba(44,18,25,.12); }
  .kq-v2 .kq-dica { margin: 8px 0 10px; font-size: 13px; color: var(--ui-texto-2); }
  .kq-v2 .kq-nota { margin: 12px 0 0; padding: 10px 12px; border: 1.5px dashed #E7C2D2; border-radius: 8px; background: #FFFBFC; font-size: 12.5px; line-height: 1.45; color: var(--ui-texto-2); }
  .kq-v2 .kq-nota b { color: var(--ui-texto); }
`;
