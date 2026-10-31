import { pluralSabor } from "@/lib/kitTexto";
import { CaixasEscolha } from "@/components/base";
import { useState } from "react";
import { mascaraBRL, lerBRL, textoBRL } from "@/lib/moeda";
import { Cookie, ForkKnife, PencilSimple, X } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  KIT_VAZIO, KitQtdConfig, erroKit, kitsValidos, novoId, presetKit,
} from "@/lib/kitQuantidade";
import { parseNumBR } from "@/lib/numeroBR";
import { avisar } from "@/components/base/Aviso";

/**
 * Kit por quantidade no cadastro: sabores, como o cliente compra e como ele pode montar.
 * (15/10) sai o modo "compacto" (cartão com chave), que não era mais usado.
 */
interface Props {
  kit?: KitQtdConfig | null;
  onChange: (k: KitQtdConfig) => void;
  /** (14/10) sem os campos de preço (o preço dos kits vai pro passo Preço) */
  semPreco?: boolean;
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

export default function KitQuantidadeEditor({ kit, onChange, semPreco = false }: Props) {
  const k: KitQtdConfig = { ...KIT_VAZIO, ...(kit || {}), livre: { ...KIT_VAZIO.livre, ...(kit?.livre || {}) } };
  const set = (patch: Partial<KitQtdConfig>) => onChange({ ...k, ...patch });
  const [novoSabor, setNovoSabor] = useState("");

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

  const sabores = k.sabores.filter(s => s.nome.trim());
  const normS = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  // (15/10) sabor repetido não entra (igual aos recheios): avisa e limpa o campo
  const addSabor = (nome: string) => {
    const n = nome.trim(); if (!n) return;
    if (k.sabores.some(x => normS(x.nome) === normS(n))) { avisar(`${n} já está na lista`, { tipo: "info" }); setNovoSabor(""); return; }
    set({ sabores: [...k.sabores, { id: novoId(), nome: n }] }); setNovoSabor("");
  };
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
      <p className="kq-lbl">{k.modo === "livre" ? "Sabores" : "Sabores do kit"}</p>
      {/* (14/10) no padrão das outras escolhas: aviso cinza + tabela com cabeçalho e "Cadastrar" na última linha (sem os botões de sugestão nem o "Trocar o modelo") */}
      <div className="esc-aviso"><span className="esc-aviso-ic" aria-hidden="true">i</span>
        <p>{k.modo === "livre" ? "Os sabores que o cliente pode misturar. O preço do cento fica no último passo." : "Os sabores que o cliente pode misturar no kit. O preço de cada kit fica no último passo."}</p></div>
      <div className="esc-tab esc-tab--1" role="table" aria-label="Sabores do kit">
        {sabores.length > 0 && <div className="esc-tab-l esc-tab-h" role="row"><span role="columnheader">Sabor</span><span role="columnheader" aria-label="Tirar" /></div>}
        {k.sabores.map(s => s.nome.trim() && (
          <div key={s.id} className="esc-tab-l" role="row">
            <span role="cell" className="esc-tab-nm">{s.nome}</span>
            <span role="cell"><button type="button" className="esc-op-x" onClick={() => set({ sabores: k.sabores.filter(x => x.id !== s.id) })} aria-label={`Tirar ${s.nome}`}><X size={16} weight="bold" /></button></span>
          </div>
        ))}
        <div className="esc-tab-add kq-addrow">
          <input placeholder="Outro sabor…" value={novoSabor} aria-label="Outro sabor"
            onChange={e => setNovoSabor(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSabor(novoSabor); } }} />
          <button type="button" className="esc-nova-bt esc-nova-bt--txt" onClick={() => addSabor(novoSabor)} disabled={!novoSabor.trim()}>Cadastrar</button>
        </div>
      </div>

