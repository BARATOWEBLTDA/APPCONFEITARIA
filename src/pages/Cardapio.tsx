import { useNavigate } from "react-router-dom";
import type { ReactElement } from "react";
import {
  ChartBar, Eye, Storefront, Sliders, PaintBrush, Tag,
  Share, Percent, ForkKnife,
} from "@phosphor-icons/react";
import { useProfile } from "@/hooks/useProfile";

/**
 * Hub da seção Cardápio.
 *
 * ⚠️ Versão placeholder (Entrega 1 da Proposta D).
 * Próxima entrega: transformar em hub completo com métricas de visitas,
 * vendas online, e botão de compartilhar nativo destacado.
 */
export default function Cardapio() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const slug = profile?.slug || "";
  const linkCardapio = slug ? `doonly.com.br/${slug}` : "Configure seu cardápio";

  const handleShare = async () => {
    if (!slug) {
      navigate("/cardapio-config");
      return;
    }
    const url = `https://${linkCardapio}`;
    const texto = `Confira o cardápio da minha confeitaria: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Meu Cardápio", text: texto, url });
      } catch {
        // usuário cancelou — sem ação
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copiado!");
    }
  };

  const sections: Array<{
    label: string;
    desc: string;
    icon: ReactElement;
    path: string;
  }> = [
    {
      label: "Visão Geral",
      desc: "Status do cardápio e atalhos",
      icon: <ChartBar size={22} weight="duotone" />,
      path: "/cardapio-resumo",
    },
    {
      label: "Visualizar",
      desc: "Veja como o cliente vê",
      icon: <Eye size={22} weight="duotone" />,
      path: "/cardapio-preview",
    },
    {
      label: "Produtos",
      desc: "O que aparece na vitrine",
      icon: <Storefront size={22} weight="duotone" />,
      path: "/produtos",
    },
    {
      label: "Categorias",
      desc: "Organize o catálogo",
      icon: <ForkKnife size={22} weight="duotone" />,
      path: "/categorias",
    },
    {
      label: "Promoções",
      desc: "Descontos ativos",
      icon: <Percent size={22} weight="duotone" />,
      path: "/promocoes",
    },
    {
      label: "Aparência",
      desc: "Cores, banner e tema",
      icon: <PaintBrush size={22} weight="duotone" />,
      path: "/cardapio-design",
    },
    {
      label: "Configurações",
      desc: "Dados e identidade",
      icon: <Sliders size={22} weight="duotone" />,
      path: "/cardapio-config",
    },
    {
      label: "Entrega e Pagamento",
      desc: "Frete, pix, formas de pagar",
      icon: <Tag size={22} weight="duotone" />,
      path: "/checkout-config",
    },
  ];

  return (
    <div className="cardapio-hub">
      {/* Header */}
      <div className="ch-header">
        <h1 className="ch-title">Cardápio</h1>
        <p className="ch-sub">Gerencie sua vitrine online</p>
      </div>

      {/* Card destaque: link + compartilhar */}
      <div className="ch-link-card">
        <div className="ch-link-info">
          <p className="ch-link-label">Seu link</p>
          <p className="ch-link-url">{linkCardapio}</p>
        </div>
        <button className="ch-share-btn" onClick={handleShare} aria-label="Compartilhar cardápio">
          <Share size={18} weight="bold" />
          <span>Compartilhar</span>
        </button>
      </div>

      {/* Grid de sub-seções */}
      <div className="ch-grid">
        {sections.map((s) => (
          <button
            key={s.path}
            className="ch-tile"
            onClick={() => navigate(s.path)}
          >
            <div className="ch-tile-icon">{s.icon}</div>
            <div className="ch-tile-body">
              <p className="ch-tile-label">{s.label}</p>
              <p className="ch-tile-desc">{s.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .cardapio-hub {
          font-family: 'Geist', sans-serif;
          padding: 1.25rem 1rem 6rem;
          display: flex; flex-direction: column; gap: 1.1rem;
          max-width: 980px; margin: 0 auto;
        }
        .ch-header { display: flex; flex-direction: column; gap: 4px; }
        .ch-title { font-size: 1.6rem; font-weight: 800; color: var(--text-title, #431524); margin: 0; letter-spacing: -0.02em; }
        .ch-sub { font-size: 0.88rem; color: var(--text-secondary, #6E3548); margin: 0; }

        .ch-link-card {
          display: flex; align-items: center; gap: 0.85rem;
          padding: 1rem 1.1rem;
          background: linear-gradient(135deg, #3d1a24 0%, #6E3548 100%);
          border-radius: 16px;
          box-shadow: 0 8px 24px rgba(61,26,36,0.25);
          color: #fff;
        }
        .ch-link-info { flex: 1; min-width: 0; }
        .ch-link-label {
          font-size: 0.66rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          opacity: 0.7; margin: 0 0 3px;
        }
        .ch-link-url {
          font-size: 0.95rem; font-weight: 700;
          margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ch-share-btn {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: #fff; color: #3d1a24;
          border: none; border-radius: 10px;
          padding: 0.6rem 0.9rem;
          font-family: inherit; font-size: 0.82rem; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          transition: transform 0.15s ease;
          flex-shrink: 0;
        }
        .ch-share-btn:hover { transform: translateY(-1px); }
        @media (max-width: 600px) {
          .ch-share-btn span { display: none; }
          .ch-share-btn { padding: 0.6rem 0.7rem; }
        }

        .ch-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 0.7rem;
        }
        .ch-tile {
          display: flex; align-items: center; gap: 0.85rem;
          padding: 0.95rem 1rem;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border, #E9E9EE);
          border-radius: 14px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          transition: all 0.15s ease;
        }
        .ch-tile:hover {
          transform: translateY(-1px);
          border-color: #3d1a24;
          box-shadow: 0 6px 16px rgba(61,26,36,0.08);
        }
        .ch-tile-icon {
          width: 42px; height: 42px;
          border-radius: 11px;
          background: var(--primary-light, #FFF1F7);
          color: #3d1a24;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .ch-tile-body { min-width: 0; }
        .ch-tile-label {
          font-size: 0.92rem; font-weight: 700;
          color: var(--text-title, #1F2937);
          margin: 0 0 2px;
        }
        .ch-tile-desc {
          font-size: 0.74rem;
          color: var(--text-muted, #9CA3AF);
          margin: 0;
          line-height: 1.3;
        }
      `}</style>
    </div>
  );
}
