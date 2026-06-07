import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

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
}

const CATEGORIAS_DEFAULT = ["Ingredientes","Embalagens","Decorações","Bebidas","Limpeza","Descartáveis","Outros"];
const UNIDADES_DEFAULT = [
  { sigla: "kg", nome: "Quilograma", tipo: "peso" },
  { sigla: "g", nome: "Grama", tipo: "peso" },
  { sigla: "L", nome: "Litro", tipo: "volume" },
  { sigla: "ml", nome: "Mililitro", tipo: "volume" },
  { sigla: "un", nome: "Unidade", tipo: "unidade" },
  { sigla: "cx", nome: "Caixa", tipo: "embalagem" },
  { sigla: "pct", nome: "Pacote", tipo: "embalagem" },
  { sigla: "fd", nome: "Fardo", tipo: "embalagem" },
  { sigla: "bdj", nome: "Bandeja", tipo: "embalagem" },
  { sigla: "pt", nome: "Pote", tipo: "embalagem" },
];

const emptyForm = { nome: "", categoria: "Ingredientes", unidade: "kg", quantidade_estoque: "", estoque_minimo: "", valor_compra: "", fornecedor: "", imagem_url: "" };

type Step = "lista" | "dados" | "imagem" | "buscar" | "selecionar" | "revisar" | "sucesso";

