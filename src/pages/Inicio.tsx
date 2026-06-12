import { useState, useEffect } from "react";
import { Users, Package, ClipboardList, DollarSign, UtensilsCrossed, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";
import { QuickSetupModal } from "@/components/QuickSetupModal";
import { MetricCard } from "@/components/MetricCard";

export default function Inicio() {
  const navigate = useNavigate();
  const { isPro, proExpiraEm } = usePlano();

  const diasProRestantes = proExpiraEm
    ? Math.max(0, Math.ceil((proExpiraEm.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const isTeste = isPro && !!proExpiraEm; // PRO via resgate (tem data de expiração)
  const diasProTotal = 3;
  const [profile, setProfile] = useState<any>(null);
  const [produtos, setProdutos] = useState(0);
  const [clientes, setClientes] = useState(0);
  const [insumos, setInsumos] = useState(0);
  const [receitas, setReceitas] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidos, setPedidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [quickStep, setQuickStep] = useState<{label: string; path: string} | null>(null);
  const [profileUserId, setProfileUserId] = useState<string>("");
  const [diasTrial] = useState(14);
  const [proResgatado, setProResgatado] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const [ultimosClientes, setUltimosClientes] = useState<any[]>([]);
  const [calMes, setCalMes] = useState(new Date());
  const [calDiaSelecionado, setCalDiaSelecionado] = useState<string | null>(null);
  const [pedidosDia, setPedidosDia] = useState<any[]>([]);
  const [pedidosFiltro, setPedidosFiltro] = useState<string>("todos");
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidosMes, setPedidosMes] = useState<Record<string,number>>({});

  const calCells = () => {
    const ano = calMes.getFullYear();
    const mes = calMes.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes+1, 0).getDate();
    const hoje = new Date().toISOString().split("T")[0];
    const cells = [];
    for (let i = 0; i < primeiroDia; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= totalDias; d++) {
      const iso = `${ano}-${String(mes+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const temPedido = pedidosMes[iso] || 0;
      const isHoje = iso === hoje;
      const isSelecionado = iso === calDiaSelecionado;
      cells.push(
        <button key={d} onClick={() => handleDiaClick(iso)}
          className={"cal-day" + (isHoje ? " hoje" : "") + (isSelecionado ? " selecionado" : "") + (temPedido ? " tem-pedido" : "")}>
          {d}
          {temPedido > 0 && <span className="cal-dot">{temPedido}</span>}
        </button>
      );
    }
    return cells;
  };

  const buscarPedidosDia = async (dia: string) => {
    if (!profileUserId) return;
    setLoadingPedidos(true);
    const { data } = await supabase.from("pedidos").select("*").eq("user_id", profileUserId).eq("data_entrega", dia).order("created_at", { ascending: false });
    setPedidosDia(data || []);
    setLoadingPedidos(false);
  };

  const handleDiaClick = (dia: string) => {
    setCalDiaSelecionado(dia);
    setPedidosFiltro("todos");
    buscarPedidosDia(dia);
  };

  const handleResgatarPro = async () => {
    const expira = new Date();
    expira.setDate(expira.getDate() + 3);
    const { error } = await supabase
      .from("profiles")
      .update({ pro_expira_em: expira.toISOString(), plano: "pro" })
      .eq("id", profileUserId);
    if (!error) {
      setProResgatado(true);
      setProfile((p: any) => ({ ...p, pro_expira_em: expira.toISOString() }));
    }
    setResgatando(false);
  };

  useEffect(() => {
const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileUserId(user.id);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      if (prof?.pro_expira_em) setProResgatado(true);
      const { count: pc } = await supabase.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: cc } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: ic } = await supabase.from("insumos").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: rc } = await supabase.from("receitas_minhas").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: catc } = await supabase.from("categorias").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setProdutos(pc || 0);
      setClientes(cc || 0);
      setInsumos(ic || 0);
      setReceitas(rc || 0);
      setCategorias(catc || 0);
      const { data: uc } = await supabase.from("clientes").select("id,nome,foto_url,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5);
      if (uc) setUltimosClientes(uc);

      // Pedidos do mês atual para o calendário
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
      const { data: pedMes } = await supabase.from("pedidos").select("data_entrega,status").eq("user_id", user.id).gte("data_entrega", inicioMes).lte("data_entrega", fimMes);
      if (pedMes) {
        const map: Record<string,number> = {};
        pedMes.forEach((p: any) => { if (p.data_entrega) map[p.data_entrega] = (map[p.data_entrega] || 0) + 1; });
        setPedidosMes(map);
      }

      setLoading(false);
    };
    load();
  }, []);

  const steps = [
    {
      title: "Configure sua loja", emoji: "🏪",
      items: [
        { label: "Qual é o seu nome?", path: "/configuracoes", done: !!profile?.nome },
        { label: "Você já trabalha com confeitaria?", path: "/configuracoes", done: !!profile?.onboarding_trabalha_confeitaria },
        { label: "Qual é o WhatsApp da sua loja?", path: "/configuracoes", done: !!profile?.telefone },
        { label: "Cadastre 1 ingrediente", path: "/insumos", done: insumos > 0 },
        { label: "Cadastre 1 cliente", path: "/clientes", done: clientes > 0 },
        { label: "Cadastre 1 receita", path: "/receitas", done: receitas > 0 },
      ],
    },
  ];

  const allItems = steps.flatMap(s => s.items);
  const doneCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const progress = Math.round((doneCount / totalCount) * 100);
  const remaining = totalCount - doneCount;
  const nextStep = allItems.find(i => !i.done);
  const nome = profile?.nome?.split(" ")[0] || "";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Bom dia";
    if (h >= 12 && h < 18) return "Boa tarde";
    return "Boa noite";
  };

  const atalhos = [
    { label: "Clientes", icon: <Users size={28} color="var(--primary, #FF6FA9)" />, path: "/clientes" },
    { label: "Produtos", icon: <Package size={28} color="var(--primary, #FF6FA9)" />, path: "/produtos" },
    { label: "Pedidos", icon: <ClipboardList size={28} color="var(--primary, #FF6FA9)" />, path: "/pedidos" },
    { label: "Financeiro", icon: <DollarSign size={28} color="var(--primary, #FF6FA9)" />, path: "/financeiro" },
    { label: "Cardápio", icon: <UtensilsCrossed size={28} color="var(--primary, #FF6FA9)" />, path: "/cardapio-config" },
    { label: "Receitas", icon: <BookOpen size={28} color="var(--primary, #FF6FA9)" />, path: "/receitas" },
  ];

  if (loading) return <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", color: "var(--text-muted, #9CA3AF)" }}>Carregando...</div>;

  return (
    <div className="ini-root">

      {/* ===== MOBILE ===== */}
      <div className="ini-mobile">



        {/* 1. Configure seu Doonly - destaque escuro */}
        {!loading && (progress < 100 ? (
        <div className="mob-config-card">
          <div className="mob-config-header">
            <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flex:1}}>
              <img src="/configureapp.png" alt="" style={{width:"46px",height:"46px",objectFit:"contain",flexShrink:0}} />
              <div>
                <p className="mob-config-title">Configure seu Doonly</p>
                <p className="mob-config-sub">{progress === 100 ? "🎉 Tudo pronto!" : `${remaining === 1 ? "Resta apenas" : "Faltam apenas"} ${remaining} etapa${remaining !== 1 ? "s" : ""} para sua confeitaria decolar!`}</p>
              </div>
            </div>
            <div className="mob-config-circle">{progress}%</div>
          </div>
          <div className="mob-config-bar-bg">
            <div className="mob-config-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          {nextStep && (
            <div className="mob-config-next">
              <div>
                <p className="mob-config-next-label">Próximo passo</p>
                <p className="mob-config-next-text">{nextStep.label}</p>
              </div>
              <button className="mob-config-next-btn" onClick={() => setQuickStep(nextStep)}>Configurar →</button>
            </div>
          )}
        </div>
        ) : !proResgatado ? (
          <div className="mob-config-card mob-config-card--done">
            <div className="mob-config-header">
              <div style={{display:"flex",alignItems:"center",gap:"0.6rem",flex:1}}>
                <span style={{fontSize:"2rem"}}>🎉</span>
                <div>
                  <p className="mob-config-title">Configuração completa!</p>
                  <p className="mob-config-sub">Resgate agora mesmo 3 dias de acesso completo sem limitações em nosso App como recompensa.</p>
                </div>
              </div>
            </div>
            <button className="mob-resgatar-btn" onClick={handleResgatarPro} disabled={resgatando}>
              {resgatando ? "Ativando..." : "✨ Ativar PRO por 3 dias"}
            </button>
          </div>
        ) : null)}

        {/* Card PRO teste — dias restantes */}
        {!loading && isTeste && (
          <div className="mob-pro-mini-card">
            <div style={{display:"flex",alignItems:"center",gap:"0.65rem",width:"100%"}}>
              <img src="/assine.png" alt="" style={{width:"38px",height:"38px",objectFit:"contain",flexShrink:0,borderRadius:"10px"}} />
              <div style={{flex:1,minWidth:0}}>
                <p className="mob-pro-mini-title">Seu acesso PRO expira em {diasProRestantes} dia{diasProRestantes !== 1 ? "s" : ""}.</p>
                <p className="mob-pro-mini-sub">Continue com todas as funcionalidades sem interrupção por apenas <strong style={{color:"white"}}>R$ 19,90/mês</strong>.</p>
              </div>
            </div>
            <button className="mob-assinar-btn-sm" style={{marginTop:"0.65rem",width:"100%"}} onClick={() => navigate("/assinar")}>
              Assinar agora →
            </button>
          </div>
        )}

        {/* 2. Acesso rápido */}
        <div className="mob-section-title">Acesso rápido</div>
        <div className="mob-atalhos">
          {atalhos.map(a => (
            <button key={a.path} className="mob-atalho" onClick={() => navigate(a.path)}>
              <div className="mob-atalho-icon">{a.icon}</div>
              <span className="mob-atalho-label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* 3. Métricas - 3 lado a lado */}
        <div className="mob-summary">
          <div className="mob-sum-card" onClick={() => navigate("/pedidos")}>
            <span className="mob-sum-icon">📦</span>
            <p className="mob-sum-num">{pedidos}</p>
            <p className="mob-sum-label">Pedidos</p>
          </div>
          <div className="mob-sum-card" onClick={() => navigate("/clientes")}>
            <span className="mob-sum-icon">👥</span>
            <p className="mob-sum-num">{clientes}</p>
            <p className="mob-sum-label">Clientes</p>
          </div>
          <div className="mob-sum-card" onClick={() => navigate("/produtos")}>
            <span className="mob-sum-icon">🎂</span>
            <p className="mob-sum-num">{produtos}</p>
            <p className="mob-sum-label">Produtos</p>
          </div>
        </div>

        {/* 4. Banner premium por último */}
        {!isPro && (
        <div className="mob-trial" onClick={() => navigate("/assinar")}>
          <div className="mob-trial-left">
            <div className="mob-trial-icon">
              <img src="/assine.png" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <p className="mob-trial-title">ASSINE O DOONLY PREMIUM</p>
              <p className="mob-trial-sub">Apenas R$ 19,90/mês após o teste</p>
            </div>
          </div>
          <div className="mob-trial-badge">Recomendado</div>
        </div>
        )}
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="ini-desktop">

        {/* 3 Cards métricas */}
        <div className="dash-metrics">
          <MetricCard
            variant="orders"
            label="Pedidos do mês"
            value={pedidos !== 0 ? pedidos : undefined}
            emptyText="Sem pedidos ainda"
            onClick={() => navigate("/pedidos")}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          />
          <MetricCard
            variant="revenue"
            label="Faturamento do mês"
            value="R$ 0,00"
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          />
          <MetricCard
            variant="customers"
            label="Clientes"
            value={clientes !== 0 ? clientes : undefined}
            emptyText="Nenhum cliente ainda"
            onClick={() => navigate("/clientes")}
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
          />
        </div>

        {/* Seções abaixo dos cards — 3 colunas */}
        <div className="dash-sections">

          {/* Últimos pedidos */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Últimos pedidos</h3>
              <button className="dash-ver-todos" onClick={() => navigate("/pedidos")}>Ver todos →</button>
            </div>
            <div style={{marginTop:"0.75rem"}}>
              {pedidos === 0 ? (
                <div style={{textAlign:"center",padding:"1.5rem 0",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.5rem"}}>
                  <div style={{width:"44px",height:"44px",background:"var(--primary-light, #FFF1F7)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #FF6FA9)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text-primary, #374151)",margin:0}}>Nenhum pedido ainda</p>
                  <p style={{fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)",margin:0}}>Registre sua primeira venda</p>
                  <button onClick={() => navigate("/pedidos")} style={{marginTop:"0.25rem",background:"linear-gradient(135deg,var(--primary, #FF6FA9), #F85A9A)",color:"white",border:"none",borderRadius:"8px",padding:"0.45rem 1rem",fontFamily:"Inter,sans-serif",fontSize:"0.8rem",fontWeight:600,cursor:"pointer"}}>
                    Novo pedido
                  </button>
                </div>
              ) : (
                <p style={{fontSize:"0.82rem",color:"var(--text-muted, #9CA3AF)",textAlign:"center",padding:"1rem 0"}}>Em breve seus pedidos aparecerão aqui</p>
              )}
            </div>
          </div>

          {/* Entradas vs Saídas */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Entradas vs Saídas</h3>
            </div>
            <div style={{marginTop:"0.75rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#10b981",flexShrink:0}} />
                  <span style={{fontSize:"0.85rem",color:"var(--text-primary, #374151)",fontWeight:500}}>Entradas</span>
                </div>
                <span style={{fontSize:"0.88rem",fontWeight:700,color:"#10b981"}}>R$ 0,00</span>
              </div>
              <div style={{height:"6px",background:"var(--bg-body, #F7F7F8)",borderRadius:"99px",overflow:"hidden"}}>
                <div style={{height:"100%",width:"0%",background:"#10b981",borderRadius:"99px"}} />
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"var(--error, #EF4444)",flexShrink:0}} />
                  <span style={{fontSize:"0.85rem",color:"var(--text-primary, #374151)",fontWeight:500}}>Saídas</span>
                </div>
                <span style={{fontSize:"0.88rem",fontWeight:700,color:"var(--error, #EF4444)"}}>R$ 0,00</span>
              </div>
              <div style={{height:"6px",background:"var(--bg-body, #F7F7F8)",borderRadius:"99px",overflow:"hidden"}}>
                <div style={{height:"100%",width:"0%",background:"var(--error, #EF4444)",borderRadius:"99px"}} />
              </div>
              <p style={{fontSize:"0.72rem",color:"var(--text-muted, #9CA3AF)",margin:0,textAlign:"center"}}>Os dados aparecerão conforme você registrar movimentações</p>
            </div>
          </div>

          {/* Últimos clientes */}
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Últimos clientes</h3>
              <button className="dash-ver-todos" onClick={() => navigate("/clientes")}>Ver todos →</button>
            </div>
            <div style={{marginTop:"0.75rem"}}>
              {ultimosClientes.length === 0 ? (
                <div style={{textAlign:"center",padding:"1.5rem 0",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.5rem"}}>
                  <div style={{width:"44px",height:"44px",background:"#f5f3ff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                  </div>
                  <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text-primary, #374151)",margin:0}}>Nenhum cliente ainda</p>
                  <p style={{fontSize:"0.75rem",color:"var(--text-muted, #9CA3AF)",margin:0}}>Cadastre seu primeiro cliente</p>
                  <button onClick={() => navigate("/clientes")} style={{marginTop:"0.25rem",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"white",border:"none",borderRadius:"8px",padding:"0.45rem 1rem",fontFamily:"Inter,sans-serif",fontSize:"0.8rem",fontWeight:600,cursor:"pointer"}}>
                    Cadastrar cliente
                  </button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:"0.25rem"}}>
                  {ultimosClientes.map(c => (
                    <div key={c.id} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.5rem 0",borderBottom:"1px solid var(--border, #E9E9EE)"}}>
                      <div style={{width:"34px",height:"34px",borderRadius:"50%",background:"#f5f3ff",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {c.foto_url ? <img src={c.foto_url} alt={c.nome} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                      </div>
                      <span style={{fontSize:"0.85rem",fontWeight:500,color:"var(--text-primary, #374151)",flex:1}}>{c.nome}</span>
                      <span style={{fontSize:"0.72rem",color:"var(--text-muted, #9CA3AF)"}}>{new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Checklist — abaixo das sections, largura completa */}
        {!loading && (progress < 100 ? (
          <div className="dash-card" style={{marginBottom:"1rem", maxWidth:"760px"}}>
            <div className="dash-card-header">
              <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
                <img src="/configureapp.png" alt="" style={{width:"34px",height:"34px",objectFit:"contain"}} />
                <div>
                  <h3 className="dash-card-title">Configure seu Doonly</h3>
                  <p className="dash-card-sub">{`${remaining} etapa${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""}`}</p>
                </div>
              </div>
              <span className="dash-progress-pct">{progress}%</span>
            </div>
            <div className="dash-progress-bar">
              <div className="dash-progress-fill" style={{width:`${progress}%`}} />
            </div>
            {nextStep && (
              <div className="dash-next-step">
                <div>
                  <p style={{fontSize:"0.7rem",color:"var(--text-muted, #9CA3AF)",margin:0}}>Próximo passo</p>
                  <p style={{fontSize:"0.85rem",fontWeight:600,color:"var(--text-title, #1F2937)",margin:0}}>{nextStep.label}</p>
                </div>
                <button className="dash-btn-config" onClick={() => setQuickStep(nextStep)}>Configurar →</button>
              </div>
            )}
            <div className="dash-steps">
              {steps.map((group, gi) => {
                const groupDone = group.items.filter(i => i.done).length;
                const isOpen = openGroup === gi;
                const allDone = groupDone === group.items.length;
                return (
                  <div key={gi} className="step-group">
                    <button className="step-group-header" onClick={() => setOpenGroup(isOpen ? null : gi)}>
                      <div className="step-group-left"><span>{group.emoji}</span><span className="step-group-title">{group.title}</span></div>
                      <div className="step-group-right">
                        <span className={"step-badge" + (allDone ? " done" : "")}>{allDone ? "✓ Completo" : `${groupDone}/${group.items.length}`}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{transform:isOpen?"rotate(180deg)":"none",transition:"0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="step-items">
                        {group.items.map((item, ii) => (
                          <button key={ii} className="step-item" onClick={() => !item.done && setQuickStep(item)}>
                            <div className={"step-check" + (item.done ? " checked" : "")}>
                              {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="step-item-label">{item.label}</span>
                            <span className={"step-status" + (item.done ? " done" : " pending")}>{item.done ? "Concluído" : "Fazer agora"}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="complete-banner" style={{marginTop:"0.75rem"}}>🎁 Complete 100% e ganhe 3 dias de PRO grátis!</div>
          </div>
        ) : !proResgatado ? (
          <div className="dash-card" style={{background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:"1px solid #bbf7d0",marginBottom:"1rem"}}>
            <div style={{textAlign:"center",padding:"0.5rem 0"}}>
              <img src="/assine.png" alt="" style={{width:"64px",height:"64px",objectFit:"contain",marginBottom:"0.5rem"}} />
              <h3 style={{fontWeight:800,color:"#15803d",margin:"0 0 0.25rem"}}>Configuração completa!</h3>
              <p style={{fontSize:"0.85rem",color:"var(--success, #22C55E)",margin:"0 0 1rem"}}>Resgate agora 3 dias de acesso PRO como recompensa.</p>
              <button className="mob-resgatar-btn" style={{width:"100%"}} onClick={handleResgatarPro} disabled={resgatando}>
                {resgatando ? "Ativando..." : "✨ Ativar PRO por 3 dias"}
              </button>
            </div>
          </div>
        ) : null)}

      </div>

      <QuickSetupModal
        step={quickStep}
        userId={profileUserId}
        onClose={() => setQuickStep(null)}
        onSaved={async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
          setProfile(prof);
          const { count: catc } = await supabase.from("categorias").select("*", { count: "exact", head: true }).eq("user_id", user.id);
          setCategorias(catc || 0);
        }}
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .ini-root { font-family: 'Geist', sans-serif; }

        /* Switch */
        .ini-mobile { display: flex; flex-direction: column; gap: 0.85rem; }
        .ini-desktop { display: none; }
        @media (min-width: 768px) {
          .ini-mobile { display: none; }
          .ini-desktop { display: block; }
        }

        /* ===== MOBILE ===== */

        .mob-greeting { display: none; }



        /* Cards 3 lado a lado */
        .mob-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .mob-sum-card { background: var(--bg-card, #FFFFFF); border-radius: 12px; padding: 0.75rem 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.15s; }
        .mob-sum-card:hover { transform: translateY(-1px); }
        .mob-sum-icon { font-size: 1.3rem; }
        .mob-sum-num { font-size: 1.2rem; font-weight: 800; color: var(--text-title, #1F2937); margin: 0; }
        .mob-sum-label { font-size: 0.68rem; color: var(--text-muted, #9CA3AF); margin: 0; font-weight: 500; }

        /* Trial mobile */
        .mob-trial { background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 14px; padding: 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; position: relative; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .mob-trial-left { display: flex; align-items: center; gap: 0.75rem; }
        .mob-trial-icon { width: 44px; height: 44px; background: var(--bg-card, #FFFFFF); border-radius: 10px; padding: 4px; flex-shrink: 0; overflow: hidden; }
        .mob-trial-title { font-size: 0.78rem; font-weight: 800; color: white; margin: 0 0 0.15rem; }
        .mob-trial-sub { font-size: 0.7rem; color: rgba(255,255,255,0.65); margin: 0; }
        .mob-trial-badge { position: absolute; top: 0; right: 0; background: var(--primary, #FF6FA9); color: white; font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 0 14px 0 8px; }

        /* Atalhos mobile */
        .mob-section-title { font-size: 0.88rem; font-weight: 700; color: var(--text-title, #1F2937); }
        .mob-atalhos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .mob-atalho { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; background: var(--bg-card, #FFFFFF); border: 1.5px solid var(--border, #E9E9EE); border-radius: 12px; padding: 0.7rem 0.4rem; cursor: pointer; font-family: 'Geist', sans-serif; transition: border-color 0.15s; }
        .mob-atalho:hover { border-color: var(--primary, #FF6FA9); }
        .mob-atalho-icon { display: flex; align-items: center; justify-content: center; }
        .mob-atalho-label { font-size: 0.68rem; font-weight: 500; color: var(--text-primary, #374151); }

        /* Progresso mobile */
        .mob-progress-card { background: var(--bg-card, #FFFFFF); border-radius: 14px; padding: 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .mob-progress-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .mob-progress-title { font-size: 0.9rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0 0 0.2rem; }
        .mob-progress-sub { font-size: 0.78rem; color: var(--text-secondary, #6B7280); margin: 0; }
        .mob-progress-circle { width: 46px; height: 46px; border-radius: 50%; background: var(--primary, #FF6FA9); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 800; flex-shrink: 0; }
        .mob-progress-bar-bg { height: 8px; background: var(--bg-body, #F7F7F8); border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; }
        .mob-progress-bar-fill { height: 100%; background: var(--primary, #FF6FA9); border-radius: 999px; transition: width 0.5s; }
        .mob-next-step { background: var(--primary-light, #FFF1F7); border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .mob-next-label { font-size: 0.7rem; color: var(--text-muted, #9CA3AF); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
        .mob-next-text { font-size: 0.85rem; font-weight: 600; color: var(--text-title, #1F2937); margin: 0; }
        .mob-next-btn { align-self: flex-start; background: var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color: white; border: none; border-radius: 8px; padding: 0.45rem 0.9rem; font-family: 'Geist', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer; }

        /* Config card dark */
        .mob-config-card {
          background: linear-gradient(135deg, #1a1a2e, #16213e);
          border-radius: 16px; padding: 1.1rem 1.2rem;
          box-shadow: 0 6px 24px rgba(0,0,0,0.2);
          position: relative; overflow: hidden;
        }
        .mob-config-card::before {
          content: ''; position: absolute; top: -40px; right: -40px;
          width: 140px; height: 140px; border-radius: 50%;
          background: rgba(249,0,122,0.1);
        }
        .mob-config-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .mob-config-title { font-size: 1rem; font-weight: 800; color: white; margin: 0 0 0.2rem; }
        .mob-config-sub { font-size: 0.78rem; color: rgba(255,255,255,0.65); margin: 0; line-height: 1.4; }
        .mob-config-circle { width: 50px; height: 50px; border-radius: 50%; background: var(--primary, #FF6FA9); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 12px rgba(249,0,122,0.4); }
        .mob-config-card--done { background: linear-gradient(135deg, #1a0a12, #2d0f1e); }
        .mob-resgatar-btn {
          width: 100%; padding: 0.85rem;
          background: linear-gradient(135deg, var(--primary, #FF6FA9), #c94d91, var(--primary, #FF6FA9));
          background-size: 200% 200%;
          animation: gradientShift 3s ease infinite;
          border: none; border-radius: 50px; color: white;
          font-family: inherit; font-size: 0.95rem; font-weight: 700;
          cursor: pointer; margin-top: 0.25rem;
          transition: opacity 0.2s, transform 0.1s;
          letter-spacing: 0.3px;
        }
        .mob-resgatar-btn:hover { opacity: 0.9; }
        .mob-resgatar-btn:active { transform: scale(0.98); }
        .mob-resgatar-btn:disabled { opacity: 0.6; cursor: not-allowed; animation: none; }
        .mob-assinar-btn-sm {
          padding: 0.55rem 1.75rem;
          background: linear-gradient(135deg, var(--primary, #FF6FA9), #e060a8);
          border: none; border-radius: 50px; color: white;
          font-family: inherit; font-size: 0.85rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.2s, transform 0.1s;
          white-space: nowrap;
        }
        .mob-assinar-btn-sm:hover { opacity: 0.9; }
        .mob-assinar-btn-sm:active { transform: scale(0.97); }
        .mob-pro-mini-card {
          background: linear-gradient(135deg, #1a0a12, #2d0f1e);
          border-radius: 16px;
          padding: 0.85rem 1rem;
          display: flex;
          flex-direction: column;
        }
        .mob-pro-mini-title { font-size: 0.82rem; font-weight: 700; color: white; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mob-pro-mini-sub { font-size: 0.72rem; color: rgba(255,255,255,0.65); margin: 0.2rem 0 0; line-height: 1.4; }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .mob-config-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary, #FF6FA9), #f9007a); border-radius: 999px; transition: width 1s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 0 10px rgba(245,131,191,0.6); position: relative; overflow: hidden; }
        .mob-config-bar-fill::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { left: -60%; } 100% { left: 120%; } }
        .mob-config-next { background: rgba(255,255,255,0.08); border-radius: 10px; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
        .mob-config-next-label { font-size: 0.68rem; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.2rem; }
        .mob-config-next-text { font-size: 0.82rem; font-weight: 600; color: white; margin: 0; }
        .mob-config-next-btn { background: var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color: white; border: none; border-radius: 8px; padding: 0.5rem 0.9rem; font-family: 'Geist', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; box-shadow: 0 2px 8px rgba(249,0,122,0.4); }

        /* ===== DESKTOP ===== */
        .ini-header { background: var(--bg-card, #FFFFFF); padding: 1rem 1.75rem; margin: -2rem -2rem 1.25rem -2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border, #E9E9EE); }
        .ini-greeting { font-size: 1rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

        .ini-trial-badge { background: var(--primary-light, #FFF1F7); color: var(--primary, #FF6FA9); font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.7rem; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid var(--primary-light, #FFF1F7); }

        .ini-summary { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.25rem; max-width: 70%; }
        .ini-sum-card { background: var(--bg-card, #FFFFFF); border-radius: 14px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-width: 130px; }
        .ini-sum-icon { font-size: 1.4rem; }
        .ini-sum-num { font-size: 1.4rem; font-weight: 800; color: var(--text-title, #1F2937); margin: 0; }
        .ini-sum-label { font-size: 0.75rem; color: var(--text-muted, #9CA3AF); margin: 0; font-weight: 500; }

        /* ── DASHBOARD ── */
        .dash-greeting { margin-bottom: 1.5rem; }
        .dash-title { font-size: 1.5rem; font-weight: 800; color: var(--text-title, #1F2937); margin: 0 0 0.25rem; }
        .dash-subtitle { font-size: 0.85rem; color: var(--text-muted, #9CA3AF); margin: 0; }
        .dash-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
        .dash-sections { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .dash-metric-empty { font-size: 0.82rem; font-weight: 600; margin: 0; line-height: 1.3; }
        .dash-metric-card { background: var(--bg-card, #FFFFFF); border-radius: 16px; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 16px rgba(0,0,0,0.1); cursor: pointer; transition: box-shadow 0.2s, transform 0.2s; }
        .dash-metric-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.15); transform: translateY(-3px); }
        .dash-metric-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dash-metric-num { font-size: 1.8rem; font-weight: 800; color: var(--text-title, #1F2937); margin: 0; line-height: 1; }
        .dash-metric-label { font-size: 0.75rem; color: var(--text-muted, #9CA3AF); margin: 0.25rem 0 0; font-weight: 500; }
        .dash-grid { display: grid; grid-template-columns: 1fr 380px; gap: 1.25rem; align-items: start; }
        .dash-col-left, .dash-col-right { display: flex; flex-direction: column; gap: 1rem; }
        .dash-card { background: var(--bg-card, #FFFFFF); border-radius: 16px; padding: 1.25rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
        .dash-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0; }
        .dash-card-title { font-size: 0.95rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0; }
        .dash-card-sub { font-size: 0.78rem; color: var(--text-muted, #9CA3AF); margin: 0.15rem 0 0; }
        .dash-ver-todos { background: none; border: none; color: var(--primary, #FF6FA9); font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: 'Geist', sans-serif; }
        .dash-progress-pct { font-size: 1rem; font-weight: 800; color: var(--primary, #FF6FA9); flex-shrink: 0; }
        .dash-progress-bar { height: 8px; background: var(--bg-body, #F7F7F8); border-radius: 999px; overflow: hidden; margin: 0.75rem 0; }
        .dash-progress-fill { height: 100%; background: linear-gradient(90deg,var(--primary, #FF6FA9), #F85A9A); border-radius: 999px; transition: width 0.5s; }
        .dash-next-step { background: var(--primary-light, #FFF1F7); border-radius: 10px; padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; }
        .dash-btn-config { background: linear-gradient(135deg,var(--primary, #FF6FA9), #F85A9A); color: white; border: none; border-radius: 8px; padding: 0.45rem 0.9rem; font-family: 'Geist', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .dash-steps { display: flex; flex-direction: column; gap: 0.25rem; }
        .dash-atalhos { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.6rem; }
        .dash-atalho-btn { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; background: var(--bg-body, #F7F7F8); border: 1.5px solid var(--border, #E9E9EE); border-radius: 12px; padding: 0.75rem 0.5rem; cursor: pointer; transition: border-color 0.15s, transform 0.15s; font-family: 'Geist', sans-serif; }
        .dash-atalho-btn:hover { border-color: var(--primary, #FF6FA9); transform: translateY(-1px); }
        .dash-atalho-icon { display: flex; align-items: center; justify-content: center; }
        .dash-atalho-label { font-size: 0.72rem; font-weight: 500; color: var(--text-primary, #374151); }

        /* Calendário */
        .cal-nav-btn { width: 28px; height: 28px; border-radius: 50%; border: 1.5px solid var(--border, #E9E9EE); background: var(--bg-card, #FFFFFF); cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center; color: var(--text-secondary, #6B7280); transition: background 0.15s; line-height: 1; padding: 0; }
        .cal-nav-btn:hover { background: var(--primary-light, #FFF1F7); color: var(--primary, #FF6FA9); border-color: var(--primary, #FF6FA9); }
        .cal-grid-header { display: grid; grid-template-columns: repeat(7,1fr); margin-bottom: 0.35rem; }
        .cal-dow { text-align: center; font-size: 0.72rem; font-weight: 700; color: var(--text-muted, #9CA3AF); text-transform: uppercase; padding: 0.3rem 0; }
        .cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 3px; }
        .cal-day { position: relative; aspect-ratio: 1; border-radius: 10px; border: none; background: transparent; cursor: pointer; font-size: 0.88rem; font-weight: 500; color: var(--text-primary, #374151); font-family: 'Geist', sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: background 0.15s; gap: 2px; }
        .cal-day:hover { background: var(--primary-light, #FFF1F7); color: var(--primary, #FF6FA9); }
        .cal-day.hoje { background: var(--primary-light, #FFF1F7); color: var(--primary, #FF6FA9); font-weight: 800; }
        .cal-day.selecionado { background: linear-gradient(135deg,var(--primary, #FF6FA9), #F85A9A) !important; color: white !important; font-weight: 800; }
        .cal-day.tem-pedido { font-weight: 700; }
        .cal-dot { font-size: 0.55rem; background: var(--primary, #FF6FA9); color: white; border-radius: 10px; padding: 0 4px; line-height: 1.4; }
        .cal-day.selecionado .cal-dot { background: rgba(255,255,255,0.4); color: white; }

        .ini-grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
        .ini-col-left, .ini-col-right { display: flex; flex-direction: column; gap: 1.25rem; }
        .ini-section-title { font-size: 0.95rem; font-weight: 700; color: var(--text-title, #1F2937); margin: 0 0 0.75rem; }

        .trial-card { background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); border-radius: 14px; padding: 1rem 1.25rem; position: relative; overflow: hidden; }
        .trial-card-badge { position: absolute; top: 0; right: 0; background: #f9007a; color: white; font-size: 0.62rem; font-weight: 700; padding: 0.25rem 0.7rem; border-radius: 0 14px 0 10px; }
        .trial-card-body { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; margin-top: 1.5rem; }
        .trial-card-icon { background: var(--bg-card, #FFFFFF); border-radius: 10px; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 4px; }
        .trial-card-title { font-size: 0.88rem; font-weight: 800; color: white; margin: 0 0 0.2rem; }
        .trial-card-price { font-size: 0.76rem; color: rgba(255,255,255,0.7); margin: 0; }
        .trial-benefits { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
        .trial-benefit-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.85); }
        .trial-benefit-dot { font-size: 0.7rem; flex-shrink: 0; }
        .trial-card-btn { width: 100%; padding: 0.65rem; background: linear-gradient(135deg, #f9c74f, #f8961e); color: #1a1a2e; border: none; border-radius: 10px; font-family: 'Geist', sans-serif; font-size: 0.88rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(248,150,30,0.3); transition: opacity 0.2s; }
        .trial-card-btn:hover { opacity: 0.92; }

        .atalhos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .atalho-btn { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; background: var(--bg-card, #FFFFFF); border: 1.5px solid var(--border, #E9E9EE); border-radius: 12px; padding: 0.75rem 0.5rem; cursor: pointer; transition: border-color 0.15s, transform 0.15s; font-family: 'Geist', sans-serif; }
        .atalho-btn:hover { border-color: var(--primary, #FF6FA9); transform: translateY(-1px); }
        .atalho-icon { display: flex; align-items: center; justify-content: center; }
        .atalho-label { font-size: 0.72rem; font-weight: 500; color: var(--text-primary, #374151); }

        .progresso-card { background: var(--bg-card, #FFFFFF); border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .progresso-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .progresso-sub { font-size: 0.8rem; color: var(--text-secondary, #6B7280); margin: 0.3rem 0 0; max-width: 320px; line-height: 1.4; }
        .progresso-pct-circle { width: 56px; height: 56px; border-radius: 50%; background: var(--primary, #FF6FA9); display: flex; align-items: center; justify-content: center; color: white; font-size: 0.85rem; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 12px rgba(249,0,122,0.3); }
        .progresso-bar-bg { height: 10px; background: var(--bg-body, #F7F7F8); border-radius: 999px; overflow: hidden; }
        .progresso-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary, #FF6FA9), #f9007a); border-radius: 999px; transition: width 1s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
        .progresso-bar-fill::after { content: ""; position: absolute; top: 0; left: -60%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); animation: shimmer 2s infinite; }

        .next-step-card { background: var(--bg-card, #FFFFFF); border-radius: 12px; padding: 0.9rem 1.1rem; border-left: 4px solid #f9c74f; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .next-step-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
        .next-step-dot { width: 10px; height: 10px; border-radius: 50%; background: #f9c74f; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(249,199,79,0.2); }
        .next-step-label { font-size: 0.72rem; color: var(--text-muted, #9CA3AF); font-weight: 500; margin: 0 0 0.2rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .next-step-text { font-size: 0.88rem; font-weight: 600; color: var(--text-title, #1F2937); margin: 0; }
        .next-step-btn { background: var(--primary-gradient, linear-gradient(135deg, #FF6FA9, #F85A9A)); color: white; border: none; border-radius: 8px; padding: 0.55rem 1rem; font-family: 'Geist', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }

        .steps-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .step-group { background: var(--bg-card, #FFFFFF); border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden; }
        .step-group-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.1rem; background: none; border: none; cursor: pointer; font-family: 'Geist', sans-serif; }
        .step-group-left { display: flex; align-items: center; gap: 0.6rem; }
        .step-group-title { font-size: 0.88rem; font-weight: 600; color: var(--text-title, #1F2937); }
        .step-group-right { display: flex; align-items: center; gap: 0.5rem; }
        .step-badge { font-size: 0.72rem; font-weight: 600; color: var(--text-secondary, #6B7280); background: var(--bg-body, #F7F7F8); padding: 0.2rem 0.6rem; border-radius: 20px; }
        .step-badge.done { background: #dcfce7; color: var(--success, #22C55E); }
        .step-items { border-top: 1px solid var(--border, #E9E9EE); }
        .step-item { width: 100%; display: flex; align-items: center; gap: 0.7rem; padding: 0.8rem 1.1rem; background: none; border: none; border-bottom: 1px solid var(--border, #E9E9EE); cursor: pointer; font-family: 'Geist', sans-serif; text-align: left; transition: background 0.15s; }
        .step-item:hover { background: var(--primary-light, #FFF1F7); }
        .step-item:last-child { border-bottom: none; }
        .step-check { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--border, #E9E9EE); display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .step-check.checked { background: #16a34a; border-color: var(--success, #22C55E); }
        .step-item-label { flex: 1; font-size: 0.83rem; color: var(--text-primary, #374151); font-weight: 500; }
        .step-status { font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
        .step-status.done { color: var(--success, #22C55E); }
        .step-status.pending { color: var(--primary, #FF6FA9); }
        .complete-banner { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.83rem; font-weight: 600; color: #92400e; display: inline-block; }
      `}</style>
    </div>
  );
}
