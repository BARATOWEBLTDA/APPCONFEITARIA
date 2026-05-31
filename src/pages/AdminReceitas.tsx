import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Status = "pendente" | "aprovada" | "rejeitada";

export default function AdminReceitas() {
  const [receitas, setReceitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Status | "todas">("pendente");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("receitas_comunidade").select("*, profiles(nome, foto_url)").order("created_at", { ascending: false });
    setReceitas(data || []);
    setLoading(false);
  };

  const handleStatus = async (id: string, status: Status) => {
    await supabase.from("receitas_comunidade").update({ status }).eq("id", id);
    setSelected(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("receitas_comunidade").delete().eq("id", id);
    setSelected(null);
    load();
  };

  const filtered = receitas.filter(r => {
    const matchFiltro = filtro === "todas" || r.status === filtro;
    const matchSearch = r.nome?.toLowerCase().includes(search.toLowerCase());
    return matchFiltro && matchSearch;
  });

  const counts = {
    pendente: receitas.filter(r => r.status === "pendente").length,
    aprovada: receitas.filter(r => r.status === "aprovada").length,
    rejeitada: receitas.filter(r => r.status === "rejeitada").length,
  };

  return (
    <div>
      <h1 className="adm-page-title">👩‍🍳 Receitas da Comunidade</h1>
      <p className="adm-page-sub">Modere as receitas enviadas pelos usuários</p>

      {/* Filtros */}
      <div className="adm-filter-tabs">
        {([["pendente","⏳","Pendentes"], ["aprovada","✅","Aprovadas"], ["rejeitada","❌","Rejeitadas"], ["todas","📋","Todas"]] as any[]).map(([val, ic, lb]) => (
          <button key={val} className={`adm-filter-tab ${filtro === val ? "active" : ""}`} onClick={() => setFiltro(val)}>
            {ic} {lb} {val !== "todas" && <span className="adm-filter-count">{counts[val as Status]}</span>}
          </button>
        ))}
      </div>

      <div className="adm-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Buscar receita..." value={search} onChange={e => setSearch(e.target.value)} className="adm-search" />
      </div>

      {loading ? <div className="adm-loading">Carregando...</div> : (
        <div className="adm-receitas-grid">
          {filtered.length === 0 ? (
            <p className="adm-empty">Nenhuma receita {filtro !== "todas" ? filtro : ""} encontrada.</p>
          ) : filtered.map(r => (
            <div key={r.id} className="adm-receita-card" onClick={() => setSelected(r)}>
              <div className="adm-receita-img">
                {r.foto_url ? <img src={r.foto_url} alt={r.nome} /> : <span>🍰</span>}
              </div>
              <div className="adm-receita-body">
                <p className="adm-receita-nome">{r.nome}</p>
                <p className="adm-receita-autor">{r.profiles?.nome || "Anônimo"} · {r.categoria}</p>
                <p className="adm-receita-data">{new Date(r.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <span className={`adm-status-badge ${r.status}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalhe */}
      {selected && (
        <div className="adm-modal-overlay" onClick={() => setSelected(null)}>
          <div className="adm-detail-modal" onClick={e => e.stopPropagation()}>
            <button className="adm-modal-close" onClick={() => setSelected(null)}>✕</button>
            {selected.foto_url && <img src={selected.foto_url} alt={selected.nome} className="adm-detail-img" />}
            <h2 className="adm-detail-title">{selected.nome}</h2>
            <p className="adm-detail-meta">Por {selected.profiles?.nome || "Anônimo"} · {selected.categoria}</p>
            <div className="adm-detail-content">
              <p><strong>Ingredientes:</strong></p>
              <p>{selected.ingredientes}</p>
              <p style={{marginTop:"0.75rem"}}><strong>Modo de preparo:</strong></p>
              <p>{selected.modo_preparo}</p>
            </div>
            <div className="adm-detail-actions">
              {selected.status !== "aprovada" && (
                <button className="adm-btn-approve" onClick={() => handleStatus(selected.id, "aprovada")}>✅ Aprovar</button>
              )}
              {selected.status !== "rejeitada" && (
                <button className="adm-btn-reject" onClick={() => handleStatus(selected.id, "rejeitada")}>❌ Rejeitar</button>
              )}
              <button className="adm-btn-delete" onClick={() => handleDelete(selected.id)}>🗑️ Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .adm-page-sub { font-size: 0.88rem; color: #9ca3af; margin: 0 0 1.25rem; }
        .adm-loading { color: #9ca3af; padding: 2rem; }
        .adm-empty { color: #9ca3af; padding: 2rem; text-align: center; }
        .adm-filter-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .adm-filter-tab { padding: 0.5rem 1rem; border-radius: 20px; border: 1.5px solid #e5e7eb; background: white; font-family: 'Inter', sans-serif; font-size: 0.82rem; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s; color: #6b7280; }
        .adm-filter-tab.active { background: #f9007a; color: white; border-color: #f9007a; }
        .adm-filter-count { background: rgba(0,0,0,0.15); border-radius: 20px; padding: 0.05rem 0.4rem; font-size: 0.72rem; }
        .adm-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: white; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; max-width: 400px; }
        .adm-search { border: none; outline: none; flex: 1; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; }
        .adm-receitas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
        .adm-receita-card { background: white; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; position: relative; }
        .adm-receita-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .adm-receita-img { height: 140px; background: #f9fafb; display: flex; align-items: center; justify-content: center; font-size: 3rem; overflow: hidden; }
        .adm-receita-img img { width: 100%; height: 100%; object-fit: cover; }
        .adm-receita-body { padding: 0.9rem; }
        .adm-receita-nome { font-size: 0.9rem; font-weight: 600; color: #1f2937; margin: 0 0 0.2rem; }
        .adm-receita-autor { font-size: 0.78rem; color: #9ca3af; margin: 0 0 0.15rem; }
        .adm-receita-data { font-size: 0.72rem; color: #d1d5db; margin: 0; }
        .adm-status-badge { position: absolute; top: 0.6rem; right: 0.6rem; font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 20px; text-transform: capitalize; }
        .adm-status-badge.pendente { background: #fff7ed; color: #f59e0b; }
        .adm-status-badge.aprovada { background: #dcfce7; color: #16a34a; }
        .adm-status-badge.rejeitada { background: #fff1f2; color: #ef4444; }
        .adm-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .adm-detail-modal { background: white; border-radius: 20px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; position: relative; }
        .adm-modal-close { position: absolute; top: 1rem; right: 1rem; background: #f3f4f6; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; z-index: 1; }
        .adm-detail-img { width: 100%; height: 200px; object-fit: cover; border-radius: 20px 20px 0 0; }
        .adm-detail-title { font-size: 1.15rem; font-weight: 700; color: #1f2937; margin: 1rem 1.25rem 0.25rem; }
        .adm-detail-meta { font-size: 0.82rem; color: #9ca3af; margin: 0 1.25rem 0.75rem; }
        .adm-detail-content { padding: 0 1.25rem; font-size: 0.85rem; color: #374151; line-height: 1.6; }
        .adm-detail-actions { display: flex; gap: 0.5rem; padding: 1rem 1.25rem 1.25rem; flex-wrap: wrap; }
        .adm-btn-approve { flex: 1; padding: 0.7rem; background: #dcfce7; color: #16a34a; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        .adm-btn-reject { flex: 1; padding: 0.7rem; background: #fff7ed; color: #f59e0b; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        .adm-btn-delete { padding: 0.7rem 1rem; background: #fff1f2; color: #ef4444; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
      `}</style>
    </div>
  );
}
