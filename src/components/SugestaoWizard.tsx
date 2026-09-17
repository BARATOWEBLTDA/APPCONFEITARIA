/**
 * SugestaoWizard — bottom sheet em 3 passos pra enviar sugestão de melhoria.
 *
 * Passos:
 *  1. Sua ideia (textarea)
 *  2. Onde (área do app — opcional)
 *  3. Envio (confirmação dos dados de contato)
 *
 * Persistência: insert em `public.sugestoes` (SQL fornecido junto com esse componente).
 * Fallback silencioso se tabela não existir (permite deploy antes do SQL rodar).
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Lightbulb, Compass, PaperPlaneTilt, CaretLeft, X, Check } from "@phosphor-icons/react";

interface Props {
  open: boolean;
  onClose: () => void;
  perfil?: { nome?: string; telefone?: string; email?: string };
}

const AREAS = [
  { id: "pedidos", label: "Pedidos e encomendas" },
  { id: "cardapio", label: "Cardápio online" },
  { id: "produtos", label: "Produtos e receitas" },
  { id: "insumos", label: "Insumos e estoque" },
  { id: "financeiro", label: "Financeiro" },
  { id: "clientes", label: "Clientes" },
  { id: "app", label: "Aplicativo em geral" },
  { id: "outro", label: "Outro" },
];

export default function SugestaoWizard({ open, onClose, perfil }: Props) {
  const [passo, setPasso] = useState<1 | 2 | 3>(1);
  const [descricao, setDescricao] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  // Reset quando fecha
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setPasso(1);
        setDescricao("");
        setArea(null);
        setSucesso(false);
        setErro("");
      }, 200);
    }
  }, [open]);

  // Bloqueia scroll do body quando aberto (funciona em iOS Safari)
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      const bodyStyle = document.body.style;
      const prev = {
        overflow: bodyStyle.overflow,
        position: bodyStyle.position,
        top: bodyStyle.top,
        width: bodyStyle.width,
      };
      bodyStyle.overflow = "hidden";
      bodyStyle.position = "fixed";
      bodyStyle.top = `-${scrollY}px`;
      bodyStyle.width = "100%";
      return () => {
        bodyStyle.overflow = prev.overflow;
        bodyStyle.position = prev.position;
        bodyStyle.top = prev.top;
        bodyStyle.width = prev.width;
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const podeAvancarPasso1 = descricao.trim().length >= 5;

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user?.id) throw new Error("Sessão inválida. Faça login novamente.");

      const { error } = await supabase.from("sugestoes").insert({
        user_id: userRes.user.id,
        area: area,
        descricao: descricao.trim(),
        nome: perfil?.nome || null,
        telefone: perfil?.telefone || null,
        email: perfil?.email || null,
        tela_origem: window.location.pathname,
        versao_app: "1.0.0",
      });
      if (error) throw error;
      setSucesso(true);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <>
      <div className="sug-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sug-sheet" role="dialog" aria-modal="true">
        <div className="sug-drag" />

        {/* Header com título */}
        <div className="sug-header">
          <div className="sug-header-icon"><Lightbulb size={18} weight="duotone" /></div>
          <h2 className="sug-header-title">Enviar uma sugestão</h2>
          <button className="sug-close" onClick={onClose} aria-label="Fechar"><X size={20} weight="bold" /></button>
        </div>

        {/* Stepper */}
        {!sucesso && (
          <div className="sug-stepper">
            <div className={`sug-step ${passo >= 1 ? "sug-step--active" : ""}`}>
              <span className="sug-step-dot"><Lightbulb size={14} weight="fill" /></span>
              {passo === 1 && <span className="sug-step-label">Sua ideia</span>}
            </div>
            <span className="sug-step-line" />
            <div className={`sug-step ${passo >= 2 ? "sug-step--active" : ""}`}>
              <span className="sug-step-dot"><Compass size={14} weight="fill" /></span>
              {passo === 2 && <span className="sug-step-label">Onde</span>}
            </div>
            <span className="sug-step-line" />
            <div className={`sug-step ${passo >= 3 ? "sug-step--active" : ""}`}>
              <span className="sug-step-dot"><PaperPlaneTilt size={14} weight="fill" /></span>
              {passo === 3 && <span className="sug-step-label">Envio</span>}
            </div>
          </div>
        )}

        {/* Conteúdo por passo */}
        <div className="sug-body">
          {sucesso ? (
            <div className="sug-success">
              <div className="sug-success-icon"><Check size={36} weight="bold" /></div>
              <h3 className="sug-success-title">Sugestão enviada!</h3>
              <p className="sug-success-desc">Obrigada pela ideia. A equipe vai analisar e considerar em uma próxima versão.</p>
              <button className="sug-btn-primary" onClick={onClose}>Fechar</button>
            </div>
          ) : passo === 1 ? (
            <>
              <p className="sug-help">Conte o que falta ou o que melhoraria no Doonly.</p>
              <textarea
                className="sug-textarea"
                placeholder="Ex.: seria útil poder duplicar uma encomenda que se repete toda semana."
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={6}
                maxLength={2000}
              />
              <div className="sug-chars">{descricao.length}/2000</div>
            </>
          ) : passo === 2 ? (
            <>
              <p className="sug-help">Sobre qual parte do sistema? Se não souber, pode pular.</p>
              <div className="sug-areas">
                {AREAS.map(a => (
                  <button
                    key={a.id}
                    className={`sug-area ${area === a.id ? "sug-area--sel" : ""}`}
                    onClick={() => setArea(a.id === area ? null : a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="sug-help">Confira o que vai junto e envie.</p>
              <div className="sug-review">
                Vão junto: a tela em que você está (<b>Configurações</b>) e a versão do app (<b>1.0.0</b>) — não precisa escrever isso.
              </div>

              <div className="sug-review-block">
                <div className="sug-review-title">Como falamos com você</div>
                <div className="sug-review-sub">Usamos só se a equipe precisar de mais detalhes.</div>

                <div className="sug-review-field">
                  <label>Nome</label>
                  <div className="sug-review-value">{perfil?.nome || "—"}</div>
                </div>
                <div className="sug-review-field">
                  <label>WhatsApp</label>
                  <div className="sug-review-value">{perfil?.telefone || "—"}</div>
                </div>
                <div className="sug-review-field">
                  <label>E-mail</label>
                  <div className="sug-review-value">{perfil?.email || "—"}</div>
                </div>
              </div>

              {erro && <div className="sug-erro">{erro}</div>}
            </>
          )}
        </div>

        {/* Footer com botões */}
        {!sucesso && (
          <div className="sug-footer">
            {passo > 1 && (
              <button className="sug-btn-back" onClick={() => setPasso((p => (p === 3 ? 2 : 1) as 1 | 2))} aria-label="Voltar">
                <CaretLeft size={18} weight="bold" />
              </button>
            )}
            {passo === 1 && (
              <button className="sug-btn-primary" onClick={() => setPasso(2)} disabled={!podeAvancarPasso1}>Continuar</button>
            )}
            {passo === 2 && (
              <button className="sug-btn-primary" onClick={() => setPasso(3)}>Continuar</button>
            )}
            {passo === 3 && (
              <button className="sug-btn-primary" onClick={enviar} disabled={enviando}>
                {enviando ? <span className="sug-spin" /> : "Enviar sugestão"}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .sug-backdrop {
          position: fixed; inset: 0;
          background: rgba(20, 12, 18, 0.5);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 100000;
          animation: sugFade 0.2s ease;
          touch-action: none;
          overscroll-behavior: contain;
        }
        @keyframes sugFade { from { opacity: 0; } to { opacity: 1; } }
        .sug-sheet {
          position: fixed;
          left: 0; right: 0; bottom: 0;
          background: #fff;
          border-radius: 20px 20px 0 0;
          z-index: 100001;
          max-height: 92vh;
          display: flex;
          flex-direction: column;
          animation: sugSlide 0.28s cubic-bezier(0.22, 1, 0.36, 1);
          padding-bottom: env(safe-area-inset-bottom);
          font-family: var(--font-base), -apple-system, sans-serif;
        }
        @keyframes sugSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (min-width: 768px) {
          .sug-sheet { left: 50%; right: auto; bottom: 20px; transform: translateX(-50%); width: 420px; border-radius: 20px; }
        }
        .sug-drag {
          width: 40px; height: 4px;
          background: #D3D1C7;
          border-radius: 999px;
          margin: 10px auto 6px;
          flex-shrink: 0;
        }
        .sug-header {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 20px 14px;
          border-bottom: 1px solid #F0EBED;
          flex-shrink: 0;
        }
        .sug-header-icon {
          width: 32px; height: 32px;
          border-radius: 10px;
          background: #FEF0DF;
          color: #854F0B;
          display: flex; align-items: center; justify-content: center;
        }
        .sug-header-title {
          flex: 1;
          font-size: 17px;
          font-weight: 800;
          color: #2C2C2A;
          margin: 0;
          letter-spacing: -0.01em;
        }
        .sug-close {
          all: unset;
          cursor: pointer;
          color: #888780;
          padding: 4px;
          border-radius: 8px;
        }
        .sug-close:hover { background: #F5F3EF; }

        .sug-stepper {
          display: flex; align-items: center; justify-content: center;
          gap: 6px;
          padding: 16px 20px 10px;
          flex-shrink: 0;
        }
        .sug-step { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .sug-step-dot {
          width: 30px; height: 30px;
          border-radius: 50%;
          background: #F0EBED;
          color: #B4B2A9;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s ease;
        }
        .sug-step--active .sug-step-dot { background: #E85A8C; color: #fff; }
        .sug-step-label { font-size: 11px; font-weight: 700; color: #2C2C2A; letter-spacing: -0.01em; }
        .sug-step-line {
          width: 32px; height: 2px;
          background: #E8E5DC;
          margin: 0 2px;
          margin-bottom: 15px;
        }

        .sug-body {
          flex: 1;
          overflow-y: auto;
          padding: 8px 20px 20px;
        }
        .sug-help {
          font-size: 13.5px;
          color: #5F5E5A;
          margin: 8px 0 14px;
          line-height: 1.5;
        }

        .sug-textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #E8E5DC;
          border-radius: 12px;
          padding: 14px;
          font-size: 14px;
          font-family: inherit;
          color: #2C2C2A;
          resize: none;
          outline: none;
          transition: border-color 0.15s ease;
          min-height: 140px;
          background: #FAF8F5;
        }
        .sug-textarea:focus { border-color: #E85A8C; background: #fff; }
        .sug-textarea::placeholder { color: #B4B2A9; }
        .sug-chars {
          text-align: right;
          font-size: 11px;
          color: #B4B2A9;
          margin-top: 4px;
        }

        .sug-areas {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .sug-area {
          all: unset;
          box-sizing: border-box;
          padding: 12px 14px;
          background: #FAF8F5;
          border: 1px solid #E8E5DC;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: #2C2C2A;
          text-align: left;
          cursor: pointer;
          line-height: 1.3;
          transition: all 0.15s ease;
        }
        .sug-area:hover { background: #FCE0E9; border-color: #F4C0D1; }
        .sug-area--sel {
          background: #E85A8C;
          color: #fff;
          border-color: #E85A8C;
        }
        .sug-area--sel:hover { background: #C33A6E; }

        .sug-review {
          background: #FAF8F5;
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 12.5px;
          color: #5F5E5A;
          line-height: 1.5;
          margin-bottom: 16px;
        }
        .sug-review-block {
          border-top: 1px solid #F0EBED;
          padding-top: 14px;
        }
        .sug-review-title {
          font-size: 13px;
          font-weight: 800;
          color: #2C2C2A;
          margin-bottom: 3px;
        }
        .sug-review-sub {
          font-size: 12px;
          color: #888780;
          margin-bottom: 12px;
        }
        .sug-review-field {
          margin-bottom: 10px;
        }
        .sug-review-field label {
          display: block;
          font-size: 11px;
          color: #888780;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .sug-review-value {
          padding: 10px 14px;
          background: #FAF8F5;
          border: 1px solid #E8E5DC;
          border-radius: 10px;
          font-size: 13.5px;
          color: #2C2C2A;
          font-weight: 500;
        }

        .sug-erro {
          background: #FEE2E2;
          color: #B91C1C;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 12.5px;
          margin-top: 12px;
        }

        .sug-footer {
          display: flex; align-items: center; gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #F0EBED;
          flex-shrink: 0;
        }
        .sug-btn-back {
          all: unset;
          width: 44px; height: 44px;
          border-radius: 12px;
          background: #F5F3EF;
          color: #2C2C2A;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }
        .sug-btn-back:hover { background: #E8E5DC; }
        .sug-btn-primary {
          all: unset;
          box-sizing: border-box;
          flex: 1;
          text-align: center;
          padding: 13px;
          background: #E85A8C;
          color: #fff;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .sug-btn-primary:hover:not(:disabled) { background: #C33A6E; }
        .sug-btn-primary:disabled {
          background: #E8E5DC;
          color: #B4B2A9;
          cursor: not-allowed;
        }
        .sug-spin {
          display: inline-block;
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: sugSpin 0.7s linear infinite;
        }
        @keyframes sugSpin { to { transform: rotate(360deg); } }

        /* Sucesso */
        .sug-success {
          text-align: center;
          padding: 28px 20px 12px;
        }
        .sug-success-icon {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: #DCFCE7;
          color: #166534;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .sug-success-title {
          font-size: 20px;
          font-weight: 800;
          color: #2C2C2A;
          margin: 0 0 8px;
          letter-spacing: -0.02em;
        }
        .sug-success-desc {
          font-size: 13.5px;
          color: #5F5E5A;
          margin: 0 0 24px;
          line-height: 1.5;
        }
      `}</style>
    </>,
    document.body
  );
}
