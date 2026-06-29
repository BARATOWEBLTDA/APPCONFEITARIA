import {
  CookingPot, Sparkle, Bell, CreditCard, Megaphone, Star,
} from "@phosphor-icons/react";

const MOCK_UPDATES = [
  {
    id: 1,
    icon: <CookingPot size={18} weight="fill" />,
    color: "#EC4899",
    bg: "#FDF2F8",
    title: "Nova receita da comunidade",
    desc: "Bolo de cenoura com cobertura de brigadeiro foi adicionado à biblioteca.",
    time: "Hoje, 09:12",
  },
  {
    id: 2,
    icon: <Sparkle size={18} weight="fill" />,
    color: "#8B5CF6",
    bg: "#F5F3FF",
    title: "Nova funcionalidade",
    desc: "Agora você pode duplicar receitas com um clique. Experimente!",
    time: "Ontem, 15:30",
  },
  {
    id: 3,
    icon: <Megaphone size={18} weight="fill" />,
    color: "#3d1a24",
    bg: "#FFF1F7",
    title: "Aviso do Doonly",
    desc: "Manutenção programada para domingo às 03h. O sistema ficará fora por 15 minutos.",
    time: "27 Jun, 10:00",
  },
  {
    id: 4,
    icon: <CreditCard size={18} weight="fill" />,
    color: "#15803D",
    bg: "#DCFCE7",
    title: "Assinatura renovada",
    desc: "Seu plano Premium foi renovado com sucesso até 28/07/2026.",
    time: "26 Jun, 08:45",
  },
  {
    id: 5,
    icon: <Star size={18} weight="fill" />,
    color: "#D97706",
    bg: "#FEF3C7",
    title: "Dica do Doonly",
    desc: "Complete sua ficha técnica para ter precificação automática nos seus produtos.",
    time: "25 Jun, 14:20",
  },
];

export default function UpdatesFeed() {
  return (
    <div className="uf-root">
      <div className="uf-header">
        <Bell size={18} weight="fill" />
        <h2>Últimas atualizações</h2>
      </div>

      <div className="uf-list">
        {MOCK_UPDATES.slice(0, 3).map((u) => (
          <div key={u.id} className="uf-item">
            <div className="uf-icon" style={{ background: u.bg, color: u.color }}>
              {u.icon}
            </div>
            <div className="uf-body">
              <p className="uf-title">{u.title}</p>
              <p className="uf-desc">{u.desc}</p>
              <span className="uf-time">{u.time}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .uf-root {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .uf-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1.15rem 1.25rem;
          border-bottom: 1px solid var(--border);
          color: var(--text-title);
        }
        .uf-header h2 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: var(--fw-bold);
        }
        .uf-list {
          display: flex;
          flex-direction: column;
        }
        .uf-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border);
          transition: background var(--dur-fast);
        }
        .uf-item:last-child { border-bottom: none; }
        .uf-item:hover { background: var(--bg-body); }
        .uf-icon {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .uf-body {
          flex: 1;
          min-width: 0;
        }
        .uf-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .uf-desc {
          margin: 3px 0 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .uf-time {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 4px;
          display: block;
        }
      `}</style>
    </div>
  );
}
