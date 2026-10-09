import { useState, useEffect, useRef } from "react";
import DataNascimentoSheet, { rotuloNascimento } from "@/components/DataNascimentoSheet";
import LimitePlano from "@/components/billing/LimitePlano";
import { LIMITE_CLIENTES_GRATIS } from "@/lib/limitesPlano";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile, isPro } from "@/hooks/useProfile";
import AppPageHeader from "@/components/AppPageHeader";
import ReqTag from "@/components/ReqTag";
import { Botao, Campo, CampoArea, Janela, TelaVazia, avisar, confirmar } from "@/components/base";
import { AddressBook, Cake, CalendarBlank, Camera, CaretDown, CaretRight, MagnifyingGlass, Plus, Trash, UsersThree, WarningCircle, WhatsappLogo, X } from "@phosphor-icons/react";
import "./clientes.css";

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
  // ── Métricas agregadas (calculadas em fetchClientes) ──
  _totalPedidos?: number;
  _totalGasto?: number;
  _ticketMedio?: number;
  _ultimaCompra?: string | null; // ISO
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
const SEXO_OPTIONS   = ["Feminino", "Masculino", "Prefiro não informar"];
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

/** "AAAA-MM-DD" como data LOCAL (new Date("1990-10-02") é UTC e no Brasil vira dia 1º) */
function dataLocal(data: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(data);
}

