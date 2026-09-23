import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

interface Step {
  key: string;
  label: string;
  done: boolean;
  path: string;
}

interface Props {
  userId: string | undefined;
  publicado: boolean;
  onShareClick: () => void;
}

/**
 * Passo a passo pra configurar o cardápio. Lê o estado direto do Supabase
 * (não do cache do useProfile) pra evitar falso-positivos. Some quando
 * todos os passos estiverem concluídos.
 */
export default function PassoAPassoCardapio({ userId, publicado, onShareClick }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      // Lê perfil direto (evita cache do useProfile)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("logo_url, descricao_loja")
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

      const list: Step[] = [
        {
          key: "logo",
          label: "Adicionar logo da loja",
          done: !!profileData?.logo_url,
          path: "/cardapio-design",
        },
        {
          key: "descricao",
          label: "Preencher descrição da loja",
          done: !!(profileData?.descricao_loja && profileData.descricao_loja.trim().length > 0),
          path: "/cardapio-config",
        },
        {
          key: "produto",
          label: "Cadastrar primeiro produto",
          done: temProduto,
          path: "/produtos",
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

  const handleClick = (step: Step) => {
    if (step.key === "share") {
      onShareClick();
      // Marca como compartilhado
      if (userId) localStorage.setItem(`doonly_cardapio_compartilhado_${userId}`, "1");
      return;
    }
    navigate(step.path);
  };

  if (loading || !userId) return null;

  // Estado 100% concluído — mostra banner de sucesso
  if (feitos === total) {
    return (
      <div className="pap-done">
        <div className="pap-done-icon"><Check size={18} weight="bold" /></div>
        <div className="pap-done-info">
          <p className="pap-done-t">Cardápio configurado</p>
          <p className="pap-done-s">Tudo pronto. Continue divulgando seu link!</p>
        </div>
        <style>{`
          .pap-done {
            background: linear-gradient(135deg, #16a34a, #15803d);
            color: #fff;
            padding: 12px 14px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 16px;
          }
          .pap-done-icon {
            width: 32px; height: 32px;
            border-radius: 50%;
            background: rgba(255,255,255,0.22);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
          }
          .pap-done-info { flex: 1; }
          .pap-done-t { font-size: 13px; font-weight: 800; margin: 0; }
          .pap-done-s { font-size: 11px; opacity: 0.9; margin: 1px 0 0; }
        `}</style>
      </div>
    );
  }

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
