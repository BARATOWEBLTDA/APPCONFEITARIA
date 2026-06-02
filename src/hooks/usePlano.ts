import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function usePlano() {
  const [plano, setPlano] = useState<"free" | "pro">("free");
  const [proExpiraEm, setProExpiraEm] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("plano, pro_expira_em")
        .eq("id", user.id)
        .single();

      if (data) {
        const expira = data.pro_expira_em ? new Date(data.pro_expira_em) : null;
        const hoje = new Date();

        // PRO ativo se: plano = 'pro' E (sem expiração OU ainda dentro do prazo)
        const isPROAtivo = data.plano === "pro" && (!expira || expira > hoje);

        setPlano(isPROAtivo ? "pro" : "free");
        setProExpiraEm(expira);
      }

      setLoading(false);
    };
    load();
  }, []);

  return {
    plano,
    isPro: plano === "pro",
    isFree: plano === "free",
    proExpiraEm,
    loading,
  };
}
