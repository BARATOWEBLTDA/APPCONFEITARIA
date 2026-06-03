import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const Field = ({ icon, placeholder, value, onChange, type = "text" }: any) => (
  <div className="ccc-field">
    <span className="ccc-field-icon">{icon}</span>
    <input className="ccc-field-input" type={type} placeholder={placeholder} value={value} onChange={onChange} />
  </div>
);

const SectionLabel = ({ children }: any) => <p className="ccc-section-label">{children}</p>;

export default function CardapioConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepPreenchido, setCepPreenchido] = useState(false);
  const [form, setForm] = useState({
    nome_loja: "",
    telefone: "",
    foto_url: "",
    hide_stars: false,
    cep: "",
    rua: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    mostrar_localizacao: false,
    mostrar_apenas_cidade: false,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("nome_loja, telefone, foto_url, hide_stars, endereco, mostrar_localizacao, mostrar_apenas_cidade").eq("id", user.id).single();
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({
          nome_loja: data.nome_loja || "",
          telefone: data.telefone || "",
          foto_url: data.foto_url || "",
          hide_stars: data.hide_stars || false,
          cep: addr.cep || "",
          rua: addr.rua || "",
          numero: addr.numero || "",
          bairro: addr.bairro || "",
          cidade: addr.cidade || "",
          estado: addr.estado || "",
          mostrar_localizacao: data.mostrar_localizacao || false,
          mostrar_apenas_cidade: data.mostrar_apenas_cidade || false,
        });
        if (data.foto_url) setPreview(data.foto_url);
        if (addr.cep) setCepPreenchido(true);
      }
      setLoading(false);
    };
    load();
  }, []);

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 3) return `${d.slice(0,2)} ${d.slice(2)}`;
    if (d.length <= 7) return `${d.slice(0,2)} ${d.slice(2,3)} ${d.slice(3)}`;
    return `${d.slice(0,2)} ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);
    }
    setUploading(false);
  };

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({ ...f, rua: data.logradouro || f.rua, bairro: data.bairro || f.bairro, cidade: data.localidade || f.cidade, estado: data.uf || f.estado }));
        setCepPreenchido(true);
      }
    } catch {}
    setBuscandoCep(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    const endereco = JSON.stringify({ cep: form.cep, rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado });
    await supabase.from("profiles").update({
      nome_loja: form.nome_loja,
      telefone: form.telefone,
      foto_url: form.foto_url,
      hide_stars: form.hide_stars,
      endereco,
      mostrar_localizacao: form.mostrar_localizacao,
      mostrar_apenas_cidade: form.mostrar_apenas_cidade,
    }).eq("id", userId);
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"40vh"}}>
      <span className="ccc-spinner-lg" />
      <style>{`@keyframes ccspin{to{transform:rotate(360deg)}} .ccc-spinner-lg{width:32px;height:32px;border:3px solid #fce7f3;border-top-color:#F583BF;border-radius:50%;animation:ccspin 0.7s linear infinite;display:inline-block;}`}</style>
    </div>
  );

  return (
    <div className="ccc-root">

      <div className="ccc-page-header">
        <h1 className="ccc-page-title">Configuração do Cardápio</h1>
        <p className="ccc-page-sub">Personalize as informações do seu cardápio público</p>
      </div>

      {/* Card 1 — Identidade */}
      <div className="ccc-card">
        <SectionLabel>Identidade da loja</SectionLabel>

        {/* Logo */}
        <div className="ccc-logo-row">
          <div className="ccc-logo-preview" onClick={() => !uploading && fileRef.current?.click()}>
            {preview
              ? <img src={preview} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}} />
              : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
            <div className="ccc-logo-cam">
              {uploading
                ? <span className="ccc-spinner-xs" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
            </div>
          </div>
          <div>
            <p className="ccc-logo-label">Logo da loja</p>
            <p className="ccc-logo-sub">Toque para alterar a imagem</p>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFileChange} />

        <Field
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
          placeholder="Nome da loja"
          value={form.nome_loja}
          onChange={(e: any) => setForm({...form, nome_loja: e.target.value})}
        />
        <Field
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          placeholder="WhatsApp"
          value={form.telefone}
          onChange={(e: any) => setForm({...form, telefone: formatPhone(e.target.value)})}
          type="tel"
        />
        <div className="ccc-obs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>O WhatsApp informado será usado para receber pedidos dos seus clientes diretamente no app.</p>
        </div>
      </div>

      {/* Card 2 — Localização */}
      <div className="ccc-card">
        <SectionLabel>Localização da loja</SectionLabel>

        {/* CEP */}
        <div className="ccc-field">
          <span className="ccc-field-icon">
            {buscandoCep
              ? <span className="ccc-spinner-xs" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            }
          </span>
          <input
            className="ccc-field-input"
            placeholder="CEP (opcional)"
            value={form.cep}
            onChange={e => {
              const d = e.target.value.replace(/\D/g, "").slice(0, 8);
              const fmt = d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
              setForm({...form, cep: fmt});
              if (d.length < 8) setCepPreenchido(false);
              if (d.length === 8) buscarCep(d);
            }}
          />
        </div>

        {/* Rua + Número na mesma linha */}
        <div style={{display:"grid", gridTemplateColumns:"minmax(0,1fr) 80px", gap:"0.5rem"}}>
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
            placeholder="Rua / Avenida"
            value={form.rua}
            onChange={(e: any) => setForm({...form, rua: e.target.value})}
          />
          <div className="ccc-field">
            <input className="ccc-field-input" placeholder="Nº" value={form.numero} onChange={(e: any) => setForm({...form, numero: e.target.value})} />
          </div>
        </div>

        {/* Bairro */}
        <Field
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>}
          placeholder="Bairro"
          value={form.bairro}
          onChange={(e: any) => setForm({...form, bairro: e.target.value})}
        />

        {/* Cidade + Estado na mesma linha */}
        <div style={{display:"grid", gridTemplateColumns:"minmax(0,1fr) 90px", gap:"0.5rem"}}>
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>}
            placeholder="Cidade"
            value={form.cidade}
            onChange={(e: any) => setForm({...form, cidade: e.target.value})}
          />
          <div className="ccc-field">
            <input className="ccc-field-input" placeholder="UF" value={form.estado} onChange={(e: any) => setForm({...form, estado: e.target.value.toUpperCase()})} maxLength={2} />
          </div>
        </div>

        {cepPreenchido && (
          <p className="ccc-cep-hint">Preenchido automaticamente. <span onClick={() => setCepPreenchido(false)} style={{color:"#F583BF",cursor:"pointer",fontWeight:600}}>Editar manual</span></p>
        )}

        <div className="ccc-divider" />

        {/* Toggle Mostrar localização completa */}
        <div className="ccc-toggle-row">
          <div>
            <p className="ccc-toggle-label">Mostrar localização completa</p>
            <p className="ccc-toggle-sub">Exibe rua, bairro e cidade no cardápio</p>
          </div>
          <label className="ccc-toggle">
            <input type="checkbox" checked={form.mostrar_localizacao} onChange={e => setForm({...form, mostrar_localizacao: e.target.checked, mostrar_apenas_cidade: e.target.checked ? false : form.mostrar_apenas_cidade})} />
            <span className="ccc-toggle-slider" />
          </label>
        </div>

        {/* Toggle Mostrar apenas cidade */}
        <div className="ccc-toggle-row">
          <div>
            <p className="ccc-toggle-label">Mostrar apenas cidade</p>
            <p className="ccc-toggle-sub">Exibe somente a cidade no cardápio</p>
          </div>
          <label className="ccc-toggle">
            <input type="checkbox" checked={form.mostrar_apenas_cidade} onChange={e => setForm({...form, mostrar_apenas_cidade: e.target.checked, mostrar_localizacao: e.target.checked ? false : form.mostrar_localizacao})} />
            <span className="ccc-toggle-slider" />
          </label>
        </div>
      </div>

      {/* Card 3 — Avaliações */}
      <div className="ccc-card">
        <SectionLabel>Avaliações</SectionLabel>
        <div className="ccc-toggle-row">
          <div>
            <p className="ccc-toggle-label">Exibir estrelas de avaliação</p>
            <p className="ccc-toggle-sub">Mostra a avaliação média da sua loja no cardápio</p>
          </div>
          <label className="ccc-toggle">
            <input type="checkbox" checked={!form.hide_stars} onChange={e => setForm({...form, hide_stars: !e.target.checked})} />
            <span className="ccc-toggle-slider" />
          </label>
        </div>
      </div>

      {success && <div className="ccc-toast">✓ Salvo com sucesso!</div>}

      <button className="ccc-btn-save" onClick={handleSave} disabled={saving || uploading}>
        {saving ? <span className="ccc-spinner-sm" /> : "Salvar alterações"}
      </button>

      <style>{`
        @keyframes ccspin { to { transform:rotate(360deg); } }
        .ccc-root { font-family:'Inter',sans-serif; max-width:520px; display:flex; flex-direction:column; gap:0.85rem; }
        .ccc-page-header { margin-bottom:0.15rem; }
        .ccc-page-title { font-size:1.2rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.2rem; }
        .ccc-page-sub { font-size:0.82rem; color:var(--text-muted,#9ca3af); margin:0; }

        .ccc-card { background:var(--bg-card,white); border-radius:18px; padding:1.15rem; box-shadow:var(--shadow-card,0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.7rem; }
        .ccc-section-label { font-size:0.7rem; font-weight:700; color:#F583BF; text-transform:uppercase; letter-spacing:0.07em; margin:0; }

        .ccc-logo-row { display:flex; align-items:center; gap:0.85rem; }
        .ccc-logo-preview { width:64px; height:64px; border-radius:50%; background:#fdf2f8; border:2px solid #fce7f3; display:flex; align-items:center; justify-content:center; cursor:pointer; position:relative; overflow:hidden; flex-shrink:0; }
        .ccc-logo-cam { position:absolute; bottom:0; right:0; background:rgba(0,0,0,0.45); width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:50% 0 0 0; }
        .ccc-logo-label { font-size:0.88rem; font-weight:600; color:var(--text-primary,#1f2937); margin:0; }
        .ccc-logo-sub { font-size:0.75rem; color:var(--text-muted,#9ca3af); margin:0.2rem 0 0; }

        .ccc-field { display:flex; align-items:center; gap:0.7rem; border:1.5px solid var(--border,#e5e7eb); border-radius:10px; padding:0.65rem 1.1rem; background:var(--bg-input,white); transition:border-color 0.2s; }
        .ccc-field:focus-within { border-color:#F583BF; }
        .ccc-field-icon { display:flex; align-items:center; flex-shrink:0; color:var(--text-muted,#9ca3af); }
        .ccc-field-input { flex:1; border:none; outline:none; font-family:'Inter',sans-serif; font-size:0.9rem; color:var(--text-primary,#1f2937); background:transparent; min-width:0; }
        .ccc-field-input::placeholder { color:#9ca3af; }
        .ccc-field-input:-webkit-autofill,
        .ccc-field-input:-webkit-autofill:hover,
        .ccc-field-input:-webkit-autofill:focus { -webkit-box-shadow:0 0 0px 1000px white inset; box-shadow:0 0 0px 1000px white inset; -webkit-text-fill-color:#1f2937; transition:background-color 5000s ease-in-out 0s; }

        .ccc-row-2 { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0.5rem; }
        .ccc-row-2 .ccc-field-input { font-size:0.85rem; min-width:0; }
        .ccc-divider { border:none; border-top:1px solid var(--border,#f3f4f6); margin:0; }
        .ccc-cep-hint { font-size:0.72rem; color:var(--text-muted,#9ca3af); margin:0; }
        .ccc-obs { display:flex; align-items:flex-start; gap:0.5rem; background:#fdf2f8; border-radius:10px; padding:0.65rem 0.85rem; }
        .ccc-obs p { font-size:0.75rem; color:var(--text-secondary,#6b7280); margin:0; line-height:1.5; }

        .ccc-toggle-row { display:flex; justify-content:space-between; align-items:center; gap:1rem; }
        .ccc-toggle-label { font-size:0.88rem; font-weight:600; color:var(--text-primary,#374151); margin:0; }
        .ccc-toggle-sub { font-size:0.74rem; color:var(--text-muted,#9ca3af); margin:0.1rem 0 0; }
        .ccc-toggle { position:relative; display:inline-block; width:46px; height:26px; flex-shrink:0; }
        .ccc-toggle input { opacity:0; width:0; height:0; }
        .ccc-toggle-slider { position:absolute; cursor:pointer; inset:0; background:#e5e7eb; border-radius:26px; transition:0.3s; }
        .ccc-toggle-slider:before { content:""; position:absolute; height:20px; width:20px; left:3px; bottom:3px; background:white; border-radius:50%; transition:0.3s; box-shadow:0 1px 4px rgba(0,0,0,0.15); }
        .ccc-toggle input:checked + .ccc-toggle-slider { background:#F583BF; }
        .ccc-toggle input:checked + .ccc-toggle-slider:before { transform:translateX(20px); }

        .ccc-toast { background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; border-radius:12px; padding:0.7rem 1rem; font-size:0.85rem; font-weight:500; }
        .ccc-btn-save { width:100%; padding:0.9rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:50px; transition:opacity 0.2s; }
        .ccc-btn-save:hover { opacity:0.9; }
        .ccc-btn-save:disabled { opacity:0.65; cursor:not-allowed; }
        .ccc-spinner-sm { width:20px; height:20px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
        .ccc-spinner-xs { width:14px; height:14px; border:2px solid rgba(255,255,255,0.35); border-top-color:white; border-radius:50%; animation:ccspin 0.7s linear infinite; display:inline-block; }
      `}</style>
    </div>
  );
}
