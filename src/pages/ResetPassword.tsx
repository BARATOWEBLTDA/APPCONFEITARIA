import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// ─────────────────────────────────────────────────────────────
// Página de redefinição de senha.
//
// Fluxo:
// 1. Confeiteira clica no link do email de reset.
// 2. Supabase redireciona para /reset-password com um code (fluxo PKCE)
//    OU dispara evento PASSWORD_RECOVERY (fluxo antigo com hash).
// 3. Trocamos o code por uma sessão de recovery via exchangeCodeForSession.
// 4. Se der certo → mostra o formulário de nova senha.
// 5. Se falhar (link expirado, inválido, ou usado) → mostra tela de erro
//    com CTA para pedir novo link.
//
// Compat: também suporta o formato hash legado (#access_token=...) via
// evento PASSWORD_RECOVERY do SDK.
// ─────────────────────────────────────────────────────────────

type Status = "processing" | "ready" | "invalid" | "expired";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<Status>("processing");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const bgRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 50, y: 50 });
  const currentRef = useRef({ x: 50, y: 50 });
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  // ── Fundo animado (padrão da identidade Doonly) ────────────
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
        // Paleta vinho do Doonly (não mais rosa) — consistência com Auth/VerificarEmail
        bgRef.current.style.background = `linear-gradient(${angle}deg, #986274 0%, #6E3548 50%, #C39EAA 100%)`;
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

  // ── Processa o callback do link de reset ───────────────────
  // Estratégia robusta que cobre 3 formatos:
  //   1. PKCE moderno: ?code=xxx (padrão hoje no Supabase)
  //   2. Erro na URL:   ?error=access_denied&error_code=otp_expired
  //   3. Hash legado:   #access_token=xxx&refresh_token=yyy&type=recovery
  //                     (processado automaticamente pelo SDK v2 → dispara PASSWORD_RECOVERY)
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;

    const processCallback = async () => {
      try {
        // 1) Erro explícito na URL (link expirado, já usado, etc.)
        const errorCode = searchParams.get("error_code") || searchParams.get("error");
        if (errorCode) {
          if (/expired|otp_expired/i.test(errorCode)) {
            if (mounted) setStatus("expired");
          } else {
            if (mounted) setStatus("invalid");
          }
          return;
        }

        // 2) Fluxo PKCE — troca o code por sessão de recovery
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

        // 3) Fluxo hash legado — o SDK processa automaticamente ao carregar.
        //    Escutamos o evento PASSWORD_RECOVERY.
        //    Se já houver sessão (ex: SDK já processou), usamos direto.
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          // ⚠️ Nota importante: se a confeiteira já estava logada no navegador
          // e o link falhou por algum motivo, ela pode ter uma sessão NORMAL
          // aqui (não de recovery). Nesse caso, permitimos o reset mesmo assim
          // — updateUser({ password }) funciona pra qualquer sessão autenticada.
          if (mounted) setStatus("ready");
          return;
        }

        // Ainda não tem sessão — escuta o evento (com timeout de segurança)
        const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
          if (!mounted) return;
          if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
            setStatus("ready");
          }
        });
        subscription = authListener.subscription;

        // Timeout de 4s: se nada acontecer, marca como link inválido
        setTimeout(() => {
          if (mounted && status === "processing") {
            setStatus("invalid");
          }
        }, 4000);
      } catch (err) {
        if (mounted) setStatus("invalid");
      }
    };

    processCallback();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Submit da nova senha ───────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (senha.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (!/[a-zA-Z]/.test(senha)) return setError("A senha precisa ter pelo menos 1 letra.");
    if (!/\d/.test(senha)) return setError("A senha precisa ter pelo menos 1 número.");
    if (senha !== confirmar) return setError("As senhas digitadas não são iguais.");

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: senha });
    setLoading(false);

    if (err) {
      const msg = err.message || "";
      if (/expired|invalid|otp/i.test(msg)) {
        setError("O link expirou. Volte e solicite um novo.");
      } else {
        setError("Não conseguimos salvar a nova senha. Tente novamente.");
      }
      return;
    }
    setSuccess(true);
    // Após redefinir, desloga a sessão de recovery e manda pro login
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate("/login");
    }, 3000);
  };

  const handlePedirNovoLink = () => navigate("/esqueci-senha");
  const handleVoltarLogin = () => navigate("/login");

  return (
    <div className="rp-root">
      <div ref={bgRef} className="rp-bg" />
      <div ref={glowRef} className="rp-glow" />

      <div className="rp-card">
        <div className="rp-logo-wrap">
          <img src="/assine.png" alt="Doonly" className="rp-logo" />
        </div>

        {/* Estado: processando o link ─────────────────────── */}
        {status === "processing" && (
          <div className="rp-processing" role="status" aria-live="polite">
            <div className="rp-spinner-big" aria-hidden="true" />
            <h2>Validando seu link...</h2>
            <p>Só um instante.</p>
          </div>
        )}

        {/* Estado: link inválido ──────────────────────────── */}
        {status === "invalid" && (
          <div className="rp-error-state">
            <div className="rp-icon-wrap rp-icon-error" aria-hidden="true">
              <span style={{ fontSize: "44px" }}>⚠️</span>
            </div>
            <h2>Link inválido</h2>
            <p>
              Este link de redefinição de senha não é válido. Pode ter sido usado antes ou digitado incorretamente.
            </p>
            <button type="button" className="rp-btn" onClick={handlePedirNovoLink}>
              Solicitar novo link
            </button>
            <button type="button" className="rp-back" onClick={handleVoltarLogin}>
              ← Voltar para o login
            </button>
          </div>
        )}

        {/* Estado: link expirado ──────────────────────────── */}
        {status === "expired" && (
          <div className="rp-error-state">
            <div className="rp-icon-wrap rp-icon-error" aria-hidden="true">
              <span style={{ fontSize: "44px" }}>⏰</span>
            </div>
            <h2>Link expirado</h2>
            <p>
              Este link expirou por segurança. Solicite um novo link para redefinir sua senha.
            </p>
            <button type="button" className="rp-btn" onClick={handlePedirNovoLink}>
              Solicitar novo link
            </button>
            <button type="button" className="rp-back" onClick={handleVoltarLogin}>
              ← Voltar para o login
            </button>
          </div>
        )}

        {/* Estado: pronto ─ mostra form ou sucesso ────────── */}
        {status === "ready" && (
          <>
            {success ? (
              <div className="rp-success">
                <div className="rp-icon-wrap rp-icon-success" aria-hidden="true">
                  <span style={{ fontSize: "44px" }}>✅</span>
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
                    <input
                      id="nova-senha"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="rp-field">
                    <label htmlFor="confirmar-senha">Confirmar senha</label>
                    <input
                      id="confirmar-senha"
                      type="password"
                      placeholder="Repita a nova senha"
                      value={confirmar}
                      onChange={e => setConfirmar(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  {error && <p className="rp-error">{error}</p>}

                  <button type="submit" className="rp-btn" disabled={loading}>
                    {loading ? <span className="rp-spinner" /> : "Salvar nova senha"}
                  </button>

                  <button type="button" className="rp-back" onClick={handleVoltarLogin}>
                    ← Voltar para o login
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body, #root { height:100%; overflow:hidden; }
        .rp-root { height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; position:relative; overflow:hidden; font-family:'Geist', sans-serif; padding:1.5rem; }
        .rp-bg { position:fixed; inset:0; z-index:0; background:var(--primary-gradient); }
        .rp-glow { position:fixed; z-index:1; width:350px; height:350px; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0) 70%); transform:translate(-50%,-50%); pointer-events:none; }
        .rp-card { position:relative; z-index:2; background:var(--bg-card); border-radius: var(--radius-lg); padding:2.5rem 2.2rem 2rem; width:calc(100% - 2.5rem); max-width:440px; box-shadow:0 8px 40px rgba(0,0,0,0.12); animation:rpSlide 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes rpSlide { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .rp-logo-wrap { display:flex; justify-content:center; margin-bottom:1.5rem; }
        .rp-logo { height:90px; object-fit:contain; }
        .rp-text { text-align:center; margin-bottom:1.5rem; }
        .rp-text h2 { font-size: var(--font-modal-title); font-weight: var(--fw-semibold); color:var(--text-title); margin-bottom:0.5rem; }
        .rp-text p { font-size: var(--font-button); color:var(--text-secondary); line-height:1.5; }
        .rp-form { display:flex; flex-direction:column; gap:1rem; }
        .rp-field { display:flex; flex-direction:column; gap:0.35rem; }
        .rp-field label { font-size: var(--font-button); font-weight: var(--fw-medium); color:var(--text-primary); }
        .rp-field input { padding:0.72rem 1rem; border:1.5px solid var(--border); border-radius: var(--radius-sm); font-family:'Geist', sans-serif; font-size: var(--font-input); color:var(--text-title); outline:none; transition:border-color 0.2s; width:100%; }
        .rp-field input:focus { border-color:var(--border-focus); }
        .rp-field input::placeholder { color:var(--text-muted); }
        .rp-error { background:#fff1f2; border:1px solid #fecdd3; color:var(--error); border-radius: var(--radius-sm); padding:0.6rem 0.9rem; font-size: var(--font-button); }
        .rp-btn { padding:0.85rem; background:var(--primary-gradient); color:var(--text-inverse); border:none; border-radius: var(--radius-sm); font-family:'Geist', sans-serif; font-size: var(--font-input); font-weight: var(--fw-semibold); cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:48px; transition:opacity 0.2s; margin-top: 0.25rem; }
        .rp-btn:hover:not(:disabled) { opacity:0.9; }
        .rp-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .rp-back { background:none; border:none; color:var(--text-muted); font-family:'Geist', sans-serif; font-size: var(--font-button); cursor:pointer; text-align:center; padding:0.5rem 0.25rem; margin-top: 0.4rem; }
        .rp-back:hover { color:var(--primary); }

        /* Estados: processing / success / error ─────────────── */
        .rp-processing, .rp-error-state, .rp-success {
          text-align:center;
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:0.75rem;
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
        .rp-icon-success { background: #dcfce7; }
        .rp-icon-error { background: var(--primary-light); }
        @keyframes iconPop { from { opacity:0; transform:scale(0.7); } to { opacity:1; transform:scale(1); } }

        /* Spinner grande (processing) */
        .rp-spinner-big {
          width: 56px; height: 56px;
          border: 4px solid var(--primary-light);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: rpspin 0.8s linear infinite;
          margin-bottom: 0.25rem;
        }
        .rp-spinner { width:20px; height:20px; border:2px solid rgba(255,255,255,0.4); border-top-color:white; border-radius:50%; animation:rpspin 0.7s linear infinite; display:inline-block; }
        @keyframes rpspin { to { transform:rotate(360deg); } }

        /* Botão dos estados de erro precisa ocupar largura completa */
        .rp-error-state .rp-btn, .rp-processing .rp-btn { width: 100%; }
      `}</style>
    </div>
  );
}
