import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Check, WhatsappLogo, Copy, Storefront, PencilLine, ShoppingBag, Palette, ShareNetwork } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useIsMobile } from "@/hooks/use-mobile";

interface Step {
  key: string;
  label: string;
  desc: string;
  icon: ReactElement;
  done: boolean;
  path: string;
}

interface Props {
  userId: string | undefined;
  publicado: boolean;
  linkCardapio: string;
  onShareClick: () => void;
}

/**
 * Passo a passo pra configurar o cardápio. Lê o estado direto do Supabase
 * (não do cache do useProfile) pra evitar falso-positivos.
 *
 * Estados de UI:
 * 1. Incompleto: lista com progresso
 * 2. Quase pronto (só falta compartilhar): card premium grafite com 2 CTAs
 * 3. 100%: banner verde "cardápio configurado"
 */
export default function PassoAPassoCardapio({ userId, publicado, linkCardapio, onShareClick }: Props) {
  const isMobile = useIsMobile();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      // Lê perfil direto (evita cache do useProfile)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("logo_url, foto_url, descricao_loja, cardapio_modelo")
        .eq("id", userId)
        .single();

      // Conta produtos e produtos sem foto
      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, imagem_url, disponivel")
        .eq("user_id", userId);

      const produtosAtivos = (produtos || []).filter((p) => p.disponivel !== false);
      const temProduto = produtosAtivos.length > 0;

      const linkKey = `doonly_cardapio_compartilhado_${userId}`;
      const jaCompartilhou = localStorage.getItem(linkKey) === "1";

      // Logo: pode estar em logo_url (desktop) OU foto_url (mobile) — vale qualquer um
      const temLogo = !!(profileData?.logo_url || profileData?.foto_url);

      // Design escolhido: cardapio_modelo salvo explicitamente (não null)
      const escolheuDesign = !!profileData?.cardapio_modelo;

      const list: Step[] = [
        {
          key: "logo",
          label: "Adicionar logo da loja",
          desc: "Sua marca em destaque no topo",
          icon: <Storefront size={18} weight="fill" />,
          done: temLogo,
          path: "/cardapio-config",
        },
        {
          key: "descricao",
          label: "Preencher descrição da loja",
          desc: "Conte a história da sua confeitaria",
          icon: <PencilLine size={18} weight="fill" />,
          done: !!(profileData?.descricao_loja && profileData.descricao_loja.trim().length > 0),
          path: "/cardapio-config",
        },
        {
          key: "produto",
          label: "Cadastrar primeiro produto",
          desc: "Adicione com foto e preço",
          icon: <ShoppingBag size={18} weight="fill" />,
          done: temProduto,
          path: "/produtos",
        },
        {
          key: "design",
          label: "Escolher design do cardápio",
          desc: "Padrão ou Editorial",
          icon: <Palette size={18} weight="fill" />,
          done: escolheuDesign,
          path: "/cardapio-design",
        },
        {
          key: "share",
          label: "Compartilhar o link do cardápio",
          desc: "WhatsApp, Instagram, bio",
          icon: <ShareNetwork size={18} weight="fill" />,
          done: jaCompartilhou && publicado,
          path: "__share__",
        },
      ];

      if (!cancelled) {
        setSteps(list);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, publicado]);

  const feitos = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((feitos / total) * 100);

  const marcarCompartilhado = () => {
    if (userId) localStorage.setItem(`doonly_cardapio_compartilhado_${userId}`, "1");
  };

  const handleClick = (step: Step) => {
    if (step.key === "share") {
      onShareClick();
      marcarCompartilhado();
      return;
    }
    navigate(step.path);
  };

  const handleWhatsApp = () => {
    if (!publicado || !linkCardapio) {
      onShareClick();
      return;
    }
    const texto = encodeURIComponent(`Confira o cardápio da minha confeitaria: ${linkCardapio}`);
    window.open(`https://wa.me/?text=${texto}`, "_blank");
    marcarCompartilhado();
    // Força re-render pra atualizar o estado
    setSteps((s) => s.map((st) => st.key === "share" ? { ...st, done: true } : st));
  };

  const handleCopy = async () => {
    if (!linkCardapio) {
      onShareClick();
      return;
    }
    try {
      await navigator.clipboard.writeText(linkCardapio);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      marcarCompartilhado();
      setSteps((s) => s.map((st) => st.key === "share" ? { ...st, done: true } : st));
    } catch {
      onShareClick();
    }
  };

  if (loading || !userId) return null;
  if (!isMobile) return null; // Apenas mobile

  const shareStep = steps.find((s) => s.key === "share");
  const outrosFeitos = steps.filter((s) => s.key !== "share" && s.done).length;
  const outrosTotais = steps.length - 1;
  const soFaltaCompartilhar = outrosFeitos === outrosTotais && shareStep && !shareStep.done;

  // ─── Estado 100% concluído ───
  if (feitos === total) {
    return (
      <div className="pap-done">
        <div className="pap-done-glow" />
        <div className="pap-done-top">
          <div className="pap-done-icon"><Check size={18} weight="bold" /></div>
          <div className="pap-done-info">
            <p className="pap-done-t">Cardápio configurado</p>
            <p className="pap-done-s">Continue divulgando seu link.</p>
          </div>
        </div>
        <div className="pap-done-actions">
          <button className="pap-done-btn pap-done-btn-wa" onClick={handleWhatsApp}>
            <WhatsappLogo size={16} weight="fill" /> WhatsApp
          </button>
          <button className="pap-done-btn pap-done-btn-copy" onClick={handleCopy}>
            <Copy size={15} weight="bold" /> {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
        <style>{`
          .pap-done {
            position: relative;
            background: linear-gradient(135deg, #16a34a, #15803d);
            color: #fff;
            padding: 14px 16px;
            border-radius: 6px;
            margin-bottom: 16px;
            overflow: hidden;
          }
          .pap-done-glow {
            position: absolute;
            top: -30px; right: -30px;
            width: 100px; height: 100px;
            background: radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%);
            pointer-events: none;
          }
          .pap-done-top {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
            position: relative;
          }
          .pap-done-icon {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.22);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .pap-done-info { flex: 1; }
          .pap-done-t { font-size: 13.5px; font-weight: 800; margin: 0; }
          .pap-done-s { font-size: 11px; opacity: 0.9; margin: 1px 0 0; }
          .pap-done-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            position: relative;
          }
          .pap-done-btn {
            padding: 10px;
            font-size: 11.5px;
            font-weight: 800;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-family: inherit;
            transition: transform 0.15s, background 0.15s;
          }
          .pap-done-btn:active { transform: scale(0.97); }
          .pap-done-btn-wa {
            background: #fff;
            color: #15803d;
          }
          .pap-done-btn-wa:hover { background: #F5F5F5; }
          .pap-done-btn-copy {
            background: rgba(255,255,255,0.18);
            color: #fff;
          }
          .pap-done-btn-copy:hover { background: rgba(255,255,255,0.28); }
        `}</style>
      </div>
    );
  }

  // ─── Estado "só falta compartilhar" — premium grafite com 2 CTAs ───
  if (soFaltaCompartilhar) {
    return (
      <div className="pap-share">
        <div className="pap-share-glow" />
        <div className="pap-share-top">
          <div className="pap-share-check"><Check size={11} weight="bold" /></div>
          <span className="pap-share-tag">Pronto</span>
        </div>
        <p className="pap-share-t">Seu cardápio tá no ar</p>
        <p className="pap-share-s">Divulgue e comece a receber pedidos.</p>
        <div className="pap-share-actions">
          <button className="pap-share-btn pap-share-btn-wa" onClick={handleWhatsApp}>
            <WhatsappLogo size={16} weight="fill" /> WhatsApp
          </button>
          <button className="pap-share-btn pap-share-btn-copy" onClick={handleCopy}>
            <Copy size={15} weight="bold" /> {copied ? "Copiado!" : "Copiar link"}
          </button>
        </div>
        <style>{`
          .pap-share {
            position: relative;
            background: linear-gradient(135deg, #2C1219, #4B3D46);
            color: #fff;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 16px;
            overflow: hidden;
          }
          .pap-share-glow {
            position: absolute;
            top: -30px; right: -30px;
            width: 100px; height: 100px;
            background: radial-gradient(circle, rgba(22,163,74,0.35), transparent 70%);
            pointer-events: none;
          }
          .pap-share-top {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
            position: relative;
          }
          .pap-share-check {
            width: 18px; height: 18px;
            border-radius: 50%;
            background: #16a34a;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .pap-share-tag {
            font-size: 10px;
            font-weight: 800;
            color: #86EFAC;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          .pap-share-t {
            font-size: 15px;
            font-weight: 800;
            margin: 0 0 4px;
            position: relative;
          }
          .pap-share-s {
            font-size: 11.5px;
            opacity: 0.75;
            margin: 0 0 14px;
            position: relative;
          }
          .pap-share-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            position: relative;
          }
          .pap-share-btn {
            padding: 10px;
            font-size: 11.5px;
            font-weight: 800;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            font-family: inherit;
            transition: transform 0.15s, background 0.15s;
          }
          .pap-share-btn:active { transform: scale(0.97); }
          .pap-share-btn-wa {
            background: #16a34a;
            color: #fff;
          }
          .pap-share-btn-wa:hover { background: #15803d; }
          .pap-share-btn-copy {
            background: rgba(255,255,255,0.12);
            color: #fff;
          }
          .pap-share-btn-copy:hover { background: rgba(255,255,255,0.18); }
        `}</style>
      </div>
    );
  }

  // ─── Estado padrão: lista de passos com progresso ───
  return (
    <div className="pap">
      <div className="pap-header">
        <p className="pap-title">Configurar cardápio</p>
        <p className="pap-sub">Você tá quase lá!</p>
      </div>
      <div className="pap-progress">
        <span className="pap-progress-num">{feitos}/{total}</span>
        <div className="pap-progress-bar"><div className="pap-progress-fill" style={{ width: `${pct}%` }} /></div>
        <span className="pap-progress-pct">{pct}%</span>
      </div>
      {steps.map((step) => (
        <button
          key={step.key}
          className={`pap-item ${step.done ? "done" : "todo"}`}
          onClick={() => handleClick(step)}
          disabled={step.done}
        >
          <span className="pap-icon">
            {step.done ? <Check size={16} weight="bold" /> : step.icon}
          </span>
          <span className="pap-body">
            <span className="pap-item-t">{step.label}</span>
            <span className="pap-item-d">{step.done ? "Concluído" : step.desc}</span>
          </span>
          {!step.done && <span className="pap-arr">&rarr;</span>}
        </button>
      ))}
      <style>{`
        .pap {
          margin-bottom: 16px;
          padding: 0 2px;
        }
        .pap-header {
          text-align: center;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .pap-title {
          font-size: 20px;
          font-weight: 900;
          color: #2C1219;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
        }
        .pap-sub {
          font-size: 12.5px;
          color: #6B7280;
          margin: 0;
        }
        .pap-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 14px;
          background: #fff;
          border-radius: 10px;
          margin-bottom: 10px;
          border: 1px solid #DCFCE7;
          font-size: 11.5px;
          font-weight: 800;
          color: #16a34a;
        }
        .pap-progress-num, .pap-progress-pct {
          flex-shrink: 0;
        }
        .pap-progress-bar {
          flex: 1;
          height: 6px;
          background: #F0FDF4;
          border-radius: 3px;
          overflow: hidden;
        }
        .pap-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #16a34a, #22c55e);
          transition: width 0.4s ease;
        }
        .pap-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 10px;
          margin-bottom: 8px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .pap-item:last-child { margin-bottom: 0; }
        .pap-item.todo:active {
          transform: scale(0.98);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
        }
        .pap-item.done {
          background: #F0FDF4;
          border-color: #BBF7D0;
          cursor: default;
          box-shadow: none;
        }
        .pap-item:disabled { cursor: default; }
        .pap-icon {
          width: 34px; height: 34px;
          border-radius: 9px;
          background: #FFF5F9;
          color: #E85A8C;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pap-item.done .pap-icon {
          background: #16a34a;
          color: #fff;
        }
        .pap-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .pap-item-t {
          font-size: 13.5px;
          font-weight: 700;
          color: #2C1219;
          line-height: 1.3;
        }
        .pap-item-d {
          font-size: 11px;
          color: #6B7280;
          line-height: 1.3;
        }
        .pap-item.done .pap-item-t {
          color: #15803D;
        }
        .pap-item.done .pap-item-d {
          color: #16a34a;
          font-weight: 600;
        }
        .pap-arr {
          color: #E85A8C;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
