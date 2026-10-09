import { useEffect, useState, type ReactElement } from "react";
import { lerPassos, marcarCompartilhado as marcarCompartilhadoLib } from "@/lib/primeirosPassos";
import { useNavigate } from "react-router-dom";
import { Eye, Check, WhatsappLogo, Copy, Storefront, PencilLine, ShoppingBag, Palette, ShareNetwork } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/apiFetch";
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
  /** Visão geral do computador: quando tudo está pronto, não mostra o cartão "Cardápio configurado" (ela tem o próprio) */
  esconderQuandoCompleto?: boolean;
  /** Avisa se o passo a passo terminou (undefined enquanto carrega) */
  onEstado?: (completo: boolean) => void;
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
export default function PassoAPassoCardapio({ userId, publicado, linkCardapio, onShareClick, esconderQuandoCompleto, onEstado }: Props) {
  const isMobile = useIsMobile();
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // Passos 1 e 2 são preenchidos dentro do próprio card
  const [nomeLoja, setNomeLoja] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [aviso, setAviso] = useState<{ txt: string; tipo: "ok" | "err" } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      // Lê perfil direto (evita cache do useProfile)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("logo_url, foto_url, descricao_loja, cardapio_modelo, nome_loja")
        .eq("id", userId)
        .single();

      // Conta produtos e produtos sem foto
      const { data: produtos } = await supabase
        .from("produtos")
        .select("id, imagem_url, disponivel")
        .eq("user_id", userId);

      const produtosAtivos = (produtos || []).filter((p) => p.disponivel !== false);
      const temProduto = produtosAtivos.length > 0;

      // Regra única com os Primeiros passos do Início (guardado no banco, vale em qualquer aparelho)
      const jaCompartilhou = (await lerPassos(userId)).compartilhou;

      // Design escolhido: marcado quando ela mexe na tela de Design (design_escolhido).
      // cardapio_modelo não serve: o banco já cria a conta com 'padrao' preenchido.
      const { data: designData, error: designErr } = await supabase
        .from("profiles")
        .select("design_escolhido")
        .eq("id", userId)
        .single();
      const escolheuDesign = designErr ? false : !!(designData as any)?.design_escolhido;

      const list: Step[] = [
        {
          key: "nome_loja",
          label: "Preencher nome da loja",
          desc: "O nome que os clientes vão ver no topo do cardápio.",
          icon: <Storefront size={18} weight="fill" />,
          done: !!(profileData?.nome_loja && profileData.nome_loja.trim().length > 0),
          path: "/cardapio-config",
        },
        {
          key: "descricao",
          label: "Preencher descrição da loja",
          desc: "É a primeira coisa que o cliente lê no seu cardápio. Escreva ou peça pra IA.",
          icon: <PencilLine size={18} weight="fill" />,
          done: !!(profileData?.descricao_loja && profileData.descricao_loja.trim().length > 0),
          path: "/cardapio-config",
        },
        {
          key: "design",
          label: "Escolher design do cardápio",
          desc: "Escolha o modelo, as cores e coloque o seu logo",
          icon: <Palette size={18} weight="fill" />,
          done: escolheuDesign,
          path: "/cardapio-design",
        },
        {
          key: "produto",
          label: "Cadastrar primeiro produto",
          desc: "Adicione foto, nome e preço — fotos boas vendem 3x mais",
          icon: <ShoppingBag size={18} weight="fill" />,
          done: temProduto,
          path: "/produtos",
        },
        {
          key: "share",
          label: "Compartilhar o link",
          desc: "Divulgue no WhatsApp, Instagram, bio",
          icon: <ShareNetwork size={18} weight="fill" />,
          done: jaCompartilhou && publicado,
          path: "__share__",
        },
      ];

      if (!cancelled) {
        setSteps(list);
        setNomeLoja(profileData?.nome_loja || "");
        setDescDraft(profileData?.descricao_loja || "");
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, publicado]);

  const feitos = steps.filter((s) => s.done).length;
  const total = steps.length;
  const completo = total > 0 && feitos === total;
  useEffect(() => { if (total > 0) onEstado?.(completo); }, [completo, total]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = total === 0 ? 0 : Math.round((feitos / total) * 100);

  const mostrarAviso = (txt: string, tipo: "ok" | "err" = "ok") => {
    setAviso({ txt, tipo });
    window.setTimeout(() => setAviso(null), 3000);
  };

  const concluirPasso = (key: string) =>
    setSteps((s) => s.map((st) => (st.key === key ? { ...st, done: true } : st)));

  const salvarNome = async () => {
    const nome = nomeLoja.trim();
    if (!userId || !nome) return;
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({ nome_loja: nome }).eq("id", userId);
    setSalvando(false);
    if (error) return mostrarAviso("Não foi possível salvar. Tente de novo.", "err");
    concluirPasso("nome_loja");
    mostrarAviso("Nome da loja salvo");
  };

  const salvarDescricao = async () => {
    const desc = descDraft.trim();
    if (!userId || !desc) return;
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({ descricao_loja: desc }).eq("id", userId);
    setSalvando(false);
    if (error) return mostrarAviso("Não foi possível salvar. Tente de novo.", "err");
    concluirPasso("descricao");
    mostrarAviso("Descrição salva");
  };

  const gerarDescricao = async () => {
    if (!nomeLoja.trim()) return;
    setGerando(true);
    try {
      const res = await apiFetch("/api/gerar-descricao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Crie uma descrição curta e atraente para uma confeitaria chamada "${nomeLoja.trim()}". Máximo 150 caracteres, português brasileiro, transmita carinho e qualidade. Retorne APENAS a descrição, sem aspas.`,
        }),
      });
      const data = await res.json();
      const texto = data.content?.[0]?.text?.trim();
      if (texto) setDescDraft(texto.slice(0, 200));
      else mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    } catch {
      mostrarAviso("A IA não respondeu. Tente de novo.", "err");
    }
    setGerando(false);
  };

  const CTA_POR_PASSO: Record<string, string> = {
    produto: "Cadastrar produto",
    design: "Escolher design",
    share: "Compartilhar link",
  };

  // Guarda no banco também (regra única com os Primeiros passos do Início)
  const marcarCompartilhado = () => marcarCompartilhadoLib(userId);

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
  // Antes aparecia só no celular: no computador não havia como copiar, divulgar ou abrir o link (30/09)
  void isMobile;
  const linkCurto = (linkCardapio || "").replace(/^https?:\/\//, "");
  const verCardapio = () => { if (linkCardapio) window.open(linkCardapio, "_blank", "noopener,noreferrer"); };

  const shareStep = steps.find((s) => s.key === "share");
  const outrosFeitos = steps.filter((s) => s.key !== "share" && s.done).length;
  const outrosTotais = steps.length - 1;
  const soFaltaCompartilhar = outrosFeitos === outrosTotais && shareStep && !shareStep.done;

  // ─── Estado 100% concluído ───
  if (feitos === total && esconderQuandoCompleto) return null;
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
          <button className="pap-done-btn pap-done-btn-copy" onClick={verCardapio}>
            <Eye size={15} weight="bold" /> Ver
          </button>
        </div>
        {linkCurto && <p className="pap-link">{linkCurto}</p>}
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
          .pap-done-s { font-size: 12px; opacity: 0.9; margin: 1px 0 0; }
          .pap-share-btn, .pap-done-btn { white-space: nowrap; }
          @media (max-width: 400px) { .pap-share-actions, .pap-done-actions { gap: 6px !important; } .pap-share-btn, .pap-done-btn { font-size: 12px !important; padding-left: 8px !important; padding-right: 8px !important; } }
          .pap-link { position: relative; margin: 10px 0 0; font-size: 12px; color: rgba(255,255,255,.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .pap-done-actions > button:last-child { flex: 0 0 auto !important; padding-left: 14px !important; padding-right: 14px !important; }
          .pap-done-actions {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 8px;
            position: relative;
          }
          .pap-done-btn {
            padding: 10px;
            font-size: 13px;
            font-weight: 700;
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
          <button className="pap-share-btn pap-share-btn-copy pap-share-btn-ver" onClick={verCardapio} aria-label="Ver cardápio">
            <Eye size={15} weight="bold" /> Ver
          </button>
        </div>
        {linkCurto && <p className="pap-link">{linkCurto}</p>}
        <style>{`
          .pap-share-btn, .pap-done-btn { white-space: nowrap; }
          @media (max-width: 400px) { .pap-share-actions, .pap-done-actions { gap: 6px !important; } .pap-share-btn, .pap-done-btn { font-size: 12px !important; padding-left: 8px !important; padding-right: 8px !important; } }
          .pap-link { position: relative; margin: 10px 0 0; font-size: 12px; color: rgba(255,255,255,.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .pap-share-btn-ver { flex: 0 0 auto !important; padding-left: 14px !important; padding-right: 14px !important; }
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
            font-size: 12px;
            font-weight: 700;
            color: #86EFAC;
            letter-spacing: 0.06em;
          }
          .pap-share-t {
            font-size: 15px;
            font-weight: 800;
            margin: 0 0 4px;
            position: relative;
          }
          .pap-share-s {
            font-size: 13px;
            opacity: 0.75;
            margin: 0 0 14px;
            position: relative;
          }
          .pap-share-actions {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 8px;
            position: relative;
          }
          .pap-share-btn {
            padding: 10px;
            font-size: 13px;
            font-weight: 700;
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

  // ─── Estado padrão: hero destaque + lista compacta ───
  // Encontra o próximo passo pendente (primeiro da lista que não está done)
  const proximoPasso = steps.find((s) => !s.done);

  return (
    <div className="pap">
      <div className="pap-header">
        <p className="pap-title">Configurar cardápio</p>
        <p className="pap-sub">Vamos montar juntos</p>
      </div>

      <div className="pap-progress">
        <span className="pap-progress-num">{feitos}/{total}</span>
        <div className="pap-progress-bar"><div className="pap-progress-fill" style={{ width: `${pct}%` }} /></div>
        <span className="pap-progress-pct">{pct}%</span>
      </div>

      {aviso && <p className={`pap-aviso pap-aviso--${aviso.tipo}`}>{aviso.txt}</p>}

      {/* Hero destaque do próximo passo */}
      {proximoPasso && (
        <div className="pap-hero">
          <div className="pap-hero-glow" />
          <div className="pap-hero-content">
            <p className="pap-hero-eyebrow">Passo {steps.indexOf(proximoPasso) + 1} de {total}</p>
            <p className="pap-hero-title">
              {proximoPasso.key === "nome_loja" ? "Nome da loja" : proximoPasso.key === "descricao" ? "Descrição da loja" : proximoPasso.label}
            </p>
            <p className="pap-hero-desc">{proximoPasso.desc}</p>

            {proximoPasso.key === "nome_loja" && (
              <>
                <input
                  className="pap-in"
                  value={nomeLoja}
                  maxLength={60}
                  placeholder="Ex: Doce Formiga Confeitaria"
                  onChange={(e) => setNomeLoja(e.target.value)}
                  aria-label="Nome da loja"
                />
                <div className="pap-row">
                  <button className="pap-btn-save" onClick={salvarNome} disabled={salvando || !nomeLoja.trim()}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}

            {proximoPasso.key === "descricao" && (
              <>
                <div className="pap-ta-wrap">
                  <textarea
                    className="pap-ta"
                    value={descDraft}
                    maxLength={200}
                    placeholder="Ex: Doces artesanais feitos com carinho e ingredientes selecionados."
                    onChange={(e) => setDescDraft(e.target.value)}
                    aria-label="Descrição da loja"
                  />
                  <span className="pap-ta-count">{descDraft.length}/200</span>
                </div>
                <div className="pap-row">
                  <button className="pap-btn-ia" onClick={gerarDescricao} disabled={gerando || salvando || !nomeLoja.trim()}>
                    {gerando ? "Gerando..." : "Gerar com IA"}
                  </button>
                  <button className="pap-btn-save" onClick={salvarDescricao} disabled={salvando || gerando || !descDraft.trim()}>
                    {salvando ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </>
            )}

            {proximoPasso.key !== "nome_loja" && proximoPasso.key !== "descricao" && (
              <button className="pap-hero-cta" onClick={() => handleClick(proximoPasso)}>
                {CTA_POR_PASSO[proximoPasso.key] || "Começar agora"} <span style={{ marginLeft: 4 }}>&rarr;</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista compacta dos outros passos */}
      <p className="pap-list-title">Todos os passos</p>
      {steps.map((step, idx) => {
        const isNext = step === proximoPasso;
        return (
          <button
            key={step.key}
            className={`pap-item ${step.done ? "done" : isNext ? "next" : "todo"}`}
            onClick={() => handleClick(step)}
            disabled={step.done}
          >
            <span className="pap-item-ic">
              {step.done ? <Check size={11} weight="bold" /> : (idx + 1)}
            </span>
            <span className="pap-item-t">{step.label}</span>
            {isNext && <span className="pap-item-tag">Agora</span>}
          </button>
        );
      })}

      <style>{`
        .pap {
          margin-bottom: 16px;
        }
        .pap-header {
          text-align: center;
          margin-bottom: 12px;
          padding: 0 4px;
        }
        .pap-title {
          font-size: 20px;
          font-weight: 800;
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
          background: #F0FDF4;
          border-radius: 10px;
          margin-bottom: 14px;
          font-size: 13px;
          font-weight: 700;
          color: #16a34a;
        }
        .pap-progress-bar {
          flex: 1;
          height: 6px;
          background: #DCFCE7;
          border-radius: 3px;
          overflow: hidden;
        }
        .pap-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #16a34a, #22c55e);
          transition: width 0.4s ease;
        }

        /* Hero destaque - GRAFITE ESCURO pra não competir com rosa da página */
        .pap-hero {
          position: relative;
          display: block;
          width: 100%;
          padding: 20px 18px;
          background: linear-gradient(135deg, #2C1219 0%, #4B2334 100%);
          color: #fff;
          border: none;
          border-radius: 14px;
          margin-bottom: 14px;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(44,18,25,0.25);
          text-align: left;
          font-family: inherit;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .pap-hero-glow {
          position: absolute;
          top: -30px; right: -30px;
          width: 140px; height: 140px;
          background: radial-gradient(circle, rgba(232,90,140,0.28), transparent 70%);
          pointer-events: none;
        }
        .pap-hero-content {
          position: relative;
          z-index: 2;
        }
        .pap-hero-eyebrow {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #F9A8C9;
          margin: 0 0 6px;
        }
        .pap-hero-title {
          font-size: 17px;
          font-weight: 800;
          color: #fff;
          margin: 0 0 6px;
          letter-spacing: -0.01em;
          line-height: 1.25;
        }
        .pap-hero-desc {
          font-size: 12.5px;
          line-height: 1.5;
          color: rgba(255,255,255,0.75);
          margin: 0 0 14px;
        }
        .pap-hero-cta {
          display: inline-flex;
          align-items: center;
          padding: 11px 18px;
          background: #fff;
          color: #2C1219;
          border: none;
          border-radius: 10px;
          font-family: inherit;
          font-size: 13.5px;
          font-weight: 800;
          cursor: pointer;
        }
        .pap-hero-cta:active { transform: scale(0.98); }
        .pap-in, .pap-ta {
          width: 100%; box-sizing: border-box; border: none; border-radius: 10px; background: #fff;
          font-family: inherit; font-size: 14px; color: #2C1219;
        }
        .pap-in { height: 44px; padding: 0 12px; }
        .pap-ta { min-height: 92px; resize: none; padding: 11px 12px 22px; line-height: 1.45; display: block; }
        .pap-in:focus, .pap-ta:focus { outline: 2px solid #F9A8C9; outline-offset: 0; }
        .pap-in::placeholder, .pap-ta::placeholder { color: #A8A0A4; }
        .pap-ta-wrap { position: relative; }
        .pap-ta-count { position: absolute; right: 10px; bottom: 7px; font-size: 12px; color: #9CA3AF; }
        .pap-row { display: flex; gap: 8px; margin-top: 10px; }
        .pap-btn-ia, .pap-btn-save {
          flex: 1; height: 42px; border-radius: 10px; cursor: pointer;
          font-family: inherit; font-size: 13.5px; font-weight: 700;
        }
        .pap-btn-ia { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .pap-btn-save { background: #fff; color: #2C1219; border: none; }
        .pap-btn-ia:disabled, .pap-btn-save:disabled { opacity: 0.5; cursor: default; }
        .pap-aviso { margin: 0 0 10px; padding: 9px 12px; border-radius: 10px; font-size: 12.5px; font-weight: 700; }
        .pap-aviso--ok { background: #DCFCE7; color: #15803D; }
        .pap-aviso--err { background: #FEE2E2; color: #B91C1C; }

        /* Lista compacta */
        .pap-list-title {
          font-size: 12px;
          font-weight: 800;
          color: #6B7280;
          letter-spacing: 0.08em;
          margin: 0 4px 8px;
        }
        .pap-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 8px;
          margin-bottom: 6px;
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          font-size: 12.5px;
        }
        .pap-item:last-child { margin-bottom: 0; }
        .pap-item.done {
          background: transparent;
          border-color: transparent;
          cursor: default;
        }
        .pap-item.done .pap-item-t {
          color: #6B7280;
          text-decoration: line-through;
        }
        .pap-item.next {
          border-color: #2C1219;
          background: #fff;
        }
        .pap-item.next .pap-item-t {
          font-weight: 800;
        }
        .pap-item:disabled { cursor: default; }
        .pap-item.todo:active { transform: scale(0.98); }
        .pap-item.next:active { transform: scale(0.98); }
        .pap-item-ic {
          width: 22px; height: 22px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          flex-shrink: 0;
          background: #F5F0F2;
          color: #6B7280;
        }
        .pap-item.done .pap-item-ic {
          background: #16a34a;
          color: #fff;
        }
        .pap-item.next .pap-item-ic {
          background: #2C1219;
          color: #fff;
        }
        .pap-item-t {
          flex: 1;
          font-weight: 600;
          color: #2C1219;
          line-height: 1.3;
        }
        .pap-item-tag {
          font-size: 12px;
          font-weight: 700;
          color: #2C1219;
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
