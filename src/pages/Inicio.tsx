import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Inicio() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [produtos, setProdutos] = useState(0);
  const [clientes, setClientes] = useState(0);
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
      setProdutos(pc || 0);
      setClientes(cc || 0);
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
          <h1 className="ini-greeting">Olá{nome ? `, ${nome}` : ""}!</h1>
          
        </div>
        <span className="ini-trial-badge"><img src="/diamante.png" style={{width:"20px",height:"20px",objectFit:"contain",verticalAlign:"middle",marginRight:"4px"}} />Premium</span>
      </div>

      {/* Layout desktop: 2 colunas */}
      <div className="ini-grid">

        {/* Coluna esquerda */}
        <div className="ini-col-left">

          {/* Card Trial */}
          <div className="trial-card">
            <div className="trial-card-badge">Recomendado</div>
            <div className="trial-card-body">
              <div className="trial-card-icon"><img src="/assine.png" alt="Donnly" style={{width:"100%",height:"100%",objectFit:"contain"}} /></div>
              <div>
                <h3 className="trial-card-title">ASSINE O DONNLY</h3>
                <p className="trial-card-desc">Continue com todas as funcionalidades por apenas <strong>R$ 19,90/mês</strong> após o período de teste.</p>
              </div>
            </div>
            <button className="trial-card-btn" onClick={() => alert("Em breve! Fale conosco pelo WhatsApp.")}>
              Assinar agora
            </button>
            <p className="trial-card-days">⏱️ Você tem <strong>{diasTrial} dias</strong> restantes de avaliação gratuita</p>
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

        {/* Coluna direita */}
        <div className="ini-col-right">

          {/* Progresso */}
          <div className="progresso-card">
            <div className="progresso-header">
              <div>
                <h2 className="ini-section-title" style={{ margin: 0 }}>Configure seu Donnly</h2>
                <p className="progresso-sub">Complete as etapas e aproveite ao máximo</p>
              </div>
              <div className="progresso-pct-circle">
                <span>{progress}%</span>
              </div>
            </div>
            <div className="progresso-bar-bg">
              <div className="progresso-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progresso-count">{doneCount} de {totalCount} etapas concluídas</p>
          </div>

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
              🎁 Complete 100% e aproveite todos os recursos do Donnly!
            </div>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        .ini-root { font-family: 'Inter', sans-serif; }

        /* Header */
        .ini-header {
          background: linear-gradient(135deg, #f9007a 0%, #ff6eb4 100%);
          padding: 1.5rem 1.75rem;
          margin: -2rem -2rem 1.5rem -2rem;
          display: flex; align-items: center; justify-content: space-between;
        }
        .ini-greeting { font-size: 1.5rem; font-weight: 700; color: white; margin: 0 0 0.2rem; }
        .ini-subtitle { font-size: 0.9rem; color: rgba(255,255,255,0.8); margin: 0; }
        .ini-trial-badge {
          background: rgba(255,255,255,0.25); color: white;
          font-size: 0.75rem; font-weight: 600; padding: 0.3rem 0.8rem;
          border-radius: 20px; white-space: nowrap;
        }

        /* Grid 2 colunas no desktop */
        .ini-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
          align-items: start;
        }
        .ini-col-left, .ini-col-right { display: flex; flex-direction: column; gap: 1.25rem; }

        .ini-section-title { font-size: 0.95rem; font-weight: 700; color: #1f2937; margin: 0 0 0.75rem; }

        /* Trial card — estilo download app */
        .trial-card {
          background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
          border-radius: 18px; padding: 1.5rem;
          position: relative; overflow: hidden;
        }
        .trial-card-badge {
          position: absolute; top: 0; right: 0;
          background: linear-gradient(135deg, #f9007a, #ff6eb4);
          color: white; font-size: 0.7rem; font-weight: 700;
          padding: 0.35rem 1.1rem; border-radius: 0 18px 0 18px;
          letter-spacing: 0.5px;
        }
        .trial-card-body { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; margin-top: 0.5rem; }
        .trial-card-icon {
          background: white; border-radius: 14px;
          width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; overflow: hidden; padding: 4px;
        }
        .trial-card-title { font-size: 1.05rem; font-weight: 800; color: white; margin: 0 0 0.3rem; letter-spacing: 0.3px; }
        .trial-card-desc { font-size: 0.82rem; color: rgba(255,255,255,0.7); margin: 0; line-height: 1.4; }
        .trial-card-btn {
          width: 100%; padding: 0.85rem;
          background: linear-gradient(135deg, #f9c74f, #f8961e);
          color: #1a1a2e; border: none; border-radius: 12px;
          font-family: 'Inter', sans-serif; font-size: 0.95rem; font-weight: 800;
          cursor: pointer; letter-spacing: 0.3px; margin-bottom: 0.75rem;
          box-shadow: 0 4px 16px rgba(248,150,30,0.3);
          transition: opacity 0.2s;
        }
        .trial-card-btn:hover { opacity: 0.92; }
        .trial-card-days { font-size: 0.78rem; color: rgba(255,255,255,0.6); margin: 0; text-align: center; }

        /* Atalhos */
        .atalhos-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem;
        }
        .atalho-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
          background: white; border: 1.5px solid #e5e7eb; border-radius: 12px;
          padding: 0.75rem 0.5rem; cursor: pointer;
          transition: border-color 0.15s, transform 0.15s;
          font-family: 'Inter', sans-serif;
        }
        .atalho-btn:hover { border-color: #f9007a; transform: translateY(-1px); }
        .atalho-emoji { font-size: 1.4rem; }
        .atalho-label { font-size: 0.72rem; font-weight: 500; color: #374151; }

        /* Progresso */
        .progresso-card {
          background: white; border-radius: 14px; padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .progresso-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
        .progresso-sub { font-size: 0.8rem; color: #9ca3af; margin: 0.2rem 0 0; }
        .progresso-pct-circle {
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #f9007a, #ff6eb4);
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 0.82rem; font-weight: 800;
          flex-shrink: 0;
        }
        .progresso-bar-bg { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; margin-bottom: 0.4rem; }
        .progresso-bar-fill { height: 100%; background: linear-gradient(135deg, #f9007a, #ff6eb4); border-radius: 4px; transition: width 0.5s ease; }
        .progresso-count { font-size: 0.78rem; color: #9ca3af; margin: 0; text-align: center; }

        /* Steps */
        .steps-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .step-group {
          background: white; border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;
        }
        .step-group-header {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 0.9rem 1.1rem; background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }
        .step-group-left { display: flex; align-items: center; gap: 0.6rem; }
        .step-group-title { font-size: 0.88rem; font-weight: 600; color: #1f2937; }
        .step-group-right { display: flex; align-items: center; gap: 0.5rem; }
        .step-badge {
          font-size: 0.72rem; font-weight: 600; color: #6b7280;
          background: #f3f4f6; padding: 0.2rem 0.6rem; border-radius: 20px;
        }
        .step-badge.done { background: #dcfce7; color: #16a34a; }
        .step-items { border-top: 1px solid #f3f4f6; }
        .step-item {
          width: 100%; display: flex; align-items: center; gap: 0.7rem;
          padding: 0.8rem 1.1rem; background: none; border: none;
          border-bottom: 1px solid #f9fafb; cursor: pointer;
          font-family: 'Inter', sans-serif; text-align: left;
          transition: background 0.15s;
        }
        .step-item:hover { background: #fff0f6; }
        .step-item:last-child { border-bottom: none; }
        .step-check {
          width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid #e5e7eb;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .step-check.checked { background: #16a34a; border-color: #16a34a; }
        .step-item-label { flex: 1; font-size: 0.83rem; color: #374151; font-weight: 500; }
        .step-status { font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
        .step-status.done { color: #16a34a; }
        .step-status.pending { color: #f9007a; }

        .complete-banner {
          background: #fff7ed; border: 1px solid #fed7aa;
          border-radius: 12px; padding: 0.9rem 1.1rem;
          font-size: 0.85rem; font-weight: 600; color: #92400e;
        }

        /* Mobile: 1 coluna */
        @media (max-width: 768px) {
          .ini-grid { grid-template-columns: 1fr; }
          .ini-header { margin: -1rem -1rem 1.25rem -1rem; padding: 1.25rem; }
        }
      `}</style>
    </div>
  );
}
