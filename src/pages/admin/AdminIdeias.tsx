import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MagnifyingGlass, WhatsappLogo, EnvelopeSimple, CheckCircle } from "@phosphor-icons/react";

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
  pedidos: "Pedidos",
  cardapio: "Cardápio online",
  produtos: "Produtos e receitas",
  insumos: "Insumos",
  financeiro: "Financeiro",
  clientes: "Clientes",
  app: "App em geral",
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
  const [toast, setToast] = useState<string | null>(null);

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

  const mostrarToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const mudarStatus = async (ideia: Ideia, novo: Status) => {
    if (novo === statusDe(ideia)) return;
    setSalvando(ideia.id);
    const { data, error } = await supabase.from("sugestoes").update({ status: novo }).eq("id", ideia.id).select("id");
    setSalvando(null);
    if (error) { mostrarToast("Erro ao salvar: " + error.message); return; }
    // RLS bloqueando não dá erro, só não atualiza nada
    if (!data || data.length === 0) { mostrarToast("Sem permissão pra alterar. Rode o SQL de permissões do admin."); return; }
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
    { id: "recebida", label: "Novas", cor: "#9CA3AF", n: contagem.recebida },
    { id: "em_analise", label: "Em análise", cor: "#F59E0B", n: contagem.em_analise },
    { id: "implementada", label: "Implementadas", cor: "#16a34a", n: contagem.implementada },
    { id: "todas", label: "Todas", cor: "#2C1219", n: ideias.length },
  ];

  return (
    <div className="ai-root">
      <h1 className="ai-h1">Ideias das confeiteiras</h1>
      <p className="ai-sub">
        Tudo que chega por "Solicitar recurso" e "Enviar uma sugestão". Marcar como implementada avisa a confeiteira no celular.
      </p>

      <div className="ai-stats">
        {STATS.map(s => (
          <button key={s.id} className={`ai-stat${filtro === s.id ? " on" : ""}`} onClick={() => setFiltro(s.id)}>
            <small><i style={{ background: s.cor }} />{s.label}</small>
            <b>{s.n}</b>
          </button>
        ))}
      </div>

      <div className="ai-tools">
        <label className="ai-search">
          <MagnifyingGlass size={15} weight="bold" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ideia (ex: promoção, iFood...)" />
        </label>
        <select className="ai-sel" value={area} onChange={e => setArea(e.target.value)} aria-label="Área">
          <option value="">Todas as áreas</option>
          {Object.entries(AREAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      {erro && <p className="ai-erro">Não foi possível carregar: {erro}</p>}

      {loading ? (
        <p className="ai-empty">Carregando...</p>
      ) : visiveis.length === 0 ? (
        <p className="ai-empty">Nenhuma ideia nesse filtro.</p>
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
                  <div className="ai-tags">
                    {i.area && <span className="ai-tag">{AREAS[i.area] || i.area}</span>}
                    {imp && <span className={`ai-tag ${imp.cls}`}>{imp.label}</span>}
                  </div>
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
                      <WhatsappLogo size={14} weight="fill" /> WhatsApp
                    </a>
                  ) : i.email ? (
                    <a className="ai-act" href={`mailto:${i.email}`}>
                      <EnvelopeSimple size={14} weight="bold" /> E-mail
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="ai-toast" role="status">
          <CheckCircle size={16} weight="fill" /> {toast}
        </div>
      )}

      <style>{`
        .ai-root { font-family: var(--font-base); padding: 24px; max-width: 1000px; margin: 0 auto; color: #2C1219; }
        .ai-h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.02em; margin: 0; }
        .ai-sub { font-size: 13px; color: #6B7280; margin: 6px 0 0; }

        .ai-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0 16px; }
        .ai-stat {
          background: #fff; border: 1px solid #F0EBED; border-radius: 12px; padding: 14px 16px;
          text-align: left; cursor: pointer; font-family: inherit; color: inherit;
        }
        .ai-stat.on { border-color: #2C1219; box-shadow: inset 0 0 0 1px #2C1219; }
        .ai-stat small { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #6B7280; }
        .ai-stat small i { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
        .ai-stat b { display: block; font-size: 26px; font-weight: 900; margin-top: 4px; letter-spacing: -0.02em; }

        .ai-tools { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .ai-search {
          flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px;
          background: #fff; border: 1px solid #F0EBED; border-radius: 10px; padding: 0 12px; color: #9CA3AF;
        }
        .ai-search input { flex: 1; border: 0; background: none; padding: 11px 0; font-family: inherit; font-size: 13.5px; color: #2C1219; }
        .ai-search input:focus { outline: none; }
        .ai-search:focus-within { border-color: #E85A8C; }
        .ai-sel { background: #fff; border: 1px solid #F0EBED; border-radius: 10px; padding: 0 12px; height: 42px; font-family: inherit; font-size: 13px; font-weight: 600; color: #2C1219; }

        .ai-erro { font-size: 13px; font-weight: 600; color: #B91C1C; background: #FEE2E2; border-radius: 8px; padding: 10px 12px; }
        .ai-empty { text-align: center; padding: 40px; color: #6B7280; font-size: 13px; }

        .ai-list { display: flex; flex-direction: column; gap: 8px; }
        .ai-card { display: flex; gap: 16px; background: #fff; border: 1px solid #F0EBED; border-radius: 12px; padding: 16px 18px; }
        .ai-card--implementada, .ai-card--recusada { background: #FCFBFB; }
        .ai-main { flex: 1; min-width: 0; }
        .ai-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
        .ai-tag { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 5px; background: #F5F0F2; color: #4B3A42; }
        .ai-tag--alto { background: #FEE2E2; color: #B91C1C; }
        .ai-tag--medio { background: #FEF3C7; color: #B45309; }
        .ai-tag--baixo { background: #F3F4F6; color: #4B5563; }
        .ai-t { font-size: 15px; font-weight: 800; line-height: 1.35; margin: 0; overflow-wrap: anywhere; }
        .ai-d { font-size: 13px; color: #4B5563; line-height: 1.5; margin: 4px 0 0; overflow-wrap: anywhere; }
        .ai-meta { font-size: 12px; color: #9CA3AF; margin: 10px 0 0; }
        .ai-meta b { color: #4B3A42; font-weight: 700; }

        .ai-side { display: flex; flex-direction: column; gap: 8px; width: 160px; flex-shrink: 0; }
        .ai-st {
          appearance: none; -webkit-appearance: none; border: 0; border-radius: 8px;
          padding: 9px 30px 9px 12px; font-family: inherit; font-size: 12.5px; font-weight: 800; cursor: pointer;
          background-repeat: no-repeat; background-position: right 10px center; background-size: 10px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' stroke-width='1.6' fill='none'/%3E%3C/svg%3E");
        }
        .ai-st:disabled { opacity: 0.6; cursor: wait; }
        .ai-st--recebida { background-color: #F3F4F6; color: #374151; }
        .ai-st--em_analise { background-color: #FEF3C7; color: #92400E; }
        .ai-st--implementada { background-color: #DCFCE7; color: #166534; }
        .ai-st--recusada { background-color: #F3F4F6; color: #9CA3AF; }
        .ai-act {
          display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 10px;
          border-radius: 8px; border: 1px solid #F0EBED; background: #fff; text-decoration: none;
          font-size: 12.5px; font-weight: 700; color: #4B3A42;
        }
        .ai-act:hover { background: #FAF7F8; }
        .ai-act--wa { color: #15803D; }

        .ai-toast {
          position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 1000;
          background: #2C1219; color: #fff; padding: 12px 16px; border-radius: 10px;
          font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; max-width: 90vw;
          box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        }
        .ai-toast svg { color: #4ADE80; flex-shrink: 0; }

        @media (max-width: 900px) {
          .ai-stats { grid-template-columns: repeat(2, 1fr); }
          .ai-card { flex-direction: column; }
          .ai-side { width: auto; flex-direction: row; }
          .ai-side > * { flex: 1; }
        }
      `}</style>
    </div>
  );
}