      <p className="kq-lbl">Como o cliente compra</p>
      {/* (29/10 · 5.04) caixinhas com o que cada uma faz (antes: seletor de 2 partes + uma dica embaixo) */}
      <CaixasEscolha rotulo="Como o cliente compra" valor={k.modo === "livre" ? "livre" : "fechado"} opcoes={[
        { v: "fechado", t: "Pacotes prontos", sub: "Kit de 50, de 100… cada um com o seu preço" },
        { v: "livre", t: "Ele escolhe", sub: "Quantos quiser, entre um mínimo e um máximo" },
      ]} onMudar={v => v === "livre" ? set({ modo: "livre" }) : set({ modo: "fechado", kits: k.kits.length ? k.kits : [{ id: novoId(), qtd: 50, preco: 0 }, { id: novoId(), qtd: 100, preco: 0 }] })} />
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
          <li className="kq-reg"><span>De quanto em quanto</span><input className="kq-box" inputMode="numeric" value={k.livre.passo || ""} aria-label="De quanto em quanto" onChange={e => set({ livre: { ...k.livre, passo: Math.round(num(e.target.value)) } })} /><em>un.</em></li>
          {!semPreco && (
            <li className="kq-reg"><span>Preço do cento</span><span className={`kq-box kq-box--rs${k.livre.preco_cento > 0 ? " ok" : " falta"}`}>R$ <input inputMode="numeric" value={textoBRL(k.livre.preco_cento)} placeholder="0,00" aria-label="Preço do cento"
              onChange={e => set({ livre: { ...k.livre, preco_cento: lerBRL(mascaraBRL(e.target.value)) } })} /></span></li>
          )}
        </ul>
      )}
      {maxQuebrado && <p className="kq-dica">O máximo de {k.livre.max} não fecha de {k.livre.passo} em {k.livre.passo}. O último passo vai até o máximo.</p>}

      <p className="kq-lbl">Como ele pode montar</p>
      <ul className="kq-lista">
        <li className="kq-reg"><span>{k.modo === "livre" ? "Sabores por pedido" : "Sabores no mesmo kit"}</span><input className="kq-box" inputMode="numeric" value={k.max_sabores || ""} aria-label="Máximo de sabores" onChange={e => set({ max_sabores: Math.round(num(e.target.value)) })} /><em>no máx.</em></li>
        <li className="kq-reg"><span>Cada sabor vem de</span><input className="kq-box" inputMode="numeric" value={k.passo_sabor || ""} aria-label="De quanto em quanto cada sabor" onChange={e => set({ passo_sabor: Math.round(num(e.target.value)) })} /><em>em {k.passo_sabor || "–"}</em></li>
      </ul>
      <div className="esc-aviso kq-nota"><span className="esc-aviso-ic" aria-hidden="true">i</span><p>{k.modo === "livre" ? `Exemplo com ${kitEx} unidades: ` : `Exemplo no kit de ${kitEx}: `}{exB > 0 && <><b className="kq-ex">{exA} {pluralSabor(ex1, exA)} + {exB} {pluralSabor(ex2, exB)}</b>, ou </>}{kitEx} de um sabor só.
        {kitQuebrado ? ` O kit de ${kitQuebrado} não fecha de ${passoS} em ${passoS}: o último passo completa o que faltar.` : livreQuebrado ? ` Nem toda quantidade fecha de ${passoS} em ${passoS}: o último passo completa o que faltar.` : ""}
        {semPreco ? (k.modo === "livre" ? " O preço do cento você coloca no último passo." : " O preço dos kits você coloca no último passo.") : ""}</p></div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .esc-aviso b.kq-ex { display: inline; margin: 0; font-size: inherit; }

  .kq-tela { font-family: var(--font-base); color: var(--ui-texto); padding-bottom: 8px; }
  .kq-q { font-size: 22px; font-weight: 600; text-align: left; margin: 0 0 4px; color: var(--ui-texto); letter-spacing: -.02em; text-wrap: balance; }
  .kq-qs { text-align: left; font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 0 0 16px; text-wrap: balance; }
  .kq-modelos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .kq-mod { border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio-cartao); padding: 16px 12px; background: var(--ui-branco); display: flex; flex-direction: column; align-items: center; text-align: center; font-family: inherit; color: var(--ui-texto); cursor: pointer; transition: border-color .15s, box-shadow .15s; }
  .kq-mod:hover { border-color: var(--ui-rosa); box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-mod-e { width: 52px; height: 52px; border-radius: 15px; background: #FFF1F6; color: var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .kq-mod b { font-size: 15px; font-weight: 600; } .kq-mod small { font-size: 12px; color: #888780; line-height: 1.35; margin-top: 3px; text-wrap: balance; }
  .kq-mod--wide { grid-column: 1 / -1; display: grid; grid-template-columns: 52px 1fr; column-gap: 12px; text-align: left; align-items: center; }
  .kq-mod--wide .kq-mod-e { grid-row: span 2; margin: 0; } .kq-mod--wide small { margin-top: 0; }
  .kq-addrow { display: flex; gap: 8px; margin-top: 10px; }
  .kq-addrow input { flex: 1; min-width: 0; border: 1.5px solid var(--ui-borda-campo); border-radius: var(--ui-raio); padding: 11px 12px; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
  .kq-addrow input:focus { outline: none; border-color: var(--ui-rosa); box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .kq-addrow button { border: none; border-radius: var(--ui-raio-p); background: var(--ui-vinho-escuro); color: var(--ui-branco); font-family: inherit; font-weight: 600; font-size: 13px; padding: 0 14px; cursor: pointer; white-space: nowrap; } .kq-addrow button:disabled { opacity: .35; cursor: default; }
  .kq-box { width: 72px; border: 1.5px solid #EAE3E6; border-radius: var(--ui-raio-p); padding: 7px 8px; font-family: inherit; font-weight: 600; font-size: 14.5px; text-align: center; color: var(--ui-texto); background: var(--ui-branco); }
  .kq-box:focus, .kq-box--rs:focus-within { outline: none; border-color: var(--ui-texto); }
  .kq-box--rs { width: auto; display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; font-size: 13px; color: var(--ui-texto-2); }
  .kq-box--rs input { width: 70px; border: none; outline: none; padding: 7px 0; font-family: inherit; font-weight: 600; font-size: 16px; color: var(--ui-texto); background: none; }
  .kq-box--rs.ok input { color: #16a34a; } .kq-box--rs.falta { border-color: #FDBA74; background: #FFF7ED; }
  .kq-link { border: none; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 13px; font-weight: 600; padding: 8px 0 0; cursor: pointer; }
  /* (14/10) kit no padrão das outras escolhas */
  .kq-v2 .kq-lbl { margin: 22px 0 10px; font-size: 16px; font-weight: 600; line-height: 1.3; color: var(--ui-texto); }
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
  .kq-v2 .kq-addrow { margin-top: 12px; }
  .kq-v2 .kq-addrow input { height: 48px; padding: 0 14px; border-radius: 10px; }
  .kq-v2 .kq-addrow button { min-height: 48px; padding: 0 16px; border-radius: 10px; background: var(--ui-rosa); }
  .kq-v2 .kq-link { display: block; padding: 10px 0 0; }
  .kq-v2 .kq-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 4px; border-radius: 12px; background: #F1EEF0; }
  .kq-v2 .kq-seg button { min-height: 44px; border: 0; border-radius: 9px; background: none; font-family: inherit; font-size: 14.5px; font-weight: 600; color: var(--ui-texto-2); cursor: pointer; }
  .kq-v2 .kq-seg button.on { background: #fff; color: var(--ui-texto); box-shadow: 0 1px 3px rgba(44,18,25,.12); }
  .kq-v2 .kq-dica { margin: 8px 0 10px; font-size: 13px; color: var(--ui-texto-2); }
  .kq-v2 .kq-nota { margin: 12px 0 0; }
  .kq-v2 .kq-nota b { color: var(--ui-texto); }
`;
