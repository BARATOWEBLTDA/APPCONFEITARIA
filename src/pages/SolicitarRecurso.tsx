import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { useProfile } from "@/hooks/useProfile";
import {
  Lightbulb, Image as ImageIcon, PaperPlaneTilt, Clock,
  Flame, WarningCircle, Circle, CheckCircle,
} from "@phosphor-icons/react";

interface Sugestao {
  id: string;
  titulo: string | null;
  descricao: string;
  area: string | null;
  impacto: string | null;
  status: string | null;
  created_at: string;
}

const AREAS = [
  { id: "pedidos", label: "Pedidos" },
  { id: "cardapio", label: "Cardápio online" },
  { id: "produtos", label: "Produtos e receitas" },
  { id: "insumos", label: "Insumos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "clientes", label: "Clientes" },
  { id: "app", label: "App em geral" },
  { id: "outro", label: "Outro" },
];

const IMPACTOS: { id: "baixo" | "medio" | "alto"; label: string; icon: React.ReactNode }[] = [
  { id: "baixo", label: "Baixo", icon: <Circle size={16} weight="fill" /> },
  { id: "medio", label: "Médio", icon: <Flame size={16} weight="fill" /> },
  { id: "alto",  label: "Alto",  icon: <WarningCircle size={16} weight="fill" /> },
];

const STATUS_LABELS: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  recebida:      { label: "Recebida",      cls: "sr-status--recebida",      icon: <Circle       size={10} weight="fill" /> },
  em_analise:    { label: "Em análise",    cls: "sr-status--analise",       icon: <Circle       size={10} weight="fill" /> },
  implementada:  { label: "Implementada",  cls: "sr-status--implementada",  icon: <CheckCircle  size={10} weight="fill" /> },
  recusada:      { label: "Recusada",      cls: "sr-status--recusada",      icon: <Circle       size={10} weight="fill" /> },
};

function tempoRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  const sem = Math.floor(dias / 7);
  if (sem < 4) return `há ${sem} sem`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  return `há ${Math.floor(dias / 365)} anos`;
}

