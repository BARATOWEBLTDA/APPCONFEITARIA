import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, DotsThreeVertical, TextT, Info, MagnifyingGlass, Package, PencilSimple, Plus, PuzzlePiece, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
import { precoCardapioComPromocao } from "@/lib/precoCardapio";
import { explicarErro } from "@/lib/erros";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_COMPLEMENTOS, TOUR_COMPLEMENTOS } from "@/lib/comoTelas";
import { Botao, BotaoIA, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import { usePlano } from "@/hooks/usePlano";
import { LIMITE_COMPLEMENTOS_GRATIS } from "@/lib/limitesPlano";
import RecursoPro from "@/components/billing/RecursoPro";
import "./categorias.css";
import "./complementos.css";

/**
 * Personalização (09/10 · 3.54, no padrão do guia).
 * Extras que o cliente escolhe ao pedir (topo de bolo, escrita, papel de arroz). Cadastra uma vez e escolhe em quais produtos aparece.
 * Na tabela biblioteca_extras, "categorias" guarda os IDs dos produtos (vazio = aparece em todos).
 */
type Complemento = { id: string; nome: string; descricao?: string; valor: number; categorias: string[]; pede_referencia?: boolean; pede_frase?: boolean; categorias_cardapio?: string[] | null };
/** (24/10) onde aparece: em todos, nas categorias marcadas (pelo nome, como os produtos guardam) ou nos produtos marcados */
type Onde = "todos" | "categorias" | "produtos";
type ProdutoLite = { id: string; nome: string; categoria?: string; imagem_url?: string | null };
type Form = { nome: string; descricao: string; valor: number; gratis: boolean; onde: Onde; cats: string[]; produtos: string[]; pedeRef: boolean; pedeFrase: boolean };
const FORM_VAZIO: Form = { nome: "", descricao: "", valor: 0, gratis: false, onde: "todos", cats: [], produtos: [], pedeRef: false, pedeFrase: false };
const ondeDe = (c: Complemento): Onde => ((c.categorias_cardapio || []).length ? "categorias" : (c.categorias || []).length ? "produtos" : "todos");

/** "BOLO DE PAÇOCA" → "Bolo de Paçoca" */
function nomeBonito(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome;
  const preps = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "a", "o"]);
  return nome.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && preps.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lerPreco = (s: string) => { const d = s.replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; };
/** (30/10 · 5.31) explicação do complemento: no máximo 2 linhas no cardápio do celular */
const MAX_EXPLICACAO = 60;
/** (24/10) a primeira foto do produto (o campo guarda várias separadas por vírgula; antes a lista inteira ia no src e a foto quebrava) */
const primeiraFoto = (f?: string | null) => (f ? String(f).split(/,(?=\s*(?:https?:|\/))/)[0].trim() : "");

