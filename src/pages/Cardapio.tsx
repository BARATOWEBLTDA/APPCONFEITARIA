import { COMO_CARDAPIO, COMO_MINHA_LOJA, TOUR_CARDAPIO } from "@/lib/comoTelas";
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { useState, useEffect, useRef } from "react";
import VisaoGeralDesktop from "@/components/cardapio/VisaoGeralDesktop";
import { useNavigate } from "react-router-dom";
import { Package, WarningCircle } from "@phosphor-icons/react";
import { Botao, TelaVazia } from "@/components/base";
import { useProfile, getCardapioUrl, isPro } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import AppPageHeader from "@/components/AppPageHeader";
import PassoAPassoCardapio from "@/components/PassoAPassoCardapio";
import CartaoLojaCelular from "@/components/cardapio/CartaoLojaCelular";
import MinhaLoja from "@/components/cardapio/MinhaLoja";

type MaisVendido = { nome: string; qtd: number; imagem?: string };

/**
 * Tela Cardápio.
 * Computador: Visão geral (VisaoGeralDesktop), com desempenho, visitas por dia e últimos pedidos.
 * Celular (23/10): "Minha loja", no estilo do Dora: o cartão da loja, a loja para o cliente, como você vende,
 * o que você vende e, para quem é PRO, os mais vendidos dos últimos 30 dias (sem os números e os gráficos).
 */
