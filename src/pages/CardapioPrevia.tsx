import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

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
      // fallback
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

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      background: "#120706",
    }}>
      {/* Barra topo */}
      <div style={{
        height: "50px",
        minHeight: "50px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        flexShrink: 0,
      }}>
        {/* Voltar */}
        <button
          onClick={() => navigate("/cardapio-config")}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "8px",
            padding: "0.4rem 0.9rem",
            color: "white",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>

        {/* Título */}
        <span style={{
          color: "white",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}>
          Prévia do Cardápio
        </span>

        {/* Compartilhar */}
        <button
          onClick={handleShare}
          style={{
            background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "8px",
            padding: "0.4rem 0.9rem",
            color: copied ? "#4ade80" : "white",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.2s",
          }}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Copiado!
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartilhar
            </>
          )}
        </button>
      </div>

      {/* Iframe */}
      {url && (
        <iframe
          src={url}
          style={{
            flex: 1,
            border: "none",
            width: "100%",
            background: "white",
          }}
          title="Prévia do cardápio"
        />
      )}
    </div>
  );
}
