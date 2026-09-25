import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CaretRight, WhatsappLogo, Copy } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useIsMobile } from "@/hooks/use-mobile";

interface Step {
  key: string;
  label: string;
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
      const todosProdComFoto = temProduto && produtosAtivos.every((p) => p.imagem_url);

      const linkKey = `doonly_cardapio_compartilhado_${userId}`;
      const jaCompartilhou = localStorage.getItem(linkKey) === "1";

      // Logo: pode estar em logo_url (desktop) OU foto_url (mobile) — vale qualquer um
      const temLogo = !!(profileData?.logo_url || profileData?.foto_url);

      // Design escolhido: cardapio_modelo salvo explicitamente (não null)
      const escolheuDesign = !!profileData?.cardapio_modelo;

      const list: Step[] = [
        {
          key: "produto",
          label: "Cadastrar primeiro produto",
          done: temProduto,
          path: "/produtos",
        },
        {
          key: "design",
          label: "Escolher design do cardápio",
          done: escolheuDesign,
          path: "/cardapio-design",
        },
        {
          key: "logo",
          label: "Adicionar logo da loja",
          done: temLogo,
          path: "/cardapio-config",
        },
        {
          key: "descricao",
          label: "Preencher descrição da loja",
          done: !!(profileData?.descricao_loja && profileData.descricao_loja.trim().length > 0),
          path: "/cardapio-config",
        },
        {
          key: "fotos",
          label: "Adicionar foto em todos os produtos",
          done: todosProdComFoto,
          path: "/produtos",
        },
        {
          key: "share",
          label: "Compartilhar o link do cardápio",
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
        <p className="pap-title">Configurar seu cardápio</p>
        <p className="pap-sub">{feitos} de {total} passos concluídos</p>
        <div className="pap-bar"><div className="pap-bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      {steps.map((step, idx) => (
        <button
          key={step.key}
          className={`pap-item ${step.done ? "done" : "todo"}`}
          onClick={() => handleClick(step)}
          disabled={step.done}
        >
          <span className="pap-icon">
            {step.done ? <Check size={13} weight="bold" /> : (idx + 1)}
          </span>
          <span className="pap-txt">{step.label}</span>
          {!step.done && <CaretRight size={12} weight="bold" className="pap-arr" />}
        </button>
      ))}
      <style>{`
        .pap {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .pap-header {
          padding: 14px 16px 10px;
          border-bottom: 1px solid #F5F0F2;
        }
        .pap-title {
          font-size: 13px;
          font-weight: 800;
          color: #2C1219;
          margin: 0 0 2px;
        }
        .pap-sub {
          font-size: 11px;
          color: #6B7280;
          margin: 0 0 8px;
        }
        .pap-bar {
          height: 4px;
          background: #F5F0F2;
          border-radius: 2px;
          overflow: hidden;
        }
        .pap-bar-fill {
          height: 100%;
          background: #16a34a;
          border-radius: 2px;
          transition: width 0.4s ease;
        }
        .pap-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 11px 16px;
          border: none;
          background: transparent;
          font-family: inherit;
          text-align: left;
          border-bottom: 1px solid #F5F0F2;
          cursor: pointer;
        }
        .pap-item:last-child { border-bottom: none; }
        .pap-item:disabled { cursor: default; }
        .pap-item.done .pap-icon {
          background: #DCFCE7;
          color: #16a34a;
        }
        .pap-item.done .pap-txt {
          color: #9CA3AF;
          text-decoration: line-through;
        }
        .pap-item.todo .pap-icon {
          background: #F5F0F2;
          color: #6B7280;
          font-weight: 700;
          font-size: 11px;
        }
        .pap-item.todo:active { background: #FAFAFA; }
        .pap-icon {
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pap-txt {
          flex: 1;
          font-size: 12.5px;
          font-weight: 600;
          color: #2C1219;
          line-height: 1.3;
        }
        .pap-arr { color: #C0C0C0; flex-shrink: 0; }
      `}</style>
    </div>
  );
}
