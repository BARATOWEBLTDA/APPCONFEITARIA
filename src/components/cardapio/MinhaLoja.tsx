import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cake, CaretRight, ChartLineUp, ChatCircleText, Crown, FileText, LockSimple, PaintBrush, PlayCircle, Stack, Target, Ticket } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { avisar } from "@/components/base";
import { useRecorte } from "@/components/ui/useRecorte";
import DadosLoja from "@/pages/DadosLoja";

/**
 * (23/10) "Minha loja" do celular (tela Cardápio), no estilo do Dora: tudo da loja em uma tela só.
 * A loja para o cliente (logo, nome e WhatsApp, aparência, redes) · Como você vende (horário, entrega, pagamento, Pix, endereço)
 * · O que você vende (produtos, categorias, complementos). Cada linha mostra o valor atual; tocar abre a parte para editar.
 */
type Visual = { logo: string; foto: string; topo: string; banners: number };


export default function MinhaLoja({ uid, pro = true }: { uid?: string; pro?: boolean }) {
  const navigate = useNavigate();
  const [vis, setVis] = useState<Visual | null>(null);
  const [enviando, setEnviando] = useState(false);

  // logo, tema e banners (relê quando a Aparência salva)
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const ler = () => supabase.from("profiles").select("logo_url, foto_url, banner_topo_url, banner_url, banner1_url, banner2_url, banner3_url").eq("id", uid).maybeSingle()
      .then(({ data }) => {
        if (!vivo || !data) return;
        const d: { logo_url?: string | null; foto_url?: string | null; banner_topo_url?: string | null; banner_url?: string | null; banner1_url?: string | null; banner2_url?: string | null; banner3_url?: string | null } = data;
        setVis({ logo: d.logo_url || "", foto: d.foto_url || "", topo: d.banner_topo_url || "",
          banners: [d.banner_url, d.banner1_url, d.banner2_url, d.banner3_url].filter(Boolean).length }); // (27/10) o banner_url é o 1º dos 4 (antes contava 3)
      }, () => {});
    ler();
    window.addEventListener("cardapio-design-saved", ler);
    return () => { vivo = false; window.removeEventListener("cardapio-design-saved", ler); };
  }, [uid]);


  // Trocar a logo sem sair da tela: escolhe, recorta (redondo) e grava no perfil
  const recorte = useRecorte(async (foto) => {
    if (!uid) return;
    setEnviando(true);
    const caminho = `logos/${uid}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("products").upload(caminho, foto, { upsert: true, contentType: "image/jpeg" });
    if (error) { setEnviando(false); avisar("Não deu para enviar a logo. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    const url = `${supabase.storage.from("products").getPublicUrl(caminho).data.publicUrl}?t=${Date.now()}`;
    const r = await supabase.from("profiles").update({ logo_url: url }).eq("id", uid);
    // passo "Escolher design" do passo a passo (ignora erro, igual à Aparência)
    if (!r.error) supabase.from("profiles").update({ design_escolhido: true }).eq("id", uid).then(() => {}, () => {});
    setEnviando(false);
    if (r.error) { avisar("Não deu para salvar a logo. Tente de novo.", { tipo: "erro" }); return; }
    setVis(v => v ? { ...v, logo: url } : v);
    window.dispatchEvent(new CustomEvent("cardapio-design-saved"));
    avisar("Logo atualizada.");
  }, { aspect: 1, forma: "round" });

  const linhaAparencia = (
    <button type="button" className="dl-li" onClick={() => navigate("/cardapio-design")}>
      {/* (19/11) sempre o ícone (antes a logo entrava no lugar dele) */}
      <span className="dl-li-ic" aria-hidden="true"><PaintBrush size={20} weight="bold" /></span>
      <span className="dl-li-tx"><b>Aparência</b><small>Logo, foto do topo e cores</small></span>
      <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
    </button>
  );
  // (23/10) sem o cartão de Primeiros passos aqui: o que falta aparece como "Falta" na própria linha
  const linha = (Ic: typeof Cake, titulo: string, sub: string, rota: string, falta = false, trava = false) => (
    <button type="button" className="dl-li" onClick={() => navigate(rota)}>
      <span className="dl-li-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
      <span className="dl-li-tx"><b>{titulo}</b><small className={falta ? "falta" : ""}>{sub}</small></span>
      {trava ? <LockSimple size={16} weight="bold" className="dl-li-seta ml-trava" aria-hidden="true" /> : <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />}
    </button>
  );

  // (19/11) conta PRO: a linha do Stories mostra o que está no ar agora, como as outras linhas mostram o valor atual
  const [noAr, setNoAr] = useState<{ n: number; views: number } | null>(null);
  useEffect(() => {
    if (!uid || !pro) return;
    let vivo = true;
    void supabase.from("stories").select("views").eq("user_id", uid).gt("expira_em", new Date().toISOString()).then(({ data, error }) => {
      if (vivo && !error && data) setNoAr({ n: data.length, views: data.reduce((t, x) => t + (Number((x as { views?: number }).views) || 0), 0) });
    }, () => {});
    return () => { vivo = false; };
  }, [uid, pro]);
  const resumoStories = !noAr ? "Vídeos curtos no cardápio" : noAr.n === 0 ? "Nenhum no ar" : `${noAr.n} no ar · ${noAr.views} ${noAr.views === 1 ? "visualização" : "visualizações"}`;
  // linha da vitrine do PRO (conta grátis): coroa no lugar do cadeado, a frase diz o que ela ganha e o ícone fica apagado
  const linhaVitrine = (Ic: typeof Cake, titulo: string, beneficio: string, rota: string) => (
    <button type="button" className="dl-li ml-vit" onClick={() => navigate(rota)}>
      <span className="dl-li-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
      <span className="dl-li-tx"><b>{titulo}</b><small>{beneficio}</small></span>
      <Crown size={18} weight="fill" className="dl-li-seta ml-coroa" aria-label="Recurso do PRO" />
    </button>
  );
  const blocoPro = (
    <section className={`dl-emb${pro ? "" : " ml-suave"}`} aria-label={pro ? "Vender mais" : "Venda mais com o PRO"}>
      <h2 className="dl-emb-t ml-pro-t">{!pro && <Crown size={18} weight="fill" aria-hidden="true" />}<span>{pro ? "Vender mais" : "Venda mais com o PRO"}</span></h2>
      <div className="dl-lista-c">
        {pro ? (<>
          {linha(PlayCircle, "Stories", resumoStories, "/stories")}
          {linha(Stack, "Adicionais", "Topo, velas e outros extras", "/complementos")}
          {linha(Ticket, "Cupons", "Descontos pra vender mais", "/cupons")}
          {linha(Target, "Pixel", "Meta, Google e TikTok", "/pixel")}
        </>) : (<>
          {linhaVitrine(PlayCircle, "Stories", "Mostre o bolo do dia em vídeo", "/stories")}
          {linhaVitrine(FileText, "Orçamentos", "Feche festas com proposta pronta", "/orcamentos")}
          {linhaVitrine(Stack, "Adicionais", "Venda topo, vela e extras", "/complementos")}
          {linhaVitrine(Ticket, "Cupons", "Traga a cliente de volta", "/cupons")}
          {linhaVitrine(ChatCircleText, "Mensagens do WhatsApp", "Textos prontos, é só enviar", "/configuracoes/mensagens")}
          {linhaVitrine(Target, "Pixel", "Anuncie para quem viu a loja", "/pixel")}
        </>)}
      </div>
      <style>{`
        .ml-pro-t { display: flex; align-items: center; gap: 6px; } .ml-pro-t svg { flex: none; color: #E0A93B; }
        .ml-coroa { color: #E0A93B; opacity: .85; }
        .ml-suave .dl-li-tx b { color: #8A7E84; font-weight: 500; } .ml-suave .dl-li-tx small { color: #A2979C; } .ml-suave .dl-li-ic { opacity: .4; }
        /* título do PRO: degradê do dourado da coroa ao rosa, andando devagar (o único ponto vivo do bloco) */
        .ml-suave .ml-pro-t span { background: linear-gradient(90deg, #E0A93B, #CC2E66, #E85A8C, #E0A93B); background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: ml-corre 6s linear infinite; }
        @keyframes ml-corre { to { background-position: 200% 0; } }
        @media (prefers-reduced-motion: reduce) { .ml-suave .ml-pro-t span { animation: none; } }
      `}</style>
    </section>
  );

  return (
    <>
      {recorte.janela}
      {/* (6.170) métricas do cardápio (visitas, pedidos e mais pedidos) numa tela própria */}
      {/* (6.59) o que o cliente vê vem primeiro: produtos logo abaixo do cartão de compartilhar */}
      {/* (19/11) Minha loja em 3 blocos: "Seu cardápio" (o que a cliente vê + Métricas), "Como você vende" e o bloco do PRO.
          Grátis: o bloco do PRO é a vitrine, por último e apagado. PRO: é atalho de trabalho, em segundo e com as cores normais. */}
      <DadosLoja embutido extras={{
        titulo: "Seu cardápio",
        antes: <>{linha(Cake, "Produtos", "Preço, foto e sabores", "/produtos")}{linhaAparencia}</>,
        depois: linha(ChartLineUp, "Métricas", "Visitas e mais pedidos", "/cardapio-metricas"),
        entre: pro ? blocoPro : null,
      }} />
      {!pro && blocoPro}
    </>
  );
}
