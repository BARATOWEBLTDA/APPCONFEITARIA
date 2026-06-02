import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const Field = ({ icon, placeholder, value, onChange, type = "text", maxLength, disabled }: any) => (
  <div className={`cfg-field${disabled ? " cfg-field-disabled" : ""}`}>
    <span className="cfg-field-icon">{icon}</span>
    <input
      className="cfg-field-input"
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
      disabled={disabled}
    />
  </div>
);

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="cfg-section-label">{children}</p>
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
  const [userEmail, setUserEmail] = useState("");
  const [nomeSalvo, setNomeSalvo] = useState("");
  const [nomeLojaSalvo, setNomeLojaSalvo] = useState("");
  const [plano, setPlano] = useState<"pro" | "trial" | "expirado">("trial");
  const [diasRestantes, setDiasRestantes] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const getSaudacao = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const [form, setForm] = useState({
    nome: "", nome_loja: "", foto_url: "", telefone: "",
    rua: "", numero: "", bairro: "", cidade: "", estado: "", cep: ""
  });
  const [entrega, setEntrega] = useState({
    faz_entrega: false, taxa_entrega: "0", tempo_entrega: "", area_entrega: ""
  });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepPreenchido, setCepPreenchido] = useState(false);

  const buscarCep = async (cep: string) => {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
          bairro: data.bairro || (f as any).bairro || ""
        }));
        setCepPreenchido(true);
      }
    } catch {}
    setBuscandoCep(false);
  };
  const [horario, setHorario] = useState({
    dias: ["Segunda","Terça","Quarta","Quinta","Sexta"] as string[],
    abertura: "08:00", fechamento: "18:00",
    abre_sabado: false, sabado_abertura: "09:00", sabado_fechamento: "14:00",
    abre_domingo: false, domingo_abertura: "09:00", domingo_fechamento: "14:00"
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email || "");

      // Calcula dias restantes do trial (14 dias a partir do cadastro)
      const criado = new Date(user.created_at);
      const hoje = new Date();
      const diffDias = Math.floor((hoje.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24));
      const restantes = Math.max(0, 14 - diffDias);
      setDiasRestantes(restantes);
      // Quando tiver tag de pagante, troca "trial" por "pro" aqui
      setPlano(restantes > 0 ? "trial" : "expirado");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({
          nome: data.nome || "", nome_loja: data.nome_loja || "",
          foto_url: data.foto_url || "", telefone: data.telefone || "",
          rua: addr.rua || "", numero: addr.numero || "", bairro: addr.bairro || "",
          cidade: addr.cidade || "", estado: addr.estado || "", cep: addr.cep || ""
        });
        setNomeSalvo(data.nome || "");
        setNomeLojaSalvo(data.nome_loja || "");
        if (data.foto_url) setPreview(data.foto_url);
        if (data.horario) { try { setHorario(h => ({ ...h, ...JSON.parse(data.horario) })); } catch {} }
        setEntrega({
          faz_entrega: data.faz_entrega || false,
          taxa_entrega: data.taxa_entrega?.toString() || "0",
          tempo_entrega: data.tempo_entrega || "",
          area_entrega: data.area_entrega || ""
        });
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
      await supabase.from("profiles").upsert(
        { id: userId, nome: form.nome, nome_loja: form.nome_loja, telefone: form.telefone, foto_url: publicUrl },
        { onConflict: "id" }
      );
      await refreshProfile();
    }
    setUploading(false);
  };

  const toggleDia = (dia: string) =>
    setHorario(h => ({
      ...h,
      dias: h.dias.includes(dia) ? h.dias.filter(d => d !== dia) : [...h.dias, dia]
    }));

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
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
    const endereco = JSON.stringify({ rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado, cep: form.cep });
    const { error: err } = await supabase.from("profiles").upsert(
      { id: userId, nome: form.nome, nome_loja: form.nome_loja, foto_url: form.foto_url, telefone: form.telefone, endereco, horario: JSON.stringify(horario), faz_entrega: entrega.faz_entrega, taxa_entrega: parseFloat(entrega.taxa_entrega) || 0, tempo_entrega: entrega.tempo_entrega, area_entrega: entrega.area_entrega },
      { onConflict: "id" }
    );
    if (err) setError("Erro ao salvar. Tente novamente.");
    else { setSuccess(true); setNomeSalvo(form.nome); setNomeLojaSalvo(form.nome_loja); await refreshProfile(); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  };

  if (loading) return (
    <div className="cfg-loading">
      <span className="cfg-spinner-lg" />
    </div>
  );

  /* ────── shared section for horários ────── */
  const HorarioSection = ({ desk = false }: { desk?: boolean }) => (
    <div className={desk ? "cfg-desk-card" : "cfg-card"}>
      {desk && <div className="cfg-card-header"><span className="cfg-card-icon">🕐</span><span>Horários</span></div>}
      {!desk && <SectionLabel>Horários de funcionamento</SectionLabel>}

      <p className="cfg-hint">Dias que sua loja funciona (seg–sex)</p>
      <div className="dias-grid">
        {DIAS.slice(0,5).map(dia => (
          <button key={dia} className={`dia-btn${horario.dias.includes(dia) ? " active" : ""}`} onClick={() => toggleDia(dia)}>
            {dia.slice(0,3)}
          </button>
        ))}
      </div>
      <div className="cfg-row-2" style={{marginTop:"0.75rem"}}>
        <div className="cfg-time-field">
          <label>Abertura</label>
          <input type="time" value={horario.abertura} onChange={e => setHorario({...horario, abertura: e.target.value})} />
        </div>
        <div className="cfg-time-field">
          <label>Fechamento</label>
          <input type="time" value={horario.fechamento} onChange={e => setHorario({...horario, fechamento: e.target.value})} />
        </div>
      </div>

      <div className="cfg-divider" />

      <div className="cfg-toggle-row">
        <div>
          <p className="cfg-toggle-label">Abre Sábado?</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={horario.abre_sabado} onChange={e => setHorario({...horario, abre_sabado: e.target.checked})} />
          <span className="toggle-slider" />
        </label>
      </div>
      {horario.abre_sabado && (
        <div className="cfg-row-2">
          <div className="cfg-time-field">
            <label>Abertura (sáb)</label>
            <input type="time" value={horario.sabado_abertura} onChange={e => setHorario({...horario, sabado_abertura: e.target.value})} />
          </div>
          <div className="cfg-time-field">
            <label>Fechamento (sáb)</label>
            <input type="time" value={horario.sabado_fechamento} onChange={e => setHorario({...horario, sabado_fechamento: e.target.value})} />
          </div>
        </div>
      )}

      <div className="cfg-toggle-row" style={{marginTop: horario.abre_sabado ? "0.75rem" : undefined}}>
        <div>
          <p className="cfg-toggle-label">Abre Domingo?</p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={horario.abre_domingo} onChange={e => setHorario({...horario, abre_domingo: e.target.checked})} />
          <span className="toggle-slider" />
        </label>
      </div>
      {horario.abre_domingo && (
        <div className="cfg-row-2">
          <div className="cfg-time-field">
            <label>Abertura (dom)</label>
            <input type="time" value={horario.domingo_abertura} onChange={e => setHorario({...horario, domingo_abertura: e.target.value})} />
          </div>
          <div className="cfg-time-field">
            <label>Fechamento (dom)</label>
            <input type="time" value={horario.domingo_fechamento} onChange={e => setHorario({...horario, domingo_fechamento: e.target.value})} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="cfg-root">

      {/* ─────────────── MOBILE ─────────────── */}
      <div className="cfg-mobile">

        {/* Header roxo com avatar */}
        <div className="cfg-hero">
          <div className="cfg-hero-left">
            <p className="cfg-hero-saudacao">{getSaudacao()}, {nomeSalvo ? nomeSalvo.split(" ")[0] : "bem-vinda"}!</p>
            <p className="cfg-hero-loja">{nomeLojaSalvo || ""}</p>
            <p className="cfg-hero-email">{userEmail}</p>
            {plano === "pro" && (
              <span className="cfg-badge cfg-badge-pro">✨ Acesso PRO ativo</span>
            )}
            {plano === "trial" && (
              <span className="cfg-badge cfg-badge-trial">Plano Grátis</span>
            )}
            {plano === "expirado" && (
              <span className="cfg-badge cfg-badge-expirado">⚠️ Período expirado · <u style={{cursor:"pointer"}} onClick={() => navigate("/assinar")}>Assinar agora</u></span>
            )}
          </div>
          <div className="cfg-hero-avatar" onClick={() => !uploading && fileRef.current?.click()}>
            {preview
              ? <img src={preview} alt="foto" className="cfg-hero-img" />
              : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            }
            <div className="cfg-hero-cam">
              {uploading ? <span className="cfg-spinner-sm" /> : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              )}
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        {/* Card — Dados pessoais */}
        <div className="cfg-card">
          <SectionLabel>Dados da loja</SectionLabel>
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            placeholder="Seu nome"
            value={form.nome}
            onChange={(e: any) => setForm({...form, nome: e.target.value})}
          />
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            placeholder="Nome da confeitaria"
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
        </div>

        {/* Card — Endereço */}
        <div className="cfg-card">
          <SectionLabel>Endereço</SectionLabel>
          <div className="cfg-cep-row">
            <Field
              icon={buscandoCep
                ? <span className="cfg-spinner-xs" />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M9 9h6M9 13h4"/></svg>
              }
              placeholder="CEP (opcional)"
              value={form.cep}
              onChange={(e: any) => {
                const d = e.target.value.replace(/\D/g,'').slice(0,8);
                const fmt = d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d;
                setForm({...form, cep: fmt});
                if (d.length < 8) setCepPreenchido(false);
                if (d.length === 8) buscarCep(d);
              }}
            />
          </div>
          {cepPreenchido && (
            <p className="cfg-cep-hint">
              Campos preenchidos automaticamente.{" "}
              <span className="cfg-cep-editar" onClick={() => setCepPreenchido(false)}>Editar manualmente</span>
            </p>
          )}
          <Field
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
            placeholder="Rua / Avenida"
            value={form.rua}
            onChange={(e: any) => setForm({...form, rua: e.target.value})}
            disabled={cepPreenchido}
          />
          <div className="cfg-row-2">
            <Field
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
              placeholder="Bairro"
              value={form.bairro}
              onChange={(e: any) => setForm({...form, bairro: e.target.value})}
              disabled={cepPreenchido}
            />
            <Field
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>}
              placeholder="Número"
              value={form.numero}
              onChange={(e: any) => setForm({...form, numero: e.target.value})}
            />
          </div>
          <div className="cfg-row-2">
            <Field
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
              placeholder="Cidade"
              value={form.cidade}
              onChange={(e: any) => setForm({...form, cidade: e.target.value})}
              disabled={cepPreenchido}
            />
            <Field
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18"/></svg>}
              placeholder="Estado"
              value={form.estado}
              onChange={(e: any) => setForm({...form, estado: e.target.value.toUpperCase()})}
              maxLength={2}
              disabled={cepPreenchido}
            />
          </div>
        </div>

        {/* Card — Entrega */}
        <div className="cfg-card">
          <SectionLabel>Entrega</SectionLabel>
          <div className="cfg-toggle-row">
            <div>
              <p className="cfg-toggle-label">Faz entrega?</p>
              <p className="cfg-toggle-sub">Ative para exibir opção de entrega</p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={entrega.faz_entrega} onChange={e => setEntrega({...entrega, faz_entrega: e.target.checked})} />
              <span className="toggle-slider" />
            </label>
          </div>
          {entrega.faz_entrega && (
            <>
              <div className="cfg-divider" />
              <Field icon="💰" placeholder="Taxa de entrega (R$)" value={entrega.taxa_entrega} onChange={(e: any) => setEntrega({...entrega, taxa_entrega: e.target.value})} type="number" />
              <Field icon="⏱️" placeholder="Tempo estimado (ex: 30–60 min)" value={entrega.tempo_entrega} onChange={(e: any) => setEntrega({...entrega, tempo_entrega: e.target.value})} />
              <Field icon="📌" placeholder="Área de entrega (bairros, cidades...)" value={entrega.area_entrega} onChange={(e: any) => setEntrega({...entrega, area_entrega: e.target.value})} />
            </>
          )}
        </div>

        {/* Card — Horários */}
        <HorarioSection />

        {/* Card — Categorias */}
        <div className="cfg-card">
          <SectionLabel>Categorias de produtos</SectionLabel>
          <p className="cfg-hint">Organize seu cardápio por categorias</p>
          <div className="cfg-cat-add">
            <div className="cfg-field" style={{flex:1}}>
              <span className="cfg-field-icon">🏷️</span>
              <input
                className="cfg-field-input"
                placeholder="Nova categoria..."
                value={novaCategoria}
                onChange={e => setNovaCategoria(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCategoria()}
              />
            </div>
            <button className="cfg-cat-btn" onClick={handleAddCategoria} disabled={savingCat || !novaCategoria.trim()}>
              {savingCat ? "…" : "+"}
            </button>
          </div>
          {categorias.length === 0
            ? <p className="cfg-empty">Nenhuma categoria ainda</p>
            : <div className="cfg-cat-list">
                {categorias.map(cat => (
                  <div key={cat} className="cfg-cat-item">
                    <span>🏷️ {cat}</span>
                    <button className="cfg-cat-remove" onClick={() => handleDeleteCategoria(cat)}>✕</button>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Feedback */}
        {error && <div className="cfg-toast cfg-toast-error">{error}</div>}
        {success && <div className="cfg-toast cfg-toast-success">✓ Salvo com sucesso!</div>}

        {/* Ações */}
        <button className="cfg-btn-save" onClick={handleSave} disabled={saving || uploading}>
          {saving ? <span className="cfg-spinner" /> : "Salvar alterações"}
        </button>
        <button className="cfg-btn-logout" onClick={handleLogout}>Sair da conta</button>

      </div>

      {/* ─────────────── DESKTOP ─────────────── */}
      <div className="cfg-desktop">

        <div className="cfg-desk-header">
          <div>
            <h1 className="cfg-desk-h1">Configurações</h1>
            <p className="cfg-desk-sub">Personalize sua loja e horários de funcionamento</p>
          </div>
          <div className="cfg-desk-actions">
            {error && <span className="cfg-toast cfg-toast-error" style={{width:"auto"}}>{error}</span>}
            {success && <span className="cfg-toast cfg-toast-success" style={{width:"auto"}}>✓ Salvo!</span>}
            <button className="cfg-btn-save" style={{width:"auto",padding:"0.75rem 1.75rem"}} onClick={handleSave} disabled={saving || uploading}>
              {saving ? <span className="cfg-spinner" /> : "Salvar alterações"}
            </button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        <div className="cfg-desk-grid">
          {/* Col 1 */}
          <div className="cfg-desk-col">

            {/* Loja */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header"><span className="cfg-card-icon">🏪</span><span>Sua loja</span></div>
              <div className="cfg-desk-avatar-row">
                <div className="cfg-hero-avatar cfg-hero-avatar--sm" onClick={() => !uploading && fileRef.current?.click()}>
                  {preview
                    ? <img src={preview} alt="foto" className="cfg-hero-img" />
                    : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                  <div className="cfg-hero-cam">
                    {uploading ? <span className="cfg-spinner-sm" /> : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    )}
                  </div>
                </div>
                <div>
                  <p className="cfg-desk-avatar-name">{form.nome || "Seu nome"}</p>
                  <p className="cfg-desk-avatar-sub">{uploading ? "Enviando foto..." : "Clique para alterar foto"}</p>
                </div>
              </div>
              <div className="cfg-desk-fields">
                <div className="cfg-desk-field"><label>Seu nome</label><input type="text" placeholder="Ex: Ana Paula" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} /></div>
                <div className="cfg-desk-field"><label>Nome da confeitaria</label><input type="text" placeholder="Ex: Doces da Ana" value={form.nome_loja} onChange={e => setForm({...form, nome_loja: e.target.value})} /></div>
                <div className="cfg-desk-field"><label>WhatsApp</label><input type="tel" placeholder="(41) 9 9999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: formatPhone(e.target.value)})} /></div>
              </div>
            </div>

            {/* Endereço */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header"><span className="cfg-card-icon">📍</span><span>Endereço</span></div>
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

            {/* Categorias */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header"><span className="cfg-card-icon">🏷️</span><span>Categorias</span></div>
              <div className="cfg-cat-add">
                <input
                  style={{flex:1,padding:"0.65rem 0.9rem",border:"1.5px solid #e5e7eb",borderRadius:"10px",fontFamily:"inherit",fontSize:"0.88rem",outline:"none"}}
                  placeholder="Nova categoria..."
                  value={novaCategoria}
                  onChange={e => setNovaCategoria(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddCategoria()}
                />
                <button
                  onClick={handleAddCategoria}
                  disabled={savingCat || !novaCategoria.trim()}
                  style={{padding:"0.65rem 1.1rem",background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"white",border:"none",borderRadius:"10px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",fontSize:"0.88rem",whiteSpace:"nowrap"}}
                >
                  {savingCat ? "…" : "+ Adicionar"}
                </button>
              </div>
              {categorias.length === 0
                ? <p className="cfg-empty">Nenhuma categoria ainda</p>
                : <div className="cfg-cat-list">
                    {categorias.map(cat => (
                      <div key={cat} className="cfg-cat-item">
                        <span>🏷️ {cat}</span>
                        <button className="cfg-cat-remove" onClick={() => handleDeleteCategoria(cat)}>✕</button>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>

          {/* Col 2 */}
          <div className="cfg-desk-col">

            {/* Horários */}
            <HorarioSection desk />

            {/* Entrega */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header"><span className="cfg-card-icon">🛵</span><span>Entrega</span></div>
              <div className="cfg-toggle-row">
                <div>
                  <p className="cfg-toggle-label">Faz entrega?</p>
                  <p className="cfg-toggle-sub">Ative para exibir opção de entrega</p>
                </div>
                <label className="toggle">
                  <input type="checkbox" checked={entrega.faz_entrega} onChange={e => setEntrega({...entrega, faz_entrega: e.target.checked})} />
                  <span className="toggle-slider" />
                </label>
              </div>
              {entrega.faz_entrega && (
                <div className="cfg-desk-fields" style={{marginTop:"0.75rem"}}>
                  <div className="cfg-divider" />
                  <div className="cfg-desk-field"><label>Taxa (R$)</label><input type="number" placeholder="5.00" value={entrega.taxa_entrega} onChange={e => setEntrega({...entrega, taxa_entrega: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Tempo estimado</label><input type="text" placeholder="30 a 60 minutos" value={entrega.tempo_entrega} onChange={e => setEntrega({...entrega, tempo_entrega: e.target.value})} /></div>
                  <div className="cfg-desk-field"><label>Área de entrega</label><input type="text" placeholder="Bairros ou cidades atendidas" value={entrega.area_entrega} onChange={e => setEntrega({...entrega, area_entrega: e.target.value})} /></div>
                </div>
              )}
            </div>

            {/* Sair */}
            <button className="cfg-btn-logout" onClick={handleLogout} style={{width:"100%"}}>Sair da conta</button>

          </div>
        </div>
      </div>

      {/* ─────────────── STYLES ─────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Responsive split ── */
        .cfg-mobile  { display: flex; flex-direction: column; gap: 0.85rem; }
        .cfg-desktop { display: none; }
        @media (min-width: 900px) {
          .cfg-mobile  { display: none; }
          .cfg-desktop { display: block; }
        }

        /* ── Loading ── */
        .cfg-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 60vh;
        }
        .cfg-spinner-lg {
          width: 36px; height: 36px;
          border: 3px solid #ede9fe;
          border-top-color: #7c3aed;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        /* ── Hero header (mobile) ── */
        .cfg-hero {
          background: linear-gradient(135deg, #F583BF 0%, #e060a8 100%);
          border-radius: 20px;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .cfg-hero-left { display: flex; flex-direction: column; gap: 0; flex: 1; min-width: 0; }
        .cfg-hero-saudacao { font-size: 1rem; color: white; margin: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cfg-hero-loja { font-size: 0.78rem; color: rgba(255,255,255,0.85); margin: 0.1rem 0 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cfg-hero-email { font-size: 0.68rem; color: rgba(255,255,255,0.6); margin: 0.1rem 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cfg-badge {
          display: inline-block; margin-top: 0.25rem;
          padding: 0.15rem 0.4rem; border-radius: 6px;
          font-size: 0.65rem; font-weight: 600;
          white-space: nowrap; align-self: flex-start;
        }
        .cfg-badge-pro      { background: rgba(255,255,255,0.25); color: white; }
        .cfg-badge-trial    { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cfg-badge-expirado { background: rgba(239,68,68,0.3); color: white; }
        .cfg-hero-avatar {
          width: 72px; height: 72px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          border: 2px solid rgba(255,255,255,0.4);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .cfg-hero-avatar--sm {
          width: 56px; height: 56px;
        }
        .cfg-hero-img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-hero-cam {
          position: absolute; bottom: 0; right: 0;
          background: rgba(0,0,0,0.45);
          width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 50% 0 0 0;
        }


        /* ── Cards ── */
        .cfg-card {
          background: white;
          border-radius: 18px;
          padding: 1.15rem;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          display: flex; flex-direction: column; gap: 0.7rem;
          width: 100%;
        }
        .cfg-section-label {
          font-size: 0.7rem; font-weight: 700;
          color: #F583BF;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0;
        }
        .cfg-hint { font-size: 0.75rem; color: #9ca3af; margin: -0.3rem 0 0; }

        /* ── Fields (pill style) ── */
        .cfg-field {
          display: flex; align-items: center; gap: 0.7rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 50px;
          padding: 0.65rem 1.1rem;
          background: white;
          transition: border-color 0.2s;
          min-width: 0;
        }
        .cfg-field:focus-within { border-color: #7c3aed; }
        .cfg-field-icon { display: flex; align-items: center; flex-shrink: 0; color: #9ca3af; }
        .cfg-field-input {
          flex: 1; border: none; outline: none;
          font-family: 'Inter', sans-serif; font-size: 0.9rem;
          color: #1f2937; background: transparent;
          min-width: 0;
        }
        .cfg-field-disabled { background: #f9fafb; border-color: #f3f4f6; }
        .cfg-field-disabled .cfg-field-input { color: #9ca3af; cursor: not-allowed; }
        .cfg-field-disabled .cfg-field-icon { opacity: 0.4; }
        .cfg-cep-hint { font-size: 0.72rem; color: #9ca3af; margin: -0.2rem 0 0; }
        .cfg-cep-editar { color: #F583BF; font-weight: 600; cursor: pointer; text-decoration: underline; }
        .cfg-field-input:-webkit-autofill,
        .cfg-field-input:-webkit-autofill:hover,
        .cfg-field-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px white inset;
          box-shadow: 0 0 0px 1000px white inset;
          -webkit-text-fill-color: #1f2937;
          transition: background-color 5000s ease-in-out 0s;
        }

        .cfg-row-2 {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 0.5rem;
        }

        /* ── Time fields ── */
        .cfg-time-field { display: flex; flex-direction: column; gap: 0.25rem; }
        .cfg-time-field label {
          font-size: 0.74rem; font-weight: 600; color: #6b7280;
        }
        .cfg-time-field input {
          padding: 0.6rem 0.85rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.88rem; color: #1f2937;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        .cfg-time-field input:focus { border-color: #7c3aed; }

        /* ── Divider ── */
        .cfg-divider { border: none; border-top: 1px solid #f3f4f6; margin: 0; }

        /* ── Toggle ── */
        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .cfg-toggle-label { font-size: 0.88rem; font-weight: 600; color: #374151; margin: 0; }
        .cfg-toggle-sub   { font-size: 0.74rem; color: #9ca3af; margin: 0.1rem 0 0; }
        .toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute; cursor: pointer; inset: 0;
          background: #e5e7eb; border-radius: 26px; transition: 0.3s;
        }
        .toggle-slider:before {
          content: ""; position: absolute;
          height: 20px; width: 20px; left: 3px; bottom: 3px;
          background: white; border-radius: 50%; transition: 0.3s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15);
        }
        .toggle input:checked + .toggle-slider { background: #7c3aed; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        /* ── Dias ── */
        .dias-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .dia-btn {
          padding: 0.35rem 0.7rem;
          border-radius: 20px;
          border: 1.5px solid #e5e7eb;
          background: white;
          font-family: 'Inter', sans-serif;
          font-size: 0.78rem; font-weight: 500;
          color: #6b7280; cursor: pointer;
          transition: all 0.15s;
        }
        .dia-btn.active {
          background: #ede9fe;
          border-color: #7c3aed;
          color: #7c3aed; font-weight: 700;
        }

        /* ── Categorias ── */
        .cfg-cat-add { display: flex; gap: 0.5rem; align-items: center; }
        .cfg-cat-btn {
          width: 42px; height: 42px; border-radius: 50%;
          background: linear-gradient(135deg,#7c3aed,#6d28d9);
          color: white; border: none; font-size: 1.3rem;
          cursor: pointer; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.2s;
        }
        .cfg-cat-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cfg-cat-list { display: flex; flex-direction: column; gap: 0.4rem; }
        .cfg-cat-item {
          display: flex; justify-content: space-between; align-items: center;
          background: #f9fafb;
          border-radius: 10px;
          padding: 0.6rem 0.9rem;
          font-size: 0.88rem; font-weight: 500; color: #374151;
        }
        .cfg-cat-remove {
          background: #fef2f2; border: none; color: #ef4444;
          border-radius: 6px; padding: 0.2rem 0.5rem;
          cursor: pointer; font-size: 0.75rem; font-weight: 600;
          transition: background 0.15s;
        }
        .cfg-cat-remove:hover { background: #fee2e2; }
        .cfg-empty { color: #9ca3af; font-size: 0.82rem; text-align: center; padding: 0.75rem; }

        /* ── Toasts ── */
        .cfg-toast {
          width: 100%;
          border-radius: 12px;
          padding: 0.7rem 1rem;
          font-size: 0.85rem; font-weight: 500;
        }
        .cfg-toast-error   { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }
        .cfg-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }

        /* ── Buttons ── */
        .cfg-btn-save {
          width: 100%; padding: 0.9rem;
          background: linear-gradient(135deg,#7c3aed,#6d28d9);
          color: white; border: none; border-radius: 50px;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          min-height: 50px; letter-spacing: 0.3px;
          transition: opacity 0.2s, transform 0.1s;
        }
        .cfg-btn-save:hover   { opacity: 0.92; }
        .cfg-btn-save:active  { transform: scale(0.98); }
        .cfg-btn-save:disabled { opacity: 0.65; cursor: not-allowed; }

        .cfg-btn-logout {
          width: 100%; padding: 0.8rem;
          background: none;
          border: 1.5px solid #e5e7eb;
          border-radius: 50px;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem; font-weight: 600;
          color: #6b7280; cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }
        .cfg-btn-logout:hover { border-color: #ef4444; color: #ef4444; }

        /* ── Spinner ── */
        .cfg-spinner {
          width: 20px; height: 20px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        .cfg-spinner-sm {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        .cfg-spinner-xs {
          width: 12px; height: 12px;
          border: 2px solid #e5e7eb;
          border-top-color: #F583BF;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ══════════════════════════════
           DESKTOP
        ══════════════════════════════ */
        .cfg-desk-header {
          display: flex; align-items: center;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem; flex-wrap: wrap;
        }
        .cfg-desk-h1  { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .cfg-desk-sub { font-size: 0.88rem; color: #9ca3af; margin: 0; }
        .cfg-desk-actions { display: flex; align-items: center; gap: 0.75rem; }

        .cfg-desk-grid {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 1.25rem;
          align-items: start;
        }
        .cfg-desk-col { display: flex; flex-direction: column; gap: 1.25rem; }

        .cfg-desk-card {
          background: white;
          border-radius: 16px;
          padding: 1.25rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.06);
          display: flex; flex-direction: column; gap: 0.9rem;
        }
        .cfg-card-header {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.95rem; font-weight: 700; color: #1f2937;
        }
        .cfg-card-icon { font-size: 1rem; }

        .cfg-desk-avatar-row {
          display: flex; align-items: center; gap: 0.85rem;
          padding-bottom: 0.5rem;
        }
        .cfg-desk-avatar-name { font-size: 0.95rem; font-weight: 600; color: #1f2937; margin: 0; }
        .cfg-desk-avatar-sub  { font-size: 0.78rem; color: #9ca3af; margin: 0.15rem 0 0; cursor: pointer; }

        .cfg-desk-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .cfg-desk-field  { display: flex; flex-direction: column; gap: 0.28rem; }
        .cfg-desk-field label { font-size: 0.78rem; font-weight: 600; color: #374151; }
        .cfg-desk-field input {
          padding: 0.65rem 0.9rem;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.9rem; color: #1f2937;
          outline: none;
          transition: border-color 0.2s;
          width: 100%;
        }
        .cfg-desk-field input:focus { border-color: #7c3aed; }
        .cfg-desk-row {
          display: grid;
          grid-template-columns: minmax(0,1fr) minmax(0,1fr);
          gap: 0.65rem;
        }
      `}</style>
    </div>
  );
}
