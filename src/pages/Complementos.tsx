import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Check, DotsThreeVertical, Info, MagnifyingGlass, Package, PencilSimple, Plus, PuzzlePiece, Trash, X } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, BotaoIcone, Campo, CampoArea, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import "./categorias.css";
import "./complementos.css";

/**
 * Personalização (09/10 · 3.54, no padrão do guia).
 * Extras que o cliente escolhe ao pedir (topo de bolo, escrita, papel de arroz). Cadastra uma vez e escolhe em quais produtos aparece.
 * Na tabela biblioteca_extras, "categorias" guarda os IDs dos produtos (vazio = aparece em todos).
 */
type Complemento = { id: string; nome: string; descricao?: string; valor: number; categorias: string[] };
type ProdutoLite = { id: string; nome: string; categoria?: string; imagem_url?: string | null };
type Form = { nome: string; descricao: string; valor: number; gratis: boolean; todos: boolean; produtos: string[] };
const FORM_VAZIO: Form = { nome: "", descricao: "", valor: 0, gratis: false, todos: true, produtos: [] };

/** "BOLO DE PAÇOCA" → "Bolo de Paçoca" */
function nomeBonito(nome: string): string {
  if (nome !== nome.toUpperCase()) return nome;
  const preps = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "a", "o"]);
  return nome.toLowerCase().split(/\s+/).map((w, i) => (i > 0 && preps.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}
const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lerPreco = (s: string) => { const d = s.replace(/\D/g, ""); return d ? parseInt(d, 10) / 100 : 0; };

export default function Complementos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [items, setItems] = useState<Complemento[]>([]);
  const [produtos, setProdutos] = useState<ProdutoLite[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaProd, setBuscaProd] = useState("");
  const [menuDe, setMenuDe] = useState<Complemento | null>(null);
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState<Complemento | null>(null);
  const [form, setForm] = useState<Form>(FORM_VAZIO);
  const [tentou, setTentou] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) { setLoading(false); return; }
      setUserId(uid);
      const [{ data }, { data: prods }] = await Promise.all([
        supabase.from("biblioteca_extras").select("*").eq("user_id", uid).order("nome"),
        supabase.from("produtos").select("id, nome, categoria, imagem_url").eq("user_id", uid).order("nome"),
      ]);
      setItems((data as Complemento[]) || []);
      setProdutos((prods as ProdutoLite[]) || []);
      setLoading(false);
    })();
  }, []);

  const abrir = (c: Complemento | null, escolherProdutos = false) => {
    setEditando(c);
    setTentou(false);
    setBuscaProd("");
    setForm(c ? {
      nome: c.nome, descricao: c.descricao || "", valor: Number(c.valor) || 0, gratis: !(Number(c.valor) > 0),
      todos: escolherProdutos ? false : !(c.categorias || []).length, produtos: c.categorias || [],
    } : FORM_VAZIO);
    setAberta(true);
  };
  const fechar = () => setAberta(false);

  const erroNome = tentou && !form.nome.trim() ? "Escreva o nome" : undefined;
  const erroValor = tentou && !form.gratis && form.valor <= 0 ? 'Escreva o valor ou marque "Grátis"' : undefined;
  const erroProdutos = tentou && !form.todos && form.produtos.length === 0 ? "Marque pelo menos um produto" : undefined;

  const salvar = async () => {
    setTentou(true);
    const nome = form.nome.trim();
    if (!nome || (!form.gratis && form.valor <= 0) || (!form.todos && form.produtos.length === 0)) return;
    const dados = { nome, descricao: form.descricao.trim() || null, valor: form.gratis ? 0 : form.valor, categorias: form.todos ? [] : form.produtos };
    setSaving(true);
    try {
      if (editando) {
        const { data, error } = await supabase.from("biblioteca_extras").update(dados).eq("id", editando.id).eq("user_id", userId).select().single();
        if (error) throw error;
        if (data) setItems(prev => prev.map(i => (i.id === editando.id ? (data as Complemento) : i)).sort((a, b) => a.nome.localeCompare(b.nome)));
      } else {
        const { data, error } = await supabase.from("biblioteca_extras").insert({ user_id: userId, ...dados }).select().single();
        if (error) throw error;
        if (data) setItems(prev => [...prev, data as Complemento].sort((a, b) => a.nome.localeCompare(b.nome)));
      }
      fechar();
      avisar(editando ? "Personalização salva" : "Personalização criada", { tipo: "ok" });
    } catch (err) {
      console.error(err);
      avisar("Não deu pra salvar. Confira a internet e tente de novo.", { tipo: "erro" });
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (c: Complemento) => {
    const ok = await confirmar({ titulo: `Excluir ${c.nome}?`, texto: "Ela some de todos os produtos do cardápio. Pedidos antigos não mudam.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("biblioteca_extras").delete().eq("id", c.id).eq("user_id", userId);
    if (error) { avisar("Não deu pra excluir. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    setItems(prev => prev.filter(i => i.id !== c.id));
    avisar("Personalização excluída", { tipo: "ok" });
  };

  const alternarProduto = (id: string) => setForm(f => ({ ...f, produtos: f.produtos.includes(id) ? f.produtos.filter(x => x !== id) : [...f.produtos, id] }));
  const ondeAparece = (c: Complemento) => {
    const n = (c.categorias || []).filter(id => produtos.some(p => p.id === id)).length;
    if (!(c.categorias || []).length) return "Em todos os produtos";
    return n === 1 ? "Em 1 produto" : `Em ${n} produtos`;
  };

  const termo = busca.trim().toLowerCase();
  const filtrados = items.filter(i => !termo || i.nome.toLowerCase().includes(termo));
  const termoProd = buscaProd.trim().toLowerCase();
  const produtosFiltrados = produtos.filter(p => !termoProd || p.nome.toLowerCase().includes(termoProd));

  const cabecalho = (
    <AppPageHeader
      title="Personalização"
      subtitle={loading || items.length === 0 ? "Extras que o cliente escolhe no pedido" : `${items.length} ${items.length === 1 ? "cadastrada" : "cadastradas"}`}
      infoContent={<>
        <p>Personalizações são opções que o cliente escolhe ao pedir um produto: topo de bolo, escrita, papel de arroz, tema.</p>
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
        ) : produtos.length === 0 ? (
          <TelaVazia caixa icone={<Package size={30} />} titulo="Cadastre um produto primeiro"
            texto="A personalização aparece dentro dos produtos do cardápio. Cadastre pelo menos um produto antes."
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/produtos")}>Cadastrar produto</Botao>} />
        ) : items.length === 0 ? (<>
          <TelaVazia caixa icone={<PuzzlePiece size={30} />} titulo="Nenhuma personalização ainda"
            texto="Cadastre extras como topo de bolo, escrita e papel de arroz. O cliente escolhe na hora de pedir e o valor soma no total."
            acao={<Botao icone={<Plus size={20} weight="bold" />} onClick={() => abrir(null)}>Criar personalização</Botao>} />
          <section className="pz-ex" aria-label="Exemplo de como aparece no cardápio">
            <p className="pz-ex-t">Assim aparece pro cliente</p>
            <div className="pz-ex-l on"><i><Check size={14} weight="bold" /></i><span>Topo de bolo</span><b>+ R$ 15,00</b></div>
            <div className="pz-ex-l"><i /><span>Papel de arroz</span><b>+ R$ 10,00</b></div>
            <div className="pz-ex-l"><i /><span>Escrita no bolo</span><b className="g">Grátis</b></div>
          </section>
        </>) : (<>
          <Titulo contagem={items.length} apoio="Escolha uma personalização pra editar."
            acao={<Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => abrir(null)}><span className="ct-g">Nova personalização</span><span className="ct-c">Nova</span></Botao>}>Suas personalizações</Titulo>
          {items.length > 8 && (
            <label className="pz-busca">
              <MagnifyingGlass size={20} weight="bold" />
              <input type="search" placeholder="Buscar personalização" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar personalização" autoComplete="off" />
              {busca && <button type="button" aria-label="Limpar a busca" onClick={() => setBusca("")}><X size={18} weight="bold" /></button>}
            </label>
          )}
          {filtrados.length === 0 ? (
            <p className="pz-semres">Nenhuma personalização com esse nome.</p>
          ) : (
            <section className="ct-card">
              {filtrados.map(c => {
                const gratis = !(Number(c.valor) > 0);
                return (
                  <div key={c.id} className="ct-row">
                    <button type="button" className="ct-row-b" onClick={() => abrir(c)}>
                      <span className="ct-ic"><PuzzlePiece size={24} weight="duotone" /></span>
                      <span className="ct-row-tx"><b>{c.nome}</b><small>{ondeAparece(c)}</small></span>
                      <span className={`pz-preco${gratis ? " g" : ""}`}>{gratis ? "Grátis" : `+ R$ ${brl(Number(c.valor))}`}</span>
                    </button>
                    <BotaoIcone rotulo={`Opções de ${c.nome}`} variante="limpo" onClick={() => setMenuDe(c)}><DotsThreeVertical size={20} weight="bold" /></BotaoIcone>
                  </div>
                );
              })}
            </section>
          )}
          <p className="ct-dica"><Info size={20} weight="bold" aria-hidden="true" />O cliente vê as personalizações na hora de escolher o produto no cardápio.</p>
        </>)}
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
      <Janela aberta={aberta} aoFechar={fechar} tipo="conteudo" travada titulo={editando ? "Editar personalização" : "Nova personalização"}
        acoes={<><Botao variante="secundario" onClick={fechar}>Cancelar</Botao><Botao onClick={salvar} carregando={saving}>{editando ? "Salvar" : "Criar"}</Botao></>}>
        <div className="pz-form">
          <Campo rotulo="Nome" obrigatorio placeholder="Ex.: topo de bolo, escrita, papel de arroz" value={form.nome} maxLength={50} erro={erroNome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          <CampoArea rotulo="Explicação pro cliente" opcional placeholder="Ex.: escolha um tema ou envie sua imagem" value={form.descricao} maxLength={140} rows={2}
            dica="Aparece embaixo do nome, no cardápio." onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />

          <div className="ui-campo">
            <span className="ui-campo-r"><span>Preço</span></span>
            <div className="pz-seg" role="radiogroup" aria-label="Preço">
              <button type="button" role="radio" aria-checked={!form.gratis} onClick={() => setForm(f => ({ ...f, gratis: false }))}>Cobrar</button>
              <button type="button" role="radio" aria-checked={form.gratis} onClick={() => setForm(f => ({ ...f, gratis: true }))}>Grátis</button>
            </div>
          </div>
          {!form.gratis && (
            <Campo rotulo="Quanto soma no pedido" prefixo="R$" inputMode="numeric" placeholder="0,00" erro={erroValor}
              value={form.valor > 0 ? brl(form.valor) : ""} onChange={e => setForm(f => ({ ...f, valor: lerPreco(e.target.value) }))} />
          )}

          <div className="ui-campo">
            <span className="ui-campo-r"><span>Em quais produtos aparece</span></span>
            <div className="pz-seg" role="radiogroup" aria-label="Em quais produtos aparece">
              <button type="button" role="radio" aria-checked={form.todos} onClick={() => setForm(f => ({ ...f, todos: true }))}>Em todos</button>
              <button type="button" role="radio" aria-checked={!form.todos} onClick={() => setForm(f => ({ ...f, todos: false }))}>Escolher</button>
            </div>
          </div>
          {!form.todos && (
            <div className="pz-prods">
              <div className="pz-prods-cab">
                <span>{form.produtos.length === 0 ? "Nenhum marcado" : form.produtos.length === 1 ? "1 marcado" : `${form.produtos.length} marcados`}</span>
                {form.produtos.length > 0 && <Botao variante="link" tamanho="p" onClick={() => setForm(f => ({ ...f, produtos: [] }))}>Desmarcar todos</Botao>}
              </div>
              {produtos.length > 8 && (
                <label className="pz-busca">
                  <MagnifyingGlass size={20} weight="bold" />
                  <input type="search" placeholder="Buscar produto" value={buscaProd} onChange={e => setBuscaProd(e.target.value)} aria-label="Buscar produto" autoComplete="off" />
                </label>
              )}
              <div className="pz-prods-l">
                {produtosFiltrados.map(p => {
                  const on = form.produtos.includes(p.id);
                  return (
                    <button key={p.id} type="button" role="checkbox" aria-checked={on} className="pz-prod" onClick={() => alternarProduto(p.id)}>
                      <i className="pz-chk" aria-hidden="true">{on && <Check size={14} weight="bold" />}</i>
                      <span className="pz-prod-f">{p.imagem_url ? <img src={p.imagem_url} alt="" /> : <Camera size={20} weight="bold" aria-label="Sem foto" />}</span>
                      <span className="pz-prod-n">{nomeBonito(p.nome)}</span>
                    </button>
                  );
                })}
                {produtosFiltrados.length === 0 && <p className="pz-semres">Nenhum produto com esse nome.</p>}
              </div>
              {erroProdutos && <p className="ui-campo-msg pz-erro" role="alert">{erroProdutos}</p>}
            </div>
          )}
        </div>
      </Janela>
    </>
  );
}
