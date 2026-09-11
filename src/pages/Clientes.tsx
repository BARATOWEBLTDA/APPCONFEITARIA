import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile, isPro } from "@/hooks/useProfile";
import AppPageHeader from "@/components/AppPageHeader";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Cliente {
  id: string;
  user_id: string;
  nome: string;
  nome_contato?: string;
  email?: string;
  whatsapp?: string;
  cpf_cnpj?: string;
  data_nascimento?: string;
  sexo?: string;
  observacoes?: string;
  foto_url?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  pais?: string;
  origem?: string;
  como_conheceu?: string;
  created_at: string;
}

type FormMode = "rapido" | "completo";

interface ImportContato {
  nome: string;
  telefone: string;
  telefoneNormalizado: string;
  duplicado: boolean;
  selecionado: boolean;
}

const ORIGEM_OPTIONS = ["Instagram", "Indicação", "Google", "Facebook", "TikTok", "WhatsApp", "Loja física", "Outro"];
const SEXO_OPTIONS   = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];
const UF_OPTIONS     = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const emptyRapido = { nome: "", whatsapp: "", email: "", observacoes: "", data_nascimento: "" };

const emptyCompleto: Omit<Cliente, "id" | "user_id" | "created_at"> = {
  nome: "", nome_contato: "", email: "", whatsapp: "", cpf_cnpj: "",
  data_nascimento: "", sexo: "", observacoes: "", foto_url: "",
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", pais: "Brasil",
  origem: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPhone(phone?: string) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,3)} ${d.slice(3,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

// Máscara live durante digitação: (00) 9 0000-0000 ou (00) 0000-0000
function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) {
    // Se começa com 9 (celular), separa depois do 9
    if (d.length >= 3 && d[2] === "9") {
      return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
    }
    return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  }
  // 8-11 dígitos
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  // 8-9 dígitos: assume celular com 9
  if (d.length >= 8 && d[2] === "9") return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

function getDaysUntil(data: string) {
  const hoje = new Date();
  const nasc = new Date(data);
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getHoursUntil(data: string) {
  const hoje = new Date();
  const nasc = new Date(data);
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60));
}

