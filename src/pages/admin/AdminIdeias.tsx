import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registrar } from "@/lib/adminPerfil";
import { MagnifyingGlass, EnvelopeSimple, Lightbulb, X, ChatCircleText } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { BotaoIcone, TelaVazia, avisar } from "@/components/base";

/**
 * Admin → Ideias: tudo que chega em public.sugestoes
 * (página "Solicitar recurso" + botão "Enviar uma sugestão" em Configurações).
 *
 * Marcar como "implementada" dispara o push pra dona da ideia automaticamente
 * pelo trigger trg_notify_sugestao_implementada (não precisa de código aqui).
 */

type Status = "recebida" | "em_analise" | "implementada" | "recusada";
type Filtro = Status | "todas";

interface Ideia {
  id: string;
  user_id: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  titulo: string | null;
  descricao: string;
  area: string | null;
  impacto: string | null;
  status: string | null;
  resposta?: string | null;
  tela_origem: string | null;
  created_at: string;
}

interface PerfilMini { nome_loja: string | null; telefone: string | null }

const AREAS: Record<string, string> = {
  cardapio: "Cardápio digital",
  pedidos: "Pedidos",
  agenda: "Agenda",
  produtos: "Produtos",
  ficha: "Ficha técnica",
  financeiro: "Financeiro",
  clientes: "Clientes",
  insumos: "Ingredientes",
  app: "Outro",
  outro: "Outro",
};

const IMPACTO: Record<string, { label: string; cls: string }> = {
  baixo: { label: "Seria legal", cls: "ai-tag--baixo" },
  medio: { label: "Faz falta", cls: "ai-tag--medio" },
  alto: { label: "Muita falta", cls: "ai-tag--alto" },
};

const STATUS_OPTS: { id: Status; label: string }[] = [
  { id: "recebida", label: "Recebida" },
  { id: "em_analise", label: "Em análise" },
  { id: "implementada", label: "Implementada" },
  { id: "recusada", label: "Recusada" },
];

const statusDe = (i: Ideia): Status => (i.status as Status) || "recebida";
/** (10/11) "Nova" = chegou e ninguém respondeu ainda. Respondeu (recado) ou mudou a situação: sai das novas */
const ehNova = (i: Ideia) => statusDe(i) === "recebida" && !i.resposta?.trim();

