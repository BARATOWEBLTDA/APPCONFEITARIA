import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";
import { usePushSubscription } from "@/hooks/usePushSubscription";

// ── Componente inline: toggle de push notifications ──────────
function PushToggle() {
  const { isSupported, isSubscribed, permission, loading, error, subscribe, unsubscribe } = usePushSubscription();

  if (!isSupported) {
    return (
      <div className="cfg-push-row">
        <div>
          <p className="cfg-notif-label">Notificações push</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Seu navegador não suporta notificações push. Use Chrome ou instale o app como PWA.
          </p>
        </div>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="cfg-push-row">
        <div>
          <p className="cfg-notif-label">Notificações push</p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--error)', lineHeight: 1.4 }}>
            Permissão bloqueada. Vá nas configurações do navegador para reativar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cfg-push-row">
      <div style={{ flex: 1 }}>
        <p className="cfg-notif-label">Receber notificações no celular</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {isSubscribed ? 'Ativado — você receberá avisos mesmo com o app fechado.' : 'Receba avisos de novidades e atualizações do Doonly.'}
        </p>
        {error && <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--error)' }}>{error}</p>}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={isSubscribed}
          disabled={loading}
          onChange={() => isSubscribed ? unsubscribe() : subscribe()}
        />
        <span className="toggle-slider" style={{ opacity: loading ? 0.5 : 1 }} />
      </label>
    </div>
  );
}

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
    nome: "", nome_loja: "", foto_url: "", og_image_url: "", telefone: "",
    rua: "", numero: "", bairro: "", cidade: "", estado: "", cep: ""
  });
  const [entrega, setEntrega] = useState({
    faz_entrega: false, taxa_entrega: "", tempo_entrega: "", area_entrega: "",
    pedido_minimo: "", entrega_gratis_acima: "", horario_entrega: "", observacoes_entrega: ""
  });
  const [categorias, setCategorias] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [ocultarCategorias, setOcultarCategorias] = useState(false);
  const [insumos, setInsumos] = useState(0);
  const [receitas, setReceitas] = useState(0);
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [proResgatado, setProResgatado] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const toggleSection = (s: string) => setOpenSection(prev => prev === s ? null : s);

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
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const proExpira = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
      const isPROAtivo = data?.plano === "pro" && (!proExpira || proExpira > hoje);
      setDiasRestantes(restantes);
      if (isPROAtivo) { setPlano("pro"); } else { setPlano(restantes > 0 ? "trial" : "expirado"); }
      if (data) {
        let addr: any = {};
        try { addr = data.endereco ? JSON.parse(data.endereco) : {}; } catch {}
        setForm({ nome: data.nome || "", nome_loja: data.nome_loja || "", foto_url: data.foto_url || "", og_image_url: data.og_image_url || "", telefone: data.telefone || "", rua: addr.rua || "", numero: addr.numero || "", bairro: addr.bairro || "", cidade: addr.cidade || "", estado: addr.estado || "", cep: addr.cep || "" });
        setNomeSalvo(data.nome || "");
        if (data.foto_url) setPreview(data.foto_url);
        if (data.og_image_url) setOgPreview(data.og_image_url);
        if (data.horario) { try { setHorario(h => ({ ...h, ...JSON.parse(data.horario) })); } catch {} }
        setEntrega({ faz_entrega: data.faz_entrega || false, taxa_entrega: data.taxa_entrega ? data.taxa_entrega.toString() : "", tempo_entrega: data.tempo_entrega || "", area_entrega: data.area_entrega || "", pedido_minimo: data.pedido_minimo ? data.pedido_minimo.toString() : "", entrega_gratis_acima: data.entrega_gratis_acima ? data.entrega_gratis_acima.toString() : "", horario_entrega: data.horario_entrega || "", observacoes_entrega: data.observacoes_entrega || "" });
        const { data: cats } = await supabase.from("categorias").select("nome").eq("user_id", user.id).order("nome");
        if (cats) setCategorias(cats.map((c: any) => c.nome));
        setOcultarCategorias(data?.ocultar_categorias || false);
        if (data?.pro_expira_em) setProResgatado(true);
      }
      const { count: ic } = await supabase.from("insumos").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: rc } = await supabase.from("receitas_minhas").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setInsumos(ic || 0);
      setReceitas(rc || 0);
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

  const formatPhone = (value: string) => {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
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
  const [copied, setCopied] = useState(false);
  const [ogPreview, setOgPreview] = useState<string | null>(null);
  const [ogUploading, setOgUploading] = useState(false);
  const ogFileRef = useRef<HTMLInputElement>(null);

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

  const handleOgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setOgUploading(true);
    setOgPreview(URL.createObjectURL(file));
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `og_images/${userId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, og_image_url: publicUrl }));
      setOgPreview(publicUrl);
    }
    setOgUploading(false);
  };

  const [notifDesativar, setNotifDesativar] = useState(false);
  const [notifs, setNotifs] = useState({ receitas: true, comunidade: false, atualizacoes: true });
  const toggleNotifDesativar = (val: boolean) => {
    setNotifDesativar(val);
    if (val) setNotifs({ receitas: false, comunidade: false, atualizacoes: false });
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
    const payload: any = { id: userId, nome: form.nome, nome_loja: form.nome_loja, foto_url: form.foto_url, og_image_url: form.og_image_url, telefone: form.telefone, endereco, faz_entrega: entrega.faz_entrega, taxa_entrega: entrega.taxa_entrega ? parseFloat(entrega.taxa_entrega) : null, tempo_entrega: entrega.tempo_entrega, area_entrega: entrega.area_entrega };
    if (entrega.pedido_minimo) payload.pedido_minimo = parseFloat(entrega.pedido_minimo) || null;
    if (entrega.entrega_gratis_acima) payload.entrega_gratis_acima = parseFloat(entrega.entrega_gratis_acima) || null;
    if (entrega.horario_entrega !== undefined) payload.horario_entrega = entrega.horario_entrega;
    if (entrega.observacoes_entrega !== undefined) payload.observacoes_entrega = entrega.observacoes_entrega;
    payload.ocultar_categorias = ocultarCategorias;
    const { error: err } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (err) { setError("Erro ao salvar. Tente novamente."); } else { setSuccess(true); setNomeSalvo(form.nome); await refreshProfile(); setTimeout(() => setSuccess(false), 3000); }
    setSaving(false);
  };

  const handleResgatarPro = async () => {
    if (!userId) return;
    setResgatando(true);
    const expira = new Date();
    expira.setDate(expira.getDate() + 3);
    const { error } = await supabase.from("profiles").update({ pro_expira_em: expira.toISOString(), plano: "pro" }).eq("id", userId);
    if (!error) setProResgatado(true);
    setResgatando(false);
  };

  const cfgSteps = [
    {
      title: "Configure sua loja", emoji: "🏪",
      items: [
        { label: "Qual é o seu nome?", path: "/configuracoes", done: !!form.nome },
        { label: "Qual é o WhatsApp da sua loja?", path: "/configuracoes", done: !!form.telefone },
        { label: "Cadastre 1 ingrediente", path: "/insumos", done: insumos > 0 },
        { label: "Cadastre 1 cliente", path: "/clientes", done: false },
        { label: "Cadastre 1 receita", path: "/receitas", done: receitas > 0 },
      ],
    },
  ];

  const cfgAllItems = cfgSteps.flatMap(s => s.items);
  const cfgDoneCount = cfgAllItems.filter(i => i.done).length;
  const cfgTotalCount = cfgAllItems.length;
  const cfgProgress = Math.round((cfgDoneCount / cfgTotalCount) * 100);
  const cfgRemaining = cfgTotalCount - cfgDoneCount;
  const cfgNextStep = cfgAllItems.find(i => !i.done);

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

        {/* Tema — apenas PRO */}
        <div className="cfg-accordion">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="cfg-accordion-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg></span>
              <div>
                <p className="cfg-accordion-title" style={{ margin: 0, textTransform: "none", letterSpacing: 0, fontSize: "0.88rem" }}>Tema {darkMode ? "Escuro" : "Claro"}</p>
                {plano !== "pro" && <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>Exclusivo PRO</p>}
              </div>
            </div>
            {plano === "pro" ? (
              <button onClick={toggleDark} style={{ width: "48px", height: "26px", borderRadius: "13px", border: "none", cursor: "pointer", background: darkMode ? "var(--primary)" : "var(--border)", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "3px", transition: "left 0.2s", left: darkMode ? "25px" : "3px", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
              </button>
            ) : (
              <span style={{ fontSize: "0.72rem", color: "var(--primary)", fontWeight: 600, cursor: "pointer" }} onClick={() => navigate("/assinar")}>🔒 Upgrade</span>
            )}
          </div>
        </div>

        {/* Avançado */}
        <div className="cfg-accordion">
          <button className="cfg-accordion-header" onClick={() => toggleSection("avancado")}>
            <span className="cfg-accordion-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
            <span className="cfg-accordion-title">Avançado</span>
            <svg className={`cfg-accordion-chevron${openSection === "avancado" ? " open" : ""}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {openSection === "avancado" && (
            <div className="cfg-accordion-body" style={{ gap: "0.5rem" }}>
              {/* Alterar Senha */}
              <button className="cfg-adv-item" onClick={() => setShowAlterarSenha(v => !v)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Alterar senha
              </button>
              {showAlterarSenha && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.5rem 0" }}>
                  <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} placeholder="Nova senha" value={novaSenha} onChange={(e: any) => setNovaSenha(e.target.value)} type="password" />
                  <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} placeholder="Confirmar nova senha" value={confirmSenha} onChange={(e: any) => setConfirmSenha(e.target.value)} type="password" />
                  {senhaMsg && <p style={{ fontSize: "0.82rem", color: senhaMsg.startsWith("✓") ? "var(--success)" : "var(--error)", margin: 0 }}>{senhaMsg}</p>}
                  <button className="cfg-btn-save" onClick={handleAlterarSenha} disabled={savingSenha}>
                    {savingSenha ? <span className="cfg-spinner" /> : "Alterar senha"}
                  </button>
                </div>
              )}

              {/* Links */}
              <button className="cfg-adv-item" onClick={() => navigate("/privacidade")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Política de privacidade
              </button>
              <button className="cfg-adv-item" onClick={() => navigate("/termos")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Termos de uso
              </button>

              {/* Excluir Conta */}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.5rem", paddingTop: "0.75rem" }}>
                <button className="cfg-adv-item cfg-adv-item--danger" onClick={() => setShowExcluir(v => !v)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Excluir conta
                </button>
                {showExcluir && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", padding: "0.5rem 0" }}>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0 }}>Esta ação é irreversível. Todos os seus dados serão removidos.</p>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", margin: 0 }}>Digite <strong>EXCLUIR</strong> para confirmar:</p>
                    <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>} placeholder="Digite EXCLUIR" value={excluirConfirm} onChange={(e: any) => setExcluirConfirm(e.target.value)} />
                    <button onClick={handleExcluirConta} disabled={excluirConfirm !== "EXCLUIR"} style={{ padding: "0.75rem", background: excluirConfirm === "EXCLUIR" ? "var(--error)" : "var(--bg-body)", color: excluirConfirm === "EXCLUIR" ? "var(--text-inverse)" : "var(--text-muted)", border: "none", borderRadius: "12px", fontFamily: "Geist, sans-serif", fontSize: "0.88rem", fontWeight: 700, cursor: excluirConfirm === "EXCLUIR" ? "pointer" : "not-allowed" }}>
                      Excluir minha conta
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button className="cfg-btn-logout" onClick={handleLogout}>Sair</button>
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
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        {/* Faixa de perfil — gradiente rosa */}
        <div className="cfg-desk-profile-banner">
          <div className="cfg-desk-profile-left">
            <div className="cfg-hero-avatar cfg-hero-avatar--desk" onClick={() => !uploading && fileRef.current?.click()}>
              {preview
                ? <img src={preview} alt="foto" className="cfg-hero-img" />
                : <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
              <div className="cfg-hero-cam">
                {uploading
                  ? <span className="cfg-spinner-sm" />
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
              </div>
            </div>
            <div>
              <p className="cfg-desk-profile-name">{form.nome || "Seu nome"}</p>
              {form.nome_loja && <p className="cfg-desk-profile-loja">{form.nome_loja}</p>}
              <p className="cfg-desk-profile-email">{userEmail}</p>
              {plano === "pro"      && <span className="cfg-badge cfg-badge--pro-desk">✨ PRO ativo</span>}
              {plano === "trial"    && <span className="cfg-badge cfg-badge--trial-desk">Plano Grátis</span>}
              {plano === "expirado" && <span className="cfg-badge cfg-badge--exp-desk">⚠️ Expirado</span>}
            </div>
          </div>
        </div>

        {/* Grid 2 cards + espaço vazio */}
        <div className="cfg-desk-grid2">

          {/* ── Card 1 — Dados da loja ── */}
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
                <input type="email" value={userEmail} disabled style={{opacity:0.5,cursor:"not-allowed"}} />
              </div>
            </div>

            {/* Alterar Senha + Excluir Conta — mesma linha */}
            <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
              {!showAlterarSenha && !showExcluir && (
                <>
                  <button onClick={() => setShowAlterarSenha(true)} className="cfg-desk-inline-btn">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Alterar senha
                  </button>
                  <button onClick={() => setShowExcluir(true)} className="cfg-desk-inline-btn cfg-desk-inline-btn--danger">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    Excluir conta
                  </button>
                </>
              )}
            </div>

            {/* Painel Alterar Senha */}
            {showAlterarSenha && (
              <div className="cfg-desk-inline-section">
                <p className="cfg-desk-inline-label">🔒 Alterar Senha</p>
                <div className="cfg-desk-fields">
                  <div className="cfg-desk-field">
                    <label>Nova senha</label>
                    <input type="password" placeholder="Mínimo 6 caracteres" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
                  </div>
                  <div className="cfg-desk-field">
                    <label>Confirmar nova senha</label>
                    <input type="password" placeholder="Repita a senha" value={confirmSenha} onChange={e => setConfirmSenha(e.target.value)} />
                  </div>
                </div>
                {senhaMsg && <p style={{fontSize:"0.82rem",color:senhaMsg.startsWith("✓")?"var(--success)":"var(--error)",margin:0}}>{senhaMsg}</p>}
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={() => {setShowAlterarSenha(false);setNovaSenha("");setConfirmSenha("");setSenhaMsg("");}} className="cfg-btn-ghost" style={{flex:1}}>Cancelar</button>
                  <button onClick={handleAlterarSenha} disabled={savingSenha} className="cfg-btn-save" style={{flex:2,minHeight:"38px",fontSize:"0.85rem",borderRadius:"10px"}}>
                    {savingSenha ? <span className="cfg-spinner" /> : "Confirmar alteração"}
                  </button>
                </div>
              </div>
            )}

            {/* Painel Excluir Conta */}
            {showExcluir && (
              <div className="cfg-desk-inline-section cfg-desk-inline-section--danger">
                <p className="cfg-desk-inline-label" style={{color:"var(--error)"}}>🗑️ Excluir conta</p>
                <p style={{fontSize:"0.82rem",color:"var(--text-secondary)",margin:0}}>Esta ação é <strong>irreversível</strong>. Todos os seus dados serão removidos permanentemente.</p>
                <div className="cfg-desk-field">
                  <label>Digite <strong>EXCLUIR</strong> para confirmar</label>
                  <input type="text" placeholder="EXCLUIR" value={excluirConfirm} onChange={e => setExcluirConfirm(e.target.value)} style={{borderColor:excluirConfirm==="EXCLUIR"?"var(--error)":undefined}} />
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button onClick={() => {setShowExcluir(false);setExcluirConfirm("");}} className="cfg-btn-ghost" style={{flex:1}}>Cancelar</button>
                  <button onClick={handleExcluirConta} disabled={excluirConfirm!=="EXCLUIR"} style={{flex:2,padding:"0.6rem",background:excluirConfirm==="EXCLUIR"?"var(--error)":"var(--bg-body)",color:excluirConfirm==="EXCLUIR"?"var(--text-inverse)":"var(--text-muted)",border:"none",borderRadius:"10px",fontFamily:"Geist,sans-serif",fontSize:"0.85rem",fontWeight:600,cursor:excluirConfirm==="EXCLUIR"?"pointer":"not-allowed"}}>
                    Confirmar exclusão
                  </button>
                </div>
              </div>
            )}

            <button className="cfg-btn-save cfg-btn-save--sm" onClick={handleSave} disabled={saving||uploading} style={{alignSelf:"flex-start"}}>
              {saving ? <span className="cfg-spinner" /> : "Salvar alterações"}
            </button>
          </div>

          {/* ── Card 2 — Assinatura + Notificações ── */}
          <div style={{display:"flex",flexDirection:"column",gap:"1.25rem"}}>

            {/* Assinatura */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header">
                <span className="cfg-card-icon">💎</span>
                <span>Sua assinatura</span>
              </div>
              {plano === "pro" && (
                <div className="cfg-plan-info cfg-plan-info--pro">
                  <p className="cfg-plan-title">Plano PRO ativo</p>
                  <p className="cfg-plan-sub">Você tem acesso completo a todos os recursos do Doonly — Gestão para Confeitarias.</p>
                </div>
              )}
              {plano === "trial" && (
                <div className="cfg-plan-info cfg-plan-info--trial">
                  <p className="cfg-plan-title">Período gratuito</p>
                  <p className="cfg-plan-sub">Você tem <strong>{diasRestantes} dias restantes</strong> no seu período de teste.</p>
                </div>
              )}
              {plano === "expirado" && (
                <div className="cfg-plan-info cfg-plan-info--exp">
                  <p className="cfg-plan-title">Período expirado</p>
                  <p className="cfg-plan-sub">Seu período gratuito encerrou. Assine para continuar usando o Doonly.</p>
                </div>
              )}
            </div>

            {/* Configure seu Doonly */}
            {cfgProgress < 100 ? (
              <div className="cfg-desk-card" style={{marginBottom:"0.5rem"}}>
                <div className="cfg-card-header">
                  <span className="cfg-card-icon">🛠️</span>
                  <span>Configure seu Doonly</span>
                  <span style={{marginLeft:"auto",fontSize:"0.85rem",fontWeight:700,color:"var(--primary)"}}>{cfgProgress}%</span>
                </div>
                <div className="dash-progress-bar" style={{margin:"0.5rem 0 0.75rem"}}>
                  <div className="dash-progress-fill" style={{width:`${cfgProgress}%`}} />
                </div>
                {cfgNextStep && (
                  <div className="dash-next-step" style={{marginBottom:"0.75rem"}}>
                    <div>
                      <p style={{fontSize:"0.7rem",color:"var(--text-muted)",margin:0}}>Próximo passo</p>
                      <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text-title)",margin:0}}>{cfgNextStep.label}</p>
                    </div>
                    <button className="dash-btn-config" onClick={() => navigate(cfgNextStep.path)}>Configurar →</button>
                  </div>
                )}
                <div className="dash-steps">
                  {cfgSteps.map((group, gi) => {
                    const groupDone = group.items.filter(i => i.done).length;
                    const isOpen = openGroup === gi;
                    const allDone = groupDone === group.items.length;
                    return (
                      <div key={gi} className="step-group">
                        <button className="step-group-header" onClick={() => setOpenGroup(isOpen ? null : gi)}>
                          <div className="step-group-left"><span>{group.emoji}</span><span className="step-group-title">{group.title}</span></div>
                          <div className="step-group-right">
                            <span className={"step-badge" + (allDone ? " done" : "")}>{allDone ? "✓ Completo" : `${groupDone}/${group.items.length}`}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{transform:isOpen?"rotate(180deg)":"none",transition:"0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="step-items">
                            {group.items.map((item, ii) => (
                              <button key={ii} className="step-item" onClick={() => !item.done && navigate(item.path)}>
                                <div className={"step-check" + (item.done ? " checked" : "")}>
                                  {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                                <span className="step-item-label">{item.label}</span>
                                <span className={"step-status" + (item.done ? " done" : " pending")}>{item.done ? "Concluído" : "Fazer agora"}</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-disabled)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="complete-banner" style={{marginTop:"0.75rem"}}>🎁 Complete 100% e ganhe 3 dias de PRO grátis!</div>
              </div>
            ) : !proResgatado ? (
              <div className="cfg-desk-card" style={{marginBottom:"0.5rem",background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:"1px solid #bbf7d0"}}>
                <div style={{textAlign:"center",padding:"0.5rem 0"}}>
                  <p style={{fontSize:"1.5rem",margin:"0 0 0.25rem"}}>🎉</p>
                  <p style={{fontWeight:700,color:"#15803d",margin:"0 0 0.5rem"}}>Configuração completa!</p>
                  <button onClick={handleResgatarPro} disabled={resgatando} style={{padding:"0.6rem 1.2rem",background:"linear-gradient(135deg,#22c55e,#16a34a)",color:"white",border:"none",borderRadius:"10px",fontFamily:"inherit",fontSize:"0.88rem",fontWeight:700,cursor:"pointer"}}>
                    {resgatando ? "Ativando..." : "✨ Ativar PRO por 3 dias"}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Notificações */}
            <div className="cfg-desk-card">
              <div className="cfg-card-header">
                <span className="cfg-card-icon">🔔</span>
                <span>Notificações</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>

                {/* Botão push real */}
                <PushToggle />

                <div style={{borderTop:"1px solid var(--border)", paddingTop:"0.75rem"}}>
                {([
                  { key:"receitas",     label:"Novas receitas" },
                  { key:"comunidade",   label:"Comunidade" },
                  { key:"atualizacoes", label:"Atualizações do app" },
                ] as { key: keyof typeof notifs; label: string }[]).map(item => (
                  <div key={item.key} className="cfg-notif-row">
                    <p className="cfg-notif-label" style={{color: notifDesativar ? "var(--border)" : undefined}}>{item.label}</p>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={notifs[item.key]}
                        disabled={notifDesativar}
                        onChange={e => setNotifs(n => ({...n, [item.key]: e.target.checked}))}
                      />
                      <span className="toggle-slider" style={{opacity: notifDesativar ? 0.4 : 1}} />
                    </label>
                  </div>
                ))}
                </div>
                <div className="cfg-notif-row" style={{paddingTop:"0.5rem",borderTop:"1px solid var(--border)"}}>
                  <p className="cfg-notif-label" style={{color:"var(--text-muted)",fontSize:"0.82rem"}}>Não quero receber notificações</p>
                  <label className="toggle">
                    <input type="checkbox" checked={notifDesativar} onChange={e => toggleNotifDesativar(e.target.checked)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>
            </div>

          </div>

          {/* ── Card 3 — Link do cardápio + OG Image ── */}
          <div className="cfg-desk-card">
            <div className="cfg-card-header">
              <span className="cfg-card-icon">🔗</span>
              <span>Seu cardápio público</span>
            </div>

            {/* Link */}
            <div className="cfg-link-box">
              <p className="cfg-link-url">appconfeitaria.vercel.app/cardapio/{userId || '...'}</p>
              <div style={{display:"flex",gap:"0.5rem",marginTop:"0.75rem"}}>
                <button
                  className="cfg-desk-inline-btn"
                  style={{flex:1,justifyContent:"center"}}
                  onClick={() => {
                    navigator.clipboard.writeText(`https://appconfeitaria.vercel.app/cardapio/${userId}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied
                    ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copiado!</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar link</>
                  }
                </button>
                <button
                  className="cfg-desk-inline-btn"
                  style={{flex:1,justifyContent:"center"}}
                  onClick={() => window.open(`https://appconfeitaria.vercel.app/cardapio/${userId}`, '_blank')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Abrir cardápio
                </button>
              </div>
            </div>

            {/* OG Image */}
            <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
              <p className="cfg-og-label">Imagem de compartilhamento</p>
              <p className="cfg-og-hint">Aparece quando você compartilha o link no WhatsApp, Instagram e outros apps.</p>

              <div
                className={`cfg-og-upload${ogPreview ? " cfg-og-upload--has-img" : ""}`}
                onClick={() => ogFileRef.current?.click()}
              >
                {ogPreview
                  ? <img src={ogPreview} alt="og" className="cfg-og-img" />
                  : <div className="cfg-og-placeholder">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <p style={{fontSize:"0.78rem",color:"var(--text-muted)",margin:"0.4rem 0 0"}}>Clique para adicionar imagem</p>
                      <p style={{fontSize:"0.7rem",color:"var(--border)",margin:"0.15rem 0 0"}}>Recomendado: 1200 × 630px</p>
                    </div>
                }
                {ogUploading && (
                  <div className="cfg-og-uploading">
                    <span className="cfg-spinner" />
                  </div>
                )}
              </div>
              <input ref={ogFileRef} type="file" accept="image/*" onChange={handleOgFileChange} style={{display:"none"}} />
              {ogPreview && (
                <button
                  onClick={() => { setOgPreview(null); setForm(f => ({...f, og_image_url: ""})); }}
                  style={{fontSize:"0.75rem",color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}
                >
                  Remover imagem
                </button>
              )}
            </div>
          </div>

        </div>{/* fim cfg-desk-grid2 */}
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .cfg-loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; }
        .cfg-spinner-lg { width: 36px; height: 36px; border: 3px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .cfg-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .cfg-spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .cfg-hero-avatar { width: 72px; height: 72px; border-radius: 50%; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; flex-shrink: 0; }
        .cfg-hero-avatar--md { width: 64px; height: 64px; background: var(--bg-body); border: 2px solid var(--border); }
        .cfg-hero-img { width: 100%; height: 100%; object-fit: cover; }
        .cfg-hero-cam { position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.45); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 50% 0 0 0; }

        .cfg-field { display: flex; align-items: center; gap: 0.7rem; border: 1.5px solid var(--border); border-radius: var(--radius-full); padding: 0.65rem 1.1rem; background: var(--bg-input); transition: border-color 0.2s; min-width: 0; }
        .cfg-field:focus-within { border-color: var(--border-focus); }
        .cfg-field-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--text-muted); }
        .cfg-field-input { flex: 1; border: none; outline: none; font-family: 'Geist', sans-serif; font-size: var(--font-button); color: var(--text-primary); background: transparent; min-width: 0; }

        .cfg-toast { width: 100%; border-radius: var(--radius-md); padding: 0.7rem 1rem; font-size: var(--font-button); font-weight: var(--fw-medium); }
        .cfg-toast-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); }
        .cfg-toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: var(--success); }

        .cfg-btn-save { width: 100%; padding: 0.9rem; background: var(--primary-gradient); color: var(--text-inverse); border: none; border-radius: var(--radius-full); font-family: 'Geist', sans-serif; font-size: var(--font-input); font-weight: var(--fw-bold); cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 50px; transition: opacity 0.2s, transform 0.1s; }
        .cfg-btn-save:hover { opacity: 0.92; }
        .cfg-btn-save:active { transform: scale(0.98); }
        .cfg-btn-save:disabled { opacity: 0.65; cursor: not-allowed; }
        .cfg-btn-save--sm { width: auto; padding: 0.6rem 1.5rem; min-height: 40px; font-size: var(--font-button); border-radius: var(--radius-full); }

        .cfg-btn-logout { width: auto; padding: 0.5rem 0; background: none; border: none; font-family: 'Geist', sans-serif; font-size: var(--font-helper); font-weight: var(--fw-medium); color: var(--text-muted); cursor: pointer; transition: color 0.2s; margin-top: 0.5rem; }
        .cfg-btn-logout:hover { color: var(--error); }

        .cfg-adv-item {
          display: flex; align-items: center; gap: 0.65rem;
          width: 100%; padding: 0.7rem 0.25rem;
          background: none; border: none; cursor: pointer;
          font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-primary); text-align: left;
          transition: color 0.15s;
        }
        .cfg-adv-item:hover { color: var(--primary); }
        .cfg-adv-item--danger { color: var(--error); }
        .cfg-adv-item--danger:hover { color: var(--error); opacity: 0.8; }

        .cfg-btn-ghost { padding: 0.6rem 1rem; background: var(--bg-body); color: var(--text-secondary); border: none; border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-medium); cursor: pointer; }

        .cfg-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: var(--radius-sm); font-size: var(--font-caption); font-weight: var(--fw-semibold); width: fit-content; }

        /* ── Mobile ── */
        .cfg-mobile { display: flex; flex-direction: column; gap: 0.85rem; }
        .cfg-desktop { display: none; }

        .cfg-hero { background: var(--primary-gradient); border-radius: var(--radius-xl); padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 6px 20px rgba(255,111,169,0.25); }
        .cfg-hero-left { display: flex; flex-direction: column; align-items: flex-start; gap: 0; flex: 1; min-width: 0; }
        .cfg-hero-saudacao { font-size: var(--font-input); color: var(--text-inverse); margin: 0; font-weight: var(--fw-bold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cfg-badge-pro { background: rgba(255,255,255,0.25); color: var(--text-inverse); }
        .cfg-badge-trial { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cfg-badge-expirado { background: rgba(239,68,68,0.3); color: var(--text-inverse); }

        .cfg-accordion { background: var(--bg-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); overflow: hidden; }
        .cfg-accordion-header { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 1rem 1.15rem; background: none; border: none; cursor: pointer; font-family: 'Geist', sans-serif; text-align: left; }
        .cfg-accordion-icon { color: var(--text-muted); display: flex; align-items: center; }
        .cfg-accordion-title { flex: 1; font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--primary); text-transform: uppercase; letter-spacing: 0.07em; }
        .cfg-accordion-chevron { color: var(--text-muted); transition: transform 0.2s; flex-shrink: 0; }
        .cfg-accordion-chevron.open { transform: rotate(180deg); }
        .cfg-accordion-body { padding: 0 1.15rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem; border-top: 1px solid var(--border); padding-top: 1rem; }

        :root.dark .cfg-accordion { background: transparent; border-radius: 0; box-shadow: none; border-bottom: 1px solid var(--border); }
        :root.dark .cfg-accordion:first-of-type { border-top: 1px solid var(--border); }
        :root.dark .cfg-accordion-header { padding: 1rem 0; }
        :root.dark .cfg-accordion-body { padding: 0 0 1.25rem; border-top: 1px solid var(--border); padding-top: 1rem; }

        .cfg-toggle-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .cfg-toggle-label { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-primary); margin: 0; }
        .toggle { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; cursor: pointer; inset: 0; background: var(--border); border-radius: 26px; transition: 0.3s; }
        .toggle-slider:before { content: ""; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: var(--bg-card); border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
        .toggle input:checked + .toggle-slider { background: var(--primary); }
        .toggle input:checked + .toggle-slider:before { transform: translateX(20px); }

        /* ── Desktop ── */
        @media (min-width: 900px) {
          .cfg-mobile { display: none; }
          .cfg-desktop { display: block; }
        }

        .cfg-desk-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap; }
        .cfg-desk-h1 { font-size: var(--text-2xl); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.2rem; }
        .cfg-desk-sub { font-size: var(--font-button); color: var(--text-muted); margin: 0; }
        .cfg-desk-header-actions { display: flex; align-items: center; gap: 0.75rem; }

        .cfg-desk-profile-banner { background: var(--primary-gradient); border-radius: var(--radius-xl); padding: 1.5rem 1.75rem; box-shadow: 0 4px 20px rgba(255,111,169,0.35); display: flex; align-items: center; margin-bottom: 1.5rem; gap: 1.25rem; }
        .cfg-desk-profile-left { display: flex; align-items: center; gap: 1.25rem; }
        .cfg-desk-profile-name { font-size: var(--font-modal-title); font-weight: var(--fw-bold); color: var(--text-inverse); margin: 0; }
        .cfg-desk-profile-loja { font-size: var(--font-button); color: rgba(255,255,255,0.8); margin: 0.1rem 0 0; font-weight: var(--fw-medium); }
        .cfg-desk-profile-email { font-size: var(--font-helper); color: rgba(255,255,255,0.65); margin: 0.2rem 0 0.35rem; }
        .cfg-badge--pro-desk   { background: rgba(255,255,255,0.25); color: var(--text-inverse); border: 1px solid rgba(255,255,255,0.3); }
        .cfg-badge--trial-desk { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cfg-badge--exp-desk   { background: rgba(239,68,68,0.35); color: var(--text-inverse); }
        .cfg-hero-avatar--desk { width: 72px; height: 72px; background: rgba(255,255,255,0.2); border: 2.5px solid rgba(255,255,255,0.5); }

        .cfg-desk-grid2 { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 1.25rem; align-items: start; }

        .cfg-plan-info { border-radius: var(--radius-md); padding: 0.85rem 1rem; }
        .cfg-plan-info--pro   { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .cfg-plan-info--trial { background: var(--primary-light); border: 1px solid var(--primary-light); }
        .cfg-plan-info--exp   { background: #fff1f2; border: 1px solid #fecdd3; }
        .cfg-plan-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.25rem; }
        .cfg-plan-sub   { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; line-height: 1.5; }

        .cfg-notif-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .cfg-notif-label { font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-primary); margin: 0; }

        .cfg-link-box { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem 1rem; }
        .cfg-link-url { font-size: var(--font-helper); color: var(--text-secondary); margin: 0; word-break: break-all; font-family: inherit; }

        .cfg-og-label { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--text-primary); margin: 0; }
        .cfg-og-hint  { font-size: var(--font-helper); color: var(--text-muted); margin: 0; line-height: 1.5; }
        .cfg-og-upload { border: 2px dashed var(--border); border-radius: var(--radius-md); min-height: 120px; display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; transition: border-color 0.2s; background: var(--bg-subtle); }
        .cfg-og-upload:hover { border-color: var(--primary); }
        .cfg-og-upload--has-img { border-style: solid; border-color: var(--border); }
        .cfg-og-placeholder { display: flex; flex-direction: column; align-items: center; padding: 1.5rem; }
        .cfg-og-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cfg-og-uploading { position: absolute; inset: 0; background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center; }

        .cfg-desk-card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-card, 0 2px 12px rgba(0,0,0,0.06)); display: flex; flex-direction: column; gap: 1rem; border: 1px solid var(--border); }

        .cfg-card-header { display: flex; align-items: center; gap: 0.5rem; font-size: var(--font-input); font-weight: var(--fw-bold); color: var(--text-title); }
        .cfg-card-icon { font-size: var(--font-input); }

        .cfg-desk-fields { display: flex; flex-direction: column; gap: 0.75rem; }
        .cfg-desk-field { display: flex; flex-direction: column; gap: 0.28rem; }
        .cfg-desk-field label { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--text-primary); }
        .cfg-desk-field input { padding: 0.65rem 0.9rem; border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-size: var(--font-button); color: var(--text-title); background: var(--bg-input); outline: none; transition: border-color 0.2s; width: 100%; }
        .cfg-desk-field input:focus { border-color: var(--border-focus); }

        .cfg-desk-divider { border: none; border-top: 1px solid var(--border); margin: 0; }

        .cfg-desk-inline-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary-light); border-radius: var(--radius-md); font-family: 'Geist', sans-serif; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; width: fit-content; transition: background 0.2s; }
        .cfg-desk-inline-btn:hover { background: var(--bg-subtle); }
        .cfg-desk-inline-btn--danger { background: #fff1f2; color: var(--error); border-color: #fecdd3; }
        .cfg-desk-inline-btn--danger:hover { background: #fee2e2; }

        .cfg-desk-inline-section { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border); }
        .cfg-desk-inline-section--danger { background: #fff8f8; border-color: #fecdd3; }
        .cfg-desk-inline-label { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }

        /* ── Configure seu Doonly (mobile) ── */
        .mob-config-card {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 0.85rem;
        }
        .mob-config-card--done {
          background: linear-gradient(135deg, #fff 60%, #F7EEF1 100%);
          border-color: #3d1a24;
        }
        .mob-config-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .mob-config-title {
          font-size: var(--font-input);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }
        .mob-config-sub {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          margin: 2px 0 0;
          line-height: 1.35;
        }
        .mob-config-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #3d1a24;
          color: white;
          font-size: var(--font-helper);
          font-weight: var(--fw-black);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          letter-spacing: -0.02em;
        }
        .mob-config-bar-bg {
          width: 100%;
          height: 6px;
          background: var(--bg-subtle);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .mob-config-bar-fill {
          height: 100%;
          background: #3d1a24;
          border-radius: var(--radius-sm);
          transition: width var(--dur-slow) var(--ease-out);
        }
        .mob-config-next {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          padding: 0.65rem 0.85rem;
        }
        .mob-config-next-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0 0 2px;
        }
        .mob-config-next-text {
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          margin: 0;
        }
        .mob-config-next-btn {
          background: #3d1a24;
          border: none;
          color: white;
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.85rem;
          font-size: var(--font-helper);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .mob-resgatar-btn {
          background: #3d1a24;
          border: none;
          color: white;
          border-radius: var(--radius-md);
          padding: 0.75rem;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          font-family: inherit;
          width: 100%;
        }
        .mob-resgatar-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
