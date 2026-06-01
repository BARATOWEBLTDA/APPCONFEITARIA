import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface Receita {
  id: string;
  nome: string;
  categoria: string;
  foto_url?: string;
  ingredientes: string;
  modo_preparo: string;
  user_id?: string;
  status?: string;
  curtidas?: number;
  created_at: string;
  profiles?: { nome: string; foto_url?: string };
  is_doonly?: boolean;
  compartilhar_comunidade?: boolean;
  salva_da_comunidade?: boolean;
  anotacoes?: string;
}

const emptyForm = {
  nome: "", categoria: "", ingredientes: "", modo_preparo: "",
  foto_url: "", compartilhar_comunidade: false as boolean, anotacoes: "",
};

const CATEGORIAS = ["Bolos", "Doces", "Massas", "Recheios", "Coberturas", "Bases"];

  const CAT_FILTROS = [
    { label: "Todas", emoji: "🍽️" },
    { label: "Bolos", emoji: "🎂" },
    { label: "Doces", emoji: "🍬" },
    { label: "Massas", emoji: "🍝" },
    { label: "Recheios", emoji: "🍮" },
    { label: "Coberturas", emoji: "🍫" },
    { label: "Bases", emoji: "🧁" },
  ];


export default function Receitas() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<"home" | "comunidade" | "pdf" | "salvas" | "minhas">("home");
  const [loading, setLoading] = useState(false);

  // Comunidade
  const [comunidade, setComunidade] = useState<Receita[]>([]);
  const [filtroComun, setFiltroComun] = useState<"destaque" | "curtidas" | "recentes">("recentes");

  // PDF
  const [pdfs, setPdfs] = useState<any[]>([]);

  // Salvas
  const [salvas, setSalvas] = useState<Receita[]>([]);

  // Minhas
  const [minhas, setMinhas] = useState<Receita[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState(false);
  const [searchMinhas, setSearchMinhas] = useState("");
  const [filtroMinhas, setFiltroMinhas] = useState("");
  const [categoriasUsuario, setCategoriasUsuario] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detalhe
  const [selected, setSelected] = useState<Receita | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeModule === "comunidade") loadComunidade();
    if (activeModule === "pdf") loadPdfs();
    if (activeModule === "salvas") loadSalvas();
    if (activeModule === "minhas") loadMinhas();
  }, [activeModule, filtroComun]);

  const loadComunidade = async () => {
    setLoading(true);
    let query = supabase.from("receitas_comunidade")
      .select("*, profiles(nome, foto_url)")
      .eq("status", "aprovada");
    if (filtroComun === "curtidas") query = query.order("curtidas", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    const { data } = await query;
    setComunidade(data || []);
    setLoading(false);
  };

  const loadPdfs = async () => {
    setLoading(true);
    const { data } = await supabase.from("biblioteca_pdf").select("*").order("created_at", { ascending: false });
    setPdfs(data || []);
    setLoading(false);
  };

  const loadSalvas = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("receitas_minhas")
      .select("*").eq("user_id", userId).eq("salva_da_comunidade", true)
      .order("created_at", { ascending: false });
    setSalvas(data || []);
    setLoading(false);
  };

  const loadMinhas = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("receitas_minhas")
      .select("*").eq("user_id", userId)
      .order("created_at", { ascending: false });
    setMinhas(data || []);
    // Extract unique categories from user's recipes
    const cats = [...new Set((data || []).map(r => r.categoria).filter(Boolean))];
    setCategoriasUsuario(cats);
    setLoading(false);
  };

  const handleCurtir = async (r: Receita) => {
    await supabase.from("receitas_comunidade").update({ curtidas: (r.curtidas || 0) + 1 }).eq("id", r.id);
    loadComunidade();
  };

  const handleSalvar = async (r: Receita) => {
    if (!userId) return;
    await supabase.from("receitas_minhas").insert({
      user_id: userId,
      nome: `${r.nome} (cópia)`,
      categoria: r.categoria,
      ingredientes: r.ingredientes,
      modo_preparo: r.modo_preparo,
      foto_url: r.foto_url,
      salva_da_comunidade: true,
    });
    alert("Receita salva em Minhas Receitas!");
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPreview(URL.createObjectURL(file));
    const path = `receitas/${userId}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const handleSaveReceita = async () => {
    if (!form.nome.trim() || !userId) return;
    setSaving(true);
    const { compartilhar_comunidade, ...formData } = form;
    const payload = { ...formData, user_id: userId };
    if (editId) {
      await supabase.from("receitas_minhas").update(payload).eq("id", editId);
    } else {
      await supabase.from("receitas_minhas").insert({ ...payload, salva_da_comunidade: false });
      if (form.compartilhar_comunidade) {
        await supabase.from("receitas_comunidade").insert({
          user_id: userId,
          nome: form.nome,
          categoria: form.categoria,
          ingredientes: form.ingredientes,
          modo_preparo: form.modo_preparo,
          foto_url: form.foto_url,
          status: "pendente",
        });
      }
    }
    await loadMinhas();
    setShowForm(false);
    setForm(emptyForm);
    setEditId(null);
    setPreview(null);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("receitas_minhas").delete().eq("id", id);
    loadMinhas();
  };

  // Cards iniciais
  const modules = [
    { id: "comunidade", emoji: "👩‍🍳", title: "Receitas da Comunidade", desc: "Descubra novas receitas e compartilhe as suas.", color: "#f9007a" },
    { id: "pdf", emoji: "📄", title: "Receitas em PDF", desc: "Apostilas e materiais exclusivos do Doonly.", color: "#8b5cf6" },
    { id: "salvas", emoji: "⭐", title: "Receitas Salvas", desc: "Receitas da comunidade que você guardou.", color: "#f59e0b" },
    { id: "minhas", emoji: "📝", title: "Minhas Receitas", desc: "Crie e organize suas próprias receitas.", color: "#10b981" },
  ];

  const ReceitaCard = ({ r, onSelect }: { r: Receita; onSelect: () => void; showActions?: boolean }) => (
    <div className="rec-card" onClick={onSelect}>
      <div className="rec-card-img">
        {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
        {r.curtidas !== undefined && r.curtidas > 0 && (
          <span className="rec-curtidas">❤️ {r.curtidas}</span>
        )}
        {r.is_doonly && <span className="rec-doonly-badge">🏅</span>}
      </div>
      <div className="rec-card-body">
        <p className="rec-nome">{r.nome}</p>
        <span className="rec-cat">Categoria: {r.categoria || "Geral"}</span>
        {r.profiles && <p className="rec-autor">por {r.profiles.nome || "Anônimo"}</p>}
      </div>
    </div>
  );



  const DetalheModal = ({ r }: { r: Receita }) => (
    <div className="rec-overlay" onClick={() => setSelected(null)}>
      <div className="rec-detail-modal" onClick={e => e.stopPropagation()}>
        <button className="rec-detail-close" onClick={() => setSelected(null)}>✕</button>
        {r.foto_url && <img src={r.foto_url} alt={r.nome} className="rec-detail-img" />}
        <div className="rec-detail-body">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
            <span className="rec-cat">{r.categoria}</span>
            {r.is_doonly && <span className="rec-verified">🏅 Verificada Doonly</span>}
          </div>
          <h2 className="rec-detail-title">{r.nome}</h2>
          {r.profiles && <p className="rec-detail-autor">por {r.profiles.nome || "Anônimo"}</p>}
          {r.curtidas !== undefined && <p className="rec-detail-curtidas">❤️ {r.curtidas} curtidas</p>}

          <div className="rec-detail-section">
            <h3>Ingredientes</h3>
            <p>{r.ingredientes}</p>
          </div>
          <div className="rec-detail-section">
            <h3>Modo de preparo</h3>
            <p>{r.modo_preparo}</p>
          </div>

          {activeModule === "comunidade" && (
            <div className="rec-detail-actions">
              <button className="rec-act-btn curtir" onClick={() => { handleCurtir(r); setSelected(null); }}>❤️ Curtir</button>
              <button className="rec-act-btn salvar" onClick={() => { handleSalvar(r); setSelected(null); }}>📥 Salvar receita</button>
            </div>
          )}
          {activeModule === "minhas" && !r.salva_da_comunidade && (
            <div className="rec-detail-actions">
              <button className="rec-act-btn editar" onClick={() => {
                setForm({ nome: r.nome, categoria: r.categoria, ingredientes: r.ingredientes, modo_preparo: r.modo_preparo, foto_url: r.foto_url || "", compartilhar_comunidade: false, anotacoes: r.anotacoes || "" });
                setPreview(r.foto_url || null);
                setEditId(r.id);
                setSelected(null);
                setShowForm(true);
              }}>✏️ Editar</button>
              <button className="rec-act-btn deletar" onClick={() => { handleDelete(r.id); setSelected(null); }}>🗑️ Excluir</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rec-root">

      {/* ===== MOBILE ===== */}
      <div className="rec-mobile">

        {/* Conteúdo da aba ativa */}
        <div className="rec-mob-content">

          {/* Minhas Receitas (home do módulo) */}
          {activeModule === "minhas" && (
            <>
              <div className="rec-mob-header"><h1>Minhas Receitas</h1></div>
              <button className="rec-btn-new" onClick={() => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); }}>
                + Nova Receita
              </button>

              {/* Busca */}
              <div className="rec-search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar receitas..." value={searchMinhas} onChange={e => setSearchMinhas(e.target.value)} className="rec-search-input" />
              </div>

              {/* Filtro categorias - apenas as que o usuário tem receitas */}
              {categoriasUsuario.length > 0 && (
                <div className="rec-cat-filtros">
                  <button className={`rec-cat-btn ${filtroMinhas === "" ? "active" : ""}`} onClick={() => setFiltroMinhas("")}>
                    <span className="rec-cat-emoji">🍽️</span>
                  </button>
                  {categoriasUsuario.map(cat => {
                    const emojiMap: {[k:string]:string} = { "Bolos":"🎂","Doces":"🍬","Massas":"🍝","Recheios":"🍮","Coberturas":"🍫","Bases":"🧁" };
                    return (
                      <button key={cat} className={`rec-cat-btn ${filtroMinhas === cat ? "active" : ""}`} onClick={() => setFiltroMinhas(cat)}>
                        <span className="rec-cat-emoji">{emojiMap[cat] || "🍴"}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (() => {
                const filtered = minhas.filter(r =>
                  r.nome.toLowerCase().includes(searchMinhas.toLowerCase()) &&
                  (filtroMinhas === "" || r.categoria === filtroMinhas)
                );
                return (
                  <div className="rec-grid">
                    {filtered.length === 0 ? <p className="rec-empty">Nenhuma receita encontrada</p> : filtered.map(r => (
                      <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* PDFs */}
          {activeModule === "pdf" && (
            <>
              <div className="rec-mob-header"><h1>Receitas em PDF</h1></div>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-pdf-list">
                  {pdfs.length === 0 ? <p className="rec-empty">Nenhum material disponível ainda</p> : pdfs.map(p => (
                    <a key={p.id} href={p.pdf_url} target="_blank" rel="noreferrer" className="rec-pdf-item">
                      <div className="rec-pdf-capa">
                        {p.capa_url ? <img src={p.capa_url} alt={p.titulo} /> : <span>📄</span>}
                      </div>
                      <div className="rec-pdf-info">
                        <span className="rec-cat">{p.categoria || "Geral"}</span>
                        <p className="rec-nome">{p.titulo}</p>
                        <p className="rec-autor">{p.descricao}</p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </a>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Salvas/Favoritos */}
          {activeModule === "salvas" && (
            <>
              <div className="rec-mob-header"><h1>Receitas Favoritas</h1></div>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid">
                  {salvas.length === 0 ? <p className="rec-empty">Nenhuma receita salva ainda</p> : salvas.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Comunidade */}
          {activeModule === "comunidade" && (
            <>
              <div className="rec-mob-header"><h1>Comunidade</h1></div>
              <div className="rec-filtros">
                {([["recentes","🆕","Recentes"],["curtidas","❤️","Mais curtidas"]] as any[]).map(([v,ic,lb]) => (
                  <button key={v} className={`rec-filtro ${filtroComun === v ? "active" : ""}`} onClick={() => setFiltroComun(v)}>{ic} {lb}</button>
                ))}
              </div>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid">
                  {comunidade.length === 0 ? <p className="rec-empty">Nenhuma receita ainda</p> : comunidade.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} showActions />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Home - módulo padrão */}
          {activeModule === "home" && (
            <>
              <div className="rec-mob-header"><h1>Receitas</h1></div>
              <div className="rec-grid">
                {minhas.length === 0 ? <p className="rec-empty">Nenhuma receita criada ainda</p> : minhas.map(r => (
                  <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Bottom nav específico de receitas */}
        <div className="rec-bottom-nav">
          <button className="rec-nav-item" onClick={() => navigate("/inicio")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Início</span>
          </button>
          <button className={`rec-nav-item ${activeModule === "pdf" ? "active" : ""}`} onClick={() => setActiveModule("pdf")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>PDFs</span>
          </button>
          <button className={`rec-nav-item ${activeModule === "minhas" ? "active" : ""}`} onClick={() => setActiveModule("minhas")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Receitas</span>
          </button>
          <button className={`rec-nav-item ${activeModule === "salvas" ? "active" : ""}`} onClick={() => setActiveModule("salvas")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>Favoritos</span>
          </button>
          <button className={`rec-nav-item ${activeModule === "comunidade" ? "active" : ""}`} onClick={() => setActiveModule("comunidade")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Comunidade</span>
          </button>
        </div>
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="rec-desktop">
        {/* Sidebar módulos */}
        <div className="rec-sidebar">
          <h2 className="rec-sidebar-title">Receitas</h2>
          {modules.map(m => (
            <button key={m.id} className={`rec-sidebar-item ${activeModule === m.id ? "active" : ""}`}
              onClick={() => setActiveModule(m.id as any)}
              style={activeModule === m.id ? { borderLeft: `3px solid ${m.color}`, color: m.color } : {}}>
              <span>{m.emoji}</span>
              <span>{m.title}</span>
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="rec-content">
          {activeModule === "home" && (
            <div>
              <h1 className="rec-page-title">Receitas</h1>
              <p className="rec-page-sub">Explore, crie e compartilhe receitas</p>
              <div className="rec-home-grid">
                {modules.map(m => (
                  <button key={m.id} className="rec-home-card" onClick={() => setActiveModule(m.id as any)}
                    style={{ borderTop: `4px solid ${m.color}` }}>
                    <span className="rec-home-emoji">{m.emoji}</span>
                    <h3>{m.title}</h3>
                    <p>{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeModule === "comunidade" && (
            <div>
              <h1 className="rec-page-title">👩‍🍳 Receitas da Comunidade</h1>
              <div className="rec-filtros">
                {([["recentes","🆕","Mais recentes"],["curtidas","❤️","Mais curtidas"]] as any[]).map(([v,ic,lb]) => (
                  <button key={v} className={`rec-filtro ${filtroComun === v ? "active" : ""}`} onClick={() => setFiltroComun(v)}>{ic} {lb}</button>
                ))}
              </div>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid-desktop">
                  {comunidade.length === 0 ? <p className="rec-empty">Nenhuma receita aprovada ainda</p> : comunidade.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} showActions />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModule === "pdf" && (
            <div>
              <h1 className="rec-page-title">📄 Receitas em PDF</h1>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-pdf-grid">
                  {pdfs.length === 0 ? <p className="rec-empty">Nenhum material disponível ainda</p> : pdfs.map(p => (
                    <a key={p.id} href={p.pdf_url} target="_blank" rel="noreferrer" className="rec-pdf-card">
                      <div className="rec-pdf-card-img">
                        {p.capa_url ? <img src={p.capa_url} alt={p.titulo} /> : <span>📄</span>}
                      </div>
                      <div style={{ padding: "0.9rem" }}>
                        <span className="rec-cat">{p.categoria || "Geral"}</span>
                        <p className="rec-nome" style={{ marginTop: "0.35rem" }}>{p.titulo}</p>
                        <p className="rec-autor">{p.descricao}</p>
                        <span className="rec-pdf-baixar">📥 Baixar PDF</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModule === "salvas" && (
            <div>
              <h1 className="rec-page-title">⭐ Receitas Salvas</h1>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid-desktop">
                  {salvas.length === 0 ? <p className="rec-empty">Nenhuma receita salva ainda.<br/><small>Explore a comunidade e salve receitas que gostar!</small></p> : salvas.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeModule === "minhas" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h1 className="rec-page-title" style={{ margin: 0 }}>📝 Minhas Receitas</h1>
                <button className="rec-btn-new" onClick={() => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); }}>
                  + Nova Receita
                </button>
              </div>

              {/* Busca desktop */}
              <div className="rec-search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar receitas..." value={searchMinhas} onChange={e => setSearchMinhas(e.target.value)} className="rec-search-input" />
              </div>

              {/* Filtro categorias desktop - apenas as que o usuário tem receitas */}
              {categoriasUsuario.length > 0 && (
                <div className="rec-cat-filtros">
                  <button className={`rec-cat-btn ${filtroMinhas === "" ? "active" : ""}`} onClick={() => setFiltroMinhas("")}>
                    <span className="rec-cat-emoji">🍽️</span>
                  </button>
                  {categoriasUsuario.map(cat => {
                    const emojiMap: {[k:string]:string} = { "Bolos":"🎂","Doces":"🍬","Massas":"🍝","Recheios":"🍮","Coberturas":"🍫","Bases":"🧁" };
                    return (
                      <button key={cat} className={`rec-cat-btn ${filtroMinhas === cat ? "active" : ""}`} onClick={() => setFiltroMinhas(cat)}>
                        <span className="rec-cat-emoji">{emojiMap[cat] || "🍴"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (() => {
                const filteredDesk = minhas.filter(r =>
                  r.nome.toLowerCase().includes(searchMinhas.toLowerCase()) &&
                  (filtroMinhas === "" || r.categoria === filtroMinhas)
                );
                return (
                  <div className="rec-grid-desktop">
                    {filteredDesk.length === 0 ? <p className="rec-empty">Nenhuma receita encontrada</p> : filteredDesk.map(r => (
                      <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      {showForm && (
        <div className="rec-overlay" onClick={() => setShowForm(false)}>
          <div className="rec-form-modal" onClick={e => e.stopPropagation()}>
            <div className="rec-form-header">
              <h2>{editId ? "Editar" : "Nova"} Receita</h2>
              <button className="rec-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="rec-form-scroll">
              <div className="rec-form-foto" onClick={() => fileRef.current?.click()}>
                {preview ? <img src={preview} alt="" /> : <span>📷 Adicionar foto</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
              <div className="rec-fields">
                <div className="rec-field"><label>Nome da receita *</label><input placeholder="Ex: Bolo de Chocolate" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>

                <div className="rec-field">
                  <label>Categoria</label>
                  {novaCategoria ? (
                    <div style={{display:"flex",gap:"0.5rem"}}>
                      <input placeholder="Digite a categoria..." value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} style={{flex:1}} />
                      <button type="button" onClick={() => setNovaCategoria(false)} style={{padding:"0 0.75rem",background:"#f3f4f6",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"0.8rem",color:"#6b7280"}}>Voltar</button>
                    </div>
                  ) : (
                    <select value={form.categoria} onChange={e => { if (e.target.value === "__nova__") { setNovaCategoria(true); setForm({...form, categoria: ""}); } else setForm({ ...form, categoria: e.target.value }); }}>
                      <option value="">Selecione...</option>
                      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__nova__">+ Criar outra personalizada</option>
                    </select>
                  )}
                </div>

                <div className="rec-field"><label>Ingredientes</label><textarea rows={4} placeholder="Liste os ingredientes (um por linha ou separados por vírgula)..." value={form.ingredientes} onChange={e => setForm({ ...form, ingredientes: e.target.value })} /></div>

                <div className="rec-field"><label>Modo de preparo</label><textarea rows={5} placeholder="Descreva o passo a passo..." value={form.modo_preparo} onChange={e => setForm({ ...form, modo_preparo: e.target.value })} /></div>

                <div className="rec-field"><label>Anotações <span style={{fontWeight:400,color:"#9ca3af"}}>(opcional)</span></label><textarea rows={2} placeholder="Dicas, variações, observações..." value={form.anotacoes || ""} onChange={e => setForm({ ...form, anotacoes: e.target.value })} /></div>
                {!editId && (
                  <label className="rec-share-toggle">
                    <input type="checkbox" checked={form.compartilhar_comunidade} onChange={e => setForm({ ...form, compartilhar_comunidade: e.target.checked })} />
                    <span>Compartilhar com a comunidade</span>
                    <small>Sua receita será enviada para moderação antes de aparecer</small>
                  </label>
                )}
              </div>
            </div>
            <div className="rec-form-footer">
              <button className="rec-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="rec-btn-save" onClick={handleSaveReceita} disabled={saving}>
                {saving ? <span className="rec-spinner" /> : editId ? "Salvar" : "Criar receita"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && <DetalheModal r={selected} />}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .rec-root { font-family: 'Inter', sans-serif; overflow-x: hidden; max-width: 100%; }

        .rec-mobile { display: flex; flex-direction: column; overflow-x: hidden; width: 100%; max-width: 100%; }
        .rec-desktop { display: none; }
        @media (min-width: 768px) {
          .rec-mobile { display: none; }
          .rec-desktop { display: flex; gap: 1.5rem; align-items: flex-start; }
        }

        /* ===== MOBILE ===== */
        .rec-mob-header { padding: 0.5rem 0 1rem; }
        .rec-mob-header h1 { font-size: 1.4rem; font-weight: 800; color: #1f2937; margin: 0 0 0.2rem; }
        .rec-mob-header p { font-size: 0.85rem; color: #9ca3af; margin: 0; }

        .rec-mob-modules { display: flex; flex-direction: column; gap: 0.6rem; }
        .rec-mob-module { display: flex; align-items: center; gap: 0.9rem; background: white; border: none; border-radius: 14px; padding: 1rem; cursor: pointer; text-align: left; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.15s; }
        .rec-mob-module:hover { transform: translateY(-1px); }
        .rec-mob-module-emoji { font-size: 1.6rem; flex-shrink: 0; }
        .rec-mob-module-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .rec-mob-module-desc { font-size: 0.75rem; color: #9ca3af; margin: 0; }

        .rec-mob-back { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 600; color: #1f2937; cursor: pointer; padding: 0 0 1rem; }
        .rec-mob-content { display: flex; flex-direction: column; }

        /* ===== DESKTOP ===== */
        .rec-sidebar { width: 220px; flex-shrink: 0; background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: sticky; top: 1rem; }
        .rec-sidebar-title { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0 0 1rem; }
        .rec-sidebar-item { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.7rem 0.75rem; background: none; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; color: #6b7280; cursor: pointer; text-align: left; transition: all 0.15s; }
        .rec-sidebar-item:hover { background: #f9fafb; color: #1f2937; }
        .rec-sidebar-item.active { background: #fff0f6; font-weight: 600; }

        .rec-content { flex: 1; min-width: 0; }
        .rec-page-title { font-size: 1.4rem; font-weight: 800; color: #1f2937; margin: 0 0 1.25rem; }
        .rec-page-sub { font-size: 0.88rem; color: #9ca3af; margin: -0.75rem 0 1.25rem; }

        .rec-home-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .rec-home-card { background: white; border-radius: 14px; padding: 1.5rem; text-align: left; cursor: pointer; border: none; box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: transform 0.15s, box-shadow 0.15s; font-family: 'Inter', sans-serif; }
        .rec-home-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .rec-home-emoji { font-size: 2rem; display: block; margin-bottom: 0.75rem; }
        .rec-home-card h3 { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin: 0 0 0.4rem; }
        .rec-home-card p { font-size: 0.82rem; color: #9ca3af; margin: 0; line-height: 1.4; }

        /* Filtros */
        .rec-filtros { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .rec-filtro { padding: 0.45rem 0.9rem; border-radius: 20px; border: 1.5px solid #e5e7eb; background: white; font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 500; cursor: pointer; color: #6b7280; transition: all 0.15s; }
        .rec-filtro.active { background: #f9007a; color: white; border-color: #f9007a; }

        /* Cards grid */
        .rec-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.65rem; width: 100%; }
        .rec-grid-desktop { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }

        .rec-card { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); cursor: pointer; border: 1px solid #f3f4f6; transition: transform 0.15s, box-shadow 0.15s; display: flex; flex-direction: column; }
        .rec-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
        .rec-card-img { aspect-ratio: 1/1; background: #f9fafb; display: flex; align-items: center; justify-content: center; font-size: 2rem; overflow: hidden; position: relative; width: 100%; border-radius: 8px 8px 0 0; }
        .rec-card-img img { width: 100%; height: 100%; object-fit: cover; border-radius: 8px 8px 0 0; }
        .rec-curtidas { position: absolute; top: 0.4rem; right: 0.4rem; background: rgba(0,0,0,0.45); color: white; font-size: 0.62rem; padding: 0.15rem 0.45rem; border-radius: 20px; }
        .rec-doonly-badge { position: absolute; top: 0.4rem; left: 0.4rem; font-size: 0.85rem; }
        .rec-card-body { padding: 0.6rem 0.7rem 0.7rem; flex: 1; display: flex; flex-direction: column; }
        .rec-nome { font-size: 0.78rem; font-weight: 600; color: #111827; margin: 0 0 0.2rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .rec-cat { font-size: 0.68rem; color: #9ca3af; display: block; }
        .rec-autor { font-size: 0.68rem; color: #c4b5c0; margin: 0.1rem 0 0; }

        /* PDF */
        .rec-pdf-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .rec-pdf-item { display: flex; align-items: center; gap: 0.9rem; background: white; border-radius: 12px; padding: 0.75rem; text-decoration: none; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        .rec-pdf-capa { width: 52px; height: 52px; border-radius: 8px; background: #f9fafb; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .rec-pdf-capa img { width: 100%; height: 100%; object-fit: cover; }
        .rec-pdf-info { flex: 1; min-width: 0; }

        .rec-pdf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .rec-pdf-card { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-decoration: none; display: block; transition: transform 0.15s; }
        .rec-pdf-card:hover { transform: translateY(-2px); }
        .rec-pdf-card-img { height: 130px; background: #f9fafb; display: flex; align-items: center; justify-content: center; font-size: 3rem; overflow: hidden; }
        .rec-pdf-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .rec-pdf-baixar { display: inline-block; margin-top: 0.5rem; font-size: 0.78rem; font-weight: 600; color: #8b5cf6; }

        /* Botão nova receita */
        .rec-btn-new { padding: 0.7rem 1.25rem; background: linear-gradient(270deg, #f9007a, #ff6eb4, #d4006a, #f9007a); background-size: 300% 300%; animation: gradientShift 3s ease infinite; color: white; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; margin-bottom: 1rem; box-shadow: 0 4px 15px rgba(249,0,122,0.3); }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .rec-loading { display: flex; justify-content: center; padding: 3rem; }
        .rec-empty { color: #9ca3af; text-align: center; padding: 2rem; font-size: 0.88rem; line-height: 1.6; }

        /* Form modal */
        .rec-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 768px) { .rec-overlay { align-items: center; padding: 1rem; } }
        .rec-form-modal { background: white; border-radius: 24px 24px 0 0; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .rec-form-modal { border-radius: 20px; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .rec-form-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.25rem 0.75rem; border-bottom: 1px solid #f3f4f6; }
        .rec-form-header h2 { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0; }
        .rec-close { background: #f3f4f6; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
        .rec-form-scroll { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
        .rec-form-foto { width: 100%; height: 140px; background: #f9fafb; border: 2px dashed #e5e7eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 1rem; overflow: hidden; font-size: 0.88rem; color: #9ca3af; font-family: 'Inter', sans-serif; }
        .rec-form-foto img { width: 100%; height: 100%; object-fit: cover; }
        .rec-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .rec-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .rec-field label { font-size: 0.82rem; font-weight: 600; color: #374151; }
        .rec-field input, .rec-field select, .rec-field textarea { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.88rem; color: #1f2937; outline: none; resize: none; }
        .rec-field input:focus, .rec-field select:focus, .rec-field textarea:focus { border-color: #f9007a; }
        .rec-share-toggle { display: flex; flex-direction: column; gap: 0.2rem; cursor: pointer; background: #f9fafb; border-radius: 10px; padding: 0.75rem; }
        .rec-share-toggle input { margin-right: 0.5rem; accent-color: #f9007a; }
        .rec-share-toggle span { font-size: 0.88rem; font-weight: 600; color: #1f2937; }
        .rec-share-toggle small { font-size: 0.75rem; color: #9ca3af; }
        .rec-form-footer { display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem 1.25rem; border-top: 1px solid #f3f4f6; }
        .rec-btn-cancel { flex: 1; padding: 0.8rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; }
        .rec-btn-save { flex: 1; padding: 0.8rem; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rec-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Detalhe modal */
        .rec-detail-modal { background: white; border-radius: 24px 24px 0 0; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; position: relative; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .rec-detail-modal { border-radius: 20px; } }
        .rec-detail-close { position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.3); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; color: white; z-index: 1; display: flex; align-items: center; justify-content: center; }
        .rec-detail-img { width: 100%; height: 200px; object-fit: cover; border-radius: 20px 20px 0 0; }
        .rec-detail-body { padding: 1.25rem; }
        .rec-detail-title { font-size: 1.2rem; font-weight: 700; color: #1f2937; margin: 0.5rem 0 0.25rem; }
        .rec-detail-autor { font-size: 0.82rem; color: #9ca3af; margin: 0 0 0.25rem; }
        .rec-detail-curtidas { font-size: 0.82rem; color: #f9007a; font-weight: 600; margin: 0 0 1rem; }
        .rec-detail-section { margin-bottom: 1rem; }
        .rec-detail-section h3 { font-size: 0.88rem; font-weight: 700; color: #374151; margin: 0 0 0.4rem; }
        .rec-detail-section p { font-size: 0.85rem; color: #6b7280; line-height: 1.6; margin: 0; white-space: pre-line; }
        .rec-detail-actions { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
        .rec-act-btn { flex: 1; padding: 0.75rem; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .rec-act-btn.curtir { background: #fff0f6; color: #f9007a; }
        .rec-act-btn.salvar { background: #f0fdf4; color: #16a34a; }
        .rec-act-btn.editar { background: #eff6ff; color: #3b82f6; }
        .rec-act-btn.deletar { background: #fff1f2; color: #ef4444; }

        /* Search - match ProductList style */
        .rec-search-wrap { position: relative; max-width: 100%; margin-bottom: 1rem; }
        .rec-search-wrap svg { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #9ca3af; }
        .rec-search-input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid #e5e7eb; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.88rem; color: #1f2937; background: white; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        .rec-search-input:focus { border-color: #f9007a; box-shadow: 0 0 0 3px rgba(249,0,122,0.1); }
        .rec-search-input::placeholder { color: #9ca3af; }

        /* Category filter - match CategoryFilter.tsx style */
        .rec-cat-filtros { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.25rem 0.5rem 0.75rem; margin-bottom: 0.75rem; scrollbar-width: none; -ms-overflow-style: none; }
        .rec-cat-filtros::-webkit-scrollbar { display: none; }
        .rec-cat-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #fe62a6; border: 3px solid #DBDFE4; outline: 2px solid white; cursor: pointer; transition: all 0.2s; padding: 6px; flex-shrink: 0; min-width: 56px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .rec-cat-btn:hover { background: #2E2E2E; transform: scale(1.05); }
        .rec-cat-btn.active { background: #2E2E2E; }
        .rec-cat-emoji { font-size: 1.6rem; display: flex; align-items: center; justify-content: center; }
        .rec-cat-btn-label { display: none; }

        /* Bottom nav receitas */
        .rec-bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          background: #ffffff;
          display: flex; align-items: center; justify-content: space-around;
          padding: 0.5rem 0 1rem;
          box-shadow: 0 -2px 12px rgba(0,0,0,0.12);
        }
        .rec-mob-content { padding-bottom: 5.5rem; overflow-x: hidden; width: 100%; }
        .rec-nav-item {
          display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
          background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif; font-size: 0.6rem; font-weight: 600;
          color: #9ca3af; padding: 0.35rem 0.5rem;
          transition: color 0.15s; flex: 1;
        }
        .rec-nav-item svg { color: inherit; }
        .rec-nav-item.active { color: #f9007a; }
        .rec-nav-item:hover { color: #f9007a; }
        .rec-mob-header { padding: 0.5rem 0 1rem; }
        .rec-mob-header h1 { font-size: 1.4rem; font-weight: 800; color: #1f2937; margin: 0; }

                .rec-spinner { width: 22px; height: 22px; border: 2px solid rgba(249,0,122,0.2); border-top-color: #f9007a; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
