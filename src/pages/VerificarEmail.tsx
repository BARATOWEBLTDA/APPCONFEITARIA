import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";

// ─────────────────────────────────────────────────────────────
// Página de callback do link de verificação de email.
//
// Fluxo:
// 1. Confeiteira clica no link do email do Supabase.
// 2. O link redireciona para /verificar-email com um code na URL.
// 3. Trocamos o code por uma sessão via exchangeCodeForSession.
// 4. Se der certo → mostra sucesso + redireciona pra /inicio em 2.5s.
// 5. Se falhar (link expirado ou já usado) → mostra erro + CTA de reenviar.
//
// Também suporta o formato antigo com token_hash na query string,
// mantendo compat com links já enviados durante deploy.
// ─────────────────────────────────────────────────────────────

type Status = "loading" | "success" | "error";

export default function VerificarEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const bgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  // ── Fundo animado (mesmo padrão das outras telas de auth) ──
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    const animate = () => {
      timeRef.current += 0.003;
      const t = timeRef.current;
      const angle = 120 + 20 * Math.sin(t);
      if (bgRef.current) {
        bgRef.current.style.background = `linear-gradient(${angle}deg, var(--primary) 0%, var(--primary-dark) 50%, var(--text-muted) 100%)`;
      }
      currentRef.current.x += (mouseRef.current.x - currentRef.current.x) * 0.06;
      currentRef.current.y += (mouseRef.current.y - currentRef.current.y) * 0.06;
      if (glowRef.current) {
        glowRef.current.style.left = `${currentRef.current.x}px`;
        glowRef.current.style.top = `${currentRef.current.y}px`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Processa o callback do email ────────────────────────────
  useEffect(() => {
    const verify = async () => {
      try {
        // Formato novo (PKCE): ?code=xxx
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Formato antigo/hash: #access_token=xxx&refresh_token=yyy&type=signup
        // O Supabase SDK v2 processa automaticamente ao carregar a página.
        // Verificamos a sessão após um pequeno delay pra dar tempo do SDK processar.
        await new Promise(r => setTimeout(r, 300));
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Formato token_hash (fluxo OTP): ?token_hash=xxx&type=signup
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as any,
          });
          if (error) throw error;
          setStatus("success");
          setTimeout(() => navigate("/inicio"), 2500);
          return;
        }

        // Nenhum parâmetro reconhecido
        throw new Error("Link inválido ou expirado.");
      } catch (err: any) {
        const msg = err?.message || "";
        if (/expired|invalid/i.test(msg)) {
          setErrorMsg("O link expirou ou já foi usado. Faça login para receber um novo.");
        } else {
          setErrorMsg("Não conseguimos confirmar seu e-mail. Tente fazer login.");
        }
        setStatus("error");
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ve-root">
      <div ref={bgRef} className="ve-bg" />
      <div ref={glowRef} className="ve-glow" />

      <div className="ve-card" role="status" aria-live="polite">
        {status === "loading" && (
          <>
            <div className="ve-spinner-big" aria-hidden="true" />
            <h1 className="ve-title">Confirmando seu e-mail...</h1>
            <p className="ve-text">Só um instante.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="ve-icon-wrap ve-icon-success" aria-hidden="true">
              <CheckCircle size={72} weight="fill" />
            </div>
            <h1 className="ve-title">E-mail confirmado! 🎉</h1>
            <p className="ve-text">Sua conta está pronta. Estamos te levando para o Doonly...</p>
            <button
              type="button"
              className="ve-btn"
              onClick={() => navigate("/inicio")}
            >
              Entrar agora
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div className="ve-icon-wrap ve-icon-error" aria-hidden="true">
              <WarningCircle size={72} weight="fill" />
            </div>
            <h1 className="ve-title">Link inválido</h1>
            <p className="ve-text">{errorMsg}</p>
            <button
              type="button"
              className="ve-btn"
              onClick={() => navigate("/login")}
            >
              Ir para o login
            </button>
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        #root { height: 100%; overflow-y: auto; }
        .ve-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; position: relative; font-family: inherit; padding: 1.5rem; }
        .ve-bg { position: fixed; inset: 0; z-index: 0; background: var(--primary-gradient); }
        .ve-glow { position: fixed; z-index: 1; width: 350px; height: 350px; border-radius: 50%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%); transform: translate(-50%, -50%); pointer-events: none; }
        .ve-card {
          position: relative; z-index: 2;
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          padding: 2.5rem 1.75rem;
          width: 100%; max-width: 440px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.12);
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          display: flex; flex-direction: column; align-items: center; gap: 1rem;
          text-align: center;
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .ve-icon-wrap {
          width: 100px; height: 100px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          animation: iconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .ve-icon-success { background: #dcfce7; color: #16A34A; }
        .ve-icon-error { background: #fef2f2; color: #EF4444; }
        @keyframes iconPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
        .ve-spinner-big {
          width: 56px; height: 56px;
          border: 4px solid var(--primary-light);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 0.5rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ve-title {
          font-size: 1.5rem; font-weight: 700;
          color: var(--text-title);
          letter-spacing: -0.01em; line-height: 1.2;
          margin: 0;
        }
        .ve-text {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }
        .ve-btn {
          margin-top: 0.75rem;
          padding: 0.9rem 1.5rem;
          background: var(--primary-gradient);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-input);
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          min-height: 52px;
          min-width: 200px;
          letter-spacing: 0.5px;
        }
        .ve-btn:hover { opacity: 0.9; transform: translateY(-1px); }
      `}</style>
    </div>
  );
}
