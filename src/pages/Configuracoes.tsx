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
    faz_entrega: false, taxa_entrega: "", tempo_entrega: "", area_entrega: "",
    pedido_minimo: "", entrega_gratis_acima: "", horario_entrega: "", observacoes_entrega: ""
  });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepPreenchido, setCepPreenchido] = useState(false);
  const [modalHorario, setModalHorario] = useState(false);
  const [horarioEntregaTemp, setHorarioEntregaTemp] = useState({ inicio: "08:00", fim: "18:00" });
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [ocultarCategorias, setOcultarCategorias] = useState(false);
  const toggleSection = (s: string) => setOpenSection(prev => prev === s ? null : s);

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
      const criado = new Date(user.created_at);
      const hoje = new Date();
      const diffDias = Math.floor((hoje.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24));
      const restantes = Math.max(0, 14 - diffDias);
      setDiasRestantes(restantes);
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const proExpira = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
      const isPROAtivo = data?.plano === "pro" && (!proExpira || proExpira > hoje);
      if (isPROAtivo) { setPlano("pro"); } else { setPlano(restantes > 0 ? "trial" : "expirado"); }
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({ nome: data.nome || "", nome_loja: data.nome_loja || "", foto_url: data.foto_url || "", telefone: data.telefone || "", rua: addr.rua || "", numero: addr.numero || "", bairro: addr.bairro || "", cidade: addr.cidade || "", estado: addr.estado || "", cep: addr.cep || "" });
        setNomeSalvo(data.nome || "");
        setNomeLojaSalvo(data.nome_loja || "");
        if (data.foto_url) setPreview(data.foto_url);
        if (data.horario) { try { setHorario(h => ({ ...h, ...JSON.parse(data.horario) })); } catch {} }
        setEntrega({ faz_entrega: data.faz_entrega || false, taxa_entrega: data.taxa_entrega ? data.taxa_entrega.toString() : "", tempo_entrega: data.tempo_entrega || "", area_entrega: data.area_entrega || "", pedido_minimo: data.pedido_minimo ? data.pedido_minimo.toString() : "", entrega_gratis_acima: data.entrega_gratis_acima ? data.entrega_gratis_acima.toString() : "", horario_entrega: data.horario_entrega || "", observacoes_entrega: data.observacoes_entrega || "" });
        const { data: cats } = await supabase.from("categorias").select("nome").eq("user_id", user.id).order("nome");
        if (cats) setCategorias(cats.map((c: any) => c.nome));
        setOcultarCategorias(data?.ocultar_categorias || false);
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
  const formatPhone = (value: string) => { const d = value.replace(/\D/g, "").slice(0, 11); if (d.length <= 2) return `(${d}`; if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`; };

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
  const [showAlterarSenha, setShowAlterarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [showExcluir, setShowExcluir] = useState(false);
  const [excluirConfirm, setExcluirConfirm] = useState("");
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));

  const handleAlterarSenha = async () => {
    if (novaSenha.length < 6) return setSenhaMsg("Senha deve ter ao menos 6 caracteres.");
    if (novaSenha !== confirmSenha) return setSenhaMsg("Senhas não coincidem.");
    setSavingSenha(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setSavingSenha(false);
    if (error) setSenhaMsg("Erro ao alterar senha. Tente novamente.");
    else { setSenhaMsg("✓ Senha alterada com sucesso!"); setNovaSenha(""); setConfirmSenha(""); setTimeout(() => { setSenhaMsg(""); setShowAlterarSenha(false); }, 2000); }
  };

  const handleExcluirConta = async () => {
    if (excluirConfirm !== "EXCLUIR") return;
    await supabase.auth.signOut();
    navigate("/login");
  };

  const toggleDark = () => {
    const html = document.documentElement;
    if (html.classList.contains("dark")) { html.classList.remove("dark"); setDarkMode(false); localStorage.setItem("theme", "light"); }
    else { html.classList.add("dark"); setDarkMode(true); localStorage.setItem("theme", "dark"); }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true); setError("");
    const endereco = JSON.stringify({ rua: form.rua, numero: form.numero, bairro: form.bairro, cidade: form.cidade, estado: form.estado, cep: form.cep });
    const payload: any = { id: userId, nome: form.nome, nome_loja: form.nome_loja, foto_url: form.foto_url, telefone: form.telefone, endereco, faz_entrega: entrega.faz_entrega, taxa_entrega: entrega.taxa_entrega ? parseFloat(entrega.taxa_entrega) : null, tempo_entrega: entrega.tempo_entrega, area_entrega: entrega.area_entrega };
    if (entrega.pedido_minimo) payload.pedido_minimo = parseFloat(entrega.pedido_minimo) || null;
    if (entrega.entrega_gratis_acima) payload.entrega_gratis_acima = parseFloat(entrega.entrega_gratis_acima) || null;
    if (entrega.horario_entrega !== undefined) payload.horario_entrega = entrega.horario_entrega;
    if (entrega.observacoes_entrega !== undefined) payload.observacoes_entrega = entrega.observacoes_entrega;
    payload.ocultar_categorias = ocultarCategorias;
    const { error: err } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (err) { setError("Erro ao salvar. Tente novamente."); } else { setSuccess(true); setNomeSalvo(form.nome); setNomeLojaSalvo(form.nome_loja); await refreshProfile(); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  };

  if (loading) return <div className="cfg-loading"><span className="cfg-spinner-lg" /></div>;

  return (
    <div className="cfg-root">

      {/* ─────────────── MOBILE ─────────────── */}
      <div className="cfg-mobile">
        <div className="cfg-hero">
          <div className="cfg-hero-left">
            <p className="cfg-hero-saudacao">{getSaudacao()}, {nomeSalvo ? nomeSalvo.split(" ")[0] : "bem-vinda"}!</p>
            {plano === "pro" && <span className="cfg-badge cfg-badge-pro">✨ Acesso PRO ativo</span>}
            {plano === "trial" && <span className="cfg-badge cfg-badge-trial">Plano Grátis</span>}
            {plano === "expirado" && <span className="cfg-badge cfg-badge-expirado">⚠️ Período expirado · <u style={{cursor:"pointer"}} onClick={() => navigate("/assinar")}>Assinar agora</u></span>}
            <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>Doonly v1.0.0</span>
          </div>
          <div className="cfg-hero-avatar" onClick={() => !uploading && fileRef.current?.click()}>
            {preview ? <img src={preview} alt="foto" className="cfg-hero-img" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            <div className="cfg-hero-cam">{uploading ? <span className="cfg-spinner-sm" /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}</div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        {/* Minha Conta */}
        <div className="cfg-accordion">
          <button className="cfg-accordion-header" onClick={() => toggleSection("dados")}>
            <span className="cfg-accordion-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
            <span className="cfg-accordion-title">Minha Conta</span>
            <svg className={`cfg-accordion-chevron${openSection === "dados" ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {openSection === "dados" && (
            <div className="cfg-accordion-body">
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} placeholder="Seu nome" value={form.nome} onChange={(e: any) => setForm({...form, nome: e.target.value})} />
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>} placeholder="WhatsApp" value={form.telefone} onChange={(e: any) => setForm({...form, telefone: formatPhone(e.target.value)})} type="tel" />
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} placeholder="E-mail" value={userEmail} onChange={() => {}} disabled={true} />
              {error && <div className="cfg-toast cfg-toast-error">{error}</div>}
              {success && <div className="cfg-toast cfg-toast-success">✓ Salvo com sucesso!</div>}
              <button className="cfg-btn-save" onClick={handleSave} disabled={saving || uploading}>
                {saving ? <span className="cfg-spinner" /> : "Salvar alterações"}
              </button>
            </div>
          )}
        </div>

        {/* Alterar Senha */}
        <div className="cfg-accordion">
          <button className="cfg-accordion-header" onClick={() => setShowAlterarSenha(v => !v)}>
            <span className="cfg-accordion-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <span className="cfg-accordion-title">Alterar Senha</span>
            <svg className={`cfg-accordion-chevron${showAlterarSenha ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showAlterarSenha && (
            <div className="cfg-accordion-body">
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} placeholder="Nova senha" value={novaSenha} onChange={(e: any) => setNovaSenha(e.target.value)} type="password" />
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} placeholder="Confirmar nova senha" value={confirmSenha} onChange={(e: any) => setConfirmSenha(e.target.value)} type="password" />
              {senhaMsg && <p style={{ fontSize: "0.82rem", color: senhaMsg.startsWith("✓") ? "#22c55e" : "#ef4444", margin: 0 }}>{senhaMsg}</p>}
              <button className="cfg-btn-save" onClick={handleAlterarSenha} disabled={savingSenha}>
                {savingSenha ? <span className="cfg-spinner" /> : "Alterar senha"}
              </button>
            </div>
          )}
        </div>

        {/* Tema — apenas mobile */}
        <div className="cfg-accordion">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="cfg-accordion-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></span>
              <div>
                <p className="cfg-accordion-title" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontSize: "0.88rem" }}>Tema {darkMode ? "Escuro" : "Claro"}</p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted,#9ca3af)", margin: 0 }}>Alterar aparência do app</p>
              </div>
            </div>
            <button onClick={toggleDark} style={{ width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer", background: darkMode ? "#ec4899" : "#e5e7eb", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: darkMode ? "25px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
        </div>

        {/* Excluir Conta */}
        <div className="cfg-accordion">
          <button className="cfg-accordion-header" onClick={() => setShowExcluir(v => !v)}>
            <span className="cfg-accordion-icon" style={{ color: "#ef4444" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></span>
            <span className="cfg-accordion-title" style={{ color: "#ef4444" }}>Excluir conta</span>
            <svg className={`cfg-accordion-chevron${showExcluir ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showExcluir && (
            <div className="cfg-accordion-body">
              <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Esta ação é irreversível. Todos os seus dados serão removidos permanentemente.</p>
              <p style={{ fontSize: "0.82rem", color: "#374151", margin: 0 }}>Digite <strong>EXCLUIR</strong> para confirmar:</p>
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>} placeholder="Digite EXCLUIR" value={excluirConfirm} onChange={(e: any) => setExcluirConfirm(e.target.value)} />
              <button onClick={handleExcluirConta} disabled={excluirConfirm !== "EXCLUIR"} style={{ padding: "0.75rem", background: excluirConfirm === "EXCLUIR" ? "#ef4444" : "#f3f4f6", color: excluirConfirm === "EXCLUIR" ? "white" : "#9ca3af", border: "none", borderRadius: "12px", fontFamily: "Geist, sans-serif", fontSize: "0.88rem", fontWeight: 700, cursor: excluirConfirm === "EXCLUIR" ? "pointer" : "not-allowed" }}>
                Excluir minha conta
              </button>
              <button onClick={() => { setShowExcluir(false); setExcluirConfirm(""); }} style={{ padding: "0.75rem", background: "none", border: "1.5px solid #e5e7eb", borderRadius: "12px", fontFamily: "Geist, sans-serif", fontSize: "0.88rem", fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          )}
        </div>

        <button className="cfg-btn-logout" onClick={handleLogout}>Sair da conta</button>
      </div>

      {/* ─────────────── DESKTOP ─────────────── */}
      <div className="cfg-desktop">
        <div className="cfg-desk-header">
          <div>
            <h1 className="cfg-desk-h1">Configurações</h1>
            <p className="cfg-desk-sub">Gerencie sua conta e preferências</p>
          </div>
          <div className="cfg-desk-header-actions">
            {error && <span className="cfg-toast cfg-toast-error" style={{width:"auto"}}>{error}</span>}
            {success && <span className="cfg-toast cfg-toast-success" style={{width:"auto"}}>✓ Salvo!</span>}
            <button className="cfg-btn-save cfg-btn-save--sm" onClick={handleSave} disabled={saving || uploading}>
              {saving ? <span className="cfg-spinner" /> : "Salvar alterações"}
            </button>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        {/* Perfil — faixa superior */}
        <div className="cfg-desk-profile-banner">
          <div className="cfg-desk-profile-left">
            <div className="cfg-hero-avatar cfg-hero-avatar--md" onClick={() => !uploading && fileRef.current?.click()}>
              {preview ? <img src={preview} alt="foto" className="cfg-hero-img" /> : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              <div className="cfg-hero-cam">{uploading ? <span className="cfg-spinner-sm" /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}</div>
            </div>
            <div>
              <p className="cfg-desk-profile-name">{form.nome || "Seu nome"}</p>
              <p className="cfg-desk-profile-email">{userEmail}</p>
              {plano === "pro" && <span className="cfg-badge cfg-badge-pro" style={{background:"#fce7f3",color:"#ec4899"}}>✨ PRO ativo</span>}
              {plano === "trial" && <span className="cfg-badge cfg-badge-trial" style={{background:"#f3f4f6",color:"#6b7280"}}>Plano Grátis</span>}
              {plano === "expirado" && <span className="cfg-badge cfg-badge-expirado" style={{background:"#fff1f2",color:"#ef4444"}}>⚠️ Expirado</span>}
            </div>
          </div>
          <p className="cfg-desk-profile-hint">Clique na foto para alterar</p>
        </div>

        {/* Grid 3 colunas */}
        <div className="cfg-desk-grid3">

          {/* Card 1 — Dados da loja */}
          <div className="cfg-desk-card">
            <div className="cfg-card-header">
              <span className="cfg-card-icon">🏪</span>
              <span>Dados da loja</span>
            </div>
            <div className="cfg-desk-fields">
              <div className="cfg-desk-field">
                <label>Seu nome</label>
                <input type="text" placeholder="Ex: Ana Paula" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
              </div>
              <div className="cfg-desk-field">
                <label>Nome da confeitaria</label>
                <input type="text" placeholder="Ex: Doces da Ana" value={form.nome_loja} onChange={e => setForm({...form, nome_loja: e.target.value})} />
              </div>
              <div className="cfg-desk-field">
                <label>WhatsApp</label>
                <input type="tel" placeholder="(41) 9 9999-9999" value={form.telefone} onChange={e => setForm({...form, telefone: formatPhone(e.target.value)})} />
              </div>
              <div className="cfg-desk-field">
                <label>E-mail</label>
                <input type="email" value={userEmail} disabled style={{opacity:0.5, cursor:"not-allowed"}} />
              </div>
            </div>
          </div>

          {/* Card 2 — Alterar Senha */}
          <div className="cfg-desk-card">
            <div className="cfg-card-header">
              <span className="cfg-card-icon">🔒</span>
              <span>Alterar Senha</span>
            </div>
            {!showAlterarSenha ? (
              <div style={{display:"flex", flexDirection:"column", gap:"0.5rem"}}>
                <p style={{fontSize:"0.82rem", color:"var(--text-muted,#9ca3af)", margin:0}}>Troque sua senha de acesso ao Doonly.</p>
                <button onClick={() => setShowAlterarSenha(true)} className="cfg-btn-outline">Alterar senha</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div className="cfg-desk-field">
                  <label>Nova senha</label>
                  <input type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
                </div>
                <div className="cfg-desk-field">
                  <label>Confirmar nova senha</label>
                  <input type="password" placeholder="Repita a senha" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} />
                </div>
                {senhaMsg && <p style={{ fontSize: "0.82rem", color: senhaMsg.startsWith("✓") ? "#22c55e" : "#ef4444", margin: 0 }}>{senhaMsg}</p>}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setShowAlterarSenha(false)} className="cfg-btn-ghost" style={{flex:1}}>Cancelar</button>
                  <button onClick={handleAlterarSenha} disabled={savingSenha} className="cfg-btn-save" style={{flex:2, minHeight:"38px", fontSize:"0.85rem"}}>
                    {savingSenha ? <span className="cfg-spinner" /> : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Card 3 — Excluir Conta */}
          <div className="cfg-desk-card cfg-desk-card--danger">
            <div className="cfg-card-header">
              <span className="cfg-card-icon">🗑️</span>
              <span style={{color:"#ef4444"}}>Excluir conta</span>
            </div>
            {!showExcluir ? (
              <div style={{display:"flex", flexDirection:"column", gap:"0.5rem"}}>
                <p style={{fontSize:"0.82rem", color:"var(--text-muted,#9ca3af)", margin:0}}>Ação irreversível. Todos os dados serão removidos permanentemente.</p>
                <button onClick={() => setShowExcluir(true)} className="cfg-btn-danger-outline">Excluir minha conta</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p style={{ fontSize: "0.82rem", color: "#6b7280", margin: 0 }}>Digite <strong>EXCLUIR</strong> para confirmar:</p>
                <div className="cfg-desk-field">
                  <input type="text" placeholder="Digite EXCLUIR" value={excluirConfirm} onChange={e => setExcluirConfirm(e.target.value)} style={{borderColor: excluirConfirm === "EXCLUIR" ? "#ef4444" : undefined}} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setShowExcluir(false); setExcluirConfirm(""); }} className="cfg-btn-ghost" style={{flex:1}}>Cancelar</button>
                  <button onClick={handleExcluirConta} disabled={excluirConfirm !== "EXCLUIR"} style={{ flex: 2, padding: "0.6rem", background: excluirConfirm === "EXCLUIR" ? "#ef4444" : "#f3f4f6", color: excluirConfirm === "EXCLUIR" ? "white" : "#9ca3af", border: "none", borderRadius: "10px", fontFamily: "Geist, sans-serif", fontSize: "0.85rem", fontWeight: 600, cursor: excluirConfirm === "EXCLUIR" ? "pointer" : "not-allowed" }}>
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Rodapé desktop */}
        <div className="cfg-desk-footer">
          <button className="cfg-btn-logout" onClick={handleLogout} style={{width:"auto", padding:"0.65rem 2rem"}}>Sair da conta</button>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Shared ── */
        .cfg-loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
        .cfg-spinner-lg { width: 36px; height: 36px; border: 3px solid #ede9fe; border-top-color: #F583BF; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .cfg-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .cfg-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .cfg-hero-avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; flex-shrink: 0; }
        .cfg-hero-avatar--md { width: 64px; height: 64px; background: #f3f4f6; border: 2px solid #e5e7eb; }
        .cfg-hero-img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-hero-cam { position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.45); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50% 0 0 0; }

        .cfg-field { display: flex; align-items: center; gap: 0.7rem; border: 1.5px solid var(--border, #e5e7eb); border-radius: 50px; padding: 0.65rem 1.1rem; background: var(--bg-input, white); transition: border-color 0.2s; min-width: 0; }
        .cfg-field:focus-within { border-color: #F583BF; }
        .cfg-field-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--text-muted, #9ca3af); }
        .cfg-field-input { flex: 1; border: none; outline: none; font-family: 'Geist', sans-serif; font-size: 0.9rem; color: var(--text-primary, #1f2937); background: transparent; min-width: 0; }

        .cfg-toast { width: 100%; border-radius: 12px; padding: 0.7rem 1rem; font-size: 0.85rem; font-weight: 500; }
        .cfg-toast-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }
        .cfg-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }

        .cfg-btn-save { width: 100%; padding: 0.9rem; background: linear-gradient(135deg, #F583BF, #e060a8); color: white; border: none; border-radius: 50px; font-family: 'Geist', sans-serif; font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 50px; letter-spacing: 0.3px; transition: opacity 0.2s, transform 0.1s; }
        .cfg-btn-save:hover { opacity: 0.92; }
        .cfg-btn-save:active { transform: scale(0.98); }
        .cfg-btn-save:disabled { opacity: 0.65; cursor: not-allowed; }
        .cfg-btn-save--sm { width: auto; padding: 0.6rem 1.5rem; min-height: 40px; font-size: 0.88rem; border-radius: 50px; }

        .cfg-btn-logout { width: 100%; padding: 0.8rem; background: none; border: 1.5px solid #e5e7eb; border-radius: 50px; font-family: 'Geist', sans-serif; font-size: 0.9rem; font-weight: 600; color: #6b7280; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .cfg-btn-logout:hover { border-color: #ef4444; color: #ef4444; }

        .cfg-btn-outline { padding: 0.6rem 1rem; background: #fdf2f8; color: #ec4899; border: 1px solid #fce7f3; border-radius: 10px; font-family: 'Geist', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .cfg-btn-outline:hover { background: #fce7f3; }

        .cfg-btn-danger-outline { padding: 0.6rem 1rem; background: #fff1f2; color: #ef4444; border: 1px solid #fecdd3; border-radius: 10px; font-family: 'Geist', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .cfg-btn-danger-outline:hover { background: #fee2e2; }

        .cfg-btn-ghost { padding: 0.6rem 1rem; background: #f3f4f6; color: #6b7280; border: none; border-radius: 10px; font-family: 'Geist', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; }

        .cfg-badge { display: inline-block; margin-top: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.68rem; font-weight: 600; }
        .cfg-badge-pro { background: rgba(255,255,255,0.25); color: white; }
        .cfg-badge-trial { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cfg-badge-expirado { background: rgba(239,68,68,0.3); color: white; }

        /* ── Mobile ── */
        .cfg-mobile { display: flex; flex-direction: column; gap: 0.85rem; }
        .cfg-desktop { display: none; }

        .cfg-hero { background: linear-gradient(135deg, #F583BF 0%, #e060a8 100%); border-radius: 20px; padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .cfg-hero-left { display: flex; flex-direction: column; gap: 0; flex: 1; min-width: 0; }
        .cfg-hero-saudacao { font-size: 1rem; color: white; margin: 0; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .cfg-accordion { background: white; border-radius: 18px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); overflow: hidden; }
        .cfg-accordion-header { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 1rem 1.15rem; background: none; border: none; cursor: pointer; font-family: 'Geist', sans-serif; text-align: left; }
        .cfg-accordion-icon { color: #9ca3af; display: flex; align-items: center; }
        .cfg-accordion-title { flex: 1; font-size: 0.88rem; font-weight: 700; color: #F583BF; text-transform: uppercase; letter-spacing: 0.07em; }
        .cfg-accordion-chevron { color: #9ca3af; transition: transform 0.2s; flex-shrink: 0; }
        .cfg-accordion-chevron.open { transform: rotate(180deg); }
        .cfg-accordion-body { padding: 0 1.15rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; border-top: 1px solid #f3f4f6; padding-top: 1rem; }

        :root.dark .cfg-accordion { background: transparent; border-radius: 0; box-shadow: none; border-bottom: 1px solid var(--border, #2a2a2a); }
        :root.dark .cfg-accordion:first-of-type { border-top: 1px solid var(--border, #2a2a2a); }
        :root.dark .cfg-accordion-header { padding: 1rem 0; }
        :root.dark .cfg-accordion-body { padding: 0 0 1.25rem; border-top: 1px solid var(--border, #2a2a2a); padding-top: 1rem; }

        .cfg-section-label { font-size: 0.7rem; font-weight: 700; color: #F583BF; text-transform: uppercase; letter-spacing: 0.07em; margin: 0; }
        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .cfg-toggle-label { font-size: 0.88rem; font-weight: 600; color: #374151; margin: 0; }
        .toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: #e5e7eb; border-radius: 26px; transition: 0.3s; }
        .toggle-slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
        .toggle input:checked + .toggle-slider { background: #F583BF; }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        /* ── Desktop ── */
        @media (min-width: 900px) {
          .cfg-mobile { display: none; }
          .cfg-desktop { display: block; }
        }

        .cfg-desk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap; }
        .cfg-desk-h1 { font-size: 1.6rem; font-weight: 700; color: var(--text-primary, #1f2937); margin: 0 0 0.2rem; }
        .cfg-desk-sub { font-size: 0.88rem; color: var(--text-muted, #9ca3af); margin: 0; }
        .cfg-desk-header-actions { display: flex; align-items: center; gap: 0.75rem; }

        .cfg-desk-profile-banner { background: var(--bg-card, white); border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; gap: 1rem; }
        .cfg-desk-profile-left { display: flex; align-items: center; gap: 1rem; }
        .cfg-desk-profile-name { font-size: 1.05rem; font-weight: 700; color: var(--text-primary, #1f2937); margin: 0; }
        .cfg-desk-profile-email { font-size: 0.82rem; color: var(--text-muted, #9ca3af); margin: 0.15rem 0 0.3rem; }
        .cfg-desk-profile-hint { font-size: 0.78rem; color: var(--text-muted, #9ca3af); }

        .cfg-desk-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; align-items: start; }

        .cfg-desk-card { background: var(--bg-card, white); border-radius: 16px; padding: 1.25rem; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 0.9rem; border: 1px solid var(--border, #f3f4f6); transition: box-shadow 0.2s; }
        .cfg-desk-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        .cfg-desk-card--danger { border-color: #fee2e2; }

        .cfg-card-header { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 700; color: var(--text-primary, #1f2937); padding-bottom: 0.5rem; border-bottom: 1px solid var(--border, #f3f4f6); }
        .cfg-card-icon { font-size: 1rem; }

        .cfg-desk-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .cfg-desk-field { display: flex; flex-direction: column; gap: 0.28rem; }
        .cfg-desk-field label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary, #374151); }
        .cfg-desk-field input { padding: 0.65rem 0.9rem; border: 1.5px solid var(--border, #e5e7eb); border-radius: 10px; font-family: 'Geist', sans-serif; font-size: 0.9rem; color: var(--text-primary, #1f2937); background: var(--bg-input, white); outline: none; transition: border-color 0.2s; width: 100%; }
        .cfg-desk-field input:focus { border-color: #F583BF; }

        .cfg-desk-footer { display: flex; align-items: center; justify-content: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border, #f3f4f6); }
      `}</style>
    </div>
  );
}
