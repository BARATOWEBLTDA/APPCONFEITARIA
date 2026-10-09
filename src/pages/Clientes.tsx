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
import { AddressBook, Cake, CalendarBlank, Camera, CaretDown, Check, CaretRight, MagnifyingGlass, Plus, Trash, UsersThree, WarningCircle, WhatsappLogo, X } from "@phosphor-icons/react";
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
  const [filtroChip,    setFiltroChip]    = useState<"todos" | "aniversariantes" | "recentes" | "sumidas">("todos");

  // Importação de contatos
  const [importSheet,   setImportSheet]   = useState<ImportContato[] | null>(null);
  const [importing,     setImporting]     = useState(false);

  const usuarioEhPro = isPro(profile);
  const suportaContatos = typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

  // Guard "descartar cadastro?" ao clicar fora

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
      const idNovo = savedId;
      avisar(`${completo.nome.trim()} cadastrada`, { tipo: "ok", acao: { rotulo: "Ver", aoTocar: () => navigate(`/clientes/${idNovo}`) } });
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    await supabase.from("clientes").delete().eq("id", id);
    await fetchClientes(userId);
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

  const tryCloseImport = async () => {
    if (importing) return;
    if (!importSheet?.some(c => c.selecionado)) { setImportSheet(null); return; }
    const ok = await confirmar({ titulo: "Sair sem importar?", texto: "Os contatos que você marcou não vão ser cadastrados.", rotulo: "Sair sem importar", rotuloVoltar: "Continuar", perigo: true, icone: "alerta" });
    if (ok) setImportSheet(null);
  };

  const handleAbrirImportarContatos = async () => {
    // Não é PRO → não faz nada (botão está desabilitado visualmente)
    if (!usuarioEhPro) return;

    // Não suporta → alerta (não deveria acontecer, botão só aparece se suporta)
    if (!suportaContatos) {
      avisar("Importar contatos só funciona no Chrome do Android.", { tipo: "info" });
      return;
    }

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
      // Fechar a lista de contatos do Android sem escolher não é erro
      if (err?.name === "AbortError") return;
      avisar(err?.name === "SecurityError" ? "O celular não deixou abrir os contatos. Libere o acesso e tente de novo." : "Não deu pra abrir os contatos. Tente de novo.", { tipo: "erro" });
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
    avisar(`${importadosCount} ${importadosCount === 1 ? "cliente importado" : "clientes importados"}${duplicadosCount ? ` · ${duplicadosCount} já ${duplicadosCount === 1 ? "existia" : "existiam"}` : ""}`, { tipo: "ok" });
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

      {formJSX}

      {/* ═══ Importar contatos (Android, PRO): revisar antes de cadastrar ═══ */}
      {(() => {
        const lista = importSheet || [];
        const podeMarcar = (c: ImportContato) => !c.duplicado && !!c.nome && c.telefoneNormalizado.length >= 10;
        const marcaveis = lista.filter(podeMarcar);
        const marcados = lista.filter(c => c.selecionado && podeMarcar(c)).length;
        const repetidos = lista.filter(c => c.duplicado).length;
        const todosMarcados = marcaveis.length > 0 && marcados === marcaveis.length;
        const marcarTodos = (on: boolean) => setImportSheet(prev => prev?.map(c => ({ ...c, selecionado: on && podeMarcar(c) })) || null);
        const alternar = (idx: number) => setImportSheet(prev => prev?.map((c, i) => i === idx ? { ...c, selecionado: !c.selecionado } : c) || null);
        return (
          <Janela aberta={!!importSheet} aoFechar={tryCloseImport} tipo="conteudo" titulo={`Importar ${lista.length} ${lista.length === 1 ? "contato" : "contatos"}`}
            acoes={<>
              <Botao variante="secundario" onClick={tryCloseImport} disabled={importing}>Cancelar</Botao>
              <Botao carregando={importing} disabled={marcados === 0} onClick={handleConfirmImport}>{marcados === 0 ? "Marque alguém" : `Importar ${marcados}`}</Botao>
            </>}>
            <div className="cl9-imp">
              <p className="cl9-imp-resumo">
                <b>{marcaveis.length} {marcaveis.length === 1 ? "novo" : "novos"}</b>
                {repetidos > 0 && <> · {repetidos} já {repetidos === 1 ? "cadastrado" : "cadastrados"}</>}
                {lista.length - marcaveis.length - repetidos > 0 && <> · {lista.length - marcaveis.length - repetidos} sem número</>}
              </p>
              {marcaveis.length > 0 && (
                <button type="button" className="cl9-imp-todos" onClick={() => marcarTodos(!todosMarcados)}>
                  <i className={`cl9-imp-cx${todosMarcados ? " on" : ""}`}>{todosMarcados && <Check size={14} weight="bold" />}</i>
                  {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
                </button>
              )}
              {lista.map((c, idx) => {
                const ok = podeMarcar(c);
                const on = ok && c.selecionado;
                return (
                  <button key={idx} type="button" className={`cl9-imp-l${ok ? "" : " off"}`} disabled={!ok || importing} aria-pressed={on} onClick={() => alternar(idx)}>
                    <i className={`cl9-imp-cx${on ? " on" : ""}`}>{on && <Check size={14} weight="bold" />}</i>
                    <span><b>{c.nome || "Sem nome"}</b><small>{c.telefone || "Sem número"}</small></span>
                    {c.duplicado ? <em className="cl9-imp-tag">Já cadastrado</em> : !ok ? <em className="cl9-imp-tag cl9-imp-tag--falta">{c.nome ? "Sem número" : "Sem nome"}</em> : null}
                  </button>
                );
              })}
            </div>
          </Janela>
        );
      })()}

      {/* ═══════════════════════ STYLES ═══════════════════════ */}
      <style>{`
        * { box-sizing: border-box; }
        .cli-root { font-family: var(--font-base, 'Geist', sans-serif); }
        @media (min-width: 900px) {
          .cli-root { padding-top: 40px; }
        }

      `}</style>
      </>
      )}
    </div>
    </>
  );
}
