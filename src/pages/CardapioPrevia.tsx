import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}>
      <span style={{width:"32px",height:"32px",border:"3px solid #fce7f3",borderTopColor:"#F583BF",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!userId) return null;

  const url = `${window.location.origin}/cardapio/${userId}`;

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", flexDirection:"column",
      background:"#f8f8f8"
    }}>
      {/* Barra topo */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0.65rem 1rem",
        background:"#120706",
        flexShrink:0
      }}>
        <button
          onClick={() => navigate("/cardapio-config")}
          style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"8px",padding:"0.4rem 0.8rem",color:"white",fontFamily:"Inter,sans-serif",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:"0.4rem"}}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <span style={{color:"white",fontFamily:"Inter,sans-serif",fontSize:"0.85rem",fontWeight:600}}>Prévia do Cardápio</span>
        <button
          onClick={() => window.open(url, "_blank")}
          style={{background:"rgba(245,131,191,0.2)",border:"none",borderRadius:"8px",padding:"0.4rem 0.8rem",color:"#F583BF",fontFamily:"Inter,sans-serif",fontSize:"0.82rem",fontWeight:600,cursor:"pointer"}}
        >
          Abrir ↗
        </button>
      </div>

      {/* Iframe */}
      <iframe
        src={url}
        style={{flex:1, border:"none", width:"100%"}}
        title="Prévia do cardápio"
      />
    </div>
  );
}
