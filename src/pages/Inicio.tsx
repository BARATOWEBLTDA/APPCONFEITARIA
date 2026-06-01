import { useState, useEffect } from "react";
import { Users, Package, ClipboardList, DollarSign, UtensilsCrossed, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { QuickSetupModal } from "@/components/QuickSetupModal";

export default function Inicio() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [produtos, setProdutos] = useState(0);
  const [clientes, setClientes] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidos, setPedidos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [quickStep, setQuickStep] = useState<{label: string; path: string} | null>(null);
  const [profileUserId, setProfileUserId] = useState<string>("");
  const [diasTrial] = useState(14);

  useEffect(() => {
const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileUserId(user.id);
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      const { count: pc } = await supabase.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: cc } = await supabase.from("clientes").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: catc } = await supabase.from("categorias").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      setProdutos(pc || 0);
      setClientes(cc || 0);
      setCategorias(catc || 0);
      setLoading(false);
    };
    load();
  }, []);

  const steps = [
    {
      title: "Configure sua loja", emoji: "🏪",
      items: [
        { label: "Adicionar nome da loja", path: "/configuracoes", done: !!profile?.nome_loja },
        { label: "Adicionar logo da loja", path: "/configuracoes", done: !!profile?.foto_url },
        { label: "Adicionar WhatsApp", path: "/configuracoes", done: !!profile?.telefone },
        { label: "Adicionar localização", path: "/configuracoes", done: !!profile?.endereco },
        { label: "Definir horário de funcionamento", path: "/configuracoes", done: !!profile?.horario },
        { label: "Adicionar descrição da loja", path: "/configuracoes", done: !!profile?.descricao_loja },
        { label: "Configurar entrega", path: "/configuracoes", done: profile?.faz_entrega !== null && profile?.faz_entrega !== undefined },
      ],
    },
    { title: "Seus clientes", emoji: "👥", items: [{ label: "Cadastrar 1 cliente", path: "/clientes", done: clientes > 0 }] },
    { title: "Insumos", emoji: "🧂", items: [{ label: "Cadastrar 1 insumo", path: "/estoque", done: false }] },
    { title: "Doonly IA", emoji: "🤖", items: [{ label: "Converse com o Doonly IA", path: "/ia", done: false }] },
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
    { label: "Clientes", icon: <Users size={28} color="#f9007a" />, path: "/clientes" },
    { label: "Produtos", icon: <Package size={28} color="#f9007a" />, path: "/produtos" },
    { label: "Pedidos", icon: <ClipboardList size={28} color="#f9007a" />, path: "/pedidos" },
    { label: "Financeiro", icon: <DollarSign size={28} color="#f9007a" />, path: "/financeiro" },
    { label: "Cardápio", icon: <UtensilsCrossed size={28} color="#f9007a" />, path: "/cardapio-config" },
    { label: "Receitas", icon: <BookOpen size={28} color="#f9007a" />, path: "/receitas" },
  ];

  if (loading) return <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>Carregando...</div>;

  return (
    <div className="ini-root">

      {/* ===== MOBILE ===== */}
      <div className="ini-mobile">



        {/* 1. Configure seu Doonly - destaque escuro */}
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
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="ini-desktop">

        {/* Header desktop */}
        <div className="ini-header">
          <div>
            <h1 className="ini-greeting">
              {getGreeting()}{nome ? <>, <strong>{nome}</strong></> : ""}.
            </h1>
          </div>
          <span className="ini-trial-badge">
            <img src="/diamante.png" style={{ width: "16px", height: "16px", objectFit: "contain", flexShrink: 0 }} alt="" />
            Premium
          </span>
        </div>

        {/* Cards resumo desktop */}
        <div className="ini-summary">
          <div className="ini-sum-card">
            <span className="ini-sum-icon">📦</span>
            <p className="ini-sum-num">{pedidos}</p>
            <p className="ini-sum-label">Pedidos do mês</p>
          </div>
          <div className="ini-sum-card">
            <span className="ini-sum-icon">👥</span>
            <p className="ini-sum-num">{clientes}</p>
            <p className="ini-sum-label">Clientes</p>
          </div>
          <div className="ini-sum-card">
            <span className="ini-sum-icon">🎂</span>
            <p className="ini-sum-num">{produtos}</p>
            <p className="ini-sum-label">Produtos</p>
          </div>
        </div>

        {/* Grid 2 colunas */}
        <div className="ini-grid">

          {/* Coluna esquerda — Checklist */}
          <div className="ini-col-left">
            <div className="progresso-card">
              <div className="progresso-header">
                <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
                  <img src="/configureapp.png" alt="" style={{width:"52px",height:"52px",objectFit:"contain",flexShrink:0}} />
                  <div>
                    <h2 className="ini-section-title" style={{ margin: 0 }}>Configure seu Doonly</h2>
                    <p className="progresso-sub">
                      {progress === 100 ? "🎉 Tudo pronto! Sua loja está completa." : `${remaining === 1 ? "Resta apenas" : "Faltam apenas"} ${remaining} etapa${remaining !== 1 ? "s" : ""} para sua confeitaria decolar!`}
                    </p>
                  </div>
                </div>
                <div className="progresso-pct-circle"><span>{progress}%</span></div>
              </div>
              <div className="progresso-bar-bg">
                <div className="progresso-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Próximo passo */}
            {progress < 100 && nextStep && (
              <div className="next-step-card">
                <div className="next-step-left">
                  <span className="next-step-dot" />
                  <div>
                    <p className="next-step-label">Próximo passo recomendado</p>
                    <p className="next-step-text">{nextStep.label}</p>
                  </div>
                </div>
                <button className="next-step-btn" onClick={() => setQuickStep(nextStep)}>Configurar agora →</button>
              </div>
            )}

            {/* Steps */}
            <div className="steps-list">
              {steps.map((group, gi) => {
                const groupDone = group.items.filter(i => i.done).length;
                const isOpen = openGroup === gi;
                const allDone = groupDone === group.items.length;
                return (
                  <div key={gi} className="step-group">
                    <button className="step-group-header" onClick={() => setOpenGroup(isOpen ? null : gi)}>
                      <div className="step-group-left">
                        <span>{group.emoji}</span>
                        <span className="step-group-title">{group.title}</span>
                      </div>
                      <div className="step-group-right">
                        <span className={`step-badge ${allDone ? "done" : ""}`}>{allDone ? "✓ Completo" : `${groupDone}/${group.items.length}`}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className="step-items">
                        {group.items.map((item, ii) => (
                          <button key={ii} className="step-item" onClick={() => !item.done && setQuickStep(item)}>
                            <div className={`step-check ${item.done ? "checked" : ""}`}>
                              {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                            </div>
                            <span className="step-item-label">{item.label}</span>
                            <span className={`step-status ${item.done ? "done" : "pending"}`}>{item.done ? "Concluído" : "Fazer agora"}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {progress < 100 && <div className="complete-banner">🎁 Complete 100% e aproveite todos os recursos do Doonly!</div>}
          </div>

          {/* Coluna direita — Premium + Atalhos */}
          <div className="ini-col-right">
            <div className="trial-card">
              <div className="trial-card-badge">Recomendado</div>
              <div className="trial-card-body">
                <div className="trial-card-icon">
                  <img src="/assine.png" alt="Assine" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <h3 className="trial-card-title">ASSINE O DOONLY PREMIUM</h3>
                  <p className="trial-card-price">Apenas <strong>R$ 19,90/mês</strong> após o teste</p>
                </div>
              </div>
              <div className="trial-benefits">
                {["Clientes ilimitados","Produtos ilimitados","Relatórios avançados","Recursos exclusivos","Suporte prioritário","Assistente IA Doonly","Cardápio Digital profissional","Acesso a mais de 10.000 receitas"].map(b => (
                  <div key={b} className="trial-benefit-item"><span className="trial-benefit-dot">🔥</span><span>{b}</span></div>
                ))}
              </div>
              <button className="trial-card-btn" onClick={() => navigate("/assinar")}>Assinar agora</button>
            </div>

            <div className="ini-section">
              <h2 className="ini-section-title">Acesso rápido</h2>
              <div className="atalhos-grid">
                {atalhos.map(a => (
                  <button key={a.path} className="atalho-btn" onClick={() => navigate(a.path)}>
                    <div className="atalho-icon">{a.icon}</div>
                    <span className="atalho-label">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
        .ini-root { font-family: 'Inter', sans-serif; }

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
        .mob-sum-card { background: white; border-radius: 12px; padding: 0.75rem 0.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); cursor: pointer; transition: transform 0.15s; }
        .mob-sum-card:hover { transform: translateY(-1px); }
        .mob-sum-icon { font-size: 1.3rem; }
        .mob-sum-num { font-size: 1.2rem; font-weight: 800; color: #1f2937; margin: 0; }
        .mob-sum-label { font-size: 0.68rem; color: #9ca3af; margin: 0; font-weight: 500; }

        /* Trial mobile */
        .mob-trial { background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 14px; padding: 1rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; position: relative; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
        .mob-trial-left { display: flex; align-items: center; gap: 0.75rem; }
        .mob-trial-icon { width: 44px; height: 44px; background: white; border-radius: 10px; padding: 4px; flex-shrink: 0; overflow: hidden; }
        .mob-trial-title { font-size: 0.78rem; font-weight: 800; color: white; margin: 0 0 0.15rem; }
        .mob-trial-sub { font-size: 0.7rem; color: rgba(255,255,255,0.65); margin: 0; }
        .mob-trial-badge { position: absolute; top: 0; right: 0; background: #f9007a; color: white; font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 0 14px 0 8px; }

        /* Atalhos mobile */
        .mob-section-title { font-size: 0.88rem; font-weight: 700; color: #1f2937; }
        .mob-atalhos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .mob-atalho { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; background: white; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 0.7rem 0.4rem; cursor: pointer; font-family: 'Inter', sans-serif; transition: border-color 0.15s; }
        .mob-atalho:hover { border-color: #f9007a; }
        .mob-atalho-icon { display: flex; align-items: center; justify-content: center; }
        .mob-atalho-label { font-size: 0.68rem; font-weight: 500; color: #374151; }

        /* Progresso mobile */
        .mob-progress-card { background: white; border-radius: 14px; padding: 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .mob-progress-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .mob-progress-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .mob-progress-sub { font-size: 0.78rem; color: #6b7280; margin: 0; }
        .mob-progress-circle { width: 46px; height: 46px; border-radius: 50%; background: #f9007a; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: 800; flex-shrink: 0; }
        .mob-progress-bar-bg { height: 8px; background: #f3f4f6; border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; }
        .mob-progress-bar-fill { height: 100%; background: #f9007a; border-radius: 999px; transition: width 0.5s; }
        .mob-next-step { background: #fff0f6; border-radius: 10px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .mob-next-label { font-size: 0.7rem; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0; }
        .mob-next-text { font-size: 0.85rem; font-weight: 600; color: #1f2937; margin: 0; }
        .mob-next-btn { align-self: flex-start; background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 8px; padding: 0.45rem 0.9rem; font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600; cursor: pointer; }

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
        .mob-config-circle { width: 50px; height: 50px; border-radius: 50%; background: #f9007a; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 12px rgba(249,0,122,0.4); }
        .mob-config-bar-bg { height: 8px; background: rgba(255,255,255,0.15); border-radius: 999px; overflow: hidden; margin-bottom: 0.75rem; }
        .mob-config-bar-fill { height: 100%; background: #f9007a; border-radius: 999px; transition: width 0.5s; box-shadow: 0 0 8px rgba(249,0,122,0.5); }
        .mob-config-next { background: rgba(255,255,255,0.08); border-radius: 10px; padding: 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
        .mob-config-next-label { font-size: 0.68rem; color: rgba(255,255,255,0.5); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 0.2rem; }
        .mob-config-next-text { font-size: 0.82rem; font-weight: 600; color: white; margin: 0; }
        .mob-config-next-btn { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 8px; padding: 0.5rem 0.9rem; font-family: 'Inter', sans-serif; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; box-shadow: 0 2px 8px rgba(249,0,122,0.4); }

        /* ===== DESKTOP ===== */
        .ini-header { background: white; padding: 1rem 1.75rem; margin: -2rem -2rem 1.25rem -2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f3f4f6; }
        .ini-greeting { font-size: 1rem; font-weight: 700; color: #1f2937; margin: 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }

        .ini-trial-badge { background: #fff0f6; color: #f9007a; font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.7rem; border-radius: 6px; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid #fce7f3; }

        .ini-summary { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.25rem; max-width: 70%; }
        .ini-sum-card { background: white; border-radius: 14px; padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.3rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); min-width: 130px; }
        .ini-sum-icon { font-size: 1.4rem; }
        .ini-sum-num { font-size: 1.4rem; font-weight: 800; color: #1f2937; margin: 0; }
        .ini-sum-label { font-size: 0.75rem; color: #9ca3af; margin: 0; font-weight: 500; }

        .ini-grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
        .ini-col-left, .ini-col-right { display: flex; flex-direction: column; gap: 1.25rem; }
        .ini-section-title { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }

        .trial-card { background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); border-radius: 14px; padding: 1rem 1.25rem; position: relative; overflow: hidden; }
        .trial-card-badge { position: absolute; top: 0; right: 0; background: #f9007a; color: white; font-size: 0.62rem; font-weight: 700; padding: 0.25rem 0.7rem; border-radius: 0 14px 0 10px; }
        .trial-card-body { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; margin-top: 1.5rem; }
        .trial-card-icon { background: white; border-radius: 10px; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 4px; }
        .trial-card-title { font-size: 0.88rem; font-weight: 800; color: white; margin: 0 0 0.2rem; }
        .trial-card-price { font-size: 0.76rem; color: rgba(255,255,255,0.7); margin: 0; }
        .trial-benefits { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
        .trial-benefit-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.85); }
        .trial-benefit-dot { font-size: 0.7rem; flex-shrink: 0; }
        .trial-card-btn { width: 100%; padding: 0.65rem; background: linear-gradient(135deg, #f9c74f, #f8961e); color: #1a1a2e; border: none; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 16px rgba(248,150,30,0.3); transition: opacity 0.2s; }
        .trial-card-btn:hover { opacity: 0.92; }

        .atalhos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .atalho-btn { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; background: white; border: 1.5px solid #e5e7eb; border-radius: 12px; padding: 0.75rem 0.5rem; cursor: pointer; transition: border-color 0.15s, transform 0.15s; font-family: 'Inter', sans-serif; }
        .atalho-btn:hover { border-color: #f9007a; transform: translateY(-1px); }
        .atalho-icon { display: flex; align-items: center; justify-content: center; }
        .atalho-label { font-size: 0.72rem; font-weight: 500; color: #374151; }

        .progresso-card { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .progresso-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .progresso-sub { font-size: 0.8rem; color: #6b7280; margin: 0.3rem 0 0; max-width: 320px; line-height: 1.4; }
        .progresso-pct-circle { width: 56px; height: 56px; border-radius: 50%; background: #f9007a; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.85rem; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 12px rgba(249,0,122,0.3); }
        .progresso-bar-bg { height: 10px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
        .progresso-bar-fill { height: 100%; background: #f9007a; border-radius: 999px; transition: width 0.5s ease; }

        .next-step-card { background: white; border-radius: 12px; padding: 0.9rem 1.1rem; border-left: 4px solid #f9c74f; box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .next-step-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
        .next-step-dot { width: 10px; height: 10px; border-radius: 50%; background: #f9c74f; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(249,199,79,0.2); }
        .next-step-label { font-size: 0.72rem; color: #9ca3af; font-weight: 500; margin: 0 0 0.2rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .next-step-text { font-size: 0.88rem; font-weight: 600; color: #1f2937; margin: 0; }
        .next-step-btn { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 8px; padding: 0.55rem 1rem; font-family: 'Inter', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }

        .steps-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .step-group { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden; }
        .step-group-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.1rem; background: none; border: none; cursor: pointer; font-family: 'Inter', sans-serif; }
        .step-group-left { display: flex; align-items: center; gap: 0.6rem; }
        .step-group-title { font-size: 0.88rem; font-weight: 600; color: #1f2937; }
        .step-group-right { display: flex; align-items: center; gap: 0.5rem; }
        .step-badge { font-size: 0.72rem; font-weight: 600; color: #6b7280; background: #f3f4f6; padding: 0.2rem 0.6rem; border-radius: 20px; }
        .step-badge.done { background: #dcfce7; color: #16a34a; }
        .step-items { border-top: 1px solid #f3f4f6; }
        .step-item { width: 100%; display: flex; align-items: center; gap: 0.7rem; padding: 0.8rem 1.1rem; background: none; border: none; border-bottom: 1px solid #f9fafb; cursor: pointer; font-family: 'Inter', sans-serif; text-align: left; transition: background 0.15s; }
        .step-item:hover { background: #fff0f6; }
        .step-item:last-child { border-bottom: none; }
        .step-check { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; border: 2px solid #e5e7eb; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .step-check.checked { background: #16a34a; border-color: #16a34a; }
        .step-item-label { flex: 1; font-size: 0.83rem; color: #374151; font-weight: 500; }
        .step-status { font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
        .step-status.done { color: #16a34a; }
        .step-status.pending { color: #f9007a; }
        .complete-banner { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 0.9rem 1.1rem; font-size: 0.85rem; font-weight: 600; color: #92400e; }
      `}</style>
    </div>
  );
}
