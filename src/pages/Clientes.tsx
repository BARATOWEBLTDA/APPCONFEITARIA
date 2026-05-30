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
  status: string;
  foto_url?: string;
  created_at: string;
}

const COMO_CONHECEU = ["Instagram", "Indicação", "Google", "Facebook", "TikTok", "Outro"];
const STATUS_OPTIONS = ["ativo", "inativo"];
const emptyForm = { nome: "", telefone: "", whatsapp: "", data_nascimento: "", endereco: "", como_conheceu: "", status: "ativo", foto_url: "" };

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

  // Block body scroll when modal is open
  useEffect(() => {
    const isOpen = showForm || !!confirmDelete;
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showForm, confirmDelete]);
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
    const { data } = await supabase.from("clientes").select("*").eq("user_id", uid).order("nome");
    if (data) setClientes(data);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPreview(URL.createObjectURL(file));
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
    if (editando) await supabase.from("clientes").update(payload).eq("id", editando);
    else await supabase.from("clientes").insert(payload);
    await fetchClientes(userId);
    setShowForm(false); setEditando(null); setForm(emptyForm); setPreview(null); setSaving(false);
  };

  const handleEdit = (c: Cliente) => {
    setForm({ nome: c.nome || "", telefone: c.telefone || "", whatsapp: c.whatsapp || "", data_nascimento: c.data_nascimento || "", endereco: c.endereco || "", como_conheceu: c.como_conheceu || "", status: c.status || "ativo", foto_url: c.foto_url || "" });
    setPreview(c.foto_url || null); setEditando(c.id); setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("clientes").delete().eq("id", id);
    await fetchClientes(userId); setConfirmDelete(null);
  };

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.whatsapp?.includes(search)
  );

  const formatPhone = (phone?: string) => {
    if (!phone) return null;
    const d = phone.replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return phone;
  };

  const getAniversario = (data?: string) => {
    if (!data) return null;
    return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="cli-search" />
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
              {/* Avatar */}
              <div className="cli-avatar">
                {c.foto_url
                  ? <img src={c.foto_url} alt={c.nome} />
                  : <span>{c.nome.charAt(0).toUpperCase()}</span>
                }
              </div>

              {/* Info */}
              <div className="cli-info">
                <p className="cli-nome">{c.nome}</p>
                {c.whatsapp && (
                  <a
                    href={`https://wa.me/55${c.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="cli-whatsapp-link"
                    onClick={e => e.stopPropagation()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    {formatPhone(c.whatsapp)}
                  </a>
                )}

              </div>

              {/* Ações */}
              <div className="cli-actions">
                <button className="cli-act edit" onClick={() => handleEdit(c)}>✏️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmar exclusão */}
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
              <div className="form-avatar-wrap">
                <div className="form-avatar" onClick={() => fileRef.current?.click()}>
                  {preview ? <img src={preview} alt="foto" /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  <div className="form-avatar-overlay">📷</div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />
                <span className="form-avatar-hint">Foto opcional</span>
              </div>
              <div className="form-fields">
                <div className="form-field">
                  <label>Nome *</label>
                  <input type="text" placeholder="Nome completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                </div>
                <div className="form-field">
                  <label>WhatsApp</label>
                  <input type="tel" placeholder="(00) 9 0000-0000" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
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

              </div>
            </div>
            <div className="form-footer">
              {editando && (
                <button className="form-btn delete-btn" onClick={() => { setShowForm(false); setConfirmDelete(editando); }}>🗑️ Excluir</button>
              )}
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

        .cli-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; gap: 0.75rem; }
        .cli-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin-bottom: 0.2rem; }
        .cli-subtitle { font-size: 0.85rem; color: #9ca3af; }
        .cli-btn-new {
          padding: 0.65rem 1.2rem; background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
        }

        .cli-search-wrap {
          display: flex; align-items: center; gap: 0.5rem;
          background: white; border: 1.5px solid #e5e7eb;
          border-radius: 10px; padding: 0.65rem 0.9rem; margin-bottom: 1rem;
        }
        .cli-search { border: none; outline: none; flex: 1; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; }
        .cli-search::placeholder { color: #9ca3af; }

        .cli-loading { display: flex; justify-content: center; padding: 3rem; }
        .cli-empty { text-align: center; padding: 3rem; color: #9ca3af; }
        .cli-empty p { font-size: 1rem; font-weight: 500; margin-bottom: 0.3rem; color: #6b7280; }

        .cli-list { display: flex; flex-direction: column; gap: 0.6rem; }

        /* Card redesenhado - limpo e organizado */
        .cli-card {
          display: flex; align-items: center; gap: 0.9rem;
          background: white; border-radius: 14px;
          padding: 0.75rem 1rem;
          box-shadow: 0 1px 6px rgba(0,0,0,0.07);
          transition: box-shadow 0.15s;
        }
        .cli-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

        .cli-avatar {
          width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg, #fce7f3, #fbcfe8);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; font-weight: 700; color: #f9007a;
          overflow: hidden;
        }
        .cli-avatar img { width: 100%; height: 100%; object-fit: cover; }

        .cli-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .cli-nome { font-size: 0.95rem; font-weight: 600; color: #1f2937; margin: 0 0 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-detalhe { font-size: 0.8rem; color: #6b7280; margin: 0 0 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-whatsapp-link {
          display: inline-flex; align-items: center; gap: 0.3rem;
          font-size: 0.8rem; color: #25D366; font-weight: 500;
          text-decoration: none; margin: 0 0 0.1rem;
        }
        .cli-whatsapp-link:hover { text-decoration: underline; }

        .cli-actions { display: flex; gap: 0.35rem; flex-shrink: 0; }
        .cli-act {
          width: 34px; height: 34px; border-radius: 8px;
          border: none; cursor: pointer; font-size: 0.85rem;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s;
        }
        .cli-act.edit { background: #fff0f6; }
        .cli-act.edit:hover { background: #fce7f3; }
        .cli-act.delete { background: #fff1f2; }
        .cli-act.delete:hover { background: #fecdd3; }

        /* Modal */
        .modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem; overflow: hidden; touch-action: none; }
        .modal-box { background: white; border-radius: 16px; padding: 1.5rem; width: 90%; max-width: 360px; text-align: center; }
        .modal-box h3 { font-size: 1rem; font-weight: 600; color: #1f2937; margin-bottom: 0.4rem; }
        .modal-box p { font-size: 0.85rem; color: #9ca3af; margin-bottom: 1.25rem; }
        .modal-actions { display: flex; gap: 0.75rem; }
        .modal-btn { flex: 1; padding: 0.7rem; border-radius: 8px; border: none; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .modal-btn.cancel { background: #f3f4f6; color: #6b7280; }
        .modal-btn.confirm { background: #ef4444; color: white; }

        /* Form */
        .form-drawer { background: white; border-radius: 20px; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: fadeScale 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .form-handle { width: 40px; height: 4px; background: #e5e7eb; border-radius: 2px; margin: 0.75rem auto 0; }
        .form-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem 0.5rem; }
        .form-header h2 { font-size: 1.1rem; font-weight: 600; color: #1f2937; }
        .form-close { background: #f3f4f6; border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; }
        .form-scroll { flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem; }
        .form-avatar-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.25rem; gap: 0.4rem; }
        .form-avatar { width: 80px; height: 80px; border-radius: 50%; border: 2px dashed #fbcfe8; background: #fff0f6; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
        .form-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .form-avatar-overlay { position: absolute; inset: 0; background: rgba(249,0,122,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; opacity: 0; transition: opacity 0.2s; }
        .form-avatar:hover .form-avatar-overlay { opacity: 1; }
        .form-avatar-hint { font-size: 0.78rem; color: #9ca3af; }
        .form-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .form-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .form-field label { font-size: 0.82rem; font-weight: 500; color: #374151; }
        .form-field input, .form-field select { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; background: white; }
        .form-field input:focus, .form-field select:focus { border-color: #f9007a; }
        .form-footer { display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem 1.25rem; border-top: 1px solid #f3f4f6; }
        .form-btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
        .form-btn.cancel { background: #f3f4f6; color: #6b7280; }
        .form-btn.save { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; }
        .form-btn.save:disabled { opacity: 0.6; cursor: not-allowed; }
        .form-btn.delete-btn { background: #fff1f2; color: #ef4444; flex: 0 0 auto; padding: 0.8rem 1rem; }

        .spinner { width: 24px; height: 24px; border: 2px solid #fce7f3; border-top-color: #f9007a; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .spinner-sm { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .cli-header { flex-direction: column; align-items: stretch; }
          .cli-btn-new { width: 100%; text-align: center; padding: 0.75rem; }
        }
      `}</style>
    </div>
  );
}
