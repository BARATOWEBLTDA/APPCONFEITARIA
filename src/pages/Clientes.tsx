import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

interface Cliente {
  id: string;
  nome: string;
  telefone?: string;
  whatsapp?: string;
  data_nascimento?: string;
  endereco?: string;
  como_conheceu?: string;
  preferencias?: string;
  observacoes?: string;
  status: string;
  foto_url?: string;
  created_at: string;
}

const COMO_CONHECEU = ["Instagram", "Indicação", "Google", "Facebook", "TikTok", "Outro"];
const STATUS_OPTIONS = ["ativo", "inativo"];

const emptyForm = {
  nome: "",
  telefone: "",
  whatsapp: "",
  data_nascimento: "",
  endereco: "",
  como_conheceu: "",
  preferencias: "",
  observacoes: "",
  status: "ativo",
  foto_url: "",
};

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await fetchClientes(user.id);
    };
    init();
  }, []);

  const fetchClientes = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("user_id", uid)
      .order("nome");
    if (data) setClientes(data);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `clientes/${userId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      setForm(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !userId) return;
    setSaving(true);
    const payload = { ...form, user_id: userId };

    if (editando) {
      await supabase.from("clientes").update(payload).eq("id", editando);
    } else {
      await supabase.from("clientes").insert(payload);
    }

    await fetchClientes(userId);
    setShowForm(false);
    setEditando(null);
    setForm(emptyForm);
    setPreview(null);
    setSaving(false);
  };

  const handleEdit = (c: Cliente) => {
    setForm({
      nome: c.nome || "",
      telefone: c.telefone || "",
      whatsapp: c.whatsapp || "",
      data_nascimento: c.data_nascimento || "",
      endereco: c.endereco || "",
      como_conheceu: c.como_conheceu || "",
      preferencias: c.preferencias || "",
      observacoes: c.observacoes || "",
      status: c.status || "ativo",
      foto_url: c.foto_url || "",
    });
    setPreview(c.foto_url || null);
    setEditando(c.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("clientes").delete().eq("id", id);
    await fetchClientes(userId);
    setConfirmDelete(null);
  };

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search) ||
    c.whatsapp?.includes(search)
  );

  const getAniversario = (data?: string) => {
    if (!data) return null;
    const d = new Date(data);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  };

  return (
    <div className="cli-root">
      {/* Header */}
      <div className="cli-header">
        <div>
          <h1 className="cli-title">👥 Clientes</h1>
          <p className="cli-subtitle">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} cadastrado{clientes.length !== 1 ? "s" : ""}</p>
        </div>
        <button className="cli-btn-new" onClick={() => { setForm(emptyForm); setPreview(null); setEditando(null); setShowForm(true); }}>
          + Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="cli-search-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="cli-search"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="cli-loading"><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="cli-empty">
          <p>Nenhum cliente encontrado</p>
          <span>Clique em "+ Novo cliente" para cadastrar</span>
        </div>
      ) : (
        <div className="cli-list">
          {filtered.map(c => (
            <div key={c.id} className="cli-card">
              <div className="cli-card-avatar">
                {c.foto_url ? (
                  <img src={c.foto_url} alt={c.nome} />
                ) : (
                  <span>{c.nome.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="cli-card-info">
                <div className="cli-card-row"><span className="cli-card-label">Nome:</span> <span className="cli-card-value">{c.nome}</span></div>
                {(c.whatsapp || c.telefone) && (
                  <div className="cli-card-row"><span className="cli-card-label">Contato:</span> <span className="cli-card-value">{c.whatsapp || c.telefone}</span></div>
                )}
                {c.data_nascimento && (
                  <div className="cli-card-row"><span className="cli-card-label">Aniversário:</span> <span className="cli-card-value">{getAniversario(c.data_nascimento)}</span></div>
                )}
                {c.como_conheceu && (
                  <div className="cli-card-row"><span className="cli-card-label">Como nos conheceu:</span> <span className="cli-card-value">{c.como_conheceu}</span></div>
                )}
              </div>
              <div className="cli-card-actions">
                <button className="cli-action-btn edit" onClick={() => handleEdit(c)}>✏️</button>
                <button className="cli-action-btn delete" onClick={() => setConfirmDelete(c.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Excluir cliente?</h3>
            <p>Esta ação não pode ser desfeita.</p>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={() => handleDelete(confirmDelete)}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="form-drawer" onClick={e => e.stopPropagation()}>
            <div className="form-handle" />
            <div className="form-header">
              <h2>{editando ? "Editar cliente" : "Novo cliente"}</h2>
              <button className="form-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="form-scroll">
              {/* Foto */}
              <div className="form-avatar-wrap">
                <div className="form-avatar" onClick={() => fileRef.current?.click()}>
                  {preview ? (
                    <img src={preview} alt="foto" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  )}
                  <div className="form-avatar-overlay">📷</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />
                <span className="form-avatar-hint">Foto opcional</span>
              </div>

              {/* Campos */}
              <div className="form-fields">
                <div className="form-field required">
                  <label>Nome *</label>
                  <input type="text" placeholder="Nome completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label>WhatsApp</label>
                    <input type="tel" placeholder="(00) 00000-0000" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
                  </div>
                  <div className="form-field">
                    <label>Telefone</label>
                    <input type="tel" placeholder="(00) 0000-0000" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} />
                  </div>
                </div>
                <div className="form-field">
                  <label>Data de aniversário</label>
                  <input type="date" value={form.data_nascimento} onChange={e => setForm({...form, data_nascimento: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>Endereço</label>
                  <input type="text" placeholder="Rua, número, bairro, cidade" value={form.endereco} onChange={e => setForm({...form, endereco: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>Como conheceu</label>
                  <select value={form.como_conheceu} onChange={e => setForm({...form, como_conheceu: e.target.value})}>
                    <option value="">Selecione...</option>
                    {COMO_CONHECEU.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label>Preferências / Alergias</label>
                  <input type="text" placeholder="Ex: sem glúten, alergia a amendoim..." value={form.preferencias} onChange={e => setForm({...form, preferencias: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>Observações</label>
                  <textarea placeholder="Anotações sobre o cliente..." value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} rows={3} />
                </div>
                <div className="form-field">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                    {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-footer">
              <button className="form-btn cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="form-btn save" onClick={handleSave} disabled={saving || !form.nome.trim()}>
                {saving ? <span className="spinner-sm" /> : editando ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        .cli-root { font-family: 'Inter', sans-serif; max-width: 800px; }

        .cli-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
        .cli-title { font-size: 1.5rem; font-weight: 600; color: #1f2937; margin-bottom: 0.2rem; }
        .cli-subtitle { font-size: 0.85rem; color: #9ca3af; }

        .cli-btn-new {
          padding: 0.65rem 1.2rem;
          background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
          cursor: pointer; white-space: nowrap;
          transition: opacity 0.2s;
        }
        .cli-btn-new:hover { opacity: 0.9; }

        .cli-search-wrap {
          display: flex; align-items: center; gap: 0.5rem;
          background: white; border: 1.5px solid #e5e7eb;
          border-radius: 10px; padding: 0.6rem 0.9rem;
          margin-bottom: 1rem;
        }
        .cli-search { border: none; outline: none; flex: 1; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; }
        .cli-search::placeholder { color: #9ca3af; }

        .cli-loading { display: flex; justify-content: center; padding: 3rem; }
        .cli-empty { text-align: center; padding: 3rem; color: #9ca3af; }
        .cli-empty p { font-size: 1rem; font-weight: 500; margin-bottom: 0.3rem; color: #6b7280; }
        .cli-empty span { font-size: 0.85rem; }

        .cli-list { display: flex; flex-direction: column; gap: 0.6rem; }

        .cli-card {
          display: flex; align-items: center; gap: 1.25rem;
          background: white; border-radius: 12px;
          padding: 0.9rem 1rem;
          box-shadow: 0 1px 6px rgba(0,0,0,0.06);
          transition: box-shadow 0.15s;
        }
        .cli-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

        .cli-card-avatar {
          width: 64px; height: 64px; border-radius: 16px;
          background: linear-gradient(135deg, #e5e7eb, #d1d5db);
          display: flex; align-items: center; justify-content: center;
          color: #6b7280; font-weight: 700; font-size: 1.4rem;
          overflow: visible; flex-shrink: 0;
          box-shadow: none;
          position: relative;
          z-index: 1;
        }
        .cli-card-avatar img {
          width: 64px; height: 64px;
          object-fit: cover;
          border-radius: 16px;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
          display: block;
        }
        .cli-card-avatar:hover img {
          transform: scale(1.25);
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
          z-index: 10;
          position: relative;
        }

        .cli-card-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.35rem; }

        .cli-card-row { display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap; }
        .cli-card-label { font-size: 0.78rem; font-weight: 800; color: #374151; white-space: nowrap; letter-spacing: -0.1px; }
        .cli-card-value { font-size: 0.88rem; font-weight: 400; color: #6b7280; }

        .cli-card-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
        .cli-action-btn {
          width: 32px; height: 32px; border-radius: 8px;
          border: none; cursor: pointer; font-size: 0.85rem;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .cli-action-btn.edit { background: #fff0f6; }
        .cli-action-btn.edit:hover { background: #fce7f3; }
        .cli-action-btn.delete { background: #fff1f2; }
        .cli-action-btn.delete:hover { background: #fecdd3; }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
        }

        .modal-box {
          background: white; border-radius: 16px;
          padding: 1.5rem; width: 90%; max-width: 360px;
          text-align: center;
        }
        .modal-box h3 { font-size: 1rem; font-weight: 600; color: #1f2937; margin-bottom: 0.4rem; }
        .modal-box p { font-size: 0.85rem; color: #9ca3af; margin-bottom: 1.25rem; }
        .modal-actions { display: flex; gap: 0.75rem; }
        .modal-btn { flex: 1; padding: 0.7rem; border-radius: 8px; border: none; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .modal-btn.cancel { background: #f3f4f6; color: #6b7280; }
        .modal-btn.confirm { background: #ef4444; color: white; }

        /* Form Drawer */
        .form-drawer {
          background: white;
          border-radius: 20px;
          width: 100%; max-width: 560px;
          max-height: 90vh;
          display: flex; flex-direction: column;
          animation: fadeScale 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }

        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }



        .form-handle {
          width: 40px; height: 4px; background: #e5e7eb;
          border-radius: 2px; margin: 0.75rem auto 0;
        }

        .form-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem 0.5rem;
        }
        .form-header h2 { font-size: 1.1rem; font-weight: 600; color: #1f2937; }
        .form-close {
          background: #f3f4f6; border: none; width: 28px; height: 28px;
          border-radius: 50%; cursor: pointer; font-size: 0.8rem;
          display: flex; align-items: center; justify-content: center;
        }

        .form-scroll { flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; }

        .form-avatar-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.25rem; gap: 0.4rem; }
        .form-avatar {
          width: 80px; height: 80px; border-radius: 50%;
          border: 2px dashed #fbcfe8; background: #fff0f6;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .form-avatar:hover { border-color: #f9007a; }
        .form-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .form-avatar-overlay {
          position: absolute; inset: 0; background: rgba(249,0,122,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; opacity: 0; transition: opacity 0.2s;
        }
        .form-avatar:hover .form-avatar-overlay { opacity: 1; }
        .form-avatar-hint { font-size: 0.78rem; color: #9ca3af; }

        .form-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        .form-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .form-field label { font-size: 0.82rem; font-weight: 500; color: #374151; }

        .form-field input, .form-field select, .form-field textarea {
          padding: 0.65rem 0.9rem;
          border: 1.5px solid #e5e7eb; border-radius: 8px;
          font-family: 'Inter', sans-serif; font-size: 0.9rem;
          color: #1f2937; outline: none;
          transition: border-color 0.2s;
          background: white;
        }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus {
          border-color: #f9007a;
        }
        .form-field textarea { resize: none; }

        .form-footer {
          display: flex; gap: 0.75rem;
          padding: 0.75rem 1.25rem 1.25rem;
          border-top: 1px solid #f3f4f6;
        }

        .form-btn {
          flex: 1; padding: 0.8rem; border-radius: 10px;
          border: none; font-family: 'Inter', sans-serif;
          font-size: 0.95rem; font-weight: 600; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s;
        }
        .form-btn.cancel { background: #f3f4f6; color: #6b7280; }
        .form-btn.save { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; }
        .form-btn.save:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-btn:hover:not(:disabled) { opacity: 0.9; }

        .spinner { width: 24px; height: 24px; border: 2px solid #fce7f3; border-top-color: #f9007a; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .spinner-sm { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .form-row { grid-template-columns: 1fr; }
          .cli-header { flex-direction: column; gap: 0.75rem; }
          .cli-btn-new { width: 100%; }
        }
      `}</style>
    </div>
  );
}