export default function SolicitarRecurso() {
  const { profile } = useProfile();
  const [area, setArea] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState<"baixo" | "medio" | "alto" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ txt: string; tipo: "ok" | "err" } | null>(null);
  const [historico, setHistorico] = useState<Sugestao[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  const carregarHistorico = async () => {
    setLoadingHist(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingHist(false); return; }
    const { data } = await supabase
      .from("sugestoes")
      .select("id, titulo, descricao, area, impacto, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistorico((data as Sugestao[]) || []);
    setLoadingHist(false);
  };

  useEffect(() => { carregarHistorico(); }, []);

  const showMsg = (txt: string, tipo: "ok" | "err") => {
    setMsg({ txt, tipo });
    setTimeout(() => setMsg(null), 4000);
  };

  const enviar = async () => {
    if (!descricao.trim()) return showMsg("Escreva sua ideia com detalhes.", "err");
    if (descricao.trim().length < 15) return showMsg("Descreva um pouco mais (mínimo 15 caracteres).", "err");
    setEnviando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sugestoes").insert({
        user_id: user?.id || null,
        nome: profile?.nome || null,
        telefone: (profile as any)?.telefone || null,
        email: (profile as any)?.email || null,
        titulo: titulo.trim() || null,
        descricao: descricao.trim(),
        area,
        impacto,
        status: "recebida",
      });
      if (error) throw error;
      setTitulo(""); setDescricao(""); setArea(null); setImpacto(null);
      showMsg("Sugestão enviada! Obrigada pela ideia 💗", "ok");
      carregarHistorico();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      showMsg("Erro: " + err.message, "err");
    }
    setEnviando(false);
  };

  return (
    <>
      <AppPageHeader
        title="Solicitar Recurso"
        subtitle="Sua opinião molda o Doonly"
        infoIcon="💡"
        infoContent="Envie ideias, sugestões e pedidos de novas funcionalidades. Prometemos ler todas! As sugestões viram melhorias no app quando fazem sentido pra maioria."
      />

      <div className="sr-root">

        {msg && <div className={`sr-msg sr-msg--${msg.tipo}`}>{msg.txt}</div>}

        {/* Intro */}
        <div className="sr-intro">
          <div className="sr-intro-ic"><Lightbulb size={20} weight="fill" /></div>
          <div>
            <p className="sr-intro-t">Sua ideia importa!</p>
            <p className="sr-intro-d">Sugestões enviadas viram melhorias no app. Prometemos ler todas.</p>
          </div>
        </div>

        {/* Área */}
        <div className="sr-field">
          <label className="sr-lbl">Qual área?</label>
          <div className="sr-chips">
            {AREAS.map(a => (
              <button
                key={a.id}
                className={`sr-chip ${area === a.id ? "on" : ""}`}
                onClick={() => setArea(area === a.id ? null : a.id)}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Título */}
        <div className="sr-field">
          <label className="sr-lbl">Título <span className="sr-hint">até 60 caracteres</span></label>
          <input
            className="sr-input"
            maxLength={60}
            placeholder="Ex: Adicionar promoções nos produtos"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
          />
          <div className="sr-count">{titulo.length} / 60</div>
        </div>

        {/* Descrição */}
        <div className="sr-field">
          <label className="sr-lbl">Descreva sua ideia</label>
          <textarea
            className="sr-textarea"
            maxLength={500}
            placeholder="Explique com detalhes o que precisa e como isso te ajudaria no dia a dia..."
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />
          <div className="sr-count">{descricao.length} / 500</div>
        </div>

        {/* Impacto */}
        <div className="sr-field">
          <label className="sr-lbl">Qual o impacto? <span className="sr-hint">opcional</span></label>
          <div className="sr-impact">
            {IMPACTOS.map(imp => (
              <button
                key={imp.id}
                className={`sr-impact-opt ${impacto === imp.id ? "on" : ""}`}
                onClick={() => setImpacto(impacto === imp.id ? null : imp.id)}
              >
                {imp.icon}
                <span>{imp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Enviar */}
        <button className="sr-cta" onClick={enviar} disabled={enviando}>
          {enviando ? (
            <><span className="sr-spin" /> Enviando...</>
          ) : (
            <><PaperPlaneTilt size={16} weight="bold" /> Enviar sugestão</>
          )}
        </button>

        {/* Histórico */}
        <div className="sr-hist">
          <p className="sr-hist-title"><Clock size={14} weight="bold" /> Minhas sugestões</p>
          {loadingHist ? (
            <div className="sr-hist-loading"><span className="sr-spin sr-spin--dark" /></div>
          ) : historico.length === 0 ? (
            <p className="sr-hist-empty">Nenhuma sugestão enviada ainda. Seja a primeira!</p>
          ) : (
            historico.map(s => {
              const status = STATUS_LABELS[s.status || "recebida"] || STATUS_LABELS.recebida;
              return (
                <div key={s.id} className="sr-hist-card">
                  <div className="sr-hist-top">
                    <span className="sr-hist-t">{s.titulo || "Sugestão sem título"}</span>
                    <span className="sr-hist-date">{tempoRelativo(s.created_at)}</span>
                  </div>
                  <p className="sr-hist-d">{s.descricao}</p>
                  <span className={`sr-status ${status.cls}`}>{status.icon} {status.label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .sr-root { font-family: 'Geist', sans-serif; padding: 20px 16px 60px; max-width: 720px; margin: 0 auto; }

        .sr-msg { padding: 12px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
        .sr-msg--ok { background: #DCFCE7; color: #15803D; }
        .sr-msg--err { background: #FEE2E2; color: #B91C1C; }

        .sr-intro {
          padding: 16px;
          background: linear-gradient(135deg, #FFF5F9, #fff);
          border: 1px solid #FCE0E9;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex; align-items: flex-start; gap: 12px;
        }
        .sr-intro-ic {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: #E85A8C;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sr-intro-t { font-size: 13.5px; font-weight: 800; color: #2C1219; margin: 0 0 3px; }
        .sr-intro-d { font-size: 12px; color: #6B7280; margin: 0; line-height: 1.4; }

        .sr-field { margin-bottom: 18px; }
        .sr-lbl {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 800; color: #2C1219;
          margin-bottom: 8px;
        }
        .sr-hint { font-size: 11px; color: #9CA3AF; font-weight: 500; margin-left: auto; }

        .sr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .sr-chip {
          padding: 7px 12px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 6px;
          font-size: 11.5px; font-weight: 600;
          color: #4B5563;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .sr-chip:hover { border-color: #E85A8C; color: #C33A6E; }
        .sr-chip.on {
          background: #2C1219;
          border-color: #2C1219;
          color: #fff;
          font-weight: 700;
        }

        .sr-input, .sr-textarea {
          width: 100%;
          padding: 12px 14px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          font-size: 13px;
          font-family: inherit;
          color: #2C1219;
          outline: none;
          transition: border-color 0.15s;
        }
        .sr-input:focus, .sr-textarea:focus { border-color: #E85A8C; }
        .sr-input::placeholder, .sr-textarea::placeholder { color: #C0B3B8; }
        .sr-textarea { min-height: 110px; resize: vertical; }
        .sr-count { font-size: 10.5px; color: #9CA3AF; text-align: right; margin-top: 4px; }

        .sr-impact { display: flex; gap: 6px; }
        .sr-impact-opt {
          flex: 1;
          padding: 12px 8px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          text-align: center;
          font-size: 11.5px; font-weight: 700;
          color: #4B5563;
          cursor: pointer;
          font-family: inherit;
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          transition: all 0.15s;
        }
        .sr-impact-opt.on {
          background: #FFF5F9;
          border-color: #E85A8C;
          color: #C33A6E;
        }

        .sr-cta {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #E85A8C, #C33A6E);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 900;
          font-family: inherit;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          box-shadow: 0 4px 14px rgba(232,90,140,0.35);
          margin-top: 16px;
          cursor: pointer;
        }
        .sr-cta:disabled { opacity: 0.7; cursor: not-allowed; }

        .sr-spin {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: srSpin 0.7s linear infinite;
          display: inline-block;
        }
        .sr-spin--dark { border-color: #FCE0E9; border-top-color: #E85A8C; width: 20px; height: 20px; border-width: 3px; }
        @keyframes srSpin { to { transform: rotate(360deg); } }

        .sr-hist { margin-top: 32px; padding-top: 20px; border-top: 1px solid #F0EBED; }
        .sr-hist-title {
          font-size: 13px; font-weight: 800; color: #2C1219;
          margin: 0 0 12px;
          display: flex; align-items: center; gap: 6px;
        }
        .sr-hist-loading { display: flex; justify-content: center; padding: 24px; }
        .sr-hist-empty {
          font-size: 12.5px; color: #9CA3AF;
          text-align: center; padding: 20px 0;
          margin: 0;
        }
        .sr-hist-card {
          padding: 12px 14px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          margin-bottom: 8px;
        }
        .sr-hist-top {
          display: flex; justify-content: space-between; align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .sr-hist-t {
          font-size: 12.5px; font-weight: 700; color: #2C1219;
          flex: 1; min-width: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sr-hist-date { font-size: 10px; color: #9CA3AF; flex-shrink: 0; }
        .sr-hist-d {
          font-size: 11.5px; color: #6B7280;
          margin: 0 0 6px;
          line-height: 1.4;
          overflow: hidden; text-overflow: ellipsis;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .sr-status {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px; font-weight: 700;
        }
        .sr-status--recebida { background: #F3F4F6; color: #4B5563; }
        .sr-status--analise { background: #FEF3C7; color: #B45309; }
        .sr-status--implementada { background: #DCFCE7; color: #15803D; }
        .sr-status--recusada { background: #FEE2E2; color: #B91C1C; }
      `}</style>
    </>
  );
}
