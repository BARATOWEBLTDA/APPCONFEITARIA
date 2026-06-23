import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";

interface Insumo {
  id: string;
  nome: string;
  categoria: string;
  unidade: string;
  quantidade_estoque: number;
  estoque_minimo: number;
  valor_compra: number;
  fornecedor: string;
  imagem_url: string;
  qtd_embalagem: number;
  custo_unitario: number;
}

interface Movimentacao {
  id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  motivo: string;
  created_at: string;
}

const CATEGORIAS_DEFAULT = ["Ingredientes","Embalagens","Decorações","Bebidas","Limpeza","Descartáveis","Outros"];
const UNIDADES_DEFAULT = [
  { sigla: "g", nome: "Grama", tipo: "peso" },
  { sigla: "kg", nome: "Quilograma", tipo: "peso" },
  { sigla: "ml", nome: "Mililitro", tipo: "volume" },
  { sigla: "L", nome: "Litro", tipo: "volume" },
  { sigla: "un", nome: "Unidade", tipo: "unidade" },
  { sigla: "dz", nome: "Dúzia", tipo: "unidade" },
];

const emptyForm = { nome: "", marca: "", categoria: "Ingredientes", subcategoria: "", descricao: "", unidade: "", quantidade_estoque: "", estoque_minimo: "", valor_compra: "", fornecedor: "", imagem_url: "", qtd_embalagem: "1", validade_exata: "" };

type Step = "lista" | "dados" | "imagem" | "buscar" | "selecionar" | "revisar" | "sucesso" | "detalhe";
type Ordenacao = "nome" | "estoque" | "valor";

