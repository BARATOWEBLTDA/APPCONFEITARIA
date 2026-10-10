import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MagnifyingGlass, WhatsappLogo, EnvelopeSimple, Lightbulb, X } from "@phosphor-icons/react";
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
      .select("id, user_id, nome, telefone, email, titulo, descricao, area, impacto, status, tela_origem, created_at")
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
      (ps || []).forEach((p: any) => { map[p.id] = { nome_loja: p.nome_loja, telefone: p.telefone }; });
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
    if (error) { mostrarToast("Não deu pra salvar: " + error.message, "erro"); return; }
    // RLS bloqueando não dá erro, só não atualiza nada
    if (!data || data.length === 0) { mostrarToast("Sem permissão pra alterar. Rode o SQL de permissões do admin.", "erro"); return; }
    setIdeias(prev => prev.map(i => (i.id === ideia.id ? { ...i, status: novo } : i)));
    const quem = (ideia.nome || "A confeiteira").split(" ")[0];
    mostrarToast(novo === "implementada"
      ? `Marcada como implementada. ${quem} vai receber a notificação.`
      : "Status atualizado.");
    window.dispatchEvent(new Event("admin-ideias-changed")); // atualiza o contador da sidebar
  };

  const contagem = useMemo(() => {
    const c = { recebida: 0, em_analise: 0, implementada: 0, recusada: 0 };
    ideias.forEach(i => { c[statusDe(i)]++; });
    return c;
  }, [ideias]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ideias.filter(i => {
      if (filtro !== "todas" && statusDe(i) !== filtro) return false;
      if (area && i.area !== area) return false;
      if (q && !`${i.titulo || ""} ${i.descricao}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ideias, filtro, busca, area]);

  const STATS: { id: Filtro; label: string; cor: string; n: number }[] = [
    { id: "recebida", label: "Novas", cor: "var(--ui-texto-3)", n: contagem.recebida },
    { id: "em_analise", label: "Em análise", cor: "var(--ui-laranja)", n: contagem.em_analise },
    { id: "implementada", label: "Implementadas", cor: "var(--ui-verde)", n: contagem.implementada },
    { id: "todas", label: "Todas", cor: "var(--ui-vinho)", n: ideias.length },
  ];

  return (
    <div className="ai-root">
      <h1 className="ai-h1">Ideias das confeiteiras</h1>
      <p className="ai-sub">
        Chegam por "Solicitar recurso" e "Enviar uma sugestão". Marcar como implementada avisa a confeiteira no celular.
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

        {erro && <p className="ai-erro" role="alert">Não deu pra carregar: {erro}</p>}

        {loading ? (
          <div className="ai-esq" aria-busy="true"><span /><span /><span /></div>
        ) : visiveis.length === 0 ? (
          ideias.length === 0
            ? <TelaVazia compacta icone={<Lightbulb size={30} />} titulo="Nenhuma ideia ainda" texto="As sugestões das confeiteiras aparecem aqui." />
            : <TelaVazia compacta icone={<Lightbulb size={30} />} titulo="Nenhuma ideia nesse filtro" texto="Troque o filtro ou a busca pra ver outras." />
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
                  <div className="ai-main">
                    {(i.area || imp) && (
                      <div className="ai-tags">
                        {i.area && <span className="ai-tag">{AREAS[i.area] || i.area}</span>}
                        {imp && <span className={`ai-tag ${imp.cls}`}>{imp.label}</span>}
                      </div>
                    )}
                    <p className="ai-t">{temTitulo ? i.titulo : i.descricao}</p>
                    {temTitulo && <p className="ai-d">{i.descricao}</p>}
                    <p className="ai-meta">
                      <b>{i.nome || "Sem nome"}{loja ? ` · ${loja}` : ""}</b> · {quando(i.created_at)} · via {origem}
                    </p>
                  </div>
                  <div className="ai-side">
                    <select
                      className={`ai-st ai-st--${st}`}
                      value={st}
                      disabled={salvando === i.id}
                      onChange={e => mudarStatus(i, e.target.value as Status)}
                      aria-label="Status da ideia"
                    >
                      {STATUS_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    {wa ? (
                      <a className="ai-act ai-act--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                        <WhatsappLogo size={18} weight="fill" aria-hidden="true" /> WhatsApp
                      </a>
                    ) : i.email ? (
                      <a className="ai-act" href={`mailto:${i.email}`}>
                        <EnvelopeSimple size={18} weight="bold" aria-hidden="true" /> E-mail
                      </a>
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
        .ai-h1 { font-size: 22px; font-weight: 700; margin: 0; color: var(--ui-texto); }
        .ai-sub { font-size: 15px; font-weight: 500; line-height: 1.5; color: var(--ui-texto-2); margin: 4px 0 0; }

        .ai-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0 12px; }
        .ai-stat {
          display: flex; flex-direction: column; gap: 2px; min-height: 72px; margin: 0; padding: 12px 14px;
          background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao);
          text-align: left; cursor: pointer; color: var(--ui-texto);
        }
        .ai-stat:hover { border-color: var(--ui-texto-3); }
        .ai-stat.on { border-color: var(--ui-vinho); box-shadow: inset 0 0 0 1px var(--ui-vinho); }
        .ai-stat small { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ai-stat small i { flex: none; width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .ai-stat b { display: block; font-size: 24px; font-weight: 700; line-height: 1.2; }

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
        .ai-card { display: flex; gap: 16px; padding: 16px 4px; border-top: 1px solid var(--ui-linha); }
        .ai-card:first-child { border-top: 0; }
        .ai-main { flex: 1; min-width: 0; }
        .ai-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .ai-tag { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: var(--ui-cinza); color: var(--ui-cinza-texto); }
        .ai-tag--alto { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); }
        .ai-tag--medio { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .ai-tag--baixo { background: var(--ui-cinza); color: var(--ui-texto-2); }
        .ai-t { font-size: 15px; font-weight: 700; line-height: 1.4; margin: 0; overflow-wrap: anywhere; }
        .ai-d { font-size: 14px; font-weight: 500; color: var(--ui-texto-2); line-height: 1.5; margin: 4px 0 0; overflow-wrap: anywhere; }
        .ai-meta { font-size: 13px; font-weight: 500; color: var(--ui-texto-3); margin: 8px 0 0; overflow-wrap: anywhere; }
        .ai-meta b { color: var(--ui-cinza-texto); font-weight: 700; }
        .ai-card--implementada .ai-t, .ai-card--recusada .ai-t { color: var(--ui-texto-2); }

        .ai-side { display: flex; flex-direction: column; gap: 8px; width: 176px; flex-shrink: 0; }
        .ai-st {
          appearance: none; -webkit-appearance: none; width: 100%; min-height: 44px; border: 0; border-radius: var(--ui-raio);
          padding: 0 32px 0 12px; font-size: 14px; font-weight: 700; cursor: pointer;
          background-repeat: no-repeat; background-position: right 12px center; background-size: 10px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' stroke-width='1.6' fill='none'/%3E%3C/svg%3E");
        }
        .ai-st:focus-visible { outline: 2px solid var(--ui-rosa); outline-offset: 2px; }
        .ai-st:disabled { opacity: 0.6; cursor: wait; }
        .ai-st--recebida { background-color: var(--ui-cinza); color: var(--ui-cinza-texto); }
        .ai-st--em_analise { background-color: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .ai-st--implementada { background-color: var(--ui-verde-fundo); color: var(--ui-verde); }
        .ai-st--recusada { background-color: var(--ui-cinza); color: var(--ui-texto-3); }
        .ai-act {
          display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 12px;
          border-radius: var(--ui-raio); border: 1px solid var(--ui-borda); background: var(--ui-branco); text-decoration: none;
          font-size: 14px; font-weight: 700; color: var(--ui-cinza-texto);
        }
        .ai-act:hover { background: var(--ui-cinza); }
        .ai-act--wa { color: var(--ui-verde); }

        @media (max-width: 900px) {
          .ai-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .ai-card { flex-direction: column; gap: 12px; }
          .ai-side { width: auto; flex-direction: row; }
          .ai-side > * { flex: 1; min-width: 0; }
        }
        @media (max-width: 480px) {
          .ai-sel { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  );
}
