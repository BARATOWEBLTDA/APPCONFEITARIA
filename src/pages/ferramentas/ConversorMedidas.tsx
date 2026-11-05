import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretRight, Copy, Info, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Campo, Gaveta, avisar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { INGREDIENTES, MEDIDAS, ML, emGramas, emMl, fotoIngrediente, ilustracaoIngrediente, gramasTexto, lerQuantidade, numeroReceita, type Ingrediente, type Medida } from "@/lib/medidas";
import "./ferramentas.css";

/**
 * (6.150) Conversor de medidas: escolhe o ingrediente, a quantidade e a medida; o resultado aparece na hora.
 * Também faz o caminho de volta (gramas → xícaras) e aceita ingredientes que ela cadastra.
 */
const FRACOES: [string, string][] = [["¼", "1/4"], ["⅓", "1/3"], ["½", "1/2"], ["1", "1"], ["1 ½", "1 1/2"], ["2", "2"], ["3", "3"]];
const PESOS: [string, string][] = [["50", "50"], ["100", "100"], ["200", "200"], ["250", "250"], ["395", "395"], ["500", "500"]];
const TABELA = ["farinha", "acucar", "chocolate-po", "manteiga", "oleo", "leite", "leite-condensado", "amido"];
const PRIMEIROS = ["acucar", "manteiga", "chocolate-po", "leite-condensado"];
const CHAVE_RECENTES = "doonly_conv_recentes";

const nomeMedida = (m: Medida, n: number) => { const x = MEDIDAS.find(y => y.v === m)!; return n > 1.001 ? x.varios : x.um; };
const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function lerRecentes(): string[] {
  try { const v = JSON.parse(localStorage.getItem(CHAVE_RECENTES) || "[]"); return Array.isArray(v) && v.length ? v : PRIMEIROS; } catch { return PRIMEIROS; }
}

function Foto({ i, g }: { i: Ingrediente; g?: boolean }) {
  // foto real; sem internet ou se o CDN falhar, a ilustração da tigela
  return <img className={`fm-foto${g ? " g" : ""}${i.proprio ? " il" : ""}`} src={fotoIngrediente(i, g ? 192 : 96)} alt="" loading="lazy"
    onError={e => { const im = e.currentTarget; const il = ilustracaoIngrediente(i); if (!im.src.endsWith(il)) { im.src = il; im.classList.add("il"); } }} />;
}