export default function Insumos() {
  const { isPro } = usePlano();
  const [userId, setUserId] = useState<string | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("nome");
  const [step, setStep] = useState<Step>("lista");
  const [form, setForm] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagensBusca, setImagensBusca] = useState<string[]>([]);
  const [buscandoImagem, setBuscandoImagem] = useState(false);
  const [termoBuscaImg, setTermoBuscaImg] = useState("");
  const [imagemSelecionada, setImagemSelecionada] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_DEFAULT);
  const [unidades, setUnidades] = useState(UNIDADES_DEFAULT);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaUnidade, setNovaUnidade] = useState("");
  const [showNovaCategoria, setShowNovaCategoria] = useState(false);
  const [showNovaUnidade, setShowNovaUnidade] = useState(false);
  const [modoCompleto, setModoCompleto] = useState(false);
  const [ultimoCadastrado, setUltimoCadastrado] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewInsumo, setPreviewInsumo] = useState<Insumo | null>(null);
  const [insumoDetalhe, setInsumoDetalhe] = useState<Insumo | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [showMovModal, setShowMovModal] = useState(false);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movQtd, setMovQtd] = useState("");
  const [movMotivo, setMovMotivo] = useState("");
  const [savingMov, setSavingMov] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [showNovaMarca, setShowNovaMarca] = useState(false);
  const [novaMarca, setNovaMarca] = useState("");
  const [showBuscarModal, setShowBuscarModal] = useState(false);
  const [temValidade, setTemValidade] = useState(true);
  const [validadeMedia, setValidadeMedia] = useState("");

  const loadInsumos = async (uid: string) => {
    const { data } = await supabase.from("insumos").select("*").eq("user_id", uid).order("nome");
    if (data) setInsumos(data);
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadInsumos(user.id);
      const { data: cats } = await supabase.from("insumo_categorias").select("nome").or(`is_default.eq.true,user_id.eq.${user.id}`).order("nome");
      if (cats && cats.length > 0) setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...cats.map((c: any) => c.nome)])]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (step === "buscar" && termoBuscaImg.trim() && imagensBusca.length === 0) {
      buscarImagens();
    }
  }, [step]);

  const calcCustoUnitario = (valorCompra: string, qtdEmbalagem: string) => {
    const v = parseFloat(valorCompra) || 0;
    const q = parseFloat(qtdEmbalagem) || 1;
    return q > 0 ? (v / q).toFixed(4) : "0";
  };

  const totalEstoque = insumos.reduce((acc, i) => acc + (i.quantidade_estoque * i.valor_compra), 0);
  const alertas = insumos.filter(i => i.quantidade_estoque > 0 && i.quantidade_estoque <= i.estoque_minimo);
  const semEstoque = insumos.filter(i => i.quantidade_estoque <= 0);

  const insumosFiltrados = insumos
    .filter(i => {
      const matchBusca = i.nome.toLowerCase().includes(busca.toLowerCase());
      const matchCat = filtroCategoria === "Todas" || i.categoria === filtroCategoria;
      return matchBusca && matchCat;
    })
    .sort((a, b) => {
      if (ordenacao === "nome") return a.nome.localeCompare(b.nome);
      if (ordenacao === "estoque") return a.quantidade_estoque - b.quantidade_estoque;
      if (ordenacao === "valor") return b.valor_compra - a.valor_compra;
      return 0;
    });

  const openNovo = () => { setForm(emptyForm); setEditId(null); setImagemSelecionada(null); setStep("dados"); };
  const openEditar = (insumo: Insumo) => {
    setForm({ ...insumo, quantidade_estoque: insumo.quantidade_estoque?.toString() || "", estoque_minimo: insumo.estoque_minimo?.toString() || "", valor_compra: insumo.valor_compra?.toString() || "", qtd_embalagem: insumo.qtd_embalagem?.toString() || "1" });
    setEditId(insumo.id);
    setImagemSelecionada(insumo.imagem_url || null);
    setStep("dados");
  };

  const openDetalhe = async (insumo: Insumo) => {
    setInsumoDetalhe(insumo);
    const { data } = await supabase.from("insumo_movimentacoes").select("*").eq("insumo_id", insumo.id).order("created_at", { ascending: false }).limit(20);
    if (data) setMovimentacoes(data);
    setStep("detalhe");
  };

  const buscarImagens = async () => {
    if (!termoBuscaImg.trim()) return;
    setBuscandoImagem(true);
    setImagensBusca([]);
    try {
      const res = await fetch(`/api/buscar-imagem?q=${encodeURIComponent(termoBuscaImg)}`);
      const data = await res.json();
      if (data.images) setImagensBusca(data.images);
    } catch (e) { console.error(e); }
    setBuscandoImagem(false);
  };

  const handleSalvar = async () => {
    if (!userId || !form.nome.trim()) return;
    setSaving(true);
    const custoUnit = parseFloat(calcCustoUnitario(form.valor_compra, form.qtd_embalagem));
    const payload = {
      user_id: userId,
      nome: form.nome.trim(),
      marca: form.marca?.trim() || "",
      categoria: form.categoria,
      subcategoria: form.subcategoria?.trim() || "",
      descricao: form.descricao?.trim() || "",
      unidade: form.unidade,
      quantidade_estoque: parseFloat(form.quantidade_estoque) || 0,
      estoque_minimo: parseFloat(form.estoque_minimo) || 0,
      valor_compra: parseFloat(form.valor_compra) || 0,
      fornecedor: form.fornecedor?.trim() || "",
      imagem_url: imagemSelecionada || "",
      qtd_embalagem: parseFloat(form.qtd_embalagem) || 1,
      custo_unitario: custoUnit,
      tem_validade: temValidade,
      validade_exata: temValidade && form.validade_exata ? form.validade_exata : null,
      validade_media_dias: temValidade && validadeMedia ? parseInt(validadeMedia) : null,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("insumos").update(payload).eq("id", editId);
    } else {
      const { data } = await supabase.from("insumos").insert(payload).select().single();
      if (data && parseFloat(form.quantidade_estoque) > 0) {
        await supabase.from("insumo_movimentacoes").insert({ user_id: userId, insumo_id: data.id, tipo: "entrada", quantidade: parseFloat(form.quantidade_estoque), motivo: "Estoque inicial" });
      }
    }
    await loadInsumos(userId);
    setUltimoCadastrado(form.nome.trim());
    setSaving(false);
    setStep("sucesso");
  };

  const handleMovimentacao = async () => {
    if (!userId || !insumoDetalhe || !movQtd) return;
    setSavingMov(true);
    const qtd = parseFloat(movQtd);
    const novoEstoque = movTipo === "entrada"
      ? insumoDetalhe.quantidade_estoque + qtd
      : Math.max(0, insumoDetalhe.quantidade_estoque - qtd);
    await supabase.from("insumos").update({ quantidade_estoque: novoEstoque }).eq("id", insumoDetalhe.id);
    await supabase.from("insumo_movimentacoes").insert({ user_id: userId, insumo_id: insumoDetalhe.id, tipo: movTipo, quantidade: qtd, motivo: movMotivo || (movTipo === "entrada" ? "Compra" : "Uso") });
    await loadInsumos(userId);
    const updated = { ...insumoDetalhe, quantidade_estoque: novoEstoque };
    setInsumoDetalhe(updated);
    const { data } = await supabase.from("insumo_movimentacoes").select("*").eq("insumo_id", insumoDetalhe.id).order("created_at", { ascending: false }).limit(20);
    if (data) setMovimentacoes(data);
    setMovQtd(""); setMovMotivo(""); setShowMovModal(false);
    setSavingMov(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("insumos").delete().eq("id", id);
    setInsumos(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
  };

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim() || !userId) return;
    await supabase.from("insumo_categorias").insert({ nome: novaCategoria.trim(), user_id: userId });
    setCategorias(prev => [...new Set([...prev, novaCategoria.trim()])]);
    setForm((f: any) => ({ ...f, categoria: novaCategoria.trim() }));
    setNovaCategoria(""); setShowNovaCategoria(false);
  };

  const estoqueStatus = (i: Insumo) => {
    if (i.quantidade_estoque <= 0) return "vazio";
    if (i.estoque_minimo > 0 && i.quantidade_estoque <= i.estoque_minimo) return "baixo";
    return "ok";
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: "inherit", color: "var(--text-muted, #9CA3AF)" }}>Carregando...</div>;

  const itensPorPagina = 8;
  const totalPaginas = Math.ceil(insumosFiltrados.length / itensPorPagina);
  const insumosPagina = insumosFiltrados.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina);

  if (step === "lista") return (
    <div className="ins-root ins-desktop">

      {/* Header */}
      <div className="ins-header">
        <div>
          <h1 className="ins-title">Ingredientes</h1>
          <p className="ins-sub">Gerencie seus ingredientes, estoques e validade.</p>
        </div>
        <button className="ins-btn-novo" onClick={openNovo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo ingrediente
        </button>
      </div>

      {/* 4 Cards stats */}
      <div className="ins-stats">
        <div className="ins-stat-card" style={{background:"var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A))",overflow:"hidden",position:"relative",alignItems:"center"}}>
          <svg style={{position:"absolute",right:"-10px",bottom:"-10px",opacity:0.15}} width="100" height="100" viewBox="0 0 100 100"><circle cx="80" cy="80" r="60" fill="white"/><circle cx="80" cy="80" r="40" fill="white"/></svg>
          <div className="ins-stat-icon" style={{background:"rgba(255,255,255,0.2)",zIndex:1}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <div style={{zIndex:1}}>
            <p className="ins-stat-label" style={{color:"rgba(255,255,255,0.8)"}}>Total em estoque</p>
            <p className="ins-stat-val" style={{color:"white"}}>{formatCurrency(totalEstoque)}</p>
            <p className="ins-stat-sub" style={{color:"rgba(255,255,255,0.7)"}}>Valor total</p>
          </div>
        </div>

        <div className="ins-stat-card" style={{background:"linear-gradient(135deg,#10b981,#059669)",overflow:"hidden",position:"relative",alignItems:"center"}}>
          <svg style={{position:"absolute",right:"-10px",bottom:"-10px",opacity:0.15}} width="100" height="100" viewBox="0 0 100 100"><circle cx="80" cy="80" r="60" fill="white"/><circle cx="80" cy="80" r="40" fill="white"/></svg>
          <div className="ins-stat-icon" style={{background:"rgba(255,255,255,0.2)",zIndex:1}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div style={{zIndex:1}}>
            <p className="ins-stat-label" style={{color:"rgba(255,255,255,0.8)"}}>Itens cadastrados</p>
            <p className="ins-stat-val" style={{color:"white"}}>{insumos.length}</p>
            <p className="ins-stat-sub" style={{color:"rgba(255,255,255,0.7)"}}>Ingredientes no total</p>
          </div>
        </div>

        <div className="ins-stat-card" style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",overflow:"hidden",position:"relative",alignItems:"center"}}>
          <svg style={{position:"absolute",right:"-10px",bottom:"-10px",opacity:0.15}} width="100" height="100" viewBox="0 0 100 100"><circle cx="80" cy="80" r="60" fill="white"/><circle cx="80" cy="80" r="40" fill="white"/></svg>
          <div className="ins-stat-icon" style={{background:"rgba(255,255,255,0.2)",zIndex:1}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style={{zIndex:1}}>
            <p className="ins-stat-label" style={{color:"rgba(255,255,255,0.8)"}}>Estoque baixo</p>
            <p className="ins-stat-val" style={{color:"white"}}>{alertas.length}</p>
            <p className="ins-stat-sub" style={{color:"rgba(255,255,255,0.7)"}}>Itens abaixo do mínimo</p>
          </div>
        </div>

        <div className="ins-stat-card" style={{background:"linear-gradient(135deg,#ef4444,#dc2626)",overflow:"hidden",position:"relative",alignItems:"center"}}>
          <svg style={{position:"absolute",right:"-10px",bottom:"-10px",opacity:0.15}} width="100" height="100" viewBox="0 0 100 100"><circle cx="80" cy="80" r="60" fill="white"/><circle cx="80" cy="80" r="40" fill="white"/></svg>
          <div className="ins-stat-icon" style={{background:"rgba(255,255,255,0.2)",zIndex:1}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          </div>
          <div style={{zIndex:1}}>
            <p className="ins-stat-label" style={{color:"rgba(255,255,255,0.8)"}}>Sem estoque</p>
            <p className="ins-stat-val" style={{color:"white"}}>{semEstoque.length}</p>
            <p className="ins-stat-sub" style={{color:"rgba(255,255,255,0.7)"}}>Itens para repor</p>
          </div>
        </div>
      </div>

      {/* Busca + filtros */}
      <div className="ins-toolbar">
        <div className="ins-search-wrap" style={{flex:1}}>
          <svg className="ins-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #9CA3AF)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="ins-search" placeholder="Buscar ingrediente..." value={busca} onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }} />
        </div>
        <select className="ins-select" value={filtroCategoria} onChange={e => { setFiltroCategoria(e.target.value); setPaginaAtual(1); }}>
          {["Todas", ...categorias].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="ins-select" value={ordenacao} onChange={e => setOrdenacao(e.target.value as Ordenacao)}>
          <option value="nome">Nome</option>
          <option value="estoque">Estoque</option>
          <option value="valor">Valor</option>
        </select>
      </div>

      {/* Filtros categoria chips */}
      <div className="ins-filtros">
        {["Todas", ...categorias].map(cat => (
          <button key={cat} className={"ins-filtro-btn" + (filtroCategoria === cat ? " active" : "")} onClick={() => { setFiltroCategoria(cat); setPaginaAtual(1); }}>{cat}</button>
        ))}
      </div>

      {/* Tabela */}
      {insumosFiltrados.length === 0 ? (
        <div className="ins-empty">
          <span style={{fontSize:"3rem"}}>🧂</span>
          <p style={{fontWeight:700,color:"var(--text-title, #1F2937)",margin:0}}>Nenhum ingrediente ainda</p>
          <p style={{color:"var(--text-muted, #9CA3AF)",fontSize:"0.85rem",margin:0}}>Cadastre seus ingredientes e embalagens</p>
          <button className="ins-btn-novo" onClick={openNovo}>+ Novo Ingrediente</button>
        </div>
      ) : (
        <div className="ins-table-wrap">
          <table className="ins-table">
            <thead>
              <tr>
                <th>Ingrediente</th>
                <th>Categoria</th>
                <th>Estoque</th>
                <th>Unidade</th>
                <th>Valor Unit.</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {insumosPagina.map(insumo => {
                const status = estoqueStatus(insumo);
                const valorTotal = insumo.quantidade_estoque * insumo.valor_compra;
                return (
                  <tr key={insumo.id} onClick={() => openDetalhe(insumo)} className="ins-table-row">
                    <td>
                      <div className="ins-table-nome">
                        <div className="ins-table-img">
                          {insumo.imagem_url ? <img src={insumo.imagem_url} alt={insumo.nome} /> : <span>🧂</span>}
                        </div>
                        <div>
                          <p className="ins-item-nome">{insumo.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="ins-cat-badge">{insumo.categoria}</span>
                    </td>
                    <td>
                      <span style={{fontWeight:700, color: status==="vazio"?"var(--error, #EF4444)":status==="baixo"?"var(--warning, #F59E0B)":"var(--success, #22C55E)"}}>
                        {insumo.quantidade_estoque}
                      </span>
                    </td>
                    <td style={{color:"var(--text-secondary, #6B7280)",fontSize:"0.82rem"}}>{insumo.unidade}</td>
                    <td style={{fontWeight:600,color:"var(--text-primary, #374151)"}}>{formatCurrency(insumo.valor_compra)}</td>
                    <td style={{fontWeight:600,color:"var(--text-primary, #374151)"}}>{formatCurrency(valorTotal)}</td>
                    <td>
                      <span className={"ins-status-badge ins-status-" + status}>
                        {status==="ok"?"Em estoque":status==="baixo"?"Estoque baixo":"Sem estoque"}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                        <button className="ins-act-btn ins-act-edit" onClick={() => openEditar(insumo)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="ins-act-btn ins-act-view" onClick={() => setPreviewInsumo(insumo)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        <button className="ins-act-btn ins-act-del" onClick={() => setDeleteId(insumo.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Paginação */}
          <div className="ins-pagination">
            <span className="ins-pag-info">Mostrando {(paginaAtual-1)*itensPorPagina+1} a {Math.min(paginaAtual*itensPorPagina, insumosFiltrados.length)} de {insumosFiltrados.length} ingredientes</span>
            <div className="ins-pag-btns">
              <button className="ins-pag-btn" onClick={() => setPaginaAtual(p => Math.max(1,p-1))} disabled={paginaAtual===1}>‹</button>
              {Array.from({length:totalPaginas},(_,i)=>i+1).filter(p => p===1||p===totalPaginas||Math.abs(p-paginaAtual)<=1).map((p,i,arr)=>(
                <>
                  {i>0 && arr[i-1]!==p-1 && <span key={"d"+p} style={{padding:"0 4px",color:"var(--text-muted, #9CA3AF)"}}>…</span>}
                  <button key={p} className={"ins-pag-btn"+(paginaAtual===p?" active":"")} onClick={() => setPaginaAtual(p)}>{p}</button>
                </>
              ))}
              <button className="ins-pag-btn" onClick={() => setPaginaAtual(p => Math.min(totalPaginas,p+1))} disabled={paginaAtual===totalPaginas}>›</button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé dica */}
      <div className="ins-footer-dica">
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem",flex:1}}>
          <span style={{fontSize:"1.2rem"}}>💡</span>
          <div>
            <p style={{fontWeight:700,color:"#92400e",margin:0,fontSize:"0.82rem"}}>Dica:</p>
            <p style={{color:"#92400e",margin:0,fontSize:"0.78rem"}}>Cadastre o máximo de ingredientes que você usa — quanto mais completo o seu estoque, mais precisa será sua precificação e menores as chances de perda.</p>
          </div>
        </div>
      </div>

      {deleteId && (
        <div className="ins-overlay" onClick={() => setDeleteId(null)}>
          <div className="ins-modal" onClick={e => e.stopPropagation()}>
            <p style={{fontWeight:700,fontSize:"1rem",color:"var(--text-title, #1F2937)",margin:"0 0 8px"}}>Excluir ingrediente?</p>
            <p style={{fontSize:"0.85rem",color:"var(--text-secondary, #6B7280)",margin:"0 0 1.5rem"}}>Esta ação não pode ser desfeita.</p>
            <div style={{display:"flex",gap:"8px"}}>
              <button className="ins-btn-cancel" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ins-btn-del-confirm" onClick={() => handleDelete(deleteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {previewInsumo && (() => {
        const st = estoqueStatus(previewInsumo);
        const statusLabel = st === "ok" ? "Em estoque" : st === "baixo" ? "Estoque baixo" : "Sem estoque";
        const statusIcon = st === "ok" ? "✅" : st === "baixo" ? "⚠️" : "❌";
        const statusColor = st === "ok" ? "var(--success, #22C55E)" : st === "baixo" ? "var(--warning, #F59E0B)" : "var(--error, #EF4444)";
        const statusBg = st === "ok" ? "#f0fdf4" : st === "baixo" ? "#fefce8" : "#fff1f2";
        const statusBorder = st === "ok" ? "#bbf7d0" : st === "baixo" ? "#fde68a" : "#fecdd3";
        const p = previewInsumo as any;
        return (
          <div className="ins-overlay" onClick={() => setPreviewInsumo(null)}>
            <div className="ins-peek-modal" onClick={e => e.stopPropagation()}>

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.25rem"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <div style={{width:"24px",height:"24px",borderRadius:"6px",background:"var(--primary-light, #FFF1F7)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #FF6FA9)" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </div>
                  <span style={{fontSize:"0.72rem",fontWeight:800,color:"var(--primary, #FF6FA9)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Ficha do ingrediente</span>
                </div>
                <button
                  onClick={() => setPreviewInsumo(null)}
                  style={{width:"28px",height:"28px",border:"none",background:"var(--bg-body, #F7F7F8)",borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text-muted, #9CA3AF)",fontSize:"0.75rem",fontWeight:700,transition:"background 0.15s"}}
                  onMouseOver={e => (e.currentTarget.style.background="var(--border, #E9E9EE)")}
                  onMouseOut={e => (e.currentTarget.style.background="var(--bg-body, #F7F7F8)")}
                >✕</button>
              </div>

              <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.25rem"}}>
                <div style={{width:"72px",height:"72px",borderRadius:"14px",overflow:"hidden",background:"var(--bg-body, #F7F7F8)",border:"1.5px solid var(--border, #E9E9EE)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06))"}}>
                  {previewInsumo.imagem_url
                    ? <img src={previewInsumo.imagem_url} alt={previewInsumo.nome} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                    : <span style={{fontSize:"1.8rem"}}>🧂</span>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{margin:"0 0 2px",fontSize:"1rem",fontWeight:800,color:"var(--text-title, #1F2937)",lineHeight:1.2,wordBreak:"break-word"}}>{previewInsumo.nome}</p>
                  {p.marca && <p style={{margin:"0 0 6px",fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)",fontWeight:500}}>{p.marca}</p>}
                  <span style={{display:"inline-flex",alignItems:"center",gap:"4px",padding:"3px 10px",borderRadius:"20px",fontSize:"0.7rem",fontWeight:700,background:statusBg,color:statusColor,border:`1px solid ${statusBorder}`}}>
                    {statusIcon} {statusLabel}
                  </span>
                </div>
              </div>

              <div style={{height:"1px",background:"var(--border, #E9E9EE)",margin:"0 0 1rem"}} />

              <div style={{background:"var(--bg-body, #F7F7F8)",borderRadius:"12px",padding:"0.75rem 1rem",marginBottom:"0.85rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
                <div>
                  <p style={{margin:"0 0 2px",fontSize:"0.68rem",color:"var(--text-muted, #9CA3AF)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Estoque atual</p>
                  <p style={{margin:0,fontSize:"1.1rem",fontWeight:800,color:statusColor}}>{previewInsumo.quantidade_estoque} <span style={{fontSize:"0.75rem",fontWeight:500,color:"var(--text-secondary, #6B7280)"}}>{previewInsumo.unidade}</span></p>
                </div>
                {previewInsumo.estoque_minimo > 0 && (
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:"0.68rem",color:"var(--text-muted, #9CA3AF)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Mínimo</p>
                    <p style={{margin:0,fontSize:"1.1rem",fontWeight:800,color:"var(--text-primary, #374151)"}}>{previewInsumo.estoque_minimo} <span style={{fontSize:"0.75rem",fontWeight:500,color:"var(--text-secondary, #6B7280)"}}>{previewInsumo.unidade}</span></p>
                  </div>
                )}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {[
                  { label: "Categoria", value: previewInsumo.categoria, icon: "🏷️" },
                  { label: "Unidade de medida", value: previewInsumo.unidade, icon: "📐" },
                  { label: "Valor de compra", value: formatCurrency(previewInsumo.valor_compra), icon: "💰" },
                  previewInsumo.qtd_embalagem > 1 ? { label: "Qtd por embalagem", value: `${previewInsumo.qtd_embalagem} ${previewInsumo.unidade}`, icon: "📦" } : null,
                  previewInsumo.custo_unitario > 0 ? { label: `Custo por ${previewInsumo.unidade}`, value: formatCurrency(previewInsumo.custo_unitario), icon: "🧮", highlight: true } : null,
                  p.fornecedor ? { label: "Fornecedor", value: p.fornecedor, icon: "🏪" } : null,
                  p.subcategoria ? { label: "Subcategoria", value: p.subcategoria, icon: "📂" } : null,
                ].filter(Boolean).map((item: any, i: number, arr: any[]) => (
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0",borderBottom: i < arr.length - 1 ? "1px solid var(--border, #E9E9EE)" : "none"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontSize:"0.85rem",lineHeight:1}}>{item.icon}</span>
                      <span style={{fontSize:"0.78rem",color:"var(--text-secondary, #6B7280)",fontWeight:500}}>{item.label}</span>
                    </div>
                    <span style={{fontSize:"0.82rem",fontWeight:700,color:item.highlight?"var(--primary, #FF6FA9)":"var(--text-title, #1F2937)",textAlign:"right",maxWidth:"55%"}}>{item.value}</span>
                  </div>
                ))}
              </div>

              {p.descricao && (
                <div style={{marginTop:"0.85rem",background:"var(--bg-body, #F7F7F8)",borderRadius:"10px",padding:"0.7rem 0.9rem"}}>
                  <p style={{margin:"0 0 4px",fontSize:"0.68rem",color:"var(--text-muted, #9CA3AF)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>Descrição</p>
                  <p style={{margin:0,fontSize:"0.82rem",color:"var(--text-primary, #374151)",lineHeight:1.5}}>{p.descricao}</p>
                </div>
              )}

              <button
                onClick={() => setPreviewInsumo(null)}
                style={{marginTop:"1.25rem",width:"100%",padding:"0.75rem",background:"var(--bg-body, #F7F7F8)",color:"var(--text-primary, #374151)",border:"none",borderRadius:"12px",fontFamily:"inherit",fontSize:"0.88rem",fontWeight:700,cursor:"pointer",transition:"background 0.15s"}}
                onMouseOver={e => (e.currentTarget.style.background="var(--border, #E9E9EE)")}
                onMouseOut={e => (e.currentTarget.style.background="var(--bg-body, #F7F7F8)")}
              >Fechar</button>

            </div>
          </div>
        );
      })()}
      <Styles />
    </div>
  );

  // ─── DETALHE ───
  if (step === "detalhe" && insumoDetalhe) {
    const status = estoqueStatus(insumoDetalhe);
    return (
      <div className="ins-root">
        <div className="ins-form-header">
          <button className="ins-back" onClick={() => setStep("lista")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <h2 className="ins-form-title">{insumoDetalhe.nome}</h2>
          <button onClick={() => openEditar(insumoDetalhe)} style={{ background: "none", border: "none", color: "var(--primary, #FF6FA9)", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer" }}>Editar</button>
        </div>

        {insumoDetalhe.imagem_url && (
          <div style={{ width: "100%", height: "160px", borderRadius: "14px", overflow: "hidden", background: "var(--bg-body, #F7F7F8)" }}>
            <img src={insumoDetalhe.imagem_url} alt={insumoDetalhe.nome} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        )}

        <div className="ins-detalhe-estoque" style={{ background: status === "vazio" ? "#fff1f2" : status === "baixo" ? "#fefce8" : "#f0fdf4", borderColor: status === "vazio" ? "#fecdd3" : status === "baixo" ? "#fde68a" : "#bbf7d0" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary, #6B7280)", margin: 0 }}>Estoque atual</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-title, #1F2937)", margin: 0 }}>{insumoDetalhe.quantidade_estoque} <span style={{ fontSize: "1rem" }}>{insumoDetalhe.unidade}</span></p>
            {status === "baixo" && <p style={{ fontSize: "0.75rem", color: "var(--warning, #F59E0B)", margin: 0 }}>⚠️ Abaixo do mínimo ({insumoDetalhe.estoque_minimo} {insumoDetalhe.unidade})</p>}
            {status === "vazio" && <p style={{ fontSize: "0.75rem", color: "var(--error, #EF4444)", margin: 0 }}>❌ Sem estoque</p>}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="ins-mov-btn ins-mov-saida" onClick={() => { setMovTipo("saida"); setShowMovModal(true); }}>− Saída</button>
            <button className="ins-mov-btn ins-mov-entrada" onClick={() => { setMovTipo("entrada"); setShowMovModal(true); }}>+ Entrada</button>
          </div>
        </div>

        <div className="ins-review-card">
          <div className="ins-review-section">
            <div className="ins-review-item"><span>Categoria</span><strong>{insumoDetalhe.categoria}</strong></div>
            <div className="ins-review-item"><span>Unidade</span><strong>{insumoDetalhe.unidade}</strong></div>
            <div className="ins-review-item"><span>Valor de compra</span><strong>{formatCurrency(insumoDetalhe.valor_compra)}</strong></div>
            {insumoDetalhe.qtd_embalagem > 1 && <div className="ins-review-item"><span>Qtd por embalagem</span><strong>{insumoDetalhe.qtd_embalagem} {insumoDetalhe.unidade}</strong></div>}
            {insumoDetalhe.custo_unitario > 0 && <div className="ins-review-item"><span>Custo por {insumoDetalhe.unidade}</span><strong style={{ color: "var(--primary, #FF6FA9)" }}>{formatCurrency(insumoDetalhe.custo_unitario)}</strong></div>}
            {insumoDetalhe.fornecedor && <div className="ins-review-item"><span>Fornecedor</span><strong>{insumoDetalhe.fornecedor}</strong></div>}
          </div>
        </div>

        <div>
          <p className="ins-section-label" style={{ marginBottom: "0.5rem" }}>📋 Histórico de movimentações</p>
          {movimentacoes.length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "var(--text-muted, #9CA3AF)", textAlign: "center", padding: "1rem" }}>Nenhuma movimentação ainda</p>
          ) : (
            <div className="ins-list">
              {movimentacoes.map(m => (
                <div key={m.id} style={{ background: "var(--bg-card, #FFFFFF)", borderRadius: "12px", padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06))" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.2rem" }}>{m.tipo === "entrada" ? "📥" : "📤"}</span>
                    <div>
                      <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-title, #1F2937)", margin: 0 }}>{m.motivo || (m.tipo === "entrada" ? "Entrada" : "Saída")}</p>
                      <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", margin: 0 }}>{formatDate(m.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: m.tipo === "entrada" ? "var(--success, #22C55E)" : "var(--error, #EF4444)" }}>
                    {m.tipo === "entrada" ? "+" : "-"}{m.quantidade} {insumoDetalhe.unidade}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {showMovModal && (
          <div className="ins-overlay" onClick={() => setShowMovModal(false)}>
            <div className="ins-modal" onClick={e => e.stopPropagation()}>
              <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-title, #1F2937)", margin: "0 0 1rem" }}>
                {movTipo === "entrada" ? "📥 Registrar Entrada" : "📤 Registrar Saída"}
              </p>
              <div className="ins-field" style={{ marginBottom: "0.75rem" }}>
                <label>Quantidade ({insumoDetalhe.unidade})</label>
                <input type="number" placeholder="0" min="0" step="0.001" value={movQtd} onChange={e => setMovQtd(e.target.value)} autoFocus />
              </div>
              <div className="ins-field" style={{ marginBottom: "1rem" }}>
                <label>Motivo (opcional)</label>
                <input placeholder={movTipo === "entrada" ? "Ex: Compra, Devolução..." : "Ex: Uso em receita, Perda..."} value={movMotivo} onChange={e => setMovMotivo(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="ins-btn-cancel" onClick={() => setShowMovModal(false)}>Cancelar</button>
                <button className={`ins-btn-primary ${movTipo === "saida" ? "ins-btn-saida" : ""}`} onClick={handleMovimentacao} disabled={savingMov || !movQtd}>
                  {savingMov ? <span className="ins-spinner" /> : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
        <Styles />
      </div>
    );
  }

  // ─── DADOS ───
  if (step === "dados") return (
    <div className="ins-root" data-modo={modoCompleto ? "completo" : "rapido"}>
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("lista")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h2 className="ins-form-title">{editId ? "Editar Ingrediente" : "Novo Ingrediente"}</h2>
          <p style={{margin:0,fontSize:"0.78rem",color:"var(--text-muted, #9CA3AF)"}}>
            {modoCompleto
              ? "Preencha todos os campos para um cadastro completo."
              : "Preencha o essencial — você pode editar depois pra adicionar mais detalhes."
            }
          </p>
        </div>
      </div>

      {/* Toggle Rápido / Completo */}
      <div className="ins-modo-toggle">
        <button
          className={`ins-modo-btn${!modoCompleto ? " ins-modo-btn--active" : ""}`}
          onClick={() => setModoCompleto(false)}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Modo Rápido
          <span className="ins-modo-sub">apenas o essencial</span>
        </button>
        <button
          className={`ins-modo-btn${modoCompleto ? " ins-modo-btn--active" : ""}`}
          onClick={() => setModoCompleto(true)}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          Modo Completo
          <span className="ins-modo-sub">todos os detalhes</span>
        </button>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>

        {/* 1. Informações básicas + Imagem */}
        <div className="ins-card" style={{padding:0,overflow:"hidden"}}>
          <div className="ins-basicas-grid">

            {/* Imagem */}
            <div className="ins-imagem-inline ins-completo-only">
              <div className="ins-imagem-preview" style={{flex:1,borderRadius:0,border:"none",borderRight:"1px solid var(--border, #E9E9EE)",minHeight:"320px",aspectRatio:"1"}}>
                {imagemSelecionada
                  ? <img src={imagemSelecionada} alt="imagem" style={{width:"100%",height:"100%",objectFit:"cover"}} />
                  : <div className="ins-imagem-empty">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--border, #E9E9EE)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text-muted, #9CA3AF)",margin:0}}>Sem imagem</p>
                    </div>
                }
              </div>
              <div style={{padding:"0.85rem",display:"flex",flexDirection:"column",gap:"0.5rem",borderRight:"1px solid var(--border, #E9E9EE)"}}>
                {isPro ? (
                  <button className="ins-btn-buscar" style={{justifyContent:"center"}}
                    onClick={() => {
                      if (!form.nome.trim() || !form.marca?.trim()) {
                        alert("Preencha o Nome e a Marca antes de buscar!");
                        return;
                      }
                      setTermoBuscaImg(`${form.nome} ${form.marca}`);
                      setShowBuscarModal(true);
                      buscarImagens();
                    }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Buscar imagem do produto
                  </button>
                ) : (
                  <div style={{background:"var(--primary-light, #FFF1F7)",border:"1px solid var(--primary-light, #FFF1F7)",borderRadius:"10px",padding:"0.6rem 0.75rem",textAlign:"center"}}>
                    <p style={{fontSize:"0.72rem",color:"var(--primary, #FF6FA9)",fontWeight:600,margin:0}}>✨ Recurso PRO</p>
                    <p style={{fontSize:"0.68rem",color:"var(--text-muted, #9CA3AF)",margin:"2px 0 0"}}>Busca automática de imagens</p>
                  </div>
                )}
                <button className="ins-btn-upload" onClick={() => document.getElementById("ins-file-input-desk")?.click()}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload manual
                </button>
                {imagemSelecionada && (
                  <button onClick={() => setImagemSelecionada(null)} style={{background:"none",border:"none",color:"var(--error, #EF4444)",fontSize:"0.72rem",cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                    Remover imagem
                  </button>
                )}
                <input id="ins-file-input-desk" type="file" accept="image/*" style={{display:"none"}} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file || !userId) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `insumos/${userId}/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("profiles").upload(path, file, {upsert:true});
                  if (!error) {
                    const { data } = supabase.storage.from("profiles").getPublicUrl(path);
                    setImagemSelecionada(`${data.publicUrl}?t=${Date.now()}`);
                  }
                }} />
              </div>
            </div>

            {/* Campos */}
            <div className="ins-form" style={{padding:"1.25rem",display:"flex",flexDirection:"column",flex:1}}>
              <p className="ins-section-label" style={{marginTop:0}}>1. Informações básicas</p>

              <div className="ins-row-2">
                <div className="ins-field">
                  <label>Nome do ingrediente <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                  <input placeholder="Ex: Leite Condensado" value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="ins-field ins-completo-only">
                  <label>Marca <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
                  {marcas.length === 0 && !showNovaMarca ? (
                    <button onClick={() => setShowNovaMarca(true)}
                      style={{padding:"0.65rem 0.9rem",border:"1.5px dashed var(--border, #E9E9EE)",borderRadius:"10px",background:"var(--bg-card, #FFFFFF)",fontFamily:"inherit",fontSize:"0.85rem",color:"var(--text-muted, #9CA3AF)",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"6px"}}>
                      <span style={{fontSize:"1rem",lineHeight:1}}>+</span> Cadastrar marca
                    </button>
                  ) : showNovaMarca ? (
                    <div className="ins-nova-row">
                      <input placeholder="Ex: Nestlé, Moça..." value={novaMarca} onChange={e => setNovaMarca(e.target.value)} autoFocus
                        onKeyDown={e => { if (e.key === "Enter" && novaMarca.trim()) { setMarcas(prev => [...prev, novaMarca.trim()]); setForm((f: any) => ({...f, marca: novaMarca.trim()})); setNovaMarca(""); setShowNovaMarca(false); }}} />
                      <button onClick={() => { if (!novaMarca.trim()) return; setMarcas(prev => [...prev, novaMarca.trim()]); setForm((f: any) => ({...f, marca: novaMarca.trim()})); setNovaMarca(""); setShowNovaMarca(false); }}>✓</button>
                      <button onClick={() => setShowNovaMarca(false)} style={{background:"var(--bg-body, #F7F7F8)",color:"var(--text-secondary, #6B7280)"}}>✕</button>
                    </div>
                  ) : (
                    <select value={form.marca || ""} onChange={e => { if (e.target.value === "__nova__") setShowNovaMarca(true); else setForm((f: any) => ({...f, marca: e.target.value})); }}>
                      <option value="">Selecione a marca</option>
                      {marcas.map(m => <option key={m} value={m}>{m}</option>)}
                      <option value="__nova__">+ Nova marca</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="ins-row-2">
                <div className="ins-field">
                  <label>Categoria <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                  <select value={form.categoria} onChange={e => { if (e.target.value === "__nova__") setShowNovaCategoria(true); else setForm((f: any) => ({ ...f, categoria: e.target.value })); }}>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__nova__">+ Nova categoria</option>
                  </select>
                  {showNovaCategoria && (
                    <div className="ins-nova-row">
                      <input placeholder="Nome da categoria" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} autoFocus />
                      <button onClick={adicionarCategoria}>Adicionar</button>
                      <button onClick={() => setShowNovaCategoria(false)} style={{background:"var(--bg-body, #F7F7F8)",color:"var(--text-secondary, #6B7280)"}}>✕</button>
                    </div>
                  )}
                </div>
                <div className="ins-field ins-completo-only">
                  <label>Subcategoria <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
                  <select value={form.subcategoria || ""} onChange={e => { if (e.target.value === "__nova_sub__") setForm((f: any) => ({...f, _showNovaSubcat: true})); else setForm((f: any) => ({...f, subcategoria: e.target.value, _showNovaSubcat: false})); }}>
                    <option value="">Selecione a subcategoria</option>
                    {(form._subcats || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                    <option value="__nova_sub__">+ Cadastrar subcategoria</option>
                  </select>
                  {form._showNovaSubcat && (
                    <div className="ins-nova-row" style={{marginTop:"6px"}}>
                      <input placeholder="Ex: Laticínios, Farinhas..." autoFocus
                        onKeyDown={e => { if (e.key==="Enter") { const v = (e.target as HTMLInputElement).value.trim(); if(v) setForm((f: any) => ({...f, subcategoria:v, _subcats:[...(f._subcats||[]),v], _showNovaSubcat:false})); }}}
                        onBlur={e => { const v = e.target.value.trim(); if(v) setForm((f: any) => ({...f, subcategoria:v, _subcats:[...(f._subcats||[]),v], _showNovaSubcat:false})); else setForm((f: any) => ({...f, _showNovaSubcat:false})); }} />
                      <button onClick={() => setForm((f: any) => ({...f, _showNovaSubcat:false}))}>✕</button>
                    </div>
                  )}
                </div>
              </div>

              <div className="ins-field ins-completo-only" style={{flex:1,display:"flex",flexDirection:"column"}}>
                <label>Descrição <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
                <textarea placeholder="Ex: Leite condensado tradicional, ideal para recheios e coberturas." value={form.descricao || ""} onChange={e => setForm((f: any) => ({...f, descricao: e.target.value}))} style={{flex:1,minHeight:"120px",padding:"0.65rem 0.9rem",border:"1.5px solid var(--border, #E9E9EE)",borderRadius:"10px",fontFamily:"inherit",fontSize:"0.88rem",color:"var(--text-title, #1F2937)",outline:"none",resize:"none",width:"100%",boxSizing:"border-box"}} onFocus={e => e.target.style.borderColor="var(--border-focus, #FF6FA9)"} onBlur={e => e.target.style.borderColor="var(--border, #E9E9EE)"} />
              </div>
            </div>

          </div>
        </div>

        {/* 2. Unidade e quantidade */}
        <div className="ins-card">
          <p className="ins-section-label">2. Unidade e quantidade</p>
          <div className="ins-row-2" style={{gap:"1.5rem"}}>
            <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
              <div className="ins-field">
                <label>Unidade de medida <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                <select value={form.unidade} onChange={e => { if (e.target.value === "__nova__") setShowNovaUnidade(true); else setForm((f: any) => ({ ...f, unidade: e.target.value })); }}>
                  <option value="">Selecione uma unidade</option>
                  {unidades.map(u => <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>)}
                  <option value="__nova__">+ Nova unidade</option>
                </select>
                <span className="ins-field-hint">Ex: kg, g, ml, L, un, pacote</span>
                {showNovaUnidade && (
                  <div className="ins-nova-row">
                    <input placeholder="Ex: dz (dúzia)" value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)} autoFocus />
                    <button onClick={() => { if (!novaUnidade.trim()) return; setUnidades(prev => [...prev, {sigla:novaUnidade.trim(),nome:novaUnidade.trim(),tipo:"unidade"}]); setForm((f: any) => ({...f,unidade:novaUnidade.trim()})); setNovaUnidade(""); setShowNovaUnidade(false); }}>Adicionar</button>
                    <button onClick={() => setShowNovaUnidade(false)} style={{background:"var(--bg-body, #F7F7F8)",color:"var(--text-secondary, #6B7280)"}}>✕</button>
                  </div>
                )}
              </div>

              <div className="ins-completo-only" style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.75rem 1rem",background:"var(--bg-body, #F7F7F8)",borderRadius:"12px",border:"1px solid var(--border, #E9E9EE)"}}>
                <div>
                  <p style={{margin:0,fontSize:"0.88rem",fontWeight:600,color:"var(--text-title, #1F2937)"}}>Aviso de estoque mínimo</p>
                  <p style={{margin:0,fontSize:"0.72rem",color:"var(--text-muted, #9CA3AF)"}}>Alerta quando o estoque estiver baixo</p>
                </div>
                <button onClick={() => setForm((f: any) => ({...f, _avisoEstoque: !f._avisoEstoque}))}
                  style={{width:"44px",height:"24px",borderRadius:"99px",border:"none",cursor:"pointer",background:form._avisoEstoque?"var(--primary, #FF6FA9)":"var(--border, #E9E9EE)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"50%",background:"white",position:"absolute",top:"3px",transition:"left 0.2s",left:form._avisoEstoque?"23px":"3px",boxShadow:"0 1px 3px rgba(0,0,0,0.2)"}} />
                </button>
              </div>

              {form._avisoEstoque && (
                <div className="ins-field ins-completo-only">
                  <label>Estoque mínimo para avisos <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                  <input type="number" placeholder="Ex: 2" min="0" value={form.estoque_minimo} onChange={e => setForm((f: any) => ({...f,estoque_minimo:e.target.value}))} />
                  <span className="ins-field-hint">Quantidade mínima para alerta de estoque</span>
                </div>
              )}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
              <div className="ins-field">
                <label>Quantidade por embalagem <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                <input type="number" placeholder="Ex: 395" min="1" value={form.qtd_embalagem} onChange={e => setForm((f: any) => ({...f,qtd_embalagem:e.target.value}))} />
                <span className="ins-field-hint">Informe a quantidade que vem na embalagem</span>
              </div>
              <div className="ins-field">
                <label>Estoque atual <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
                <input type="number" placeholder="Ex: 0" min="0" value={form.quantidade_estoque} onChange={e => setForm((f: any) => ({...f,quantidade_estoque:e.target.value}))} />
                <span className="ins-field-hint">Quantidade disponível no momento</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Valores */}
        <div className="ins-card">
          <p className="ins-section-label">3. Valores</p>
          <div className="ins-form">
            <div className="ins-row-2">
              <div className="ins-field">
                <label>Valor de compra (R$) <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(Obrigatório)</span></label>
                <input type="number" placeholder="0,00" min="0" step="0.01" value={form.valor_compra} onChange={e => setForm((f: any) => ({...f,valor_compra:e.target.value}))} />
              </div>
              <div className="ins-field ins-completo-only">
                <label>Fornecedor <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
                <input placeholder="Ex: Nestlé, Arosa..." style={{maxWidth:"320px"}} value={form.fornecedor} onChange={e => setForm((f: any) => ({...f,fornecedor:e.target.value}))} />
              </div>
            </div>
            {parseFloat(form.valor_compra) > 0 && parseFloat(form.qtd_embalagem) > 0 && (
              <div className="ins-custo-calc">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #FF6FA9)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Custo por {form.unidade || "unidade"}: <strong style={{color:"var(--primary, #FF6FA9)"}}>{formatCurrency(parseFloat(calcCustoUnitario(form.valor_compra, form.qtd_embalagem)))}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Validade */}
      <div className="ins-card ins-completo-only">
        <p className="ins-section-label">4. Validade</p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.85rem",marginBottom:"0.85rem"}}>
          <label style={{display:"flex",alignItems:"flex-start",gap:"0.75rem",padding:"0.85rem 1rem",border:"2px solid",borderColor:temValidade?"var(--primary, #FF6FA9)":"var(--border, #E9E9EE)",borderRadius:"12px",cursor:"pointer",background:temValidade?"var(--primary-light, #FFF1F7)":"var(--bg-card, #FFFFFF)",transition:"all 0.15s"}}>
            <div style={{width:"18px",height:"18px",borderRadius:"50%",border:"2px solid",borderColor:temValidade?"var(--primary, #FF6FA9)":"var(--border, #E9E9EE)",background:temValidade?"var(--primary, #FF6FA9)":"var(--bg-card, #FFFFFF)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
              {temValidade && <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"white"}} />}
            </div>
            <div>
              <input type="radio" checked={temValidade} onChange={() => setTemValidade(true)} style={{display:"none"}} />
              <p style={{margin:0,fontSize:"0.88rem",fontWeight:700,color:temValidade?"var(--primary, #FF6FA9)":"var(--text-title, #1F2937)"}}>Com validade</p>
              <p style={{margin:0,fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)"}}>Este insumo possui data de validade</p>
            </div>
          </label>

          <label style={{display:"flex",alignItems:"flex-start",gap:"0.75rem",padding:"0.85rem 1rem",border:"2px solid",borderColor:!temValidade?"var(--primary, #FF6FA9)":"var(--border, #E9E9EE)",borderRadius:"12px",cursor:"pointer",background:!temValidade?"var(--primary-light, #FFF1F7)":"var(--bg-card, #FFFFFF)",transition:"all 0.15s"}}>
            <div style={{width:"18px",height:"18px",borderRadius:"50%",border:"2px solid",borderColor:!temValidade?"var(--primary, #FF6FA9)":"var(--border, #E9E9EE)",background:!temValidade?"var(--primary, #FF6FA9)":"var(--bg-card, #FFFFFF)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"2px"}}>
              {!temValidade && <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"white"}} />}
            </div>
            <div>
              <input type="radio" checked={!temValidade} onChange={() => setTemValidade(false)} style={{display:"none"}} />
              <p style={{margin:0,fontSize:"0.88rem",fontWeight:700,color:!temValidade?"var(--primary, #FF6FA9)":"var(--text-title, #1F2937)"}}>Sem validade</p>
              <p style={{margin:0,fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)"}}>Este insumo não possui data de validade</p>
            </div>
          </label>

          {temValidade && (
            <div className="ins-field" style={{margin:0}}>
              <label>Validade exata <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
              <input type="date" value={form.validade_exata || ""} onChange={e => setForm((f: any) => ({...f, validade_exata: e.target.value}))} style={{colorScheme:"light"}} />
              <span className="ins-field-hint">Data de validade impressa na embalagem</span>
            </div>
          )}

          {temValidade && (
            <div className="ins-field" style={{margin:0}}>
              <label>Validade média (dias) <span style={{color:"var(--text-muted, #9CA3AF)",fontWeight:400}}>(opcional)</span></label>
              <input type="number" placeholder="Ex: 180" min="1" value={validadeMedia} onChange={e => setValidadeMedia(e.target.value)} />
              <span className="ins-field-hint">Tempo médio de validade após a compra</span>
            </div>
          )}
        </div>

        {temValidade && (
          <div style={{background:"var(--primary-light, #FFF1F7)",border:"1px solid var(--primary-light, #FFF1F7)",borderRadius:"12px",padding:"0.85rem 1rem",display:"flex",gap:"0.75rem",alignItems:"flex-start"}}>
            <div style={{width:"20px",height:"20px",borderRadius:"50%",background:"var(--primary, #FF6FA9)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>
              <span style={{color:"white",fontSize:"0.7rem",fontWeight:800}}>i</span>
            </div>
            <div>
              <p style={{margin:"0 0 2px",fontSize:"0.82rem",fontWeight:700,color:"var(--primary, #FF6FA9)"}}>Será usado para alertas</p>
              <p style={{margin:0,fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)"}}>Enviaremos um alerta quando o insumo estiver próximo do vencimento.</p>
            </div>
          </div>
        )}
        {!temValidade && (
          <div style={{background:"var(--bg-body, #F7F7F8)",border:"1px solid var(--border, #E9E9EE)",borderRadius:"12px",padding:"0.85rem 1rem"}}>
            <p style={{margin:0,fontSize:"0.82rem",color:"var(--text-muted, #9CA3AF)"}}>Sem alertas de vencimento para este insumo.</p>
          </div>
        )}
      </div>

      {/* Imagem (mobile only — em desktop fica no card lateral acima) */}
      <div className="ins-imagem-mobile-card ins-completo-only">
        <div className="ins-imagem-mobile-header">
          <p className="ins-section-label" style={{margin:0,fontSize:"0.92rem"}}>Imagem do ingrediente</p>
          <span className="ins-optional-badge">opcional</span>
        </div>

        <div className="ins-imagem-mobile-preview">
          {imagemSelecionada
            ? <img src={imagemSelecionada} alt="imagem" />
            : <div className="ins-imagem-empty" style={{padding:"1.4rem 1rem"}}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--border, #E9E9EE)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style={{margin:"6px 0 0",fontSize:"0.8rem",color:"var(--text-muted, #9CA3AF)"}}>Sem imagem</p>
              </div>
          }
        </div>

        <div className="ins-imagem-mobile-actions">
          {isPro ? (
            <button className="ins-btn-buscar" style={{justifyContent:"center"}}
              onClick={() => {
                if (!form.nome.trim() || !form.marca?.trim()) {
                  alert("Preencha o Nome e a Marca antes de buscar!");
                  return;
                }
                setTermoBuscaImg(`${form.nome} ${form.marca}`);
                setShowBuscarModal(true);
                buscarImagens();
              }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Buscar imagem
            </button>
          ) : (
            <div style={{background:"var(--primary-light, #FFF1F7)",borderRadius:"10px",padding:"0.55rem 0.75rem",textAlign:"center",flex:1}}>
              <p style={{fontSize:"0.7rem",color:"var(--primary, #FF6FA9)",fontWeight:700,margin:0}}>✨ Busca de imagem é PRO</p>
            </div>
          )}
          <button className="ins-btn-upload" onClick={() => document.getElementById("ins-file-input-mob")?.click()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload
          </button>
          {imagemSelecionada && (
            <button onClick={() => setImagemSelecionada(null)} style={{background:"none",border:"none",color:"var(--error, #EF4444)",fontSize:"0.78rem",cursor:"pointer",fontFamily:"inherit",padding:"0.5rem"}}>
              Remover
            </button>
          )}
          <input id="ins-file-input-mob" type="file" accept="image/*" style={{display:"none"}} onChange={async e => {
            const file = e.target.files?.[0];
            if (!file || !userId) return;
            const ext = file.name.split(".").pop() || "jpg";
            const path = `insumos/${userId}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from("profiles").upload(path, file, {upsert:true});
            if (!error) {
              const { data } = supabase.storage.from("profiles").getPublicUrl(path);
              setImagemSelecionada(`${data.publicUrl}?t=${Date.now()}`);
            }
          }} />
        </div>
      </div>

      {/* Footer */}
      <div className="ins-footer">
        <button className="ins-btn-cancel" onClick={() => setStep("lista")}>Cancelar</button>
        <button className="ins-btn-primary" onClick={handleSalvar} disabled={saving || !form.nome.trim()}>
          {saving ? <span className="ins-spinner" /> : editId ? "Salvar alterações" : "Cadastrar ingrediente"}
        </button>
      </div>

      {/* Modal busca de imagem */}
      {showBuscarModal && (
        <div className="ins-overlay" onClick={() => setShowBuscarModal(false)}>
          <div className="ins-busca-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
              <div>
                <h3 style={{margin:0,fontSize:"1rem",fontWeight:700,color:"var(--text-title, #1F2937)"}}>Buscar imagem do produto</h3>
                <p style={{margin:"2px 0 0",fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)"}}>Selecione a imagem que melhor representa o ingrediente</p>
              </div>
              <button onClick={() => setShowBuscarModal(false)} style={{background:"var(--bg-body, #F7F7F8)",border:"none",width:"32px",height:"32px",borderRadius:"50%",cursor:"pointer",fontSize:"0.9rem",color:"var(--text-secondary, #6B7280)"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:"8px",marginBottom:"1rem"}}>
              <input className="ins-busca-input" value={termoBuscaImg} onChange={e => setTermoBuscaImg(e.target.value)}
                onKeyDown={e => e.key==="Enter" && buscarImagens()} placeholder="Nome + marca do produto..." style={{flex:1}} />
              <button className="ins-btn-buscar-go" onClick={buscarImagens} disabled={buscandoImagem}>
                {buscandoImagem ? <span className="ins-spinner" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
              </button>
            </div>
            {buscandoImagem && <p style={{textAlign:"center",color:"var(--text-muted, #9CA3AF)",fontSize:"0.85rem",padding:"1rem 0"}}>Buscando imagens...</p>}
            {imagensBusca.length > 0 && (
              <div className="ins-grid-imagens" style={{gridTemplateColumns:"repeat(4,1fr)",gap:"8px",maxHeight:"320px",overflowY:"auto"}}>
                {imagensBusca.map((url, i) => (
                  <div key={i} className={"ins-img-thumb"+(imagemSelecionada===url?" selected":"")}
                    onClick={() => { setImagemSelecionada(url); setShowBuscarModal(false); }}
                    style={{aspectRatio:"1",cursor:"pointer"}}>
                    <img src={url} alt="" onError={e => {(e.target as HTMLImageElement).style.display="none";}} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <Styles />
    </div>
  );

  // ─── IMAGEM ───
  if (step === "imagem") return (
    <div className="ins-root">
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("dados")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="ins-form-title">Imagem do insumo</h2>
        <span className="ins-optional-badge">opcional</span>
      </div>

      <div className="ins-imagem-preview">
        {imagemSelecionada ? <img src={imagemSelecionada} alt="imagem" /> : (
          <div className="ins-imagem-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border, #E9E9EE)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <p>Nenhuma imagem adicionada</p>
            <span>Adicione uma foto ou busque uma imagem</span>
          </div>
        )}
      </div>

      <div className="ins-imagem-actions">
        <button className="ins-btn-buscar" onClick={() => setStep("buscar")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Buscar imagem
        </button>
        <button className="ins-btn-upload" onClick={() => document.getElementById("ins-file-input")?.click()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload manual
        </button>
        <input id="ins-file-input" type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
          const file = e.target.files?.[0];
          if (!file || !userId) return;
          const ext = file.name.split(".").pop() || "jpg";
          const path = `insumos/${userId}/${Date.now()}.${ext}`;
          const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
          if (!error) {
            const { data } = supabase.storage.from("profiles").getPublicUrl(path);
            setImagemSelecionada(`${data.publicUrl}?t=${Date.now()}`);
          }
        }} />
      </div>

      <div className="ins-footer">
        <button className="ins-btn-cancel" onClick={() => { setImagemSelecionada(null); setStep("revisar"); }}>Pular</button>
        <button className="ins-btn-primary" onClick={() => setStep("revisar")}>Continuar →</button>
      </div>
      <Styles />
    </div>
  );

  // ─── BUSCAR ───
  if (step === "buscar") return (
    <div className="ins-root">
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("imagem")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="ins-form-title">Buscar imagem</h2>
      </div>

      <div className="ins-busca-row">
        <input className="ins-busca-input" placeholder="Ex: Leite condensado Moça 395g" value={termoBuscaImg} onChange={e => setTermoBuscaImg(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarImagens()} autoFocus />
        <button className="ins-btn-buscar-go" onClick={buscarImagens} disabled={buscandoImagem}>
          {buscandoImagem ? <span className="ins-spinner" /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
        </button>
      </div>

      {buscandoImagem && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted, #9CA3AF)" }}>
          <p style={{ marginTop: "1rem" }}>Buscando imagens...</p>
        </div>
      )}

      {imagensBusca.length > 0 && (
        <div className="ins-grid-imagens">
          {imagensBusca.map((url, i) => (
            <div key={i} className="ins-img-thumb" onClick={() => { setImagemSelecionada(url); setStep("selecionar"); }}>
              <img src={url} alt={`resultado ${i+1}`} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: "0.72rem", color: "var(--text-muted, #9CA3AF)", textAlign: "center", margin: "0.5rem 0" }}>Resultados via Google Custom Search</p>
      <Styles />
    </div>
  );

  // ─── SELECIONAR ───
  if (step === "selecionar") return (
    <div className="ins-root">
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("buscar")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="ins-form-title">Selecionar imagem</h2>
      </div>
      {imagemSelecionada && <div className="ins-img-selected"><img src={imagemSelecionada} alt="selecionada" /></div>}
      <div className="ins-footer" style={{ flexDirection: "column", gap: "8px" }}>
        <button className="ins-btn-primary" onClick={() => setStep("revisar")}>Usar esta imagem</button>
        <button className="ins-btn-cancel" onClick={() => setStep("buscar")}>Ver outras imagens</button>
      </div>
      <Styles />
    </div>
  );

  // ─── REVISAR ───
  if (step === "revisar") return (
    <div className="ins-root">
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("imagem")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="ins-form-title">Revisar insumo</h2>
      </div>
      <div className="ins-review-card">
        {imagemSelecionada && (
          <div className="ins-review-img">
            <img src={imagemSelecionada} alt={form.nome} />
            <button className="ins-review-alterar" onClick={() => setStep("imagem")}>Alterar imagem</button>
          </div>
        )}
        <div className="ins-review-section">
          <div className="ins-review-row-header"><span>Dados do insumo</span><button onClick={() => setStep("dados")}>Editar</button></div>
          <div className="ins-review-item"><span>Nome</span><strong>{form.nome}</strong></div>
          <div className="ins-review-item"><span>Categoria</span><strong>{form.categoria}</strong></div>
          <div className="ins-review-item"><span>Unidade</span><strong>{form.unidade}</strong></div>
          <div className="ins-review-item"><span>Quantidade em estoque</span><strong>{form.quantidade_estoque || "0"} {form.unidade}</strong></div>
          {form.estoque_minimo && <div className="ins-review-item"><span>Estoque mínimo</span><strong>{form.estoque_minimo} {form.unidade}</strong></div>}
          <div className="ins-review-item"><span>Valor de compra</span><strong>R$ {parseFloat(form.valor_compra || "0").toFixed(2)}</strong></div>
          {parseFloat(form.qtd_embalagem) > 1 && <div className="ins-review-item"><span>Qtd por embalagem</span><strong>{form.qtd_embalagem} {form.unidade}</strong></div>}
          {parseFloat(form.valor_compra) > 0 && <div className="ins-review-item"><span>Custo por {form.unidade}</span><strong style={{ color: "var(--primary, #FF6FA9)" }}>{formatCurrency(parseFloat(calcCustoUnitario(form.valor_compra, form.qtd_embalagem)))}</strong></div>}
          {form.fornecedor && <div className="ins-review-item"><span>Fornecedor</span><strong>{form.fornecedor}</strong></div>}
        </div>
      </div>
      <div className="ins-footer">
        <button className="ins-btn-cancel" onClick={() => setStep("imagem")}>Voltar</button>
        <button className="ins-btn-primary" onClick={handleSalvar} disabled={saving}>{saving ? <span className="ins-spinner" /> : "Salvar"}</button>
      </div>
      <Styles />
    </div>
  );

  // ─── SUCESSO ───
  if (step === "sucesso") return (
    <div className="ins-root">
      <div className="ins-sucesso">
        <div className="ins-sucesso-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 style={{ fontWeight: 800, color: "var(--text-title, #1F2937)", margin: "0 0 8px" }}>Insumo cadastrado!</h2>
        <p style={{ color: "var(--text-secondary, #6B7280)", fontSize: "0.9rem", margin: "0 0 2rem", textAlign: "center" }}><strong>{ultimoCadastrado}</strong> foi adicionado ao seu estoque.</p>
        <button className="ins-btn-primary" style={{ width: "100%" }} onClick={() => setStep("lista")}>Ver insumos</button>
        <button className="ins-btn-cancel" style={{ width: "100%", marginTop: "8px" }} onClick={() => { setForm(emptyForm); setImagemSelecionada(null); setEditId(null); setStep("dados"); }}>Cadastrar outro</button>
      </div>
      <Styles />
    </div>
  );

  return null;
}

function Styles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      .ins-root { font-family:'Geist', sans-serif; display:flex; flex-direction:column; gap:1rem; padding-bottom:2rem; }
      .ins-desktop { max-width:100%; }
      .ins-header { display:flex; align-items:center; justify-content:space-between; }
      .ins-title { font-size:1.6rem; font-weight:800; color:var(--text-title, #1F2937); margin:0; }
      .ins-sub { font-size:0.82rem; color:var(--text-muted, #9CA3AF); margin:0.15rem 0 0; }
      .ins-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.65rem 1.25rem; background:var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:50px; font-family:'Geist', sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; box-shadow:0 4px 12px rgba(255,111,169,0.35); }

      /* Stats */
      .ins-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; }
      .ins-stat-card { background:var(--bg-card, #FFFFFF); border-radius:16px; padding:1.1rem 1.25rem; display:flex; align-items:center; gap:1rem; box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); }
      .ins-stat-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-stat-label { font-size:0.68rem; font-weight:700; color:var(--text-muted, #9CA3AF); text-transform:uppercase; letter-spacing:0.05em; margin:0 0 2px; }
      .ins-stat-val { font-size:1.5rem; font-weight:800; color:var(--text-title, #1F2937); margin:0; line-height:1; }
      .ins-stat-sub { font-size:0.7rem; color:var(--text-muted, #9CA3AF); margin:2px 0 0; }

      /* Toolbar */
      .ins-toolbar { display:flex; gap:0.75rem; align-items:center; }
      .ins-search-wrap { position:relative; }
      .ins-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none; }
      .ins-search { width:100%; padding:0.65rem 1rem 0.65rem 2.4rem; border:1.5px solid var(--border, #E9E9EE); border-radius:12px; font-family:'Geist', sans-serif; font-size:0.88rem; outline:none; box-sizing:border-box; background:var(--bg-card, #FFFFFF); }
      .ins-search:focus { border-color:var(--border-focus, #FF6FA9); }
      .ins-select { padding:0.62rem 0.9rem; border:1.5px solid var(--border, #E9E9EE); border-radius:12px; font-family:'Geist', sans-serif; font-size:0.85rem; color:var(--text-primary, #374151); outline:none; background:var(--bg-card, #FFFFFF); cursor:pointer; }
      .ins-select:focus { border-color:var(--border-focus, #FF6FA9); }

      /* Filtros */
      .ins-filtros { display:flex; gap:0.4rem; flex-wrap:wrap; }
      .ins-filtro-btn { padding:0.35rem 0.9rem; border:1.5px solid var(--border, #E9E9EE); border-radius:8px; background:var(--bg-card, #FFFFFF); font-family:'Geist', sans-serif; font-size:0.78rem; font-weight:500; color:var(--text-secondary, #6B7280); cursor:pointer; white-space:nowrap; transition:all 0.15s; }
      .ins-filtro-btn.active { border-color:var(--primary, #FF6FA9); color:var(--primary, #FF6FA9); background:var(--primary-light, #FFF1F7); font-weight:700; }

      /* Tabela */
      .ins-table-wrap { background:var(--bg-card, #FFFFFF); border-radius:16px; box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); overflow:hidden; }
      .ins-table { width:100%; border-collapse:collapse; }
      .ins-table thead tr { background:var(--bg-body, #F7F7F8); border-bottom:1px solid var(--border, #E9E9EE); }
      .ins-table th { padding:0.75rem 1rem; text-align:left; font-size:0.72rem; font-weight:700; color:var(--text-muted, #9CA3AF); text-transform:uppercase; letter-spacing:0.05em; white-space:nowrap; }
      .ins-table-row { border-bottom:1px solid var(--border, #E9E9EE); cursor:pointer; transition:background 0.15s; }
      .ins-table-row:hover { background:var(--primary-light, #FFF1F7); }
      .ins-table-row:last-child { border-bottom:none; }
      .ins-table td { padding:0.85rem 1rem; vertical-align:middle; }
      .ins-table-nome { display:flex; align-items:center; gap:0.75rem; }
      .ins-table-img { width:44px; height:44px; border-radius:10px; overflow:hidden; background:var(--bg-body, #F7F7F8); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:1.3rem; }
      .ins-table-img img { width:100%; height:100%; object-fit:cover; }
      .ins-item-nome { font-size:0.88rem; font-weight:700; color:var(--text-title, #1F2937); margin:0; }
      .ins-cat-badge { padding:3px 10px; border-radius:6px; font-size:0.72rem; font-weight:600; background:var(--bg-body, #F7F7F8); color:var(--text-primary, #374151); }
      .ins-status-badge { padding:4px 10px; border-radius:8px; font-size:0.72rem; font-weight:700; white-space:nowrap; }
      .ins-status-ok { background:#dcfce7; color:var(--success, #22C55E); }
      .ins-status-baixo { background:#fef9c3; color:var(--warning, #F59E0B); }
      .ins-status-vazio { background:#fee2e2; color:var(--error, #EF4444); }
      .ins-act-btn { width:30px; height:30px; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
      .ins-act-edit { background:var(--primary-light, #FFF1F7); color:var(--primary, #FF6FA9); }
      .ins-act-edit:hover { background:var(--primary, #FF6FA9); color:var(--text-inverse, #FFFFFF); }
      .ins-act-view { background:#f0fdf4; color:var(--success, #22C55E); }
      .ins-act-view:hover { background:var(--success, #22C55E); color:var(--text-inverse, #FFFFFF); }
      .ins-act-del { background:#fff1f2; color:var(--error, #EF4444); }
      .ins-act-del:hover { background:var(--error, #EF4444); color:var(--text-inverse, #FFFFFF); }
      .ins-peek-modal { background:var(--bg-card, #FFFFFF); border-radius:20px; padding:1.5rem; width:100%; max-width:380px; box-shadow:0 24px 64px rgba(0,0,0,0.18); animation:peekIn 0.22s cubic-bezier(0.16,1,0.3,1); max-height:90vh; overflow-y:auto; } @keyframes peekIn { from { opacity:0; transform:scale(0.94) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }

      /* Paginação */
      .ins-pagination { display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.25rem; border-top:1px solid var(--border, #E9E9EE); }
      .ins-pag-info { font-size:0.78rem; color:var(--text-muted, #9CA3AF); }
      .ins-pag-btns { display:flex; align-items:center; gap:4px; }
      .ins-pag-btn { width:32px; height:32px; border-radius:8px; border:1.5px solid var(--border, #E9E9EE); background:var(--bg-card, #FFFFFF); font-family:'Geist', sans-serif; font-size:0.82rem; font-weight:600; color:var(--text-primary, #374151); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
      .ins-pag-btn:hover:not(:disabled) { border-color:var(--primary, #FF6FA9); color:var(--primary, #FF6FA9); }
      .ins-pag-btn.active { background:var(--primary, #FF6FA9); border-color:var(--primary, #FF6FA9); color:var(--text-inverse, #FFFFFF); }
      .ins-pag-btn:disabled { opacity:0.4; cursor:not-allowed; }

      /* Rodapé dica */
      .ins-footer-dica { background:#fffbeb; border:1px solid #fde68a; border-radius:14px; padding:1rem 1.25rem; display:flex; align-items:center; gap:1rem; }

      /* Empty */
      .ins-empty { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:3rem 1rem; text-align:center; background:var(--bg-card, #FFFFFF); border-radius:16px; box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); }

      /* Grid informações básicas + imagem */
      .ins-basicas-grid { display:grid; grid-template-columns:320px 1fr; align-items:stretch; }

      /* ── Modo Rápido / Completo toggle ── */
      .ins-modo-toggle {
        display:grid; grid-template-columns:1fr 1fr; gap:6px;
        padding:5px; background:var(--bg-body, #F7F7F8);
        border:1px solid var(--border, #E9E9EE);
        border-radius:14px; margin-bottom:0.85rem;
      }
      .ins-modo-btn {
        display:flex; align-items:center; justify-content:center; gap:6px;
        padding:0.65rem 0.85rem;
        background:transparent; border:none; border-radius:10px;
        font-family:'Geist', sans-serif; font-size:0.85rem; font-weight:700;
        color:var(--text-secondary, #6B7280); cursor:pointer;
        transition:all 0.2s;
      }
      .ins-modo-btn:hover { color:var(--primary, #FF6FA9); }
      .ins-modo-btn--active {
        background:var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A));
        color:#fff; box-shadow:0 3px 10px rgba(255,111,169,0.32);
      }
      .ins-modo-btn--active:hover { color:#fff; }
      .ins-modo-sub {
        font-size:0.7rem; font-weight:500; opacity:0.85;
        margin-left:4px; padding-left:6px;
        border-left:1px solid currentColor;
      }
      @media (max-width:520px) {
        .ins-modo-btn { flex-direction:column; gap:2px; padding:0.55rem; }
        .ins-modo-sub { margin-left:0; padding-left:0; border-left:none; opacity:0.7; font-size:0.66rem; }
      }

      /* ── Modo Rápido: esconde elementos do modo completo ── */
      .ins-root[data-modo="rapido"] .ins-completo-only { display:none !important; }
      /* No modo rápido, colapsa o grid da imagem lateral pra ocupar tudo */
      .ins-root[data-modo="rapido"] .ins-basicas-grid { grid-template-columns:1fr !important; }

      .ins-imagem-inline { display:flex; flex-direction:column; }
      .ins-imagem-mobile-card { display:none; }
      @media (max-width:768px) {
        .ins-basicas-grid { grid-template-columns:1fr; }
        .ins-imagem-inline { display:none; }
        .ins-imagem-mobile-card {
          display:flex; flex-direction:column; gap:0.7rem;
          background:var(--bg-card, #FFFFFF);
          border:1px solid var(--border, #E9E9EE);
          border-radius:14px; padding:1rem;
          margin-top:0.5rem;
        }
        .ins-imagem-mobile-header { display:flex; align-items:center; justify-content:space-between; gap:0.5rem; }
        .ins-imagem-mobile-preview {
          width:100%; min-height:160px; aspect-ratio:16/10;
          background:var(--bg-body, #F7F7F8);
          border-radius:12px; overflow:hidden;
          display:flex; align-items:center; justify-content:center;
        }
        .ins-imagem-mobile-preview img { width:100%; height:100%; object-fit:cover; }
        .ins-imagem-mobile-actions { display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; }
        .ins-imagem-mobile-actions .ins-btn-buscar,
        .ins-imagem-mobile-actions .ins-btn-upload { flex:1; min-width:120px; }
        /* No mobile + modo rápido, o card de imagem mobile também some (já tem display:none via .ins-completo-only) */
        .ins-root[data-modo="rapido"] .ins-imagem-mobile-card { display:none !important; }
      }
      .ins-field-hint { font-size:0.72rem; color:var(--text-muted, #9CA3AF); margin:3px 0 0; }
      .ins-busca-modal { background:var(--bg-card, #FFFFFF); border-radius:20px; padding:1.5rem; width:100%; max-width:560px; box-shadow:0 20px 60px rgba(0,0,0,0.2); animation:qsmIn 0.25s cubic-bezier(0.16,1,0.3,1); }
      @keyframes qsmIn { from { opacity:0; transform:scale(0.95) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
      .ins-section-label { font-size:1rem; font-weight:800; color:var(--text-title, #1F2937); letter-spacing:0.04em; margin:0 0 0.75rem; }
      .ins-back { width:36px; height:36px; background:var(--bg-body, #F7F7F8); border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-form-header { display:flex; align-items:center; gap:0.75rem; }
      .ins-form-title { font-size:1.1rem; font-weight:800; color:var(--text-title, #1F2937); margin:0; flex:1; }
      .ins-optional-badge { font-size:0.7rem; background:var(--bg-body, #F7F7F8); color:var(--text-muted, #9CA3AF); padding:3px 8px; border-radius:20px; }
      .ins-card { background:var(--bg-card, #FFFFFF); border-radius:16px; padding:1.25rem; box-shadow:none; border:1px solid var(--border, #E9E9EE); display:flex; flex-direction:column; gap:0.85rem; }
      .ins-form { display:flex; flex-direction:column; gap:0.85rem; }
      .ins-field { display:flex; flex-direction:column; gap:0.3rem; }
      .ins-field label { font-size:0.78rem; font-weight:600; color:var(--text-primary, #374151); }
      .ins-field input, .ins-field select { padding:0.65rem 0.9rem; border:1.5px solid var(--border, #E9E9EE); border-radius:10px; font-family:'Geist', sans-serif; font-size:0.9rem; color:var(--text-title, #1F2937); outline:none; transition:border-color 0.2s; width:100%; box-sizing:border-box; }
      .ins-field input:focus, .ins-field select:focus { border-color:var(--border-focus, #FF6FA9); }
      .ins-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
      .ins-input-unit { display:flex; border:1.5px solid var(--border, #E9E9EE); border-radius:10px; overflow:hidden; transition:border-color 0.2s; }
      .ins-input-unit:focus-within { border-color:var(--border-focus, #FF6FA9); }
      .ins-input-unit input { border:none; flex:1; padding:0.65rem 0.9rem; font-family:'Geist', sans-serif; font-size:0.9rem; color:var(--text-title, #1F2937); outline:none; }
      .ins-input-unit span { background:var(--bg-body, #F7F7F8); padding:0 0.75rem; display:flex; align-items:center; font-size:0.78rem; font-weight:600; color:var(--text-secondary, #6B7280); border-left:1px solid var(--border, #E9E9EE); }
      .ins-nova-row { display:flex; gap:6px; margin-top:6px; }
      .ins-nova-row input { flex:1; padding:0.55rem 0.75rem; border:1.5px solid var(--border, #E9E9EE); border-radius:8px; font-family:'Geist', sans-serif; font-size:0.85rem; outline:none; }
      .ins-nova-row input:focus { border-color:var(--border-focus, #FF6FA9); }
      .ins-nova-row button { padding:0.55rem 0.85rem; background:var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:8px; font-family:'Geist', sans-serif; font-size:0.82rem; font-weight:600; cursor:pointer; white-space:nowrap; }
      .ins-custo-calc { display:flex; align-items:center; gap:6px; background:var(--primary-light, #FFF1F7); border-radius:10px; padding:0.6rem 0.9rem; font-size:0.82rem; color:var(--text-primary, #374151); }
      .ins-footer { display:flex; gap:0.75rem; padding-top:0.5rem; }
      .ins-btn-cancel { flex:1; padding:0.8rem; background:var(--bg-body, #F7F7F8); color:var(--text-secondary, #6B7280); border:none; border-radius:12px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
      .ins-btn-primary { flex:2; padding:0.8rem; background:var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:12px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .ins-btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
      .ins-btn-saida { background:linear-gradient(135deg,var(--error, #EF4444),#dc2626) !important; }
      .ins-detalhe-estoque { border-radius:14px; padding:1rem 1.25rem; display:flex; align-items:center; justify-content:space-between; border:1.5px solid; }
      .ins-mov-btn { padding:0.5rem 0.85rem; border:none; border-radius:10px; font-family:'Geist', sans-serif; font-size:0.82rem; font-weight:700; cursor:pointer; }
      .ins-mov-entrada { background:#dcfce7; color:var(--success, #22C55E); }
      .ins-mov-saida { background:#fee2e2; color:var(--error, #EF4444); }
      .ins-imagem-preview { width:100%; height:200px; border-radius:16px; overflow:hidden; background:var(--bg-body, #F7F7F8); border:2px dashed var(--border, #E9E9EE); display:flex; align-items:center; justify-content:center; }
      .ins-imagem-preview img { width:100%; height:100%; object-fit:contain; }
      .ins-imagem-empty { display:flex; flex-direction:column; align-items:center; gap:0.5rem; color:var(--text-muted, #9CA3AF); }
      .ins-imagem-empty p { font-size:0.9rem; font-weight:600; margin:0; color:var(--text-primary, #374151); }
      .ins-imagem-empty span { font-size:0.78rem; }
      .ins-imagem-actions { display:flex; flex-direction:column; gap:0.75rem; }
      .ins-btn-buscar { display:flex; align-items:center; justify-content:center; gap:8px; padding:0.8rem; background:var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A)); color:var(--text-inverse, #FFFFFF); border:none; border-radius:12px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
      .ins-btn-upload { display:flex; align-items:center; justify-content:center; gap:8px; padding:0.8rem; background:var(--bg-card, #FFFFFF); color:var(--text-primary, #374151); border:1.5px solid var(--border, #E9E9EE); border-radius:12px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
      .ins-busca-row { display:flex; gap:8px; }
      .ins-busca-input { flex:1; padding:0.7rem 1rem; border:1.5px solid var(--border, #E9E9EE); border-radius:12px; font-family:'Geist', sans-serif; font-size:0.9rem; outline:none; }
      .ins-busca-input:focus { border-color:var(--border-focus, #FF6FA9); }
      .ins-btn-buscar-go { width:44px; height:44px; background:var(--primary-gradient, linear-gradient(135deg,#FF6FA9,#F85A9A)); border:none; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-btn-buscar-go:disabled { opacity:0.7; }
      .ins-grid-imagens { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
      .ins-img-thumb { aspect-ratio:1; border-radius:10px; overflow:hidden; background:var(--bg-body, #F7F7F8); cursor:pointer; border:2px solid transparent; transition:border-color 0.2s; }
      .ins-img-thumb:hover { border-color:var(--primary, #FF6FA9); }
      .ins-img-thumb img { width:100%; height:100%; object-fit:cover; }
      .ins-img-selected { width:100%; height:260px; border-radius:16px; overflow:hidden; background:var(--bg-body, #F7F7F8); }
      .ins-img-selected img { width:100%; height:100%; object-fit:contain; }
      .ins-review-card { background:var(--bg-card, #FFFFFF); border-radius:16px; padding:1.25rem; box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:1rem; }
      .ins-review-img { display:flex; align-items:center; gap:1rem; }
      .ins-review-img img { width:72px; height:72px; border-radius:10px; object-fit:cover; }
      .ins-review-alterar { background:none; border:none; color:var(--primary, #FF6FA9); font-size:0.8rem; font-weight:600; cursor:pointer; font-family:'Geist', sans-serif; }
      .ins-review-section { display:flex; flex-direction:column; gap:0.5rem; }
      .ins-review-row-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; }
      .ins-review-row-header span { font-size:0.82rem; font-weight:700; color:var(--primary, #FF6FA9); text-transform:uppercase; letter-spacing:0.05em; }
      .ins-review-row-header button { background:none; border:none; color:var(--text-secondary, #6B7280); font-size:0.8rem; cursor:pointer; font-family:'Geist', sans-serif; text-decoration:underline; }
      .ins-review-item { display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid var(--border, #E9E9EE); }
      .ins-review-item:last-child { border-bottom:none; }
      .ins-review-item span { font-size:0.8rem; color:var(--text-secondary, #6B7280); }
      .ins-review-item strong { font-size:0.85rem; color:var(--text-title, #1F2937); text-align:right; max-width:60%; }
      .ins-sucesso { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
      .ins-sucesso-icon { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,var(--success, #22C55E),#16a34a); display:flex; align-items:center; justify-content:center; margin-bottom:0.5rem; }
      .ins-overlay { position:fixed; inset:0; z-index:200; background:var(--bg-overlay); display:flex; align-items:center; justify-content:center; padding:1rem; }
      .ins-modal { background:var(--bg-card, #FFFFFF); border-radius:20px; padding:1.5rem; width:100%; max-width:360px; }
      .ins-btn-del-confirm { flex:1; padding:0.75rem; background:var(--error, #EF4444); color:var(--text-inverse, #FFFFFF); border:none; border-radius:10px; font-family:'Geist', sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
      .ins-spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:insSpin 0.7s linear infinite; display:inline-block; }
      @keyframes insSpin { to { transform:rotate(360deg); } }
    `}</style>
  );
}
