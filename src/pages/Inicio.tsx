import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Inicio() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [produtos, setProdutos] = useState(0);
  const [clientes, setClientes] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidos, setPedidos] = useState(0);
  const [faturamento, setFaturamento] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openGroup, setOpenGroup] = useState<number | null>(0);
  const [diasTrial] = useState(14);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
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
      title: "Configure sua loja",
      emoji: "🏪",
      items: [
        { label: "Adicionar logo/foto da loja", path: "/configuracoes", done: !!profile?.foto_url },
        { label: "Adicionar WhatsApp", path: "/configuracoes", done: !!profile?.telefone },
        { label: "Informar localização", path: "/configuracoes", done: !!profile?.endereco },
        { label: "Configurar horário de funcionamento", path: "/configuracoes", done: !!profile?.horario },
        { label: "Adicionar descrição da loja", path: "/configuracoes", done: !!profile?.descricao_loja },
        { label: "Configurar entrega", path: "/configuracoes", done: profile?.faz_entrega !== null && profile?.faz_entrega !== undefined },
        { label: "Criar pelo menos 1 categoria", path: "/configuracoes", done: categorias > 0 },
      ],
    },
    {
      title: "Seus produtos",
      emoji: "🎂",
      items: [{ label: "Adicionar primeiro produto", path: "/produtos", done: produtos > 0 }],
    },
    {
      title: "Seus clientes",
      emoji: "👥",
      items: [{ label: "Cadastrar primeiro cliente", path: "/clientes", done: clientes > 0 }],
    },
    {
      title: "Cardápio público",
      emoji: "🛍️",
      items: [{ label: "Configurar seu cardápio público", path: "/cardapio-config", done: !!profile?.foto_url && produtos > 0 }],
    },
  ];

  const allItems = steps.flatMap(s => s.items);
  const doneCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const progress = Math.round((doneCount / totalCount) * 100);
  const remaining = totalCount - doneCount;
  const nome = profile?.nome?.split(" ")[0] || "";

  const atalhos = [
    { label: "Clientes", emoji: "👥", path: "/clientes" },
    { label: "Produtos", emoji: "🎂", path: "/produtos" },
    { label: "Pedidos", emoji: "📋", path: "/pedidos" },
    { label: "Financeiro", emoji: "💰", path: "/financeiro" },
    { label: "Cardápio", emoji: "🛍️", path: "/cardapio-config" },
    { label: "Receitas", emoji: "📄", path: "/receitas" },
  ];

  if (loading) return <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>Carregando...</div>;

  return (
    <div className="ini-root">

      {/* Header rosa */}
      <div className="ini-header">
        <div>
          <h1 className="ini-greeting">
            {nome ? `Olá, ${nome}!` : "Olá!"} <span className="ini-welcome">Bem-vindo de volta.</span>
          </h1>
        </div>
        <span className="ini-trial-badge">
          <img src="/diamante.png" style={{ width: "16px", height: "16px", objectFit: "contain", flexShrink: 0 }} alt="" />
          Premium
        </span>
      </div>

      {/* Cards resumo */}
      <div className="ini-summary">
        <div className="ini-sum-card">
          <span className="ini-sum-icon">📦</span>
          <div>
            <p className="ini-sum-num">{pedidos}</p>
            <p className="ini-sum-label">Pedidos do mês</p>
          </div>
        </div>
        <div className="ini-sum-card">
          <span className="ini-sum-icon">👥</span>
          <div>
            <p className="ini-sum-num">{clientes}</p>
            <p className="ini-sum-label">Clientes</p>
          </div>
        </div>
        <div className="ini-sum-card">
          <span className="ini-sum-icon">🎂</span>
          <div>
            <p className="ini-sum-num">{produtos}</p>
            <p className="ini-sum-label">Produtos</p>
          </div>
        </div>
        <div className="ini-sum-card">
          <span className="ini-sum-icon">💰</span>
          <div>
            <p className="ini-sum-num">R$ {faturamento.toFixed(2)}</p>
            <p className="ini-sum-label">Faturamento</p>
          </div>
        </div>
      </div>

      {/* Layout desktop: checklist esquerda, atalhos + premium direita */}
      <div className="ini-grid">

        {/* Coluna esquerda — Checklist */}
        <div className="ini-col-left">
          {/* Progresso */}
          <div className="progresso-card">
            <div className="progresso-header">
              <div>
                <h2 className="ini-section-title" style={{ margin: 0 }}>Configure seu Doonly</h2>
                <p className="progresso-sub">
                  {progress === 100
                    ? "🎉 Tudo pronto! Sua loja está completa."
                    : `Falta pouco! Complete mais ${remaining} etapa${remaining !== 1 ? "s" : ""} para liberar todo o potencial da sua loja.`
                  }
                </p>
              </div>
              <div className="progresso-pct-circle">
                <span>{progress}%</span>
              </div>
            </div>
            <div className="progresso-bar-bg">
              <div className="progresso-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Próximo passo */}
          {progress < 100 && (() => {
            const nextStep = allItems.find(i => !i.done);
            return nextStep ? (
              <div className="next-step-card">
                <div className="next-step-left">
                  <span className="next-step-dot" />
                  <div>
                    <p className="next-step-label">Próximo passo recomendado</p>
                    <p className="next-step-text">{nextStep.label}</p>
                  </div>
                </div>
                <button className="next-step-btn" onClick={() => navigate(nextStep.path)}>
                  Configurar agora →
                </button>
              </div>
            ) : null;
          })()}

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
                      <span className={`step-badge ${allDone ? "done" : ""}`}>
                        {allDone ? "✓ Completo" : `${groupDone}/${group.items.length}`}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.2s" }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="step-items">
                      {group.items.map((item, ii) => (
                        <button key={ii} className="step-item" onClick={() => navigate(item.path)}>
                          <div className={`step-check ${item.done ? "checked" : ""}`}>
                            {item.done && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                          </div>
                          <span className="step-item-label">{item.label}</span>
                          <span className={`step-status ${item.done ? "done" : "pending"}`}>
                            {item.done ? "Concluído" : "Fazer agora"}
                          </span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {progress < 100 && (
            <div className="complete-banner">
              🎁 Complete 100% e aproveite todos os recursos do Doonly!
            </div>
          )}
        </div>

        {/* Coluna direita — Premium + Atalhos */}
        <div className="ini-col-right">

          {/* Card Trial — compacto */}
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
                <div key={b} className="trial-benefit-item">
                  <span className="trial-benefit-dot">🔥</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
            <button className="trial-card-btn" onClick={() => alert("Em breve! Fale conosco pelo WhatsApp.")}>
              Assinar agora
            </button>
          </div>

          {/* Atalhos */}
          <div className="ini-section">
            <h2 className="ini-section-title">Acesso rápido</h2>
            <div className="atalhos-grid">
              {atalhos.map(a => (
                <button key={a.path} className="atalho-btn" onClick={() => navigate(a.path)}>
                  <span className="atalho-emoji">{a.emoji}</span>
                  <span className="atalho-label">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .ini-root { font-family: 'Inter', sans-serif; }

        /* Header */
        .ini-header {
          background: linear-gradient(135deg, #f9007a 0%, #ff6eb4 100%);
          padding: 1rem 1.75rem;
          margin: -2rem -2rem 1.25rem -2rem;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ini-greeting { font-size: 1rem; font-weight: 700; color: white; margin: 0; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
        .ini-welcome { font-size: 1rem; font-weight: 400; color: rgba(255,255,255,0.85); }
        .ini-trial-badge {
          background: rgba(255,255,255,0.25); color: white;
          font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.7rem;
          border-radius: 6px; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 0.3rem; flex-shrink: 0;
        }

        /* Resumo cards */
        .ini-summary {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .ini-sum-card {
          background: white; border-radius: 12px; padding: 0.9rem 1rem;
          display: flex; align-items: center; gap: 0.75rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .ini-sum-icon { font-size: 1.5rem; flex-shrink: 0; }
        .ini-sum-num { font-size: 1.2rem; font-weight: 800; color: #1f2937; margin: 0; }
        .ini-sum-label { font-size: 0.72rem; color: #9ca3af; margin: 0; font-weight: 500; }

        /* Grid 2 colunas */
        .ini-grid { display: grid; grid-template-columns: 1fr 320px; gap: 1.25rem; align-items: start; }
        .ini-col-left, .ini-col-right { display: flex; flex-direction: column; gap: 1.25rem; }
        .ini-section-title { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }

        /* Trial card */
        .trial-card {
          background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
          border-radius: 14px; padding: 1rem 1.25rem; position: relative; overflow: hidden;
        }
        .trial-card-badge {
          position: absolute; top: 0; right: 0;
          background: linear-gradient(135deg, #f9007a, #ff6eb4);
          color: white; font-size: 0.62rem; font-weight: 700;
          padding: 0.25rem 0.7rem; border-radius: 0 14px 0 10px; letter-spacing: 0.3px;
        }
        .trial-card-body { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; margin-top: 1.5rem; }
        .trial-card-icon { background: white; border-radius: 10px; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; padding: 4px; }
        .trial-card-title { font-size: 0.88rem; font-weight: 800; color: white; margin: 0 0 0.2rem; }
        .trial-card-price { font-size: 0.76rem; color: rgba(255,255,255,0.7); margin: 0; }
        .trial-benefits { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.75rem; }
        .trial-benefit-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: rgba(255,255,255,0.85); }
        .trial-benefit-dot { font-size: 0.7rem; flex-shrink: 0; }

        .next-step-card {
          background: white; border-radius: 12px; padding: 0.9rem 1.1rem;
          border-left: 4px solid #f9c74f;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          display: flex; align-items: center; justify-content: space-between; gap: 1rem;
          flex-wrap: wrap;
        }
        .next-step-left { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
        .next-step-dot { width: 10px; height: 10px; border-radius: 50%; background: #f9c74f; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(249,199,79,0.2); }
        .next-step-label { font-size: 0.72rem; color: #9ca3af; font-weight: 500; margin: 0 0 0.2rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .next-step-text { font-size: 0.88rem; font-weight: 600; color: #1f2937; margin: 0; }
        .next-step-btn { background: linear-gradient(135deg, #f9007a, #d4006a); color: white; border: none; border-radius: 8px; padding: 0.55rem 1rem; font-family: 'Inter', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
        .next-step-btn:hover { opacity: 0.9; }
        .trial-card-desc { font-size: 0.76rem; color: rgba(255,255,255,0.7); margin: 0; line-height: 1.4; }
        .trial-card-btn {
          width: 100%; padding: 0.65rem;
          background: linear-gradient(135deg, #f9c74f, #f8961e);
          color: #1a1a2e; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 0.88rem; font-weight: 800;
          cursor: pointer; box-shadow: 0 4px 16px rgba(248,150,30,0.3); transition: opacity 0.2s;
        }
        .trial-card-btn:hover { opacity: 0.92; }

        /* Atalhos */
        .atalhos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .atalho-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
          background: white; border: 1.5px solid #e5e7eb; border-radius: 12px;
          padding: 0.75rem 0.5rem; cursor: pointer;
          transition: border-color 0.15s, transform 0.15s; font-family: 'Inter', sans-serif;
        }
        .atalho-btn:hover { border-color: #f9007a; transform: translateY(-1px); }
        .atalho-emoji { font-size: 1.4rem; }
        .atalho-label { font-size: 0.72rem; font-weight: 500; color: #374151; }

        /* Progresso */
        .progresso-card { background: white; border-radius: 14px; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .progresso-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .progresso-sub { font-size: 0.8rem; color: #6b7280; margin: 0.3rem 0 0; max-width: 320px; line-height: 1.4; }
        .progresso-pct-circle {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #f9007a, #ff6eb4);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 0.82rem; font-weight: 800; flex-shrink: 0;
        }
        .progresso-bar-bg { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
        .progresso-bar-fill { height: 100%; background: linear-gradient(135deg, #f9007a, #ff6eb4); border-radius: 4px; transition: width 0.5s ease; }

        /* Steps */
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

        /* Mobile: 1 coluna */
        @media (max-width: 768px) {
          .ini-grid { grid-template-columns: 1fr; }
          .ini-summary { grid-template-columns: repeat(2, 1fr); }
          .ini-header { margin: -1rem -1rem 1.25rem -1rem; padding: 1rem; }
        }
      `}</style>
    </div>
  );
}
