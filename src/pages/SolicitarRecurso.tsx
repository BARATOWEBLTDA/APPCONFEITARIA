import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { useProfile } from "@/hooks/useProfile";
import { PaperPlaneTilt, CheckCircle } from "@phosphor-icons/react";

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

// Rótulos em linguagem de confeiteira — no banco continua baixo/medio/alto
const IMPACTOS: { id: "baixo" | "medio" | "alto"; label: string }[] = [
  { id: "baixo", label: "Seria legal" },
  { id: "medio", label: "Faz falta" },
  { id: "alto", label: "Muita falta" },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  recebida:     { label: "Recebida",       cls: "sr-st--rec" },
  em_analise:   { label: "Em análise",     cls: "sr-st--analise" },
  implementada: { label: "✓ Implementada", cls: "sr-st--ok" },
  recusada:     { label: "Recusada",       cls: "sr-st--no" },
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

// Ideias antigas sem título mostram o começo da descrição
function tituloDe(s: Sugestao): string {
  if (s.titulo?.trim()) return s.titulo.trim();
  const d = s.descricao.trim();
  return d.length > 50 ? d.slice(0, 50).trimEnd() + "..." : d;
}

export default function SolicitarRecurso() {
  const { profile } = useProfile();
  // ?aba=minhas abre direto no histórico (usado pela notificação "Sua ideia virou realidade")
  const [searchParams] = useSearchParams();
  const [aba, setAba] = useState<"nova" | "minhas">(searchParams.get("aba") === "minhas" ? "minhas" : "nova");
  const [area, setArea] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [impacto, setImpacto] = useState<"baixo" | "medio" | "alto" | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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

  const podeEnviar = titulo.trim().length >= 3 && !enviando;

  const enviar = async () => {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const tit = titulo.trim();
      const { error } = await supabase.from("sugestoes").insert({
        user_id: user?.id || null,
        nome: profile?.nome || null,
        telefone: (profile as any)?.telefone || null,
        email: (profile as any)?.email || null,
        titulo: tit,
        descricao: descricao.trim() || tit, // descrição é opcional: repete o título
        area,
        impacto,
        status: "recebida",
      });
      if (error) throw error;
      setEnviado(true);
      carregarHistorico();
    } catch (err: any) {
      setErro("Não foi possível enviar: " + (err?.message || "tente de novo"));
    }
    setEnviando(false);
  };

  const novaIdeia = () => {
    setTitulo(""); setDescricao(""); setArea(null); setImpacto(null);
    setEnviado(false); setErro(null);
  };

  const areaLabel = (id: string | null) => AREAS.find(a => a.id === id)?.label || null;

  return (
    <>
      <AppPageHeader title="Solicitar recurso" subtitle="Sua opinião molda o Doonly" />

      <div className="sr-root">
        <div className="sr-tabs" role="tablist">
          <button role="tab" aria-selected={aba === "nova"} className={`sr-tab${aba === "nova" ? " on" : ""}`} onClick={() => setAba("nova")}>
            Nova ideia
          </button>
          <button role="tab" aria-selected={aba === "minhas"} className={`sr-tab${aba === "minhas" ? " on" : ""}`} onClick={() => setAba("minhas")}>
            Minhas ideias
            {historico.length > 0 && <span className="sr-cnt">{historico.length}</span>}
          </button>
        </div>

        {aba === "nova" && (
          enviado ? (
            <div className="sr-card sr-ok">
              <div className="sr-ok-ic"><CheckCircle size={30} weight="fill" /></div>
              <p className="sr-ok-t">Ideia recebida!</p>
              <p className="sr-ok-d">Obrigada! Acompanhe o andamento em "Minhas ideias".</p>
              <button className="sr-cta" onClick={novaIdeia}>Enviar outra ideia</button>
              <button className="sr-ghost" onClick={() => setAba("minhas")}>Ver minhas ideias</button>
            </div>
          ) : (
            <>
              <p className="sr-lead">Conte o que falta no seu dia a dia. A gente lê todas e responde pelo status.</p>
              <div className="sr-card">
                <div className="sr-f">
                  <label className="sr-lbl" htmlFor="sr-tit">O que você gostaria? <small>obrigatório</small></label>
                  <input id="sr-tit" className="sr-in" maxLength={60}
                    placeholder="Ex: Colocar promoção nos produtos"
                    value={titulo} onChange={e => setTitulo(e.target.value)} />
                </div>
                <div className="sr-f">
                  <label className="sr-lbl" htmlFor="sr-desc">Como isso te ajudaria? <small>opcional</small></label>
                  <textarea id="sr-desc" className="sr-ta" maxLength={500}
                    placeholder="Conte uma situação real: quando acontece, o que você faz hoje..."
                    value={descricao} onChange={e => setDescricao(e.target.value)} />
                  <div className="sr-count">{descricao.length} / 500</div>
                </div>
                <div className="sr-f">
                  <span className="sr-lbl">Qual área?</span>
                  <div className="sr-chips">
                    {AREAS.map(a => (
                      <button key={a.id} className={`sr-chip${area === a.id ? " on" : ""}`}
                        onClick={() => setArea(area === a.id ? null : a.id)}>{a.label}</button>
                    ))}
                  </div>
                </div>
                <div className="sr-f">
                  <span className="sr-lbl">Quanto isso faz falta? <small>opcional</small></span>
                  <div className="sr-seg">
                    {IMPACTOS.map(i => (
                      <button key={i.id} className={`sr-seg-opt${impacto === i.id ? " on" : ""}`}
                        onClick={() => setImpacto(impacto === i.id ? null : i.id)}>{i.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {erro && <p className="sr-err">{erro}</p>}
              <button className="sr-cta" onClick={enviar} disabled={!podeEnviar}>
                {enviando
                  ? <><span className="sr-spin" /> Enviando...</>
                  : <><PaperPlaneTilt size={17} weight="fill" /> Enviar ideia</>}
              </button>
              {titulo.trim().length < 3 && <p className="sr-req">Escreva o que você gostaria pra enviar</p>}
            </>
          )
        )}

        {aba === "minhas" && (
          loadingHist ? (
            <div className="sr-loading"><span className="sr-spin sr-spin--dark" /></div>
          ) : historico.length === 0 ? (
            <div className="sr-empty">
              <p className="sr-empty-t">Nenhuma ideia enviada ainda</p>
              <p className="sr-empty-d">Quando você enviar uma ideia, o andamento dela aparece aqui.</p>
              <button className="sr-ghost" onClick={() => setAba("nova")}>Enviar minha primeira ideia</button>
            </div>
          ) : (
            <>
              <div className="sr-flow">
                <span className="sr-st sr-st--rec">Recebida</span>→
                <span className="sr-st sr-st--analise">Em análise</span>→
                <span className="sr-st sr-st--ok">✓ Implementada</span>
              </div>
              {historico.map(s => {
                const st = STATUS[s.status || "recebida"] || STATUS.recebida;
                const al = areaLabel(s.area);
                const mostrarDesc = s.titulo?.trim() && s.descricao.trim() !== s.titulo.trim();
                return (
                  <article key={s.id} className="sr-h">
                    <div className="sr-h-top">
                      <span className={`sr-st ${st.cls}`}>{st.label}</span>
                      <span className="sr-h-date">{tempoRelativo(s.created_at)}</span>
                    </div>
                    <p className="sr-h-t">{tituloDe(s)}</p>
                    {mostrarDesc && <p className="sr-h-d">{s.descricao}</p>}
                    {al && <span className="sr-h-area">{al}</span>}
                  </article>
                );
              })}
            </>
          )
        )}
      </div>

      <style>{`
        .sr-root { font-family: var(--font-base); padding: 14px 4px 100px; max-width: 640px; margin: 0 auto; color: #2C1219; }

        .sr-tabs { display: flex; gap: 4px; padding: 4px; background: #F5F0F2; border-radius: 10px; }
        .sr-tab {
          flex: 1; padding: 9px 8px; border: none; border-radius: 7px; background: none; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 700; color: #7C7A8E;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .sr-tab.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(44,18,25,0.08); }
        .sr-cnt {
          min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px;
          background: #2C1219; color: #fff; font-size: 10.5px; font-weight: 800;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .sr-lead { font-size: 13px; color: #7C7A8E; line-height: 1.45; margin: 14px 4px; }
        .sr-card {
          background: #fff; border-radius: 14px; padding: 16px;
          box-shadow: 0 1px 2px rgba(60,20,35,0.04), 0 4px 14px rgba(60,20,35,0.05);
        }
        .sr-f + .sr-f { margin-top: 18px; }
        .sr-lbl {
          display: flex; justify-content: space-between; align-items: baseline;
          font-size: 12.5px; font-weight: 800; color: #2C1219; margin-bottom: 8px;
        }
        .sr-lbl small { font-size: 11px; font-weight: 500; color: #9CA3AF; }
        .sr-in, .sr-ta {
          width: 100%; box-sizing: border-box; border: none; background: #F5F0F2; border-radius: 10px;
          padding: 12px 13px; font-family: inherit; font-size: 14px; color: #2C1219;
        }
        .sr-in:focus, .sr-ta:focus { outline: 2px solid #E85A8C; outline-offset: 0; background: #fff; }
        .sr-in::placeholder, .sr-ta::placeholder { color: #A8A0A4; }
        .sr-ta { min-height: 110px; resize: vertical; line-height: 1.45; }
        .sr-count { text-align: right; font-size: 11px; color: #9CA3AF; margin-top: 5px; }

        .sr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .sr-chip {
          padding: 7px 12px; border: none; border-radius: 6px; background: #F5F0F2; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 600; color: #4B3A42;
        }
        .sr-chip.on { background: #2C1219; color: #fff; }
        .sr-seg { display: flex; gap: 4px; padding: 4px; background: #F5F0F2; border-radius: 10px; }
        .sr-seg-opt {
          flex: 1; padding: 8px 6px; border: none; border-radius: 7px; background: none; cursor: pointer;
          font-family: inherit; font-size: 12.5px; font-weight: 600; color: #4B3A42;
        }
        .sr-seg-opt.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(44,18,25,0.1); }

        .sr-cta {
          width: 100%; height: 50px; margin-top: 14px; border: none; border-radius: 12px; cursor: pointer;
          background: #E85A8C; color: #fff; font-family: inherit; font-size: 15px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .sr-cta:disabled { opacity: 0.45; cursor: not-allowed; }
        .sr-cta:not(:disabled):active { transform: scale(0.99); }
        .sr-req { font-size: 11.5px; color: #9CA3AF; text-align: center; margin: 8px 0 0; }
        .sr-err { font-size: 12.5px; font-weight: 600; color: #B91C1C; background: #FEE2E2; border-radius: 8px; padding: 10px 12px; margin: 12px 0 0; }
        .sr-ghost {
          width: 100%; height: 44px; margin-top: 8px; border: none; background: none; cursor: pointer;
          font-family: inherit; font-size: 13.5px; font-weight: 700; color: #C33A6E; border-radius: 12px;
        }

        .sr-ok { text-align: center; padding: 28px 18px 18px; margin-top: 14px; }
        .sr-ok-ic { width: 56px; height: 56px; border-radius: 50%; background: #DCFCE7; color: #16a34a; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
        .sr-ok-t { font-size: 17px; font-weight: 800; margin: 0; }
        .sr-ok-d { font-size: 13px; color: #7C7A8E; margin: 6px auto 18px; max-width: 270px; line-height: 1.45; }
        .sr-ok .sr-cta { margin-top: 0; }

        .sr-flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: #7C7A8E; margin: 14px 4px 12px; }
        .sr-st { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 5px; font-size: 11px; font-weight: 800; }
        .sr-flow .sr-st { font-size: 10.5px; }
        .sr-st--rec { background: #F3F4F6; color: #4B5563; }
        .sr-st--analise { background: #FEF3C7; color: #B45309; }
        .sr-st--ok { background: #DCFCE7; color: #15803D; }
        .sr-st--no { background: #F3F4F6; color: #6B7280; }

        .sr-h {
          background: #fff; border-radius: 14px; padding: 14px 16px;
          box-shadow: 0 1px 2px rgba(60,20,35,0.04), 0 4px 14px rgba(60,20,35,0.05);
        }
        .sr-h + .sr-h { margin-top: 8px; }
        .sr-h-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .sr-h-date { font-size: 11px; color: #9CA3AF; }
        .sr-h-t { font-size: 14px; font-weight: 800; line-height: 1.3; margin: 0; }
        .sr-h-d {
          font-size: 12.5px; color: #7C7A8E; line-height: 1.45; margin: 4px 0 0;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .sr-h-area { display: inline-block; margin-top: 10px; font-size: 11px; font-weight: 600; color: #6E5A66; background: #F5F0F2; padding: 3px 8px; border-radius: 5px; }

        .sr-empty { text-align: center; padding: 40px 20px; }
        .sr-empty-t { font-size: 14px; font-weight: 800; margin: 0 0 4px; }
        .sr-empty-d { font-size: 12.5px; color: #7C7A8E; margin: 0 0 10px; line-height: 1.45; }
        .sr-loading { display: flex; justify-content: center; padding: 40px; }

        .sr-spin {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
          animation: srSpin 0.7s linear infinite; display: inline-block;
        }
        .sr-spin--dark { border-color: #FCE0E9; border-top-color: #E85A8C; width: 20px; height: 20px; border-width: 3px; }
        @keyframes srSpin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