export default function Complementos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<Complemento[]>([]);
  const [produtos, setProdutos] = useState<ProdutoLite[]>([]);
  const [categorias, setCategorias] = useState<{ nome: string }[]>([]);
  const [temFrase, setTemFrase] = useState(false);
  const [busca, setBusca] = useState("");
  const [buscaProd, setBuscaProd] = useState("");
  const [menuDe, setMenuDe] = useState<Complemento | null>(null);
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState<Complemento | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [saving, setSaving] = useState(false);
  // (30/10 · 5.31) "Gerar com IA": 3 opções de explicação a partir do nome
  const [gerandoIa, setGerandoIa] = useState(false);
  const [opcoesIa, setOpcoesIa] = useState<string[]>([]);
  // (27/10) plano grátis: até 3 complementos (decisão de 25/10)
  const { isPro } = usePlano();
  const [limiteAberto, setLimiteAberto] = useState(false);
  const passouDoLimite = () => !isPro && items.length >= LIMITE_COMPLEMENTOS_GRATIS;

  // (11/10) a leitura falhou: mostra o erro com "Tentar de novo" em vez de "Cadastre um produto primeiro" ou "Nenhum complemento ainda"
  const [erroCarga, setErroCarga] = useState("");
  const carregar = async () => {
    setLoading(true); setErroCarga("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setErroCarga("Tente de novo em instantes."); setLoading(false); return; }
      setUserId(uid);
      const [{ data, error }, { data: prods, error: erroProds }, { data: cats }] = await Promise.all([
        supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome"),
        supabase.from("produtos").select("*").eq("user_id", uid).order("nome"),
        supabase.from("categorias").select("nome, ordem").eq("user_id", uid).order("ordem"),
      ]);
      setCategorias((cats as { nome: string }[]) || []);
      // (24/10) a opção "Uma frase" só aparece quando o banco já tem a coluna pede_frase (liga sozinha depois do SQL)
      const { error: semFrase } = await supabase.from("biblioteca_extras").select("pede_frase").limit(1);
      setTemFrase(!semFrase);
      if (error || erroProds || !data || !prods) setErroCarga(explicarErro(error || erroProds, "Tente de novo em instantes."));
      else { setItems(data as Complemento[]); setProdutos(prods as ProdutoLite[]); }
    } catch (e) {
      setErroCarga(explicarErro(e, "Tente de novo em instantes."));
    }
    setLoading(false);
  };
  useEffect(() => { void carregar(); }, []);

  const abrir = (c: Complemento | null, escolherProdutos = false) => {
    setOpcoesIa([]);
    if (!c && passouDoLimite()) { setLimiteAberto(true); return; }
    setEditando(c);
    setTentou(false);
    setBuscaProd("");
    setForm(c ? {
      nome: c.nome, descricao: c.descricao || "", valor: Number(c.valor) || 0, gratis: !(Number(c.valor) > 0),
      onde: escolherProdutos && ondeDe(c) === "todos" ? "categorias" : ondeDe(c),
      // (27/10) categoria ou produto que foi apagado sai daqui (antes ficava escondido e o complemento não aparecia em lugar nenhum)
      cats: (c.categorias_cardapio || []).filter(n => categorias.some(k => k.nome === n)), produtos: (c.categorias || []).filter(id => produtos.some(p => p.id === id)), pedeRef: c.pede_referencia === true, pedeFrase: c.pede_frase === true,
    } : FORM_VAZIO);
    setAberta(true);
  };
  const fechar = () => { setAberta(false); setOpcoesIa([]); };
  const gerarExplicacoes = async () => {
    const nome = form.nome.trim();
    if (!nome) { avisar("Escreva o nome do complemento primeiro.", { tipo: "erro" }); return; }
    setGerandoIa(true); setOpcoesIa([]);
    try {
      const res = await apiFetch("/api/gerar-descricao", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Uma confeitaria vende o adicional "${nome}" no cardápio digital (o cliente marca junto com o bolo ou doce). Escreva 3 opções diferentes de explicação curta que aparece embaixo do nome, dizendo o que vem ou o que o cliente escolhe. Cada uma com no máximo 50 caracteres, português do Brasil, frase simples, sem aspas, sem emoji, sem ponto final. Responda só as 3 opções, uma por linha, sem números.` }),
      });
      const data = await res.json();
      if (data?.error === "limite_diario") { avisar(data.message || "Você chegou ao limite de hoje. Amanhã libera de novo.", { tipo: "erro" }); return; }
      const texto: string = data?.content?.[0]?.text || "";
      const ops = texto.split("\n").map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["“]|["”]$/g, "").replace(/\.$/, "").trim())
        .filter(l => l.length > 2 && l.length <= MAX_EXPLICACAO).slice(0, 3);
      if (ops.length) setOpcoesIa(ops); else avisar("A IA não respondeu. Tente de novo.", { tipo: "erro" });
    } catch { avisar("A IA não respondeu. Tente de novo.", { tipo: "erro" }); }
    finally { setGerandoIa(false); }
  };

  const erroNome = tentou && !form.nome.trim() ? "Escreva o nome" : undefined;
  const erroValor = tentou && !form.gratis && form.valor <= 0 ? 'Escreva o valor ou marque Grátis' : undefined;
  const erroProdutos = tentou && form.onde === "produtos" && form.produtos.length === 0 ? "Marque pelo menos um produto"
    : tentou && form.onde === "categorias" && form.cats.length === 0 ? "Marque pelo menos uma categoria" : undefined;

  const salvar = async () => {
    setTentou(true);
    const nome = form.nome.trim();
    if (!nome || (!form.gratis && form.valor <= 0) || (form.onde === "produtos" && form.produtos.length === 0) || (form.onde === "categorias" && form.cats.length === 0)) return;
    const dados = { nome, descricao: form.descricao.trim() || null, valor: form.gratis ? 0 : form.valor, pede_referencia: form.pedeRef, ...(temFrase ? { pede_frase: form.pedeFrase } : {}),
      categorias: form.onde === "produtos" ? form.produtos : [], categorias_cardapio: form.onde === "categorias" ? form.cats : [] };
    setSaving(true);
    try {
      if (editando) {
        const { data, error } = await supabase.from("biblioteca_extras").update(dados).eq("id", editando.id).eq("user_id", userId).select().single();
        if (error) throw error;
        if (data) setItems(prev => prev.map(i => (i.id === editando.id ? (data as Complemento) : i)).sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        if (passouDoLimite()) { setLimiteAberto(true); return; }
        const { data, error } = await supabase.from("biblioteca_extras").insert({ user_id: userId, ...dados }).select().single();
        if (error) throw error;
        if (data) setItems(prev => [...prev, data as Complemento].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      fechar();
      avisar(editando ? "Complemento salvo" : "Complemento criado", { tipo: "ok" });
    } catch (err) {
      console.error(err);
      avisar("Não deu para salvar. Confira a internet e tente de novo.", { tipo: "erro" });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (c: Complemento) => {
    const ok = await confirmar({ titulo: `Excluir ${c.nome}?`, texto: "Ele some de todos os produtos do cardápio. Pedidos antigos não mudam.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("biblioteca_extras").delete().eq("id", c.id).eq("user_id", userId);
    if (error) { avisar("Não deu para excluir. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    setItems(prev => prev.filter(i => i.id !== c.id));
    avisar("Complemento excluído", { tipo: "ok" });
  };

  const alternarProduto = (id: string) => setForm(f => ({ ...f, produtos: f.produtos.includes(id) ? f.produtos.filter(x => x !== id) : [...f.produtos, id] }));
  const alternarCat = (nome: string) => setForm(f => ({ ...f, cats: f.cats.includes(nome) ? f.cats.filter(x => x !== nome) : [...f.cats, nome] }));
  // as categorias com produto, na ordem do cardápio, com a quantidade e a foto do primeiro produto
  const catsComProdutos = (() => {
    const nomes = [...categorias.map(c => c.nome), ...produtos.map(p => p.categoria || "").filter(n => n && !categorias.some(c => c.nome === n))];
    return [...new Set(nomes)].map(nome => {
      const dela = produtos.filter(p => (p.categoria || "") === nome);
      return { nome, n: dela.length, foto: primeiraFoto(dela.find(p => primeiraFoto(p.imagem_url))?.imagem_url) };
    }).filter(c => c.n > 0);
  })();
  const listaDeNomes = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`);
  const ondeAparece = (c: Complemento) => {
    const cc = c.categorias_cardapio || [];
    if (cc.length) return cc.length <= 2 ? `Em ${listaDeNomes(cc)}` : `Em ${cc.length} categorias`;
    const n = (c.categorias || []).filter(id => produtos.some(p => p.id === id)).length;
    if (!(c.categorias || []).length) return "Em todos os produtos";
    return n === 1 ? "Em 1 produto" : `Em ${n} produtos`;
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = items.filter(i => !termo || i.nome.toLowerCase().includes(termo));
  const termoProd = buscaProd.trim().toLowerCase();
  const produtosFiltrados = produtos.filter(p => !termoProd || p.nome.toLowerCase().includes(termoProd));

  const cabecalho = (
    <AppPageHeader voltar="/cadastros"
      title="Complementos" infoComo={COMO_COMPLEMENTOS} infoTour={TOUR_COMPLEMENTOS}
      subtitle={loading || items.length === 0 ? "Extras que o cliente escolhe no pedido" : `${items.length} ${items.length === 1 ? "cadastrado" : "cadastrados"}`}
      infoContent={<>
        <p>Complementos são opções que o cliente escolhe ao pedir um produto: topo de bolo, escrita, papel de arroz, tema.</p>
        <p>Cadastre uma vez aqui e escolha em quais produtos aparece. Mudou o preço aqui, muda em todos.</p>
      </>}
    />
  );

  return (
    <>
      {cabecalho}
      <div className="ct">
        {loading ? (
          <div className="ct-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
        ) : erroCarga ? (
          <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar os complementos" texto={erroCarga}
            acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>} />
        ) : produtos.length === 0 ? (
          <TelaVazia caixa icone={<Package size={30} />} titulo="Cadastre um produto primeiro"
            texto="O complemento aparece dentro dos produtos do cardápio. Cadastre pelo menos um produto antes."
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/produtos")}>Cadastrar produto</Botao>} />
        ) : items.length === 0 ? (
          /* (24/10) tela vazia com o exemplo de como fica no cardápio do celular, ao lado (as sugestões "Comece por uma destas" saíram) */
          <section className="pz-vazio">
            <div className="pz-vazio-tx">
              <h2>Venda mais em cada pedido</h2>
              <p>Topo de bolo, velas, papel de arroz e balões que o cliente escolhe na hora de pedir.</p>
              <ul className="pz-vazio-lista">
                <li><Check size={16} weight="bold" aria-hidden="true" />O valor soma sozinho no total</li>
                <li><Check size={16} weight="bold" aria-hidden="true" />Você escolhe onde ele aparece</li>
                <li><Check size={16} weight="bold" aria-hidden="true" />O cliente manda a foto da ideia junto</li>
              </ul>
              <Botao icone={<Plus size={20} weight="bold" />} onClick={() => abrir(null)}>Criar complemento</Botao>
            </div>
            <ExemploCardapio />
          </section>
        ) : (
          /* (24/10) com complementos: a lista à esquerda e, ao lado, o celular com os complementos dela num produto de verdade */
          <div className="pz-cheio">
            <div className="pz-cheio-l">
              <Titulo contagem={items.length} apoio="Toque em um para editar."
                acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => abrir(null)}><span className="ct-g">Novo complemento</span><span className="ct-c">Novo</span></Botao>}>Seus complementos</Titulo>
              {items.length > 8 && (
                <label className="pz-busca">
                  <MagnifyingGlass size={20} weight="bold" />
                  <input type="search" placeholder="Buscar complemento" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar complemento" autoComplete="off" />
                  {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
                </label>
              )}
              {filtrados.length === 0 ? (
                <p className="pz-semres">Nenhum complemento com esse nome.</p>
              ) : (
                <>
                {/* (24/10) computador e tablet: cartões em grade, como em Produtos. Celular: a lista */}
                <section className="pz-grade">
                  {filtrados.map(c => {
                    const gratis = !(Number(c.valor) > 0);
                    const pede = [c.pede_referencia ? "Foto" : "", c.pede_frase ? "Frase" : ""].filter(Boolean).join(" e ");
                    return (
                      <div key={c.id} className="pz-cc">
                        <button type="button" className="pz-cc-b" onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`}>
                          <span className="pz-cc-top" aria-hidden="true">{c.pede_referencia ? <Camera size={34} weight="duotone" /> : c.pede_frase ? <TextT size={34} weight="duotone" /> : <PuzzlePiece size={34} weight="duotone" />}</span>
                          <span className="pz-cc-in">
                            <b className="pz-cc-nome" title={c.nome}>{c.nome}</b>
                            <span className="pz-cc-l"><small>Preço</small><em className={gratis ? "g" : ""}>{gratis ? "Grátis" : `+ R$ ${brl(Number(c.valor))}`}</em></span>
                            <span className="pz-cc-l"><small>Aparece</small><em>{ondeAparece(c).replace(/^Em /, "")}</em></span>
                            <span className="pz-cc-l"><small>O cliente manda</small><em className={pede ? "r" : "n"}>{pede || "Nada"}</em></span>
                          </span>
                        </button>
                        <BotaoIcone className="pz-cc-menu" rotulo={`Opções de ${c.nome}`} variante="limpo" onClick={() => setMenuDe(c)}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
                      </div>
                    );
                  })}
                </section>
                <section className="pz-lista">
                  {filtrados.map(c => {
                    const gratis = !(Number(c.valor) > 0);
                    const pede = [c.pede_referencia ? "Pede foto" : "", c.pede_frase ? "Pede frase" : ""].filter(Boolean).join(" · ");
                    return (
                      <div key={c.id} className="pz-li">
                        <button type="button" className="pz-li-b" onClick={() => abrir(c)}>
                          <span className="pz-li-ic" aria-hidden="true">{c.pede_referencia ? <Camera size={22} weight="duotone" /> : c.pede_frase ? <TextT size={22} weight="duotone" /> : <PuzzlePiece size={22} weight="duotone" />}</span>
                          <span className="pz-li-tx"><b>{c.nome}</b><small>{ondeAparece(c)}</small>{pede && <small className="pz-li-pede">{pede}</small>}</span>
                          <span className={`pz-preco${gratis ? " g" : ""}`}>{gratis ? "Grátis" : `+ R$ ${brl(Number(c.valor))}`}</span>
                        </button>
                        <BotaoIcone rotulo={`Opções de ${c.nome}`} variante="limpo" onClick={() => setMenuDe(c)}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
                      </div>
                    );
                  })}
                </section>
                </>
              )}
            </div>
            <PreviaReal itens={items} produtos={produtos} />
          </div>
        )}
      </div>

      {/* menu */}
      <Janela aberta={!!menuDe} aoFechar={() => setMenuDe(null)} tipo="conteudo" titulo={menuDe?.nome || ""}>
        {menuDe && (
          <div className="ct-menu">
            <button type="button" onClick={() => { const c = menuDe; setMenuDe(null); abrir(c); }}><PencilSimple size={20} weight="bold" />Editar</button>
            <button type="button" onClick={() => { const c = menuDe; setMenuDe(null); abrir(c, true); }}><Package size={20} weight="bold" />Escolher os produtos</button>
            <button type="button" className="perigo" onClick={() => { const c = menuDe; setMenuDe(null); excluir(c); }}><Trash size={20} weight="bold" />Excluir</button>
          </div>
        )}
      </Janela>

      {/* nova / editar */}
      {limiteAberto && <RecursoPro titulo={`${LIMITE_COMPLEMENTOS_GRATIS} complementos no plano grátis`} texto={`No plano grátis, a loja tem até ${LIMITE_COMPLEMENTOS_GRATIS} complementos. Apague um para criar outro, ou assine o PRO para ter quantos quiser.`} onClose={() => setLimiteAberto(false)} />}
      <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" travada titulo={editando ? "Editar complemento" : "Novo complemento"}
        acoes={<><Botao variante="secundario" onClick={fechar}>Cancelar</Botao><Botao onClick={salvar} carregando={saving}>{editando ? "Salvar" : "Criar"}</Botao></>}>
        <div className="pz-form">
          {/* (30/10 · 5.32) PC: janela larga em duas colunas, sem rolar: o complemento à esquerda e onde aparece (a lista de produtos) à direita */}
          <div className="pz-c1">
          <Campo rotulo="Nome" obrigatorio placeholder="Ex.: topo de bolo, escrita, papel de arroz" value={form.nome} maxLength={50} erro={erroNome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          {/* (30/10 · 5.31) caixa maior, até 60 letras (2 linhas no cardápio) e "Gerar com IA" com 3 opções; as sugestões fixas saíram */}
          <div className="pz-exp">
            <CampoArea rotulo="Explicação para o cliente" opcional rows={2} placeholder="Ex.: escolha o tema e o nome que vai no topo" value={form.descricao} maxLength={MAX_EXPLICACAO}
              dica={`Aparece embaixo do nome, no cardápio · ${form.descricao.length}/${MAX_EXPLICACAO}`} onChange={e => setForm(f => ({ ...f, descricao: e.target.value.replace(/\n/g, " ") }))} />
            <BotaoIA className="pz-ia" carregando={gerandoIa} onClick={gerarExplicacoes}>{opcoesIa.length ? "Gerar outras" : "Gerar com IA"}</BotaoIA>
            {opcoesIa.length > 0 && (
              <div className="pz-ia-ops" role="group" aria-label="Opções da IA">
                {opcoesIa.map(t => (
                  <button key={t} type="button" className={form.descricao === t ? "on" : ""} onClick={() => setForm(f => ({ ...f, descricao: t }))}>{t}</button>
                ))}
              </div>
            )}
          </div>

          {/* (24/10) o preço num campo só, com a caixinha "Grátis" ao lado (antes "Cobrar ou Grátis" e depois o valor) */}
          <div className="pz-preco-l">
            <Campo rotulo="Quanto soma no pedido" prefixo="R$" inputMode="numeric" placeholder={form.gratis ? "Grátis" : "0,00"} erro={erroValor} disabled={form.gratis}
              value={!form.gratis && form.valor > 0 ? brl(form.valor) : ""} onChange={e => setForm(f => ({ ...f, valor: lerPreco(e.target.value) }))} />
            <button type="button" role="checkbox" aria-checked={form.gratis} className="pz-gratis" onClick={() => setForm(f => ({ ...f, gratis: !f.gratis }))}>
              <i className="pz-chk" aria-hidden="true">{form.gratis && <Check size={14} weight="bold" />}</i>Grátis
            </button>
          </div>

          {/* (19/10) prévia ao vivo: como o cliente vê no cardápio */}
          <div className="pz-prev" aria-hidden="true">
            <small>Assim aparece para o cliente</small>
            <div className="pz-ex-l on"><i><Check size={14} weight="bold" /></i>
              <span className="pz-prev-tx"><span>{form.nome.trim() || "Nome do complemento"}</span>{form.descricao.trim() && <em>{form.descricao.trim()}</em>}</span>
              <b className={form.gratis ? "g" : ""}>{form.gratis ? "Grátis" : `+ R$ ${brl(form.valor || 0)}`}</b></div>
            {form.pedeRef && <div className="pz-prev-ref"><Camera size={16} weight="bold" aria-hidden="true" />Enviar foto de referência</div>}
            {form.pedeFrase && <div className="pz-prev-ref pz-prev-frase"><TextT size={16} weight="bold" aria-hidden="true" />Qual frase vai no bolo?</div>}
          </div>

          {/* (19/10) complemento que pede foto (ex.: Topo de bolo): no cardápio, ao marcar, o cliente anexa a referência */}
          {/* (24/10) o que o complemento pede ao cliente: foto e/ou frase, num quadro só */}
          <div className="pz-pede">
            <span className="pz-pede-t">O cliente precisa mandar</span>
          <button type="button" role="checkbox" aria-checked={form.pedeRef} className="pz-ref pz-ref--l" onClick={() => setForm(f => ({ ...f, pedeRef: !f.pedeRef }))}>
            <i className="pz-chk" aria-hidden="true">{form.pedeRef && <Check size={14} weight="bold" />}</i>
            <span><b>Uma foto de referência</b><small>Ex.: topo de bolo, papel de arroz</small></span>
          </button>
            {temFrase && <button type="button" role="checkbox" aria-checked={form.pedeFrase} className="pz-ref pz-ref--l" onClick={() => setForm(f => ({ ...f, pedeFrase: !f.pedeFrase }))}>
              <i className="pz-chk" aria-hidden="true">{form.pedeFrase && <Check size={14} weight="bold" />}</i>
              <span><b>Uma frase</b><small>Ex.: escrita no bolo, cartão</small></span>
            </button>}
          </div>

          </div>
          <div className="pz-c2">
          {/* (24/10) onde aparece: 3 opções em lista (antes "Em todos / Escolher" e uma lista solta de produtos) */}
          <div className="ui-campo">
            <span className="ui-campo-r"><span>Onde aparece no cardápio</span></span>
            <div className="pz-onde" role="radiogroup" aria-label="Onde aparece no cardápio">
              {([
                ["todos", "Em todos os produtos", `${produtos.length} ${produtos.length === 1 ? "produto" : "produtos"}`],
                ["categorias", "Em categorias", form.cats.length ? listaDeNomes(form.cats) : "Produto novo da categoria já recebe"],
                ["produtos", "Em produtos escolhidos", form.produtos.length ? `${form.produtos.length} ${form.produtos.length === 1 ? "marcado" : "marcados"}` : "Marque um por um"],
              ] as [Onde, string, string][]).map(([k, t, d]) => (
                <div key={k} className={`pz-onde-op${form.onde === k ? " on" : ""}`}>
                  <button type="button" role="radio" aria-checked={form.onde === k} className="pz-onde-b" onClick={() => setForm(f => ({ ...f, onde: k }))}>
                    <i aria-hidden="true" /><span><b>{t}</b><small>{d}</small></span>
                  </button>
                  {form.onde === k && k === "categorias" && (
                    <div className="pz-onde-l">
                      {catsComProdutos.map(c => {
                        const on = form.cats.includes(c.nome);
                        return (
                          <button key={c.nome} type="button" role="checkbox" aria-checked={on} className="pz-it" onClick={() => alternarCat(c.nome)}>
                            <span className="pz-it-f">{c.foto ? <img src={c.foto} alt="" /> : <Camera size={18} weight="bold" aria-label="Sem foto" />}</span>
                            <span className="pz-it-n"><b>{c.nome}</b><small>{c.n} {c.n === 1 ? "produto" : "produtos"}</small></span>
                            <i className="pz-chk" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {form.onde === k && k === "produtos" && (
                    <div className="pz-onde-l">
                      {produtos.length > 8 && (
                        <label className="pz-busca pz-busca--p">
                          <MagnifyingGlass size={18} weight="bold" />
                          <input type="search" placeholder="Buscar produto" value={buscaProd} onChange={e => setBuscaProd(e.target.value)} aria-label="Buscar produto" autoComplete="off" />
                        </label>
                      )}
                      {catsComProdutos.map(c => {
                        const dela = produtosFiltrados.filter(p => (p.categoria || "") === c.nome);
                        if (!dela.length) return null;
                        const todosOn = dela.every(p => form.produtos.includes(p.id));
                        return (
                          <div key={c.nome} className="pz-grupo">
                            <div className="pz-grupo-cab"><span>{c.nome}</span>
                              <button type="button" onClick={() => setForm(f => ({ ...f, produtos: todosOn ? f.produtos.filter(id => !dela.some(p => p.id === id)) : [...new Set([...f.produtos, ...dela.map(p => p.id)])] }))}>{todosOn ? "Desmarcar" : "Marcar todos"}</button>
                            </div>
                            {dela.map(p => {
                              const on = form.produtos.includes(p.id);
                              return (
                                <button key={p.id} type="button" role="checkbox" aria-checked={on} className="pz-it" onClick={() => alternarProduto(p.id)}>
                                  <span className="pz-it-f">{primeiraFoto(p.imagem_url) ? <img src={primeiraFoto(p.imagem_url)} alt="" /> : <Camera size={18} weight="bold" aria-label="Sem foto" />}</span>
                                  <span className="pz-it-n"><b>{nomeBonito(p.nome)}</b></span>
                                  <i className="pz-chk" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                      {produtosFiltrados.filter(p => !catsComProdutos.some(c => c.nome === (p.categoria || ""))).map(p => {
                        const on = form.produtos.includes(p.id);
                        return (
                          <button key={p.id} type="button" role="checkbox" aria-checked={on} className="pz-it" onClick={() => alternarProduto(p.id)}>
                            <span className="pz-it-f">{primeiraFoto(p.imagem_url) ? <img src={primeiraFoto(p.imagem_url)} alt="" /> : <Camera size={18} weight="bold" aria-label="Sem foto" />}</span>
                            <span className="pz-it-n"><b>{nomeBonito(p.nome)}</b></span>
                            <i className="pz-chk" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                          </button>
                        );
                      })}
                      {produtosFiltrados.length === 0 && <p className="pz-semres">Nenhum produto com esse nome.</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {erroProdutos && <p className="ui-campo-msg pz-erro" role="alert">{erroProdutos}</p>}
          </div>
          </div>
        </div>
      </Janela>
    </>
  );
}

/** (24/10) Exemplo, num celular, de como os complementos aparecem para o cliente no produto do cardápio */
function ExemploCardapio() {
  return (
    <figure className="pz-cel-wrap" aria-label="Exemplo de como o cliente vê os complementos no cardápio">
      <div className="pz-cel" aria-hidden="true">
        <div className="pz-cel-tela">
          <img className="pz-cel-foto" src="/tutorial/complementos-bolo.webp" alt="" />
          <div className="pz-cel-prod"><b>Bolo Floresta Negra</b><span>R$ 120,00</span></div>
          <div className="pz-cel-cab"><b>Adicionais</b><small>Escolha quantos quiser</small></div>
          <div className="pz-cel-op on"><span><b>Topo de bolo</b><small>Com o tema e o nome</small></span><em>+ R$ 15,00</em><i><Check size={11} weight="bold" /></i></div>
          <div className="pz-cel-ref"><Camera size={13} weight="bold" />Enviar foto de referência</div>
          <div className="pz-cel-op"><span><b>Velas decorativas</b></span><em>+ R$ 5,00</em><i /></div>
          <div className="pz-cel-op"><span><b>Decoração simples</b></span><em className="g">Grátis</em><i /></div>
          <div className="pz-cel-bt">Adicionar · R$ 135,00</div>
        </div>
      </div>
      {/* (24/10) balão do diferencial: o cliente manda a foto da ideia (só no computador) */}
      <div className="pz-balao" aria-hidden="true"><small>Menos WhatsApp</small><b>A foto da ideia já vem no pedido</b></div>
      <figcaption>Assim o cliente vê no cardápio</figcaption>
    </figure>
  );
}

/** (24/10) Os complementos dela, como o cliente vê, dentro de um produto em que eles aparecem */
function PreviaReal({ itens, produtos }: { itens: Complemento[]; produtos: ProdutoLite[] }) {
  const aparece = (c: Complemento, p: ProdutoLite) => {
    const cc = c.categorias_cardapio || [];
    if (cc.length) return cc.includes(p.categoria || "");
    return !(c.categorias || []).length || (c.categorias || []).includes(p.id);
  };
  // o produto com mais complementos (empate: o que tem foto)
  const prod = [...produtos].sort((a, b) => (itens.filter(c => aparece(c, b)).length - itens.filter(c => aparece(c, a)).length) || (primeiraFoto(b.imagem_url) ? 1 : 0) - (primeiraFoto(a.imagem_url) ? 1 : 0))[0];
  if (!prod) return null;
  const lista = itens.filter(c => aparece(c, prod)).slice(0, 4);
  if (!lista.length) return null;
  const preco = precoCardapioComPromocao(prod as any);
  const marcado = lista[0];
  const total = preco.final + (Number(marcado.valor) || 0);
  const rs = (v: number) => `R$ ${brl(v)}`;
  return (
    <figure className="pz-cel-wrap pz-cel-wrap--real" aria-label={`Como o cliente vê os complementos em ${prod.nome}`}>
      <figcaption>Assim o cliente vê no cardápio</figcaption>
      <div className="pz-cel" aria-hidden="true">
        <div className="pz-cel-tela">
          {primeiraFoto(prod.imagem_url) ? <img className="pz-cel-foto" src={primeiraFoto(prod.imagem_url)} alt="" /> : <div className="pz-cel-foto pz-cel-foto--sem"><Camera size={28} /></div>}
          <div className="pz-cel-prod"><b>{prod.nome}</b><span>{preco.aPartir ? "a partir de " : ""}{rs(preco.final)}</span></div>
          <div className="pz-cel-cab"><b>Adicionais</b><small>Escolha quantos quiser</small></div>
          {lista.map((c, k) => {
            const g = !(Number(c.valor) > 0);
            return (
              <Fragment key={c.id}>
                <div className={`pz-cel-op${k === 0 ? " on" : ""}`}><span><b>{c.nome}</b>{c.descricao && <small>{c.descricao}</small>}</span><em className={g ? "g" : ""}>{g ? "Grátis" : `+ ${rs(Number(c.valor))}`}</em><i>{k === 0 && <Check size={11} weight="bold" />}</i></div>
                {k === 0 && c.pede_referencia && <div className="pz-cel-ref"><Camera size={13} weight="bold" />Enviar foto de referência</div>}
                {k === 0 && c.pede_frase && <div className="pz-cel-ref"><TextT size={13} weight="bold" />Qual frase vai no bolo?</div>}
              </Fragment>
            );
          })}
          <div className="pz-cel-bt">Adicionar · {rs(total)}</div>
        </div>
      </div>
    </figure>
  );
}
