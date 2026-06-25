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
}

const emptyForm = {
  nome: "", categoria: "", ingredientes: "", modo_preparo: "",
  foto_url: "", compartilhar_comunidade: false,
};

const CATEGORIAS = ["Bolos", "Cupcakes", "Brigadeiros", "Doces Finos", "Tortas", "Recheios", "Coberturas", "Outros"];

export default function Receitas() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<"home" | "comunidade" | "pdf" | "salvas" | "minhas" | "doonly">("home");
  const [loading, setLoading] = useState(false);

  const [comunidade, setComunidade] = useState<Receita[]>([]);
  const [filtroComun, setFiltroComun] = useState<"destaque" | "curtidas" | "recentes">("recentes");
  const [pdfs, setPdfs] = useState<any[]>([]);
  const [salvas, setSalvas] = useState<Receita[]>([]);
  const [doonly, setDoonly] = useState<any[]>([]);

  const [minhas, setMinhas] = useState<Receita[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
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
    if (activeModule === "doonly") {
      supabase.from("receitas_doonly").select("*").order("created_at", { ascending: false })
        .then(({ data }) => { if (data) setDoonly(data); });
    }
  }, [activeModule, filtroComun]);

  const loadComunidade = async () => {
    setLoading(true);
    let query = supabase.from("receitas_comunidade").select("*, profiles(nome, foto_url)").eq("status", "aprovada");
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
    const { data } = await supabase.from("receitas_minhas").select("*").eq("user_id", userId).eq("salva_da_comunidade", true).order("created_at", { ascending: false });
    setSalvas(data || []);
    setLoading(false);
  };

  const loadMinhas = async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.from("receitas_minhas").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    setMinhas(data || []);
    setLoading(false);
  };

  const handleCurtir = async (r: Receita) => {
    await supabase.from("receitas_comunidade").update({ curtidas: (r.curtidas || 0) + 1 }).eq("id", r.id);
    loadComunidade();
  };

  const handleSalvar = async (r: Receita) => {
    if (!userId) return;
    await supabase.from("receitas_minhas").insert({ user_id: userId, nome: `${r.nome} (cópia)`, categoria: r.categoria, ingredientes: r.ingredientes, modo_preparo: r.modo_preparo, foto_url: r.foto_url, salva_da_comunidade: true });
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
    const payload = { ...form, user_id: userId };
    if (editId) {
      await supabase.from("receitas_minhas").update(payload).eq("id", editId);
    } else {
      await supabase.from("receitas_minhas").insert({ ...payload, salva_da_comunidade: false });
      if (form.compartilhar_comunidade) {
        await supabase.from("receitas_comunidade").insert({ user_id: userId, nome: form.nome, categoria: form.categoria, ingredientes: form.ingredientes, modo_preparo: form.modo_preparo, foto_url: form.foto_url, status: "pendente" });
      }
    }
    await loadMinhas();
    setShowForm(false); setForm(emptyForm); setEditId(null); setPreview(null); setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("receitas_minhas").delete().eq("id", id);
    loadMinhas();
  };

  const modules = [
    { id: "pdf",       emoji: "📄", title: "PDFs",            desc: "Apostilas e materiais exclusivos do Doonly.",      color: "#8b5cf6" },
    { id: "doonly",    emoji: "⭐", title: "Receitas",         desc: "Receitas exclusivas criadas pela equipe Doonly.",  color: "var(--primary)" },
    { id: "salvas",    emoji: "🔖", title: "Favoritos",        desc: "Receitas da comunidade que você guardou.",        color: "var(--warning)" },
    { id: "comunidade",emoji: "👩‍🍳", title: "Comunidade",       desc: "Descubra novas receitas e compartilhe as suas.", color: "var(--success)" },
    { id: "minhas",    emoji: "📝", title: "Minhas Receitas",  desc: "Crie e organize suas próprias receitas.",          color: "var(--info)" },
  ];

  const ReceitaCard = ({ r, onSelect }: { r: Receita; onSelect: () => void; showActions?: boolean }) => (
    <div className="rec-card" onClick={onSelect}>
      <div className="rec-card-img">
        {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
        {r.curtidas !== undefined && r.curtidas > 0 && <span className="rec-curtidas">❤️ {r.curtidas}</span>}
      </div>
      <div className="rec-card-body">
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
          <span className="rec-cat">{r.categoria || "Geral"}</span>
          {r.is_doonly && <span className="rec-verified">🏅 Verificada</span>}
        </div>
        <p className="rec-nome">{r.nome}</p>
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
          <div className="rec-detail-section"><h3>Ingredientes</h3><p>{r.ingredientes}</p></div>
          <div className="rec-detail-section"><h3>Modo de preparo</h3><p>{r.modo_preparo}</p></div>
          {activeModule === "comunidade" && (
            <div className="rec-detail-actions">
              <button className="rec-act-btn curtir" onClick={() => { handleCurtir(r); setSelected(null); }}>❤️ Curtir</button>
              <button className="rec-act-btn salvar" onClick={() => { handleSalvar(r); setSelected(null); }}>📥 Salvar receita</button>
            </div>
          )}
          {activeModule === "minhas" && !r.salva_da_comunidade && (
            <div className="rec-detail-actions">
              <button className="rec-act-btn editar" onClick={() => {
                setForm({ nome: r.nome, categoria: r.categoria, ingredientes: r.ingredientes, modo_preparo: r.modo_preparo, foto_url: r.foto_url || "", compartilhar_comunidade: false });
                setPreview(r.foto_url || null); setEditId(r.id); setSelected(null); setShowForm(true);
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
        {activeModule === "home" && (
          <>
            <div className="rec-mob-header">
              <h1>Receitas</h1>
              <p>Explore, crie e compartilhe</p>
            </div>
            <div className="rec-mob-modules">
              {modules.map(m => (
                <button key={m.id} className="rec-mob-module" style={{ borderLeft: `4px solid ${m.color}` }}
                  onClick={() => setActiveModule(m.id as any)}>
                  <span className="rec-mob-module-emoji">{m.emoji}</span>
                  <div>
                    <p className="rec-mob-module-title">{m.title}</p>
                    <p className="rec-mob-module-desc">{m.desc}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              ))}
            </div>
          </>
        )}

        {activeModule !== "home" && (
          <div className="rec-mob-content">
            <button className="rec-mob-back" onClick={() => setActiveModule("home")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {modules.find(m => m.id === activeModule)?.title}
            </button>

            {activeModule === "comunidade" && (
              <>
                <div className="rec-filtros">
                  {([["recentes","🆕","Recentes"],["curtidas","⭐","Mais curtidas"]] as any[]).map(([v,ic,lb]) => (
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

            {activeModule === "pdf" && (
              loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </a>
                  ))}
                </div>
              )
            )}

            {activeModule === "doonly" && (
              loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid">
                  {doonly.length === 0 ? <p className="rec-empty">Nenhuma receita disponível ainda</p> : doonly.map(r => (
                    <div key={r.id} className="rec-card" onClick={() => setSelected(r)}>
                      <div className="rec-card-img">
                        {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
                      </div>
                      <div className="rec-card-info">
                        <span className="rec-cat">{r.categoria || "Geral"}</span>
                        <p className="rec-nome">{r.nome}</p>
                        {r.descricao && <p className="rec-autor">{r.descricao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeModule === "salvas" && (
              loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid">
                  {salvas.length === 0 ? <p className="rec-empty">Nenhuma receita salva ainda</p> : salvas.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                  ))}
                </div>
              )
            )}

            {activeModule === "minhas" && (
              <>
                <button className="rec-btn-new" onClick={() => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); }}>
                  + Nova Receita
                </button>
                {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                  <div className="rec-grid">
                    {minhas.length === 0 ? <p className="rec-empty">Nenhuma receita criada ainda</p> : minhas.map(r => (
                      <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="rec-desktop">
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

          {activeModule === "doonly" && (
            <div>
              <h1 className="rec-page-title">⭐ Receitas</h1>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid-desktop">
                  {doonly.length === 0 ? <p className="rec-empty">Nenhuma receita disponível ainda</p> : doonly.map(r => (
                    <div key={r.id} className="rec-card" onClick={() => setSelected(r)} style={{cursor:"pointer"}}>
                      <div className="rec-card-img">
                        {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
                      </div>
                      <div className="rec-card-info">
                        <span className="rec-cat">{r.categoria || "Geral"}</span>
                        <p className="rec-nome">{r.nome}</p>
                        {r.descricao && <p className="rec-autor">{r.descricao}</p>}
                      </div>
                    </div>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h1 className="rec-page-title" style={{ margin: 0 }}>📝 Minhas Receitas</h1>
                <button className="rec-btn-new" onClick={() => { setForm(emptyForm); setPreview(null); setEditId(null); setShowForm(true); }}>
                  + Nova Receita
                </button>
              </div>
              {loading ? <div className="rec-loading"><span className="rec-spinner" /></div> : (
                <div className="rec-grid-desktop">
                  {minhas.length === 0 ? <p className="rec-empty">Nenhuma receita criada ainda.<br/><small>Crie sua primeira receita!</small></p> : minhas.map(r => (
                    <ReceitaCard key={r.id} r={r} onSelect={() => setSelected(r)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Form */}
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
                <div className="rec-field"><label>Nome da receita *</label><input placeholder="Ex: Brigadeiro Gourmet" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="rec-field">
                  <label>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="rec-field"><label>Ingredientes</label><textarea rows={4} placeholder="Liste os ingredientes..." value={form.ingredientes} onChange={e => setForm({ ...form, ingredientes: e.target.value })} /></div>
                <div className="rec-field"><label>Modo de preparo</label><textarea rows={5} placeholder="Descreva o passo a passo..." value={form.modo_preparo} onChange={e => setForm({ ...form, modo_preparo: e.target.value })} /></div>
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
        .rec-root { font-family: 'Geist', sans-serif; }

        .rec-mobile { display: flex; flex-direction: column; }
        .rec-desktop { display: none; }
        @media (min-width: 768px) {
          .rec-mobile { display: none; }
          .rec-desktop { display: flex; gap: 1.5rem; align-items: flex-start; }
        }

        .rec-mob-header { padding: 0.5rem 0 1rem; }
        .rec-mob-header h1 { font-size: var(--font-page-title); font-weight: var(--fw-black); color: var(--text-title); margin: 0 0 0.2rem; }
        .rec-mob-header p { font-size: var(--font-button); color: var(--text-muted); margin: 0; }
        .rec-mob-modules { display: flex; flex-direction: column; gap: 0.6rem; }
        .rec-mob-module { display: flex; align-items: center; gap: 0.9rem; background: var(--bg-card); border: none; border-radius: var(--radius-lg); padding: 1rem; cursor: pointer; text-align: left; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); transition: transform 0.15s; }
        .rec-mob-module:hover { transform: translateY(-1px); }
        .rec-mob-module-emoji { font-size: var(--text-2xl); flex-shrink: 0; }
        .rec-mob-module-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.2rem; }
        .rec-mob-module-desc { font-size: var(--font-helper); color: var(--text-muted); margin: 0; }
        .rec-mob-back { display: flex; align-items: center; gap: 0.5rem; background: none; border: none; font-family: 'Geist', sans-serif; font-size: var(--font-input); font-weight: var(--fw-semibold); color: var(--text-title); cursor: pointer; padding: 0 0 1rem; }
        .rec-mob-content { display: flex; flex-direction: column; }

        .rec-sidebar { width: 220px; flex-shrink: 0; background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); position: sticky; top: 1rem; }
        .rec-sidebar-title { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 1rem; }
        .rec-sidebar-item { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.7rem 0.75rem; background: none; border: none; border-radius: var(--radius-sm); font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-secondary); cursor: pointer; text-align: left; transition: all 0.15s; }
        .rec-sidebar-item:hover { background: var(--bg-body); color: var(--text-title); }
        .rec-sidebar-item.active { background: var(--primary-light); font-weight: var(--fw-semibold); }

        .rec-content { flex: 1; min-width: 0; }
        .rec-page-title { font-size: var(--font-page-title); font-weight: var(--fw-black); color: var(--text-title); margin: 0 0 1.25rem; }
        .rec-page-sub { font-size: var(--font-button); color: var(--text-muted); margin: -0.75rem 0 1.25rem; }

        .rec-home-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
        .rec-home-card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.5rem; text-align: left; cursor: pointer; border: none; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); transition: transform 0.15s, box-shadow 0.15s; font-family: 'Geist', sans-serif; }
        .rec-home-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .rec-home-emoji { font-size: 2rem; display: block; margin-bottom: 0.75rem; }
        .rec-home-card h3 { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.4rem; }
        .rec-home-card p { font-size: var(--font-helper); color: var(--text-muted); margin: 0; line-height: 1.4; }

        .rec-filtros { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .rec-filtro { padding: 0.45rem 0.9rem; border-radius: var(--radius-xl); border: 1.5px solid var(--border); background: var(--bg-card); font-family: 'Geist', sans-serif; font-size: var(--font-helper); font-weight: var(--fw-medium); cursor: pointer; color: var(--text-secondary); transition: all 0.15s; }
        .rec-filtro.active { background: var(--primary); color: var(--text-inverse); border-color: var(--primary); }

        .rec-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        .rec-grid-desktop { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }

        .rec-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; }
        .rec-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .rec-card-img { height: 110px; background: var(--bg-body); display: flex; align-items: center; justify-content: center; font-size: 2rem; overflow: hidden; position: relative; }
        .rec-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .rec-curtidas { position: absolute; bottom: 0.4rem; right: 0.4rem; background: rgba(0,0,0,0.5); color: white; font-size: var(--font-caption); padding: 0.15rem 0.5rem; border-radius: var(--radius-xl); }
        .rec-card-body { padding: 0.6rem; }
        .rec-cat { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--primary); background: var(--primary-light); padding: 0.15rem 0.5rem; border-radius: var(--radius-xl); }
        .rec-verified { font-size: var(--font-caption); font-weight: var(--fw-semibold); color: var(--warning); background: #fff7ed; padding: 0.15rem 0.5rem; border-radius: var(--radius-xl); }
        .rec-nome { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0.3rem 0 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rec-autor { font-size: var(--font-caption); color: var(--text-muted); margin: 0; }

        .rec-pdf-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .rec-pdf-item { display: flex; align-items: center; gap: 0.9rem; background: var(--bg-card); border-radius: var(--radius-md); padding: 0.75rem; text-decoration: none; box-shadow: var(--shadow-card, 0 2px 6px rgba(0,0,0,0.06)); }
        .rec-pdf-capa { width: 52px; height: 52px; border-radius: var(--radius-sm); background: var(--bg-body); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: var(--text-xl); }
        .rec-pdf-capa img { width: 100%; height: 100%; object-fit: cover; }
        .rec-pdf-info { flex: 1; min-width: 0; }

        .rec-pdf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .rec-pdf-card { background: var(--bg-card); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06)); text-decoration: none; display: block; transition: transform 0.15s; }
        .rec-pdf-card:hover { transform: translateY(-2px); }
        .rec-pdf-card-img { height: 130px; background: var(--bg-body); display: flex; align-items: center; justify-content: center; font-size: 3rem; overflow: hidden; }
        .rec-pdf-card-img img { width: 100%; height: 100%; object-fit: cover; }
        .rec-pdf-baixar { display: inline-block; margin-top: 0.5rem; font-size: var(--font-helper); font-weight: var(--fw-semibold); color: #8b5cf6; }

        .rec-btn-new { padding: 0.7rem 1.25rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; margin-bottom: 1rem; box-shadow: 0 4px 15px rgba(255,111,169,0.3); }
        .rec-loading { display: flex; justify-content: center; padding: 3rem; }
        .rec-empty { color: var(--text-muted); text-align: center; padding: 2rem; font-size: var(--font-button); line-height: 1.6; }

        .rec-overlay { position: fixed; inset: 0; z-index: 100; background: var(--bg-overlay); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 768px) { .rec-overlay { align-items: center; padding: 1rem; } }
        .rec-form-modal { background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .rec-form-modal { border-radius: var(--radius-xl); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .rec-form-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.25rem 0.75rem; border-bottom: 1px solid var(--border); }
        .rec-form-header h2 { font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }
        .rec-close { background: var(--bg-body); border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: var(--font-helper); display: flex; align-items: center; justify-content: center; }
        .rec-form-scroll { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
        .rec-form-foto { width: 100%; height: 140px; background: var(--bg-body); border: 2px dashed var(--border); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; cursor: pointer; margin-bottom: 1rem; overflow: hidden; font-size: var(--font-button); color: var(--text-muted); font-family: 'Geist', sans-serif; }
        .rec-form-foto img { width: 100%; height: 100%; object-fit: cover; }
        .rec-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .rec-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .rec-field label { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--text-primary); }
        .rec-field input, .rec-field select, .rec-field textarea { padding: 0.65rem 0.9rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: 'Geist', sans-serif; font-size: var(--font-button); color: var(--text-title); outline: none; resize: none; }
        .rec-field input:focus, .rec-field select:focus, .rec-field textarea:focus { border-color: var(--border-focus); }
        .rec-share-toggle { display: flex; flex-direction: column; gap: 0.2rem; cursor: pointer; background: var(--bg-body); border-radius: var(--radius-md); padding: 0.75rem; }
        .rec-share-toggle input { margin-right: 0.5rem; accent-color: var(--primary); }
        .rec-share-toggle span { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); }
        .rec-share-toggle small { font-size: var(--font-helper); color: var(--text-muted); }
        .rec-form-footer { display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem 1.25rem; border-top: 1px solid var(--border); }
        .rec-btn-cancel { flex: 1; padding: 0.8rem; background: var(--bg-body); color: var(--text-secondary); border: none; border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-weight: var(--fw-semibold); cursor: pointer; }
        .rec-btn-save { flex: 1; padding: 0.8rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-weight: var(--fw-semibold); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .rec-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }

        .rec-detail-modal { background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; position: relative; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .rec-detail-modal { border-radius: var(--radius-xl); } }
        .rec-detail-close { position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.3); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: var(--font-helper); color: white; z-index: 1; display: flex; align-items: center; justify-content: center; }
        .rec-detail-img { width: 100%; height: 200px; object-fit: cover; border-radius: var(--radius-xl) 20px 0 0; }
        .rec-detail-body { padding: 1.25rem; }
        .rec-detail-title { font-size: var(--font-modal-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0.5rem 0 0.25rem; }
        .rec-detail-autor { font-size: var(--font-helper); color: var(--text-muted); margin: 0 0 0.25rem; }
        .rec-detail-curtidas { font-size: var(--font-helper); color: var(--primary); font-weight: var(--fw-semibold); margin: 0 0 1rem; }
        .rec-detail-section { margin-bottom: 1rem; }
        .rec-detail-section h3 { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-primary); margin: 0 0 0.4rem; }
        .rec-detail-section p { font-size: var(--font-button); color: var(--text-secondary); line-height: 1.6; margin: 0; white-space: pre-line; }
        .rec-detail-actions { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
        .rec-act-btn { flex: 1; padding: 0.75rem; border: none; border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; }
        .rec-act-btn.curtir  { background: var(--primary-light); color: var(--primary); }
        .rec-act-btn.salvar  { background: #f0fdf4; color: var(--success); }
        .rec-act-btn.editar  { background: #eff6ff; color: var(--info); }
        .rec-act-btn.deletar { background: #fff1f2; color: var(--error); }

        .rec-spinner { width: 22px; height: 22px; border: 2px solid rgba(255,111,169,0.2); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