function quando(iso: string): string {
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  if (dias < 30) return `há ${Math.floor(dias / 7)} sem`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function soDigitos(v: string | null | undefined): string {
  const d = (v || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length <= 11 ? `55${d}` : d; // sem DDI → Brasil
}

export default function AdminIdeias() {
  const [ideias, setIdeias] = useState<Ideia[]>([]);
  const [perfis, setPerfis] = useState<Record<string, PerfilMini>>({});
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("recebida");
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    const { data, error } = await supabase
      .from("sugestoes")
      .select("id, user_id, nome, telefone, email, titulo, descricao, area, impacto, status, resposta, tela_origem, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }
    const lista = (data as Ideia[]) || [];
    setIdeias(lista);

    // Nome da loja e WhatsApp atualizados vêm do perfil (a sugestão guarda só o que tinha no envio)
    const ids = [...new Set(lista.map(i => i.user_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: ps } = await supabase.from("profiles").select("id, nome_loja, telefone").in("id", ids);
      const map: Record<string, PerfilMini> = {};
      (ps || []).forEach((p: PerfilMini & { id: string }) => { map[p.id] = { nome_loja: p.nome_loja, telefone: p.telefone }; });
      setPerfis(map);
    }
    setLoading(false);
  };

  useEffect(() => { carregar(); }, []);

  const mostrarToast = (m: string, tipo: "ok" | "erro" = "ok") => avisar(m, { tipo });

  const mudarStatus = async (ideia: Ideia, novo: Status) => {
    if (novo === statusDe(ideia)) return;
    setSalvando(ideia.id);
    const { data, error } = await supabase.from("sugestoes").update({ status: novo }).eq("id", ideia.id).select("id");
    setSalvando(null);
    if (error) { mostrarToast("Não deu para salvar: " + error.message, "erro"); return; }
    // RLS bloqueando não dá erro, só não atualiza nada
    if (!data || data.length === 0) { mostrarToast("Sem permissão para alterar. Rode o SQL de permissões do admin.", "erro"); return; }
    setIdeias(prev => prev.map(i => (i.id === ideia.id ? { ...i, status: novo } : i)));
    const rot = STATUS_OPTS.find(o => o.id === novo)?.label || novo;
    void registrar(`marcou a ideia "${(ideia.titulo || "sem título").slice(0, 60)}" como ${rot.toLowerCase()}`, { tipo: "ideia", alvo_id: ideia.id });
    const quem = (ideia.nome || "A confeiteira").split(" ")[0];
    mostrarToast(novo === "implementada"
      ? `Marcada como implementada. ${quem} vai receber a notificação.`
      : `Status atualizado. ${quem} vai receber a notificação.`);
    window.dispatchEvent(new Event("admin-ideias-changed")); // atualiza o contador da sidebar
  };

  // (6.95) recado para a confeiteira: salvo na ideia, ela recebe a notificação (e vê na lista dela)
  const [recado, setRecado] = useState<Record<string, string>>({});
  const [abertoRecado, setAbertoRecado] = useState<string | null>(null);
  const enviarRecado = async (ideia: Ideia) => {
    const txt = (recado[ideia.id] ?? "").trim();
    if (!txt) return;
    setSalvando(ideia.id);
    const mudaSituacao = statusDe(ideia) === "recebida";
    const { data, error } = await supabase.from("sugestoes").update(mudaSituacao ? { resposta: txt, status: "em_analise" } : { resposta: txt }).eq("id", ideia.id).select("id");
    setSalvando(null);
    if (error || !data?.length) { mostrarToast("Não deu para enviar o recado.", "erro"); return; }
    setIdeias(prev => prev.map(i => (i.id === ideia.id ? { ...i, resposta: txt, ...(mudaSituacao ? { status: "em_analise" } : {}) } : i)));
    setAbertoRecado(null);
    window.dispatchEvent(new Event("admin-ideias-changed")); // a ideia respondida sai das novas (contador do menu)
    setRecado(r => { const n = { ...r }; delete n[ideia.id]; return n; });
    mostrarToast(`Recado enviado. ${(ideia.nome || "A confeiteira").split(" ")[0]} recebe a notificação.`);
  };

  const contagem = useMemo(() => {
    const c = { recebida: 0, em_analise: 0, implementada: 0, recusada: 0 };
    ideias.forEach(i => { if (ehNova(i)) c.recebida++; else if (statusDe(i) !== "recebida") c[statusDe(i)]++; });
    return c;
  }, [ideias]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ideias.filter(i => {
      if (filtro === "recebida" ? !ehNova(i) : filtro !== "todas" && statusDe(i) !== filtro) return false;
      if (area && i.area !== area) return false;
      if (q && !`${i.titulo || ""} ${i.descricao}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ideias, filtro, busca, area]);

  const STATS: { id: Filtro; label: string; cor: string; n: number }[] = [
    { id: "recebida", label: "Novas", cor: "var(--ui-texto-3)", n: contagem.recebida },
    { id: "em_analise", label: "Em análise", cor: "var(--ui-laranja)", n: contagem.em_analise },
    { id: "implementada", label: "Implementadas", cor: "var(--ui-verde)", n: contagem.implementada },
    { id: "recusada", label: "Recusadas", cor: "var(--ui-texto-3)", n: contagem.recusada },
    { id: "todas", label: "Todas", cor: "var(--ui-texto)", n: ideias.length },
  ];

  return (
    <div className="ai-root">
      <h1 className="ai-h1">Ideias</h1>
      <p className="ai-sub">
        O que as confeiteiras pediram. Mudar a situação ou mandar um recado avisa ela no celular.
      </p>

      <div className="ai-stats" role="tablist" aria-label="Filtrar por status">
        {STATS.map(s => (
          <button key={s.id} type="button" role="tab" aria-selected={filtro === s.id} className={`ai-stat${filtro === s.id ? " on" : ""}`} onClick={() => setFiltro(s.id)}>
            <small><i style={{ background: s.cor }} />{s.label}</small>
            <b>{s.n}</b>
          </button>
        ))}
      </div>

      <div className="ai-cartao">
        <div className="ai-tools">
          <label className="ai-search">
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ideia" aria-label="Buscar ideia" />
            {busca && (
              <BotaoIcone rotulo="Limpar busca" variante="limpo" tamanho="p" onClick={() => setBusca("")}>
                <X size={18} weight="bold" />
              </BotaoIcone>
            )}
          </label>
          <select className="ai-sel" value={area} onChange={e => setArea(e.target.value)} aria-label="Área">
            <option value="">Todas as áreas</option>
            {Object.entries(AREAS).filter(([id]) => id !== "app").map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>

        {erro && <p className="ai-erro" role="alert">Não deu para carregar: {erro}</p>}

        {loading ? (
          <div className="ai-esq" aria-busy="true"><span /><span /><span /></div>
        ) : visiveis.length === 0 ? (
          ideias.length === 0
            ? <TelaVazia compacta icone={<Lightbulb size={30} />} titulo="Nenhuma ideia ainda" texto="As sugestões das confeiteiras aparecem aqui." />
            : <TelaVazia compacta icone={<Lightbulb size={30} />} titulo="Nenhuma ideia nesse filtro" texto="Troque o filtro ou a busca para ver outras." />
        ) : (
          <div className="ai-list">
            {visiveis.map(i => {
              const st = statusDe(i);
              const perfil = i.user_id ? perfis[i.user_id] : undefined;
              const loja = perfil?.nome_loja;
              const wa = soDigitos(perfil?.telefone || i.telefone);
              const imp = i.impacto ? IMPACTO[i.impacto] : null;
              const temTitulo = !!i.titulo?.trim() && i.titulo.trim() !== i.descricao.trim();
              const origem = i.tela_origem ? "Configurações" : "Solicitar recurso";
              return (
                <article key={i.id} className={`ai-card ai-card--${st}`}>
                  {/* (10/11) cartão novo: quem pediu em cima, a ideia no meio, e embaixo a situação, o recado e o WhatsApp */}
                  <div className="ai-quem">
                    <span className="ai-av" aria-hidden="true">{(loja || i.nome || "?").charAt(0).toUpperCase()}</span>
                    <span className="ai-quem-tx"><b>{loja || i.nome || "Sem nome"}</b><small>{[loja && i.nome ? i.nome : "", quando(i.created_at)].filter(Boolean).join(" · ")}</small></span>
                    {ehNova(i) && <span className="ai-nova">Nova</span>}
                  </div>
                  <p className="ai-t">{temTitulo ? i.titulo : i.descricao}</p>
                  {temTitulo && <p className="ai-d">{i.descricao}</p>}
                  <p className="ai-tags">
                    {[i.area ? AREAS[i.area] || i.area : "", `via ${origem}`].filter(Boolean).join(" · ")}
                    {imp && <> · <span className={imp.cls}>{imp.label}</span></>}
                  </p>
                  {i.resposta?.trim() && abertoRecado !== i.id && (
                    <div className="ai-resp"><span><small>Seu recado</small>{i.resposta}</span>
                      <button type="button" onClick={() => { setRecado(r => ({ ...r, [i.id]: i.resposta || "" })); setAbertoRecado(i.id); }}>Editar</button></div>
                  )}
                  {abertoRecado === i.id && (
                    <div className="ai-recado">
                      <textarea rows={3} autoFocus value={recado[i.id] ?? ""} placeholder="Escreva o recado. Ela recebe no celular." maxLength={300} aria-label="Recado para a confeiteira"
                        onChange={e => setRecado(r => ({ ...r, [i.id]: e.target.value }))} />
                      <div className="ai-recado-bts">
                        <button type="button" className="ai-bt" onClick={() => setAbertoRecado(null)}>Cancelar</button>
                        <button type="button" className="ai-bt ai-bt--cheio" disabled={salvando === i.id || !(recado[i.id] ?? "").trim()} onClick={() => void enviarRecado(i)}>Enviar recado</button>
                      </div>
                    </div>
                  )}
                  <div className="ai-pe">
                    <label className="ai-sit"><span>Situação</span>
                      <select className="ai-st" value={st} disabled={salvando === i.id} onChange={e => mudarStatus(i, e.target.value as Status)} aria-label="Situação da ideia">
                        {STATUS_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                      </select>
                    </label>
                    {i.user_id && !i.resposta?.trim() && abertoRecado !== i.id && (
                      <button type="button" className="ai-bt" onClick={() => setAbertoRecado(i.id)}><ChatCircleText size={18} weight="bold" aria-hidden="true" /> Responder</button>
                    )}
                    {wa ? (
                      <a className="ai-bt ai-bt--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp de ${i.nome || "quem enviou"}`}><IconeWhatsApp size={18} /> WhatsApp</a>
                    ) : i.email ? (
                      <a className="ai-bt" href={`mailto:${i.email}`}><EnvelopeSimple size={18} weight="bold" aria-hidden="true" /> E-mail</a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .ai-root { font-family: var(--font-base); max-width: 1000px; margin: 0 auto; color: var(--ui-texto); }
        .ai-root button, .ai-root select { font-family: inherit; }
        .ai-h1 { font-size: 22px; font-weight: 600; margin: 0; color: var(--ui-texto); }
        .ai-sub { font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); margin: 4px 0 0; }

        .ai-stats { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 20px 0 12px; }
        .ai-stat {
          display: flex; flex-direction: column; gap: 2px; min-height: 72px; margin: 0; padding: 12px 14px;
          background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao);
          text-align: left; cursor: pointer; color: var(--ui-texto);
        }
        .ai-stat:hover { border-color: var(--ui-texto-3); }
        .ai-stat.on { border-color: var(--ui-texto); box-shadow: inset 0 0 0 1px var(--ui-texto); }
        .ai-stat small { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-stat small i { flex: none; width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .ai-stat b { display: block; font-size: 22px; font-weight: 500; line-height: 1.2; }

        .ai-cartao { padding: 12px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ai-tools { display: flex; gap: 8px; flex-wrap: wrap; }
        .ai-search {
          flex: 1 1 240px; min-width: 0; display: flex; align-items: center; gap: 8px; height: 48px; padding: 0 4px 0 12px;
          background: var(--ui-branco); border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio); color: var(--ui-texto-3);
        }
        .ai-search input { flex: 1; min-width: 0; height: 100%; border: 0; background: none; outline: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
        .ai-search input::placeholder { color: var(--ui-texto-3); }
        .ai-search input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
        .ai-search:focus-within { border-color: var(--ui-rosa); }
        .ai-sel {
          flex: 0 1 220px; min-width: 0; height: 48px; padding: 0 36px 0 12px; appearance: none; -webkit-appearance: none;
          background: var(--ui-branco) no-repeat right 12px center / 12px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B5D64' stroke-width='1.6' fill='none'/%3E%3C/svg%3E");
          border: 1px solid var(--ui-borda-campo); border-radius: var(--ui-raio);
          font-size: 16px; font-weight: 500; color: var(--ui-texto); cursor: pointer;
        }
        .ai-sel:focus { outline: none; border-color: var(--ui-rosa); }

        .ai-erro { margin: 12px 0 0; padding: 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; font-weight: 500; }

        .ai-esq { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .ai-esq span { height: 96px; border-radius: var(--ui-raio); background: var(--ui-cinza); }

        .ai-list { display: flex; flex-direction: column; margin-top: 4px; }
        /* (10/11) cartão das ideias refeito */
        .ai-card { display: flex; flex-direction: column; gap: 6px; padding: 16px 4px; border-top: 1px solid var(--ui-linha); }
        .ai-card:first-child { border-top: 0; }
        .ai-quem { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; min-width: 0; }
        .ai-av { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--ui-linha); border-radius: 50%; background: var(--ui-branco); font-size: 14px; font-weight: 500; color: var(--ui-texto); }
        .ai-quem-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .ai-quem-tx b { font-size: 14px; font-weight: 500; color: var(--ui-texto); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-quem-tx small { font-size: 12px; font-weight: 500; color: var(--ui-texto-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ai-nova { flex: none; font-size: 12px; font-weight: 500; color: var(--ui-rosa-escuro); }
        .ai-t { margin: 0; font-size: 16px; font-weight: 500; line-height: 1.4; color: var(--ui-texto); overflow-wrap: anywhere; text-wrap: pretty; }
        .ai-d { margin: 0; font-size: 14px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); overflow-wrap: anywhere; text-wrap: pretty; }
        .ai-tags { margin: 2px 0 0; font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
        .ai-tag--alto { color: var(--ui-vermelho-escuro); }
        .ai-tag--medio { color: var(--ui-laranja); }
        .ai-tag--baixo { color: var(--ui-texto-2); }
        .ai-card--implementada .ai-t, .ai-card--recusada .ai-t { color: var(--ui-texto-2); }
        .ai-resp { display: flex; align-items: flex-start; gap: 8px; margin-top: 6px; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-fundo); font-size: 14px; font-weight: 500; color: var(--ui-texto); overflow-wrap: anywhere; }
        .ai-resp > span { flex: 1; min-width: 0; }
        .ai-resp small { display: block; margin-bottom: 2px; font-size: 12px; color: var(--ui-texto-3); }
        .ai-resp button { flex: none; min-height: 32px; padding: 0 4px; border: 0; background: none; color: var(--ui-rosa-escuro); font-size: 14px; font-weight: 500; cursor: pointer; }
        .ai-recado { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
        .ai-recado textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--ui-borda-campo, var(--ui-borda)); border-radius: var(--ui-raio); font-family: inherit; font-size: 16px; line-height: 1.4; resize: vertical; box-sizing: border-box; }
        .ai-recado textarea:focus { outline: none; border-color: var(--ui-rosa); }
        .ai-recado-bts { display: flex; justify-content: flex-end; gap: 8px; }
        .ai-pe { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
        .ai-sit { display: flex; align-items: center; gap: 8px; margin-right: auto; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); }
        .ai-st {
          appearance: none; -webkit-appearance: none; min-height: 44px; padding: 0 34px 0 12px; border: 1px solid var(--ui-borda-campo, var(--ui-borda)); border-radius: var(--ui-raio);
          background: var(--ui-branco) no-repeat right 12px center / 10px; font-size: 14px; font-weight: 500; color: var(--ui-texto); cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' stroke-width='1.6' fill='none'/%3E%3C/svg%3E");
        }
        .ai-st:focus-visible { outline: 2px solid var(--ui-rosa); outline-offset: 2px; }
        .ai-st:disabled { opacity: .6; cursor: wait; }
        .ai-bt { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 14px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-botao, var(--ui-raio)); background: var(--ui-branco); color: var(--ui-texto); font-size: 14px; font-weight: 500; text-decoration: none; cursor: pointer; white-space: nowrap; }
        .ai-bt:hover { background: var(--ui-fundo); }
        .ai-bt--cheio { border-color: transparent; background: var(--ui-rosa-botao, #CC2E66); color: var(--ui-branco); }
        .ai-bt--cheio:hover { background: var(--ui-rosa-botao, #CC2E66); filter: brightness(.95); }
        .ai-bt--cheio:disabled { opacity: .5; cursor: default; }
        .ai-bt--wa { color: var(--ui-verde); }

        @media (max-width: 900px) {
          .ai-stats { display: flex; gap: 8px; overflow-x: auto; margin: 16px -16px 12px; padding: 0 16px; scrollbar-width: none; }
          .ai-stats::-webkit-scrollbar { display: none; }
          .ai-stat { flex: none; min-height: 60px; padding: 8px 12px; }
          .ai-stat b { font-size: 18px; }
          .ai-pe { gap: 8px; }
          .ai-sit { width: 100%; margin-right: 0; }
          .ai-sit .ai-st { flex: 1; }
          .ai-pe > .ai-bt { flex: 1; }
        }
        @media (max-width: 480px) {
          .ai-sel { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
}
