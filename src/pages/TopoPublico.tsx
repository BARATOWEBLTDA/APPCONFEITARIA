import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Heart, Storefront } from "@phosphor-icons/react";
import { nomeApresentavel } from "@/lib/nomeApresentavel";
import { ArrowRight, Images } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { guardarDestinoDoLogin } from "@/lib/destinoLogin";
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
  // (09/11) quem compartilhou (?de=código da loja): "Maria compartilhou esse topo com você"
  const de = useSearchParams()[0].get("de") || "";
  const [quem, setQuem] = useState<{ nome: string; loja: string | null; imagem: string | null } | null>(null);
  const destino = `/ferramentas/topos?topo=${encodeURIComponent(id)}`;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { navigate(destino, { replace: true }); return; }
      if (/^[a-z0-9]{2,12}$/i.test(de)) void supabase.rpc("topo_quem_compartilhou", { p_codigo: de }).then(({ data: q }) => {
        const r = (Array.isArray(q) ? q[0] : q) as { nome: string | null; loja: string | null; imagem: string | null } | null;
        // (09/11) quem aparece é a loja ("Doce Formiga compartilhou…"); sem nome de loja, o primeiro nome da pessoa
        const nome = String(r?.loja || "").trim() || nomeApresentavel(r?.nome);
        if (vivo && nome) setQuem({ nome, loja: r?.loja || null, imagem: r?.imagem && /^https:\/\//.test(r.imagem) ? r.imagem : null });
      });
      const { data } = await supabase.rpc("topo_publico", { p_id: id });
      if (vivo) setT((Array.isArray(data) ? data[0] : data) || null);
    })().catch(() => vivo && setT(null));
    return () => { vivo = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // criou a conta ou entrou: volta pra esse topo dentro do app
  const cadastrar = () => { guardarDestinoDoLogin(destino); navigate("/cadastro"); };
  const entrar = () => { guardarDestinoDoLogin(destino); navigate("/login"); };

  return (
    <div className="tp">
      {t === undefined ? (
        <p className="tp-car" role="status"><span className="ui-gira" aria-hidden="true" />Carregando…</p>
      ) : t === null ? (
        <section className="tp-card tp-vz">
          <Images size={36} aria-hidden="true" />
          <h1>Esse topo não está mais disponível</h1>
          <p>Mas tem muitos outros esperando por você no Doonly.</p>
          <button type="button" className="tp-cta" onClick={cadastrar}>Ver os topos no Doonly<ArrowRight size={16} weight="bold" /></button>
        </section>
      ) : (
        <>
          {quem && (
            <div className="tp-quem">
              <span className="tp-quem-img">{quem.imagem ? <img src={quem.imagem} alt="" onError={() => setQuem(q => q && { ...q, imagem: null })} /> : <Storefront size={24} />}</span>
              <p className="tp-quem-t">{quem.nome} compartilhou esse topo de bolo com você <Heart size={16} weight="fill" className="tp-coracao" aria-label="com carinho" /></p>
            </div>
          )}
          <section className="tp-card">
            <div className="tp-capa">
              {t.capa_url ? <img src={t.capa_url} alt={t.titulo} /> : <Images size={40} aria-hidden="true" />}
            </div>
            <div className="tp-info">
              <h1>{t.titulo || "Topo de bolo"}</h1>
              <p className="tp-sub">O Doonly preparou esse lindo topo de bolo em tamanho A4, prontinho para você baixar, imprimir e recortar.</p>
              <button type="button" className="tp-cta" onClick={cadastrar}>Baixar no app Doonly<ArrowRight size={16} weight="bold" /></button>
              <button type="button" className="tp-ja" onClick={entrar}>Já tenho conta</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
