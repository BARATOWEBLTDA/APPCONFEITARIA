import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type ViewMode = "mobile" | "desktop";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUrl(`${window.location.origin}/cardapio/${user.id}`);
    });
  }, []);

  const handleShare = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openInTab = () => {
    if (url) window.open(url, "_blank");
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        background: "#0f0f10",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* ── Barra topo ── */}
      <div
        style={{
          height: "54px",
          minHeight: "54px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          background: "#1a1a1e",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          flexShrink: 0,
          gap: "12px",
        }}
      >
        {/* Voltar */}
        <button
          onClick={() => navigate("/cardapio-config")}
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: "8px",
            padding: "0.45rem 0.9rem",
            color: "rgba(255,255,255,0.85)",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar
        </button>

        {/* Título + Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, justifyContent: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", fontWeight: 500 }}>
            Prévia do Cardápio
          </span>

          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "3px",
              gap: "2px",
            }}
          >
            <button
              onClick={() => setViewMode("mobile")}
              title="Visão mobile"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                background: viewMode === "mobile" ? "rgba(255,255,255,0.15)" : "transparent",
                color: viewMode === "mobile" ? "#fff" : "rgba(255,255,255,0.45)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" strokeLinecap="round" strokeWidth="3" />
              </svg>
              Mobile
            </button>

            <button
              onClick={() => setViewMode("desktop")}
              title="Visão desktop"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                background: viewMode === "desktop" ? "rgba(255,255,255,0.15)" : "transparent",
                color: viewMode === "desktop" ? "#fff" : "rgba(255,255,255,0.45)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              <svg width="14" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              Desktop
            </button>
          </div>
        </div>

        {/* Ações direita */}
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button
            onClick={openInTab}
            title="Abrir em nova aba"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "8px",
              padding: "0.45rem 0.75rem",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.82rem",
              fontWeight: 600,
              transition: "background 0.15s",
              fontFamily: "inherit",
            }}
            onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,0.14)")}
            onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Abrir
          </button>

          <button
            onClick={handleShare}
            style={{
              background: copied ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: "8px",
              padding: "0.45rem 0.9rem",
              color: copied ? "var(--success, #22C55E)" : "rgba(255,255,255,0.85)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.82rem",
              fontWeight: 600,
              transition: "all 0.2s",
              fontFamily: "inherit",
            }}
          >
            {copied ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copiado!
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Copiar link
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Área do iframe ── */}
      {url && (
        <div
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            alignItems: viewMode === "mobile" ? "flex-start" : "stretch",
            justifyContent: "center",
            background: viewMode === "mobile" ? "#0f0f10" : "transparent",
            padding: viewMode === "mobile" ? "24px 16px 24px" : "0",
          }}
        >
          {viewMode === "mobile" ? (
            <div
              style={{
                position: "relative",
                width: "390px",
                flexShrink: 0,
                borderRadius: "44px",
                background: "#1c1c1e",
                padding: "12px 10px",
                boxShadow:
                  "0 0 0 1.5px rgba(255,255,255,0.12), 0 24px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.04)",
              }}
            >
              {/* Notch */}
              <div
                style={{
                  width: "110px",
                  height: "28px",
                  background: "#1c1c1e",
                  borderRadius: "0 0 20px 20px",
                  margin: "0 auto 8px",
                  position: "relative",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2a2a2e", border: "1.5px solid #333" }} />
                <div style={{ width: "50px", height: "5px", borderRadius: "4px", background: "#2a2a2e" }} />
              </div>

              {/* Tela */}
              <div
                style={{
                  width: "100%",
                  height: "780px",
                  borderRadius: "30px",
                  overflow: "hidden",
                  background: "var(--bg-card, #FFFFFF)",
                  position: "relative",
                }}
              >
                <iframe
                  src={url}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Prévia mobile"
                />
              </div>

              {/* Home indicator */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}>
                <div style={{ width: "120px", height: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
          ) : (
            <iframe
              src={url}
              style={{ width: "100%", height: "100%", border: "none", background: "var(--bg-card, #FFFFFF)" }}
              title="Prévia desktop"
            />
          )}
        </div>
      )}

      {!url && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "36px", height: "36px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "rgba(255,255,255,0.5)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>Carregando prévia...</p>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