function formatSince(created_at: string): string {
  const d = new Date(created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "🎉 Nova cliente hoje!";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `Cliente desde ${dd}/${mm}/${yy}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Clientes() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [userId,        setUserId]        = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ nome: string; id: string } | null>(null);
  const [toastImport,   setToastImport]   = useState<{ importados: number; duplicados: number } | null>(null);
  const [filtroChip,    setFiltroChip]    = useState<"todos" | "aniversariantes" | "recentes">("todos");
  const [filterOpen,    setFilterOpen]    = useState(false);

  // Importação de contatos
  const [importSheet,   setImportSheet]   = useState<ImportContato[] | null>(null);
  const [importing,     setImporting]     = useState(false);
  const [importError,   setImportError]   = useState<string | null>(null);

  const usuarioEhPro = isPro(profile);
  const suportaContatos = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  // Guard "descartar cadastro?" ao clicar fora
  const [confirmDiscard, setConfirmDiscard] = useState<"form" | "import" | null>(null);

  // Form state
  const [showForm,      setShowForm]      = useState(false);
  const [formMode,      setFormMode]      = useState<FormMode>("rapido");
  const [editando,      setEditando]      = useState<string | null>(null);
  const [rapido,        setRapido]        = useState(emptyRapido);
  const [completo,      setCompleto]      = useState(emptyCompleto);
  const [preview,       setPreview]       = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [cepLoading,    setCepLoading]    = useState(false);
  const [avancadoOpen,  setAvancadoOpen]  = useState(false);

  // Modais
  const [showNiver,     setShowNiver]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      fetchClientes(user.id);
    });
  }, []);

  // Se URL tem ?edit=xxx, abre modal de edição do cliente
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && clientes.length > 0) {
      const cliente = clientes.find(c => c.id === editId);
      if (cliente) {
        openEdit(cliente);
        // Remove params depois de abrir
        setSearchParams({}, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientes, searchParams]);

  // Auto-hide do toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!toastImport) return;
    const t = setTimeout(() => setToastImport(null), 5000);
    return () => clearTimeout(t);
  }, [toastImport]);

  useEffect(() => {
    const isOpen = showForm || !!confirmDelete || showNiver;
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [showForm, confirmDelete, showNiver]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchClientes = async (uid: string) => {
    setLoading(true);
    const { data } = await supabase.from("clientes").select("*").eq("user_id", uid).order("nome");
    if (data) setClientes(data);
    setLoading(false);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openNew = (_mode?: FormMode) => {
    setFormMode("completo");
    setEditando(null);
    setRapido(emptyRapido);
    setCompleto(emptyCompleto);
    setPreview(null);
    setAvancadoOpen(false);
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setFormMode("completo");
    setEditando(c.id);
    setRapido({ nome: c.nome, whatsapp: c.whatsapp || "", email: c.email || "", observacoes: c.observacoes || "", data_nascimento: c.data_nascimento || "" });
    setCompleto({
      nome: c.nome || "", nome_contato: c.nome_contato || "", email: c.email || "",
      whatsapp: c.whatsapp || "", cpf_cnpj: c.cpf_cnpj || "", data_nascimento: c.data_nascimento || "",
      sexo: c.sexo || "", observacoes: c.observacoes || "", foto_url: c.foto_url || "",
      cep: c.cep || "", rua: c.rua || "", numero: c.numero || "", complemento: c.complemento || "",
      bairro: c.bairro || "", cidade: c.cidade || "", estado: c.estado || "", pais: c.pais || "Brasil",
      origem: c.origem || c.como_conheceu || "",
    });
    setPreview(c.foto_url || null);
    // Se cliente tem dados extras, abre avançado automaticamente
    const temExtras = !!(c.foto_url || c.data_nascimento || c.sexo || c.email || c.cpf_cnpj || c.cep || c.rua || c.bairro || c.observacoes || c.origem || c.como_conheceu);
    setAvancadoOpen(temExtras);
    setShowForm(true);
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
      setCompleto(f => ({ ...f, foto_url: data.publicUrl }));
    }
  };

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCompleto(f => ({
          ...f,
          rua: data.logradouro || f.rua,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }));
      }
    } catch {}
    setCepLoading(false);
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    if (!completo.nome.trim() || !completo.whatsapp?.trim()) { setSaving(false); return; }

    // Converte strings vazias em null (Supabase reclama de "" em campos DATE/UUID)
    const toNullable = (v?: string) => (v && v.trim() ? v.trim() : null);
    const payload: any = {
      user_id: userId,
      nome: completo.nome.trim(),
      whatsapp: toNullable(completo.whatsapp),
      foto_url: completo.foto_url || null,
      email: toNullable(completo.email),
      cpf_cnpj: toNullable(completo.cpf_cnpj),
      data_nascimento: toNullable(completo.data_nascimento),
      sexo: toNullable(completo.sexo),
      observacoes: toNullable(completo.observacoes),
      cep: toNullable(completo.cep),
      rua: toNullable(completo.rua),
      numero: toNullable(completo.numero),
      complemento: toNullable(completo.complemento),
      bairro: toNullable(completo.bairro),
      cidade: toNullable(completo.cidade),
      estado: toNullable(completo.estado),
      pais: toNullable(completo.pais) || "Brasil",
      origem: toNullable(completo.origem),
    };

    let savedId = editando;
    if (editando) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editando);
      if (error) {
        alert("Erro ao atualizar: " + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error) {
        alert("Erro ao cadastrar: " + error.message);
        setSaving(false);
        return;
      }
      if (inserted) savedId = inserted.id;
    }

    await fetchClientes(userId);
    setShowForm(false);
    const wasEditing = !!editando;
    setEditando(null);
    setSaving(false);

    // Cliente NOVO → toast com botão "Ver perfil" (não navega automaticamente)
    if (!wasEditing && savedId) {
      setToast({ nome: completo.nome.trim(), id: savedId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("clientes").delete().eq("id", id);
    await fetchClientes(userId);
    setConfirmDelete(null);
  };

  // ═══ IMPORTAÇÃO DE CONTATOS (PRO) ═══

  // Detecta se tem dados preenchidos no formulário (pra decidir se abre guard)
  const hasFormData = (): boolean => {
    if (editando) return true; // Se está editando, sempre confirma
    // Verifica qualquer campo preenchido além do padrão
    return !!(
      completo.nome?.trim() ||
      completo.whatsapp?.trim() ||
      completo.email?.trim() ||
      completo.cpf_cnpj?.trim() ||
      completo.data_nascimento ||
      completo.sexo ||
      completo.observacoes?.trim() ||
      completo.cep?.trim() ||
      completo.rua?.trim() ||
      completo.foto_url
    );
  };

  const tryCloseForm = () => {
    if (hasFormData()) setConfirmDiscard("form");
    else setShowForm(false);
  };

  const tryCloseImport = () => {
    if (importSheet && importSheet.some(c => c.selecionado)) setConfirmDiscard("import");
    else setImportSheet(null);
  };

  const confirmDiscardYes = () => {
    if (confirmDiscard === "form") {
      setShowForm(false);
      setEditando(null);
      setTimeout(() => setCompleto(emptyCompleto), 200);
    } else if (confirmDiscard === "import") {
      setImportSheet(null);
    }
    setConfirmDiscard(null);
  };

  const handleAbrirImportarContatos = async () => {
    // Não é PRO → não faz nada (botão está desabilitado visualmente)
    if (!usuarioEhPro) return;

    // Não suporta → alerta (não deveria acontecer, botão só aparece se suporta)
    if (!suportaContatos) {
      alert("Essa funcionalidade só funciona no Chrome do Android. Use um celular Android pra importar contatos.");
      return;
    }

    setImportError(null);
    try {
      // @ts-ignore - Contacts API não tem types nativos
      const contatosAndroid = await navigator.contacts.select(["name", "tel"], { multiple: true });
      if (!contatosAndroid || contatosAndroid.length === 0) return;

      // Normaliza telefones existentes no banco pra detectar duplicatas
      const telefonesExistentes = new Set(
        clientes
          .map(c => (c.whatsapp || "").replace(/\D/g, ""))
          .filter(t => t.length >= 10)
      );

      const importados: ImportContato[] = contatosAndroid
        .map((c: any) => {
          const nome = Array.isArray(c.name) && c.name.length > 0 ? c.name[0] : "";
          const telRaw = Array.isArray(c.tel) && c.tel.length > 0 ? c.tel[0] : "";
          const telNorm = (telRaw || "").replace(/\D/g, "").replace(/^55/, ""); // Remove código país BR
          return {
            nome: nome.trim(),
            telefone: maskPhone(telNorm),
            telefoneNormalizado: telNorm,
            duplicado: telNorm.length >= 10 && telefonesExistentes.has(telNorm),
            selecionado: !(telNorm.length >= 10 && telefonesExistentes.has(telNorm)) && !!nome.trim() && telNorm.length >= 10,
          };
        })
        .filter((c: ImportContato) => c.nome || c.telefone); // Descarta contatos vazios

      setImportSheet(importados);
    } catch (err: any) {
      console.error("Erro ao selecionar contatos:", err);
      if (err.name === "SecurityError") {
        setImportError("Permissão negada pra acessar contatos.");
      } else {
        setImportError(err.message || "Erro ao acessar contatos");
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!importSheet || !userId) return;
    const paraCadastrar = importSheet.filter(c => c.selecionado && !c.duplicado && c.nome && c.telefoneNormalizado.length >= 10);
    if (paraCadastrar.length === 0) return;

    setImporting(true);
    const payloads = paraCadastrar.map(c => ({
      user_id: userId,
      nome: c.nome,
      whatsapp: c.telefone,
    }));

    const { data, error } = await supabase.from("clientes").insert(payloads).select("id");
    setImporting(false);

    if (error) {
      alert("Erro ao importar: " + error.message);
      return;
    }

    const importadosCount = data?.length || 0;
    const duplicadosCount = importSheet.filter(c => c.duplicado).length;

    await fetchClientes(userId);
    setImportSheet(null);
    setToastImport({ importados: importadosCount, duplicados: duplicadosCount });
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const aniversarianteIds = new Set(
    clientes
      .filter(c => c.data_nascimento && getDaysUntil(c.data_nascimento) <= 30)
      .map(c => c.id)
  );

  const filtered = clientes.filter(c => {
    // Filtro de chip
    if (filtroChip === "aniversariantes" && !aniversarianteIds.has(c.id)) return false;
    if (filtroChip === "recentes") {
      const d = new Date(c.created_at);
      const dias = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (dias > 30) return false;
    }
    // Filtro de busca
    return c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.whatsapp?.includes(search) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
  });

  const aniversariantes = clientes
    .filter(c => c.data_nascimento && getDaysUntil(c.data_nascimento) <= 30)
    .sort((a, b) => getDaysUntil(a.data_nascimento!) - getDaysUntil(b.data_nascimento!));

  // ── Form JSX ──────────────────────────────────────────────────────────────

  // Iniciais pra avatar preview
  const iniciais = (completo.nome || "").trim().split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase() || "").join("") || "?";

  const formJSX = showForm ? (
    <div className="cli-modal-overlay" onClick={tryCloseForm}>
      <div className="cli-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="cli-modal-hdr">
          <div className="cli-modal-hdr-t">
            <h2 className="cli-modal-title">{editando ? "Editar cliente" : "Novo cliente"}</h2>
            <p className="cli-modal-sub">{editando ? "Atualize os dados" : "Cadastre rápido, complete depois se quiser"}</p>
          </div>
          <button className="cli-modal-close" onClick={tryCloseForm} aria-label="Fechar">✕</button>
        </div>

        <div className="cli-modal-split">
          {/* ── Form (esquerda) ── */}
          <div className="cli-modal-body">
            {/* ═══ ESSENCIAL ═══ */}
            <div className="cli-section-lbl">Essencial</div>
            <div className="cli-field">
              <label>Nome <span className="cli-req">*</span></label>
              <input type="text" placeholder="Ex: Ana Beatriz" value={completo.nome} onChange={e => setCompleto(f => ({...f, nome: e.target.value}))} autoComplete="off" />
            </div>
            <div className="cli-field">
              <label>WhatsApp <span className="cli-req">*</span></label>
              <input type="tel" placeholder="(00) 9 0000-0000" value={completo.whatsapp} onChange={e => setCompleto(f => ({...f, whatsapp: maskPhone(e.target.value)}))} autoComplete="off" maxLength={16} />
            </div>

            {/* ═══ + AVANÇADO (toggle) ═══ */}
            {!avancadoOpen ? (
              <button type="button" className="cli-adv-toggle" onClick={() => setAvancadoOpen(true)}>
                <div className="cli-adv-toggle-info">
                  <div className="cli-adv-toggle-t">
                    <span>⚙️</span>
                    <span className="cli-adv-toggle-lbl">+ Avançado</span>
                  </div>
                  <p className="cli-adv-toggle-desc">Foto, aniversário, endereço, observações...</p>
                </div>
                <div className="cli-adv-toggle-arrow">+</div>
              </button>
            ) : (
              <div className="cli-adv-open">
                <div className="cli-adv-hdr">
                  <span className="cli-adv-hdr-t">⚙️ Avançado</span>
                  <button type="button" className="cli-adv-collapse" onClick={() => setAvancadoOpen(false)}>− Fechar</button>
                </div>

                {/* Foto */}
                <div className="cli-field">
                  <label>Foto do cliente <span className="cli-opt">opcional</span></label>
                  <div className="cli-foto-row">
                    <div className="cli-foto-picker" onClick={() => fileRef.current?.click()}>
                      {preview
                        ? <img src={preview} alt="foto" />
                        : <span>📷</span>
                      }
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{display:"none"}} />
                    <button type="button" className="cli-foto-btn" onClick={() => fileRef.current?.click()}>
                      {preview ? "Trocar foto" : "Escolher foto..."}
                    </button>
                  </div>
                </div>

                {/* Aniversário + Sexo */}
                <div className="cli-row-2">
                  <div className="cli-field">
                    <label>🎂 Aniversário <span className="cli-opt">opcional</span></label>
                    <input type="date" value={completo.data_nascimento} onChange={e => setCompleto(f => ({...f, data_nascimento: e.target.value}))} />
                  </div>
                  <div className="cli-field">
                    <label>Sexo <span className="cli-opt">opcional</span></label>
                    <select value={completo.sexo} onChange={e => setCompleto(f => ({...f, sexo: e.target.value}))}>
                      <option value="">Selecione...</option>
                      {SEXO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                {/* Email + CPF */}
                <div className="cli-row-2">
                  <div className="cli-field">
                    <label>E-mail <span className="cli-opt">opcional</span></label>
                    <input type="email" placeholder="email@exemplo.com" value={completo.email} onChange={e => setCompleto(f => ({...f, email: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="cli-field">
                    <label>CPF/CNPJ <span className="cli-opt">opcional</span></label>
                    <input type="text" placeholder="000.000.000-00" value={completo.cpf_cnpj} onChange={e => setCompleto(f => ({...f, cpf_cnpj: e.target.value}))} autoComplete="off" />
                  </div>
                </div>

                {/* Endereço */}
                <div className="cli-sub-lbl">📍 Endereço</div>
                <div className="cli-field">
                  <label>CEP</label>
                  <div style={{position:"relative"}}>
                    <input type="text" placeholder="00000-000" value={completo.cep}
                      onChange={e => { setCompleto(f => ({...f, cep: e.target.value})); fetchCep(e.target.value); }}
                      autoComplete="off" style={{width:"100%"}} />
                    {cepLoading && <span style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)"}} className="spinner-sm-dark" />}
                  </div>
                </div>
                <div className="cli-field">
                  <label>Rua</label>
                  <input type="text" placeholder="Logradouro" value={completo.rua} onChange={e => setCompleto(f => ({...f, rua: e.target.value}))} autoComplete="off" />
                </div>
                <div className="cli-row-2">
                  <div className="cli-field">
                    <label>Número</label>
                    <input type="text" placeholder="Nº" value={completo.numero} onChange={e => setCompleto(f => ({...f, numero: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="cli-field">
                    <label>Complemento</label>
                    <input type="text" placeholder="Apto, bloco" value={completo.complemento} onChange={e => setCompleto(f => ({...f, complemento: e.target.value}))} autoComplete="off" />
                  </div>
                </div>
                <div className="cli-row-2">
                  <div className="cli-field">
                    <label>Bairro</label>
                    <input type="text" placeholder="Bairro" value={completo.bairro} onChange={e => setCompleto(f => ({...f, bairro: e.target.value}))} autoComplete="off" />
                  </div>
                  <div className="cli-field">
                    <label>Cidade</label>
                    <input type="text" placeholder="Cidade" value={completo.cidade} onChange={e => setCompleto(f => ({...f, cidade: e.target.value}))} autoComplete="off" />
                  </div>
                </div>
                <div className="cli-field">
                  <label>UF</label>
                  <select value={completo.estado} onChange={e => setCompleto(f => ({...f, estado: e.target.value}))}>
                    <option value="">-</option>
                    {UF_OPTIONS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>

                {/* Origem + Obs */}
                <div className="cli-sub-lbl">💬 Mais informações</div>
                <div className="cli-field">
                  <label>Como conheceu <span className="cli-opt">opcional</span></label>
                  <select value={completo.origem} onChange={e => setCompleto(f => ({...f, origem: e.target.value}))}>
                    <option value="">Selecione...</option>
                    {ORIGEM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="cli-field">
                  <label>📝 Observações <span className="cli-opt">opcional</span></label>
                  <textarea placeholder="Alergias, preferências, anotações..." value={completo.observacoes} onChange={e => setCompleto(f => ({...f, observacoes: e.target.value}))} rows={3} />
                </div>
              </div>
            )}
          </div>

          {/* Preview lateral removido — formulário centralizado */}
        </div>

        {/* Footer */}
        <div className="cli-modal-footer">
          <button className="cli-btn-cancel" onClick={tryCloseForm}>Cancelar</button>
          <button
            className="cli-btn-save"
            onClick={handleSave}
            disabled={saving || !completo.nome.trim() || !completo.whatsapp?.trim()}
          >
            {saving ? <span className="spinner-sm" /> : (editando ? "Salvar" : "✓ Cadastrar cliente")}
          </button>
        </div>

        {/* Link excluir cliente (só em edição, discreto) */}
        {editando && (
          <div className="cli-modal-danger">
            <button className="cli-danger-link" onClick={() => { setShowForm(false); setConfirmDelete(editando); }}>
              🗑️ Excluir este cliente
            </button>
          </div>
        )}
      </div>

      <style>{`
        /* ═══ MODAL CLIENTE (Doonly patterns) ═══ */
        .cli-modal-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(45, 31, 38, 0.6);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          font-family: var(--font-base);
          animation: cliOverlayIn 0.2s ease;
        }
        @keyframes cliOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .cli-modal {
          background: var(--bg-card);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 92vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: cliModalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-base);
        }
        @keyframes cliModalIn {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .cli-modal, .cli-modal * {
          font-family: var(--font-base) !important;
        }
        .cli-modal button, .cli-modal input, .cli-modal select, .cli-modal textarea {
          font-family: var(--font-base) !important;
        }

        /* Header */
        .cli-modal-hdr {
          background: linear-gradient(180deg, var(--accent-bg, #F5EEF0), var(--bg-card));
          padding: var(--space-4) var(--space-4) var(--space-3);
          display: flex; align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }
        .cli-modal-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-lg); font-weight: var(--fw-black);
          flex-shrink: 0;
          color: var(--text-inverse);
        }
        .cli-modal-avatar--empty {
          background: var(--bg-subtle);
          color: var(--text-muted);
          border: 2px dashed var(--text-disabled);
        }
        .cli-modal-avatar--iniciais {
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
        }
        .cli-modal-avatar--img {
          object-fit: cover;
        }
        .cli-modal-hdr-t { flex: 1; min-width: 0; }
        .cli-modal-title {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
          margin: 0;
        }
        .cli-modal-sub {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin: 2px 0 0;
        }
        .cli-modal-close {
          width: 32px; height: 32px;
          border: none; background: transparent;
          color: var(--text-muted);
          font-size: var(--text-lg);
          cursor: pointer;
          border-radius: var(--radius-full);
          transition: background var(--dur-fast);
        }
        .cli-modal-close:hover { background: var(--bg-subtle); color: var(--text-title); }

        /* Body */
        .cli-modal-split {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          display: flex; flex-direction: column;
        }
        .cli-modal-body {
          padding: var(--space-4);
          display: flex; flex-direction: column;
          gap: var(--space-3);
        }
        .cli-modal-preview { display: none; }

        /* Section labels */
        .cli-section-lbl {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          display: flex; align-items: center;
          gap: var(--space-2);
          margin: 0 0 var(--space-1);
        }
        .cli-section-lbl::before {
          content: "";
          width: 3px; height: 14px;
          background: var(--primary);
          border-radius: 2px;
        }
        .cli-sub-lbl {
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: var(--space-2) 0 0;
        }

        /* Field */
        .cli-field {
          display: flex; flex-direction: column;
          gap: var(--space-1);
        }
        .cli-field label {
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          display: flex; align-items: center;
          gap: 4px;
        }
        .cli-req {
          color: var(--primary);
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
        }
        .cli-opt {
          color: var(--text-muted);
          font-size: 0.65rem;
          font-weight: var(--fw-regular);
          margin-left: 4px;
        }
        .cli-field input,
        .cli-field select,
        .cli-field textarea {
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          font-size: var(--text-sm);
          font-weight: var(--fw-medium);
          color: var(--text-title);
          outline: none;
          transition: border-color var(--dur-fast) var(--ease-out);
          width: 100%;
          box-sizing: border-box;
        }
        .cli-field input:focus,
        .cli-field select:focus,
        .cli-field textarea:focus {
          border-color: var(--primary);
        }
        .cli-field textarea { resize: none; min-height: 60px; }
        .cli-row-2 {
          display: grid; grid-template-columns: 1fr;
          gap: var(--space-2);
        }
        @media (min-width: 900px) {
          .cli-row-2 { grid-template-columns: 1fr 1fr; }
        }

        /* Foto */
        .cli-foto-row {
          display: flex; align-items: center; gap: var(--space-3);
        }
        .cli-foto-picker {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: var(--accent-bg, #F5EEF0);
          border: 2px dashed var(--text-disabled);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          overflow: hidden;
          flex-shrink: 0;
          font-size: var(--text-lg);
          color: var(--text-muted);
          transition: border-color var(--dur-fast);
        }
        .cli-foto-picker:hover { border-color: var(--primary); }
        .cli-foto-picker img { width: 100%; height: 100%; object-fit: cover; }
        .cli-foto-btn {
          flex: 1;
          background: var(--bg-input);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          font-size: var(--text-sm);
          font-weight: var(--fw-medium);
          color: var(--text-secondary);
          cursor: pointer;
          text-align: left;
          transition: border-color var(--dur-fast);
        }
        .cli-foto-btn:hover { border-color: var(--primary); }

        /* + Avançado (fechado) */
        .cli-adv-toggle {
          display: flex; align-items: center; justify-content: space-between;
          background: var(--accent-bg, #F5EEF0);
          border: 1.5px dashed var(--text-disabled);
          border-radius: var(--radius-md);
          padding: 14px 16px;
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
          width: 100%;
          text-align: left;
          margin-top: var(--space-2);
        }
        .cli-adv-toggle:hover {
          border-color: var(--primary);
          background: var(--bg-card);
        }
        .cli-adv-toggle-info { flex: 1; }
        .cli-adv-toggle-t {
          display: flex; align-items: center;
          gap: var(--space-2);
        }
        .cli-adv-toggle-lbl {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: var(--text-title);
        }
        .cli-adv-toggle-desc {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin: 4px 0 0;
        }
        .cli-adv-toggle-arrow {
          font-size: var(--text-lg);
          color: var(--primary);
          font-weight: var(--fw-black);
        }

        /* Avançado (aberto) */
        .cli-adv-open {
          background: var(--accent-bg, #F5EEF0);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          display: flex; flex-direction: column;
          gap: var(--space-3);
          margin-top: var(--space-2);
        }
        .cli-adv-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
        }
        .cli-adv-hdr-t {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .cli-adv-collapse {
          background: transparent;
          border: none;
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px 8px;
          border-radius: var(--radius-sm);
        }
        .cli-adv-collapse:hover { background: var(--bg-card); color: var(--text-title); }
        .cli-adv-open .cli-field input,
        .cli-adv-open .cli-field select,
        .cli-adv-open .cli-field textarea {
          background: var(--bg-card);
        }

        /* Footer */
        .cli-modal-footer {
          padding: var(--space-3) var(--space-4);
          padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          display: flex; gap: var(--space-2);
          background: var(--bg-card);
          flex-shrink: 0;
          border-top: 1px solid var(--border);
        }
        .cli-btn-delete {
          background: transparent;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-md);
          width: 44px; height: 44px;
          font-size: var(--text-md);
          cursor: pointer;
          flex-shrink: 0;
          transition: background var(--dur-fast);
        }
        .cli-btn-delete:hover { background: var(--bg-subtle); }
        .cli-btn-cancel {
          flex: 1;
          padding: 12px;
          background: var(--accent-bg, #F5EEF0);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .cli-btn-save {
          flex: 2;
          padding: 12px;
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          letter-spacing: 0.03em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 4px 0 var(--primary-dark);
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .cli-btn-save:hover:not(:disabled) { filter: brightness(1.05); }
        .cli-btn-save:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .cli-btn-save:disabled {
          background: var(--text-disabled);
          box-shadow: 0 4px 0 #A8A0A4;
          cursor: not-allowed;
        }

        /* Link excluir cliente (discreto no rodapé do modal) */
        .cli-modal-danger {
          padding: 0 var(--space-4) var(--space-3);
          padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          text-align: center;
          background: var(--bg-card);
          margin-top: -8px;
        }
        .cli-danger-link {
          background: transparent;
          border: none;
          color: #DC2626;
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          cursor: pointer;
          padding: 8px 12px;
          font-family: var(--font-base) !important;
          opacity: 0.7;
          transition: opacity var(--dur-fast);
        }
        .cli-danger-link:hover { opacity: 1; text-decoration: underline; }

        /* ═══ DESKTOP ═══ */
        @media (min-width: 900px) {
          .cli-modal-overlay {
            align-items: center;
            padding: var(--space-6);
          }
          .cli-modal {
            border-radius: var(--radius-xl);
            max-width: 880px;
            max-height: 90vh;
          }
          .cli-modal-split {
            display: grid;
            grid-template-columns: 1fr;
            overflow: hidden;
            padding: var(--space-4);
          }
          .cli-modal-body {
            padding: var(--space-4);
            overflow-y: auto;
            max-height: calc(90vh - 180px);
            max-width: 560px;
            margin: 0 auto;
            width: 100%;
          }
          .cli-modal-preview { display: none !important; }
          .cli-preview-lbl {
            font-size: 0.65rem;
            font-weight: var(--fw-black);
            color: var(--primary);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: var(--space-1);
          }
          .cli-preview-wa {
            background: var(--bg-card);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            width: 100%; max-width: 240px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.08);
            display: flex; gap: var(--space-3);
            align-items: center;
          }
          .cli-preview-avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: var(--text-inverse);
            display: flex; align-items: center; justify-content: center;
            font-weight: var(--fw-black);
            font-size: var(--text-sm);
            flex-shrink: 0;
          }
          .cli-preview-avatar--img { object-fit: cover; }
          .cli-preview-wa-info { flex: 1; min-width: 0; }
          .cli-preview-wa-name {
            font-size: var(--text-sm);
            font-weight: var(--fw-black);
            color: var(--text-title);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .cli-preview-wa-msg {
            font-size: var(--text-xs);
            color: #16A34A;
            font-weight: var(--fw-medium);
          }
          .cli-preview-list {
            background: var(--bg-card);
            padding: var(--space-3);
            border-radius: var(--radius-md);
            width: 100%; max-width: 240px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            display: flex; gap: var(--space-3);
            align-items: center;
          }
          .cli-preview-list-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: var(--text-inverse);
            display: flex; align-items: center; justify-content: center;
            font-weight: var(--fw-black);
            font-size: var(--text-xs);
            flex-shrink: 0;
          }
          .cli-preview-list-avatar--img { object-fit: cover; }
          .cli-preview-list-info { flex: 1; min-width: 0; }
          .cli-preview-list-name {
            font-size: var(--text-xs);
            font-weight: var(--fw-black);
            color: var(--text-title);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .cli-preview-list-phone {
            font-size: 0.65rem;
            color: var(--text-secondary);
          }
          .cli-preview-list-tag {
            background: #FEF3C7;
            color: #92400E;
            padding: 2px 6px;
            border-radius: var(--radius-full);
            font-size: 0.65rem;
            font-weight: var(--fw-black);
            flex-shrink: 0;
          }
          .cli-preview-alert {
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-sm);
            font-size: var(--text-xs);
            font-weight: var(--fw-bold);
            text-align: center;
            display: flex; align-items: center; justify-content: center;
            gap: var(--space-1);
          }
          .cli-preview-alert--success {
            background: #F0FDF4;
            color: #14532D;
          }
          .cli-preview-hint {
            font-size: var(--text-xs);
            color: var(--text-secondary);
            text-align: center;
            background: var(--bg-card);
            padding: var(--space-2) var(--space-3);
            border-radius: var(--radius-sm);
            line-height: 1.5;
          }
          .cli-preview-hint b { color: var(--text-title); }
        }
      `}</style>
    </div>
  ) : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <AppPageHeader
      title="Meus Clientes"
      subtitle="Sua base de clientes"
      infoIcon="👥"
      infoContent={
        <>
          <p>Aqui fica sua <strong>base de clientes</strong> cadastrados. Nome, telefone, endereço, aniversário e histórico completo de pedidos.</p>
          <p>Um bom cadastro te ajuda a <strong>fidelizar clientes</strong>, lembrar de aniversários, oferecer promoções e vender mais com o passar do tempo.</p>
        </>
      }
      infoTip={<>Clique em qualquer cliente pra ver o <strong>histórico de pedidos</strong> e o valor total já gasto.</>}
    />
    <div className="cli-root">

      {/* ═══════════════════════ LOADING (evita piscar) ═══════════════════════ */}
      {loading ? (
        <div className="cli-loading-full">
          <span className="cli-spinner-lg" />
          <style>{`
            .cli-loading-full { min-height: calc(100vh - 5rem); display: flex; align-items: center; justify-content: center; }
            .cli-spinner-lg { width: 32px; height: 32px; border: 3px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
          `}</style>
        </div>
      ) : (
      <>

      {/* ═══════════════════════ EMPTY STATE (sem clientes) ═══════════════════════ */}
      {clientes.length === 0 ? (
        <div className="cli-hero-split">
          <div className="cli-hero-left">
            <span className="cli-hero-eyebrow">💰 VENDA MAIS PRO MESMO CLIENTE</span>
            <h1 className="cli-hero-title">Sua base de<br/>clientes fiéis</h1>
            <p className="cli-hero-desc">
              <b>70% da sua renda vem de quem já comprou antes.</b>
              {" "}Salve WhatsApp, aniversário e receba lembretes pra reconquistar
              clientes e fechar mais encomendas.
            </p>
            <div className="cli-hero-actions">
              <button className="cli-hero-btn-primary" onClick={() => openNew()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                CADASTRAR CLIENTE
              </button>
              <button className="cli-hero-btn-ghost" onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                Ver tutorial
              </button>
            </div>
            <div className="cli-hero-tip">
              <div className="cli-hero-tip-icon">💡</div>
              <div>
                <p className="cli-hero-tip-t">Aniversariantes recebem alerta automático</p>
                <p className="cli-hero-tip-d">Envie parabéns + cupom = venda garantida!</p>
              </div>
            </div>
          </div>

          <aside className="cli-hero-right" aria-label="Vídeo tutorial">
            <div className="cli-hero-video-thumb">
              <button
                type="button"
                className="cli-hero-video-play"
                onClick={() => alert("🎬 Vídeo em produção! Em breve disponível.")}
                aria-label="Assistir tutorial"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
            <div className="cli-hero-video-footer">
              <span className="cli-hero-video-t">🎬 Como usar</span>
              <span className="cli-hero-video-badge">EM BREVE</span>
            </div>
          </aside>

          <style>{`
            .cli-hero-split {
              min-height: calc(100vh - 5rem);
              display: flex;
              flex-direction: column;
              gap: var(--space-4);
              padding: var(--space-4);
              font-family: var(--font-base);
              align-items: center;
              justify-content: center;
            }
            .cli-hero-split, .cli-hero-split * { font-family: var(--font-base); }

            .cli-hero-left {
              display: flex; flex-direction: column;
              gap: var(--space-3);
              order: 2;
              text-align: center;
              align-items: center;
              max-width: 480px;
            }
            .cli-hero-right {
              display: flex; flex-direction: column;
              background: linear-gradient(135deg, var(--accent), #4A3038);
              border-radius: var(--radius-lg);
              padding: var(--space-2);
              box-shadow: 0 10px 30px rgba(45, 31, 38, 0.2);
              order: 1;
              width: 100%;
              max-width: 460px;
            }
            .cli-hero-video-thumb {
              aspect-ratio: 16/10;
          max-height: 200px;
              background: linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%);
              border-radius: var(--radius-md);
              display: flex; align-items: center; justify-content: center;
              position: relative; overflow: hidden;
            }
            .cli-hero-video-thumb::before {
              content: ""; position: absolute; inset: 0;
              background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.2) 100%);
            }
            .cli-hero-video-play {
              width: 50px; height: 50px;
              border-radius: var(--radius-full);
              background: rgba(255,255,255,0.95); border: none;
              display: flex; align-items: center; justify-content: center;
              color: var(--primary); cursor: pointer;
              box-shadow: 0 6px 24px rgba(0,0,0,0.35);
              transition: transform var(--dur-fast) var(--ease-out);
              position: relative; z-index: 2;
            }
            .cli-hero-video-play:hover { transform: scale(1.08); }
            .cli-hero-video-play svg { margin-left: 3px; }
            .cli-hero-video-footer {
              display: flex; justify-content: space-between; align-items: center;
              padding: var(--space-3) var(--space-2) var(--space-1);
              color: var(--text-inverse);
            }
            .cli-hero-video-t { font-size: var(--text-sm); font-weight: var(--fw-bold); }
            .cli-hero-video-badge {
              background: var(--primary); color: var(--text-inverse);
              padding: var(--space-1) var(--space-2);
              border-radius: var(--radius-full);
              font-size: 0.625rem; font-weight: var(--fw-black);
              letter-spacing: 0.08em;
            }
            .cli-hero-eyebrow {
              font-size: var(--text-sm); font-weight: var(--fw-black);
              color: var(--primary);
              text-transform: uppercase; letter-spacing: 0.1em;
              line-height: 1;
            }
            .cli-hero-title {
              font-size: 2rem;
              font-weight: var(--fw-black);
              letter-spacing: -0.03em; line-height: 1.15;
              color: var(--text-title);
              margin: var(--space-1) 0 0;
            }
            .cli-hero-desc {
              font-size: var(--text-md);
              color: var(--text-secondary);
              line-height: 1.55;
              margin: var(--space-2) 0 0;
              max-width: 480px;
            }
            .cli-hero-desc b { color: var(--text-title); }
            .cli-hero-actions {
              display: flex; gap: var(--space-2); flex-wrap: wrap;
              margin-top: var(--space-3);
              justify-content: center;
            }
            .cli-hero-btn-primary {
              display: inline-flex; align-items: center;
              gap: var(--space-2);
              background: var(--primary); color: var(--text-inverse);
              border: none;
              padding: var(--space-4) var(--space-6);
              border-radius: var(--radius-md);
              font-size: var(--text-md); font-weight: var(--fw-black);
              cursor: pointer;
              font-family: var(--font-base) !important;
              letter-spacing: 0.03em; text-transform: uppercase;
              box-shadow: 0 4px 0 var(--primary-dark);
              transition: transform 0.08s ease, box-shadow 0.08s ease;
            }
            .cli-hero-btn-primary:hover { filter: brightness(1.05); }
            .cli-hero-btn-primary:active {
              transform: translateY(4px);
              box-shadow: 0 0 0 var(--primary-dark);
            }
            .cli-hero-btn-ghost { display: none; }
            .cli-hero-tip {
              display: flex; gap: var(--space-3);
              background: var(--primary-light);
              padding: var(--space-3) var(--space-4);
              border-radius: var(--radius-md);
              align-items: flex-start;
              margin-top: var(--space-4);
              text-align: left;
              max-width: 480px;
            }
            .cli-hero-tip-icon { font-size: var(--text-xl); line-height: 1; flex-shrink: 0; }
            .cli-hero-tip-t {
              font-size: var(--text-sm); font-weight: var(--fw-black);
              color: var(--text-title); margin: 0 0 var(--space-1);
            }
            .cli-hero-tip-d {
              font-size: var(--text-sm); color: var(--text-secondary);
              line-height: 1.5; margin: 0;
            }

            /* Desktop */
            @media (min-width: 900px) {
              .cli-hero-split {
                flex-direction: row;
                gap: var(--space-6);
                max-width: 1000px;
                margin: 0 auto;
              }
              .cli-hero-left {
                order: 1;
                gap: var(--space-4);
                flex: 1.3 1 440px;
                max-width: 560px; min-width: 0;
                text-align: left; align-items: flex-start;
              }
              .cli-hero-right {
                order: 2;
                padding: var(--space-2);
                flex: 1 1 340px;
                max-width: 460px; min-width: 0;
              }
              .cli-hero-eyebrow { font-size: var(--text-sm); }
              .cli-hero-title { font-size: 2.5rem; line-height: 1.05; }
              .cli-hero-desc { font-size: var(--text-lg); }
              .cli-hero-tip-t { font-size: var(--text-sm); }
              .cli-hero-tip-d { font-size: var(--text-sm); }
              .cli-hero-btn-primary { padding: var(--space-4) var(--space-6); font-size: var(--text-md); }
              .cli-hero-actions { justify-content: flex-start; }
              .cli-hero-btn-ghost {
                display: inline-flex; align-items: center;
                gap: var(--space-2);
                background: var(--bg-subtle); color: var(--text-secondary);
                border: none;
                padding: var(--space-4) var(--space-6);
                border-radius: var(--radius-md);
                font-size: var(--text-md); font-weight: var(--fw-bold);
                cursor: pointer;
                font-family: var(--font-base) !important;
                transition: background var(--dur-fast) var(--ease-out);
              }
              .cli-hero-btn-ghost:hover { background: var(--accent-light); }
              .cli-hero-video-play { width: 60px; height: 60px; }
              .cli-hero-video-play svg { width: 28px; height: 28px; }
              .cli-hero-video-t { font-size: var(--text-sm); }
            }
          `}</style>

          {formJSX}
        </div>
      ) : (
      <>
      {/* ═══════════════════════ MOBILE ═══════════════════════ */}
      <div className="cli-mobile">

        {/* Header */}
        <div className="mob-header">
          <h1 className="mob-title">Clientes</h1>
          <p className="mob-subtitle">{clientes.length} {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}</p>
        </div>

        {/* Botões de ação */}
        <div className="mob-actions">
          <button className="mob-btn-primary" onClick={() => openNew()}>
            + Cadastrar cliente
          </button>
          <button
            className={`cli-btn-pro cli-btn-pro--compact${!usuarioEhPro ? " cli-btn-pro--off" : ""}`}
            onClick={handleAbrirImportarContatos}
            disabled={!usuarioEhPro}
          >
            <span style={{fontSize: "0.95rem"}}>📱</span>
            Importar
            <span className="cli-btn-pro-badge">PRO</span>
          </button>
        </div>

        {/* Banner de aniversariantes destaque (se tem no mês) */}
        {aniversariantes.length > 0 && (
          <button className="cli-aniv-banner" onClick={() => setShowNiver(true)}>
            <div className="cli-aniv-banner-icon">🎂</div>
            <div className="cli-aniv-banner-body">
              <div className="cli-aniv-banner-t">
                {aniversariantes.length} cliente{aniversariantes.length !== 1 ? "s" : ""} fazem aniversário nos próximos 30 dias
              </div>
              <div className="cli-aniv-banner-d">
                {aniversariantes.slice(0, 2).map(c => c.nome).join(", ")}
                {aniversariantes.length > 2 && ` e mais ${aniversariantes.length - 2}`}
              </div>
            </div>
            <div className="cli-aniv-banner-arrow">→</div>
          </button>
        )}

        {/* Busca + Filtro dropdown na mesma linha */}
        <div className="cli-search-row">
          <div className="mob-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text" placeholder="Buscar por nome, telefone ou e-mail..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="mob-search" autoComplete="off"
            />
            {search && (
              <button onClick={() => setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",padding:0,lineHeight:1}}>✕</button>
            )}
          </div>
          <div style={{position:"relative"}}>
            <button className="cli-filter-btn" onClick={() => setFilterOpen(o => !o)} title="Filtrar" aria-label="Filtrar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              {filtroChip !== "todos" && <span className="cli-filter-dot" />}
            </button>
            {filterOpen && (
              <>
                <div className="cli-filter-backdrop" onClick={() => setFilterOpen(false)} />
                <div className="cli-filter-panel">
                  <div className="cli-filter-title">Filtrar clientes</div>
                  <button className={`cli-filter-opt${filtroChip === "todos" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("todos"); setFilterOpen(false); }}>
                    <div className="cli-filter-radio" />
                    <span>Todos</span>
                    <span className="cli-filter-count">{clientes.length}</span>
                  </button>
                  {aniversariantes.length > 0 && (
                    <button className={`cli-filter-opt${filtroChip === "aniversariantes" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("aniversariantes"); setFilterOpen(false); }}>
                      <div className="cli-filter-radio" />
                      <span>Aniversariantes</span>
                      <span className="cli-filter-count">{aniversariantes.length}</span>
                    </button>
                  )}
                  <button className={`cli-filter-opt${filtroChip === "recentes" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("recentes"); setFilterOpen(false); }}>
                    <div className="cli-filter-radio" />
                    <span>Recentes (30 dias)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{textAlign:"center",padding:"3rem"}}><span className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="mob-empty">
            <p>{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado ainda"}</p>
            {!search && <p style={{fontSize:"0.8rem",marginTop:"0.25rem"}}>Use o botão acima para cadastrar</p>}
          </div>
        ) : (
          <div className="mob-list">
            {filtered.map(c => (
              <div key={c.id} className="mob-card" onClick={() => navigate(`/clientes/${c.id}`)}>
                <div className="mob-avatar">
                  {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0).toUpperCase()}</span>}
                </div>
                <div className="mob-info">
                  <p className="mob-nome">{c.nome}</p>
                  <p className="mob-since">{formatSince(c.created_at)}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>
        )}

        {/* Modal aniversariantes */}
        {showNiver && (
          <div className="modal-overlay" onClick={() => setShowNiver(false)}>
            <div className="mob-modal" onClick={e => e.stopPropagation()}>
              <div className="form-handle" />
              <div className="form-header">
                <h2>🎂 Aniversariantes</h2>
                <button className="form-close" onClick={() => setShowNiver(false)}>✕</button>
              </div>
              <div style={{padding:"0 1.25rem 1.5rem",overflowY:"auto",maxHeight:"60vh"}}>
                {aniversariantes.length === 0 ? (
                  <p style={{color:"var(--text-muted)",textAlign:"center",padding:"2rem"}}>Nenhum nos próximos 30 dias</p>
                ) : aniversariantes.map(c => {
                  const nasc = new Date(c.data_nascimento!);
                  const diff = getDaysUntil(c.data_nascimento!);
                  const hours = getHoursUntil(c.data_nascimento!);
                  return (
                    <div key={c.id} className="cli-aniv-item" style={{marginBottom:"0.5rem", cursor: "pointer"}} onClick={() => { setShowNiver(false); navigate(`/clientes/${c.id}`); }}>
                      <div className="cli-aniv-avatar">
                        {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0)}</span>}
                      </div>
                      <div className="cli-aniv-info">
                        <p className="cli-aniv-nome">{c.nome}</p>
                        <p className="cli-aniv-data">
                          Faz aniversário dia {nasc.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                        </p>
                      </div>
                      <span className={`cli-aniv-badge${diff <= 7 ? " soon" : ""}`}>
                        {diff === 0 ? "🎉 Hoje!" : hours <= 24 ? `${hours}h` : `${diff} dias`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════ DESKTOP ═══════════════════════ */}
      <div className="cli-desktop">
        <div className="cli-layout">
          <div className="cli-main">
            {/* Header desktop */}
            <div className="cli-page-hdr">
              <div>
                <h1 className="cli-page-title">Clientes</h1>
                <p className="cli-page-sub">{clientes.length} {clientes.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}</p>
              </div>
              <div className="cli-page-actions">
                <button className="cli-btn-new" onClick={() => openNew()}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{marginRight: 6}}><path d="M12 5v14M5 12h14"/></svg>
                  Novo cliente
                </button>
                <button
                  className={`cli-btn-pro${!usuarioEhPro ? " cli-btn-pro--off" : ""}`}
                  onClick={handleAbrirImportarContatos}
                  disabled={!usuarioEhPro}
                  title={usuarioEhPro ? "Importar contatos do celular" : "Feature PRO — assine para desbloquear"}
                >
                  <span style={{fontSize: "0.95rem"}}>📱</span>
                  Importar
                  <span className="cli-btn-pro-badge">PRO</span>
                </button>
              </div>
            </div>

            {/* Busca + filtro na mesma linha */}
            <div className="cli-search-row cli-search-row--desktop">
              <div className="cli-search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Buscar por nome, telefone ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="cli-search" autoComplete="off" />
              </div>
              <div style={{position:"relative"}}>
                <button className="cli-filter-btn" onClick={() => setFilterOpen(o => !o)} title="Filtrar" aria-label="Filtrar">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                  {filtroChip !== "todos" && <span className="cli-filter-dot" />}
                </button>
                {filterOpen && (
                  <>
                    <div className="cli-filter-backdrop" onClick={() => setFilterOpen(false)} />
                    <div className="cli-filter-panel">
                      <div className="cli-filter-title">Filtrar clientes</div>
                      <button className={`cli-filter-opt${filtroChip === "todos" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("todos"); setFilterOpen(false); }}>
                        <div className="cli-filter-radio" />
                        <span>Todos</span>
                        <span className="cli-filter-count">{clientes.length}</span>
                      </button>
                      {aniversariantes.length > 0 && (
                        <button className={`cli-filter-opt${filtroChip === "aniversariantes" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("aniversariantes"); setFilterOpen(false); }}>
                          <div className="cli-filter-radio" />
                          <span>Aniversariantes</span>
                          <span className="cli-filter-count">{aniversariantes.length}</span>
                        </button>
                      )}
                      <button className={`cli-filter-opt${filtroChip === "recentes" ? " cli-filter-opt--active" : ""}`} onClick={() => { setFiltroChip("recentes"); setFilterOpen(false); }}>
                        <div className="cli-filter-radio" />
                        <span>Recentes (30 dias)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {loading ? (
              <div className="cli-loading"><span className="spinner" /></div>
            ) : filtered.length === 0 ? (
              <div className="cli-empty"><p>Nenhum cliente encontrado</p></div>
            ) : (
              <div className="cli-list">
                {filtered.map(c => (
                  <div key={c.id} className="cli-card" onClick={() => navigate(`/clientes/${c.id}`)} style={{cursor:"pointer"}}>
                    <div className="cli-avatar">
                      {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0).toUpperCase()}</span>}
                    </div>
                    <div className="cli-info">
                      <p className="cli-nome">{c.nome}</p>
                      <p className="cli-since">{formatSince(c.created_at)}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{flexShrink: 0}}><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar aniversariantes */}
          <div className="cli-sidebar">
            {aniversariantes.length > 0 && (
              <div className="cli-panel">
                <p className="cli-panel-title">🎂 Aniversariantes</p>
                {aniversariantes.map(c => {
                  const nasc = new Date(c.data_nascimento!);
                  const diff = getDaysUntil(c.data_nascimento!);
                  const hours = getHoursUntil(c.data_nascimento!);
                  return (
                    <div key={c.id} className="cli-aniv-item" style={{cursor: "pointer"}} onClick={() => navigate(`/clientes/${c.id}`)}>
                      <div className="cli-aniv-avatar">
                        {c.foto_url ? <img src={c.foto_url} alt={c.nome} /> : <span>{c.nome.charAt(0)}</span>}
                      </div>
                      <div className="cli-aniv-info">
                        <p className="cli-aniv-nome">{c.nome}</p>
                        <p className="cli-aniv-data">{nasc.toLocaleDateString("pt-BR",{day:"2-digit",month:"long"})}</p>
                      </div>
                      <span className={`cli-aniv-badge${diff <= 7 ? " soon" : ""}`}>
                        {diff === 0 ? "🎉 Hoje!" : hours <= 24 ? `${hours}h` : `${diff}d`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ MODAIS COMPARTILHADOS ═══════════════════════ */}

      {/* ═══ Modal "Descartar cadastro?" (guard) ═══ */}
      {confirmDiscard && (
        <div className="cli-discard-ov" onClick={() => setConfirmDiscard(null)}>
          <div className="cli-discard-box" onClick={e => e.stopPropagation()}>
            <div className="cli-discard-icon">⚠️</div>
            <h3 className="cli-discard-title">
              {confirmDiscard === "form"
                ? (editando ? "Descartar alterações?" : "Descartar cadastro?")
                : "Descartar seleção?"
              }
            </h3>
            <p className="cli-discard-desc">
              {confirmDiscard === "form"
                ? "Você preencheu dados que serão perdidos."
                : "Os contatos selecionados serão descartados."
              }
            </p>
            <div className="cli-discard-actions">
              <button className="cli-discard-btn cli-discard-btn--stay" onClick={() => setConfirmDiscard(null)}>
                Continuar preenchendo
              </button>
              <button className="cli-discard-btn cli-discard-btn--go" onClick={confirmDiscardYes}>
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}

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

      {formJSX}

      {/* ═══════════════════════ MODAL IMPORTAÇÃO CONTATOS ═══════════════════════ */}
      {importSheet && (() => {
        const totalNovos = importSheet.filter(c => !c.duplicado).length;
        const totalDuplicados = importSheet.filter(c => c.duplicado).length;
        const totalSelecionados = importSheet.filter(c => c.selecionado && !c.duplicado).length;
        const marcarTodos = () => setImportSheet(prev => prev?.map(c => ({ ...c, selecionado: !c.duplicado && !!c.nome && c.telefoneNormalizado.length >= 10 })) || null);
        const desmarcarTodos = () => setImportSheet(prev => prev?.map(c => ({ ...c, selecionado: false })) || null);
        const toggleItem = (idx: number) => setImportSheet(prev => prev?.map((c, i) => i === idx ? { ...c, selecionado: !c.selecionado } : c) || null);
        return (
          <div className="cli-imp-ov" onClick={() => !importing && tryCloseImport()}>
            <div className="cli-imp-modal" onClick={e => e.stopPropagation()}>
              <div className="cli-imp-hdr">
                <div className="cli-imp-icon">📱</div>
                <div className="cli-imp-hdr-t">
                  <h2 className="cli-imp-title">Importar {importSheet.length} contato{importSheet.length !== 1 ? "s" : ""}</h2>
                  <p className="cli-imp-sub">Revise antes de cadastrar</p>
                </div>
                <button className="cli-imp-close" onClick={tryCloseImport} disabled={importing}>✕</button>
              </div>

              <div className="cli-imp-stats">
                <div className="cli-imp-stat">
                  <div className="cli-imp-stat-v cli-imp-stat-v--green">{totalNovos}</div>
                  <div className="cli-imp-stat-l">Novos</div>
                </div>
                <div className="cli-imp-stat">
                  <div className="cli-imp-stat-v cli-imp-stat-v--gray">{totalDuplicados}</div>
                  <div className="cli-imp-stat-l">Já existem</div>
                </div>
                <div className="cli-imp-stat">
                  <div className="cli-imp-stat-v">{totalSelecionados}</div>
                  <div className="cli-imp-stat-l">Selecionados</div>
                </div>
              </div>

              <div className="cli-imp-list">
                {importSheet.map((c, idx) => {
                  const semTel = c.telefoneNormalizado.length < 10;
                  const inputInvalido = c.duplicado || semTel || !c.nome;
                  const iniciais = c.nome ? c.nome.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("") : "?";
                  return (
                    <div key={idx} className={`cli-imp-item${c.selecionado ? " cli-imp-item--sel" : ""}${c.duplicado ? " cli-imp-item--dup" : ""}${semTel ? " cli-imp-item--warn" : ""}`}>
                      <button
                        className={`cli-imp-check${c.selecionado ? " cli-imp-check--on" : ""}${inputInvalido ? " cli-imp-check--disabled" : ""}`}
                        onClick={() => !inputInvalido && toggleItem(idx)}
                        disabled={inputInvalido}
                        aria-label={c.selecionado ? "Desmarcar" : "Marcar"}
                      >
                        {c.duplicado ? "🚫" : semTel ? "!" : c.selecionado ? "✓" : ""}
                      </button>
                      <div className={`cli-imp-avatar${c.duplicado ? " cli-imp-avatar--gray" : ""}`}>{iniciais}</div>
                      <div className="cli-imp-info">
                        <div className="cli-imp-nome">{c.nome || "(sem nome)"}</div>
                        <div className="cli-imp-tel">{c.telefone || "(sem telefone)"}</div>
                      </div>
                      {c.duplicado ? (
                        <span className="cli-imp-tag cli-imp-tag--dup">Já existe</span>
                      ) : semTel ? (
                        <span className="cli-imp-tag cli-imp-tag--warn">Sem telefone</span>
                      ) : (
                        <span className="cli-imp-tag cli-imp-tag--new">Novo</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="cli-imp-toolbar">
                <button className="cli-imp-toolbar-btn" onClick={marcarTodos}>✓ Marcar todos</button>
                <button className="cli-imp-toolbar-btn" onClick={desmarcarTodos}>✕ Desmarcar todos</button>
              </div>

              <div className="cli-imp-footer">
                <button className="cli-imp-btn-cancel" onClick={tryCloseImport} disabled={importing}>Cancelar</button>
                <button
                  className="cli-imp-btn-import"
                  onClick={handleConfirmImport}
                  disabled={importing || totalSelecionados === 0}
                >
                  {importing ? <span className="spinner-sm" /> : `✓ IMPORTAR ${totalSelecionados} CLIENTE${totalSelecionados !== 1 ? "S" : ""}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Erro de importação */}
      {importError && (
        <div className="cli-toast" role="status" style={{background: "linear-gradient(135deg, #DC2626, #B91C1C)", boxShadow: "0 10px 30px rgba(220,38,38,0.35)"}}>
          <div className="cli-toast-icon">⚠️</div>
          <div className="cli-toast-body">
            <div className="cli-toast-t">Erro ao importar</div>
            <div className="cli-toast-d">{importError}</div>
          </div>
          <button className="cli-toast-close" onClick={() => setImportError(null)} aria-label="Fechar">✕</button>
        </div>
      )}

      {/* Toast de sucesso importação */}
      {toastImport && (
        <div className="cli-toast" role="status">
          <div className="cli-toast-icon">
            <span style={{fontSize: 18}}>🎉</span>
          </div>
          <div className="cli-toast-body">
            <div className="cli-toast-t">{toastImport.importados} cliente{toastImport.importados !== 1 ? "s" : ""} importado{toastImport.importados !== 1 ? "s" : ""}!</div>
            {toastImport.duplicados > 0 && (
              <div className="cli-toast-d">{toastImport.duplicados} já {toastImport.duplicados === 1 ? "existia" : "existiam"} e {toastImport.duplicados === 1 ? "foi ignorada" : "foram ignorados"}</div>
            )}
          </div>
          <button className="cli-toast-close" onClick={() => setToastImport(null)} aria-label="Fechar">✕</button>
        </div>
      )}

      {/* ═══════════════════════ TOAST ═══════════════════════ */}
      {toast && (
        <div className="cli-toast" role="status">
          <div className="cli-toast-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div className="cli-toast-body">
            <div className="cli-toast-t">{toast.nome} cadastrada!</div>
            <div className="cli-toast-d">Cliente adicionada com sucesso</div>
          </div>
          <button className="cli-toast-btn" onClick={() => { navigate(`/clientes/${toast.id}`); setToast(null); }}>
            Ver perfil
          </button>
          <button className="cli-toast-close" onClick={() => setToast(null)} aria-label="Fechar">✕</button>
        </div>
      )}

      {/* ═══════════════════════ STYLES ═══════════════════════ */}
      <style>{`
        * { box-sizing: border-box; }
        .cli-root { font-family: var(--font-base, 'Geist', sans-serif); }

        .cli-mobile  { display: flex; flex-direction: column; gap: 0.75rem; }
        .cli-desktop { display: none; }
        @media (min-width: 768px) { .cli-mobile { display: none; } .cli-desktop { display: block; } }

        /* ── Mobile ────────────────────────── */
        .mob-header  { display: flex; flex-direction: column; gap: 0.1rem; padding: 0.5rem 0.25rem 0.25rem; }
        .mob-title   { font-size: var(--font-page-title); font-weight: var(--fw-bold); color: var(--text-title); margin: 0; }
        .mob-subtitle { font-size: var(--font-helper); color: var(--text-muted); margin: 0; }

        .mob-actions { display: flex; gap: 0.6rem; }
        .mob-btn-primary   { flex: 1; padding: 0.7rem 0.5rem; background: var(--text-title); color: white; border: none; border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
        .mob-btn-primary:active { opacity: 0.85; }
        .mob-btn-secondary { flex: 1; padding: 0.7rem 0.5rem; background: var(--bg-card); color: var(--text-title); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); cursor: pointer; white-space: nowrap; transition: border-color 0.15s; }
        .mob-btn-secondary:active { border-color: var(--text-title); }

        .mob-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.7rem 1rem; }
        .mob-search  { border: none; outline: none; flex: 1; font-family: inherit; font-size: var(--font-button); color: var(--text-title); background: transparent; }
        .mob-search::placeholder { color: var(--text-muted); }

        .mob-empty   { text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-size: var(--font-button); }
        .mob-list    { display: flex; flex-direction: column; gap: 0.5rem; padding-bottom: 7rem; }

        .mob-card    { display: flex; align-items: center; gap: 0.85rem; background: var(--bg-card); border-radius: var(--radius-lg); padding: 0.75rem 1rem; border: 1px solid var(--border); cursor: pointer; }
        .mob-card:active { background: var(--bg-body); }
        .mob-avatar  { width: 44px; height: 44px; border-radius: var(--radius-md); flex-shrink: 0; background: var(--primary-light); display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title); font-weight: var(--fw-bold); color: var(--primary); overflow: hidden; }
        .mob-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .mob-info    { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
        .mob-nome    { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mob-whatsapp { display: inline-flex; align-items: center; gap: 0.3rem; font-size: var(--font-helper); color: #25D366; font-weight: var(--fw-medium); text-decoration: none; }
        .mob-email   { font-size: var(--font-helper); color: var(--text-muted); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mob-sem-tel { font-size: var(--font-helper); color: var(--text-muted); margin: 0; }

        .mob-modal   { background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; width: 100%; max-height: 85vh; display: flex; flex-direction: column; position: fixed; bottom: 0; left: 0; right: 0; animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1); }

        /* ── Desktop ────────────────────────── */
        .cli-layout  { display: grid; grid-template-columns: 2fr 1fr; gap: 1.25rem; align-items: start; }
        .cli-main    { min-width: 0; }
        .cli-sidebar { display: flex; flex-direction: column; gap: 1rem; padding-top: 7rem; }
        .cli-topbar  { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }

        .cli-btn-new     { padding: 12px 20px; background: var(--primary); color: var(--text-inverse); border: none; border-radius: var(--radius-md); font-family: var(--font-base) !important; font-size: var(--text-sm); font-weight: var(--fw-black); cursor: pointer; white-space: nowrap; flex-shrink: 0; box-shadow: 0 4px 0 var(--primary-dark); letter-spacing: 0.02em; text-transform: uppercase; display: inline-flex; align-items: center; transition: transform 0.08s ease, box-shadow 0.08s ease; }
        .cli-btn-new:hover { filter: brightness(1.05); }
        .cli-btn-new:active { transform: translateY(4px); box-shadow: 0 0 0 var(--primary-dark); }
        .cli-btn-completo{ display: none; }

        .cli-search-wrap { display: flex; align-items: center; gap: 0.5rem; background: var(--bg-card); border: 1.5px solid var(--border); border-radius: var(--radius-md); padding: 0.75rem 1rem; flex: 1; min-width: 200px; }
        .cli-search      { border: none; outline: none; flex: 1; font-family: inherit; font-size: var(--font-button); color: var(--text-title); background: transparent; }
        .cli-search::placeholder { color: var(--text-muted); }

        .cli-loading { display: flex; justify-content: center; padding: 3rem; }
        .cli-empty   { text-align: center; padding: 3rem; color: var(--text-muted); }
        .cli-list    { display: flex; flex-direction: column; gap: 0.6rem; }

        .cli-card    { display: flex; align-items: center; gap: 0.9rem; background: var(--bg-card); border-radius: var(--radius-lg); padding: 0.75rem 1rem; border: 1px solid var(--border); transition: box-shadow 0.2s; }
        .cli-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .cli-avatar  { width: 48px; height: 48px; border-radius: var(--radius-md); flex-shrink: 0; background: var(--primary-light); display: flex; align-items: center; justify-content: center; font-size: var(--font-modal-title); font-weight: var(--fw-bold); color: var(--primary); overflow: hidden; }
        .cli-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cli-info    { flex: 1; min-width: 0; }
        .cli-nome    { font-size: var(--font-input); font-weight: var(--fw-semibold); color: var(--text-title); margin: 0; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-whatsapp-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: var(--font-helper); color: #25D366; font-weight: var(--fw-medium); text-decoration: none; }
        .cli-whatsapp-link:hover { text-decoration: underline; }

        .cli-panel   { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1rem 1.1rem; border: 1px solid var(--border); }
        .cli-panel-title { font-size: var(--font-button); font-weight: var(--fw-bold); color: var(--text-title); margin: 0 0 0.75rem; }

        .cli-aniv-item   { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; margin-bottom: 0.5rem; border-radius: var(--radius-md); background: linear-gradient(135deg,#1a1a2e,#16213e); overflow: hidden; }
        .cli-aniv-item:last-child { margin-bottom: 0; }
        .cli-aniv-avatar { width: 36px; height: 36px; border-radius: var(--radius-md); flex-shrink: 0; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: var(--font-button); font-weight: var(--fw-bold); color: #ffd700; overflow: hidden; }
        .cli-aniv-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cli-aniv-info   { flex: 1; min-width: 0; }
        .cli-aniv-nome   { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: #fff; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cli-aniv-data   { font-size: var(--font-caption); color: rgba(255,215,0,0.7); margin: 0; }
        .cli-aniv-badge  { font-size: var(--font-caption); font-weight: var(--fw-bold); color: #1a1a2e; background: linear-gradient(135deg,#ffd700,#ffa500); padding: 0.25rem 0.6rem; border-radius: var(--radius-xl); white-space: nowrap; flex-shrink: 0; }
        .cli-aniv-badge.soon { background: var(--primary-gradient); color: #fff; }

        /* ── Formulário (Modal de Cliente — 100% tokenizado) ─────── */
        .modal-overlay  { position: fixed; inset: 0; z-index: 200; background: var(--bg-overlay); backdrop-filter: blur(4px); display: flex; align-items: flex-end; justify-content: center; touch-action: none; }
        @media (min-width: 768px) { .modal-overlay { align-items: center; padding: var(--space-4); } }

        .form-drawer    { background: var(--bg-card); border-radius: var(--radius-xl) 24px 0 0; width: 100%; max-height: 92vh; display: flex; flex-direction: column; animation: slideUp var(--dur-slow) cubic-bezier(0.16,1,0.3,1); }
        @media (min-width: 768px) { .form-drawer { border-radius: var(--radius-xl); max-width: 560px; max-height: 88vh; animation: fadeScale var(--dur-normal) var(--ease-out); } }
        @keyframes slideUp   { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes fadeScale { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

        .form-handle    { width: 40px; height: 4px; background: var(--border); border-radius: 2px; margin: var(--space-3) auto 0; flex-shrink: 0; }
        .form-header    { display: flex; justify-content: space-between; align-items: center; padding: var(--space-4) var(--space-5) var(--space-2); flex-shrink: 0; }
        .form-header h2 { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin: 0; }
        .form-close     { background: var(--bg-body); border: none; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: var(--font-caption); display: flex; align-items: center; justify-content: center; transition: background var(--dur-fast) var(--ease-out); }

        .form-tabs      { display: flex; gap: var(--gap-tight); padding: 0 var(--space-5) var(--space-3); flex-shrink: 0; }
        .form-tab       { flex: 1; padding: var(--space-2); border-radius: var(--radius-md); border: 1.5px solid var(--border); background: var(--bg-body); font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); cursor: pointer; transition: all var(--dur-fast) var(--ease-out); }
        .form-tab--active { background: var(--text-title); color: var(--text-inverse); border-color: var(--text-title); }

        .form-scroll    { flex: 1; overflow-y: auto; padding: 0 var(--space-5) var(--space-2); }

        .form-section-title { font-size: var(--font-section-label); font-weight: var(--fw-bold); line-height: var(--lh-normal); letter-spacing: var(--ls-wide); text-transform: uppercase; color: var(--text-muted); margin: var(--space-5) 0 var(--space-3); }

        .form-fields    { display: flex; flex-direction: column; gap: var(--gap-stack); }
        .form-row       { display: flex; gap: var(--gap-stack); }
        .form-row .form-field { flex: 1; }

        .form-field     { display: flex; flex-direction: column; gap: var(--space-1); }
        .form-field label { font-size: var(--font-field-label); font-weight: var(--fw-semibold); line-height: var(--lh-normal); color: var(--text-secondary); }
        .form-field input, .form-field select, .form-field textarea { padding: var(--pad-input); border: 1.5px solid var(--border); border-radius: var(--radius-md); font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-medium); line-height: var(--lh-normal); color: var(--text-title); outline: none; transition: border-color var(--dur-fast) var(--ease-out); background: var(--bg-input); resize: none; width: 100%; }
        .form-field input:focus, .form-field select:focus, .form-field textarea:focus { border-color: var(--text-title); }

        .req { color: var(--text-muted); font-size: var(--font-caption); font-weight: var(--fw-regular); font-style: italic; }
        .opt { color: var(--text-muted); font-size: var(--font-caption); font-weight: var(--fw-regular); font-style: italic; }

        .form-avatar-wrap    { display: flex; flex-direction: column; align-items: center; margin: var(--space-3) 0 var(--space-2); gap: var(--space-1); }
        .form-avatar         { width: 80px; height: 80px; border-radius: 50%; border: 2px dashed var(--border); background: var(--bg-body); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; overflow: hidden; transition: border-color var(--dur-fast) var(--ease-out); }
        .form-avatar img     { width: 100%; height: 100%; object-fit: cover; }
        .form-avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: var(--text-md); opacity: 0; transition: opacity var(--dur-fast) var(--ease-out); }
        .form-avatar:hover .form-avatar-overlay { opacity: 1; }
        .form-avatar-hint    { font-size: var(--font-caption); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); }

        .form-footer    { display: flex; gap: var(--gap-stack); padding: var(--space-3) var(--space-5) var(--space-5); border-top: 1px solid var(--border); flex-shrink: 0; }
        .form-btn       { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); border: none; font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: opacity var(--dur-fast) var(--ease-out); }
        .form-btn.cancel    { background: var(--bg-body); color: var(--text-secondary); }
        .form-btn.save      { background: var(--text-title); color: var(--text-inverse); }
        .form-btn.save:disabled { opacity: 0.5; cursor: not-allowed; }
        .form-btn.delete-btn { background: #fff1f2; color: var(--error); flex: 0 0 auto; padding: var(--space-3) var(--space-4); }

        /* ── Modal confirmação ──────────────── */
        .modal-box      { background: var(--bg-card); border-radius: var(--radius-lg); padding: var(--space-6); width: 90%; max-width: 360px; text-align: center; }
        .modal-box h3   { font-size: var(--font-modal-title); font-weight: var(--fw-bold); line-height: var(--lh-tight); color: var(--text-title); margin-bottom: var(--space-2); }
        .modal-box p    { font-size: var(--font-helper); font-weight: var(--fw-regular); line-height: var(--lh-normal); color: var(--text-muted); margin-bottom: var(--space-5); }
        .modal-actions  { display: flex; gap: var(--gap-stack); }
        .modal-btn      { flex: 1; padding: var(--space-3); border-radius: var(--radius-md); border: none; font-family: inherit; font-size: var(--font-button); font-weight: var(--fw-bold); line-height: var(--lh-normal); cursor: pointer; transition: opacity var(--dur-fast) var(--ease-out); }
        .modal-btn.cancel  { background: var(--bg-body); color: var(--text-secondary); }
        .modal-btn.confirm { background: var(--error); color: var(--text-inverse); }

        /* ── Spinners ───────────────────────── */
        .spinner         { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--text-title); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .spinner-sm      { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        .spinner-sm-dark { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--text-title); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
        @keyframes spin  { to { transform: rotate(360deg); } }

        /* ═══ BOTÃO PRO (Importar contatos) ═══ */
        .cli-btn-pro {
          display: inline-flex; align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #FBBF24, #F59E0B);
          color: #78350F;
          border: none;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          cursor: pointer;
          font-family: var(--font-base) !important;
          box-shadow: 0 3px 0 #B45309;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          white-space: nowrap;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .cli-btn-pro:hover:not(:disabled) { filter: brightness(1.05); }
        .cli-btn-pro:active:not(:disabled) {
          transform: translateY(3px);
          box-shadow: 0 0 0 #B45309;
        }
        .cli-btn-pro-badge {
          background: #000;
          color: #FBBF24;
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          font-size: 0.55rem;
          font-weight: var(--fw-black);
          letter-spacing: 0.06em;
          line-height: 1;
        }
        .cli-btn-pro--compact {
          flex: 1;
          padding: 12px 8px;
          justify-content: center;
        }
        /* Estado desabilitado (não é PRO) */
        .cli-btn-pro--off {
          background: linear-gradient(135deg, #F0EBED, #E8DEE3) !important;
          color: #9A8B93 !important;
          box-shadow: 0 3px 0 #D1CACD !important;
          opacity: 0.7;
          cursor: not-allowed !important;
          filter: none !important;
        }
        .cli-btn-pro--off .cli-btn-pro-badge {
          background: #9A8B93;
          color: #fff;
        }
        .cli-btn-pro--off:active { transform: none !important; }

        /* ═══ HEADER DESKTOP ═══ */
        .cli-page-hdr {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: var(--space-4);
          padding: 0;
        }
        .cli-page-title {
          font-size: var(--text-2xl);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.02em;
          margin: 0;
        }
        .cli-page-sub {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 4px 0 0;
        }
        .cli-page-actions { display: flex; gap: var(--space-2); align-items: center; }

        /* ═══ Busca + Filtro linha ═══ */
        .cli-search-row {
          display: flex; gap: var(--space-2);
          align-items: center;
          margin-bottom: var(--space-3);
          position: relative;
        }
        .cli-search-row > .mob-search-wrap,
        .cli-search-row > .cli-search-wrap { flex: 1; margin-bottom: 0; }

        /* Botão de filtro */
        .cli-filter-btn {
          width: 40px; height: 40px;
          border: 1.5px solid var(--border);
          background: var(--bg-card);
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--text-secondary);
          position: relative;
          transition: all var(--dur-fast);
          flex-shrink: 0;
        }
        .cli-filter-btn:hover { border-color: var(--primary); color: var(--primary); }
        .cli-filter-dot {
          position: absolute;
          top: -3px; right: -3px;
          width: 10px; height: 10px;
          background: var(--primary);
          border: 2px solid var(--bg-card);
          border-radius: 50%;
        }

        /* Painel filtro */
        .cli-filter-backdrop {
          position: fixed; inset: 0; z-index: 40;
        }
        .cli-filter-panel {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--bg-card);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          width: 240px;
          z-index: 50;
          border: 1px solid var(--border);
        }
        .cli-filter-title {
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: var(--space-2);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
        }
        .cli-filter-opt {
          display: flex; align-items: center;
          gap: var(--space-2);
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          font-size: var(--text-sm);
          cursor: pointer;
          margin-bottom: 2px;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          font-family: var(--font-base) !important;
          color: var(--text-title);
          transition: background var(--dur-fast);
        }
        .cli-filter-opt:hover { background: var(--accent-bg, #F5EEF0); }
        .cli-filter-opt--active {
          background: var(--primary-light);
          color: var(--primary);
          font-weight: var(--fw-black);
        }
        .cli-filter-radio {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid var(--border);
          flex-shrink: 0;
        }
        .cli-filter-opt--active .cli-filter-radio {
          border-color: var(--primary);
          background: var(--primary);
          box-shadow: inset 0 0 0 2px var(--bg-card);
        }
        .cli-filter-count {
          margin-left: auto;
          color: var(--text-muted);
          font-size: var(--text-xs);
          font-weight: var(--fw-medium);
        }
        .cli-filter-opt--active .cli-filter-count {
          color: var(--primary);
          font-weight: var(--fw-black);
        }

        /* ═══ Cliente desde X (mais colado no nome) ═══ */
        .mob-since, .cli-since {
          font-size: var(--text-xs);
          color: var(--text-muted);
          margin: 1px 0 0;
          font-weight: var(--fw-medium);
          line-height: 1.3;
        }

        /* ═══ MODAL "DESCARTAR?" (guard) ═══ */
        .cli-discard-ov {
          position: fixed; inset: 0; z-index: 1200;
          background: rgba(45, 31, 38, 0.75);
          backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4);
          animation: cliDiscOvIn 0.2s ease;
          font-family: var(--font-base);
        }
        @keyframes cliDiscOvIn { from { opacity: 0; } to { opacity: 1; } }
        .cli-discard-box {
          background: var(--bg-card);
          border-radius: var(--radius-xl);
          padding: var(--space-5) var(--space-4);
          max-width: 360px; width: 100%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: cliDiscBoxIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes cliDiscBoxIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .cli-discard-box, .cli-discard-box * { font-family: var(--font-base) !important; }

        .cli-discard-icon {
          font-size: 32px;
          margin-bottom: var(--space-2);
          filter: drop-shadow(0 2px 8px rgba(232,90,140,0.3));
        }
        .cli-discard-title {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0 0 var(--space-2);
          letter-spacing: -0.01em;
        }
        .cli-discard-desc {
          font-size: var(--text-sm);
          color: var(--text-secondary);
          margin: 0 0 var(--space-4);
          line-height: 1.5;
        }
        .cli-discard-actions {
          display: flex; flex-direction: column;
          gap: var(--space-2);
        }
        .cli-discard-btn {
          padding: 12px;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-family: var(--font-base) !important;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .cli-discard-btn--stay {
          background: var(--primary);
          color: var(--text-inverse);
          box-shadow: 0 4px 0 var(--primary-dark);
        }
        .cli-discard-btn--stay:hover { filter: brightness(1.05); }
        .cli-discard-btn--stay:active {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .cli-discard-btn--go {
          background: transparent;
          color: #DC2626;
          border: 1.5px solid #FEE2E2;
        }
        .cli-discard-btn--go:hover {
          background: #FEE2E2;
          border-color: #DC2626;
        }
        .cli-imp-ov {
          position: fixed; inset: 0; z-index: 1100;
          background: rgba(45, 31, 38, 0.6);
          backdrop-filter: blur(6px);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          animation: cliImpOvIn 0.2s ease;
          font-family: var(--font-base);
        }
        @keyframes cliImpOvIn { from { opacity: 0; } to { opacity: 1; } }
        .cli-imp-modal {
          background: var(--bg-card);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          width: 100%;
          max-width: 100%;
          max-height: 92vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: cliImpModalIn 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes cliImpModalIn {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .cli-imp-modal, .cli-imp-modal * { font-family: var(--font-base) !important; }

        .cli-imp-hdr {
          background: linear-gradient(180deg, var(--accent-bg, #F5EEF0), var(--bg-card));
          padding: var(--space-4);
          display: flex; align-items: center;
          gap: var(--space-3);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .cli-imp-icon {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--text-inverse);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xl);
          flex-shrink: 0;
        }
        .cli-imp-hdr-t { flex: 1; min-width: 0; }
        .cli-imp-title {
          font-size: var(--text-md);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: -0.01em;
          margin: 0;
        }
        .cli-imp-sub {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin: 2px 0 0;
        }
        .cli-imp-close {
          width: 32px; height: 32px;
          border: none; background: transparent;
          color: var(--text-muted);
          font-size: var(--text-lg);
          cursor: pointer;
          border-radius: var(--radius-full);
        }
        .cli-imp-close:hover:not(:disabled) { background: var(--bg-subtle); }
        .cli-imp-close:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Stats */
        .cli-imp-stats {
          display: flex; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--accent-bg, #F5EEF0);
          border-bottom: 1px solid var(--border);
        }
        .cli-imp-stat {
          flex: 1;
          background: var(--bg-card);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          text-align: center;
          border: 1.5px solid var(--border);
        }
        .cli-imp-stat-v {
          font-size: var(--text-lg);
          font-weight: var(--fw-black);
          color: var(--primary);
          line-height: 1;
        }
        .cli-imp-stat-v--gray { color: var(--text-muted); }
        .cli-imp-stat-v--green { color: #16A34A; }
        .cli-imp-stat-l {
          font-size: 0.6rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: var(--fw-bold);
          margin-top: 4px;
        }

        /* List */
        .cli-imp-list {
          flex: 1;
          padding: var(--space-2) var(--space-3);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .cli-imp-item {
          display: flex; align-items: center;
          gap: var(--space-3);
          padding: 10px 8px;
          border-radius: var(--radius-md);
          border: 1.5px solid transparent;
          margin-bottom: 4px;
          transition: background var(--dur-fast);
        }
        .cli-imp-item--sel { background: var(--primary-light); border-color: rgba(232,90,140,0.2); }
        .cli-imp-item--dup { opacity: 0.6; background: #FEF3C7; }
        .cli-imp-item--warn { background: #FEF3C7; }
        .cli-imp-check {
          width: 22px; height: 22px;
          border-radius: 6px;
          border: 2px solid var(--border);
          background: var(--bg-card);
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          color: var(--text-muted);
        }
        .cli-imp-check--on {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--text-inverse);
        }
        .cli-imp-check--disabled {
          background: var(--bg-subtle);
          border-color: var(--border);
          cursor: not-allowed;
        }
        .cli-imp-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          color: var(--text-inverse);
          display: flex; align-items: center; justify-content: center;
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          flex-shrink: 0;
        }
        .cli-imp-avatar--gray { background: var(--bg-subtle); color: var(--text-muted); }
        .cli-imp-info { flex: 1; min-width: 0; }
        .cli-imp-nome {
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cli-imp-tel {
          font-size: var(--text-xs);
          color: var(--text-secondary);
          margin-top: 1px;
        }
        .cli-imp-tag {
          padding: 3px 8px;
          border-radius: var(--radius-full);
          font-size: 0.6rem;
          font-weight: var(--fw-black);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .cli-imp-tag--new { background: #DCFCE7; color: #14532D; }
        .cli-imp-tag--dup { background: #FEF3C7; color: #92400E; }
        .cli-imp-tag--warn { background: #FEE2E2; color: #991B1B; }

        /* Toolbar */
        .cli-imp-toolbar {
          display: flex; justify-content: space-between;
          padding: 8px var(--space-4);
          background: var(--accent-bg, #F5EEF0);
          border-top: 1px solid var(--border);
        }
        .cli-imp-toolbar-btn {
          background: transparent;
          border: none;
          color: var(--primary);
          font-size: var(--text-xs);
          font-weight: var(--fw-black);
          cursor: pointer;
          padding: 4px 8px;
          font-family: var(--font-base) !important;
        }
        .cli-imp-toolbar-btn:hover { text-decoration: underline; }

        /* Footer */
        .cli-imp-footer {
          padding: var(--space-3) var(--space-4);
          padding-bottom: calc(var(--space-3) + env(safe-area-inset-bottom));
          display: flex; gap: var(--space-2);
          background: var(--bg-card);
          border-top: 1px solid var(--border);
        }
        .cli-imp-btn-cancel {
          flex: 1;
          padding: 12px;
          background: var(--accent-bg, #F5EEF0);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
          font-family: var(--font-base) !important;
        }
        .cli-imp-btn-import {
          flex: 2;
          padding: 12px;
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 4px 0 var(--primary-dark);
          font-family: var(--font-base) !important;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .cli-imp-btn-import:hover:not(:disabled) { filter: brightness(1.05); }
        .cli-imp-btn-import:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 var(--primary-dark);
        }
        .cli-imp-btn-import:disabled {
          background: var(--text-disabled);
          box-shadow: 0 4px 0 #A8A0A4;
          cursor: not-allowed;
        }

        /* Desktop modal */
        @media (min-width: 900px) {
          .cli-imp-ov {
            align-items: center;
            padding: var(--space-6);
          }
          .cli-imp-modal {
            border-radius: var(--radius-xl);
            max-width: 560px;
            max-height: 85vh;
          }
        }

        /* ═══ CHIPS DE FILTRO ═══ */
        .cli-chips {
          display: flex; gap: var(--space-2);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding: 0 var(--space-1);
          margin: 0 -4px;
        }
        .cli-chips::-webkit-scrollbar { display: none; }
        .cli-chip {
          background: var(--bg-card);
          border: 1.5px solid var(--border);
          padding: 8px 14px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          cursor: pointer;
          font-family: var(--font-base) !important;
          white-space: nowrap;
          display: inline-flex; align-items: center; gap: 4px;
          transition: all var(--dur-fast);
          flex-shrink: 0;
        }
        .cli-chip:hover { border-color: var(--primary); }
        .cli-chip--active {
          background: var(--primary);
          border-color: var(--primary);
          color: var(--text-inverse);
        }
        .cli-chip-count {
          background: rgba(0,0,0,0.1);
          padding: 1px 6px;
          border-radius: var(--radius-full);
          font-size: 0.65rem;
          font-weight: var(--fw-black);
        }
        .cli-chip--active .cli-chip-count {
          background: rgba(255,255,255,0.25);
        }

        /* ═══ BANNER ANIVERSARIANTES ═══ */
        .cli-aniv-banner {
          background: linear-gradient(135deg, #FEF3C7, #FDE68A);
          border: 1.5px solid #FCD34D;
          padding: 12px 14px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; gap: 12px;
          cursor: pointer;
          font-family: var(--font-base) !important;
          text-align: left;
          transition: transform var(--dur-fast) var(--ease-out);
          width: 100%;
        }
        .cli-aniv-banner:hover { transform: translateY(-2px); }
        .cli-aniv-banner-icon { font-size: 22px; flex-shrink: 0; }
        .cli-aniv-banner-body { flex: 1; min-width: 0; }
        .cli-aniv-banner-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          color: #92400E;
          line-height: 1.2;
        }
        .cli-aniv-banner-d {
          font-size: var(--text-xs);
          color: #92400E;
          margin-top: 2px;
          opacity: 0.85;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cli-aniv-banner-arrow {
          font-size: var(--text-lg);
          color: #92400E;
          font-weight: var(--fw-black);
          flex-shrink: 0;
        }

        /* ═══ TOAST ═══ */
        .cli-toast {
          position: fixed;
          top: var(--space-4);
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #16A34A, #15803D);
          color: var(--text-inverse);
          padding: 12px 14px 12px 16px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; gap: 12px;
          box-shadow: 0 10px 30px rgba(22,163,74,0.35);
          z-index: 2000;
          animation: cliToastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-base) !important;
          width: calc(100% - 32px);
          max-width: 420px;
        }
        @keyframes cliToastIn {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to   { transform: translate(-50%, 0); opacity: 1; }
        }
        .cli-toast-icon {
          background: rgba(255,255,255,0.25);
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cli-toast-body { flex: 1; min-width: 0; }
        .cli-toast-t {
          font-size: var(--text-sm);
          font-weight: var(--fw-black);
          line-height: 1.2;
        }
        .cli-toast-d {
          font-size: var(--text-xs);
          opacity: 0.9;
          margin-top: 2px;
        }
        .cli-toast-btn {
          background: rgba(255,255,255,0.25);
          color: var(--text-inverse);
          border: none;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: var(--text-xs);
          font-weight: var(--fw-bold);
          cursor: pointer;
          font-family: var(--font-base) !important;
          transition: background var(--dur-fast);
          flex-shrink: 0;
        }
        .cli-toast-btn:hover { background: rgba(255,255,255,0.35); }
        .cli-toast-close {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.7);
          padding: 4px;
          cursor: pointer;
          font-size: var(--text-md);
          flex-shrink: 0;
        }
        .cli-toast-close:hover { color: var(--text-inverse); }

        @media (min-width: 900px) {
          .cli-toast {
            left: auto;
            right: var(--space-5);
            transform: none;
          }
          @keyframes cliToastIn {
            from { transform: translateY(-100%); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
          }
        }
      `}</style>
      </>
      )}
      </>
      )}
    </div>
    </>
  );
}
