import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CardapioConfig() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [bloqueado, setBloqueado] = useState(false);
  const [faltando, setFaltando] = useState<string[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const { count: produtos } = await supabase.from("produtos").select("*", { count: "exact", head: true }).eq("user_id", user.id);
      const { count: cats } = await supabase.from("categorias").select("*", { count: "exact", head: true }).eq("user_id", user.id);

      const falta: string[] = [];
      if (!profile?.foto_url) falta.push("Foto da loja");
      if (!profile?.nome_loja) falta.push("Nome da loja");
      if (!profile?.telefone) falta.push("WhatsApp");
      if (!profile?.endereco) falta.push("Endereço");
      if (!profile?.horario) falta.push("Horário de funcionamento");
      if (!profile?.descricao_loja) falta.push("Descrição da loja");
      if (profile?.faz_entrega === null || profile?.faz_entrega === undefined) falta.push("Configurar entrega");
      if (!produtos || produtos === 0) falta.push("Pelo menos 1 produto");
      if (!cats || cats === 0) falta.push("Pelo menos 1 categoria");

      setFaltando(falta);
      setBloqueado(falta.length > 0);
      setLoading(false);
    };
    check();
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

  if (bloqueado) return (
    <div style={{ fontFamily: "Inter, sans-serif", maxWidth: "520px" }}>
      <div style={{ background: "white", borderRadius: "16px", padding: "1.5rem", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🔒</div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#1f2937", margin: "0 0 0.4rem" }}>Cardápio bloqueado</h2>
          <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>Complete as configurações abaixo para liberar seu cardápio público</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {faltando.map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#fff1f2", borderRadius: "8px", padding: "0.65rem 0.9rem" }}>
              <span style={{ color: "#ef4444", fontSize: "0.85rem" }}>✗</span>
              <span style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 500 }}>{item}</span>
            </div>
          ))}
        </div>
        <a href="/configuracoes" style={{ display: "block", textAlign: "center", padding: "0.85rem", background: "linear-gradient(135deg, #f9007a, #d4006a)", color: "white", borderRadius: "10px", fontWeight: 600, textDecoration: "none", fontSize: "0.95rem" }}>
          Ir para Configurações
        </a>
      </div>
    </div>
  );

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
