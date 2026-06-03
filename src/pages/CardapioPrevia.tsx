import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CardapioPrevia() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUrl(`${window.location.origin}/cardapio/${user.id}`);
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}>
      <span style={{width:"32px",height:"32px",border:"3px solid #fce7f3",borderTopColor:"#F583BF",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!url) return null;

  return (
    <div style={{
      position:"fixed",
      top:0, left:0, right:0, bottom:0,
      zIndex:10,
      background:"white",
      display:"flex",
      flexDirection:"column"
    }}>
      <iframe
        src={url}
        style={{flex:1, border:"none", width:"100%", height:"100%"}}
        title="Prévia do cardápio"
      />
    </div>
  );
}
