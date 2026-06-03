import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUrl(`${window.location.origin}/cardapio/${user.id}`);
    });
  }, []);

  if (!url) return null;

  return (
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",flexDirection:"column",background:"white"}}>
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0.65rem 1rem",background:"#120706",flexShrink:0,gap:"0.5rem",
        minHeight:"48px"
      }}>
        <button onClick={() => navigate("/cardapio-config")} style={{
          background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"8px",
          padding:"0.4rem 0.9rem",color:"white",fontFamily:"Inter,sans-serif",
          fontSize:"0.82rem",fontWeight:600,cursor:"pointer",
          display:"flex",alignItems:"center",gap:"0.4rem",flexShrink:0
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Voltar
        </button>
        <span style={{color:"white",fontFamily:"Inter,sans-serif",fontSize:"0.85rem",fontWeight:600,flex:1,textAlign:"center"}}>
          Prévia do Cardápio
        </span>
        <button onClick={() => window.open(url, "_blank")} style={{
          background:"rgba(245,131,191,0.2)",border:"none",borderRadius:"8px",
          padding:"0.4rem 0.9rem",color:"#F583BF",fontFamily:"Inter,sans-serif",
          fontSize:"0.82rem",fontWeight:600,cursor:"pointer",flexShrink:0
        }}>
          Abrir ↗
        </button>
      </div>
      <iframe src={url} style={{flex:1,border:"none",width:"100%"}} title="Prévia do cardápio" />
    </div>
  );
}
