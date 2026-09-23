import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usePlano } from "@/hooks/usePlano";

interface BannerRow {
  imagem_url: string | null;
  link_destino: string | null;
  ativo: boolean;
}

/**
 * Banner promocional configurável pelo admin. Aparece no Início (mobile) entre
 * o Acesso Rápido e as Últimas Atualizações. Usa a tabela `admin_banner` com
 * dois registros: 'free' e 'pro'. Se o registro correspondente ao plano do
 * usuário não estiver ativo ou não tiver imagem, o banner não renderiza.
 */
export default function AdminBannerMobile() {
  const { isPro, loading: planoLoading } = usePlano();
  const [row, setRow] = useState<BannerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (planoLoading) return;
    let cancelled = false;
    (async () => {
      const audiencia = isPro ? "pro" : "free";
      const { data } = await supabase
        .from("admin_banner")
        .select("imagem_url, link_destino, ativo")
        .eq("audiencia", audiencia)
        .maybeSingle();
      if (!cancelled) {
        setRow(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isPro, planoLoading]);

  if (loading || !row || !row.ativo || !row.imagem_url) return null;

  const handleClick = () => {
    const dest = row.link_destino || "/assinar";
    if (dest.startsWith("http")) {
      window.open(dest, "_blank", "noopener,noreferrer");
    } else {
      navigate(dest);
    }
  };

  return (
    <div className="admin-banner-mobile" onClick={handleClick}>
      <img src={row.imagem_url} alt="Banner promocional" />
      <style>{`
        .admin-banner-mobile {
          display: block;
          width: 100%;
          aspect-ratio: 3 / 1;
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          background: #F5F0F2;
          transition: transform 0.15s;
        }
        .admin-banner-mobile:active { transform: scale(0.99); }
        .admin-banner-mobile img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Desktop esconde por enquanto — banner é só mobile */
        @media (min-width: 1100px) {
          .admin-banner-mobile { display: none; }
        }
      `}</style>
    </div>
  );
}