export default function Cardapio() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const pro = isPro(profile);

  const [maisVendidos, setMaisVendidos] = useState<MaisVendido[]>([]);
  const [loading, setLoading] = useState(false);
  // (11/10) erro de leitura não vira lista vazia: mostra "Não deu para carregar" com "Tentar de novo"
  const [erroLeitura, setErroLeitura] = useState(false);
  // resposta de uma busca antiga (saiu e voltou rápido) é descartada
  const buscaAtual = useRef(0);
  // Computador (com o menu lateral do cardápio): Visão geral nova, sem as listas de atalhos (02/10)
  const [ehComputador, setEhComputador] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setEhComputador(mq.matches);
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);

  // Nova arquitetura: cardápio publicado quando profile.codigo_publico existe.
  const linkCardapio = getCardapioUrl(profile);
  const publicado = !!profile?.codigo_publico;

  // ─── Mais vendidos pelo cardápio nos últimos 30 dias (só no celular e só PRO) ───
  const carregarMaisVendidos = async () => {
    if (!profile?.id) return;
    const minha = ++buscaAtual.current;
    setLoading(true);
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - 30);
      // (11/10) de 1.000 em 1.000, senão a lista vinha cortada
      const res = await buscarTudo<any>((de, ate) => supabase
        .from("pedidos")
        .select("id, status, pedido_itens(nome_produto, quantidade, produtos(imagem_url))")
        .eq("user_id", profile.id)
        .eq("origem", "cardapio")
        .gte("created_at", desde.toISOString())
        .order("id")
        .range(de, ate));
      if (minha !== buscaAtual.current) return;
      if (res.error) throw res.error;
      // 10/10: pedido cancelado não é venda
      const contagem: Record<string, { qtd: number; imagem?: string }> = {};
      (res.data || []).filter((p: any) => p.status !== "cancelado").forEach((p: any) => {
        p.pedido_itens?.forEach((item: any) => {
          if (!contagem[item.nome_produto]) contagem[item.nome_produto] = { qtd: 0, imagem: item.produtos?.imagem_url };
          contagem[item.nome_produto].qtd += Number(item.quantidade) || 0;
        });
      });
      setMaisVendidos(Object.entries(contagem).sort((a, b) => b[1].qtd - a[1].qtd).slice(0, 3)
        .map(([nome, info]) => ({ nome, qtd: info.qtd, imagem: info.imagem })));
      setErroLeitura(false);
    } catch (err) {
      if (minha !== buscaAtual.current) return;
      console.error("Erro ao carregar os mais vendidos:", err);
      setErroLeitura(true);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (!profile?.id || ehComputador || !pro) return;
    carregarMaisVendidos();
    return () => { buscaAtual.current++; };
  }, [profile?.id, ehComputador, pro]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Ações ───
  const handleShare = async () => {
    if (!publicado) {
      navigate("/cardapio-config");
      return;
    }
    await compartilharCardapio(linkCardapio, profile?.nome_loja); // (16/10) nativo; no computador copia
  };

  // ─── Render ───
  return (
    <>
    <AppPageHeader
      title={ehComputador ? "Cardápio digital" : "Minha loja"}
      subtitle={ehComputador ? "A loja online da sua confeitaria" : "Cardápio, horário e entrega"}
      infoIcon="🛍️" infoComo={ehComputador ? COMO_CARDAPIO : COMO_MINHA_LOJA} infoTour={TOUR_CARDAPIO}
      infoContent={
        <>
          <p>Este é o <strong>cardápio digital</strong> que seus clientes acessam. Personalize as cores, adicione produtos, configure entrega e pagamento.</p>
          <p>Depois é só <strong>compartilhar o link</strong> no WhatsApp, Instagram, bio, ou onde preferir. Seus clientes fazem pedidos direto por lá.</p>
        </>
      }
      infoTip={<>Copie o link do seu cardápio e coloque na <strong>bio do Instagram</strong> ou envie no WhatsApp.</>}
    />
    {ehComputador ? (
      <VisaoGeralDesktop profile={profile} linkCardapio={linkCardapio} publicado={publicado} onShare={handleShare} />
    ) : (
    <div className="cardapio-hub">
      {/* (23/10) sem o cartão de Primeiros passos (ele fica no Início): o que falta aparece como "Falta" em cada linha.
          No topo, o cartão da loja: situação, chave de pausar, Compartilhar, Ver e QR Code */}
      {publicado && linkCardapio ? <CartaoLojaCelular link={linkCardapio} /> : (
        <PassoAPassoCardapio userId={profile?.id} publicado={publicado} linkCardapio={linkCardapio} onShareClick={handleShare} />
      )}
      {/* (23/10) "Minha loja", no estilo do Dora: a loja para o cliente, como você vende e o que você vende, cada linha com o valor atual */}
      <MinhaLoja uid={profile?.id} pro={pro} />

      {/* (23/10) no celular, do desempenho fica só o que ajuda a decidir: os mais vendidos (PRO), sem os números e o período.
          Visitas, conversão e gráficos continuam no computador */}
      {pro && erroLeitura && (
        <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os mais vendidos" texto="Confira a internet e tente de novo."
          acao={<Botao variante="suave" tamanho="m" carregando={loading} onClick={() => carregarMaisVendidos()}>Tentar de novo</Botao>} />
      )}
      {pro && !erroLeitura && maisVendidos.length > 0 && (
        <section className="dl-emb ch-block--vendidos" aria-label="Mais vendidos nos últimos 30 dias">
          <h2 className="dl-emb-t">Mais vendidos nos últimos 30 dias</h2>
          <div className="dl-lista-c">
            {maisVendidos.map((p, idx) => (
              <div key={p.nome} className="dl-li dl-li--fixa">
                <span className="ml-rank" aria-label={`${idx + 1}º lugar`}>{idx + 1}º</span>
                {p.imagem ? <img className="dl-li-img" src={p.imagem} alt="" /> : <span className="dl-li-ic" aria-hidden="true"><Package size={20} weight="bold" /></span>}
                <span className="dl-li-tx"><b>{p.nome}</b><small>{p.qtd} {p.qtd === 1 ? "venda" : "vendas"}</small></span>
              </div>
            ))}
          </div>
        </section>
      )}

      {pro && loading && <div className="ch-loading">Carregando…</div>}

      <style>{`
        /* (23/10) Minha loja: os blocos usam as linhas de Dados da loja (dadosLoja.css); aqui só o espaço da tela */
        .cardapio-hub { font-family: var(--font-base); display: flex; flex-direction: column; gap: 12px; max-width: 980px; margin: 0 auto; padding: 16px 8px 112px; }
        .ch-loading { text-align: center; padding: var(--space-4); color: var(--text-muted); font-size: var(--font-button); }
      `}</style>
    </div>
    )}
    </>
  );
}
