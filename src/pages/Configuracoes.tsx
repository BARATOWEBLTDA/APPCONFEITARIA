import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];


const Field = ({ icon, placeholder, value, onChange, type = "text", maxLength }: any) => (
  <div className="cfg-field-pill">
    <span className="cfg-field-icon">{icon}</span>
    <input className="cfg-field-input" type={type} placeholder={placeholder} value={value} onChange={onChange} maxLength={maxLength} />
  </div>
);

export default function Configuracoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ nome: "", nome_loja: "", foto_url: "", telefone: "", rua: "", numero: "", cidade: "", estado: "", cep: "" });
  const [entrega, setEntrega] = useState({ faz_entrega: false, taxa_entrega: "0", tempo_entrega: "", area_entrega: "" });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [horario, setHorario] = useState({ dias: ["Segunda","Terça","Quarta","Quinta","Sexta"] as string[], abertura: "08:00", fechamento: "18:00", abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00", abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00" });

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
        if (cats) setCategorias(cats.map((c: any) => c.nome));
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
    if (err) setError("Erro ao salvar.");
    else { setSuccess(true); await refreshProfile(); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  };

  if (loading) return <div style={{padding:"2rem",fontFamily:"Inter,sans-serif",color:"#9ca3af"}}>Carregando...</div>;

  return (
    <div className="cfg-root">

      {/* ========== MOBILE ========== */}
      <div className="cfg-mobile">

        {/* Card 1 - Loja */}
        <div className="cfg-section-card">
          <p className="cfg-section-label">Sua loja</p>

          {/* Avatar */}
          <div className="cfg-avatar-wrap" onClick={() => !uploading && fileRef.current?.click()}>
            <div className="cfg-avatar">
              {preview
                ? <img src={preview} alt="foto" />
                : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              }
              <div className="cfg-avatar-overlay">{uploading ? <span className="cfg-spinner-sm"/> : "📷"}</div>
            </div>
            <span className="cfg-avatar-hint">{uploading ? "Enviando..." : "Alterar foto"}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} placeholder="Seu nome" value={form.nome} onChange={(e: any) => setForm({...form, nome: e.target.value})} />
          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} placeholder="Nome da confeitaria" value={form.nome_loja} onChange={(e: any) => setForm({...form, nome_loja: e.target.value})} />
          <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>} placeholder="WhatsApp" value={form.telefone} onChange={(e: any) => setForm({...form, telefone: formatPhone(e.target.value)})} type="tel" />
        </div>

        {/* Card 2 - Endereço + Entrega */}
        <div className="cfg-section-card">
          <p className="cfg-section-label">Endereço & Entrega</p>

          <Field icon="📍" placeholder="Rua / Avenida" value={form.rua} onChange={(e: any) => setForm({...form, rua: e.target.value})} />
          <div className="cfg-row-2">
            <Field icon="🔢" placeholder="Número" value={form.numero} onChange={(e: any) => setForm({...form, numero: e.target.value})} />
            <Field icon="📮" placeholder="CEP" value={form.cep} onChange={(e: any) => { const d = e.target.value.replace(/\D/g,'').slice(0,8); setForm({...form, cep: d.length>5?`${d.slice(0,5)}-${d.slice(5)}`:d}); }} />
          </div>
          <div className="cfg-row-2">
            <Field icon="🏙️" placeholder="Cidade" value={form.cidade} onChange={(e: any) => setForm({...form, cidade: e.target.value})} />
            <Field icon="🗺️" placeholder="UF" value={form.estado} onChange={(e: any) => setForm({...form, estado: e.target.value.toUpperCase()})} maxLength={2} />
          </div>

          <div className="cfg-divider" />

          <div className="cfg-toggle-row">
            <div>
              <p className="cfg-toggle-label">Faz entrega?</p>
              <p className="cfg-toggle-sub">Ative se você entrega pedidos</p>
            </div>
            <label className="toggle"><input type="checkbox" checked={entrega.faz_entrega} onChange={e => setEntrega({...entrega, faz_entrega: e.target.checked})} /><span className="toggle-slider"/></label>
          </div>

          {entrega.faz_entrega && (
            <>
              <Field icon="💰" placeholder="Taxa de entrega (R$)" value={entrega.taxa_entrega} onChange={(e: any) => setEntrega({...entrega, taxa_entrega: e.target.value})} type="number" />
              <Field icon="⏱️" placeholder="Tempo estimado (ex: 30-60 min)" value={entrega.tempo_entrega} onChange={(e: any) => setEntrega({...entrega, tempo_entrega: e.target.value})} />
              <Field icon="📌" placeholder="Área de entrega" value={entrega.area_entrega} onChange={(e: any) => setEntrega({...entrega, area_entrega: e.target.value})} />
            </>
          )}

          <div className="cfg-divider" />
          <p className="cfg-section-label" style={{marginBottom:"0.75rem"}}>Horários de funcionamento</p>

          <div className="dias-grid">
            {DIAS.slice(0,5).map(dia => (
              <button key={dia} className={`dia-btn ${horario.dias.includes(dia)?"active":""}`} onClick={() => toggleDia(dia)}>{dia.slice(0,3)}</button>
            ))}
          </div>
          <div className="cfg-row-2">
            <div className="cfg-field-pill"><span className="cfg-field-icon">🌅</span><input className="cfg-field-input" type="time" value={horario.abertura} onChange={e => setHorario({...horario, abertura: e.target.value})} /></div>
            <div className="cfg-field-pill"><span className="cfg-field-icon">🌆</span><input className="cfg-field-input" type="time" value={horario.fechamento} onChange={e => setHorario({...horario, fechamento: e.target.value})} /></div>
          </div>

          <div className="cfg-toggle-row" style={{marginTop:"0.75rem"}}>
            <p className="cfg-toggle-label">Abre Sábado?</p>
            <label className="toggle"><input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({...horario, abre_sabado: e.target.checked})} /><span className="toggle-slider"/></label>
          </div>
          {horario.abre_sabado && (
            <div className="cfg-row-2">
              <div className="cfg-field-pill"><span className="cfg-field-icon">🌅</span><input className="cfg-field-input" type="time" value={horario.sabado_abertura} onChange={e => setHorario({...horario, sabado_abertura: e.target.value})} /></div>
              <div className="cfg-field-pill"><span className="cfg-field-icon">🌆</span><input className="cfg-field-input" type="time" value={horario.sabado_fechamento} onChange={e => setHorario({...horario, sabado_fechamento: e.target.value})} /></div>
            </div>
          )}

          <div className="cfg-toggle-row" style={{marginTop:"0.75rem"}}>
            <p className="cfg-toggle-label">Abre Domingo?</p>
            <label className="toggle"><input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({...horario, abre_domingo: e.target.checked})} /><span className="toggle-slider"/></label>
          </div>
          {horario.abre_domingo && (
            <div className="cfg-row-2">
              <div className="cfg-field-pill"><span className="cfg-field-icon">🌅</span><input className="cfg-field-input" type="time" value={horario.domingo_abertura} onChange={e => setHorario({...horario, domingo_abertura: e.target.value})} /></div>
              <div className="cfg-field-pill"><span className="cfg-field-icon">🌆</span><input className="cfg-field-input" type="time" value={horario.domingo_fechamento} onChange={e => setHorario({...horario, domingo_fechamento: e.target.value})} /></div>
            </div>
          )}
        </div>

        {/* Card 3 - Categorias */}
        <div className="cfg-section-card">
          <p className="cfg-section-label">Categorias de produtos</p>
          <p className="cfg-section-sub">Organize seus produtos no cardápio</p>

          <div className="cfg-cat-add">
            <div className="cfg-field-pill" style={{flex:1}}>
              <span className="cfg-field-icon">🏷️</span>
              <input className="cfg-field-input" placeholder="Nova categoria..." value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAddCategoria()} />
            </div>
            <button className="cfg-cat-btn" onClick={handleAddCategoria} disabled={savingCat || !novaCategoria.trim()}>
              {savingCat ? "..." : "+"}
            </button>
          </div>

          {categorias.length === 0
            ? <p className="cfg-empty">Nenhuma categoria ainda</p>
            : categorias.map(cat => (
              <div key={cat} className="cfg-cat-item">
                <span>🏷️ {cat}</span>
                <button className="cfg-cat-remove" onClick={() => handleDeleteCategoria(cat)}>✕</button>
              </div>
            ))
          }
        </div>

        {error && <p className="cfg-error">{error}</p>}
        {success && <p className="cfg-success">✓ Salvo com sucesso!</p>}

        <button className="cfg-btn-save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <span className="cfg-spinner"/> : "Salvar alterações"}
        </button>
        <button className="cfg-btn-logout" onClick={handleLogout}>Sair da conta</button>
      </div>

      {/* ========== DESKTOP ========== */}
      <div className="cfg-desktop">
        <h1 className="cfg-title">Configurações</h1>
        <p className="cfg-subtitle">Personalize sua loja e horários de funcionamento</p>

        <div className="cfg-desktop-grid">
          {/* Coluna 1 */}
          <div>
            <div className="cfg-desk-card">
              <h3 className="cfg-desk-title">🏪 Sua loja</h3>
              <div className="cfg-avatar-wrap" onClick={() => !uploading && fileRef.current?.click()}>
                <div className="cfg-avatar">
                  {preview ? <img src={preview} alt="foto" /> : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  <div className="cfg-avatar-overlay">{uploading ? <span className="cfg-spinner-sm"/> : "📷"}</div>
                </div>
                <span className="cfg-avatar-hint">{uploading ? "Enviando..." : "Alterar foto"}</span>
              </div>
              <div className="cfg-desk-fields">
                <div className="cfg-desk-field"><label>Seu nome</label><input type="text" placeholder="Ex: Ana Paula" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
                <div className="cfg-desk-field"><label>Nome da confeitaria</label><input type="text" placeholder="Ex: Doces da Ana" value={form.nome_loja} onChange={e => setForm({...form, nome_loja: e.target.value})} /></div>
                <div className="cfg-desk-field"><label>WhatsApp</label><input type="tel" placeholder="(41) 9 9999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: formatPhone(e.target.value)})} /></div>
              </div>
            </div>

            <div className="cfg-desk-card">
              <h3 className="cfg-desk-title">📍 Endereço</h3>
              <div className="cfg-desk-fields">
                <div className="cfg-desk-field"><label>Rua / Avenida</label><input type="text" placeholder="Ex: Rua das Flores" value={form.rua} onChange={e => setForm({...form, rua: e.target.value})} /></div>
                <div className="cfg-desk-row">
                  <div className="cfg-desk-field"><label>Número</label><input type="text" placeholder="123" value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>CEP</label><input type="text" placeholder="00000-000" value={form.cep} onChange={e => { const d = e.target.value.replace(/\D/g,'').slice(0,8); setForm({...form, cep: d.length>5?`${d.slice(0,5)}-${d.slice(5)}`:d}); }} /></div>
                </div>
                <div className="cfg-desk-row">
                  <div className="cfg-desk-field"><label>Cidade</label><input type="text" placeholder="Curitiba" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>UF</label><input type="text" placeholder="PR" maxLength={2} value={form.estado} onChange={e => setForm({...form, estado: e.target.value.toUpperCase()})} /></div>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2 */}
          <div>
            <div className="cfg-desk-card">
              <h3 className="cfg-desk-title">🕐 Horários</h3>
              <div className="dias-grid">
                {DIAS.slice(0,5).map(dia => (
                  <button key={dia} className={`dia-btn ${horario.dias.includes(dia)?"active":""}`} onClick={() => toggleDia(dia)}>{dia.slice(0,3)}</button>
                ))}
              </div>
              <div className="cfg-desk-row">
                <div className="cfg-desk-field"><label>Abertura (seg–sex)</label><input type="time" value={horario.abertura} onChange={e => setHorario({...horario, abertura: e.target.value})} /></div>
                <div className="cfg-desk-field"><label>Fechamento (seg–sex)</label><input type="time" value={horario.fechamento} onChange={e => setHorario({...horario, fechamento: e.target.value})} /></div>
              </div>
              <div className="cfg-divider"/>
              <div className="cfg-toggle-row">
                <p className="cfg-toggle-label">Abre Sábado?</p>
                <label className="toggle"><input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({...horario, abre_sabado: e.target.checked})} /><span className="toggle-slider"/></label>
              </div>
              {horario.abre_sabado && (
                <div className="cfg-desk-row">
                  <div className="cfg-desk-field"><label>Abertura (sáb)</label><input type="time" value={horario.sabado_abertura} onChange={e => setHorario({...horario, sabado_abertura: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Fechamento (sáb)</label><input type="time" value={horario.sabado_fechamento} onChange={e => setHorario({...horario, sabado_fechamento: e.target.value})} /></div>
                </div>
              )}
              <div className="cfg-toggle-row">
                <p className="cfg-toggle-label">Abre Domingo?</p>
                <label className="toggle"><input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({...horario, abre_domingo: e.target.checked})} /><span className="toggle-slider"/></label>
              </div>
              {horario.abre_domingo && (
                <div className="cfg-desk-row">
                  <div className="cfg-desk-field"><label>Abertura (dom)</label><input type="time" value={horario.domingo_abertura} onChange={e => setHorario({...horario, domingo_abertura: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Fechamento (dom)</label><input type="time" value={horario.domingo_fechamento} onChange={e => setHorario({...horario, domingo_fechamento: e.target.value})} /></div>
                </div>
              )}
            </div>

            <div className="cfg-desk-card">
              <h3 className="cfg-desk-title">🛵 Entrega</h3>
              <div className="cfg-toggle-row">
                <div><p className="cfg-toggle-label">Faz entrega?</p><p className="cfg-toggle-sub">Ative se você entrega pedidos</p></div>
                <label className="toggle"><input type="checkbox" checked={entrega.faz_entrega} onChange={e => setEntrega({...entrega, faz_entrega: e.target.checked})} /><span className="toggle-slider"/></label>
              </div>
              {entrega.faz_entrega && (
                <div className="cfg-desk-fields" style={{marginTop:"0.75rem"}}>
                  <div className="cfg-desk-field"><label>Taxa (R$)</label><input type="number" placeholder="5.00" value={entrega.taxa_entrega} onChange={e => setEntrega({...entrega, taxa_entrega: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Tempo estimado</label><input type="text" placeholder="30 a 60 minutos" value={entrega.tempo_entrega} onChange={e => setEntrega({...entrega, tempo_entrega: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Área de entrega</label><input type="text" placeholder="Bairros..." value={entrega.area_entrega} onChange={e => setEntrega({...entrega, area_entrega: e.target.value})} /></div>
                </div>
              )}
            </div>

            <div className="cfg-desk-card">
              <h3 className="cfg-desk-title">🏷️ Categorias</h3>
              <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem"}}>
                <input style={{flex:1,padding:"0.65rem 0.9rem",border:"1.5px solid #e5e7eb",borderRadius:"10px",fontFamily:"Inter,sans-serif",fontSize:"0.88rem",outline:"none"}} placeholder="Nova categoria..." value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAddCategoria()} />
                <button onClick={handleAddCategoria} disabled={savingCat||!novaCategoria.trim()} style={{padding:"0.65rem 1rem",background:"linear-gradient(135deg,#f9007a,#d4006a)",color:"white",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer"}}>
                  {savingCat?"...":"+ Adicionar"}
                </button>
              </div>
              {categorias.length===0
                ? <p className="cfg-empty">Nenhuma categoria ainda</p>
                : categorias.map(cat => (
                  <div key={cat} className="cfg-cat-item">
                    <span>🏷️ {cat}</span>
                    <button className="cfg-cat-remove" onClick={() => handleDeleteCategoria(cat)}>✕</button>
                  </div>
                ))
              }
            </div>

            {error && <p className="cfg-error">{error}</p>}
            {success && <p className="cfg-success">✓ Salvo com sucesso!</p>}
            <button className="cfg-btn-save" onClick={handleSave} disabled={saving||uploading}>
              {saving ? <span className="cfg-spinner"/> : "Salvar alterações"}
            </button>
            <button className="cfg-btn-logout" onClick={handleLogout}>Sair da conta</button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }

        .cfg-mobile { display: flex; flex-direction: column; gap: 1rem; }
        .cfg-desktop { display: none; }
        @media (min-width: 900px) { .cfg-mobile { display: none; } .cfg-desktop { display: block; } }

        /* ===== MOBILE ===== */
        .cfg-section-card {
          background: white;
          border-radius: 20px;
          padding: 1.25rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.07);
          display: flex; flex-direction: column; gap: 0.65rem;
          width: 100%; overflow: hidden;
        }
        .cfg-section-label { font-size: 0.72rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }
        .cfg-section-sub { font-size: 0.78rem; color: #9ca3af; margin: -0.35rem 0 0; }

        /* Pill fields */
        .cfg-field-pill {
          display: flex; align-items: center; gap: 0.7rem;
          border: 1.5px solid #e5e7eb; border-radius: 50px;
          padding: 0.7rem 1.1rem; background: white;
          transition: border-color 0.2s;
          min-width: 0; width: 100%;
        }
        .cfg-field-pill:focus-within { border-color: #f9007a; }
        .cfg-field-icon { display: flex; align-items: center; flex-shrink: 0; color: #9ca3af; }
        .cfg-field-input { flex: 1; border: none; outline: none; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; background: transparent; min-width: 0; width: 100%; }
        .cfg-field-input::placeholder { color: #9ca3af; }

        .cfg-row-2 { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 0.5rem; }
        .cfg-row-2 > * { min-width: 0; }

        /* Avatar */
        .cfg-avatar-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; margin: 0.25rem 0 0.5rem; }
        .cfg-avatar { width: 100px; height: 100px; border-radius: 50%; border: 2px dashed #fbcfe8; background: #fff0f6; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; }
        .cfg-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-avatar-overlay { position: absolute; inset: 0; background: rgba(249,0,122,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; opacity: 0; transition: opacity 0.2s; }
        .cfg-avatar:hover .cfg-avatar-overlay { opacity: 1; }
        .cfg-avatar-hint { font-size: 0.72rem; color: #9ca3af; }

        /* Toggle */
        .cfg-divider { border: none; border-top: 1px solid #f3f4f6; }
        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; }
        .cfg-toggle-label { font-size: 0.88rem; font-weight: 600; color: #374151; margin: 0; }
        .cfg-toggle-sub { font-size: 0.75rem; color: #9ca3af; margin: 0.1rem 0 0; }
        .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e5e7eb; border-radius: 24px; transition: 0.3s; }
        .toggle-slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
        .toggle input:checked + .toggle-slider { background: #f9007a; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        /* Dias */
        .dias-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .dia-btn { padding: 0.35rem 0.65rem; border-radius: 20px; border: 1.5px solid #e5e7eb; background: white; font-family: 'Inter', sans-serif; font-size: 0.78rem; font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s; }
        .dia-btn.active { background: #fff0f6; border-color: #f9007a; color: #f9007a; font-weight: 600; }

        /* Categorias */
        .cfg-cat-add { display: flex; gap: 0.5rem; align-items: center; }
        .cfg-cat-btn { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#f9007a,#d4006a); color: white; border: none; font-size: 1.2rem; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .cfg-cat-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cfg-cat-item { display: flex; justify-content: space-between; align-items: center; background: #f9fafb; border-radius: 10px; padding: 0.65rem 0.9rem; font-size: 0.88rem; font-weight: 500; color: #374151; }
        .cfg-cat-remove { background: #fff1f2; border: none; color: #ef4444; border-radius: 6px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.75rem; }
        .cfg-empty { color: #9ca3af; font-size: 0.82rem; text-align: center; padding: 0.5rem; }

        /* Buttons */
        .cfg-btn-save { width: 100%; padding: 0.85rem; background: linear-gradient(135deg,#f9007a,#d4006a); color: white; border: none; border-radius: 50px; font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 50px; letter-spacing: 0.3px; margin-top: 0.5rem; }
        .cfg-btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
        .cfg-btn-logout { width: 100%; padding: 0.8rem; background: none; border: 1.5px solid #e5e7eb; border-radius: 50px; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; color: #6b7280; cursor: pointer; margin-top: 0.5rem; }

        /* Feedback */
        .cfg-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; border-radius: 10px; padding: 0.6rem 0.9rem; font-size: 0.85rem; }
        .cfg-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a; border-radius: 10px; padding: 0.6rem 0.9rem; font-size: 0.85rem; }
        .cfg-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        .cfg-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ===== DESKTOP ===== */
        .cfg-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .cfg-subtitle { font-size: 0.88rem; color: #9ca3af; margin: 0 0 1.5rem; }
        .cfg-desktop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start; }
        .cfg-desk-card { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); margin-bottom: 1.25rem; }
        .cfg-desk-title { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin: 0 0 1rem; }
        .cfg-desk-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .cfg-desk-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .cfg-desk-field label { font-size: 0.8rem; font-weight: 600; color: #374151; }
        .cfg-desk-field input { padding: 0.65rem 0.9rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.9rem; color: #1f2937; outline: none; transition: border-color 0.2s; width: 100%; }
        .cfg-desk-field input:focus { border-color: #f9007a; }
        .cfg-desk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
      `}</style>
    </div>
  );
}
