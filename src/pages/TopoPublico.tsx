import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Crown, Images } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { guardarDestinoDoLogin } from "@/lib/destinoLogin";
import { infoFormato } from "@/lib/toposBolo";
import "./topoPublico.css";

/**
 * (09/11) Página aberta do topo compartilhado (doonly.com.br/topo/:id). Quem tem conta e está logado vai direto
 * pro topo dentro do app. Quem não tem vê só esse topo (capa com a marca d'água, título e os formatos) e o convite
 * pra criar a conta. Os arquivos nunca aparecem aqui: baixar é dentro do app (PRO).
 */
type TopoPub = { id: string; titulo: string; capa_url: string | null; capa_mini_url: string | null; formatos: string[]; tem_canva: boolean; categoria: string | null; total_topos: number };

export default function TopoPublico() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState<TopoPub | null | undefined>(undefined);
  const destino = `/ferramentas/topos?topo=${encodeURIComponent(id)}`;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { navigate(destino, { replace: true }); return; }
      const { data } = await supabase.rpc("topo_publico", { p_id: id });
      if (vivo) setT((Array.isArray(data) ? data[0] : data) || null);
    })().catch(() => vivo && setT(null));
    return () => { vivo = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // criou a conta ou entrou: volta pra esse topo dentro do app
  const cadastrar = () => { guardarDestinoDoLogin(destino); navigate("/cadastro"); };
  const entrar = () => { guardarDestinoDoLogin(destino); navigate("/login"); };

  const fmts = [...(t?.formatos || [])].sort((a, b) => infoFormato(a).ordem - infoFormato(b).ordem);
  return (
    <div className="tp">
      <header className="tp-cab">
        <img src="/logoapp.webp" alt="Doonly" className="tp-logo" />
        <button type="button" className="tp-entrar" onClick={entrar}>Entrar</button>
      </header>
      {t === undefined ? (
        <p className="tp-car" role="status"><span className="ui-gira" aria-hidden="true" />Carregando…</p>
      ) : t === null ? (
        <section className="tp-card tp-vz">
          <Images size={36} aria-hidden="true" />
          <h1>Esse topo não está mais disponível</h1>
          <p>Mas tem muitos outros esperando por você no Doonly.</p>
          <button type="button" className="tp-cta" onClick={cadastrar}><Crown size={18} weight="fill" />Ver os topos no Doonly<ArrowRight size={16} weight="bold" /></button>
        </section>
      ) : (
        <>
          <section className="tp-card">
            <div className="tp-capa">
              {t.capa_url ? <img src={t.capa_url} alt={t.titulo} /> : <Images size={40} aria-hidden="true" />}
              <span className="tp-marca" aria-hidden="true">doonly</span>
            </div>
            <div className="tp-info">
              {t.categoria && <span className="tp-cat">{t.categoria}</span>}
              <h1>{t.titulo || "Topo de bolo"}</h1>
              <p className="tp-sub">Topo de bolo pronto pra imprimir e recortar</p>
              <div className="tp-fmts">
                {fmts.map(f => <span key={f} className="tp-fmt" style={{ background: infoFormato(f).cor }}>{f}</span>)}
                {t.tem_canva && <span className="tp-fmt tp-fmt--canva">Canva</span>}
              </div>
              <button type="button" className="tp-cta" onClick={cadastrar}><Crown size={18} weight="fill" />Baixar no Doonly · 7 dias grátis<ArrowRight size={16} weight="bold" /></button>
              <button type="button" className="tp-ja" onClick={entrar}>Já tenho conta</button>
            </div>
          </section>
          <section className="tp-banner">
            <div>
              <b>{t.total_topos > 1 ? `Mais de ${Math.max(1, t.total_topos - 1)} topos pra imprimir` : "Topos prontos pra imprimir"}</b>
              <span>E ainda pedidos, cardápio digital e financeiro da sua confeitaria, num app só.</span>
            </div>
            <button type="button" onClick={cadastrar}>Criar conta grátis</button>
          </section>
        </>
      )}
    </div>
  );
}
