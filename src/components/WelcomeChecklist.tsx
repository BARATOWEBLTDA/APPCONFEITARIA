import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCircle, Storefront, Package, CookingPot,
  ShoppingBag, ClipboardText, CheckCircle, CaretDown,
  Sparkle,
} from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tags?: string[];
  cta: string;
  path: string;
  done: boolean;
}

export default function WelcomeChecklist({ userId, onAllDone }: { userId: string; onAllDone?: (done: boolean) => void }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100);

  useEffect(() => {
    if (!userId) return;
    checkSteps();
  }, [userId]);

  const checkSteps = async () => {
    try {
      const [profileRes, insumosRes, receitasRes, produtosRes, pedidosRes] = await Promise.all([
        supabase.from("profiles").select("nome, nome_loja, foto_url, telefone").eq("id", userId).single(),
        supabase.from("insumos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("receitas_minhas").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const p = profileRes.data;
      const iconSize = 22;

      setSteps([
        {
          id: "perfil",
          icon: <UserCircle size={iconSize} weight="duotone" />,
          title: "Complete seu perfil",
          desc: "Adicione seu nome e foto. Isso personaliza sua experiência e aparece no seu cardápio digital.",
          tags: ["Nome", "Foto"],
          cta: "Completar perfil",
          path: "/configuracoes",
          done: !!(p?.nome && p?.foto_url),
        },
        {
          id: "loja",
          icon: <Storefront size={iconSize} weight="duotone" />,
          title: "Configure sua confeitaria",
          desc: "Defina o nome da sua confeitaria e WhatsApp para seus clientes entrarem em contato.",
          tags: ["Nome da loja", "WhatsApp"],
          cta: "Configurar loja",
          path: "/cardapio-config",
          done: !!(p?.nome_loja),
        },
        {
          id: "insumos",
          icon: <Package size={iconSize} weight="duotone" />,
          title: "Cadastre seus insumos",
          desc: "Insumos são os ingredientes e embalagens que você compra. Eles são a base para calcular o custo das suas receitas.",
          tags: ["Ingredientes", "Embalagens"],
          cta: "Cadastrar insumos",
          path: "/insumos",
          done: (insumosRes.count ?? 0) > 0,
        },
        {
          id: "receitas",
          icon: <CookingPot size={iconSize} weight="duotone" />,
          title: "Crie sua primeira receita",
          desc: "Monte a ficha técnica dos seus produtos. O Doonly calcula o custo automaticamente com base nos insumos.",
          tags: ["Ficha técnica", "Custo automático"],
          cta: "Criar receita",
          path: "/receitas",
          done: (receitasRes.count ?? 0) > 0,
        },
        {
          id: "produtos",
          icon: <ShoppingBag size={iconSize} weight="duotone" />,
          title: "Monte seu cardápio",
          desc: "Cadastre os produtos que você vende. Eles aparecem no seu cardápio digital para os clientes.",
          tags: ["Produtos", "Cardápio digital"],
          cta: "Adicionar produto",
          path: "/produtos",
          done: (produtosRes.count ?? 0) > 0,
        },
        {
          id: "pedidos",
          icon: <ClipboardText size={iconSize} weight="duotone" />,
          title: "Registre seu primeiro pedido",
          desc: "Controle suas encomendas com datas, valores e status. Tudo organizado em um só lugar.",
          tags: ["Encomendas", "Controle"],
          cta: "Novo pedido",
          path: "/pedidos/novo",
          done: (pedidosRes.count ?? 0) > 0,
        },
      ]);
    } catch (e) {
      console.error("WelcomeChecklist:", e);
    }
    setLoading(false);
  };

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = total > 0 && doneCount === total;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  useEffect(() => { onAllDone?.(allDone); }, [allDone]);

  if (loading || allDone) return null;

  return (
    <div className="wc-root">
      {/* Header */}
      <div className="wc-header">
        <div className="wc-header-icon">
          <Sparkle size={20} weight="fill" />
        </div>
        <div className="wc-header-text">
          <h2>Bem-vindo ao Doonly!</h2>
          <p>Configure seu sistema para começar a usar</p>
        </div>
        <button className="wc-dismiss" onClick={() => setCollapsed(c => !c)} title={collapsed ? "Expandir" : "Recolher"}>
          <CaretDown size={16} weight="bold" className={`wc-collapse-icon ${collapsed ? "" : "wc-collapse-icon--open"}`} />
        </button>
      </div>

      {/* Progress */}
      <div className="wc-progress">
        <div className="wc-progress-info">
          <span className="wc-progress-label">Progresso da configuração</span>
          <span className="wc-progress-pct">{pct}%</span>
        </div>
        <div className="wc-progress-track">
          <div className="wc-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="wc-progress-count">{doneCount} de {total} etapas concluídas</span>
      </div>

      {/* Steps */}
      {!collapsed && (
      <div className="wc-steps">
        {steps.map((step) => {
          const isOpen = openId === step.id;
          return (
            <div key={step.id} className={`wc-step ${step.done ? "wc-step--done" : ""} ${isOpen ? "wc-step--open" : ""}`}>
              <button className="wc-step-header" onClick={() => setOpenId(isOpen ? null : step.id)}>
                <span className={`wc-step-icon ${step.done ? "wc-step-icon--done" : ""}`}>
                  {step.done ? <CheckCircle size={22} weight="fill" /> : step.icon}
                </span>
                <div className="wc-step-meta">
                  <span className="wc-step-title">{step.title}</span>
                  <span className="wc-step-subtitle">
                    {step.done ? "Concluído" : step.tags?.join(" · ")}
                  </span>
                </div>
                {!step.done && (
                  <CaretDown size={16} weight="bold" className={`wc-step-caret ${isOpen ? "wc-step-caret--open" : ""}`} />
                )}
              </button>

              {isOpen && !step.done && (
                <div className="wc-step-body">
                  <p className="wc-step-desc">{step.desc}</p>
                  {step.tags && (
                    <div className="wc-step-tags">
                      {step.tags.map((t) => (
                        <span key={t} className="wc-step-tag">{t}</span>
                      ))}
                    </div>
                  )}
                  <button className="wc-step-cta" onClick={() => navigate(step.path)}>
                    {step.cta}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      <style>{`
        .wc-root {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }

        /* ── Header ── */
        .wc-header {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1.25rem 1.25rem 0;
        }
        .wc-header-icon {
          width: 36px; height: 36px;
          border-radius: var(--radius-md);
          background: var(--primary-gradient);
          color: var(--text-inverse);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .wc-header-text h2 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: var(--fw-bold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .wc-header-text p {
          margin: 2px 0 0;
          font-size: var(--font-helper);
          color: var(--text-muted);
          line-height: 1.4;
        }
        .wc-dismiss {
          margin-left: auto;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color var(--dur-fast), background var(--dur-fast);
          flex-shrink: 0;
        }
        .wc-dismiss:hover {
          color: var(--text-title);
          background: var(--bg-body);
        }
        .wc-collapse-icon {
          transition: transform var(--dur-fast);
        }
        .wc-collapse-icon--open {
          transform: rotate(180deg);
        }

        /* ── Progress ── */
        .wc-progress {
          padding: 1rem 1.25rem;
        }
        .wc-progress-info {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 0.4rem;
        }
        .wc-progress-label {
          font-size: 0.7rem;
          font-weight: var(--fw-bold);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .wc-progress-pct {
          font-size: 0.8rem;
          font-weight: var(--fw-bold);
          color: var(--primary);
        }
        .wc-progress-track {
          width: 100%;
          height: 6px;
          background: var(--bg-body);
          border-radius: 99px;
          overflow: hidden;
        }
        .wc-progress-fill {
          height: 100%;
          background: var(--primary-gradient);
          border-radius: 99px;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .wc-progress-count {
          display: block;
          margin-top: 0.35rem;
          font-size: var(--font-caption);
          color: var(--text-muted);
        }

        /* ── Steps ── */
        .wc-steps {
          display: flex;
          flex-direction: column;
        }
        .wc-step {
          border-top: 1px solid var(--border);
        }
        .wc-step:last-child {
          border-bottom: none;
        }

        /* Step Header (button) */
        .wc-step-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: background var(--dur-fast);
        }
        .wc-step-header:hover {
          background: var(--bg-body);
        }
        .wc-step--done .wc-step-header {
          opacity: 0.7;
        }
        .wc-step--done .wc-step-header:hover {
          opacity: 0.85;
        }

        /* Step icon */
        .wc-step-icon {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          background: var(--bg-subtle);
          color: var(--primary);
          transition: all var(--dur-fast);
        }
        .wc-step-icon--done {
          background: #DCFCE7;
          color: #15803D;
        }

        /* Step meta */
        .wc-step-meta {
          flex: 1;
          min-width: 0;
        }
        .wc-step-title {
          display: block;
          font-size: 0.9rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .wc-step--done .wc-step-title {
          text-decoration: line-through;
          text-decoration-color: var(--text-muted);
        }
        .wc-step-subtitle {
          display: block;
          font-size: var(--font-caption);
          color: var(--text-muted);
          margin-top: 1px;
        }

        /* Caret */
        .wc-step-caret {
          color: var(--text-muted);
          flex-shrink: 0;
          transition: transform var(--dur-fast);
        }
        .wc-step-caret--open {
          transform: rotate(180deg);
        }

        /* Step body (expanded) */
        .wc-step-body {
          padding: 0 1.25rem 1rem 4.25rem;
          animation: wcSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes wcSlide {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .wc-step-desc {
          margin: 0 0 0.75rem;
          font-size: 0.82rem;
          line-height: 1.55;
          color: var(--text-secondary);
        }
        .wc-step-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.85rem;
        }
        .wc-step-tag {
          font-size: 0.72rem;
          font-weight: var(--fw-medium);
          padding: 0.2rem 0.6rem;
          background: var(--bg-subtle);
          color: var(--primary-dark);
          border-radius: var(--radius-sm);
        }
        .wc-step-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 1.1rem;
          background: var(--primary-gradient);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: 0.82rem;
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: opacity var(--dur-fast), transform var(--dur-fast);
        }
        .wc-step-cta:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .wc-step-cta:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