export default function ConversorMedidas() {
  const [proprios, setProprios] = useState<Ingrediente[]>([]);
  const todos = useMemo(() => [...proprios, ...INGREDIENTES], [proprios]);
  const [ing, setIng] = useState<Ingrediente>(INGREDIENTES[0]);
  const [qtdTxt, setQtdTxt] = useState("2");
  const [medida, setMedidaBruta] = useState<Medida>("xicara");
  const [recentes, setRecentes] = useState<string[]>(lerRecentes);
  const [lista, setLista] = useState(false);
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState<{ nome: string; g: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  // ingredientes que ela cadastrou (sem a tabela no banco, a lista do app segue funcionando)
  useEffect(() => {
    let vivo = true;
    supabase.from("ingredientes_proprios").select("id, nome, gramas_xicara").order("nome").then(({ data, error }) => {
      if (!vivo || error || !data) return;
      setProprios(data.map((d: { id: string; nome: string; gramas_xicara: number | string }) => ({ id: `p:${d.id}`, nome: d.nome, xicara: Number(d.gramas_xicara), grupo: "Seus", proprio: true })));
    }, () => {});
    return () => { vivo = false; };
  }, []);

  // trocar entre gramas e medidas de volume: põe uma quantidade que faz sentido
  const setMedida = (m: Medida) => {
    const peso = m === "g" || m === "ml", antes = medida === "g" || medida === "ml";
    if (peso !== antes) setQtdTxt(peso ? "100" : "1");
    setMedidaBruta(m);
  };

  const escolher = (i: Ingrediente) => {
    setIng(i);
    setRecentes(r => {
      const n = [i.id, ...r.filter(x => x !== i.id)].slice(0, 5);
      try { localStorage.setItem(CHAVE_RECENTES, JSON.stringify(n)); } catch { /* sem armazenamento */ }
      return n;
    });
  };

  const qtd = lerQuantidade(qtdTxt);
  const ml = qtd > 0 ? emMl(ing, qtd, medida) : 0;
  const g = qtd > 0 ? emGramas(ing, qtd, medida) : 0;
  const deGramas = medida === "g";

  // resultado grande: gramas (ou, vindo de gramas, a medida caseira que fica mais fácil de usar)
  const caseira = (v: number): [string, Medida] => v >= 60 ? [numeroReceita(v / ML.xicara), "xicara"] : v >= 7.5 ? [numeroReceita(v / ML.csopa), "csopa"] : [numeroReceita(v / ML.ccha), "ccha"];
  const [nCas, mCas] = caseira(ml);
  const grande = !(qtd > 0) ? "—" : deGramas ? `${nCas} ${nomeMedida(mCas, ml / ML[mCas])}` : gramasTexto(g);
  const frase = !(qtd > 0) ? "Digite a quantidade" : deGramas ? `${gramasTexto(qtd)} de ${ing.nome.toLowerCase()}` : `${numeroReceita(qtd)} ${nomeMedida(medida, qtd)} de ${ing.nome.toLowerCase()}`;

  // a mesma quantidade em outras medidas
  const outras = useMemo(() => {
    if (!(qtd > 0)) return [];
    const ja = deGramas ? mCas : medida;
    const r = (["xicara", "csopa", "copo", "ccha"] as const).filter(m => m !== ja).map(m => {
      const n = ml / ML[m];
      return n >= 0.25 && n <= 48 ? `${numeroReceita(n)} ${nomeMedida(m, n)}` : "";
    }).filter(Boolean).slice(0, 2);
    if (medida !== "ml") r.push(`${Math.round(ml)} ml`);
    if (deGramas || medida === "ml") r.unshift(gramasTexto(g));
    return deGramas ? r.slice(1) : r;
  }, [qtd, medida, ml, g, deGramas, mCas]);

  const achados = useMemo(() => {
    const t = semAcento(busca);
    return todos.filter(i => !t || semAcento(i.nome).includes(t));
  }, [busca, todos]);
  const temExato = todos.some(i => semAcento(i.nome) === semAcento(busca));

  const copiar = () => {
    navigator.clipboard?.writeText(`${frase} = ${grande}`).then(() => avisar("Copiado."), () => {});
  };

  const fecharLista = () => { setLista(false); setBusca(""); setNovo(null); };

  const salvarNovo = async () => {
    if (!novo) return;
    const nome = novo.nome.trim(), gx = Number(novo.g.replace(",", "."));
    if (!nome) { avisar("Digite o nome do ingrediente.", { tipo: "erro" }); return; }
    if (!(gx > 0 && gx < 2000)) { avisar("Digite quanto pesa 1 xícara, em gramas.", { tipo: "erro" }); return; }
    setSalvando(true);
    const { data, error } = await supabase.from("ingredientes_proprios").insert({ nome, gramas_xicara: gx }).select("id, nome, gramas_xicara").single();
    setSalvando(false);
    if (error || !data) { avisar("Não deu para salvar o ingrediente. Tente de novo.", { tipo: "erro" }); return; }
    const i: Ingrediente = { id: `p:${data.id}`, nome: data.nome, xicara: Number(data.gramas_xicara), grupo: "Seus", proprio: true };
    setProprios(p => [...p, i].sort((a, b) => a.nome.localeCompare(b.nome)));
    escolher(i);
    fecharLista();
    avisar("Ingrediente salvo.");
  };

  const rapidos = medida === "g" || medida === "ml" ? PESOS : FRACOES;
  const recentesVis = recentes.map(id => todos.find(i => i.id === id)).filter((i): i is Ingrediente => !!i && i.id !== ing.id).slice(0, 3);

  return (
    <>
      <AppPageHeader title="Conversor de medidas" subtitle="Xícaras, colheres e gramas" voltar="/inicio" />
      <div className="fm">
        <div className="fm-grade">
          <section className="fm-card fm-conv" aria-label="Converter">
            <span className="fm-rot">Ingrediente</span>
            <button type="button" className="fm-ing" onClick={() => setLista(true)}>
              <Foto i={ing} />
              <span className="fm-ing-tx"><b>{ing.nome}</b><small>1 xícara = {gramasTexto(ing.xicara)}</small></span>
              <CaretDown size={18} weight="bold" aria-hidden="true" />
            </button>
            {recentesVis.length > 0 && (
              <div className="fm-rec" role="group" aria-label="Usados por último">
                {recentesVis.map(i => (
                  <button type="button" key={i.id} onClick={() => escolher(i)}><Foto i={i} /><span>{i.nome}</span></button>
                ))}
              </div>
            )}
            <div className="fm-dois">
              <label className="fm-campo fm-qtd">
                <span className="fm-rot">Quantidade</span>
                <input inputMode="decimal" value={qtdTxt} onChange={e => setQtdTxt(e.target.value)} placeholder={deGramas ? "Ex.: 300" : "Ex.: 1 1/2"} />
              </label>
              <label className="fm-campo fm-med">
                <span className="fm-rot">Medida</span>
                <span className="fm-sel">
                  <select value={medida} onChange={e => setMedida(e.target.value as Medida)}>
                    {MEDIDAS.map(m => <option key={m.v} value={m.v}>{m.v === "g" ? "Gramas" : m.um.charAt(0).toUpperCase() + m.um.slice(1)}</option>)}
                  </select>
                  <CaretDown size={16} weight="bold" aria-hidden="true" />
                </span>
              </label>
            </div>
            <div className="fm-rap" role="group" aria-label="Quantidades rápidas">
              {rapidos.map(([t, v]) => <button type="button" key={v} className={qtd === lerQuantidade(v) ? "on" : ""} onClick={() => setQtdTxt(v)}>{t}</button>)}
            </div>
          </section>

          <section className="fm-res" aria-live="polite">
            <Foto i={ing} g />
            <small className="fm-res-de">{frase}</small>
            <strong className={`fm-res-g${deGramas ? " fm-res-g--txt" : ""}`}>{deGramas && qtd > 0 ? "≈ " : ""}{grande}</strong>
            {outras.length > 0 && (
              <div className="fm-res-tb"><span>Também é</span>{outras.map(o => <b key={o}>{o}</b>)}</div>
            )}
            {qtd > 0 && <button type="button" className="fm-copiar" onClick={copiar}><Copy size={16} weight="bold" aria-hidden="true" />Copiar</button>}
          </section>

          <section className="fm-card fm-tab" aria-label="Quanto pesa 1 xícara">
            <h2 className="fm-tit">Quanto pesa 1 xícara</h2>
            {TABELA.map(id => INGREDIENTES.find(i => i.id === id)!).map(i => (
              <button type="button" key={i.id} className={`fm-li${i.id === ing.id ? " on" : ""}`} onClick={() => { escolher(i); setMedidaBruta("xicara"); setQtdTxt("1"); }}>
                <Foto i={i} /><span>{i.nome}</span><b>{gramasTexto(i.xicara)}</b>
              </button>
            ))}
            <button type="button" className="fm-todos" onClick={() => setLista(true)}>Ver os {todos.length} ingredientes<CaretRight size={16} weight="bold" aria-hidden="true" /></button>
          </section>

          <p className="fm-nota"><Info size={16} weight="bold" aria-hidden="true" />Xícara de 240 ml, sem apertar e nivelada. São medidas aproximadas: na balança fica exato.</p>
        </div>
      </div>

      <Gaveta aberta={lista} aoFechar={fecharLista} titulo={novo ? "Novo ingrediente" : "Escolher ingrediente"}
        rodape={novo ? <Botao cheio carregando={salvando} onClick={salvarNovo}>Salvar ingrediente</Botao> : undefined}>
        {novo ? (
          <div className="fm-novo">
            <Campo rotulo="Nome" value={novo.nome} maxLength={60} onChange={e => setNovo({ ...novo, nome: e.target.value })} />
            <Campo rotulo="Quanto pesa 1 xícara" inputMode="decimal" placeholder="Ex.: 150" value={novo.g} onChange={e => setNovo({ ...novo, g: e.target.value })}
              depois={<span className="fm-un">g</span>} dica="Encha 1 xícara de 240 ml sem apertar, nivele e pese uma vez. Fica salvo para as próximas." />
          </div>
        ) : (
          <>
            <label className="fm-busca"><MagnifyingGlass size={18} weight="bold" aria-hidden="true" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ingrediente" /></label>
            {busca.trim() && !temExato && (
              <button type="button" className="fm-add" onClick={() => setNovo({ nome: busca.trim().charAt(0).toUpperCase() + busca.trim().slice(1), g: "" })}>
                <span className="fm-add-ic" aria-hidden="true"><Plus size={18} weight="bold" /></span>
                <span>Adicionar “{busca.trim()}”</span>
              </button>
            )}
            <div className="fm-lista">
              {achados.map(i => (
                <button type="button" key={i.id} className={`fm-li${i.id === ing.id ? " on" : ""}`} onClick={() => { escolher(i); fecharLista(); }}>
                  <Foto i={i} /><span>{i.nome}{i.proprio && <em className="fm-seu">Seu</em>}</span><b>{gramasTexto(i.xicara)}</b>
                </button>
              ))}
              {!achados.length && <p className="fm-vazio">Não está na lista. Adicione acima e informe quanto pesa 1 xícara.</p>}
            </div>
          </>
        )}
      </Gaveta>
    </>
  );
}
