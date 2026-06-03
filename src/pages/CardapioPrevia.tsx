import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUrl(`${window.location.origin}/cardapio/${user.id}`);
    });
  }, []);

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Barra topo — fora do iframe */}
      <div style={{
        background: "#120706",
        height: "48px",
        minHeight: "48px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        flexShrink: 0,
        zIndex: 10000,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "8px",
            padding: "0.35rem 0.8rem",
            color: "white",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.82rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Voltar
        </button>
        <span style={{
          color: "white",
          fontFamily: "Inter, sans-serif",
          fontSize: "0.85rem",
          fontWeight: 600,
        }}>
          Prévia
        </span>
        <div style={{width: "70px"}} />
      </div>

      {/* Iframe começa ABAIXO da barra */}
      {url && (
        <iframe
          src={url}
          style={{
            flex: 1,
            border: "none",
            width: "100%",
            height: "calc(100% - 48px)",
            display: "block",
          }}
          title="Prévia do cardápio"
        />
      )}
    </div>
  );
}
