import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Página legada — agora consolidada no hub /cardapio (Entrega 2 da Proposta D).
 * Mantida apenas para não quebrar links/bookmarks antigos.
 */
export default function CardapioResumo() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/cardapio", { replace: true });
  }, [navigate]);

  return null;
}
