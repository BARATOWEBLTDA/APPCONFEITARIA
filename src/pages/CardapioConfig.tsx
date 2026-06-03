import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const REQUISITOS = [
  { key: "nome_loja", label: "Nome da loja", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { key: "telefone",  label: "WhatsApp",     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
  { key: "endereco",  label: "Endereço",     icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> },
  { key: "horario",   label: "Horário de funcionamento", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
];

export default function CardapioConfig() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [status, setStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const s: Record<string, boolean> = {
        nome_loja: !!profile?.nome_loja,
        telefone:  !!profile?.telefone,
        endereco:  !!profile?.endereco,
        horario:   !!profile?.horario,
      };
      setStatus(s);
      setBloqueado(Object.values(s).some(v => !v));
      setLoading(false);
    };
    check();
  }, []);

  const cardapioUrl = userId ? `${window.location.origin}/cardapio/${userId}` : "";
  const handleCopy = () => { navigator.clipboard.writeText(cardapioUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleOpen = () => window.open(cardapioUrl, "_blank");
  const concluidos = Object.values(status).filter(Boolean).length;
  const total = REQUISITOS.length;

  if (loading) return (
    <div className="cc-loading">
      <span className="cc-spinner" />
    </div>
  );

  return (
    <div className="cc-root">

      {bloqueado ? (
        <>
          {/* Hero bloqueado */}
          <div className="cc-hero-locked">
            <div className="cc-lock-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h2 className="cc-locked-title">Cardápio bloqueado</h2>
            <p className="cc-locked-sub">Complete as informações abaixo para liberar seu cardápio público e começar a receber pedidos.</p>
          </div>

          {/* Progresso */}
          <div className="cc-card">
            <div className="cc-progress-header">
              <span className="cc-progress-label">Progresso</span>
              <span className="cc-progress-count">{concluidos}/{total}</span>
            </div>
            <div className="cc-progress-bar-bg">
              <div className="cc-progress-bar-fill" style={{width:`${(concluidos/total)*100}%`}} />
            </div>
            <div className="cc-requisitos">
              {REQUISITOS.map(r => (
                <div key={r.key} className={`cc-req-item${status[r.key] ? " done" : ""}`}>
                  <div className="cc-req-icon-wrap">{r.icon}</div>
                  <span className="cc-req-label">{r.label}</span>
                  {status[r.key]
                    ? <div className="cc-req-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg></div>
                    : <div className="cc-req-x"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
                  }
                </div>
              ))}
            </div>
            <button className="cc-btn-config" onClick={() => navigate("/configuracoes")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Ir para Configurações
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cc-page-header">
            <h1 className="cc-page-title">Cardápio / Loja</h1>
            <p className="cc-page-sub">Seu cardápio público para compartilhar com clientes</p>
          </div>

          <div className="cc-card">
            <p className="cc-link-label">Link do seu cardápio</p>
            <div className="cc-link-box">
              <span className="cc-link-url">{cardapioUrl}</span>
              <button className="cc-link-copy" onClick={handleCopy}>
                {copied ? "✓ Copiado!" : "Copiar"}
              </button>
            </div>
            <div className="cc-btns">
              <button className="cc-btn-primary" onClick={handleOpen}>Abrir cardápio</button>
              <button className="cc-btn-secondary" onClick={handleCopy}>{copied ? "✓ Copiado!" : "Copiar link"}</button>
            </div>
            <div className="cc-tip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F583BF" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p><strong>Compartilhe esse link</strong> com suas clientes pelo WhatsApp, Instagram ou onde preferir!</p>
            </div>
          </div>
        </>
      )}

      <style>{`
        .cc-root { font-family:'Inter',sans-serif; max-width:520px; display:flex; flex-direction:column; gap:1rem; }
        .cc-loading { display:flex; align-items:center; justify-content:center; min-height:40vh; }
        .cc-spinner { width:32px; height:32px; border:3px solid #fce7f3; border-top-color:#F583BF; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Hero bloqueado */
        .cc-hero-locked { background:linear-gradient(135deg,#F583BF,#e060a8); border-radius:20px; padding:1.75rem 1.5rem; text-align:center; }
        .cc-lock-icon { width:60px; height:60px; background:rgba(255,255,255,0.2); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 0.85rem; }
        .cc-locked-title { font-size:1.2rem; font-weight:800; color:white; margin:0 0 0.4rem; }
        .cc-locked-sub { font-size:0.82rem; color:rgba(255,255,255,0.85); margin:0; line-height:1.5; }

        /* Card */
        .cc-card { background:var(--bg-card,white); border-radius:18px; padding:1.25rem; box-shadow:var(--shadow-card,0 2px 12px rgba(0,0,0,0.06)); display:flex; flex-direction:column; gap:0.85rem; }

        /* Progresso */
        .cc-progress-header { display:flex; justify-content:space-between; align-items:center; }
        .cc-progress-label { font-size:0.82rem; font-weight:700; color:var(--text-secondary,#6b7280); text-transform:uppercase; letter-spacing:0.05em; }
        .cc-progress-count { font-size:0.82rem; font-weight:700; color:#F583BF; }
        .cc-progress-bar-bg { height:6px; background:var(--bg-subtle,#f3f4f6); border-radius:999px; overflow:hidden; }
        .cc-progress-bar-fill { height:100%; background:linear-gradient(90deg,#F583BF,#e060a8); border-radius:999px; transition:width 0.5s ease; }

        /* Requisitos */
        .cc-requisitos { display:flex; flex-direction:column; gap:0.5rem; }
        .cc-req-item { display:flex; align-items:center; gap:0.75rem; padding:0.65rem 0.9rem; border-radius:12px; background:var(--bg-subtle,#f9fafb); }
        .cc-req-item.done { background:#f0fdf4; }
        .cc-req-icon-wrap { color:#9ca3af; display:flex; flex-shrink:0; }
        .cc-req-item.done .cc-req-icon-wrap { color:#22c55e; }
        .cc-req-label { flex:1; font-size:0.85rem; font-weight:500; color:var(--text-primary,#374151); }
        .cc-req-check { width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,#22c55e,#16a34a); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .cc-req-x { width:20px; height:20px; border-radius:50%; background:#ef4444; display:flex; align-items:center; justify-content:center; flex-shrink:0; }

        /* Botão config */
        .cc-btn-config { display:flex; align-items:center; justify-content:center; gap:0.5rem; width:100%; padding:0.9rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:50px; font-family:'Inter',sans-serif; font-size:0.95rem; font-weight:700; cursor:pointer; transition:opacity 0.2s; }
        .cc-btn-config:hover { opacity:0.9; }

        /* Link */
        .cc-page-header { }
        .cc-page-title { font-size:1.3rem; font-weight:700; color:var(--text-primary,#1f2937); margin:0 0 0.2rem; }
        .cc-page-sub { font-size:0.85rem; color:var(--text-muted,#9ca3af); margin:0; }
        .cc-link-label { font-size:0.8rem; font-weight:600; color:var(--text-secondary,#374151); margin:0; }
        .cc-link-box { display:flex; align-items:center; gap:0.5rem; background:var(--bg-subtle,#f9fafb); border:1.5px solid var(--border,#e5e7eb); border-radius:12px; padding:0.65rem 1rem; }
        .cc-link-url { flex:1; font-size:0.82rem; color:var(--text-muted,#6b7280); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .cc-link-copy { background:none; border:none; cursor:pointer; color:#F583BF; font-family:'Inter',sans-serif; font-size:0.82rem; font-weight:700; white-space:nowrap; }
        .cc-btns { display:flex; gap:0.75rem; }
        .cc-btn-primary { flex:1; padding:0.8rem; background:linear-gradient(135deg,#F583BF,#e060a8); color:white; border:none; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:700; cursor:pointer; }
        .cc-btn-secondary { flex:1; padding:0.8rem; background:var(--bg-subtle,#f3f4f6); color:var(--text-primary,#374151); border:none; border-radius:12px; font-family:'Inter',sans-serif; font-size:0.9rem; font-weight:600; cursor:pointer; }
        .cc-tip { display:flex; align-items:flex-start; gap:0.6rem; background:var(--bg-subtle,#fdf2f8); border-radius:12px; padding:0.9rem; border:1px solid rgba(245,131,191,0.2); }
        .cc-tip p { font-size:0.8rem; color:var(--text-secondary,#6b7280); margin:0; line-height:1.5; }
      `}</style>
    </div>
  );
}
