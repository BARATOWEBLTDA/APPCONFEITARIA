import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { useProfile } from "@/hooks/useProfile";
import { PaperPlaneTilt, CheckCircle, Lightbulb, CaretRight } from "@phosphor-icons/react";
import { Botao, Campo, CampoArea, TelaVazia } from "@/components/base";
import "./clientes.css";
import "./ajuda.css";

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
  { id: "insumos", label: "Ingredientes" },
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
  recebida:     { label: "Recebida",       cls: "aj-st--rec" },
  em_analise:   { label: "Em análise",     cls: "aj-st--analise" },
  implementada: { label: "Implementada", cls: "aj-st--ok" },
  recusada:     { label: "Recusada",       cls: "aj-st--no" },
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
  const navigate = useNavigate();
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
        tipo: "sugestao",
        tela_origem: window.location.pathname,
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
      <AppPageHeader title="Sugerir uma melhoria" subtitle="Sua opinião molda o Doonly" onBack={() => navigate(-1)} />

      <div className="cl9 aj">
        <div className="aj-seg" role="tablist" aria-label="Ideias">
          <button role="tab" type="button" aria-selected={aba === "nova"} onClick={() => setAba("nova")}>Nova ideia</button>
          <button role="tab" type="button" aria-selected={aba === "minhas"} onClick={() => setAba("minhas")}>
            Minhas ideias{historico.length > 0 && <i>{historico.length}</i>}
          </button>
        </div>

        {aba === "nova" && (
          enviado ? (
            <section className="cl9-card aj-ok">
              <span className="aj-ok-ic" aria-hidden="true"><CheckCircle size={32} weight="fill" /></span>
              <h2>Ideia recebida!</h2>
              <p>Obrigada! Acompanhe o andamento em "Minhas ideias".</p>
              <Botao onClick={novaIdeia}>Enviar outra ideia</Botao>
              <Botao variante="link" onClick={() => setAba("minhas")}>Ver minhas ideias</Botao>
            </section>
          ) : (
            <section className="cl9-card">
              <div className="aj-intro">
                <span className="aj-intro-ic" aria-hidden="true"><Lightbulb size={24} weight="duotone" /></span>
                <div><b>Sua ideia pode virar recurso</b><p>Conte o que falta no seu dia a dia. A gente lê todas e conta o andamento em "Minhas ideias".</p></div>
              </div>
              <Campo rotulo="O que você gostaria?" obrigatorio maxLength={60} placeholder="Ex.: colocar promoção nos produtos"
                value={titulo} onChange={e => setTitulo(e.target.value)} />
              <CampoArea rotulo="Como isso te ajudaria?" opcional rows={4} maxLength={500}
                placeholder="Conte uma situação real: quando acontece e o que você faz hoje"
                value={descricao} onChange={e => setDescricao(e.target.value)} />
              <p className="aj-cont">{descricao.length} / 500</p>
              <div>
                <p className="aj-rot">Qual área?<small>opcional</small></p>
                <div className="cl9-f-chips">
                  {AREAS.map(a => (
                    <button key={a.id} type="button" aria-pressed={area === a.id} onClick={() => setArea(area === a.id ? null : a.id)}>{a.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="aj-rot">Quanto isso faz falta?<small>opcional</small></p>
                <div className="cl9-f-chips">
                  {IMPACTOS.map(i => (
                    <button key={i.id} type="button" aria-pressed={impacto === i.id} onClick={() => setImpacto(impacto === i.id ? null : i.id)}>{i.label}</button>
                  ))}
                </div>
              </div>
              {erro && <p className="aj-erro" role="alert">{erro}</p>}
              <Botao cheio carregando={enviando} disabled={!podeEnviar} icone={<PaperPlaneTilt size={20} weight="fill" />} onClick={enviar}>Enviar ideia</Botao>
              {titulo.trim().length < 3 && <p className="aj-dica">Escreva o que você gostaria pra poder enviar.</p>}
            </section>
          )
        )}

        {aba === "minhas" && (
          loadingHist ? (
            <div className="cl9-esq" aria-label="Carregando">{[0, 1, 2].map(k => <span key={k} />)}</div>
          ) : historico.length === 0 ? (
            <section className="cl9-card">
              <TelaVazia compacta icone={<Lightbulb size={28} />} titulo="Nenhuma ideia enviada ainda" texto="Quando você enviar uma ideia, o andamento dela aparece aqui."
                acao={<Botao tamanho="m" onClick={() => setAba("nova")}>Enviar minha primeira ideia</Botao>} />
            </section>
          ) : (
            <div className="aj-hist">
              <p className="aj-fluxo" style={{ marginTop: 12 }}>
                <span className="aj-st aj-st--rec">Recebida</span><CaretRight size={14} weight="bold" />
                <span className="aj-st aj-st--analise">Em análise</span><CaretRight size={14} weight="bold" />
                <span className="aj-st aj-st--ok"><CheckCircle size={14} weight="fill" />Implementada</span>
              </p>
              {historico.map(s => {
                const st = STATUS[s.status || "recebida"] || STATUS.recebida;
                const al = areaLabel(s.area);
                const mostrarDesc = s.titulo?.trim() && s.descricao.trim() !== s.titulo.trim();
                return (
                  <article key={s.id} className="aj-h">
                    <div className="aj-h-top"><span className={`aj-st ${st.cls}`}>{st.label}</span><small>{tempoRelativo(s.created_at)}</small></div>
                    <b>{tituloDe(s)}</b>
                    {mostrarDesc && <p>{s.descricao}</p>}
                    {al && <em>{al}</em>}
                  </article>
                );
              })}
            </div>
          )
        )}
      </div>
    </>
  );
}
