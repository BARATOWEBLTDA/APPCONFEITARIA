import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PainelLoja, { type AcaoLoja } from "./PainelLoja";
import { registrar, nomeConta } from "@/lib/adminPerfil";
import { supabase } from "@/lib/supabase";
import { Plus, MagnifyingGlass, X, Crown, Lock, LockOpen, Trash, Users, UserPlus, CaretLeft, CaretRight, EnvelopeSimple } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Janela, TelaVazia, avisar, confirmar, informar } from "@/components/base";
import { buscarTudo } from "@/lib/buscarTudo";
import { explicarErro } from "@/lib/erros";

/** Usuário da lista (função admin_usuarios + plano de profiles) */
type UsuarioAdmin = {
  id: string; email?: string | null; nome?: string | null; nome_loja?: string | null; telefone?: string | null; foto_url?: string | null; logo_url?: string | null; created_at?: string | null
  banned_until?: string | null; is_admin?: boolean | null; plano?: string | null; pro_expira_em?: string | null; indicado_por?: string | null
} & Partial<Metricas>;
/** (03/11) métricas de cada conta (função admin_metricas_usuarios) */
type Metricas = {
  ultimo_acesso_em: string | null; ultimo_login_em: string | null; pedidos: number; pedidos_cardapio: number; pedidos_30d: number;
  ultimo_pedido_em: string | null; produtos: number; clientes: number; orcamentos: number;
};
type Ordem = "cadastro" | "acesso" | "pedidos" | "produtos" | "clientes";
type Ver = "todas" | "online" | "pro" | "gratis" | "bloq";
/** (03/11) a lista vem em páginas de 50: com centenas de contas a página ficava enorme e pesada */
const POR_PAGINA = 50;
/** 1 … 4 5 6 … 10: no máximo 7 botões (cabe no celular) */
function paginas(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (atual <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (atual >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", atual - 1, atual, atual + 1, "…", total];
}
const ORDENS: { v: Ordem; t: string }[] = [
  { v: "acesso", t: "Último acesso" }, { v: "pedidos", t: "Mais pedidos" }, { v: "produtos", t: "Mais produtos" },
  { v: "clientes", t: "Mais clientes" }, { v: "cadastro", t: "Mais novas" },
];
/** último sinal de vida: o aviso do app aberto ou, antes disso existir, o último login */
const vistoEm = (u: UsuarioAdmin) => u.ultimo_acesso_em || u.ultimo_login_em || null;
const ONLINE_MS = 2 * 60_000;
function textoVisto(iso: string | null, agora: number): string {
  if (!iso) return "Nunca entrou";
  const d = new Date(iso), ms = agora - d.getTime();
  if (ms < ONLINE_MS) return "Online agora";
  if (ms < 3_600_000) return `Há ${Math.max(1, Math.round(ms / 60_000))} min`;
  const hoje = new Date(); const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `Ontem, ${hora}`;
  return d.toLocaleDateString("pt-BR");
}
/** O plano de cada conta (profiles) */
type PlanoUsuario = Pick<UsuarioAdmin, "id" | "plano" | "pro_expira_em" | "indicado_por" | "logo_url">;

export default function AdminUsuarios() {
  const [users, setUsers] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState("");
  const [search, setSearch] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("acesso");
  // ?ver=online: o "Ver todas online" do Painel abre a lista já filtrada
  const [params] = useSearchParams();
  const [ver, setVer] = useState<Ver>(() => (["online", "pro", "gratis", "bloq"].includes(params.get("ver") || "") ? params.get("ver") as Ver : "todas"));
  const [pagina, setPagina] = useState(1);
  useEffect(() => { setPagina(1); }, [search, ordem, ver]);
  const [lojaAberta, setLojaAberta] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  // (04/11) os botões saíram da linha: ficam nos detalhes da conta
  const acoesDa = (u?: UsuarioAdmin): AcaoLoja[] | undefined => {
    if (!u) return undefined;
    const pro = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());
    return [
      { rotulo: pro ? "Tirar o PRO" : "Dar o PRO", sub: pro ? "A conta volta a ser grátis" : "Por quantos dias quiser", icone: <Crown size={20} weight={pro ? "fill" : "bold"} />, ativo: pro, aoClicar: () => handleTogglePRO(u) },
      { rotulo: "Trocar o e-mail", sub: "Mesma conta, mesma senha e o PRO continua", icone: <EnvelopeSimple size={20} weight="bold" />, aoClicar: () => { setEmailAlvo(u); setEmailNovo(""); setEmailErro(""); } },
      { rotulo: u.banned_until ? "Desbloquear" : "Bloquear o acesso", sub: u.banned_until ? "Ela volta a entrar no app" : "Ela não consegue mais entrar", icone: u.banned_until ? <LockOpen size={20} weight="bold" /> : <Lock size={20} weight="bold" />, aoClicar: () => setConfirmBlock(u) },
      { rotulo: "Excluir a conta", sub: "Apaga a conta e tudo dela", icone: <Trash size={20} weight="bold" />, perigo: true, aoClicar: () => setConfirmDelete(u) },
    ];
  };
  const irPara = (p: number) => { setPagina(p); document.querySelector(".au-card")?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const [erroMetricas, setErroMetricas] = useState(false);
  // relógio da tela: "online agora" e "há X min" andam sozinhos sem recarregar a lista
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setAgora(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const [confirmDelete, setConfirmDelete] = useState<UsuarioAdmin | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<UsuarioAdmin | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: "", email: "", senha: "", telefone: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  // (6.167) trocar o e-mail de login (o antigo fica guardado pra Hotmart continuar achando a conta)
  const [emailAlvo, setEmailAlvo] = useState<UsuarioAdmin | null>(null);
  const [emailNovo, setEmailNovo] = useState("");
  const [emailErro, setEmailErro] = useState("");
  const [emailSalvando, setEmailSalvando] = useState(false);

  const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true); setErroCarregar("");
    // (11/10) De 1.000 em 1.000 (o banco corta em 1.000 linhas sem avisar) e conferindo os erros:
    // antes, se a leitura dos planos falhava, todo mundo aparecia como Grátis.
    const { data, error } = await buscarTudo<UsuarioAdmin>((de, ate) =>
      supabase.rpc("admin_usuarios").select("*").order("created_at", { ascending: false }).order("id").range(de, ate));
    if (error) { setErroCarregar(explicarErro(error, "Tente de novo em instantes.")); setLoading(false); return; }
    // (01/11 · 5.99) a lista vem da função admin_usuarios (a view admin_users saiu). Mescla plano e pro_expira_em vindos de profiles
    // em lotes de 100: com todos os ids num pedido só, o endereço ficava grande demais
    const ids = data.map(u => u.id).filter(Boolean);
    const mapa = new Map<string, PlanoUsuario>();
    for (let i = 0; i < ids.length; i += 100) {
      const { data: planos, error: erroPlanos } = await supabase.from("profiles").select("id, plano, pro_expira_em, indicado_por, logo_url").in("id", ids.slice(i, i + 100));
      if (erroPlanos) { setErroCarregar(explicarErro(erroPlanos, "Tente de novo em instantes.")); setLoading(false); return; }
      (planos || []).forEach(p => mapa.set(p.id, p));
    }
    // (03/11) pedidos, produtos, clientes e último acesso de cada conta (se falhar, a lista aparece sem os números)
    const met = new Map<string, Metricas>();
    const { data: metricas, error: erroMet } = await supabase.rpc("admin_metricas_usuarios");
    if (erroMet) setErroMetricas(true);
    else { setErroMetricas(false); ((metricas || []) as (Metricas & { id: string })[]).forEach(m => met.set(m.id, m)); }
    // (03/11) quem está bloqueado: a lista não trazia isso, então conta bloqueada aparecia como ativa
    // e o cadeado sempre oferecia "Bloquear" (não dava pra desbloquear pelo painel)
    const bloq = new Map<string, string>();
    const { data: bloqueados, error: erroBloq } = await supabase.rpc("admin_bloqueados");
    if (erroBloq) setErroMetricas(true);
    else ((bloqueados || []) as { id: string; banned_until: string }[]).forEach(b => bloq.set(b.id, b.banned_until));
    setUsers(data.map(u => ({ ...u, ...(mapa.get(u.id) || {}), ...(met.get(u.id) || {}), banned_until: bloq.get(u.id) || null })));
    setRev(r => r + 1);
    setLoading(false);
  };

  /**
   * Ativa PRO por N dias (padrão 30). Se já é PRO ativo, desativa.
   * Uso: botão da coroa na lista de usuários (ativar abre a janela de dias).
   */
  const [proAlvo, setProAlvo] = useState<UsuarioAdmin | null>(null);
  const [proDias, setProDias] = useState("30");
  const [proErro, setProErro] = useState("");
  const [proSalvando, setProSalvando] = useState(false);

  const handleTogglePRO = async (u: UsuarioAdmin) => {
    const isPROAtivo = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());

    if (isPROAtivo) {
      const ok = await confirmar({
        titulo: `Desativar o PRO de ${u.nome || u.email}?`,
        texto: "A conta volta a ser gratuita.",
        rotulo: "Desativar PRO",
        perigo: true,
      });
      if (!ok) return;
      const { data, error } = await supabase.from("profiles")
        .update({ plano: null, pro_expira_em: null })
        .eq("id", u.id)
        .select();
      if (error) { informar({ titulo: "Não deu para desativar o PRO", texto: error.message, icone: "erro" }); return; }
      if (!data || data.length === 0) { informar({ titulo: "Nenhuma linha foi atualizada", texto: "Provável causa: a policy RLS está bloqueando (sem permissão de admin em profiles). Rode o SQL de policy admin.", icone: "alerta" }); return; }
      avisar("PRO desativado.");
      void registrar(`tirou o PRO de ${nomeConta(u)}`, { tipo: "pro", alvo_id: u.id });
      await load();
    } else {
      setProDias("30");
      setProErro("");
      setProAlvo(u);
    }
  };

  const ativarPRO = async () => {
    const u = proAlvo;
    if (!u) return;
    const dias = parseInt(proDias, 10);
    if (isNaN(dias) || dias < 1) { setProErro("Digite um número de dias a partir de 1."); return; }
    setProSalvando(true);
    const expira = new Date();
    expira.setDate(expira.getDate() + dias);
    const { data, error } = await supabase.from("profiles")
      .update({ plano: "pro", pro_expira_em: expira.toISOString() })
      .eq("id", u.id)
      .select();
    setProSalvando(false);
    if (error) { informar({ titulo: "Não deu para ativar o PRO", texto: error.message, icone: "erro" }); return; }
    if (!data || data.length === 0) { informar({ titulo: "Nenhuma linha foi atualizada", texto: "Provável causa: a policy RLS está bloqueando (sem permissão de admin em profiles). Rode o SQL de policy admin.", icone: "alerta" }); return; }

    // Se a pessoa foi indicada, dispara push pra quem indicou.
    // O trigger PostgreSQL registrar_conversao_pro já atualiza a tabela indicacoes.
    // Aqui só notificamos o indicador. Fire-and-forget.
    if (u.indicado_por) {
      supabase.functions.invoke("notif-indicacao", {
        body: {
          evento: "indicacao_pro",
          indicador_id: u.indicado_por,
          nome_indicada: u.nome || "Alguém",
        }
      }).catch((err) => console.warn("[notif PRO] falha:", err));
    }

    setProAlvo(null);
    void registrar(`deu o PRO de ${dias} ${dias === 1 ? "dia" : "dias"} para ${nomeConta(u)}`, { tipo: "pro", alvo_id: u.id, detalhe: { dias, vence: expira.toISOString() } });
    avisar(`PRO ativado por ${dias} dias. Vence em ${expira.toLocaleDateString("pt-BR")}.`);
    await load();
  };

  const callEdge = async (body: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Erro na operação");
    return json;
  };

  const handleCreate = async () => {
    if (!createForm.nome.trim() || !createForm.email.trim() || createForm.senha.length < 8) {
      setCreateError("Preencha nome, e-mail e senha (mínimo 8 caracteres).");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const criada = await callEdge({ action: "create", ...createForm });
      void registrar(`criou a conta de ${createForm.nome.trim()} (${createForm.email.trim()})`, { tipo: "usuario", alvo_id: (criada as { user?: { id?: string } })?.user?.id ?? null });
      setShowCreate(false);
      setCreateForm({ nome: "", email: "", senha: "", telefone: "" });
      await load();
    } catch (err) {
      setCreateError((err as Error).message);
    }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await callEdge({ action: "delete", userId: confirmDelete.id });
      void registrar(`excluiu a conta ${nomeConta(confirmDelete)}${confirmDelete.email ? ` (${confirmDelete.email})` : ""}`, { tipo: "exclusao", alvo_id: confirmDelete.id });
      setConfirmDelete(null); setLojaAberta(null);
      await load();
    } catch (err) {
      avisar((err as Error).message, { tipo: "erro" });
    }
    setActionLoading(false);
  };

  const trocarEmail = async () => {
    if (!emailAlvo) return;
    const novo = emailNovo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(novo)) { setEmailErro("Confira o e-mail: falta o @ ou o final (.com, .com.br)."); return; }
    if (novo === (emailAlvo.email || "").toLowerCase()) { setEmailErro("Esse já é o e-mail da conta."); return; }
    setEmailSalvando(true); setEmailErro("");
    try {
      await callEdge({ action: "change_email", userId: emailAlvo.id, email: novo });
      void registrar(`trocou o e-mail de ${nomeConta(emailAlvo)} de ${emailAlvo.email} para ${novo}`, { tipo: "usuario", alvo_id: emailAlvo.id });
      avisar(`E-mail trocado. ${emailAlvo.nome?.split(" ")[0] || "Ela"} já entra com ${novo} e a mesma senha.`, { tipo: "ok" });
      setEmailAlvo(null);
      await load();
    } catch (err) {
      setEmailErro(explicarErro(err, "Não deu para trocar o e-mail. Tente de novo."));
    }
    setEmailSalvando(false);
  };

  const handleBlock = async () => {
    if (!confirmBlock) return;
    setActionLoading(true);
    try {
      const action = confirmBlock.banned_until ? "unblock" : "block";
      await callEdge({ action, userId: confirmBlock.id });
      void registrar(`${action === "block" ? "bloqueou" : "desbloqueou"} a conta ${nomeConta(confirmBlock)}`, { tipo: "bloqueio", alvo_id: confirmBlock.id });
      setConfirmBlock(null);
      await load();
    } catch (err) {
      avisar((err as Error).message, { tipo: "erro" });
    }
    setActionLoading(false);
  };

  const q = search.trim().toLowerCase();
  const proAtivo = (u: UsuarioAdmin) => u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em).getTime() > agora);
  const estaOnline = (u: UsuarioAdmin) => { const v = vistoEm(u); return !!v && agora - new Date(v).getTime() < ONLINE_MS; };
  const passa: Record<Ver, (u: UsuarioAdmin) => boolean> = {
    todas: () => true, online: estaOnline, pro: proAtivo, gratis: u => !proAtivo(u), bloq: u => !!u.banned_until,
  };
  const qtd = (v: Ver) => users.filter(passa[v]).length;
  const VERES: { v: Ver; t: string }[] = [
    { v: "todas", t: "Todas" }, { v: "online", t: "Online agora" }, { v: "pro", t: "PRO" }, { v: "gratis", t: "Grátis" }, { v: "bloq", t: "Bloqueadas" },
  ];
  const filtered = users.filter(passa[ver]).filter(u => !q || [u.nome, u.nome_loja, u.email, u.telefone].some(x => String(x || "").toLowerCase().includes(q)))
    .sort((a, b) => {
      const t = (x: string | null | undefined) => (x ? new Date(x).getTime() : 0);
      if (ordem === "acesso") return t(vistoEm(b)) - t(vistoEm(a));
      if (ordem === "pedidos") return (b.pedidos || 0) - (a.pedidos || 0);
      if (ordem === "produtos") return (b.produtos || 0) - (a.produtos || 0);
      if (ordem === "clientes") return (b.clientes || 0) - (a.clientes || 0);
      return t(b.created_at) - t(a.created_at);
    });
  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const onlineAgora = users.filter(u => { const v = vistoEm(u); return !!v && agora - new Date(v).getTime() < ONLINE_MS && !u.is_admin; }).length;

  const fecharCriar = () => { if (!creating) setShowCreate(false); };

  return (
    <div className="au-root">
      <div className="au-topo">
        <div className="au-topo-t">
          <h1 className="au-h1">Usuários</h1>
          <p className="au-sub">{users.length} {users.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}{onlineAgora > 0 && <> · <span className="au-on-txt"><i aria-hidden="true" />{onlineAgora} online agora</span></>}</p>
        </div>
        <Botao icone={<Plus size={20} weight="bold" />} onClick={() => { setShowCreate(true); setCreateError(""); }}>
          Novo usuário
        </Botao>
      </div>

      <div className="au-card">
        <div className="au-filtros">
        <label className="au-busca">
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input type="search" placeholder="Nome, loja, e-mail ou telefone" aria-label="Buscar por nome, loja, e-mail ou telefone" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <BotaoIcone rotulo="Limpar busca" variante="limpo" tamanho="p" onClick={() => setSearch("")}>
              <X size={18} weight="bold" />
            </BotaoIcone>
          )}
        </label>
          <label className="au-ordem">
            <span>Mostrar</span>
            <select value={ver} onChange={e => setVer(e.target.value as Ver)}>
              {VERES.map(o => <option key={o.v} value={o.v}>{o.t} ({qtd(o.v).toLocaleString("pt-BR")})</option>)}
            </select>
          </label>
          <label className="au-ordem">
            <span>Ordenar por</span>
            <select value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}>
              {ORDENS.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select>
          </label>
        </div>
        {erroMetricas && <p className="au-aviso" role="status">Parte dos dados (pedidos, produtos, clientes ou bloqueios) não carregou. Atualize a página.</p>}

        {loading ? (
          <div className="au-esq" aria-busy="true"><span /><span /><span /><span /></div>
        ) : erroCarregar ? (
          <TelaVazia
            compacta
            icone={<Users size={30} />}
            titulo="Não deu para carregar os usuários"
            texto={erroCarregar}
            acao={<Botao tamanho="m" onClick={() => load()}>Tentar de novo</Botao>}
          />
        ) : filtered.length === 0 ? (
          <TelaVazia
            compacta
            icone={<Users size={30} />}
            titulo={search ? "Nenhum usuário com essa busca" : ver !== "todas" ? "Nenhuma conta nesse filtro" : "Nenhum usuário ainda"}
            texto={search ? "Confira o nome, a loja, o e-mail ou o telefone." : ver === "online" ? "Ninguém com o app aberto agora." : undefined}
          />
        ) : (
          <div className="au-lista" role="table" aria-label="Usuários">
            <div className="au-cab" role="row">
              <span role="columnheader">Usuário</span>
              <span role="columnheader">Plano</span>
              <span role="columnheader" className="au-num">Pedidos</span>
              <span role="columnheader" className="au-num">Produtos</span>
              <span role="columnheader" className="au-num">Clientes</span>
              <span role="columnheader">Último acesso</span>
              <span aria-hidden="true" />
            </div>
            {filtered.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA).map(u => {
              const isPROAtivo = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());
              const proExpiraTexto = u.pro_expira_em ? new Date(u.pro_expira_em).toLocaleDateString("pt-BR") : "";
              const cadastro = u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "";
              const visto = vistoEm(u);
              const online = !!visto && agora - new Date(visto).getTime() < ONLINE_MS;
              // (04/11) PRO "pra sempre" (vencimento daqui a décadas) vira Vitalício
              const vitalicio = !!u.pro_expira_em && new Date(u.pro_expira_em).getFullYear() - new Date().getFullYear() > 50;
              const abrir = () => setLojaAberta(u.id);
              return (
                <div key={u.id} className="au-l" role="row" tabIndex={0} title="Ver detalhes da conta"
                  onClick={abrir} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); } }}>
                  <div className="au-quem" role="cell">
                    <span className="au-av" aria-hidden="true">
                      {u.logo_url || u.foto_url ? <img src={(u.logo_url || u.foto_url) as string} alt="" /> : (u.nome_loja || u.nome || u.email || "?").charAt(0).toUpperCase()}
                      {online && <i className="au-av-on" />}
                    </span>
                    <span className="au-quem-tx">
                      <b>{u.nome_loja || u.nome || "Sem nome"}</b>
                      <small className="au-so-pc">{[u.nome_loja && u.nome && u.nome !== u.nome_loja ? u.nome : "", u.email].filter(Boolean).join(" · ")}</small>
                      <small className="au-desde">{cadastro ? `Entrou em ${cadastro}` : "Sem data de entrada"}</small>
                    </span>
                  </div>
                  <span className="au-c au-c--plano" role="cell">
                    {isPROAtivo
                      ? <><span className="au-tag au-tag--pro"><Crown size={13} weight="fill" aria-hidden="true" /> PRO</span><small className="au-ate">{vitalicio ? "Vitalício" : proExpiraTexto ? `até ${proExpiraTexto}` : "Sem vencimento"}</small></>
                      : <span className="au-tag">Grátis</span>}
                    {u.banned_until && <span className="au-tag au-tag--bloq">Bloqueada</span>}
                  </span>
                  <span className="au-c au-c--n au-num" role="cell" title={`${u.pedidos_30d || 0} nos últimos 30 dias`}>
                    <b>{(u.pedidos || 0).toLocaleString("pt-BR")}</b>
                    {(u.pedidos_cardapio || 0) > 0 && <small>{u.pedidos_cardapio} pelo cardápio</small>}
                  </span>
                  <span className="au-c au-c--n au-num" role="cell"><b>{(u.produtos || 0).toLocaleString("pt-BR")}</b></span>
                  <span className="au-c au-c--n au-num" role="cell"><b>{(u.clientes || 0).toLocaleString("pt-BR")}</b></span>
                  <span className={`au-c au-c--visto${online ? " on" : ""}`} role="cell" title={visto ? new Date(visto).toLocaleString("pt-BR") : undefined}>{textoVisto(visto, agora)}</span>
                  <span className="au-seta" aria-hidden="true"><CaretRight size={18} weight="bold" /></span>
                </div>
              );
            })}
            {totalPaginas > 1 && (
              <nav className="au-pags" aria-label="Páginas">
                <BotaoIcone rotulo="Página anterior" variante="limpo" disabled={pagAtual === 1} onClick={() => irPara(pagAtual - 1)}><CaretLeft size={18} weight="bold" /></BotaoIcone>
                {paginas(pagAtual, totalPaginas).map((p, i) => p === "…"
                  ? <span key={`r${i}`} className="au-pag-r" aria-hidden="true">…</span>
                  : <button key={p} type="button" className={`au-pag${p === pagAtual ? " on" : ""}`} aria-current={p === pagAtual ? "page" : undefined} aria-label={`Página ${p}`} onClick={() => irPara(p)}>{p}</button>)}
                <BotaoIcone rotulo="Próxima página" variante="limpo" disabled={pagAtual === totalPaginas} onClick={() => irPara(pagAtual + 1)}><CaretRight size={18} weight="bold" /></BotaoIcone>
              </nav>
            )}
            {filtered.length > POR_PAGINA && <p className="au-pag-info">{((pagAtual - 1) * POR_PAGINA + 1).toLocaleString("pt-BR")}–{Math.min(pagAtual * POR_PAGINA, filtered.length).toLocaleString("pt-BR")} de {filtered.length.toLocaleString("pt-BR")}</p>}
          </div>
        )}
      </div>

      {/* Janela: novo usuário */}
      <Janela
        aberta={showCreate}
        aoFechar={fecharCriar}
        tipo="conteudo"
        titulo="Novo usuário"
        travada
        acoes={<>
          <Botao variante="secundario" onClick={fecharCriar} disabled={creating}>Cancelar</Botao>
          <Botao icone={<UserPlus size={20} weight="bold" />} onClick={handleCreate} carregando={creating}>{creating ? "Criando…" : "Criar usuário"}</Botao>
        </>}
      >
        <div className="au-form">
          <Campo rotulo="Nome" obrigatorio placeholder="Nome completo" value={createForm.nome} onChange={e => setCreateForm({...createForm, nome: e.target.value})} />
          <Campo rotulo="E-mail" obrigatorio type="email" inputMode="email" autoComplete="off" placeholder="email@exemplo.com" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
          <Campo rotulo="Senha" obrigatorio type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" dica="Mínimo 8 caracteres." value={createForm.senha} onChange={e => setCreateForm({...createForm, senha: e.target.value})} />
          <Campo rotulo="Telefone" opcional type="tel" inputMode="tel" placeholder="(00) 9 0000-0000" value={createForm.telefone} onChange={e => setCreateForm({...createForm, telefone: e.target.value})} />
          {createError && <p className="au-erro" role="alert">{createError}</p>}
        </div>
      </Janela>

      {/* Janela: dias de PRO */}
      <Janela
        aberta={!!proAlvo}
        aoFechar={() => { if (!proSalvando) setProAlvo(null); }}
        tipo="conteudo"
        titulo="Ativar PRO"
        acoes={<>
          <Botao variante="secundario" onClick={() => setProAlvo(null)} disabled={proSalvando}>Cancelar</Botao>
          <Botao icone={<Crown size={20} weight="bold" />} onClick={ativarPRO} carregando={proSalvando}>Ativar PRO</Botao>
        </>}
      >
        <div className="au-form">
          <p className="au-j-apoio">Por quantos dias {proAlvo?.nome || proAlvo?.email} fica com o PRO?</p>
          <Campo
            rotulo="Dias de PRO" type="number" inputMode="numeric" min={1}
            value={proDias} onChange={e => { setProDias(e.target.value); setProErro(""); }}
            erro={proErro || undefined}
            dica="30 = um mês · 365 = um ano · 36500 = vitalício."
            onKeyDown={e => { if (e.key === "Enter") ativarPRO(); }}
          />
          <div className="au-atalhos">
            {[{ d: "30", t: "30 dias" }, { d: "365", t: "1 ano" }, { d: "36500", t: "Vitalício" }].map(o => (
              <button key={o.d} type="button" aria-pressed={proDias === o.d} onClick={() => { setProDias(o.d); setProErro(""); }}>{o.t}</button>
            ))}
          </div>
        </div>
      </Janela>

      {/* Janela: trocar e-mail (6.167) */}
      <Janela
        aberta={!!emailAlvo}
        aoFechar={() => { if (!emailSalvando) setEmailAlvo(null); }}
        tipo="conteudo"
        titulo="Trocar o e-mail"
        acoes={<>
          <Botao variante="secundario" onClick={() => setEmailAlvo(null)} disabled={emailSalvando}>Cancelar</Botao>
          <Botao icone={<EnvelopeSimple size={20} weight="bold" />} onClick={trocarEmail} carregando={emailSalvando}>Trocar e-mail</Botao>
        </>}
      >
        <div className="au-form">
          <p className="au-j-apoio">Hoje {emailAlvo?.nome || "a conta"} entra com <b>{emailAlvo?.email}</b>.</p>
          <Campo
            rotulo="E-mail novo" type="email" inputMode="email" autoComplete="off" autoCapitalize="none"
            value={emailNovo} onChange={e => { setEmailNovo(e.target.value); setEmailErro(""); }}
            erro={emailErro || undefined}
            dica="A senha, os pedidos e o PRO continuam. A Hotmart continua achando a conta pelo e-mail antigo."
            onKeyDown={e => { if (e.key === "Enter") trocarEmail(); }}
          />
        </div>
      </Janela>

      {/* Janela: bloquear */}
      <Janela
        aberta={!!confirmBlock}
        aoFechar={() => setConfirmBlock(null)}
        titulo={confirmBlock?.banned_until ? "Desbloquear o usuário?" : "Bloquear o usuário?"}
        texto={confirmBlock ? (confirmBlock.banned_until ? `${confirmBlock.email} volta a entrar no app.` : `${confirmBlock.email} não consegue mais entrar no app.`) : undefined}
        icone={confirmBlock?.banned_until ? <LockOpen size={32} /> : <Lock size={32} />}
        tom="laranja"
        acoes={<>
          <Botao variante="secundario" onClick={() => setConfirmBlock(null)}>Cancelar</Botao>
          <Botao variante={confirmBlock?.banned_until ? "principal" : "perigo"} onClick={handleBlock} carregando={actionLoading}>
            {confirmBlock?.banned_until ? "Desbloquear" : "Bloquear"}
          </Botao>
        </>}
      />

      {/* Janela: excluir */}
      <Janela
        aberta={!!confirmDelete}
        aoFechar={() => setConfirmDelete(null)}
        titulo="Excluir o usuário?"
        texto={confirmDelete ? `${confirmDelete.email} some do Doonly. Não dá para desfazer.` : undefined}
        icone={<Trash size={32} />}
        tom="vermelho"
        acoes={<>
          <Botao variante="secundario" onClick={() => setConfirmDelete(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={handleDelete} carregando={actionLoading}>Excluir</Botao>
        </>}
      />

      <style>{`
        .au-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 1180px; }
        .au-root button { font-family: inherit; }
        .au-topo { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .au-topo-t { min-width: 0; }
        .au-h1 { font-size: 22px; font-weight: 600; margin: 0; color: var(--ui-texto); }
        .au-sub { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); margin: 4px 0 0; }

        .au-card { padding: 12px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .au-busca { display: flex; align-items: center; gap: 8px; height: 48px; max-width: 480px; padding: 0 4px 0 12px; border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); background: var(--ui-branco); color: var(--ui-texto-3); }
        .au-busca:focus-within { border-color: var(--ui-rosa); }
        .au-busca input { flex: 1; min-width: 0; height: 100%; border: 0; outline: none; background: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
        .au-busca input::placeholder { color: var(--ui-texto-3); }
        .au-busca input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }

        .au-esq { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .au-esq span { height: 64px; border-radius: var(--ui-raio); background: var(--ui-cinza); }

        .au-lista { margin-top: 8px; }
        .au-cab { display: none; }
        /* (04/11) celular: só foto, nome, quando entrou e o plano; o resto (números e botões) fica nos detalhes */
        .au-l { display: flex; align-items: center; gap: 12px; padding: 14px 4px; border-top: 1px solid var(--ui-linha); border-radius: var(--ui-raio); cursor: pointer; }
        .au-cab + .au-l { border-top: 0; }
        .au-l:hover { background: #FCFAFB; }
        .au-l:focus-visible { outline: 2px solid var(--ui-rosa); outline-offset: -2px; }
        .au-l:hover .au-quem-tx b { color: var(--ui-rosa-escuro); }
        .au-quem { flex: 1 1 0; display: flex; align-items: center; gap: 14px; min-width: 0; min-height: 52px; }
        .au-av { position: relative; flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 17px; font-weight: 600; }
        .au-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .au-av-on { position: absolute; right: 0; bottom: 0; width: 13px; height: 13px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-verde); }
        .au-quem-tx { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .au-quem-tx b { font-size: 16px; font-weight: 600; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-quem-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-desde { color: var(--ui-texto-3) !important; }
        .au-so-pc { display: none !important; }
        .au-c { display: none; min-width: 0; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .au-c--plano { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .au-ate { font-size: 12px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; }
        .au-c--n b { font-weight: 600; color: var(--ui-texto); }
        .au-c--visto.on, .au-on-txt { color: var(--ui-verde); font-weight: 600; }
        .au-on-txt { display: inline-flex; align-items: center; gap: 6px; }
        .au-on-txt i { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-verde); }
        .au-seta { flex: none; display: flex; color: var(--ui-texto-3); }
        .au-filtros { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
        .au-filtros .au-busca { flex: 1 1 100%; min-width: 0; max-width: none; box-sizing: border-box; }
        .au-filtros .au-ordem { flex: 1 1 0; min-width: 0; flex-direction: column; align-items: stretch; gap: 4px; }
        .au-ordem select { width: 100%; min-width: 0; }
        @media (min-width: 700px) { .au-filtros .au-busca { flex: 1 1 280px; max-width: 420px; } .au-filtros .au-ordem { flex: none; flex-direction: row; align-items: center; gap: 8px; } .au-ordem select { width: auto; } }
        .au-pags { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 16px 0 0; }
        .au-pag { min-width: 40px; height: 40px; padding: 0 6px; border: 0; border-radius: var(--ui-raio); background: none; font-family: inherit; font-size: 15px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; }
        .au-pag:hover { background: var(--ui-cinza); }
        .au-pag.on { background: var(--ui-rosa); color: var(--ui-branco); font-weight: 600; }
        .au-pag-r { min-width: 20px; text-align: center; color: var(--ui-texto-3); }
        .au-pag-info { margin: 6px 0 0; text-align: center; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); }
        .au-quem { cursor: pointer; border-radius: var(--ui-raio); }
        .au-quem:hover .au-quem-tx b { color: var(--ui-rosa-escuro); text-decoration: underline; text-underline-offset: 3px; }
        .au-quem:focus-visible { outline: 2px solid var(--ui-rosa); outline-offset: 2px; }
        .au-ordem { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .au-ordem select { height: 48px; padding: 0 12px; border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 15px; font-weight: 500; color: var(--ui-texto); }
        .au-aviso { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-laranja-fundo); color: var(--ui-laranja); font-size: 14px; font-weight: 500; }
        .au-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: var(--ui-cinza); color: var(--ui-texto-2); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .au-tag em { font-style: normal; font-weight: 500; }
        .au-tag--pro { background: var(--ui-vinho); color: var(--ui-branco); }
        .au-tag--pro em { color: rgba(255,255,255,.8); }
        .au-tag--ok { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .au-tag--bloq { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); }
        .au-tag--admin { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }

        /* computador: tabela (os botões ficam nos detalhes, ao clicar na linha) */
        @media (min-width: 900px) {
          .au-card { padding: 16px; }
          .au-cab, .au-l { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1.2fr) 132px 76px 76px 118px 24px; align-items: center; column-gap: 12px; }
          .au-cab { margin-top: 12px; padding: 10px 12px; border-radius: var(--ui-raio-p); background: var(--ui-cinza); font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
          .au-l { min-height: 72px; padding: 10px 12px; border-top: 0; border-bottom: 1px solid var(--ui-linha); border-radius: 0; }
          .au-l:last-of-type { border-bottom: 0; }
          .au-av { width: 44px; height: 44px; font-size: 15px; }
          .au-quem-tx b { font-size: 15px; }
          .au-so-pc { display: block !important; }
          .au-desde { font-size: 12px !important; }
          .au-c { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .au-c--plano { display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 4px 6px; }
          .au-num { text-align: right; }
          .au-c--n { display: flex; flex-direction: column; align-items: flex-end; }
          .au-c--n b { font-size: 15px; }
          .au-c--n small { display: block; font-size: 12px; color: var(--ui-texto-3); }
        }

        .au-form { display: flex; flex-direction: column; gap: 16px; }
        .au-erro { margin: 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; font-weight: 500; line-height: 1.4; }
        .au-j-apoio { margin: 0; font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); overflow-wrap: anywhere; }
        .au-atalhos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: -4px; }
        .au-atalhos button { min-height: 44px; padding: 0 16px; border: 1px solid var(--ui-borda); border-radius: 999px; background: var(--ui-branco); color: var(--ui-texto-2); font-size: 14px; font-weight: 600; cursor: pointer; }
        .au-atalhos button[aria-pressed="true"] { border-color: var(--ui-vinho); background: var(--ui-vinho); color: var(--ui-branco); }
      `}</style>
      <PainelLoja id={lojaAberta} aoFechar={() => setLojaAberta(null)} rev={rev} acoes={acoesDa(users.find(u => u.id === lojaAberta))} />
    </div>
  );
}
