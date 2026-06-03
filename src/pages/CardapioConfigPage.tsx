import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CardapioConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome_loja: "",
    telefone: "",
    descricao_loja: "",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("nome_loja, telefone, descricao_loja").eq("id", user.id).single();
      if (data) {
        setForm({
          nome_loja: data.nome_loja || "",
          telefone: data.telefone || "",
          descricao_loja: data.descricao_loja || "",
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("profiles").update({
      nome_loja: form.nome_loja,
      telefone: form.telefone,
      descricao_loja: form.descricao_loja,
    }).eq("id", userId);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"40vh"}}>
      <span className="cc-spinner" />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .cc-spinner{width:32px;height:32px;border:3px solid #fce7f3;border-top-color:#F583BF;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
    <div className="ccc-root">

      <div className="ccc-header">
        <h1 className="ccc-title">Configuração do Cardápio</h1>
        <p className="ccc-sub">Personalize as informações que aparecem no seu cardápio público</p>
      </div>

      {/* Nome da loja */}
      <div className="ccc-card">
        <div className="ccc-card-header">
          <div className="ccc-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <div>
            <p className="ccc-card-title">Nome da loja</p>
            <p className="ccc-card-sub">Aparece no topo do seu cardápio</p>
          </div>
        </div>
        <div className="ccc-field">
          <input
            type="text"
            className="ccc-input"
            placeholder="Ex: Doces da Ana"
            value={form.nome_loja}
            onChange={e => setForm({...form, nome_loja: e.target.value})}
          />
        </div>
      </div>

      {/* Descrição */}
      <div className="ccc-card">
        <div className="ccc-card-header">
          <div className="ccc-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div>
            <p className="ccc-card-title">Descrição da loja</p>
            <p className="ccc-card-sub">Uma frase curta sobre sua confeitaria</p>
          </div>
        </div>
        <textarea
          className="ccc-textarea"
          placeholder="Ex: Bolos artesanais feitos com amor para momentos especiais ✨"
          value={form.descricao_loja}
          onChange={e => setForm({...form, descricao_loja: e.target.value})}
          rows={3}
          maxLength={200}
        />
        <p className="ccc-char-count">{form.descricao_loja.length}/200</p>
      </div>

      {/* WhatsApp */}
      <div className="ccc-card">
        <div className="ccc-card-header">
          <div className="ccc-card-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          </div>
          <div>
            <p className="ccc-card-title">WhatsApp para pedidos</p>
            <p className="ccc-card-sub">Clientes usam para entrar em contato</p>
          </div>
        </div>
        <div className="ccc-field">
          <input
            type="tel"
            className="ccc-input"
            placeholder="(41) 9 9999-9999"
            value={form.telefone}
            onChange={e => setForm({...form, telefone: formatPhone(e.target.value)})}
          />
        </div>
      </div>

      {success && (
        <div className="ccc-toast">✓ Salvo com sucesso!</div>
      )}

      <button className="ccc-btn-save" onClick={handleSave} disabled={saving}>
        {saving ? <span className="ccc-spinner-sm" /> : "Salvar alterações"}
      </button>

      <style>{`
        .ccc-root { font-family:'Inter',sans-serif; max-width:520px; display:flex; flex-direction:column; gap:1rem; }
        .ccc-header { margin-bottom:0.25rem; }
        .ccc-title { font-size:1.2rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.2rem; }
        .ccc-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }

        .ccc-card { background:var(--bg-card,white); border-radius:18px; padding:1.15rem; box-shadow:var(--shadow-card,0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.75rem; }
        .ccc-card-header { display:flex; align-items:center; gap:0.75rem; }
        .ccc-card-icon { width:36px; height:36px; border-radius:10px; background:#fdf2f8; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#F583BF; }
        .ccc-card-title { font-size:0.9rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0; }
        .ccc-card-sub { font-size:0.75rem; color:var(--text-muted,#9ca3af); margin:0.1rem 0 0; }

        .ccc-field { }
        .ccc-input {
          width:100%; padding:0.7rem 1rem;
          border:1.5px solid var(--border,#e5e7eb);
          border-radius:50px;
          font-family:'Inter',sans-serif; font-size:0.9rem;
          color:var(--text-primary,#1f2937);
          background:var(--bg-input,white);
          outline:none; transition:border-color 0.2s;
          box-sizing:border-box;
        }
        .ccc-input:focus { border-color:#F583BF; }
        .ccc-input::placeholder { color:#9ca3af; }

        .ccc-textarea {
          width:100%; padding:0.75rem 1rem;
          border:1.5px solid var(--border,#e5e7eb);
          border-radius:14px;
          font-family:'Inter',sans-serif; font-size:0.9rem;
          color:var(--text-primary,#1f2937);
          background:var(--bg-input,white);
          outline:none; transition:border-color 0.2s;
          resize:none; box-sizing:border-box; line-height:1.5;
        }
        .ccc-textarea:focus { border-color:#F583BF; }
        .ccc-textarea::placeholder { color:#9ca3af; }
        .ccc-char-count { font-size:0.72rem; color:var(--text-muted,#9ca3af); text-align:right; margin:0; }

        .ccc-toast { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; border-radius:12px; padding:0.7rem 1rem; font-size:0.85rem; font-weight:500; }

        .ccc-btn-save {
          width:100%; padding:0.9rem;
          background:linear-gradient(135deg,#F583BF,#e060a8);
          color:white; border:none; border-radius:50px;
          font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:700;
          cursor:pointer; display:flex; align-items:center; justify-content:center;
          min-height:50px; transition:opacity 0.2s;
        }
        .ccc-btn-save:hover { opacity:0.9; }
        .ccc-btn-save:disabled { opacity:0.65; cursor:not-allowed; }
        .ccc-spinner-sm { width:20px; height:20px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }

        :root.dark .ccc-card-icon { background:rgba(245,131,191,0.1); }
      `}</style>
    </div>
  );
}
