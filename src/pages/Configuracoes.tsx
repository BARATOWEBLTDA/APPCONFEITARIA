import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default function Configuracoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"loja" | "horario" | "entrega" | "categorias">("loja");
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ nome: "", nome_loja: "", foto_url: "", telefone: "", rua: "", numero: "", cidade: "", estado: "", cep: "" });
  const [entrega, setEntrega] = useState({ faz_entrega: false, taxa_entrega: "0", tempo_entrega: "", area_entrega: "" });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [horario, setHorario] = useState({ dias: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as string[], abertura: "08:00", fechamento: "18:00", abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00", abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({ nome: data.nome || "", nome_loja: data.nome_loja || "", foto_url: data.foto_url || "", telefone: data.telefone || "", rua: addr.rua || "", numero: addr.numero || "", cidade: addr.cidade || "", estado: addr.estado || "", cep: addr.cep || "" });
        if (data.foto_url) setPreview(data.foto_url);
        if (data.horario) { try { setHorario(h => ({ ...h, ...JSON.parse(data.horario) })); } catch {} }
        setEntrega({ faz_entrega: data.faz_entrega || false, taxa_entrega: data.taxa_entrega?.toString() || "0", tempo_entrega: data.tempo_entrega || "", area_entrega: data.area_entrega || "" });
        const { data: cats } = await supabase.from("categorias").select("nome").eq("user_id", user.id).order("nome");
        if (cats) setCategorias(cats.map(c => c.nome));
      } else {
        await supabase.from("profiles").insert({ id: user.id });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${userId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);
      await supabase.from("profiles").upsert({ id: userId, nome: form.nome, nome_loja: form.nome_loja, telefone: form.telefone, foto_url: publicUrl }, { onConflict: "id" });
      await refreshProfile();
    }
    setUploading(false);
  };

  const toggleDia = (dia: string) => setHorario(h => ({ ...h, dias: h.dias.includes(dia) ? h.dias.filter(d => d !== dia) : [...h.dias, dia] }));

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  };

  const handleAddCategoria = async () => {
    if (!novaCategoria.trim() || !userId) return;
    setSavingCat(true);
    const { error } = await supabase.from("categorias").insert({ nome: novaCategoria.trim(), user_id: userId });
    if (!error) { setCategorias(prev => [...prev, novaCategoria.trim()].sort()); setNovaCategoria(""); }
    setSavingCat(false);
  };

  const handleDeleteCategoria = async (nome: string) => {
    if (!userId) return;
    await supabase.from("categorias").delete().eq("user_id", userId).eq("nome", nome);
    setCategorias(prev => prev.filter(c => c !== nome));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError("");
    const endereco = JSON.stringify({ rua: form.rua, numero: form.numero, cidade: form.cidade, estado: form.estado, cep: form.cep });
    const { error: err } = await supabase.from("profiles").upsert({ id: userId, nome: form.nome, nome_loja: form.nome_loja, foto_url: form.foto_url, telefone: form.telefone, endereco, horario: JSON.stringify(horario), faz_entrega: entrega.faz_entrega, taxa_entrega: parseFloat(entrega.taxa_entrega) || 0, tempo_entrega: entrega.tempo_entrega, area_entrega: entrega.area_entrega }, { onConflict: "id" });
    if (err) setError("Erro ao salvar. Tente novamente.");
    else { setSuccess(true); await refreshProfile(); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  };

  const tabs = [
    { id: "loja", label: "Loja", icon: "🏪" },
    { id: "horario", label: "Horários", icon: "🕐" },
    { id: "entrega", label: "Entrega", icon: "🛵" },
    { id: "categorias", label: "Categorias", icon: "🏷️" },
  ];

  if (loading) return <div className="cfg-loading">Carregando...</div>;

  const TabContent = () => (
    <>
      {activeTab === "loja" && (
        <div className="cfg-card">
          <div className="cfg-avatar-section">
            <div className="cfg-avatar" onClick={() => !uploading && fileRef.current?.click()}>
              {preview ? <img src={preview} alt="Foto" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              <div className="cfg-avatar-overlay">{uploading ? <span className="spinner-sm" /> : "📷"}</div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
            <span className="cfg-avatar-hint">{uploading ? "Enviando..." : "Clique para alterar"}</span>
          </div>
          <div className="cfg-fields">
            <div className="cfg-field"><label>Seu nome</label><input type="text" placeholder="Ex: Ana Paula" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
            <div className="cfg-field"><label>Nome da confeitaria</label><input type="text" placeholder="Ex: Doces da Ana" value={form.nome_loja} onChange={e => setForm({ ...form, nome_loja: e.target.value })} /></div>
            <div className="cfg-field"><label>WhatsApp</label><input type="tel" placeholder="(41) 9 9999-9999" value={form.telefone} onChange={e => setForm({ ...form, telefone: formatPhone(e.target.value) })} /></div>
            <div className="cfg-section-title" style={{marginTop:"1rem",marginBottom:"0.5rem"}}>📍 Endereço</div>
            <div className="cfg-field"><label>Rua / Avenida</label><input type="text" placeholder="Ex: Rua das Flores" value={form.rua} onChange={e => setForm({ ...form, rua: e.target.value })} /></div>
            <div className="cfg-row">
              <div className="cfg-field"><label>Número</label><input type="text" placeholder="Ex: 123" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} /></div>
              <div className="cfg-field"><label>CEP (opcional)</label><input type="text" placeholder="00000-000" value={form.cep} onChange={e => { const d = e.target.value.replace(/\D/g,'').slice(0,8); setForm({ ...form, cep: d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d }); }} /></div>
            </div>
            <div className="cfg-row">
              <div className="cfg-field"><label>Cidade</label><input type="text" placeholder="Ex: Curitiba" value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} /></div>
              <div className="cfg-field"><label>Estado</label><input type="text" placeholder="Ex: PR" maxLength={2} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value.toUpperCase() })} /></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "horario" && (
        <div className="cfg-card">
          <h3 className="cfg-section-title">Dias de funcionamento</h3>
          <div className="dias-grid">
            {DIAS.slice(0, 5).map(dia => (
              <button key={dia} className={`dia-btn ${horario.dias.includes(dia) ? "active" : ""}`} onClick={() => toggleDia(dia)}>{dia}</button>
            ))}
          </div>
          <div className="cfg-row">
            <div className="cfg-field"><label>Abertura (seg–sex)</label><input type="time" value={horario.abertura} onChange={e => setHorario({ ...horario, abertura: e.target.value })} /></div>
            <div className="cfg-field"><label>Fechamento (seg–sex)</label><input type="time" value={horario.fechamento} onChange={e => setHorario({ ...horario, fechamento: e.target.value })} /></div>
          </div>
          <div className="cfg-divider" />
          <div className="cfg-toggle-row">
            <div><p className="cfg-toggle-label">Abre no Sábado</p></div>
            <label className="toggle"><input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({ ...horario, abre_sabado: e.target.checked })} /><span className="toggle-slider" /></label>
          </div>
          {horario.abre_sabado && (
            <div className="cfg-row">
              <div className="cfg-field"><label>Abertura (sáb)</label><input type="time" value={horario.sabado_abertura} onChange={e => setHorario({ ...horario, sabado_abertura: e.target.value })} /></div>
              <div className="cfg-field"><label>Fechamento (sáb)</label><input type="time" value={horario.sabado_fechamento} onChange={e => setHorario({ ...horario, sabado_fechamento: e.target.value })} /></div>
            </div>
          )}
          <div className="cfg-divider" />
          <div className="cfg-toggle-row">
            <div><p className="cfg-toggle-label">Abre no Domingo</p></div>
            <label className="toggle"><input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({ ...horario, abre_domingo: e.target.checked })} /><span className="toggle-slider" /></label>
          </div>
          {horario.abre_domingo && (
            <div className="cfg-row">
              <div className="cfg-field"><label>Abertura (dom)</label><input type="time" value={horario.domingo_abertura} onChange={e => setHorario({ ...horario, domingo_abertura: e.target.value })} /></div>
              <div className="cfg-field"><label>Fechamento (dom)</label><input type="time" value={horario.domingo_fechamento} onChange={e => setHorario({ ...horario, domingo_fechamento: e.target.value })} /></div>
            </div>
          )}
        </div>
      )}

      {activeTab === "entrega" && (
        <div className="cfg-card">
          <div className="cfg-toggle-row">
            <div><p className="cfg-toggle-label">Faz entrega?</p><p style={{fontSize:"0.78rem",color:"#9ca3af",margin:"0.2rem 0 0"}}>Ative se você entrega pedidos</p></div>
            <label className="toggle"><input type="checkbox" checked={entrega.faz_entrega} onChange={e => setEntrega({...entrega, faz_entrega: e.target.checked})} /><span className="toggle-slider" /></label>
          </div>
          {entrega.faz_entrega && (
            <>
              <div className="cfg-divider" />
              <div className="cfg-fields">
                <div className="cfg-field"><label>Taxa de entrega (R$)</label><input type="number" placeholder="Ex: 5.00" min="0" step="0.50" value={entrega.taxa_entrega} onChange={e => setEntrega({...entrega, taxa_entrega: e.target.value})} /></div>
                <div className="cfg-field"><label>Tempo estimado</label><input type="text" placeholder="Ex: 30 a 60 minutos" value={entrega.tempo_entrega} onChange={e => setEntrega({...entrega, tempo_entrega: e.target.value})} /></div>
                <div className="cfg-field"><label>Área de entrega</label><input type="text" placeholder="Ex: Bairros Centro, Vila Nova..." value={entrega.area_entrega} onChange={e => setEntrega({...entrega, area_entrega: e.target.value})} /></div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "categorias" && (
        <div className="cfg-card">
          <h3 className="cfg-section-title">Categorias de Produtos</h3>
          <p style={{fontSize:"0.82rem",color:"#9ca3af",marginBottom:"1rem"}}>Crie categorias para organizar seus produtos no cardápio.</p>
          <div className="cfg-field" style={{marginBottom:"1rem"}}>
            <label>Nova categoria</label>
            <div style={{display:"flex",gap:"0.5rem"}}>
              <input type="text" placeholder="Ex: Bolos, Cupcakes..." value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategoria()} style={{flex:1,padding:"0.68rem 1rem",border:"1.5px solid #e5e7eb",borderRadius:"10px",fontFamily:"Inter,sans-serif",fontSize:"0.9rem",outline:"none",minWidth:0}} />
              <button onClick={handleAddCategoria} disabled={savingCat || !novaCategoria.trim()} style={{padding:"0.68rem 1rem",background:"linear-gradient(135deg,#f9007a,#d4006a)",color:"white",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                {savingCat ? "..." : "+ Adicionar"}
              </button>
            </div>
          </div>
          {categorias.length === 0 ? (
            <p style={{color:"#9ca3af",fontSize:"0.85rem",textAlign:"center",padding:"1rem"}}>Nenhuma categoria ainda.</p>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
              {categorias.map(cat => (
                <div key={cat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f9fafb",borderRadius:"10px",padding:"0.7rem 1rem",border:"1px solid #e5e7eb"}}>
                  <span style={{fontSize:"0.9rem",fontWeight:500,color:"#374151"}}>🏷️ {cat}</span>
                  <button onClick={() => handleDeleteCategoria(cat)} style={{background:"#fff1f2",border:"none",color:"#ef4444",borderRadius:"8px",padding:"0.3rem 0.6rem",cursor:"pointer",fontSize:"0.8rem"}}>Remover</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="cfg-error">{error}</p>}
      {success && <p className="cfg-success">✓ Salvo com sucesso!</p>}
      {activeTab !== "categorias" && (
        <button className="cfg-btn" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <span className="spinner" /> : "Salvar alterações"}
        </button>
      )}
      <button onClick={handleLogout} className="cfg-btn-logout">Sair da conta</button>
    </>
  );

  return (
    <div className="cfg-root">

      {/* ===== MOBILE ===== */}
      <div className="cfg-mobile">
        <h1 className="cfg-title">Configurações</h1>
        <p className="cfg-subtitle">Personalize sua loja</p>

        {/* Tabs scroll horizontal */}
        <div className="cfg-tabs-mobile">
          {tabs.map(t => (
            <button key={t.id} className={`cfg-tab-mob ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id as any)}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <TabContent />
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="cfg-desktop">
        <div className="cfg-desktop-header">
          <h1 className="cfg-title">Configurações</h1>
          <p className="cfg-subtitle">Personalize sua loja e horários de funcionamento</p>
        </div>

        <div className="cfg-desktop-layout">
          {/* Sidebar tabs */}
          <div className="cfg-sidebar-tabs">
            {tabs.map(t => (
              <button key={t.id} className={`cfg-sidebar-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id as any)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
            <button onClick={handleLogout} className="cfg-btn-logout" style={{marginTop:"auto"}}>Sair da conta</button>
          </div>

          {/* Content */}
          <div className="cfg-desktop-content">
            <TabContent />
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        .cfg-mobile { display: flex; flex-direction: column; width: 100%; max-width: 100%; overflow: hidden; }
        .cfg-desktop { display: none; }

        @media (min-width: 768px) {
          .cfg-mobile { display: none; }
          .cfg-desktop { display: block; }
        }

        .cfg-loading { font-family: 'Inter', sans-serif; color: #9ca3af; padding: 2rem; }
        .cfg-title { font-size: 1.4rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .cfg-subtitle { font-size: 0.85rem; color: #9ca3af; margin: 0 0 1rem; }

        /* Mobile tabs - scroll horizontal */
        .cfg-tabs-mobile {
          display: flex; gap: 0.5rem;
          overflow-x: auto; scrollbar-width: none;
          padding-bottom: 0.75rem; margin-bottom: 0.75rem;
        }
        .cfg-tabs-mobile::-webkit-scrollbar { display: none; }
        .cfg-tab-mob {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.5rem 0.9rem; border-radius: 20px;
          border: 1.5px solid #e5e7eb; background: white;
          font-family: 'Inter', sans-serif; font-size: 0.82rem;
          font-weight: 500; color: #6b7280; cursor: pointer;
          white-space: nowrap; flex-shrink: 0; transition: all 0.15s;
        }
        .cfg-tab-mob.active { background: #fff0f6; border-color: #f9007a; color: #f9007a; font-weight: 600; }

        /* Desktop layout */
        .cfg-desktop-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
        .cfg-sidebar-tabs { width: 180px; flex-shrink: 0; background: white; border-radius: 14px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 0.25rem; position: sticky; top: 1rem; min-height: 300px; }
        .cfg-sidebar-tab { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 0.9rem; border-radius: 8px; border: none; background: none; font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 500; color: #6b7280; cursor: pointer; text-align: left; transition: all 0.15s; }
        .cfg-sidebar-tab:hover { background: #f9fafb; color: #1f2937; }
        .cfg-sidebar-tab.active { background: #fff0f6; color: #f9007a; font-weight: 600; }
        .cfg-desktop-content { flex: 1; min-width: 0; }

        /* Card */
        .cfg-card { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 1rem; width: 100%; max-width: 100%; overflow: hidden; }

        /* Avatar */
        .cfg-avatar-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.5rem; gap: 0.4rem; }
        .cfg-avatar { width: 88px; height: 88px; border-radius: 50%; border: 2px dashed #fbcfe8; background: #fff0f6; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
        .cfg-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-avatar-overlay { position: absolute; inset: 0; background: rgba(249,0,122,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; opacity: 0; transition: opacity 0.2s; }
        .cfg-avatar:hover .cfg-avatar-overlay { opacity: 1; }
        .cfg-avatar-hint { font-size: 0.75rem; color: #9ca3af; }

        /* Fields */
        .cfg-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .cfg-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .cfg-field label { font-size: 0.8rem; font-weight: 600; color: #374151; }
        .cfg-field input { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; width: 100%; max-width: 100%; }
        .cfg-field input:focus { border-color: #f9007a; }
        .cfg-section-title { font-size: 0.88rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }
        .cfg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
        .cfg-divider { border: none; border-top: 1px solid #f3f4f6; margin: 1rem 0; }

        /* Horarios */
        .dias-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
        .dia-btn { padding: 0.35rem 0.7rem; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; font-family: 'Inter', sans-serif; font-size: 0.78rem; font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s; }
        .dia-btn.active { background: #fff0f6; border-color: #f9007a; color: #f9007a; font-weight: 600; }

        /* Toggle */
        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .cfg-toggle-label { font-size: 0.88rem; font-weight: 600; color: #374151; margin: 0; }
        .toggle { position: relative; display: inline-block; width: 44px; height: 24px; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e5e7eb; border-radius: 24px; transition: 0.3s; }
        .toggle-slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .toggle input:checked + .toggle-slider { background: #f9007a; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        /* Buttons */
        .cfg-btn { width: 100%; padding: 0.85rem; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; min-height: 48px; margin-bottom: 0.5rem; }
        .cfg-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .cfg-btn-logout { width: 100%; padding: 0.75rem; background: none; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; color: #6b7280; cursor: pointer; margin-top: 0.25rem; }

        /* Feedback */
        .cfg-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem; }
        .cfg-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.85rem; margin-bottom: 1rem; }

        .spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