export default function Insumos() {
  const [userId, setUserId] = useState<string | null>(null);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
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
  const [ultimoCadastrado, setUltimoCadastrado] = useState<string>("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("insumos").select("*").eq("user_id", user.id).order("nome");
      if (data) setInsumos(data);
      // Carregar categorias customizadas
      const { data: cats } = await supabase.from("insumo_categorias").select("nome").or(`is_default.eq.true,user_id.eq.${user.id}`).order("nome");
      if (cats && cats.length > 0) setCategorias([...new Set([...CATEGORIAS_DEFAULT, ...cats.map((c: any) => c.nome)])]);
      setLoading(false);
    };
    load();
  }, []);

  const insumosFiltrados = insumos.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

  const openNovo = () => {
    setForm(emptyForm);
    setEditId(null);
    setImagemSelecionada(null);
    setStep("dados");
  };

  const openEditar = (insumo: Insumo) => {
    setForm({ ...insumo, quantidade_estoque: insumo.quantidade_estoque?.toString() || "", estoque_minimo: insumo.estoque_minimo?.toString() || "", valor_compra: insumo.valor_compra?.toString() || "" });
    setEditId(insumo.id);
    setImagemSelecionada(insumo.imagem_url || null);
    setStep("dados");
  };

  const buscarImagens = async () => {
    if (!termoBuscaImg.trim()) return;
    setBuscandoImagem(true);
    setImagensBusca([]);
    try {
      const res = await fetch(`https://api.anthropic.com/v1/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: `Busque imagens do produto "${termoBuscaImg}" e retorne apenas uma lista JSON com até 6 URLs diretas de imagens (.jpg, .png ou .webp) do produto. Retorne APENAS o JSON array, sem texto adicional. Exemplo: ["url1","url2"]` }]
        })
      });
      const data = await res.json();
      const text = data.content?.filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const urls = JSON.parse(match[0]).filter((u: string) => u.startsWith("http"));
        setImagensBusca(urls.slice(0, 6));
      }
    } catch (e) { console.error(e); }
    setBuscandoImagem(false);
  };

  const handleSalvar = async () => {
    if (!userId || !form.nome.trim()) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      nome: form.nome.trim(),
      categoria: form.categoria,
      unidade: form.unidade,
      quantidade_estoque: parseFloat(form.quantidade_estoque) || 0,
      estoque_minimo: parseFloat(form.estoque_minimo) || 0,
      valor_compra: parseFloat(form.valor_compra) || 0,
      fornecedor: form.fornecedor?.trim() || "",
      imagem_url: imagemSelecionada || "",
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("insumos").update(payload).eq("id", editId);
    } else {
      await supabase.from("insumos").insert(payload);
    }
    const { data } = await supabase.from("insumos").select("*").eq("user_id", userId).order("nome");
    if (data) setInsumos(data);
    setUltimoCadastrado(form.nome.trim());
    setSaving(false);
    setStep("sucesso");
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
    setNovaCategoria("");
    setShowNovaCategoria(false);
  };

  const estoqueStatus = (i: Insumo) => {
    if (i.quantidade_estoque <= 0) return "vazio";
    if (i.quantidade_estoque <= i.estoque_minimo) return "baixo";
    return "ok";
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>Carregando...</div>;

  // ─── LISTA ───
  if (step === "lista") return (
    <div className="ins-root">
      <div className="ins-header">
        <div>
          <h1 className="ins-title">Insumos</h1>
          <p className="ins-sub">{insumos.length} insumo{insumos.length !== 1 ? "s" : ""} cadastrado{insumos.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="ins-btn-novo" onClick={openNovo}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo
        </button>
      </div>

      <div className="ins-search-wrap">
        <svg className="ins-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="ins-search" placeholder="Buscar insumos..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {insumosFiltrados.length === 0 ? (
        <div className="ins-empty">
          <span style={{ fontSize: "3rem" }}>🧂</span>
          <p style={{ fontWeight: 700, color: "#1f2937", margin: 0 }}>Nenhum insumo ainda</p>
          <p style={{ color: "#9ca3af", fontSize: "0.85rem", margin: 0 }}>Cadastre seus ingredientes e embalagens</p>
          <button className="ins-btn-novo" onClick={openNovo}>+ Novo Insumo</button>
        </div>
      ) : (
        <div className="ins-list">
          {insumosFiltrados.map(insumo => {
            const status = estoqueStatus(insumo);
            return (
              <div key={insumo.id} className="ins-item" onClick={() => openEditar(insumo)}>
                <div className="ins-item-img">
                  {insumo.imagem_url
                    ? <img src={insumo.imagem_url} alt={insumo.nome} />
                    : <span style={{ fontSize: "1.4rem" }}>🧂</span>
                  }
                </div>
                <div className="ins-item-info">
                  <p className="ins-item-nome">{insumo.nome}</p>
                  <p className="ins-item-cat">{insumo.categoria}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                    <span className="ins-item-estoque">{insumo.quantidade_estoque} {insumo.unidade}</span>
                    {status === "baixo" && <span className="ins-badge-baixo">⚠️ Baixo</span>}
                    {status === "vazio" && <span className="ins-badge-vazio">❌ Sem estoque</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", flexShrink: 0 }}>
                  <span className="ins-item-valor">{formatCurrency(insumo.valor_compra)}</span>
                  <button className="ins-btn-del" onClick={e => { e.stopPropagation(); setDeleteId(insumo.id); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm delete */}
      {deleteId && (
        <div className="ins-overlay" onClick={() => setDeleteId(null)}>
          <div className="ins-modal" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "#1f2937", margin: "0 0 8px" }}>Excluir insumo?</p>
            <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: "0 0 1.5rem" }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="ins-btn-cancel" onClick={() => setDeleteId(null)}>Cancelar</button>
              <button className="ins-btn-del-confirm" onClick={() => handleDelete(deleteId)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <Styles />
    </div>
  );

  // ─── DADOS ───
  if (step === "dados") return (
    <div className="ins-root">
      <div className="ins-form-header">
        <button className="ins-back" onClick={() => setStep("lista")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 className="ins-form-title">{editId ? "Editar Insumo" : "Novo Insumo"}</h2>
      </div>

      <div className="ins-section-label">📋 Dados do insumo</div>

      <div className="ins-form">
        <div className="ins-field">
          <label>Nome do insumo *</label>
          <input placeholder="Ex: Leite Condensado Moça 395g" value={form.nome} onChange={e => setForm((f: any) => ({ ...f, nome: e.target.value }))} />
        </div>

        <div className="ins-field">
          <label>Categoria *</label>
          <select value={form.categoria} onChange={e => {
            if (e.target.value === "__nova__") setShowNovaCategoria(true);
            else setForm((f: any) => ({ ...f, categoria: e.target.value }));
          }}>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__nova__">+ Nova categoria</option>
          </select>
          {showNovaCategoria && (
            <div className="ins-nova-row">
              <input placeholder="Nome da categoria" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} autoFocus />
              <button onClick={adicionarCategoria}>Adicionar</button>
              <button onClick={() => setShowNovaCategoria(false)} style={{ background: "#f3f4f6", color: "#6b7280" }}>✕</button>
            </div>
          )}
        </div>

        <div className="ins-field">
          <label>Unidade de medida *</label>
          <select value={form.unidade} onChange={e => {
            if (e.target.value === "__nova__") setShowNovaUnidade(true);
            else setForm((f: any) => ({ ...f, unidade: e.target.value }));
          }}>
            {["peso","volume","unidade","embalagem"].map(tipo => (
              <optgroup key={tipo} label={tipo.charAt(0).toUpperCase() + tipo.slice(1)}>
                {unidades.filter(u => u.tipo === tipo).map(u => (
                  <option key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</option>
                ))}
              </optgroup>
            ))}
            <option value="__nova__">+ Nova unidade</option>
          </select>
          {showNovaUnidade && (
            <div className="ins-nova-row">
              <input placeholder="Ex: dz (dúzia)" value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)} autoFocus />
              <button onClick={() => {
                if (!novaUnidade.trim()) return;
                setUnidades(prev => [...prev, { sigla: novaUnidade.trim(), nome: novaUnidade.trim(), tipo: "unidade" }]);
                setForm((f: any) => ({ ...f, unidade: novaUnidade.trim() }));
                setNovaUnidade("");
                setShowNovaUnidade(false);
              }}>Adicionar</button>
              <button onClick={() => setShowNovaUnidade(false)} style={{ background: "#f3f4f6", color: "#6b7280" }}>✕</button>
            </div>
          )}
        </div>

        <div className="ins-row-2">
          <div className="ins-field">
            <label>Qtd. em estoque *</label>
            <div className="ins-input-unit">
              <input type="number" placeholder="0" min="0" value={form.quantidade_estoque} onChange={e => setForm((f: any) => ({ ...f, quantidade_estoque: e.target.value }))} />
              <span>{form.unidade}</span>
            </div>
          </div>
          <div className="ins-field">
            <label>Estoque mínimo</label>
            <div className="ins-input-unit">
              <input type="number" placeholder="0" min="0" value={form.estoque_minimo} onChange={e => setForm((f: any) => ({ ...f, estoque_minimo: e.target.value }))} />
              <span>{form.unidade}</span>
            </div>
          </div>
        </div>

        <div className="ins-field">
          <label>Valor de compra (R$) *</label>
          <input type="number" placeholder="0,00" min="0" step="0.01" value={form.valor_compra} onChange={e => setForm((f: any) => ({ ...f, valor_compra: e.target.value }))} />
        </div>

        <div className="ins-field">
          <label>Fornecedor</label>
          <input placeholder="Ex: Nestlé, Arosa..." value={form.fornecedor} onChange={e => setForm((f: any) => ({ ...f, fornecedor: e.target.value }))} />
        </div>
      </div>

      <div className="ins-footer">
        <button className="ins-btn-cancel" onClick={() => setStep("lista")}>Cancelar</button>
        <button className="ins-btn-primary" onClick={() => { setTermoBuscaImg(form.nome); setStep("imagem"); }} disabled={!form.nome.trim()}>
          Continuar →
        </button>
      </div>

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
        {imagemSelecionada
          ? <img src={imagemSelecionada} alt="imagem" />
          : (
            <div className="ins-imagem-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <p>Nenhuma imagem adicionada</p>
              <span>Adicione uma foto ou busque uma imagem</span>
            </div>
          )
        }
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
        <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af", fontSize: "0.88rem" }}>
          <span className="ins-spinner" style={{ borderColor: "#e5e7eb", borderTopColor: "#ec4899", width: "28px", height: "28px" }} />
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

      {!buscandoImagem && imagensBusca.length === 0 && termoBuscaImg && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#9ca3af" }}>
          <p>Clique em buscar para encontrar imagens</p>
        </div>
      )}

      <p style={{ fontSize: "0.72rem", color: "#9ca3af", textAlign: "center", margin: "0.5rem 0" }}>Resultados fornecidos pela IA</p>

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

      {imagemSelecionada && (
        <div className="ins-img-selected">
          <img src={imagemSelecionada} alt="selecionada" />
        </div>
      )}

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
            <button className="ins-review-alterar" onClick={() => setStep("imagem")}>Alterar</button>
          </div>
        )}

        <div className="ins-review-section">
          <div className="ins-review-row-header">
            <span>Dados do insumo</span>
            <button onClick={() => setStep("dados")}>Editar</button>
          </div>
          <div className="ins-review-item"><span>Nome</span><strong>{form.nome}</strong></div>
          <div className="ins-review-item"><span>Categoria</span><strong>{form.categoria}</strong></div>
          <div className="ins-review-item"><span>Unidade</span><strong>{form.unidade}</strong></div>
          <div className="ins-review-item"><span>Quantidade em estoque</span><strong>{form.quantidade_estoque || "0"} {form.unidade}</strong></div>
          {form.estoque_minimo && <div className="ins-review-item"><span>Estoque mínimo</span><strong>{form.estoque_minimo} {form.unidade}</strong></div>}
          <div className="ins-review-item"><span>Valor de compra</span><strong>R$ {parseFloat(form.valor_compra || "0").toFixed(2)}</strong></div>
          {form.fornecedor && <div className="ins-review-item"><span>Fornecedor</span><strong>{form.fornecedor}</strong></div>}
        </div>
      </div>

      <div className="ins-footer">
        <button className="ins-btn-cancel" onClick={() => setStep("imagem")}>Voltar</button>
        <button className="ins-btn-primary" onClick={handleSalvar} disabled={saving}>
          {saving ? <span className="ins-spinner" /> : "Salvar"}
        </button>
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
        <h2 style={{ fontWeight: 800, color: "#1f2937", margin: "0 0 8px" }}>Insumo cadastrado com sucesso!</h2>
        <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "0 0 2rem", textAlign: "center" }}>
          <strong>{ultimoCadastrado}</strong> foi adicionado ao seu estoque.
        </p>
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
      .ins-root { font-family:'Inter',sans-serif; max-width:600px; display:flex; flex-direction:column; gap:1rem; padding-bottom:2rem; }
      .ins-header { display:flex; align-items:center; justify-content:space-between; padding-top:1.5rem; }
      .ins-title { font-size:1.4rem; font-weight:800; color:#1f2937; margin:0; }
      .ins-sub { font-size:0.82rem; color:#9ca3af; margin:0; }
      .ins-btn-novo { display:flex; align-items:center; gap:0.4rem; padding:0.65rem 1.1rem; background:linear-gradient(135deg,#ec4899,#f9007a); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:700; cursor:pointer; white-space:nowrap; }
      .ins-search-wrap { position:relative; }
      .ins-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); pointer-events:none; }
      .ins-search { width:100%; padding:0.65rem 1rem 0.65rem 2.4rem; border:1.5px solid #e5e7eb; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.88rem; outline:none; box-sizing:border-box; }
      .ins-search:focus { border-color:#ec4899; }
      .ins-empty { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
      .ins-list { display:flex; flex-direction:column; gap:0.5rem; }
      .ins-item { background:white; border-radius:14px; padding:0.75rem 1rem; display:flex; align-items:center; gap:0.85rem; box-shadow:0 2px 8px rgba(0,0,0,0.06); cursor:pointer; transition:box-shadow 0.2s; }
      .ins-item:hover { box-shadow:0 4px 16px rgba(0,0,0,0.1); }
      .ins-item-img { width:56px; height:56px; border-radius:10px; overflow:hidden; background:#fdf2f8; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-item-img img { width:100%; height:100%; object-fit:cover; }
      .ins-item-info { flex:1; min-width:0; }
      .ins-item-nome { font-size:0.9rem; font-weight:700; color:#1f2937; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .ins-item-cat { font-size:0.72rem; color:#9ca3af; margin:0; }
      .ins-item-estoque { font-size:0.78rem; color:#6b7280; font-weight:500; }
      .ins-item-valor { font-size:0.85rem; font-weight:700; color:#22c55e; }
      .ins-badge-baixo { background:#fef9c3; color:#ca8a04; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:6px; }
      .ins-badge-vazio { background:#fee2e2; color:#ef4444; font-size:0.65rem; font-weight:700; padding:2px 6px; border-radius:6px; }
      .ins-btn-del { width:30px; height:30px; background:#fff1f2; border:none; border-radius:8px; color:#ef4444; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-form-header { display:flex; align-items:center; gap:0.75rem; padding-top:1.25rem; }
      .ins-back { width:36px; height:36px; background:#f3f4f6; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-form-title { font-size:1.1rem; font-weight:800; color:#1f2937; margin:0; flex:1; }
      .ins-optional-badge { font-size:0.7rem; background:#f3f4f6; color:#9ca3af; padding:3px 8px; border-radius:20px; }
      .ins-section-label { font-size:0.72rem; font-weight:700; color:#ec4899; text-transform:uppercase; letter-spacing:0.07em; }
      .ins-form { display:flex; flex-direction:column; gap:0.85rem; }
      .ins-field { display:flex; flex-direction:column; gap:0.3rem; }
      .ins-field label { font-size:0.78rem; font-weight:600; color:#374151; }
      .ins-field input, .ins-field select { padding:0.65rem 0.9rem; border:1.5px solid #e5e7eb; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.9rem; color:#1f2937; outline:none; transition:border-color 0.2s; width:100%; box-sizing:border-box; }
      .ins-field input:focus, .ins-field select:focus { border-color:#ec4899; }
      .ins-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; }
      .ins-input-unit { display:flex; border:1.5px solid #e5e7eb; border-radius:10px; overflow:hidden; transition:border-color 0.2s; }
      .ins-input-unit:focus-within { border-color:#ec4899; }
      .ins-input-unit input { border:none; flex:1; padding:0.65rem 0.9rem; font-family:'Inter',sans-serif; font-size:0.9rem; color:#1f2937; outline:none; }
      .ins-input-unit span { background:#f9fafb; padding:0 0.75rem; display:flex; align-items:center; font-size:0.78rem; font-weight:600; color:#6b7280; border-left:1px solid #e5e7eb; }
      .ins-nova-row { display:flex; gap:6px; margin-top:6px; }
      .ins-nova-row input { flex:1; padding:0.55rem 0.75rem; border:1.5px solid #e5e7eb; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.85rem; outline:none; }
      .ins-nova-row input:focus { border-color:#ec4899; }
      .ins-nova-row button { padding:0.55rem 0.85rem; background:linear-gradient(135deg,#ec4899,#f9007a); color:white; border:none; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.82rem; font-weight:600; cursor:pointer; white-space:nowrap; }
      .ins-footer { display:flex; gap:0.75rem; padding-top:0.5rem; }
      .ins-btn-cancel { flex:1; padding:0.8rem; background:#f3f4f6; color:#6b7280; border:none; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
      .ins-btn-primary { flex:2; padding:0.8rem; background:linear-gradient(135deg,#ec4899,#f9007a); color:white; border:none; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .ins-btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
      .ins-imagem-preview { width:100%; height:200px; border-radius:16px; overflow:hidden; background:#f9fafb; border:2px dashed #e5e7eb; display:flex; align-items:center; justify-content:center; }
      .ins-imagem-preview img { width:100%; height:100%; object-fit:contain; }
      .ins-imagem-empty { display:flex; flex-direction:column; align-items:center; gap:0.5rem; color:#9ca3af; }
      .ins-imagem-empty p { font-size:0.9rem; font-weight:600; margin:0; color:#374151; }
      .ins-imagem-empty span { font-size:0.78rem; }
      .ins-imagem-actions { display:flex; flex-direction:column; gap:0.75rem; }
      .ins-btn-buscar { display:flex; align-items:center; justify-content:center; gap:8px; padding:0.8rem; background:linear-gradient(135deg,#ec4899,#f9007a); color:white; border:none; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
      .ins-btn-upload { display:flex; align-items:center; justify-content:center; gap:8px; padding:0.8rem; background:white; color:#374151; border:1.5px solid #e5e7eb; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
      .ins-busca-row { display:flex; gap:8px; }
      .ins-busca-input { flex:1; padding:0.7rem 1rem; border:1.5px solid #e5e7eb; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; outline:none; }
      .ins-busca-input:focus { border-color:#ec4899; }
      .ins-btn-buscar-go { width:44px; height:44px; background:linear-gradient(135deg,#ec4899,#f9007a); border:none; border-radius:12px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .ins-btn-buscar-go:disabled { opacity:0.7; }
      .ins-grid-imagens { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
      .ins-img-thumb { aspect-ratio:1; border-radius:10px; overflow:hidden; background:#f9fafb; cursor:pointer; border:2px solid transparent; transition:border-color 0.2s; }
      .ins-img-thumb:hover { border-color:#ec4899; }
      .ins-img-thumb img { width:100%; height:100%; object-fit:cover; }
      .ins-img-selected { width:100%; height:260px; border-radius:16px; overflow:hidden; background:#f9fafb; }
      .ins-img-selected img { width:100%; height:100%; object-fit:contain; }
      .ins-review-card { background:white; border-radius:16px; padding:1.25rem; box-shadow:0 2px 10px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:1rem; }
      .ins-review-img { display:flex; align-items:center; gap:1rem; }
      .ins-review-img img { width:72px; height:72px; border-radius:10px; object-fit:cover; }
      .ins-review-alterar { background:none; border:none; color:#ec4899; font-size:0.8rem; font-weight:600; cursor:pointer; font-family:'Inter',sans-serif; }
      .ins-review-section { display:flex; flex-direction:column; gap:0.5rem; }
      .ins-review-row-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; }
      .ins-review-row-header span { font-size:0.82rem; font-weight:700; color:#ec4899; text-transform:uppercase; letter-spacing:0.05em; }
      .ins-review-row-header button { background:none; border:none; color:#6b7280; font-size:0.8rem; cursor:pointer; font-family:'Inter',sans-serif; text-decoration:underline; }
      .ins-review-item { display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0; border-bottom:1px solid #f3f4f6; }
      .ins-review-item:last-child { border-bottom:none; }
      .ins-review-item span { font-size:0.8rem; color:#6b7280; }
      .ins-review-item strong { font-size:0.85rem; color:#1f2937; text-align:right; max-width:60%; }
      .ins-sucesso { display:flex; flex-direction:column; align-items:center; gap:0.75rem; padding:3rem 1rem; text-align:center; }
      .ins-sucesso-icon { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#22c55e,#16a34a); display:flex; align-items:center; justify-content:center; margin-bottom:0.5rem; }
      .ins-overlay { position:fixed; inset:0; z-index:200; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; padding:1rem; }
      .ins-modal { background:white; border-radius:20px; padding:1.5rem; width:100%; max-width:360px; }
      .ins-btn-del-confirm { flex:1; padding:0.75rem; background:#ef4444; color:white; border:none; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
      .ins-spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:insSpin 0.7s linear infinite; display:inline-block; }
      @keyframes insSpin { to { transform:rotate(360deg); } }
    `}</style>
  );
}
