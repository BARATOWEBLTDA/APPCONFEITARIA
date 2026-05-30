import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface StepItem {
  label: string;
  path: string;
  done: boolean;
}

interface StepGroup {
  title: string;
  emoji: string;
  items: StepItem[];
}

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

  const steps: StepGroup[] = [
    {
      title: "Configure sua loja",
      emoji: "🏪",
      items: [
        { label: "Adicionar logo/foto da loja", path: "/configuracoes", done: !!profile?.foto_url },
        { label: "Adicionar WhatsApp", path: "/configuracoes", done: !!profile?.telefone },
        { label: "Informar localização", path: "/configuracoes", done: !!profile?.endereco },
      ],
    },
    {
      title: "Seus produtos",
      emoji: "🎂",
      items: [
        { label: "Adicionar primeiro produto", path: "/produtos", done: produtos > 0 },
      ],
    },
    {
      title: "Seus clientes",
      emoji: "👥",
      items: [
        { label: "Cadastrar primeiro cliente", path: "/clientes", done: clientes > 0 },
      ],
    },
    {
      title: "Cardápio público",
      emoji: "🛍️",
      items: [
        { label: "Configurar seu cardápio público", path: "/cardapio-config", done: !!profile?.foto_url && produtos > 0 },
      ],
    },
  ];

  const allItems = steps.flatMap(s => s.items);
  const doneCount = allItems.filter(i => i.done).length;
  const totalCount = allItems.length;
  const progress = Math.round((doneCount / totalCount) * 100);

  const nome = profile?.nome?.split(" ")[0] || "bem-vinda";

  if (loading) return <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>Carregando...</div>;

  return (
    <div className="inicio-root">
      {/* Header */}
      <div className="inicio-header">

        <div className="inicio-header-info">
          <div className="inicio-loja-row">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span className="inicio-loja-nome">{profile?.nome_loja || "Minha Confeitaria"}</span>
            <span className="inicio-trial-badge">Trial: {diasTrial} dias</span>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="inicio-content">

        {/* Banner Trial */}
        <div className="trial-banner">
          <div className="trial-banner-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f9007a" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <p className="trial-title">Você tem {diasTrial} dias restantes de avaliação</p>
              <p className="trial-sub">Após o período, continue por apenas <strong>R$ 19,90/mês</strong></p>
            </div>
          </div>
          <button className="trial-btn" onClick={() => alert("Em breve! Entre em contato pelo WhatsApp.")}>
            💎 Assinar agora
          </button>
        </div>

        {/* Atalhos rápidos */}
        <div className="atalhos-row">
          {[
            { label: "Clientes", emoji: "👥", path: "/clientes" },
            { label: "Produtos", emoji: "🎂", path: "/produtos" },
            { label: "Pedidos", emoji: "📋", path: "/pedidos" },
            { label: "Financeiro", emoji: "💰", path: "/financeiro" },
            { label: "Cardápio", emoji: "🛍️", path: "/cardapio-config" },
          ].map(a => (
            <button key={a.path} className="atalho-btn" onClick={() => navigate(a.path)}>
              <span className="atalho-emoji">{a.emoji}</span>
              <span className="atalho-label">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Progresso */}
        <div className="progresso-card">
          <h2 className="progresso-title">Bem-vinda, {nome}! 🎉</h2>
          <p className="progresso-sub">Complete as etapas e configure seu app</p>

          <div className="progresso-row">
            <span className="progresso-label">Seu progresso</span>
            <span className="progresso-pct" style={{ color: "#f9007a" }}>{progress}%</span>
          </div>
          <div className="progresso-bar-bg">
            <div className="progresso-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progresso-count">{doneCount} de {totalCount} etapas concluídas</p>
        </div>

        {/* Grupos de etapas */}
        <div className="steps-list">
          {steps.map((group, gi) => {
            const groupDone = group.items.filter(i => i.done).length;
            const isOpen = openGroup === gi;
            const allDone = groupDone === group.items.length;
            return (
              <div key={gi} className="step-group">
                <button className="step-group-header" onClick={() => setOpenGroup(isOpen ? null : gi)}>
                  <div className="step-group-left">
                    <span className="step-group-emoji">{group.emoji}</span>
                    <span className="step-group-title">{group.title}</span>
                  </div>
                  <div className="step-group-right">
                    <span className={`step-group-count ${allDone ? "done" : ""}`}>
                      {allDone ? "✓" : `${groupDone}/${group.items.length}`}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "0.2s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="step-items">
                    {group.items.map((item, ii) => (
                      <button key={ii} className="step-item" onClick={() => navigate(item.path)}>
                        <div className={`step-check ${item.done ? "checked" : ""}`}>
                          {item.done && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                        <span className="step-item-label">{item.label}</span>
                        <span className={`step-item-status ${item.done ? "done" : "pending"}`}>
                          {item.done ? "Concluído" : "Adicionar"}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Banner completar */}
        {progress < 100 && (
          <div className="complete-banner">
            <span>🎁</span>
            <span>Complete 100% e aproveite todos os recursos!</span>
          </div>
        )}

      </div>

      <style>{`
        .inicio-root { font-family: 'Inter', sans-serif; }

        .inicio-header {
          background: linear-gradient(135deg, #f9007a 0%, #ff6eb4 100%);
          padding: 1rem 1.25rem 1.25rem;
          margin: -2rem -2rem 0 -2rem;
        }



        .inicio-loja-row { display: flex; align-items: center; gap: 0.5rem; }
        .inicio-loja-nome { color: white; font-weight: 600; font-size: 0.95rem; }
        .inicio-trial-badge {
          background: rgba(255,255,255,0.25); color: white;
          font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem;
          border-radius: 20px;
        }

        .inicio-content { padding: 1.25rem 0; display: flex; flex-direction: column; gap: 1rem; }

        /* Trial banner */
        .trial-banner {
          background: #fff0f6; border: 1px solid #fce7f3;
          border-radius: 14px; padding: 1rem 1.25rem;
          display: flex; flex-direction: column; gap: 0.75rem;
        }
        .trial-banner-left { display: flex; align-items: flex-start; gap: 0.75rem; }
        .trial-title { font-size: 0.9rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .trial-sub { font-size: 0.8rem; color: #6b7280; margin: 0; }
        .trial-btn {
          width: 100%; padding: 0.75rem; background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; border: none; border-radius: 10px;
          font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; letter-spacing: 0.3px;
        }

        /* Atalhos */
        .atalhos-row {
          display: flex; gap: 0.5rem; overflow-x: auto;
          scrollbar-width: none; padding: 0.25rem 0;
        }
        .atalho-btn {
          display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
          background: white; border: 1.5px solid #e5e7eb; border-radius: 12px;
          padding: 0.6rem 0.8rem; cursor: pointer; flex-shrink: 0;
          transition: border-color 0.15s;
          min-width: 70px;
        }
        .atalho-btn:hover { border-color: #f9007a; }
        .atalho-emoji { font-size: 1.3rem; }
        .atalho-label { font-size: 0.7rem; font-weight: 500; color: #374151; white-space: nowrap; }

        /* Progresso */
        .progresso-card {
          background: white; border-radius: 14px; padding: 1.25rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .progresso-title { font-size: 1.05rem; font-weight: 700; color: #1f2937; margin: 0 0 0.2rem; }
        .progresso-sub { font-size: 0.82rem; color: #6b7280; margin: 0 0 1rem; }
        .progresso-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }
        .progresso-label { font-size: 0.88rem; font-weight: 500; color: #374151; }
        .progresso-pct { font-size: 0.95rem; font-weight: 800; }
        .progresso-bar-bg { height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
        .progresso-bar-fill { height: 100%; background: linear-gradient(135deg, #f9007a, #ff6eb4); border-radius: 4px; transition: width 0.5s ease; }
        .progresso-count { font-size: 0.78rem; color: #9ca3af; margin: 0.4rem 0 0; text-align: center; }

        /* Steps */
        .steps-list { display: flex; flex-direction: column; gap: 0.6rem; }

        .step-group {
          background: white; border-radius: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06); overflow: hidden;
        }

        .step-group-header {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.25rem; background: none; border: none; cursor: pointer;
          font-family: 'Inter', sans-serif;
        }

        .step-group-left { display: flex; align-items: center; gap: 0.6rem; }
        .step-group-emoji { font-size: 1.2rem; }
        .step-group-title { font-size: 0.92rem; font-weight: 600; color: #1f2937; }

        .step-group-right { display: flex; align-items: center; gap: 0.5rem; }
        .step-group-count {
          font-size: 0.78rem; font-weight: 600; color: #6b7280;
          background: #f3f4f6; padding: 0.2rem 0.5rem; border-radius: 20px;
        }
        .step-group-count.done { background: #dcfce7; color: #16a34a; }

        .step-items { border-top: 1px solid #f3f4f6; }

        .step-item {
          width: 100%; display: flex; align-items: center; gap: 0.75rem;
          padding: 0.85rem 1.25rem; background: none; border: none;
          border-bottom: 1px solid #f9fafb; cursor: pointer;
          font-family: 'Inter', sans-serif; text-align: left;
          transition: background 0.15s;
        }
        .step-item:hover { background: #fff0f6; }
        .step-item:last-child { border-bottom: none; }

        .step-check {
          width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid #e5e7eb;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .step-check.checked { background: #16a34a; border-color: #16a34a; }

        .step-item-label { flex: 1; font-size: 0.85rem; color: #374151; font-weight: 500; }

        .step-item-status {
          font-size: 0.78rem; font-weight: 600; white-space: nowrap;
        }
        .step-item-status.done { color: #16a34a; }
        .step-item-status.pending { color: #f9007a; }

        /* Complete banner */
        .complete-banner {
          background: #fff7ed; border: 1px solid #fed7aa;
          border-radius: 12px; padding: 1rem 1.25rem;
          display: flex; align-items: center; gap: 0.75rem;
          font-size: 0.85rem; font-weight: 600; color: #92400e;
        }

        @media (min-width: 768px) {
          .inicio-header { margin: -2rem -2rem 0 -2rem; }
          .trial-banner { flex-direction: row; align-items: center; }
          .trial-btn { width: auto; white-space: nowrap; }
        }
      `}</style>
    </div>
  );
}
