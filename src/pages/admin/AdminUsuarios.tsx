import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmBlock, setConfirmBlock] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: "", email: "", senha: "", telefone: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!createForm.nome.trim() || !createForm.email.trim() || createForm.senha.length < 6) {
      setCreateError("Preencha nome, e-mail e senha (mínimo 6 caracteres).");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: createForm.email,
        password: createForm.senha,
        email_confirm: true,
        user_metadata: { nome: createForm.nome },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          nome: createForm.nome,
          telefone: createForm.telefone,
        }, { onConflict: "id" });
      }
      setShowCreate(false);
      setCreateForm({ nome: "", email: "", senha: "", telefone: "" });
      await load();
    } catch (err: any) {
      setCreateError(err.message || "Erro ao criar usuário.");
    }
    setCreating(false);
  };

  const handleBlock = async (id: string, blocked: boolean) => {
    await supabase.from("profiles").update({ blocked: !blocked }).eq("id", id);
    setConfirmBlock(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("profiles").delete().eq("id", id);
    setConfirmDelete(null);
    load();
  };

  const filtered = users.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"0.25rem",flexWrap:"wrap",gap:"0.75rem"}}>
        <div>
          <h1 className="adm-page-title">👥 Usuários</h1>
          <p className="adm-page-sub" style={{margin:0}}>{users.length} usuários cadastrados</p>
        </div>
        <button className="adm-btn-primary" onClick={() => { setShowCreate(true); setCreateError(""); }}>+ Novo usuário</button>
      </div>

      <div className="adm-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="adm-search" />
      </div>

      {loading ? <div className="adm-loading">Carregando...</div> : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Telefone</th>
                <th>Cadastro</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="adm-user-cell">
                      <div className="adm-user-avatar">
                        {u.foto_url ? <img src={u.foto_url} alt={u.nome} /> : <span>{u.nome?.charAt(0) || "?"}</span>}
                      </div>
                      <div>
                        <p className="adm-user-name">{u.nome || "Sem nome"}</p>
                        <p className="adm-user-email">{u.nome_loja || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="adm-td-gray">{u.telefone || "—"}</td>
                  <td className="adm-td-gray">{u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "—"}</td>
                  <td>
                    <span className={`adm-badge ${u.blocked ? "blocked" : "active"}`}>
                      {u.is_admin ? "Admin" : u.blocked ? "Bloqueado" : "Ativo"}
                    </span>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button className="adm-act-btn warn" onClick={() => setConfirmBlock(u.id)} title={u.blocked ? "Desbloquear" : "Bloquear"}>
                        {u.blocked ? "🔓" : "🔒"}
                      </button>
                      <button className="adm-act-btn danger" onClick={() => setConfirmDelete(u.id)} title="Excluir">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmBlock && (
        <div className="adm-modal-overlay" onClick={() => setConfirmBlock(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <h3>Bloquear/Desbloquear usuário?</h3>
            <p>O usuário não conseguirá mais acessar o app.</p>
            <div className="adm-modal-actions">
              <button className="adm-btn-cancel" onClick={() => setConfirmBlock(null)}>Cancelar</button>
              <button className="adm-btn-warn" onClick={() => handleBlock(confirmBlock, users.find(u => u.id === confirmBlock)?.blocked)}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="adm-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <h3>Excluir usuário?</h3>
            <p>Esta ação não pode ser desfeita.</p>
            <div className="adm-modal-actions">
              <button className="adm-btn-cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="adm-btn-danger" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="adm-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="adm-modal" style={{maxWidth:"420px",textAlign:"left"}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:"1rem"}}>Novo usuário</h3>
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",marginBottom:"1rem"}}>
              <div className="adm-form-field">
                <label>Nome *</label>
                <input type="text" placeholder="Nome completo" value={createForm.nome} onChange={e => setCreateForm({...createForm, nome: e.target.value})} />
              </div>
              <div className="adm-form-field">
                <label>E-mail *</label>
                <input type="email" placeholder="email@exemplo.com" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
              </div>
              <div className="adm-form-field">
                <label>Senha * (mín. 6 caracteres)</label>
                <input type="password" placeholder="••••••••" value={createForm.senha} onChange={e => setCreateForm({...createForm, senha: e.target.value})} />
              </div>
              <div className="adm-form-field">
                <label>Telefone</label>
                <input type="tel" placeholder="(00) 9 0000-0000" value={createForm.telefone} onChange={e => setCreateForm({...createForm, telefone: e.target.value})} />
              </div>
            </div>
            {createError && <p style={{background:"#fff1f2",border:"1px solid #fecdd3",color:"#be123c",borderRadius:"8px",padding:"0.6rem 0.9rem",fontSize:"0.82rem",marginBottom:"0.75rem"}}>{createError}</p>}
            <div className="adm-modal-actions">
              <button className="adm-btn-cancel" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="adm-btn-primary" style={{flex:1}} onClick={handleCreate} disabled={creating}>
                {creating ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .adm-page-sub { font-size: 0.88rem; color: #9ca3af; margin: 0 0 1.25rem; }
        .adm-loading { color: #9ca3af; padding: 2rem; }
        .adm-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: white; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem; max-width: 400px; }
        .adm-search { border: none; outline: none; flex: 1; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; }
        .adm-table-wrap { background: white; border-radius: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: auto; }
        .adm-table { width: 100%; border-collapse: collapse; font-family: 'Inter', sans-serif; }
        .adm-table th { padding: 0.9rem 1rem; font-size: 0.75rem; font-weight: 600; color: #9ca3af; text-align: left; border-bottom: 1px solid #f3f4f6; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; }
        .adm-table td { padding: 0.85rem 1rem; border-bottom: 1px solid #f9fafb; vertical-align: middle; }
        .adm-table tr:last-child td { border-bottom: none; }
        .adm-user-cell { display: flex; align-items: center; gap: 0.75rem; }
        .adm-user-avatar { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg,#fce7f3,#fbcfe8); display: flex; align-items: center; justify-content: center; font-weight: 700; color: #f9007a; font-size: 0.95rem; overflow: hidden; flex-shrink: 0; }
        .adm-user-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .adm-user-name { font-size: 0.88rem; font-weight: 600; color: #1f2937; margin: 0; }
        .adm-user-email { font-size: 0.75rem; color: #9ca3af; margin: 0; }
        .adm-td-gray { font-size: 0.83rem; color: #6b7280; }
        .adm-badge { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: 20px; }
        .adm-badge.active { background: #dcfce7; color: #16a34a; }
        .adm-badge.blocked { background: #fff1f2; color: #ef4444; }
        .adm-actions { display: flex; gap: 0.35rem; }
        .adm-act-btn { width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; }
        .adm-act-btn.warn { background: #fff7ed; }
        .adm-act-btn.danger { background: #fff1f2; }
        .adm-btn-primary { padding:0.7rem 1.25rem; background:linear-gradient(135deg,#f9007a,#d4006a); color:white; border:none; border-radius:10px; font-family:'Inter',sans-serif; font-size:0.88rem; font-weight:600; cursor:pointer; white-space:nowrap; }
        .adm-form-field { display:flex; flex-direction:column; gap:0.3rem; }
        .adm-form-field label { font-size:0.82rem; font-weight:600; color:#374151; font-family:'Inter',sans-serif; }
        .adm-form-field input { padding:0.65rem 0.9rem; border:1.5px solid #e5e7eb; border-radius:8px; font-family:'Inter',sans-serif; font-size:0.88rem; color:#1f2937; outline:none; }
        .adm-form-field input:focus { border-color:#f9007a; }
        .adm-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .adm-modal { background: white; border-radius: 16px; padding: 1.5rem; width: 90%; max-width: 360px; text-align: center; }
        .adm-modal h3 { font-size: 1rem; font-weight: 600; color: #1f2937; margin: 0 0 0.4rem; }
        .adm-modal p { font-size: 0.85rem; color: #9ca3af; margin: 0 0 1.25rem; }
        .adm-modal-actions { display: flex; gap: 0.75rem; }
        .adm-btn-cancel { flex: 1; padding: 0.7rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; }
        .adm-btn-warn { flex: 1; padding: 0.7rem; background: #f59e0b; color: white; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; }
        .adm-btn-danger { flex: 1; padding: 0.7rem; background: #ef4444; color: white; border: none; border-radius: 8px; font-family: 'Inter', sans-serif; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
}
