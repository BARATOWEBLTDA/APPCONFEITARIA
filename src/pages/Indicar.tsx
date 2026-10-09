/**
 * Indique e ganhe (09/10 · 3.55, no padrão do guia).
 *  1. Banner  2. Seu link + compartilhar  3. Quantas assinantes e o próximo prêmio
 *  4. Os 4 prêmios (3/10/25/50)  5. Quem entrou pelo link  6. Como funciona
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShareNetwork, Copy, WhatsappLogo, Check, Trophy, Lock, UsersThree } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, avisar } from "@/components/base";
import "./indicar.css";
interface Amiga {
  id: string;
  nome: string | null;
  status: "cadastrou" | "pro" | "premio_resgatado";
  virou_pro_em: string | null;
  created_at: string;
}

const PREMIOS = [
  { meta: 3, imagem: "/Sistema/brinde1.png", titulo: "1 mês grátis no Doonly", desc: "Uma mensalidade completa por sua conta" },
  { meta: 10, imagem: "/Sistema/brinde2.png", titulo: "3 meses grátis + camiseta", desc: "Camiseta personalizada com a marca da sua confeitaria" },
  { meta: 25, imagem: "/Sistema/brinde3.png", titulo: "Kit Exclusivo + 6 meses grátis", desc: "Avental + faixa + Confeiteira Destaque" },
  { meta: 50, imagem: "/Sistema/brinde4.png", titulo: "Batedeira Planetária + 1 ano grátis", desc: "O grande prêmio Doonly" },
];

export default function Indicar() {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [conversoes, setConversoes] = useState(0);
  const [amigas, setAmigas] = useState<Amiga[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user?.id) return;
      const userId = userRes.user.id;

      // Meu profile
      const { data: prof } = await supabase.from("profiles")
        .select("nome, codigo_indicacao").eq("id", userId).single();
      if (prof) {
        setNome(prof.nome || "");
        setCodigo(prof.codigo_indicacao || "");
      }

      // Minhas indicações + join com profiles das amigas
      const { data: ind } = await supabase.from("indicacoes")
        .select("id, indicada_id, status, virou_pro_em, created_at")
        .eq("indicador_id", userId)
        .order("created_at", { ascending: false });

      if (ind && ind.length) {
        const ids = ind.map(i => i.indicada_id);
        const { data: perfis } = await supabase.from("profiles")
          .select("id, nome").in("id", ids);
        const mapa = new Map((perfis || []).map(p => [p.id, p.nome]));
        setAmigas(ind.map((i: any) => ({
          id: i.indicada_id,
          nome: mapa.get(i.indicada_id) || null,
          status: i.status,
          virou_pro_em: i.virou_pro_em,
          created_at: i.created_at,
        })));
        setConversoes(ind.filter((i: any) => i.status === "pro" || i.status === "premio_resgatado").length);
      }

      setLoading(false);
    };
    load();
  }, []);

  const link = codigo ? `https://doonly.com.br/?ref=${codigo}` : "https://doonly.com.br";
  const mensagemWpp = encodeURIComponent(
    `Oi! Tô usando o Doonly pra organizar minha confeitaria e recomendo demais.\n\n` +
    `Se você entrar pelo meu link ganha:\n` +
    `70% de desconto no 1º mês do PRO\n\n` +
    link
  );

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      avisar("Não deu pra copiar. Segure o link pra copiar.", { tipo: "erro" });
    }
  };

  const abrirWhatsApp = () => {
    window.open(`https://wa.me/?text=${mensagemWpp}`, "_blank");
  };

  const compartilharNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Doonly - Gestão pra confeiteiras",
          text: `Tô usando o Doonly! Entra pelo meu link e ganha 70% OFF no 1º mês do PRO`,
          url: link,
        });
      } catch {}
    } else {
      abrirWhatsApp();
    }
  };

  // Próximo prêmio (o primeiro com meta > conversoes)
  const proximoIdx = PREMIOS.findIndex(p => p.meta > conversoes);
  const proximo = proximoIdx >= 0 ? PREMIOS[proximoIdx] : null;
  const anterior = proximoIdx > 0 ? PREMIOS[proximoIdx - 1].meta : 0;

  return (
    <>
    <AppPageHeader title="Indique e ganhe" subtitle="Prêmios por cada assinante que você indicar" />
    <div className="in9">
      <div className="in9-col">
        <img className="in9-banner" src="/Sistema/bannerindica.png" alt="Suas indicações viram recompensas. Convide pro Doonly e ganhe prêmios exclusivos." />

        {/* Seu link */}
        <section className="in9-card">
          <h2 className="in9-t">Seu link</h2>
          {loading ? <div className="in9-esq" /> : (<>
            <div className="in9-link">
              <span className="in9-link-tx">doonly.com.br/?ref=<b>{codigo || "…"}</b></span>
              <Botao variante="secundario" tamanho="m" icone={copiado ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />} onClick={copiarLink}>{copiado ? "Copiado" : "Copiar"}</Botao>
            </div>
            <Botao cheio className="in9-zap" icone={<WhatsappLogo size={20} weight="fill" />} onClick={abrirWhatsApp}>Mandar no WhatsApp</Botao>
            <Botao variante="link" cheio icone={<ShareNetwork size={18} weight="bold" />} onClick={compartilharNativo}>Outras formas de mandar</Botao>
          </>)}
        </section>

        {/* Prêmios */}
        <section className="in9-card">
          <h2 className="in9-t">Seus prêmios</h2>
          <div className="in9-premios">
            {PREMIOS.map((p, idx) => {
              const ganhou = conversoes >= p.meta;
              const eProximo = idx === proximoIdx;
              return (
                <div key={p.meta} className={`in9-pr${eProximo ? " prox" : ""}${ganhou ? " ok" : ""}`}>
                  <span className="in9-pr-f"><img src={p.imagem} alt="" /></span>
                  <div className="in9-pr-tx">
                    <b>{p.titulo}</b>
                    <small>{p.desc}</small>
                    {ganhou ? (
                      <span className="in9-tag ok"><Trophy size={14} weight="fill" />Conquistado</span>
                    ) : eProximo ? (
                      <span className="in9-tag prox">Próximo · {p.meta} assinantes</span>
                    ) : (
                      <span className="in9-tag"><Lock size={14} weight="bold" />{p.meta} assinantes</span>
                    )}
                    {ganhou && (
                      <a href="https://wa.me/5511978414991?text=Oi! Quero resgatar meu pr%C3%AAmio de indica%C3%A7%C3%A3o do Doonly." target="_blank" rel="noopener" className="in9-resgatar">
                        <WhatsappLogo size={18} weight="fill" />Resgatar pelo WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="in9-col">
        {/* Andamento */}
        <section className="in9-card in9-and">
          <small>Assinantes pelo seu link</small>
          <b className="in9-num">{conversoes}</b>
          {proximo ? (<>
            <p>{conversoes === 0
              ? <>Com <b>{proximo.meta} assinantes</b> você ganha: {proximo.titulo.charAt(0).toLowerCase() + proximo.titulo.slice(1)}.</>
              : <>Faltam <b>{proximo.meta - conversoes}</b> pro próximo prêmio: {proximo.titulo.charAt(0).toLowerCase() + proximo.titulo.slice(1)}.</>}</p>
            <div className="in9-barra" role="progressbar" aria-valuemin={anterior} aria-valuemax={proximo.meta} aria-valuenow={conversoes} aria-label="Andamento até o próximo prêmio">
              <i style={{ width: `${Math.min(100, ((conversoes - anterior) / (proximo.meta - anterior)) * 100)}%` }} />
            </div>
          </>) : <p>Você conquistou todos os prêmios. Obrigada!</p>}
        </section>

        {/* Quem entrou */}
        <section className="in9-card">
          <h2 className="in9-t">Quem entrou pelo seu link{amigas.length > 0 && <i>{amigas.length}</i>}</h2>
          {amigas.length === 0 ? (
            <div className="in9-vazio">
              <UsersThree size={28} weight="duotone" />
              <b>Ninguém ainda</b>
              <small>Mande seu link e acompanhe aqui quem entra no Doonly por ele.</small>
            </div>
          ) : (
            <div className="in9-amigas">
              {amigas.map((a, idxA) => {
                const isPro = a.status === "pro" || a.status === "premio_resgatado";
                const dias = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000);
                const tempoTxt = dias <= 0 ? "Entrou hoje" : dias === 1 ? "Entrou ontem" : `Entrou há ${dias} dias`;
                return (
                  <div key={a.id || `amiga-${idxA}`} className="in9-am">
                    <span className="in9-am-av" aria-hidden="true">{(a.nome || "?").trim().charAt(0).toUpperCase()}</span>
                    <span className="in9-am-tx"><b>{a.nome || "Colega"}</b><small>{tempoTxt}</small></span>
                    <span className={`in9-tag${isPro ? " ok" : ""}`}>{isPro ? "PRO" : "Grátis"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Como funciona */}
        <section className="in9-card">
          <h2 className="in9-t">Como funciona</h2>
          <ol className="in9-passos">
            <li><i>1</i><span>Mande seu link pra quem trabalha com confeitaria.</span></li>
            <li><i>2</i><span>Quem se cadastra pelo seu link ganha 70% de desconto no 1º mês do PRO.</span></li>
            <li><i>3</i><span>Quando a pessoa assina o PRO, conta 1 indicação. Chegou na meta, o prêmio é seu.</span></li>
          </ol>
        </section>
      </div>
    </div>
    </>
  );
}
