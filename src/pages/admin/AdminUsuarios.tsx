import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, MagnifyingGlass, X, Crown, Lock, LockOpen, Trash, Users, UserPlus } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Campo, Janela, TelaVazia, avisar, confirmar, informar } from "@/components/base";

export default function AdminUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ nome: "", email: "", senha: "", telefone: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_users").select("*").order("created_at", { ascending: false });
    // Mescla plano e pro_expira_em vindos de profiles (caso a view admin_users não inclua)
    const ids = (data || []).map(u => u.id).filter(Boolean);
    if (ids.length) {
      const { data: planos } = await supabase.from("profiles").select("id, plano, pro_expira_em, indicado_por").in("id", ids);
      const mapa = new Map((planos || []).map(p => [p.id, p]));
      setUsers((data || []).map(u => ({ ...u, ...(mapa.get(u.id) || {}) })));
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  /**
   * Ativa PRO por N dias (padrão 30). Se já é PRO ativo, desativa.
   * Uso: botão da coroa na lista de usuários (ativar abre a janela de dias).
   */
  const [proAlvo, setProAlvo] = useState<any | null>(null);
  const [proDias, setProDias] = useState("30");
  const [proErro, setProErro] = useState("");
  const [proSalvando, setProSalvando] = useState(false);

  const handleTogglePRO = async (u: any) => {
    const isPROAtivo = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());
    console.log("[PRO] Iniciando toggle:", { userId: u.id, email: u.email, isPROAtivo });

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
      console.log("[PRO] Desativar resposta:", { data, error });
      if (error) { informar({ titulo: "Não deu pra desativar o PRO", texto: error.message, icone: "erro" }); return; }
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
    console.log("[PRO] Ativar resposta:", { data, error, expira: expira.toISOString() });
    setProSalvando(false);
    if (error) { informar({ titulo: "Não deu pra ativar o PRO", texto: error.message, icone: "erro" }); return; }
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
    console.log("Session token:", session?.access_token ? "exists" : "MISSING");
    console.log("User email:", session?.user?.email);
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    });
    console.log("Response status:", res.status);
    const json = await res.json();
    console.log("Response body:", json);
    if (!res.ok) throw new Error(json.error || "Erro na operação");
    return json;
  };

  const handleCreate = async () => {
    if (!createForm.nome.trim() || !createForm.email.trim() || createForm.senha.length < 6) {
      setCreateError("Preencha nome, e-mail e senha (mínimo 6 caracteres).");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      await callEdge({ action: "create", ...createForm });
      setShowCreate(false);
      setCreateForm({ nome: "", email: "", senha: "", telefone: "" });
      await load();
    } catch (err: any) {
      setCreateError(err.message);
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
    } catch (err: any) {
      avisar(err.message, { tipo: "erro" });
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
    } catch (err: any) {
      avisar(err.message, { tipo: "erro" });
    }
    setActionLoading(false);
  };

  const filtered = users.filter(u =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const fecharCriar = () => { if (!creating) setShowCreate(false); };

  return (
    <div className="au-root">
      <div className="au-topo">
        <div className="au-topo-t">
          <h1 className="au-h1">Usuários</h1>
          <p className="au-sub">{users.length} {users.length === 1 ? "usuário cadastrado" : "usuários cadastrados"}</p>
        </div>
        <Botao icone={<Plus size={20} weight="bold" />} onClick={() => { setShowCreate(true); setCreateError(""); }}>
          Novo usuário
        </Botao>
      </div>

      <div className="au-card">
        <label className="au-busca">
          <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
          <input type="search" placeholder="Buscar por nome ou e-mail" aria-label="Buscar por nome ou e-mail" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <BotaoIcone rotulo="Limpar busca" variante="limpo" tamanho="p" onClick={() => setSearch("")}>
              <X size={18} weight="bold" />
            </BotaoIcone>
          )}
        </label>

        {loading ? (
          <div className="au-esq" aria-busy="true"><span /><span /><span /><span /></div>
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
              <span role="columnheader">Telefone</span>
              <span role="columnheader">Cadastro</span>
              <span role="columnheader">Plano</span>
              <span role="columnheader">Status</span>
              <span role="columnheader" className="au-cab-acoes">Ações</span>
            </div>
            {filtered.map(u => {
              const isPROAtivo = u.plano === "pro" && (!u.pro_expira_em || new Date(u.pro_expira_em) > new Date());
              const proExpiraTexto = u.pro_expira_em ? new Date(u.pro_expira_em).toLocaleDateString("pt-BR") : "";
              const cadastro = u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR") : "";
              const status = u.is_admin ? "Admin" : u.banned_until ? "Bloqueado" : "Ativo";
              const stCls = u.is_admin ? "admin" : u.banned_until ? "bloq" : "ok";
              return (
                <div key={u.id} className="au-l" role="row">
                  <div className="au-quem" role="cell">
                    <span className="au-av" aria-hidden="true">
                      {u.foto_url ? <img src={u.foto_url} alt="" /> : (u.nome || u.email || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="au-quem-tx">
                      <b>{u.nome || "Sem nome"}</b>
                      <small>{u.email}</small>
                    </span>
                  </div>
                  <span className="au-c au-c--tel" role="cell">{u.telefone || <i className="au-nada">Sem telefone</i>}</span>
                  <span className="au-c au-c--data" role="cell">{cadastro ? <><em className="au-so-cel">Desde </em>{cadastro}</> : "—"}</span>
                  <span className="au-c au-c--plano" role="cell">
                    {isPROAtivo
                      ? <span className="au-tag au-tag--pro" title={proExpiraTexto ? `Vence em ${proExpiraTexto}` : undefined}><Crown size={14} weight="fill" aria-hidden="true" /> PRO{proExpiraTexto ? <em> até {proExpiraTexto}</em> : null}</span>
                      : <span className="au-tag">Grátis</span>}
                  </span>
                  <span className="au-c au-c--st" role="cell"><span className={`au-tag au-tag--${stCls}`}>{status}</span></span>
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
          <Campo rotulo="Senha" obrigatorio type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" dica="Mínimo 6 caracteres." value={createForm.senha} onChange={e => setCreateForm({...createForm, senha: e.target.value})} />
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
        texto={confirmDelete ? `${confirmDelete.email} some do Doonly. Não dá pra desfazer.` : undefined}
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
        .au-h1 { font-size: 22px; font-weight: 700; margin: 0; color: var(--ui-texto); }
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
        /* celular: nome e botões em cima; plano, status e data numa linha embaixo */
        .au-l { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 12px 0; border-top: 1px solid var(--ui-linha); }
        .au-cab + .au-l { border-top: 0; }
        .au-l::after { content: ""; order: 2; flex-basis: 100%; height: 0; }
        .au-quem { order: 1; flex: 1 1 0; display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 48px; }
        .au-acoes { order: 2; flex: none; display: flex; align-items: center; gap: 2px; }
        .au-av { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; overflow: hidden; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 16px; font-weight: 700; }
        .au-av img { width: 100%; height: 100%; object-fit: cover; }
        .au-quem-tx { min-width: 0; display: flex; flex-direction: column; }
        .au-quem-tx b { font-size: 15px; font-weight: 700; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-quem-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .au-bt-perigo { color: var(--ui-vermelho); }
        .au-bt-perigo:hover { background: var(--ui-vermelho-fundo); }
        .au-c { display: inline-flex; align-items: center; min-width: 0; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .au-c--tel { display: none; }
        .au-c--plano { order: 3; padding-left: 56px; }
        .au-c--st { order: 4; }
        .au-c--data { order: 5; }
        .au-nada { font-style: normal; color: var(--ui-texto-3); }
        .au-so-cel { font-style: normal; white-space: pre; }
        .au-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: var(--ui-cinza); color: var(--ui-texto-2); font-size: 12px; font-weight: 700; white-space: nowrap; }
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
          .au-cab, .au-l { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1.1fr) 104px minmax(0, 1.3fr) 96px 148px; align-items: center; column-gap: 12px; }
          .au-cab { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--ui-cinza); font-size: 13px; font-weight: 700; color: var(--ui-texto-2); }
          .au-cab-acoes { text-align: right; }
          .au-l { min-height: 68px; padding: 8px 12px; border-top: 0; border-bottom: 1px solid var(--ui-linha); }
          .au-l:last-child { border-bottom: 0; }
          .au-l::after { display: none; }
          .au-l:hover { background: #FCFAFB; }
          .au-quem, .au-acoes, .au-c { order: 0; }
          .au-c--plano { padding-left: 0; }
          .au-av { width: 40px; height: 40px; font-size: 14px; }
          .au-c { display: block; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .au-so-cel { display: none; }
          .au-acoes { justify-content: flex-end; }
        }

        .au-form { display: flex; flex-direction: column; gap: 16px; }
        .au-erro { margin: 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; font-weight: 500; line-height: 1.4; }
        .au-j-apoio { margin: 0; font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); overflow-wrap: anywhere; }
        .au-atalhos { display: flex; gap: 8px; flex-wrap: wrap; margin-top: -4px; }
        .au-atalhos button { min-height: 44px; padding: 0 16px; border: 1px solid var(--ui-borda); border-radius: 999px; background: var(--ui-branco); color: var(--ui-texto-2); font-size: 14px; font-weight: 700; cursor: pointer; }
        .au-atalhos button[aria-pressed="true"] { border-color: var(--ui-vinho); background: var(--ui-vinho); color: var(--ui-branco); }
      `}</style>
    </div>
  );
}
