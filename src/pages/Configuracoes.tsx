import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { sonsHabilitados, setSonsHabilitados, tocarSom, somNotificacaoHabilitado, setSomNotificacaoHabilitado, somPedidoHabilitado, setSomPedidoHabilitado } from "@/hooks/useSom";
import SugestaoWizard from "@/components/SugestaoWizard";
import TermosModal from "@/components/TermosModal";
import EditarPerfilModal from "@/components/EditarPerfilModal";


// ── Componente inline: toggle de push notifications ──────────
function SomToggle() {
  const [ativo, setAtivo] = useState(sonsHabilitados());
  return (
    <div className="cfg-push-row">
      <div style={{ flex: 1 }}>
        <p className="cfg-notif-label">Sons do app</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {ativo ? 'Ativado — toca um som ao registrar vendas.' : 'Desativado — sem efeitos sonoros.'}
        </p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={ativo}
          onChange={() => {
            const novo = !ativo;
            setAtivo(novo);
            setSonsHabilitados(novo);
            if (novo) setTimeout(() => tocarSom('sucesso'), 100); // preview
          }}
        />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}

function SomNotificacaoToggle() {
  const [ativo, setAtivo] = useState(somNotificacaoHabilitado());
  const mestre = sonsHabilitados();
  return (
    <div className="cfg-push-row">
      <div style={{ flex: 1 }}>
        <p className="cfg-notif-label">Som de notificação</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {!mestre ? 'Desative "Sons do app" acima primeiro' : (ativo ? 'Ativado — toca ao chegar novidades.' : 'Desativado — notificações em silêncio.')}
        </p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={ativo && mestre}
          disabled={!mestre}
          onChange={() => {
            const novo = !ativo;
            setAtivo(novo);
            setSomNotificacaoHabilitado(novo);
            if (novo) setTimeout(() => tocarSom('notificacao'), 100);
          }}
        />
        <span className="toggle-slider" style={{ opacity: !mestre ? 0.4 : 1 }} />
      </label>
    </div>
  );
}

function SomPedidoToggle() {
  const [ativo, setAtivo] = useState(somPedidoHabilitado());
  const mestre = sonsHabilitados();
  return (
    <div className="cfg-push-row">
      <div style={{ flex: 1 }}>
        <p className="cfg-notif-label">Som de pedido novo</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {!mestre ? 'Desative "Sons do app" acima primeiro' : (ativo ? 'Ativado — toca ao registrar pedidos.' : 'Desativado — pedidos em silêncio.')}
        </p>
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={ativo && mestre}
          disabled={!mestre}
          onChange={() => {
            const novo = !ativo;
            setAtivo(novo);
            setSomPedidoHabilitado(novo);
            if (novo) setTimeout(() => tocarSom('pedido'), 100);
          }}
        />
        <span className="toggle-slider" style={{ opacity: !mestre ? 0.4 : 1 }} />
      </label>
    </div>
  );
}

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
        <p className="cfg-notif-label">Notificações push</p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {isSubscribed ? 'Ativado — você será avisada sobre novidades do Doonly.' : 'Ative para receber avisos de novidades e atualizações.'}
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem("doonly_profile_cache_v1");
    } catch {}
    navigate("/login");
  };

  const [showAlterarSenha, setShowAlterarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [showExcluir, setShowExcluir] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [sugestaoOpen, setSugestaoOpen] = useState(false);
  const [termosOpen, setTermosOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [excluirConfirm, setExcluirConfirm] = useState("");
  const [copied, setCopied] = useState(false);
  const [ogPreview, setOgPreview] = useState<string | null>(null);
  const [ogUploading, setOgUploading] = useState(false);
  const ogFileRef = useRef<HTMLInputElement>(null);

  const handleAlterarSenha = async () => {
    if (!senhaAtual) return setSenhaMsg("Digite sua senha atual.");
    if (novaSenha.length < 6) return setSenhaMsg("A nova senha deve ter ao menos 6 caracteres.");
    if (novaSenha !== confirmSenha) return setSenhaMsg("As senhas não coincidem.");
    if (novaSenha === senhaAtual) return setSenhaMsg("A nova senha deve ser diferente da atual.");
    if (!userEmail) return setSenhaMsg("Sessão inválida. Faça login novamente.");
    setSavingSenha(true);

    // 1) Valida senha atual (reautenticação)
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: senhaAtual,
    });
    if (reauthErr) {
      setSavingSenha(false);
      return setSenhaMsg("Senha atual incorreta.");
    }

    // 2) Troca a senha
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      setSavingSenha(false);
      return setSenhaMsg("Erro ao alterar senha. Tente novamente.");
    }

    // 3) Desloga as outras sessões (mantém só a atual). Silencioso se falhar.
    try {
      await supabase.auth.signOut({ scope: "others" });
    } catch {}

    setSavingSenha(false);
    setSenhaMsg("✓ Senha alterada com sucesso! Outros dispositivos foram deslogados.");
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmSenha("");
    setTimeout(() => { setSenhaMsg(""); setShowAlterarSenha(false); }, 3000);
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
    if (err) { setError("Erro ao salvar. Tente novamente."); }
    else {
      // Sincroniza tb no user_metadata (usado pelo Supabase Auth Admin)
      try {
        await supabase.auth.updateUser({ data: { nome: form.nome, telefone: form.telefone } });
      } catch {}
      setSuccess(true); setNomeSalvo(form.nome); await refreshProfile(); setTimeout(() => setSuccess(false), 3000);
    }
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
        {/* ── HERO USER ────────────────────────────────────── */}
        <div className="cfgp-hero">
          <div className="cfgp-hero-avatar" onClick={() => !uploading && fileRef.current?.click()}>
            <div className="cfgp-hero-avatar-inner">
              {preview
                ? <img src={preview} alt="Perfil" />
                : <span className="cfgp-hero-inicial">{(form.nome || "?").trim().charAt(0).toUpperCase()}</span>
              }
            </div>
            <div className="cfgp-hero-cam">
              {uploading
                ? <span className="cfg-spinner-sm" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
            </div>
          </div>
          <div className="cfgp-hero-info">
            <div className="cfgp-hero-nome">{form.nome || "Bem-vinda"}</div>
            <div className="cfgp-hero-email">{userEmail}</div>
          </div>
          <button className="cfgp-hero-edit" onClick={() => setEditarOpen(true)} aria-label="Editar perfil">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>

        {/* ── CARD ASSINATURA ──────────────────────────────── */}
        <div className="cfgp-card cfgp-sub">
          <div className="cfgp-sub-top">
            <div>
              <div className="cfgp-sub-label">Sua assinatura</div>
              <div className="cfgp-sub-plan">
                {plano === "pro" && <span className="cfgp-sub-plan-name">Plano PRO</span>}
                {plano === "trial" && <span className="cfgp-sub-plan-name">Plano Grátis</span>}
                {plano === "expirado" && <span className="cfgp-sub-plan-name">Plano expirado</span>}
                {plano === "pro" && <span className="cfgp-sub-badge cfgp-sub-badge--pro">ATIVO</span>}
                {plano === "trial" && <span className="cfgp-sub-badge cfgp-sub-badge--trial">TRIAL</span>}
                {plano === "expirado" && <span className="cfgp-sub-badge cfgp-sub-badge--exp">EXPIRADO</span>}
              </div>
            </div>
            <span className="cfgp-sub-crown"><img src="/coroa.png" alt="" /></span>
          </div>

          {plano === "trial" && (
            <div className="cfgp-sub-info">
              Aproveite todas as funcionalidades no seu período grátis. Ative o PRO pra continuar sem interrupções.
            </div>
          )}
          {plano === "expirado" && (
            <div className="cfgp-sub-info cfgp-sub-info--danger">
              Seu período grátis acabou. Ative o PRO pra reativar todas as funcionalidades.
            </div>
          )}
          {plano === "pro" && (
            <div className="cfgp-sub-info">
              Você tem acesso a todas as funcionalidades. Obrigada por apoiar o Doonly! 💖
            </div>
          )}

          {plano !== "pro" && (
            <button className="cfgp-sub-cta" onClick={() => navigate("/assinar")}>
              <img src="/coroa.png" alt="" />
              <span>Ativar PRO por R$ 29,90/mês</span>
            </button>
          )}
          {plano === "pro" && (
            <button className="cfgp-sub-cta cfgp-sub-cta--manage" onClick={() => navigate("/assinar")}>
              Gerenciar assinatura
            </button>
          )}
        </div>

        {/* ── AÇÕES RÁPIDAS ──────────────────────────────── */}
        <div className="cfgp-card cfgp-quick">
          <div className="cfgp-quick-hdr">
            <div className="cfgp-quick-title">Ações rápidas</div>
            <div className="cfgp-quick-sub">Suporte, sugestões e indicações</div>
          </div>
          <div className="cfgp-quick-list">
            <button className="cfgp-quick-item" onClick={() => navigate("/indicar")}>
              <span className="cfgp-quick-ico cfgp-quick-ico--pink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Convide para o Doonly</div>
                <div className="cfgp-quick-desc">Ganhe prêmios por cada assinante indicada</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgp-quick-item" onClick={() => setSugestaoOpen(true)}>
              <span className="cfgp-quick-ico cfgp-quick-ico--amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Enviar uma sugestão</div>
                <div className="cfgp-quick-desc">Conte o que falta ou o que melhoraria</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgp-quick-item" onClick={() => alert("🚀 Em breve! Você poderá relatar problemas por aqui.")}>
              <span className="cfgp-quick-ico cfgp-quick-ico--red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2"/><path d="M5 7l3 2"/><path d="M19 13h-3"/><path d="M8 13H5"/><path d="M19 19l-3-2"/><path d="M5 19l3-2"/><path d="M12 6V3"/><path d="M10 3h4"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Relatar um problema</div>
                <div className="cfgp-quick-desc">Algo não funcionou? Conte para a equipe</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgp-quick-item" onClick={() => alert("💬 Em breve! Chat de suporte a caminho.")}>
              <span className="cfgp-quick-ico cfgp-quick-ico--blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Fale com o suporte</div>
                <div className="cfgp-quick-desc">Abra uma conversa com a equipe</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgp-quick-item" onClick={() => alert("🚀 Central de ajuda em breve!")}>
              <span className="cfgp-quick-ico cfgp-quick-ico--gray">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Central de ajuda</div>
                <div className="cfgp-quick-desc">Perguntas frequentes e tutoriais</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgp-quick-item cfgp-quick-item--last" onClick={() => setTermosOpen(true)}>
              <span className="cfgp-quick-ico cfgp-quick-ico--gray">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              <div className="cfgp-quick-info">
                <div className="cfgp-quick-name">Termos e privacidade</div>
                <div className="cfgp-quick-desc">Nossos termos de uso e políticas</div>
              </div>
              <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        {/* ── SAIR + EXCLUIR ──────────────────────────────── */}
        <button className="cfgp-logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair da conta
        </button>

        <div className="cfgp-delete-link">
          {!showExcluir ? (
            <button className="cfgp-delete-link-btn" onClick={() => setShowExcluir(true)}>
              Não quer mais usar? <span>Excluir minha conta</span>
            </button>
          ) : (
            <div className="cfgp-delete-panel">
              <p className="cfgp-delete-warn">⚠️ Esta ação é permanente. Digite <b>EXCLUIR</b> para confirmar.</p>
              <Field icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>} placeholder="Digite EXCLUIR" value={excluirConfirm} onChange={(e: any) => setExcluirConfirm(e.target.value)} />
              <div className="cfgp-delete-actions">
                <button className="cfgp-delete-cancel" onClick={() => { setShowExcluir(false); setExcluirConfirm(""); }}>Cancelar</button>
                <button className="cfgp-delete-confirm" onClick={handleExcluirConta} disabled={excluirConfirm !== "EXCLUIR"}>Excluir permanentemente</button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ─────────────── DESKTOP ─────────────── */}
      <div className="cfgd-desktop">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />

        {/* ── HERO USER (branco/neutro) ─────────────────────── */}
        <div className="cfgd-hero">
          <div className="cfgd-hero-avatar" onClick={() => !uploading && fileRef.current?.click()}>
            <div className="cfgd-hero-avatar-inner">
              {preview
                ? <img src={preview} alt="Perfil" />
                : <span className="cfgd-hero-inicial">{(form.nome || "?").trim().charAt(0).toUpperCase()}</span>
              }
            </div>
            <div className="cfgd-hero-cam">
              {uploading
                ? <span className="cfg-spinner-sm" />
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}
            </div>
          </div>
          <div className="cfgd-hero-info">
            <div className="cfgd-hero-nome">{form.nome || "Seu nome"}</div>
            <div className="cfgd-hero-email">{userEmail}</div>
          </div>
          <button className="cfgd-hero-edit" onClick={() => setEditarOpen(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Editar perfil
          </button>
        </div>

        {/* ── CARD ASSINATURA ──────────────────────────────── */}
        <div className="cfgd-card cfgd-sub">
          <div className="cfgd-sub-top">
            <div>
              <div className="cfgd-sub-label">Sua assinatura</div>
              <div className="cfgd-sub-plan">
                {plano === "pro" && <span className="cfgd-sub-plan-name">Plano PRO</span>}
                {plano === "trial" && <span className="cfgd-sub-plan-name">Plano Grátis</span>}
                {plano === "expirado" && <span className="cfgd-sub-plan-name">Plano expirado</span>}
                {plano === "pro" && <span className="cfgd-sub-badge cfgd-sub-badge--pro">ATIVO</span>}
                {plano === "trial" && <span className="cfgd-sub-badge cfgd-sub-badge--trial">TRIAL</span>}
                {plano === "expirado" && <span className="cfgd-sub-badge cfgd-sub-badge--exp">EXPIRADO</span>}
              </div>
            </div>
            <span className="cfgd-sub-crown"><img src="/coroa.png" alt="" /></span>
          </div>

          {plano === "trial" && (
            <div className="cfgd-sub-info">
              Aproveite todas as funcionalidades no seu período grátis. Ative o PRO pra continuar sem interrupções.
            </div>
          )}
          {plano === "expirado" && (
            <div className="cfgd-sub-info cfgd-sub-info--danger">
              Seu período grátis acabou. Ative o PRO pra reativar todas as funcionalidades.
            </div>
          )}
          {plano === "pro" && (
            <div className="cfgd-sub-info">
              Você tem acesso a todas as funcionalidades. Obrigada por apoiar o Doonly! 💖
            </div>
          )}

          {plano !== "pro" && (
            <button className="cfgd-sub-cta" onClick={() => navigate("/assinar")}>
              <img src="/coroa.png" alt="" />
              <span>Ativar PRO por R$ 29,90/mês</span>
            </button>
          )}
          {plano === "pro" && (
            <button className="cfgd-sub-cta cfgd-sub-cta--manage" onClick={() => navigate("/assinar")}>
              Gerenciar assinatura
            </button>
          )}
        </div>

        {/* ── AÇÕES RÁPIDAS ──────────────────────────────── */}
        <div className="cfgd-card cfgd-quick">
          <div className="cfgd-quick-hdr">
            <div className="cfgd-quick-title">Ações rápidas</div>
            <div className="cfgd-quick-sub">Suporte, sugestões e indicações</div>
          </div>
          <div className="cfgd-quick-list">
            <button className="cfgd-quick-item" onClick={() => navigate("/indicar")}>
              <span className="cfgd-quick-ico cfgd-quick-ico--pink">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Convide para o Doonly</div>
                <div className="cfgd-quick-desc">Ganhe prêmios por cada assinante indicada</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgd-quick-item" onClick={() => setSugestaoOpen(true)}>
              <span className="cfgd-quick-ico cfgd-quick-ico--amber">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Enviar uma sugestão</div>
                <div className="cfgd-quick-desc">Conte o que falta ou o que melhoraria</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgd-quick-item" onClick={() => alert("🚀 Em breve! Você poderá relatar problemas por aqui.")}>
              <span className="cfgd-quick-ico cfgd-quick-ico--red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2"/><path d="M5 7l3 2"/><path d="M19 13h-3"/><path d="M8 13H5"/><path d="M19 19l-3-2"/><path d="M5 19l3-2"/><path d="M12 6V3"/><path d="M10 3h4"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Relatar um problema</div>
                <div className="cfgd-quick-desc">Algo não funcionou? Conte para a equipe</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgd-quick-item" onClick={() => alert("💬 Em breve! Chat de suporte a caminho.")}>
              <span className="cfgd-quick-ico cfgd-quick-ico--blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Fale com o suporte</div>
                <div className="cfgd-quick-desc">Abra uma conversa com a equipe</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgd-quick-item" onClick={() => alert("🚀 Central de ajuda em breve!")}>
              <span className="cfgd-quick-ico cfgd-quick-ico--gray">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Central de ajuda</div>
                <div className="cfgd-quick-desc">Perguntas frequentes e tutoriais</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button className="cfgd-quick-item cfgd-quick-item--last" onClick={() => setTermosOpen(true)}>
              <span className="cfgd-quick-ico cfgd-quick-ico--gray">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              <div className="cfgd-quick-info">
                <div className="cfgd-quick-name">Termos e privacidade</div>
                <div className="cfgd-quick-desc">Nossos termos de uso e políticas</div>
              </div>
              <svg className="cfgd-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        {/* ── SAIR + EXCLUIR ──────────────────────────────── */}
        <button className="cfgd-logout" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair da conta
        </button>

        <div className="cfgd-delete-link">
          {!showExcluir ? (
            <button className="cfgd-delete-link-btn" onClick={() => setShowExcluir(true)}>
              Não quer mais usar? <span>Excluir minha conta</span>
            </button>
          ) : (
            <div className="cfgd-delete-panel">
              <p className="cfgd-delete-warn">⚠️ Esta ação é permanente. Digite <b>EXCLUIR</b> para confirmar.</p>
              <input type="text" placeholder="Digite EXCLUIR" value={excluirConfirm} onChange={e => setExcluirConfirm(e.target.value)} className="cfgd-delete-input" />
              <div className="cfgd-delete-actions">
                <button className="cfgd-delete-cancel" onClick={() => { setShowExcluir(false); setExcluirConfirm(""); }}>Cancelar</button>
                <button className="cfgd-delete-confirm" onClick={handleExcluirConta} disabled={excluirConfirm !== "EXCLUIR"}>Excluir permanentemente</button>
              </div>
            </div>
          )}
        </div>

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
        .cfg-field-disabled { background: #F0EBED; border-color: #E8E5DC; cursor: not-allowed; }
        .cfg-field-disabled .cfg-field-icon { color: #B4B2A9; }
        .cfg-field-disabled .cfg-field-input { color: #888780; cursor: not-allowed; }
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
        .cfgd-desktop { display: none; }

        .cfg-hero { background: var(--primary-gradient); border-radius: var(--radius-xl); padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 6px 20px rgba(255,111,169,0.25); }
        .cfg-hero-left { display: flex; flex-direction: column; align-items: flex-start; gap: 0; flex: 1; min-width: 0; }
        .cfg-hero-saudacao { font-size: var(--font-input); color: var(--text-inverse); margin: 0; font-weight: var(--fw-bold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cfg-badge-pro { background: rgba(255,255,255,0.25); color: var(--text-inverse); }
        .cfg-badge-trial { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
        .cfg-badge-expirado { background: rgba(239,68,68,0.3); color: var(--text-inverse); }

        /* ====== NOVA CONFIGURAÇÕES PESSOAIS (mobile) ====== */
        .cfg-mobile {
          padding: 12px;
          background: #F5F3EF;
          min-height: 100vh;
          box-sizing: border-box;
          font-family: var(--font-base) !important;
          /* Estende até as bordas do parent (compensa padding do .layout-main) */
          margin: calc(-1 * var(--space-2, 8px));
          /* Compensa também padding-top e padding-bottom pra ir do topo ao bottom nav */
          margin-top: calc(-1 * (var(--pad-page-top, 1rem) + env(safe-area-inset-top, 0px)));
          margin-bottom: -6.5rem;
          padding-top: calc(12px + var(--pad-page-top, 1rem) + env(safe-area-inset-top, 0px));
          padding-bottom: calc(12px + 6.5rem);
        }
        .cfg-mobile * { font-family: var(--font-base) !important; }
        .cfg-mobile .cfgp-card { background: #fff; border: 1px solid #F0EBED; border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
        .cfg-mobile .cfgp-card:last-of-type { margin-bottom: 8px; }

        /* Hero */
        .cfgp-hero { background: linear-gradient(135deg, #E85A8C 0%, #C33A6E 100%); border-radius: 14px; padding: 18px 16px; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 14px; }
        .cfgp-hero-avatar { width: 60px; height: 60px; border-radius: 50%; flex-shrink: 0; cursor: pointer; position: relative; }
        .cfgp-hero-avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.35); display: flex; align-items: center; justify-content: center; }
        .cfgp-hero-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cfgp-hero-inicial { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; color: #fff; }
        .cfgp-hero-cam { position: absolute; bottom: -2px; right: -2px; width: 24px; height: 24px; border-radius: 50%; background: #993556; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .cfgp-hero-info { flex: 1; min-width: 0; }
        .cfgp-hero-nome { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
        .cfgp-hero-email { font-size: 13px; opacity: 0.9; margin-top: 4px; word-break: break-all; }
        .cfgp-hero-edit {
          all: unset;
          cursor: pointer;
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.12s ease;
        }
        .cfgp-hero-edit:hover { background: rgba(255, 255, 255, 0.28); transform: translateY(-1px); }
        .cfgp-hero-edit:active { transform: translateY(1px); }

        /* Card assinatura */
        .cfgp-sub { padding: 16px 18px; }
        .cfgp-sub-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 12px; }
        .cfgp-sub-label { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #888780; text-transform: uppercase; }
        .cfgp-sub-plan { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .cfgp-sub-plan-name { font-size: 20px; font-weight: 900; color: #2C2C2A; letter-spacing: -0.02em; }
        .cfgp-sub-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; letter-spacing: 0.04em; }
        .cfgp-sub-badge--pro { background: #DCFCE7; color: #166534; }
        .cfgp-sub-badge--trial { background: #FEF0DF; color: #854F0B; }
        .cfgp-sub-badge--exp { background: #FEE2E2; color: #B91C1C; }
        .cfgp-sub-crown { width: 40px; height: 40px; border-radius: 12px; background: #FCE0E9; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cfgp-sub-crown img { width: 22px; height: 22px; object-fit: contain; }
        .cfgp-sub-info { background: #F8F5F1; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; font-size: 12.5px; color: #5F5E5A; line-height: 1.5; }
        .cfgp-sub-info--danger { background: #FEE2E2; color: #B91C1C; }
        .cfgp-sub-cta {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          padding: 13px;
          background: #E85A8C;
          color: #fff;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          font-family: var(--font-base) !important;
          box-shadow: 0 4px 14px rgba(232, 90, 140, 0.28), inset 0 -2px 0 rgba(0,0,0,0.08);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .cfgp-sub-cta:hover { background: #C33A6E; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(232, 90, 140, 0.35), inset 0 -2px 0 rgba(0,0,0,0.08); }
        .cfgp-sub-cta:active { transform: translateY(1px); box-shadow: 0 2px 6px rgba(232, 90, 140, 0.25), inset 0 -1px 0 rgba(0,0,0,0.06); }
        .cfgp-sub-cta img { width: 16px; height: 16px; object-fit: contain; }
        .cfgp-sub-cta--manage {
          background: transparent;
          color: #E85A8C;
          border: 1.5px solid #E85A8C;
          box-shadow: none;
        }
        .cfgp-sub-cta--manage:hover { background: #FCE0E9; box-shadow: 0 4px 10px rgba(232, 90, 140, 0.18); }

        /* Blocos */
        .cfgp-block-hdr { padding: 12px 18px 6px; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; color: #888780; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
        .cfgp-edit-btn { all: unset; cursor: pointer; font-size: 11px; font-weight: 700; color: #E85A8C; letter-spacing: 0.04em; text-transform: uppercase; font-family: var(--font-base) !important; transition: color 0.15s ease; }
        .cfgp-edit-btn:hover { color: #C33A6E; }

        .cfgp-rows { padding: 0 0 8px; }
        .cfgp-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; gap: 12px; font-size: 13px; color: #2C2C2A; }
        .cfgp-row--last { }
        .cfgp-row-l { display: flex; align-items: center; gap: 8px; color: #5F5E5A; min-width: 0; }
        .cfgp-row-l svg { color: #B4B2A9; flex-shrink: 0; }
        .cfgp-row-v { font-weight: 600; color: #2C2C2A; text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cfgp-row-v--muted { color: #888780; font-weight: 500; font-size: 12px; }
        .cfgp-row-btn { all: unset; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 12px 18px; cursor: pointer; transition: background 0.15s ease; font-family: var(--font-base) !important; font-size: 13px; color: #2C2C2A; }
        .cfgp-row-btn:hover { background: #FAF8F5; }
        .cfgp-rows .cfgp-row-btn { padding: 12px 18px; }
        .cfgp-chevron { color: #B4B2A9; transition: transform 0.2s ease; flex-shrink: 0; }
        .cfgp-chevron.open { transform: rotate(90deg); }
        .cfgp-chevron--danger { color: #F09595; }

        .cfgp-fields { padding: 0 18px 14px; display: flex; flex-direction: column; gap: 8px; }
        .cfgp-fields > *:first-child { margin-top: 4px; }

        .cfgp-footer { text-align: center; font-size: 10.5px; color: #B4B2A9; margin: 12px 0 4px; }
        .cfgp-hint { font-size: 11px; color: #888780; margin: -4px 0 0; padding: 0 4px; line-height: 1.4; font-style: italic; }
        .cfgp-toggles { padding: 4px 18px 12px; }
        .cfgp-toggles .cfg-push-row { padding: 12px 0; gap: 12px; }
        .cfgp-toggles .cfg-push-row:last-child { }
        .cfgp-toggles .cfg-notif-label { font-size: 13px; font-weight: 600; color: #2C2C2A; margin: 0 0 2px; }

        /* ─── Ações rápidas ─── */
        .cfgp-quick { padding: 4px 0 4px; }
        .cfgp-quick-hdr { padding: 14px 18px 10px; }
        .cfgp-quick-title { font-size: 17px; font-weight: 800; color: #2C2C2A; letter-spacing: -0.01em; }
        .cfgp-quick-sub { font-size: 12.5px; color: #888780; margin-top: 3px; }
        .cfgp-quick-list { display: flex; flex-direction: column; }
        .cfgp-quick-item {
          all: unset;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 18px;
          cursor: pointer;
          font-family: var(--font-base) !important;
          transition: background 0.15s ease;
        }
        .cfgp-quick-item:hover { background: #FAF8F5; }
        .cfgp-quick-ico {
          width: 40px; height: 40px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cfgp-quick-ico--pink  { background: #FCE0E9; color: #993556; }
        .cfgp-quick-ico--amber { background: #FEF0DF; color: #854F0B; }
        .cfgp-quick-ico--red   { background: #FEE2E2; color: #B91C1C; }
        .cfgp-quick-ico--blue  { background: #E6F1FB; color: #185FA5; }
        .cfgp-quick-ico--gray  { background: #F0EBED; color: #5F5E5A; }
        .cfgp-quick-info { flex: 1; min-width: 0; text-align: left; }
        .cfgp-quick-name { font-size: 14px; font-weight: 700; color: #2C2C2A; letter-spacing: -0.01em; line-height: 1.2; }
        .cfgp-quick-desc { font-size: 12px; color: #888780; margin-top: 3px; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
        .cfgp-quick-arrow { color: #B4B2A9; flex-shrink: 0; }

        /* Sair da conta — botão neutro 3D */
        .cfgp-logout {
          all: unset;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 13px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          color: #2C2C2A;
          font-weight: 700;
          font-family: var(--font-base) !important;
          margin-bottom: 12px;
          box-shadow: 0 3px 10px rgba(20, 12, 18, 0.08), inset 0 -2px 0 rgba(0,0,0,0.03);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .cfgp-logout:hover { background: #FAF8F5; border-color: #E8E5DC; transform: translateY(-1px); box-shadow: 0 5px 14px rgba(20, 12, 18, 0.12), inset 0 -2px 0 rgba(0,0,0,0.03); }
        .cfgp-logout:active { transform: translateY(1px); box-shadow: 0 1px 4px rgba(20, 12, 18, 0.08), inset 0 -1px 0 rgba(0,0,0,0.03); }
        .cfgp-logout svg { color: #5F5E5A; }

        /* Excluir conta — link discreto */
        .cfgp-delete-link {
          text-align: center;
          padding: 4px 0 8px;
        }
        .cfgp-delete-link-btn {
          all: unset;
          cursor: pointer;
          font-size: 11.5px;
          color: #B4B2A9;
          font-family: var(--font-base) !important;
          transition: color 0.15s ease;
        }
        .cfgp-delete-link-btn:hover { color: #888780; }
        .cfgp-delete-link-btn span {
          color: #B91C1C;
          font-weight: 600;
          text-decoration: underline;
          text-decoration-color: #F09595;
          text-underline-offset: 2px;
        }

        /* Painel de confirmação de exclusão */
        .cfgp-delete-panel {
          background: #fff;
          border: 1px solid #FCEBEB;
          border-radius: 12px;
          padding: 14px;
          text-align: left;
        }
        .cfgp-delete-warn {
          font-size: 12px;
          color: #B91C1C;
          margin: 0 0 10px;
          line-height: 1.4;
        }
        .cfgp-delete-actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        .cfgp-delete-cancel {
          all: unset;
          flex: 1;
          text-align: center;
          padding: 11px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: #5F5E5A;
          background: #F5F3EF;
          cursor: pointer;
          font-family: var(--font-base) !important;
          box-shadow: 0 2px 6px rgba(20, 12, 18, 0.06);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .cfgp-delete-cancel:hover { background: #E8E5DC; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(20, 12, 18, 0.1); }
        .cfgp-delete-cancel:active { transform: translateY(1px); box-shadow: 0 1px 3px rgba(20, 12, 18, 0.06); }
        .cfgp-delete-confirm {
          all: unset;
          flex: 1;
          text-align: center;
          padding: 11px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: #fff;
          background: #B91C1C;
          cursor: pointer;
          font-family: var(--font-base) !important;
          box-shadow: 0 4px 12px rgba(185, 28, 28, 0.28), inset 0 -2px 0 rgba(0,0,0,0.1);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .cfgp-delete-confirm:hover { background: #991616; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(185, 28, 28, 0.35), inset 0 -2px 0 rgba(0,0,0,0.1); }
        .cfgp-delete-confirm:active { transform: translateY(1px); box-shadow: 0 2px 6px rgba(185, 28, 28, 0.25), inset 0 -1px 0 rgba(0,0,0,0.08); }
        .cfgp-delete-confirm:disabled {
          background: #F0EBED;
          color: #B4B2A9;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

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
        /* ═══════════════════════════════════════════════════ */
        /* ═══  DESKTOP NOVO — espelha mobile               ═══ */
        /* ═══════════════════════════════════════════════════ */

        /* Hero user — sem gradient rosa, neutro */
        .cfgd-hero {
          display: flex; align-items: center; gap: 18px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          padding: 20px 22px;
        }
        .cfgd-hero-avatar {
          width: 68px; height: 68px; border-radius: 50%;
          background: linear-gradient(135deg, #FCE0E9, #F0D8DE);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }
        .cfgd-hero-avatar-inner {
          width: 100%; height: 100%; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .cfgd-hero-avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
        .cfgd-hero-inicial { font-size: 26px; font-weight: 800; color: #C33A6E; }
        .cfgd-hero-cam {
          position: absolute; bottom: 0; right: 0;
          width: 22px; height: 22px;
          background: rgba(0,0,0,0.55);
          border-radius: 50% 0 0 0;
          display: flex; align-items: center; justify-content: center;
        }
        .cfgd-hero-info { flex: 1; min-width: 0; }
        .cfgd-hero-nome { font-size: 16px; font-weight: 800; color: #2C1219; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cfgd-hero-email { font-size: 12.5px; color: #6B7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cfgd-hero-edit {
          background: #FFF5F9;
          border: 1px solid #F0D8DE;
          color: #C33A6E;
          padding: 9px 14px;
          border-radius: 8px;
          font-size: 12.5px; font-weight: 700;
          cursor: pointer;
          display: inline-flex; align-items: center; gap: 6px;
          font-family: inherit;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .cfgd-hero-edit:hover { background: #E85A8C; color: #fff; border-color: #E85A8C; }

        /* Card base */
        .cfgd-card {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          padding: 20px;
        }

        /* Assinatura */
        .cfgd-sub-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; gap: 12px; }
        .cfgd-sub-label { font-size: 11px; font-weight: 800; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; }
        .cfgd-sub-plan { display: flex; align-items: center; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
        .cfgd-sub-plan-name { font-size: 19px; font-weight: 800; color: #2C1219; }
        .cfgd-sub-badge { padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 800; letter-spacing: 0.05em; }
        .cfgd-sub-badge--pro { background: #DCFCE7; color: #15803D; }
        .cfgd-sub-badge--trial { background: #FEF3C7; color: #B45309; }
        .cfgd-sub-badge--exp { background: #FEE2E2; color: #DC2626; }
        .cfgd-sub-crown {
          width: 44px; height: 44px;
          background: #FEF3C7;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cfgd-sub-crown img { width: 28px; height: 28px; object-fit: contain; }
        .cfgd-sub-info {
          background: #FFF5F9;
          border-radius: 8px;
          padding: 11px 14px;
          font-size: 12.5px;
          color: #4B5563;
          line-height: 1.5;
          margin-bottom: 12px;
        }
        .cfgd-sub-info--danger { background: #FEE2E2; color: #991B1B; }
        .cfgd-sub-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #FFC947, #DDAA00);
          color: #2C1219;
          border: none; border-radius: 10px;
          font-size: 13.5px; font-weight: 800;
          cursor: pointer;
          box-shadow: 0 3px 0 #B58900;
          font-family: inherit;
          transition: transform 0.1s;
        }
        .cfgd-sub-cta:active { transform: translateY(2px); box-shadow: 0 1px 0 #B58900; }
        .cfgd-sub-cta img { width: 20px; height: 20px; object-fit: contain; }
        .cfgd-sub-cta--manage {
          background: #F5F0F2;
          color: #4B5563;
          box-shadow: 0 3px 0 #D1C7CC;
        }

        /* Ações rápidas */
        .cfgd-quick-hdr { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #F5F0F2; }
        .cfgd-quick-title { font-size: 15px; font-weight: 800; color: #2C1219; }
        .cfgd-quick-sub { font-size: 12px; color: #6B7280; margin-top: 2px; }
        .cfgd-quick-list { display: flex; flex-direction: column; }
        .cfgd-quick-item {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 8px;
          border-bottom: 1px solid #F5F0F2;
          cursor: pointer;
          font-family: inherit;
          width: 100%;
          transition: background 0.15s;
          border-radius: 8px;
        }
        .cfgd-quick-item--last, .cfgd-quick-item:last-child { border-bottom: none; }
        .cfgd-quick-item:hover { background: #FFF5F9; }
        .cfgd-quick-ico {
          width: 36px; height: 36px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cfgd-quick-ico--pink { background: #FCE0E9; color: #C33A6E; }
        .cfgd-quick-ico--amber { background: #FEF3C7; color: #B45309; }
        .cfgd-quick-ico--red { background: #FEE2E2; color: #DC2626; }
        .cfgd-quick-ico--blue { background: #DBEAFE; color: #1D4ED8; }
        .cfgd-quick-ico--gray { background: #F3F4F6; color: #4B5563; }
        .cfgd-quick-info { flex: 1; min-width: 0; }
        .cfgd-quick-name { font-size: 13.5px; font-weight: 700; color: #2C1219; }
        .cfgd-quick-desc { font-size: 11.5px; color: #6B7280; margin-top: 2px; }
        .cfgd-quick-arrow { color: #C0B3B8; flex-shrink: 0; }

        /* Sair */
        .cfgd-logout {
          background: #fff;
          border: 1px solid #F0EBED;
          color: #4B5563;
          padding: 13px;
          border-radius: 10px;
          font-size: 13px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-family: inherit;
          transition: all 0.15s;
        }
        .cfgd-logout:hover { background: #FEE2E2; border-color: #FCA5A5; color: #DC2626; }

        /* Excluir conta */
        .cfgd-delete-link { text-align: center; padding: 8px; }
        .cfgd-delete-link-btn {
          all: unset;
          cursor: pointer;
          font-size: 12px;
          color: #9CA3AF;
          font-family: inherit;
        }
        .cfgd-delete-link-btn span { color: #DC2626; font-weight: 700; margin-left: 4px; }
        .cfgd-delete-link-btn:hover span { text-decoration: underline; }
        .cfgd-delete-panel {
          background: #fff;
          border: 1px solid #FCA5A5;
          border-radius: 12px;
          padding: 16px;
          text-align: left;
          display: flex; flex-direction: column; gap: 12px;
        }
        .cfgd-delete-warn { font-size: 13px; color: #7F1D1D; margin: 0; line-height: 1.5; }
        .cfgd-delete-input {
          padding: 10px 12px;
          border: 1.5px solid #F0EBED;
          border-radius: 8px;
          font-size: 13px;
          font-family: inherit;
          outline: none;
        }
        .cfgd-delete-input:focus { border-color: #DC2626; }
        .cfgd-delete-actions { display: flex; gap: 8px; }
        .cfgd-delete-cancel {
          flex: 1;
          padding: 10px;
          background: #F3F4F6;
          color: #4B5563;
          border: none;
          border-radius: 8px;
          font-size: 12.5px; font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .cfgd-delete-confirm {
          flex: 2;
          padding: 10px;
          background: #DC2626;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 12.5px; font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }
        .cfgd-delete-confirm:disabled { background: #F3F4F6; color: #9CA3AF; cursor: not-allowed; }

        @media (min-width: 900px) {
          .cfg-mobile { display: none; }
          .cfgd-desktop { display: flex; flex-direction: column; gap: 16px; max-width: 720px; margin: 0 auto; padding: 8px 24px 40px; }
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
        .cfg-push-row  { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .cfg-push-row > div:first-child { flex: 1; min-width: 0; }
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
          background: linear-gradient(135deg, #fff 60%, var(--bg-subtle) 100%);
          border-color: var(--text-title);
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
          background: var(--text-title);
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
          background: var(--text-title);
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
          background: var(--text-title);
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
          background: var(--text-title);
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

      <SugestaoWizard
        open={sugestaoOpen}
        onClose={() => setSugestaoOpen(false)}
        perfil={{ nome: form.nome, telefone: form.telefone, email: userEmail }}
      />

      <TermosModal
        open={termosOpen}
        onClose={() => setTermosOpen(false)}
      />

      <EditarPerfilModal
        open={editarOpen}
        onClose={() => setEditarOpen(false)}
        nome={form.nome}
        telefone={form.telefone}
        email={userEmail}
        fotoPreview={preview}
        inicial={(form.nome || "?").trim().charAt(0).toUpperCase()}
        onNomeChange={v => setForm({...form, nome: v})}
        onTelefoneChange={v => setForm({...form, telefone: formatPhone(v)})}
        onFotoClick={() => fileRef.current?.click()}
        onSave={async () => { await handleSave(); }}
        saving={saving}
        uploading={uploading}
        senhaAtual={senhaAtual}
        novaSenha={novaSenha}
        confirmSenha={confirmSenha}
        senhaMsg={senhaMsg}
        savingSenha={savingSenha}
        onSenhaAtualChange={setSenhaAtual}
        onNovaSenhaChange={setNovaSenha}
        onConfirmSenhaChange={setConfirmSenha}
        onAlterarSenha={handleAlterarSenha}
        saveError={error}
        saveSuccess={success}
      />
    </div>
  );
}
