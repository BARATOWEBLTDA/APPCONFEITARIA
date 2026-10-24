import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cake, CaretRight, ChartBar, Crown, PaintBrush, SquaresFour, Stack, Storefront } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { avisar } from "@/components/base";
import { useRecorte } from "@/components/ui/useRecorte";
import DadosLoja from "@/pages/DadosLoja";

/**
 * (23/10) "Minha loja" do celular (tela Cardápio), no estilo do Dora: tudo da loja em uma tela só.
 * A loja para o cliente (logo, nome e WhatsApp, aparência, redes) · Como você vende (horário, entrega, pagamento, Pix, endereço)
 * · O que você vende (produtos, categorias, complementos). Cada linha mostra o valor atual; tocar abre a parte para editar.
 */
type Visual = { logo: string; foto: string; tema: string; banners: number };
type Contas = { produtos: number; categorias: number; complementos: number };

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default function MinhaLoja({ uid, pro }: { uid?: string; pro: boolean }) {
  const navigate = useNavigate();
  const [vis, setVis] = useState<Visual | null>(null);
  const [n, setN] = useState<Contas | null>(null);
  const [enviando, setEnviando] = useState(false);

  // logo, tema e banners (relê quando a Aparência salva)
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const ler = () => supabase.from("profiles").select("logo_url, foto_url, tema_cardapio, banner1_url, banner2_url, banner3_url").eq("id", uid).maybeSingle()
      .then(({ data }) => {
        if (!vivo || !data) return;
        const d: any = data;
        setVis({ logo: d.logo_url || "", foto: d.foto_url || "", tema: d.tema_cardapio === "natal" ? "Natal" : "Normal",
          banners: [d.banner1_url, d.banner2_url, d.banner3_url].filter(Boolean).length });
      }, () => {});
    ler();
    window.addEventListener("cardapio-design-saved", ler);
    return () => { vivo = false; window.removeEventListener("cardapio-design-saved", ler); };
  }, [uid]);

  // quantos produtos, categorias e complementos
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    const conta = (tabela: string) => supabase.from(tabela).select("id", { count: "exact", head: true }).eq("user_id", uid)
      .then(r => (r.error ? -1 : r.count ?? 0), () => -1);
    Promise.all([conta("produtos"), conta("categorias"), conta("biblioteca_extras")]).then(([produtos, categorias, complementos]) => {
      if (vivo) setN({ produtos, categorias, complementos });
    });
    return () => { vivo = false; };
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

  const img = vis?.logo || vis?.foto;
  const linhaLogo = (
    <div className="dl-li dl-li--fixa">
      {img ? <img className="dl-li-img" src={img} alt="" /> : <span className="dl-li-ic" aria-hidden="true"><Storefront size={20} weight="bold" /></span>}
      <span className="dl-li-tx"><b>Logo</b><small className={vis && !vis.logo ? "falta" : ""}>{!vis ? "…" : vis.logo ? "Na loja e no cardápio" : "Falta a logo da loja"}</small></span>
      <label className="dl-li-acao" aria-disabled={enviando}>
        {enviando ? "Enviando…" : vis?.logo ? "Trocar" : "Enviar"}
        <input type="file" accept="image/*" hidden disabled={enviando} onChange={recorte.escolher} />
      </label>
    </div>
  );
  const linhaAparencia = (
    <button type="button" className="dl-li" onClick={() => navigate("/cardapio-design")}>
      <span className="dl-li-ic" aria-hidden="true"><PaintBrush size={20} weight="bold" /></span>
      <span className="dl-li-tx"><b>Aparência</b><small>{!vis ? "…" : `Tema ${vis.tema} · ${vis.banners ? plural(vis.banners, "banner", "banners") : "sem banners"}`}</small></span>
      <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
    </button>
  );
  // (23/10) sem o cartão de Primeiros passos aqui: o que falta aparece como "Falta" na própria linha
  const linha = (Ic: typeof Cake, titulo: string, sub: string, rota: string, falta = false) => (
    <button type="button" className="dl-li" onClick={() => navigate(rota)}>
      <span className="dl-li-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span>
      <span className="dl-li-tx"><b>{titulo}</b><small className={falta ? "falta" : ""}>{sub}</small></span>
      {falta && <em className="dl-li-st falta">Falta</em>}
      <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
    </button>
  );
  const qtd = (v: number | undefined, um: string, varios: string, vazio: string) => v == null ? "…" : v < 0 ? varios.charAt(0).toUpperCase() + varios.slice(1) : v === 0 ? vazio : plural(v, um, varios);

  return (
    <>
      {recorte.janela}
      <DadosLoja embutido extras={{ antes: linhaLogo, depois: linhaAparencia }} />
      <section className="dl-emb ml-produtos" aria-label="O que você vende">
        <h2 className="dl-emb-t">O que você vende</h2>
        <div className="dl-lista-c">
          {linha(Cake, "Produtos", qtd(n?.produtos, "produto", "produtos", "Nenhum ainda"), "/produtos", n?.produtos === 0)}
          {linha(SquaresFour, "Categorias", qtd(n?.categorias, "categoria", "categorias", "Nenhuma categoria ainda"), "/categorias")}
          {linha(Stack, "Complementos", qtd(n?.complementos, "complemento", "complementos", "Sabores, recheios e adicionais"), "/complementos")}
        </div>
      </section>
      {!pro && (
        <section className="dl-emb" aria-label="Mais vendidos">
          <h2 className="dl-emb-t">Desempenho</h2>
          <div className="dl-lista-c">
            <button type="button" className="dl-li" onClick={() => navigate("/assinar")}>
              <span className="dl-li-ic" aria-hidden="true"><ChartBar size={20} weight="bold" /></span>
              <span className="dl-li-tx"><b>Mais vendidos</b><small>Os produtos mais pedidos pelo link</small></span>
              <em className="dl-li-st dl-li-pro"><Crown size={12} weight="fill" aria-hidden="true" />PRO</em>
              <CaretRight size={16} weight="bold" className="dl-li-seta" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
    </>
  );
}
