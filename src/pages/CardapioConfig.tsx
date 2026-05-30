import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CardapioConfig() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
      setLoading(false);
    });
  }, []);

  const cardapioUrl = userId ? `${window.location.origin}/cardapio/${userId}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(cardapioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    window.open(cardapioUrl, "_blank");
  };

  if (loading) return <div style={{ padding: "2rem", fontFamily: "Inter, sans-serif", color: "#9ca3af" }}>Carregando...</div>;

  return (
    <div style={{ fontFamily: "Inter, sans-serif", maxWidth: "600px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1f2937", marginBottom: "0.25rem" }}>🛍️ Cardápio / Loja</h1>
      <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginBottom: "1.5rem" }}>Seu cardápio público para compartilhar com os clientes</p>

      <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        
        {/* Preview do link */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#374151", display: "block", marginBottom: "0.4rem" }}>Link do seu cardápio</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: "10px", padding: "0.65rem 1rem" }}>
            <span style={{ flex: 1, fontSize: "0.85rem", color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cardapioUrl}
            </span>
            <button onClick={handleCopy} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#16a34a" : "#f9007a", fontFamily: "Inter, sans-serif", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              {copied ? "✓ Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        {/* Botões */}
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={handleOpen} style={{ flex: 1, padding: "0.8rem", background: "linear-gradient(135deg, #f9007a, #d4006a)", color: "white", border: "none", borderRadius: "10px", fontFamily: "Inter, sans-serif", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}>
            Abrir cardápio
          </button>
          <button onClick={handleCopy} style={{ flex: 1, padding: "0.8rem", background: "#f3f4f6", color: "#374151", border: "none", borderRadius: "10px", fontFamily: "Inter, sans-serif", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer" }}>
            {copied ? "✓ Copiado!" : "Copiar link"}
          </button>
        </div>

        <div style={{ marginTop: "1.25rem", padding: "1rem", background: "#fff0f6", borderRadius: "10px", border: "1px solid #fce7f3" }}>
          <p style={{ fontSize: "0.82rem", color: "#9d174d", margin: 0 }}>
            💡 <strong>Compartilhe esse link</strong> com suas clientes pelo WhatsApp, Instagram ou onde preferir. Elas poderão ver seus produtos e fazer pedidos!
          </p>
        </div>
      </div>
    </div>
  );
}
