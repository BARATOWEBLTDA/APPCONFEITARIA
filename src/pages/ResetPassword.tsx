import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Eye, EyeSlash } from "@phosphor-icons/react";

type Status = "processing" | "ready" | "invalid" | "expired";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("processing");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);

  // Requisitos da senha em tempo real
  const checks = {
    length: senha.length >= 6,
    letter: /[a-zA-Z]/.test(senha),
    number: /\d/.test(senha),
    match: senha === confirmar && confirmar.length > 0,
  };
  const senhaValida = checks.length && checks.letter && checks.number;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);
    const animate = () => {
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

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const processCallback = async () => {
      try {
        const errorCode = searchParams.get("error_code") || searchParams.get("error");
        if (errorCode) {
          if (/expired|otp_expired/i.test(errorCode)) {
            if (mounted) setStatus("expired");
          } else {
            if (mounted) setStatus("invalid");
          }
          return;
        }

        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (/expired/i.test(exchangeError.message)) {
              if (mounted) setStatus("expired");
            } else {
              if (mounted) setStatus("invalid");
            }
            return;
          }
          if (mounted) setStatus("ready");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          if (mounted) setStatus("ready");
          return;
        }

        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
          if (!mounted) return;
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setStatus("ready");
            if (timeoutId) clearTimeout(timeoutId);
          }
        });
        subscription = authListener.subscription;

        // Timeout aumentado para 8s (conexões mobile lentas)
        timeoutId = setTimeout(() => {
          if (mounted) setStatus(prev => prev === "processing" ? "invalid" : prev);
        }, 8000);
      } catch (err) {
        if (mounted) setStatus("invalid");
      }
    };

    processCallback();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!checks.length) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (!checks.letter) return setError("A senha precisa ter pelo menos 1 letra.");
    if (!checks.number) return setError("A senha precisa ter pelo menos 1 número.");
    if (senha !== confirmar) return setError("As senhas digitadas não são iguais.");

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (err) {
      const msg = err.message || "";
      if (/expired|invalid|otp/i.test(msg)) {
        setError("O link expirou. Volte e solicite um novo.");
      } else if (/same.*password|same_password/i.test(msg)) {
        setError("A nova senha precisa ser diferente da atual.");
      } else {
        setError("Não conseguimos salvar a nova senha. Tente novamente.");
      }
      return;
    }
    setSuccess(true);
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login");
    }, 3500);
  };

  const handlePedirNovoLink = () => navigate("/esqueci-senha");
  const handleVoltarLogin = () => navigate("/login");

  return (
    <div className="rp-root">
      <div className="rp-bg" />
      <div ref={glowRef} className="rp-glow" />

      <div className="rp-card">
        <div className="rp-logo-wrap">
          <img src="/assine.png" alt="Doonly" className="rp-logo" />
        </div>

        {status === "processing" && (
          <div className="rp-processing" role="status" aria-live="polite">
            <div className="rp-spinner-big" aria-hidden="true" />
            <h2>Validando seu link...</h2>
            <p>Só um instante.</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="rp-error-state">
            <div className="rp-icon-wrap rp-icon-error" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h2>Link inválido</h2>
            <p>Este link de redefinição de senha não é válido. Pode ter sido usado antes ou digitado incorretamente.</p>
            <button type="button" className="rp-btn" onClick={handlePedirNovoLink}>Solicitar novo link</button>
            <button type="button" className="rp-back" onClick={handleVoltarLogin}>← Voltar para o login</button>
          </div>
        )}

        {status === "expired" && (
          <div className="rp-error-state">
            <div className="rp-icon-wrap rp-icon-error" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <h2>Link expirado</h2>
            <p>Este link expirou por segurança. Solicite um novo link para redefinir sua senha.</p>
            <button type="button" className="rp-btn" onClick={handlePedirNovoLink}>Solicitar novo link</button>
            <button type="button" className="rp-back" onClick={handleVoltarLogin}>← Voltar para o login</button>
          </div>
        )}

        {status === "ready" && (
          <>
            {success ? (
              <div className="rp-success">
                <div className="rp-icon-wrap rp-icon-success" aria-hidden="true">
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <h2>Senha redefinida!</h2>
                <p>Sua senha foi alterada com sucesso. Estamos te levando para o login...</p>
              </div>
            ) : (
              <>
                <div className="rp-text">
                  <h2>Redefinir senha</h2>
                  <p>Digite sua nova senha abaixo.</p>
                </div>

                <form onSubmit={handleSubmit} className="rp-form" noValidate>
                  <div className="rp-field">
                    <label htmlFor="nova-senha">Nova senha</label>
                    <div className="rp-pw-wrap">
                      <input
                        id="nova-senha"
                        type={showSenha ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={senha}
                        onChange={e => setSenha(e.target.value)}
                        autoComplete="new-password"
                        enterKeyHint="next"
                        required
                      />
                      <button type="button" className="rp-eye" onClick={() => setShowSenha(!showSenha)} aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}>
                        {showSenha ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {senha && !senhaValida && (
                      <ul className="rp-req" aria-label="Requisitos da senha">
                        <li className={checks.length ? "ok" : ""}>{checks.length ? "✓" : "•"} 6 caracteres ou mais</li>
                        <li className={checks.letter ? "ok" : ""}>{checks.letter ? "✓" : "•"} 1 letra</li>
                        <li className={checks.number ? "ok" : ""}>{checks.number ? "✓" : "•"} 1 número</li>
                      </ul>
                    )}
                    {senha && senhaValida && (
                      <div className="rp-req-done" role="status">✓ Senha forte</div>
                    )}
                  </div>

                  <div className="rp-field">
                    <label htmlFor="confirmar-senha">Confirmar senha</label>
                    <div className="rp-pw-wrap">
                      <input
                        id="confirmar-senha"
                        type={showConfirmar ? "text" : "password"}
                        placeholder="Repita a nova senha"
                        value={confirmar}
                        onChange={e => setConfirmar(e.target.value)}
                        autoComplete="new-password"
                        enterKeyHint="done"
                        required
                      />
                      <button type="button" className="rp-eye" onClick={() => setShowConfirmar(!showConfirmar)} aria-label={showConfirmar ? "Ocultar senha" : "Mostrar senha"}>
                        {showConfirmar ? <EyeSlash size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {confirmar && !checks.match && (
                      <span className="rp-field-error">As senhas não são iguais</span>
                    )}
                  </div>

                  {error && <p className="rp-error">{error}</p>}

                  <button type="submit" className="rp-btn" disabled={loading || !senhaValida || !checks.match}>
                    {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><span className="rp-spinner" /> Salvando...</span> : "Salvar nova senha"}
                  </button>
                  <button type="button" className="rp-back" onClick={handleVoltarLogin}>← Voltar para o login</button>
                </form>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body { height:100%; }
        #root { height:100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .rp-root {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
          padding: max(1.5rem, env(safe-area-inset-top)) 1.5rem max(1.5rem, env(safe-area-inset-bottom));
        }
        .rp-bg {
          position: fixed; inset: 0; z-index: 0;
          background: linear-gradient(135deg, #FF9AC1 0%, #E85A8C 50%, #A8235A 100%);
        }
        .rp-glow {
          position: fixed; z-index: 1;
          width: 350px; height: 350px; border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 70%);
          transform: translate(-50%,-50%);
          pointer-events: none;
          will-change: transform;
        }
        .rp-card {
          position: relative; z-index: 2;
          background: var(--bg-card); border-radius: var(--radius-lg);
          padding: 2.5rem 2.2rem 2rem;
          width: 100%; max-width: 440px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.12);
          animation: rpSlide 0.5s cubic-bezier(0.16,1,0.3,1) both;
          max-height: calc(100dvh - 3rem);
          overflow-y: auto;
        }
        @keyframes rpSlide { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .rp-logo-wrap { display: flex; justify-content: center; margin-bottom: 1.5rem; }
        .rp-logo { height: 90px; object-fit: contain; }
        .rp-text { text-align: center; margin-bottom: 1.5rem; }
        .rp-text h2 { font-size: var(--font-modal-title); font-weight: var(--fw-semibold); color: var(--text-title); margin-bottom: 0.5rem; }
        .rp-text p { font-size: var(--font-button); color: var(--text-secondary); line-height: 1.5; }
        .rp-form { display: flex; flex-direction: column; gap: 1rem; }
        .rp-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .rp-field label { font-size: var(--font-button); font-weight: var(--fw-medium); color: var(--text-primary); }
        .rp-pw-wrap { position: relative; }
        .rp-field input {
          padding: 0.72rem 2.8rem 0.72rem 1rem;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          font-family: inherit; font-size: 16px;
          color: var(--text-title); outline: none;
          transition: border-color 0.2s; width: 100%;
          -webkit-appearance: none; appearance: none;
          -webkit-tap-highlight-color: transparent;
        }
        .rp-field input:focus { border-color: var(--border-focus); }
        .rp-field input::placeholder { color: var(--text-muted); }
        .rp-eye {
          position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); display: flex; align-items: center;
          padding: 0.5rem; -webkit-tap-highlight-color: transparent;
        }
        .rp-eye:hover { color: var(--primary); }
        .rp-field-error { font-size: 0.75rem; color: var(--error); padding-left: 0.25rem; }
        .rp-req { list-style: none; padding: 0.5rem 0.75rem; margin: 0; background: var(--bg-subtle, #F5F1F3); border-radius: var(--radius-sm); }
        .rp-req li { font-size: 0.75rem; color: var(--text-muted); padding: 2px 0; }
        .rp-req li.ok { color: #16A34A; font-weight: 600; }
        .rp-req-done { font-size: 0.75rem; color: #16A34A; font-weight: 600; padding: 4px 8px; background: #dcfce7; border-radius: var(--radius-sm); display: inline-block; }
        .rp-error { background: #fff1f2; border: 1px solid #fecdd3; color: var(--error); border-radius: var(--radius-sm); padding: 0.6rem 0.9rem; font-size: var(--font-button); }
        .rp-btn {
          padding: 0.85rem; background: var(--primary-gradient);
          color: var(--text-inverse); border: none; border-radius: var(--radius-sm);
          font-family: inherit; font-size: var(--font-input); font-weight: var(--fw-semibold);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          min-height: 48px; transition: opacity 0.2s, transform 0.15s;
          margin-top: 0.25rem;
          -webkit-tap-highlight-color: transparent;
          -webkit-appearance: none; appearance: none;
        }
        .rp-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .rp-btn:active:not(:disabled) { transform: scale(0.98); }
        .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rp-back {
          background: none; border: none;
          color: var(--text-muted); font-family: inherit;
          font-size: var(--font-button); cursor: pointer;
          text-align: center; padding: 0.5rem 0.25rem;
          margin-top: 0.4rem;
          -webkit-tap-highlight-color: transparent;
        }
        .rp-back:hover { color: var(--primary); }

        .rp-processing, .rp-error-state, .rp-success {
          text-align: center;
          display: flex; flex-direction: column; align-items: center;
          gap: 0.75rem;
        }
        .rp-processing h2, .rp-error-state h2, .rp-success h2 {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          margin: 0.5rem 0 0;
        }
        .rp-processing p, .rp-error-state p, .rp-success p {
          font-size: var(--font-button);
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0 0 0.5rem;
        }
        .rp-icon-wrap {
          width: 88px; height: 88px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          animation: iconPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .rp-icon-success { background: #dcfce7; color: #16A34A; }
        .rp-icon-error { background: var(--primary-light); color: var(--primary); }
        @keyframes iconPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }

        .rp-spinner-big {
          width: 56px; height: 56px;
          border: 4px solid var(--primary-light);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: rpspin 0.8s linear infinite;
          margin-bottom: 0.25rem;
        }
        .rp-spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.4); border-top-color: white; border-radius: 50%; animation: rpspin 0.7s linear infinite; display: inline-block; }
        @keyframes rpspin { to { transform: rotate(360deg); } }

        .rp-error-state .rp-btn, .rp-processing .rp-btn { width: 100%; }
      `}</style>
    </div>
  );
}
