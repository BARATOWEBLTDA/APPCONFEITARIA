import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, FacebookLogo, Lightbulb, Megaphone, Ticket } from "@phosphor-icons/react";
import CheckoutConfigPage from "./CheckoutConfigPage";
import { useLocation } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Campo, avisar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { pixelValido } from "@/lib/facebookPixel";
import "./marketing.css";

/**
 * Marketing (19/10): ferramentas pra divulgar a loja. Primeira aba: Pixel do Facebook.
 * O ID fica em profiles.facebook_pixel_id; o cardápio público carrega o pixel com ele (lib/facebookPixel).
 */
type Aba = "cupons" | "pixel";

export default function Marketing() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  // (19/10) Cupons vieram de Dados da loja pra cá (primeira aba)
  const loc = useLocation();
  const [aba, setAba] = useState<Aba>(new URLSearchParams(loc.search).get("aba") === "pixel" ? "pixel" : "cupons");
  const salvo = String((profile as any)?.facebook_pixel_id || "");
  const [id, setId] = useState(salvo);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setId(salvo); }, [salvo]);

  const limpo = id.replace(/\D/g, "");
  const erro = tentou && limpo && !pixelValido(limpo) ? "O ID do pixel tem só números (de 10 a 20)." : undefined;
  const mudou = limpo !== salvo;

  const gravar = async (valor: string | null) => {
    if (!profile?.id) return;
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({ facebook_pixel_id: valor }).eq("id", profile.id);
    setSalvando(false);
    if (error) { avisar("Não deu pra salvar. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    await refreshProfile();
    avisar(valor ? "Pixel salvo. Ele já roda no seu cardápio." : "Pixel removido do cardápio", { tipo: "ok" });
  };
  const salvar = () => { setTentou(true); if (!limpo) { void gravar(null); return; } if (pixelValido(limpo)) void gravar(limpo); };

  return (
    <>
      <AppPageHeader title="Marketing" subtitle="Ferramentas pra divulgar e vender mais"
        infoContent={<><p>Aqui ficam as ferramentas pra divulgar sua confeitaria.</p><p>O <strong>Pixel do Facebook</strong> conta pro Facebook e pro Instagram quem visitou o seu cardápio e quem fez pedido. Com isso os anúncios chegam em quem tem mais chance de comprar.</p></>} />
      <div className="mk">
        <div className="mk-abas" role="tablist" aria-label="Ferramentas de marketing">
          <button type="button" role="tab" aria-selected={aba === "cupons"} onClick={() => setAba("cupons")}><Ticket size={18} weight="bold" aria-hidden="true" />Cupons</button>
          <button type="button" role="tab" aria-selected={aba === "pixel"} onClick={() => setAba("pixel")}><FacebookLogo size={18} weight="fill" aria-hidden="true" />Pixel do Facebook</button>
          <span className="mk-aba-breve" aria-hidden="true"><Megaphone size={18} weight="bold" />Mais em breve</span>
        </div>

        {aba === "cupons" && <div className="mk-cupons"><CheckoutConfigPage embutido parte="cupons" /></div>}

        {aba === "pixel" && (
          <div className="mk-grid">
            <section className="mk-card">
              <div className="mk-cab">
                <span className="mk-ic" aria-hidden="true"><FacebookLogo size={26} weight="fill" /></span>
                <div><b>Pixel do Facebook</b><small>Facebook e Instagram</small></div>
                <span className={`mk-status${salvo ? " on" : ""}`}>{salvo ? "Ativo" : "Desligado"}</span>
              </div>
              <Campo rotulo="ID do pixel" placeholder="Ex.: 123456789012345" inputMode="numeric" autoComplete="off" maxLength={20}
                value={id} erro={erro} dica="Só os números. Deixe vazio pra desligar."
                onChange={e => setId(e.target.value.replace(/\D/g, ""))} />
              <div className="mk-acoes">
                <Botao onClick={salvar} carregando={salvando} disabled={!mudou && !!salvo}>Salvar</Botao>
                {salvo && <Botao variante="link" onClick={() => { setId(""); void gravar(null); }}>Remover pixel</Botao>}
              </div>
              <div className="mk-ev">
                <p>O que o pixel registra no seu cardápio</p>
                {["Visita ao cardápio", "Produto colocado na sacola", "Começou a finalizar o pedido", "Pedido enviado, com o valor"].map(t => (
                  <span key={t}><CheckCircle size={18} weight="fill" aria-hidden="true" />{t}</span>
                ))}
              </div>
            </section>

            <section className="mk-card mk-passos">
              <b className="mk-t">Onde achar o ID do pixel</b>
              <ol>
                <li>Abra o <strong>Gerenciador de Eventos</strong> da Meta (business.facebook.com).</li>
                <li>Em <strong>Fontes de dados</strong>, escolha o seu pixel. Se não tiver, toque em <strong>Conectar dados</strong> e crie um.</li>
                <li>Copie o número que aparece embaixo do nome do pixel e cole aqui.</li>
              </ol>
              <p className="mk-dica"><Lightbulb size={18} weight="bold" aria-hidden="true" />Depois de salvar, abra o seu cardápio uma vez. Em alguns minutos o Gerenciador de Eventos mostra a primeira visita.</p>
              <Botao variante="secundario" tamanho="m" onClick={() => navigate("/solicitar-recurso")}>Sugerir outra ferramenta</Botao>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
