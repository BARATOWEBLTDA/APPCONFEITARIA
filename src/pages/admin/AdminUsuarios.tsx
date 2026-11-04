import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, MagnifyingGlass, X, Crown, Lock, LockOpen, Trash, Users, UserPlus } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Janela, TelaVazia, avisar, confirmar, informar } from "@/components/base";
import { buscarTudo } from "@/lib/buscarTudo";
import { explicarErro } from "@/lib/erros";

/** Usuário da lista (função admin_usuarios + plano de profiles) */
type UsuarioAdmin = {
  id: string; email?: string | null; nome?: string | null; nome_loja?: string | null; telefone?: string | null; foto_url?: string | null; created_at?: string | null
  banned_until?: string | null; is_admin?: boolean | null; plano?: string | null; pro_expira_em?: string | null; indicado_por?: string | null
} & Partial<Metricas>;
/** (03/11) métricas de cada conta (função admin_metricas_usuarios) */
type Metricas = {
  ultimo_acesso_em: string | null; ultimo_login_em: string | null; pedidos: number; pedidos_cardapio: number; pedidos_30d: number;
  ultimo_pedido_em: string | null; produtos: number; clientes: number; orcamentos: number;
};
type Ordem = "cadastro" | "acesso" | "pedidos" | "produtos" | "clientes";
const ORDENS: { v: Ordem; t: string }[] = [
  { v: "acesso", t: "Último acesso" }, { v: "pedidos", t: "Mais pedidos" }, { v: "produtos", t: "Mais produtos" },
  { v: "clientes", t: "Mais clientes" }, { v: "cadastro", t: "Cadastro mais novo" },
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
type PlanoUsuario = Pick<UsuarioAdmin, "id" | "plano" | "pro_expira_em" | "indicado_por">;

export default function AdminUsuarios() {
  const [users, setUsers] = useState<UsuarioAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState("");
  const [search, setSearch] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("acesso");
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
      const { data: planos, error: erroPlanos } = await supabase.from("profiles").select("id, plano, pro_expira_em, indicado_por").in("id", ids.slice(i, i + 100));
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
      await callEdge({ action: "create", ...createForm });
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
      setConfirmDelete(null);
      await load();
    } catch (err) {
      avisar((err as Error).message, { tipo: "erro" });
    }
    setActionLoading(false);
  };

  const handleBlock = async () => {
    if (!confirmBlock) return;
    setActionLoading(true);
    try {
      const action = confirmBlock.banned_until ? "unblock" : "block";
      await callEdge({ action, userId: confirmBlock.id });
      setConfirmBlock(null);
      await load();
    } catch (err) {
      avisar((err as Error).message, { tipo: "erro" });
    }
    setActionLoading(false);
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter(u => !q || [u.nome, u.nome_loja, u.email, u.telefone].some(x => String(x || "").toLowerCase().includes(q)))
    .sort((a, b) => {
      const t = (x: string | null | undefined) => (x ? new Date(x).getTime() : 0);
      if (ordem === "acesso") return t(vistoEm(b)) - t(vistoEm(a));
      if (ordem === "pedidos") return (b.pedidos || 0) - (a.pedidos || 0);
      if (ordem === "produtos") return (b.produtos || 0) - (a.produtos || 0);
      if (ordem === "clientes") return (b.clientes || 0) - (a.clientes || 0);
      return t(b.created_at) - t(a.created_at);
    });
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
            titulo={search ? "Nenhum usuário com essa busca" : "Nenhum usuário ainda"}
            texto={search ? "Confira o nome ou o e-mail." : undefined}
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
              <span role="columnheader" className="au-cab-acoes">Ações</span>
            </div>
            {filtered.map(u => {
              const isPROAtivo = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());
              const proExpiraTexto = u.pro_expira_em ? new Date(u.pro_expira_em).toLocaleDateString("pt-BR") : "";
              const cadastro = u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "";
              const status = u.is_admin ? "Admin" : u.banned_until ? "Bloqueado" : "";
              const stCls = u.is_admin ? "admin" : "bloq";
              const visto = vistoEm(u);
              const online = !!visto && agora - new Date(visto).getTime() < ONLINE_MS;
              return (
                <div key={u.id} className="au-l" role="row">
                  <div className="au-quem" role="cell">
                    <span className="au-av" aria-hidden="true">
                      {u.foto_url ? <img src={u.foto_url} alt="" /> : (u.nome_loja || u.nome || u.email || "?").charAt(0).toUpperCase()}
                      {online && <i className="au-av-on" />}
                    </span>
                    <span className="au-quem-tx">
                      <b>{u.nome_loja || u.nome || "Sem nome"}</b>
                      <small>{[u.nome_loja && u.nome && u.nome !== u.nome_loja ? u.nome : "", u.email].filter(Boolean).join(" · ")}</small>
                      <small className="au-desde">{[u.telefone, cadastro ? `desde ${cadastro}` : ""].filter(Boolean).join(" · ")}</small>
                    </span>
                  </div>
                  <span className="au-c au-c--plano" role="cell">
                    {isPROAtivo
                      ? <span className="au-tag au-tag--pro" title={proExpiraTexto ? `Vence em ${proExpiraTexto}` : undefined}><Crown size={14} weight="fill" aria-hidden="true" /> PRO{proExpiraTexto ? <em> até {proExpiraTexto}</em> : null}</span>
                      : <span className="au-tag">Grátis</span>}
                    {status && <span className={`au-tag au-tag--${stCls}`}>{status}</span>}
                  </span>
                  <i className="au-quebra" aria-hidden="true" />
                  <span className="au-c au-c--n au-num" role="cell" title={`${u.pedidos_30d || 0} nos últimos 30 dias`}>
                    <b>{(u.pedidos || 0).toLocaleString("pt-BR")}</b><em className="au-so-cel"> pedidos</em>
                    {(u.pedidos_cardapio || 0) > 0 && <small>{u.pedidos_cardapio} pelo cardápio</small>}
                  </span>
                  <span className="au-c au-c--n au-num" role="cell"><b>{(u.produtos || 0).toLocaleString("pt-BR")}</b><em className="au-so-cel"> produtos</em></span>
                  <span className="au-c au-c--n au-num" role="cell"><b>{(u.clientes || 0).toLocaleString("pt-BR")}</b><em className="au-so-cel"> clientes</em></span>
                  <span className={`au-c au-c--visto${online ? " on" : ""}`} role="cell" title={visto ? new Date(visto).toLocaleString("pt-BR") : undefined}>{textoVisto(visto, agora)}</span>
                  <div className="au-acoes" role="cell">
                    <BotaoIcone
                      rotulo={isPROAtivo ? "Desativar PRO" : "Ativar PRO"}
                      variante={isPROAtivo ? "suave" : "limpo"}
                      onClick={() => handleTogglePRO(u)}
                    >
                      <Crown size={20} weight={isPROAtivo ? "fill" : "bold"} />
                    </BotaoIcone>
                    <BotaoIcone rotulo={u.banned_until ? "Desbloquear" : "Bloquear"} variante="limpo" onClick={() => setConfirmBlock(u)}>
                      {u.banned_until ? <LockOpen size={20} weight="bold" /> : <Lock size={20} weight="bold" />}
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir" variante="limpo" className="au-bt-perigo" onClick={() => setConfirmDelete(u)}>
                      <Trash size={20} weight="bold" />
                    </BotaoIcone>
                  </div>
                </div>
              );
            })}
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
        /* celular: nome e botões em cima; plano, status e data em uma linha embaixo */
        .au-l { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 12px 0; border-top: 1px solid var(--ui-linha); }
        .au-cab + .au-l { border-top: 0; }
        .au-l::after { content: ""; order: 2; flex-basis: 100%; height: 0; }
        .au-quem { order: 1; flex: 1 1 0; display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 48px; }
        .au-acoes { order: 2; flex: none; display: flex; align-items: center; gap: 2px; }
        .au-av { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; overflow: hidden; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 16px; font-weight: 600; }
        .au-av img { width: 100%; height: 100%; object-fit: cover; }
        .au-quem-tx { min-width: 0; display: flex; flex-direction: column; }
        .au-quem-tx b { font-size: 15px; font-weight: 600; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-quem-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-bt-perigo { color: var(--ui-vermelho); }
        .au-bt-perigo:hover { background: var(--ui-vermelho-fundo); }
        .au-c { display: inline-flex; align-items: center; min-width: 0; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .au-c--tel { display: none; }
        .au-c--plano { order: 3; padding-left: 56px; gap: 6px; }
        .au-c--n { order: 4; gap: 2px; }
        .au-c--n b { font-weight: 600; color: var(--ui-texto); }
        .au-c--n small { display: none; }
        .au-c--visto { order: 4; }
        .au-c--visto.on, .au-on-txt { color: var(--ui-verde); font-weight: 600; }
        .au-on-txt { display: inline-flex; align-items: center; gap: 6px; }
        .au-on-txt i { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-verde); }
        .au-av { position: relative; overflow: visible !important; }
        .au-av img { border-radius: 50%; }
        .au-av-on { position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-verde); }
        .au-desde { font-size: 12px !important; color: var(--ui-texto-3) !important; }
        .au-filtros { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; }
        .au-filtros .au-busca { flex: 1 1 100%; min-width: 0; max-width: none; box-sizing: border-box; }
        .au-filtros .au-ordem { flex: 1 1 100%; min-width: 0; }
        .au-ordem select { flex: 1; min-width: 0; }
        @media (min-width: 700px) { .au-filtros .au-busca { flex: 1 1 320px; max-width: 480px; } .au-filtros .au-ordem { flex: none; } .au-ordem select { flex: none; } }
        /* celular: plano e último acesso numa linha, os números na de baixo */
        .au-quebra { order: 5; flex-basis: 100%; height: 0; }
        .au-l .au-c--n { order: 6; }
        .au-ordem { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .au-ordem select { height: 48px; padding: 0 12px; border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); background: var(--ui-branco); font-family: inherit; font-size: 15px; font-weight: 500; color: var(--ui-texto); }
        .au-aviso { margin: 10px 0 0; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-laranja-fundo); color: var(--ui-laranja); font-size: 14px; font-weight: 500; }
        .au-nada { font-style: normal; color: var(--ui-texto-3); }
        .au-so-cel { font-style: normal; white-space: pre; }
        .au-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: var(--ui-cinza); color: var(--ui-texto-2); font-size: 12px; font-weight: 600; white-space: nowrap; }
        .au-tag em { font-style: normal; font-weight: 500; }
        .au-tag--pro { background: var(--ui-vinho); color: var(--ui-branco); }
        .au-tag--pro em { color: rgba(255,255,255,.8); }
        .au-tag--ok { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .au-tag--bloq { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); }
        .au-tag--admin { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        @media (max-width: 420px) { .au-c--plano { padding-left: 0; } }

        /* computador: tabela */
        @media (min-width: 900px) {
          .au-card { padding: 16px; }
          .au-cab, .au-l { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1.3fr) 104px 80px 80px 118px 148px; align-items: center; column-gap: 12px; }
          .au-num { text-align: right; }
          .au-c--n { display: flex !important; flex-direction: column; align-items: flex-end; }
          .au-c--n b { font-size: 15px; }
          .au-c--n small { display: block; font-size: 12px; color: var(--ui-texto-3); }
          .au-c--plano { display: flex !important; flex-wrap: wrap; padding-left: 0; }
          .au-c--visto { padding-left: 0; flex-basis: auto; }
          .au-quebra { display: none; }
          .au-l .au-c--n { order: 0; }
          .au-cab { margin-top: 12px; padding: 10px 12px; border-radius: var(--ui-raio-p); background: var(--ui-cinza); font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
          .au-cab-acoes { text-align: right; }
          .au-l { min-height: 68px; padding: 8px 12px; border-top: 0; border-bottom: 1px solid var(--ui-linha); }
          .au-l:last-child { border-bottom: 0; }
          .au-l::after { display: none; }
          .au-l:hover { background: #FCFAFB; }
          .au-quem, .au-acoes, .au-c { order: 0; }
          .au-av { width: 40px; height: 40px; font-size: 14px; }
          .au-c { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .au-so-cel { display: none; }
          .au-acoes { justify-content: flex-end; }
        }

        .au-form { display: flex; flex-direction: column; gap: 16px; }
        .au-erro { margin: 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; font-weight: 500; line-height: 1.4; }
        .au-j-apoio { margin: 0; font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); overflow-wrap: anywhere; }
        .au-atalhos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: -4px; }
        .au-atalhos button { min-height: 44px; padding: 0 16px; border: 1px solid var(--ui-borda); border-radius: 999px; background: var(--ui-branco); color: var(--ui-texto-2); font-size: 14px; font-weight: 600; cursor: pointer; }
        .au-atalhos button[aria-pressed="true"] { border-color: var(--ui-vinho); background: var(--ui-vinho); color: var(--ui-branco); }
      `}</style>
    </div>
  );
}