function getDaysUntil(data: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const nasc = dataLocal(data);
  const aniv = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
  if (aniv < hoje) aniv.setFullYear(hoje.getFullYear() + 1);
  return Math.ceil((aniv.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function getHoursUntil(data: string) {
  const hoje = new Date();
  const nasc = dataLocal(data);
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

/** "Cliente novo" (até 30 dias) ou "Cliente desde out/2026" (02/10) */
function clienteDesde(created_at: string): string {
  const d = new Date(created_at);
  if (isNaN(d.getTime())) return "";
  if ((Date.now() - d.getTime()) / 86400000 < 30) return "Cliente novo";
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `Cliente desde ${mes}/${d.getFullYear()}`;
}

// "Cliente há X" — tempo relativo compacto
function formatClienteHa(created_at: string): string {
  const d = new Date(created_at);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Cliente novo";
  if (diffDays < 7) return `Cliente há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
  if (diffDays < 30) {
    const semanas = Math.floor(diffDays / 7);
    return `Cliente há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  if (diffDays < 365) {
    const meses = Math.floor(diffDays / 30);
    return `Cliente há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  const anos = Math.floor(diffDays / 365);
  return `Cliente há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

// Última compra: "hoje", "ontem", "há X dias", ou data
function formatUltimaCompra(isoStr?: string | null): string {
  if (!isoStr) return "Sem pedidos";
  const d = new Date(isoStr);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays < 30) {
    const semanas = Math.floor(diffDays / 7);
    return `há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`;
  }
  if (diffDays < 365) {
    const meses = Math.floor(diffDays / 30);
    return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  const anos = Math.floor(diffDays / 365);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

function formatMoneyCompacto(v?: number): string {
  const n = v || 0;
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMoneyFull(v?: number): string {
  return (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Clientes() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes,      setClientes]      = useState<Cliente[]>([]);
  // Plano grátis: até 50 clientes (quem já tinha mais continua com tudo; só não cria novos)
  const [limiteAberto, setLimiteAberto] = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [userId,        setUserId]        = useState<string | null>(null);
  const [toast,         setToast]         = useState<{ nome: string; id: string } | null>(null);
  const [toastImport,   setToastImport]   = useState<{ importados: number; duplicados: number } | null>(null);
  const [filtroChip,    setFiltroChip]    = useState<"todos" | "aniversariantes" | "recentes" | "sumidas">("todos");

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
  const [niverAberto, setNiverAberto] = useState(false);
  const [preview,       setPreview]       = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [cepLoading,    setCepLoading]    = useState(false);
  const [avancadoOpen,  setAvancadoOpen]  = useState(false);
  const [tentouSalvar,  setTentouSalvar]  = useState(false); // mostra o que falta só depois de tocar em salvar

  // Modais
  const [showNiver,     setShowNiver]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  // Editar aberto pela página da cliente: ao fechar ou salvar, volta pra ela (08/10 · 3.34)
  const voltarPerfil = useRef<string | null>(null);
  // (espera a janela fechar: ao fechar, ela tira do histórico a entrada que colocou pro voltar do Android)
  const talvezVoltar = () => { const v = voltarPerfil.current; voltarPerfil.current = null; if (v) setTimeout(() => navigate(`/clientes/${v}`, { replace: true }), 350); };

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
        voltarPerfil.current = searchParams.get("volta") === "1" ? cliente.id : null;
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
    const isOpen = !!confirmDelete;
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
  }, [confirmDelete]);

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchClientes = async (uid: string) => {
    setLoading(true);
    // Busca clientes e pedidos em paralelo
    const [{ data: cls }, { data: peds }] = await Promise.all([
      supabase.from("clientes").select("*").eq("user_id", uid).order("nome"),
      supabase.from("pedidos")
        .select("cliente_id, valor_total, valor_recebido, data_entrega, created_at, status")
        .eq("user_id", uid)
    ]);

    if (cls) {
      // Agrupa métricas por cliente_id em memória (O(n) — 1 pass só)
      type Agg = { total: number; totalValor: number; ultima: string | null };
      const map = new Map<string, Agg>();
      (peds || []).forEach((p: any) => {
        if (!p.cliente_id) return;
        if (p.status === "cancelado") return; // ignora cancelados
        const agg = map.get(p.cliente_id) || { total: 0, totalValor: 0, ultima: null };
        agg.total += 1;
        agg.totalValor += Number(p.valor_total) || 0;
        // Última compra = quando o pedido foi feito (08/10: antes usava a data de entrega,
        // e um pedido marcado pra semana que vem aparecia como "há -5 dias")
        const dataRef = p.created_at || p.data_entrega;
        if (dataRef && (!agg.ultima || dataRef > agg.ultima)) {
          agg.ultima = dataRef;
        }
        map.set(p.cliente_id, agg);
      });

      // Enriquece cada cliente com as métricas
      const enriquecidos: Cliente[] = cls.map((c: Cliente) => {
        const a = map.get(c.id);
        if (!a) {
          return { ...c, _totalPedidos: 0, _totalGasto: 0, _ticketMedio: 0, _ultimaCompra: null };
        }
        return {
          ...c,
          _totalPedidos: a.total,
          _totalGasto: a.totalValor,
          _ticketMedio: a.total > 0 ? a.totalValor / a.total : 0,
          _ultimaCompra: a.ultima,
        };
      });
      setClientes(enriquecidos);
    }
    setLoading(false);
  };

  // ── Form helpers ──────────────────────────────────────────────────────────

  const openNew = (_mode?: FormMode) => {
    if (!usuarioEhPro && clientes.length >= LIMITE_CLIENTES_GRATIS) { setLimiteAberto(true); return; }
    setFormMode("completo");
    setEditando(null);
    setRapido(emptyRapido);
    setCompleto(emptyCompleto);
    setPreview(null);
    setAvancadoOpen(false);
    setTentouSalvar(false);
    setShowForm(true);
  };

  const openEdit = (c: Cliente) => {
    setFormMode("completo");
    setEditando(c.id);
    setRapido({ nome: c.nome, whatsapp: c.whatsapp || "", email: c.email || "", observacoes: c.observacoes || "", data_nascimento: c.data_nascimento || "" });
    setCompleto({
      nome: c.nome || "", nome_contato: c.nome_contato || "", email: c.email || "",
      whatsapp: maskPhone((c.whatsapp || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "")), cpf_cnpj: c.cpf_cnpj || "", data_nascimento: c.data_nascimento || "",
      sexo: c.sexo || "", observacoes: c.observacoes || "", foto_url: c.foto_url || "",
      cep: c.cep || "", rua: c.rua || "", numero: c.numero || "", complemento: c.complemento || "",
      bairro: c.bairro || "", cidade: c.cidade || "", estado: c.estado || "", pais: c.pais || "Brasil",
      origem: c.origem || c.como_conheceu || "",
    });
    setPreview(c.foto_url || null);
    // Se cliente tem dados extras, abre avançado automaticamente
    const temExtras = !!(c.foto_url || c.data_nascimento || c.sexo || c.email || c.cpf_cnpj || c.cep || c.rua || c.bairro || c.observacoes || c.origem || c.como_conheceu);
    setAvancadoOpen(temExtras);
    setTentouSalvar(false);
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
        avisar("Não deu pra salvar agora. Confira a internet e tente de novo.", { tipo: "erro" });
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error) {
        avisar("Não deu pra cadastrar agora. Confira a internet e tente de novo.", { tipo: "erro" });
        setSaving(false);
        return;
      }
      if (inserted) savedId = inserted.id;
    }

    await fetchClientes(userId);
    setShowForm(false);
    const wasEditing = !!editando;
    if (wasEditing && voltarPerfil.current) { talvezVoltar(); setEditando(null); setSaving(false); avisar("Salvo", { tipo: "ok" }); return; }
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

  const fecharForm = () => { setShowForm(false); setEditando(null); setTimeout(() => setCompleto(emptyCompleto), 250); talvezVoltar(); };
  const tryCloseForm = async () => {
    if (!hasFormData()) { setShowForm(false); talvezVoltar(); return; }
    const ok = await confirmar({ titulo: editando ? "Sair sem salvar?" : "Descartar o cadastro?", texto: editando ? "As mudanças que você fez nesta cliente vão se perder." : "O que você preencheu vai se perder.", rotulo: editando ? "Sair sem salvar" : "Descartar", rotuloVoltar: "Continuar editando", perigo: true, icone: "alerta" });
    if (ok) fecharForm();
  };
  // Cadastrar/Salvar: mostra embaixo de cada campo o que falta (antes o botão ficava apagado sem dizer por quê)
  const salvarComAviso = () => {
    setTentouSalvar(true);
    if (!completo.nome.trim() || (completo.whatsapp || "").replace(/\D/g, "").length < 10) return;
    handleSave();
  };
  const excluirDoForm = async () => {
    if (!editando) return;
    const id = editando;
    const ok = await confirmar({ titulo: "Excluir esta cliente?", texto: "O cadastro some da lista. Os pedidos dela continuam salvos.", rotulo: "Excluir", perigo: true, icone: "erro" });
    if (!ok) return;
    voltarPerfil.current = null; // a cliente foi excluída: fica na lista
    fecharForm();
    await handleDelete(id);
    avisar("Cliente excluída", { tipo: "ok" });
  };
  // Número que já é de outra cliente (pra não cadastrar a mesma pessoa duas vezes)
  const digitosForm = (completo.whatsapp || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const clienteRepetido = digitosForm.length >= 10
    ? clientes.find(c => c.id !== editando && (c.whatsapp || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "") === digitosForm) || null
    : null;

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
      avisar("Importar contatos só funciona no Chrome do Android.", { tipo: "info" });
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

  // Importar (PRO): quem é do grátis vê o convite do PRO em vez de um botão apagado
  const importarContatos = async () => {
    if (!usuarioEhPro) {
      const ok = await confirmar({ titulo: "Importar contatos é do PRO", texto: "No PRO você traz os clientes direto da agenda do celular, sem digitar um por um.", rotulo: "Conhecer o PRO", icone: "info" });
      if (ok) navigate("/assinar");
      return;
    }
    handleAbrirImportarContatos();
  };

  const handleConfirmImport = async () => {
    if (!importSheet || !userId) return;
    const paraCadastrar = importSheet.filter(c => c.selecionado && !c.duplicado && c.nome && c.telefoneNormalizado.length >= 10);
    if (paraCadastrar.length === 0) return;
    if (!usuarioEhPro && clientes.length + paraCadastrar.length > LIMITE_CLIENTES_GRATIS) { setLimiteAberto(true); return; }

    setImporting(true);
    const payloads = paraCadastrar.map(c => ({
      user_id: userId,
      nome: c.nome,
      whatsapp: c.telefone,
    }));

    const { data, error } = await supabase.from("clientes").insert(payloads).select("id");
    setImporting(false);

    if (error) {
      avisar("Não deu pra importar agora. Confira a internet e tente de novo.", { tipo: "erro" });
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

  const diasDesde = (iso?: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity;
  // Novos cadastros: últimos 30 dias · Sem comprar: já comprou, mas não nos últimos 60 dias
  const recentesIds = new Set(clientes.filter(c => diasDesde(c.created_at) <= 30).map(c => c.id));
  const sumidasIds = new Set(clientes.filter(c => (c._totalPedidos || 0) > 0 && diasDesde(c._ultimaCompra) > 60).map(c => c.id));

  const termo = search.trim().toLowerCase();
  const termoDigitos = termo.replace(/\D/g, "");
  const filtered = clientes.filter(c => {
    if (filtroChip === "aniversariantes" && !aniversarianteIds.has(c.id)) return false;
    if (filtroChip === "recentes" && !recentesIds.has(c.id)) return false;
    if (filtroChip === "sumidas" && !sumidasIds.has(c.id)) return false;
    if (!termo) return true;
    // Busca pelo nome, pelo e-mail ou pelos números do telefone (com ou sem parênteses e traço)
    return c.nome.toLowerCase().includes(termo) ||
      (!!termoDigitos && (c.whatsapp || "").replace(/\D/g, "").includes(termoDigitos)) ||
      !!c.email?.toLowerCase().includes(termo);
  });

  const aniversariantes = clientes
    .filter(c => c.data_nascimento && getDaysUntil(c.data_nascimento) <= 30)
    .sort((a, b) => getDaysUntil(a.data_nascimento!) - getDaysUntil(b.data_nascimento!));

  // ── Form JSX ──────────────────────────────────────────────────────────────

  // Iniciais pra avatar preview
  const iniciais = (completo.nome || "").trim().split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase() || "").join("") || "?";

  const formJSX = (
    <Janela aberta={showForm} aoFechar={tryCloseForm} tipo="conteudo" titulo={editando ? "Editar cliente" : "Novo cliente"}
      acoes={<>
        <Botao variante="secundario" onClick={tryCloseForm}>Cancelar</Botao>
        <Botao carregando={saving} onClick={salvarComAviso}>{editando ? "Salvar" : "Cadastrar cliente"}</Botao>
      </>}>
      <div className="cl9-f">
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} hidden />
        <button type="button" className="cl9-f-foto" onClick={() => fileRef.current?.click()}>
          <span className="cl9-f-av">{preview ? <img src={preview} alt="" /> : <Camera size={26} weight="bold" />}</span>
          <span><b>{preview ? "Trocar a foto" : "Colocar uma foto"}</b><small>Opcional · ajuda a lembrar quem é</small></span>
        </button>

        <Campo rotulo="Nome" obrigatorio placeholder="Ex.: Ana Beatriz" autoComplete="off" value={completo.nome}
          onChange={e => setCompleto(f => ({ ...f, nome: e.target.value }))}
          erro={tentouSalvar && !completo.nome.trim() ? "Falta o nome" : undefined} />
        <Campo rotulo="WhatsApp" obrigatorio type="tel" inputMode="tel" placeholder="(00) 9 0000-0000" autoComplete="off" maxLength={16} value={completo.whatsapp}
          onChange={e => setCompleto(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))}
          erro={tentouSalvar && (completo.whatsapp || "").replace(/\D/g, "").length < 10 ? "Coloque o número com DDD" : undefined} />
        {clienteRepetido && (
          <div className="cl9-f-dup" role="status">
            <WarningCircle size={22} weight="bold" />
            <span><b>Esse número já é de {clienteRepetido.nome}</b><small>Pra não ficar repetido, abra o cadastro.</small></span>
            <button type="button" onClick={() => { setShowForm(false); setEditando(null); navigate(`/clientes/${clienteRepetido.id}`); }}>Abrir</button>
          </div>
        )}
        <div className="cl9-f-data">
          <Campo rotulo="Aniversário" opcional readOnly placeholder="Escolher a data" value={completo.data_nascimento ? rotuloNascimento(completo.data_nascimento) : ""}
            icone={<CalendarBlank size={20} weight="bold" />} onClick={() => setNiverAberto(true)}
            dica="A gente avisa uns dias antes, pra você mandar os parabéns." />
          {completo.data_nascimento && <button type="button" className="cl9-f-limpar" aria-label="Tirar o aniversário" onClick={() => setCompleto(f => ({ ...f, data_nascimento: "" }))}><X size={18} weight="bold" /></button>}
        </div>
        {niverAberto && <DataNascimentoSheet valor={completo.data_nascimento || ""} onEscolher={v => setCompleto(f => ({ ...f, data_nascimento: v }))} onClose={() => setNiverAberto(false)} />}

        <button type="button" className={`cl9-f-mais${avancadoOpen ? " on" : ""}`} aria-expanded={avancadoOpen} onClick={() => setAvancadoOpen(o => !o)}>
          <span><b>Mais detalhes</b><small>Endereço, e-mail, CPF, como conheceu e observações</small></span>
          <CaretDown size={20} weight="bold" />
        </button>
        {avancadoOpen && (
          <div className="cl9-f-extra">
            <p className="cl9-f-sec">Endereço</p>
            <div className="cl9-f-2">
              <Campo rotulo="CEP" inputMode="numeric" placeholder="00000-000" autoComplete="off" value={completo.cep}
                dica={cepLoading ? "Procurando…" : "Preenche a rua sozinho"}
                onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 8); setCompleto(f => ({ ...f, cep: v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v })); fetchCep(v); }} />
              <Campo rotulo="Número" autoComplete="off" value={completo.numero} onChange={e => setCompleto(f => ({ ...f, numero: e.target.value }))} />
            </div>
            <Campo rotulo="Rua" autoComplete="off" value={completo.rua} onChange={e => setCompleto(f => ({ ...f, rua: e.target.value }))} />
            <Campo rotulo="Complemento" opcional placeholder="Apto, bloco…" autoComplete="off" value={completo.complemento} onChange={e => setCompleto(f => ({ ...f, complemento: e.target.value }))} />
            <div className="cl9-f-2">
              <Campo rotulo="Bairro" autoComplete="off" value={completo.bairro} onChange={e => setCompleto(f => ({ ...f, bairro: e.target.value }))} />
              <Campo rotulo="Cidade" autoComplete="off" value={completo.cidade} onChange={e => setCompleto(f => ({ ...f, cidade: e.target.value }))}
                depois={completo.estado ? <span className="cl9-f-uf">{completo.estado}</span> : undefined} />
            </div>

            <p className="cl9-f-sec">Contato e documento</p>
            <Campo rotulo="E-mail" opcional type="email" inputMode="email" placeholder="nome@email.com" autoComplete="off" value={completo.email} onChange={e => setCompleto(f => ({ ...f, email: e.target.value }))} />
            <Campo rotulo="CPF ou CNPJ" opcional inputMode="numeric" placeholder="Pra nota ou recibo" autoComplete="off" value={completo.cpf_cnpj} onChange={e => setCompleto(f => ({ ...f, cpf_cnpj: e.target.value }))} />

            <p className="cl9-f-sec">Como conheceu a sua loja</p>
            <div className="cl9-f-chips">
              {ORIGEM_OPTIONS.map(o => (
                <button key={o} type="button" aria-pressed={completo.origem === o} onClick={() => setCompleto(f => ({ ...f, origem: f.origem === o ? "" : o }))}>{o}</button>
              ))}
            </div>
            <CampoArea rotulo="Observações" opcional rows={3} placeholder="Alergias, do que mais gosta, como prefere receber…" value={completo.observacoes} onChange={e => setCompleto(f => ({ ...f, observacoes: e.target.value }))} />

          </div>
        )}
        {editando && <button type="button" className="cl9-f-excluir" onClick={excluirDoForm}><Trash size={20} weight="bold" />Excluir cliente</button>}
      </div>
    </Janela>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {limiteAberto && <LimitePlano tipo="clientes" limite={LIMITE_CLIENTES_GRATIS} onClose={() => setLimiteAberto(false)} />}
    <AppPageHeader
      title="Clientes"
      subtitle={loading ? "Quem compra de você" : clientes.length === 0 ? "Quem compra de você" : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
      infoContent={
        <>
          <p>Aqui ficam as pessoas que compram de você: nome, WhatsApp, endereço, aniversário e o histórico de pedidos.</p>
          <p>Quem pede pelo cardápio entra aqui sozinho. Quem compra pelo WhatsApp ou no balcão, você cadastra.</p>
        </>
      }
      infoTip={<>Toque numa cliente pra ver os <strong>pedidos</strong> e quanto ela já gastou.</>}
    />
    <div className="cli-root">

      {/* ═══ Carregando (evita piscar) ═══ */}
      {loading ? (
        <div className="cl9"><div className="cl9-esq" aria-label="Carregando clientes">{[0, 1, 2, 3, 4].map(i => <span key={i} />)}</div></div>
      ) : (
      <>

      {/* ═══ Sem clientes ═══ */}
      {clientes.length === 0 ? (
        <div className="cl9">
          <TelaVazia caixa icone={<UsersThree size={30} />} titulo="Nenhum cliente ainda"
            texto="Quem pede pelo cardápio entra aqui sozinho. Você também pode cadastrar quem compra pelo WhatsApp ou no balcão."
            acao={<div className="cl9-vz-acoes">
              <Botao icone={<Plus size={20} weight="bold" />} onClick={() => openNew()}>Cadastrar cliente</Botao>
              {suportaContatos && <Botao variante="secundario" icone={<AddressBook size={20} weight="bold" />} onClick={importarContatos}>Importar dos contatos<i className="cl9-pro">PRO</i></Botao>}
            </div>} />
        </div>
      ) : (() => {
        // ── Números do topo (calculados dos pedidos que já vêm com cada cliente) ──
        const agora = Date.now();
        const dias = (iso?: string | null) => iso ? Math.floor((agora - new Date(iso).getTime()) / 86400000) : Infinity;
        const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
        const novosMes = clientes.filter(c => c.created_at && new Date(c.created_at) >= inicioMes).length;
        const compraram30 = clientes.filter(c => dias(c._ultimaCompra) <= 30).length;
        const somaPed = clientes.reduce((s, c) => s + (c._totalPedidos || 0), 0);
        const somaGasto = clientes.reduce((s, c) => s + (c._totalGasto || 0), 0);
        const ticketGeral = somaPed > 0 ? somaGasto / somaPed : 0;
        const parte = clientes.length ? compraram30 / clientes.length : 0;
        const parteTxt = compraram30 === 0 ? "ninguém ainda" : parte >= 0.99 ? "todos os clientes" : parte >= 0.45 && parte <= 0.55 ? "metade dos clientes" : `${Math.round(parte * 100)}% dos clientes`;
        const prox = aniversariantes[0] ? getDaysUntil(aniversariantes[0].data_nascimento!) : null;
        const quandoNiver = (d: number) => d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`;
        const qtdFiltro = { todos: clientes.length, aniversariantes: aniversariantes.length, recentes: recentesIds.size, sumidas: sumidasIds.size };
        const linkWhats = (c: Cliente, texto?: string) => {
          let d = (c.whatsapp || "").replace(/\D/g, "");
          if (!d) return null;
          if (!d.startsWith("55")) d = "55" + d;
          return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
        };
        const primeiroNome = (n: string) => (n || "").trim().split(/\s+/)[0] || "";
        const niverCurto = (data?: string | null) => {
          if (!data) return "—";
          const d = dataLocal(data);
          return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
        };
        const iniciaisDe = (n: string) => (n || "?").trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("");
        const Avatar = ({ c }: { c: Cliente }) => <span className="cl9-av">{c.foto_url ? <img src={c.foto_url} alt="" /> : iniciaisDe(c.nome)}</span>;
        const Etiqueta = ({ c }: { c: Cliente }) => {
          if (c.data_nascimento) { const d = getDaysUntil(c.data_nascimento); if (d <= 7) return <i className="cl9-tag cl9-tag--niver"><Cake size={14} weight="bold" />Aniversário {quandoNiver(d)}</i>; }
          if (recentesIds.has(c.id) && (c._totalPedidos || 0) <= 1) return <i className="cl9-tag cl9-tag--novo">Novo cadastro</i>;
          return null;
        };
        const ultimaTxt = (c: Cliente) => { const t = formatUltimaCompra(c._ultimaCompra); return t ? t.charAt(0).toUpperCase() + t.slice(1) : "—"; };
        const linha2 = (c: Cliente) => {
          const n = c._totalPedidos || 0;
          return n ? `${n} ${n === 1 ? "pedido" : "pedidos"} · comprou ${formatUltimaCompra(c._ultimaCompra)}` : "Ainda não comprou";
        };
        const BotaoZap = ({ c }: { c: Cliente }) => {
          const wa = linkWhats(c);
          return wa ? <a className="cl9-zap" href={wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${c.nome}`} onClick={e => e.stopPropagation()}><WhatsappLogo size={22} weight="bold" /></a> : null;
        };

        return (
          <div className="cl9">
            <div className="cl9-nums" role="list">
              <div role="listitem"><small>Clientes</small><b>{clientes.length}</b><em className={novosMes > 0 ? "ok" : ""}>{novosMes > 0 ? `+${novosMes} este mês` : "nenhum novo este mês"}</em></div>
              <div role="listitem"><small>Compraram em 30 dias</small><b>{compraram30}</b><em>{parteTxt}</em></div>
              <div role="listitem"><small>Aniversários em 30 dias</small><b>{aniversariantes.length}</b><em className={prox !== null ? "rosa" : ""}>{prox === null ? "nenhum por agora" : `o próximo é ${quandoNiver(prox)}`}</em></div>
              <div role="listitem"><small>Ticket médio</small><b>{formatMoneyFull(ticketGeral)}</b><em>por pedido</em></div>
            </div>

            {aniversariantes.length > 0 && (
              <button type="button" className="cl9-niver" onClick={() => setShowNiver(true)}>
                <span className="cl9-niver-ic"><Cake size={24} weight="bold" /></span>
                <span>
                  <b>{aniversariantes.length === 1 ? "1 aniversário" : `${aniversariantes.length} aniversários`} nos próximos 30 dias</b>
                  <small>{aniversariantes.slice(0, 3).map(c => primeiroNome(c.nome)).join(", ")}{aniversariantes.length > 3 ? ` e mais ${aniversariantes.length - 3}` : ""} · mande os parabéns</small>
                </span>
                <CaretRight size={20} weight="bold" />
              </button>
            )}

            <section className="cl9-card">
              <div className={`cl9-barra${suportaContatos ? " cl9-barra--imp" : ""}`}>
                <label className="cl9-busca">
                  <MagnifyingGlass size={20} weight="bold" />
                  <input type="search" placeholder="Buscar por nome ou telefone" value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar cliente" autoComplete="off" />
                  {search && <button type="button" aria-label="Limpar a busca" onClick={() => setSearch("")}><X size={18} weight="bold" /></button>}
                </label>
                <div className="cl9-acoes">
                  {suportaContatos && <Botao variante="secundario" tamanho="m" icone={<AddressBook size={20} weight="bold" />} onClick={importarContatos}>Importar<i className="cl9-pro">PRO</i></Botao>}
                  <Botao tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => openNew()}><span className="cl9-g">Novo cliente</span><span className="cl9-c">Novo</span></Botao>
                </div>
              </div>
              {importError && <p className="cl9-erro" role="alert">{importError}</p>}

              <div className="cl9-chips" role="tablist" aria-label="Filtrar clientes">
                {([["todos", "Todos"], ["aniversariantes", "Aniversário"], ["recentes", "Novos cadastros"], ["sumidas", "Sem comprar há 60 dias"]] as const).map(([k, t]) => (
                  (k === "todos" || qtdFiltro[k] > 0 || filtroChip === k) && (
                    <button key={k} type="button" role="tab" aria-selected={filtroChip === k} onClick={() => setFiltroChip(k)}>{t}<i>{qtdFiltro[k]}</i></button>
                  )
                ))}
              </div>

              {filtered.length === 0 ? (
                <p className="cl9-semres">{search ? "Ninguém com esse nome ou telefone. Confira a busca." : "Ninguém nesse filtro por enquanto."}</p>
              ) : (<>
                {/* computador: tabela */}
                <div className="cl9-tab" role="table" aria-label="Clientes">
                  <div className="cl9-tab-cab" role="row"><span role="columnheader">Cliente</span><span role="columnheader">Pedidos</span><span role="columnheader">Total gasto</span><span role="columnheader">Última compra</span><span role="columnheader">Aniversário</span><span /></div>
                  {filtered.map(c => {
                    const ped = c._totalPedidos || 0;
                    return (
                      <div key={c.id} className="cl9-tab-l" role="row" onClick={() => navigate(`/clientes/${c.id}`)}>
                        <span role="cell" className="cl9-tab-quem"><Avatar c={c} /><span><b>{c.nome}</b><small>{formatPhone(c.whatsapp) || "Sem WhatsApp"}</small><Etiqueta c={c} /></span></span>
                        <span role="cell">{ped || "—"}</span>
                        <span role="cell">{ped ? formatMoneyFull(c._totalGasto) : "—"}</span>
                        <span role="cell">{ped ? ultimaTxt(c) : <em className="cl9-nada">Ainda não comprou</em>}</span>
                        <span role="cell">{niverCurto(c.data_nascimento)}</span>
                        <span role="cell" className="cl9-tab-bt">
                          <BotaoZap c={c} />
                          <button type="button" className="cl9-abrir" aria-label={`Abrir ${c.nome}`} onClick={e => { e.stopPropagation(); navigate(`/clientes/${c.id}`); }}><CaretRight size={20} weight="bold" /></button>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* celular: lista */}
                <div className="cl9-lista">
                  {filtered.map(c => (
                    <div key={c.id} className="cl9-l">
                      <button type="button" className="cl9-l-b" onClick={() => navigate(`/clientes/${c.id}`)}>
                        <Avatar c={c} />
                        <span className="cl9-l-tx"><b>{c.nome}</b><small>{linha2(c)}</small><Etiqueta c={c} /></span>
                      </button>
                      <BotaoZap c={c} />
                    </div>
                  ))}
                </div>
              </>)}
            </section>

            <Janela aberta={showNiver} aoFechar={() => setShowNiver(false)} tipo="conteudo" titulo="Aniversários">
              <p className="cl9-j-apoio">Nos próximos 30 dias. Uma mensagem de parabéns costuma virar pedido de bolo.</p>
              {aniversariantes.map(c => {
                const d = getDaysUntil(c.data_nascimento!);
                const wa = linkWhats(c, `Feliz aniversário, ${primeiroNome(c.nome)}! Que o seu dia seja muito doce.`);
                return (
                  <div key={c.id} className="cl9-j-l">
                    <button type="button" className="cl9-j-quem" onClick={() => { setShowNiver(false); navigate(`/clientes/${c.id}`); }}>
                      <Avatar c={c} />
                      <span><b>{c.nome}</b><small>{niverCurto(c.data_nascimento)} · {quandoNiver(d)}</small></span>
                    </button>
                    {wa && <a className="cl9-parabens" href={wa} target="_blank" rel="noopener noreferrer"><WhatsappLogo size={18} weight="bold" />Parabéns</a>}
                  </div>
                );
              })}
            </Janela>
          </div>
        );
      })()}

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
        @media (min-width: 900px) {
          .cli-root { padding-top: 40px; }
        }

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
    </div>
    </>
  );
}
