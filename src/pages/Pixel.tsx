// ── Pixel.tsx ────────────────────────────────────────────────────────────────
// (04/11 · 6.20) Pixel das 3 plataformas (saiu do Marketing): Meta (Facebook e Instagram),
// Google (Analytics/Ads) e TikTok. Cada uma guarda o código no perfil e o cardápio público
// carrega o pixel e manda os eventos (visita, sacola, finalizar e pedido com o valor). Recurso do PRO.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { CheckCircle, FacebookLogo, GoogleLogo, TiktokLogo, CaretDown, Lightbulb } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Campo, avisar } from "@/components/base";
import { supabase } from "@/lib/supabase";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { abrirConvitePro, CartaoPro } from "@/components/billing/RecursoPro";
import { pixelValido, googleValido, tiktokValido } from "@/lib/facebookPixel";
import "./marketing.css";

type Plataforma = {
  coluna: "facebook_pixel_id" | "google_tag_id" | "tiktok_pixel_id";
  nome: string; sub: string; subCel: string; Ic: Icon; cor: string;
  rotulo: string; exemplo: string; dica: string; erro: string;
  limpar: (v: string) => string; valido: (v: string) => boolean;
  passos: React.ReactNode[];
};

const PLATAFORMAS: Plataforma[] = [
  { coluna: "facebook_pixel_id", nome: "Meta", sub: "Facebook e Instagram", subCel: "Insta e Facebook", Ic: FacebookLogo, cor: "#1877F2",
    rotulo: "ID do pixel", exemplo: "Ex.: 123456789012345", dica: "Só os números.", erro: "O ID do pixel do Meta tem só números (de 10 a 20).",
    limpar: v => v.replace(/\D/g, "").slice(0, 20), valido: v => pixelValido(v),
    passos: [<>Abra o <b>Gerenciador de Eventos</b> (business.facebook.com).</>, <>Em <b>Fontes de dados</b>, escolha o pixel. Sem pixel? Toque em <b>Conectar dados</b> e crie um.</>, <>Copie o número embaixo do nome do pixel e cole aqui.</>] },
  { coluna: "google_tag_id", nome: "Google", sub: "Analytics e Google Ads", subCel: "Analytics e Ads", Ic: GoogleLogo, cor: "#EA4335",
    rotulo: "ID da tag do Google", exemplo: "Ex.: G-AB12CD34EF", dica: "Começa com G- (Analytics) ou AW- (Ads).", erro: "A tag do Google começa com G- ou AW-. Ex.: G-AB12CD34EF.",
    limpar: v => v.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24), valido: v => googleValido(v),
    passos: [<>No <b>Google Analytics</b>, abra <b>Administrador</b> › <b>Fluxos de dados</b> e escolha o site.</>, <>Copie o <b>ID da métrica</b> (começa com G-) e cole aqui.</>, <>Usa o <b>Google Ads</b>? Em <b>Ferramentas</b> › <b>Tag do Google</b>, copie o ID que começa com AW-.</>] },
  { coluna: "tiktok_pixel_id", nome: "TikTok", sub: "Anúncios do TikTok", subCel: "Anúncios", Ic: TiktokLogo, cor: "#111111",
    rotulo: "ID do pixel", exemplo: "Ex.: C9ABCDEF12GHIJ34KLMN", dica: "Letras e números, sem espaços.", erro: "O ID do pixel do TikTok tem letras e números (de 15 a 30).",
    limpar: v => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30), valido: v => tiktokValido(v),
    passos: [<>Abra o <b>TikTok Ads Manager</b> › <b>Ferramentas</b> › <b>Eventos</b>.</>, <>Escolha <b>Eventos da web</b> e o seu pixel. Sem pixel? Crie um com <b>Configurar eventos da web</b>.</>, <>Copie o <b>ID do pixel</b> (letras e números) e cole aqui.</>] },
];

function CartaoPixel({ p, salvo, onSalvo }: { p: Plataforma; salvo: string; onSalvo: () => Promise<void> }) {
  const { profile } = useProfile();
  const { isPro, loading: carregandoPlano } = usePlano();
  const [v, setV] = useState(salvo);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [como, setComo] = useState(false);
  useEffect(() => { setV(salvo); }, [salvo]);
  const erro = tentou && v && !p.valido(v) ? p.erro : undefined;
  const gravar = async (valor: string | null) => {
    if (!profile?.id) return;
    setSalvando(true);
    const { error } = await supabase.from("profiles").update({ [p.coluna]: valor }).eq("id", profile.id);
    setSalvando(false);
    if (error) { avisar("Não deu para salvar. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    await onSalvo();
    avisar(valor ? `Pixel do ${p.nome} salvo. Ele já roda no seu cardápio.` : `Pixel do ${p.nome} desligado.`, { tipo: "ok" });
  };
  const salvar = () => {
    if (!carregandoPlano && !isPro && v) { abrirConvitePro("pixel"); return; }
    setTentou(true);
    if (!v) { void gravar(null); return; }
    if (p.valido(v)) void gravar(v);
  };
  return (
    <section className="pxl-card">
      <div className="pxl-cab">
        <span className="pxl-ic" aria-hidden="true" style={{ color: p.cor }}><p.Ic size={26} weight="fill" /></span>
        <span className="pxl-tx"><b>{p.nome}</b><small><span className="pxl-sub-pc">{p.sub}</span><span className="pxl-sub-cel">{p.subCel}</span></small></span>
        <span className={`mk-status${salvo ? " on" : ""}`}>{salvo ? "Ativo" : "Desligado"}</span>
      </div>
      <Campo rotulo={p.rotulo} placeholder={p.exemplo} autoComplete="off" spellCheck={false} value={v} erro={erro} dica={p.dica}
        onChange={e => setV(p.limpar(e.target.value))} />
      <div className="mk-acoes">
        <Botao tamanho="m" onClick={salvar} carregando={salvando} disabled={v === salvo}>Salvar</Botao>
        {salvo && <Botao tamanho="m" variante="link" onClick={() => { setV(""); void gravar(null); }}>Desligar</Botao>}
      </div>
      <button type="button" className="pxl-como" aria-expanded={como} onClick={() => setComo(c => !c)}>
        Onde acho o código? <CaretDown size={14} weight="bold" aria-hidden="true" style={{ transform: como ? "rotate(180deg)" : undefined }} />
      </button>
      {como && <ol className="pxl-passos">{p.passos.map((x, i) => <li key={i}>{x}</li>)}</ol>}
    </section>
  );
}

export default function Pixel() {
  const { profile } = useProfile();
  const { isPro, loading: carregandoPlano } = usePlano(); // (6.118) grátis: o convite do PRO no topo, como nas outras telas do PRO
  const pf = (profile || {}) as Partial<Record<Plataforma["coluna"], string | null>>;
  return (
    <>
      <AppPageHeader title="Pixel" voltar="/cardapio" subtitle="Meça as visitas e as vendas dos seus anúncios"
        infoContent={<><p>O pixel conta para o <strong>Meta</strong> (Facebook e Instagram), o <strong>Google</strong> e o <strong>TikTok</strong> quem visitou o seu cardápio e quem fez pedido.</p><p>Com isso os anúncios chegam em quem tem mais chance de comprar, e você vê quanto cada anúncio vendeu.</p></>} />
      <div className="pxl">
        {!isPro && !carregandoPlano && <div className="pxl-pro"><CartaoPro recurso="pixel" /></div>}
        {PLATAFORMAS.map(p => <CartaoPixel key={p.coluna} p={p} salvo={String(pf[p.coluna] || "")} onSalvo={async () => { await refreshProfile(); }} />)}
        <section className="pxl-card pxl-ev">
          <b className="pxl-ev-t">O que o pixel registra</b>
          {["Visita ao cardápio", "Produto colocado na sacola", "Começou a finalizar o pedido", "Pedido enviado, com o valor"].map(t => (
            <span key={t}><CheckCircle size={18} weight="fill" aria-hidden="true" />{t}</span>
          ))}
          <p className="mk-dica"><Lightbulb size={18} weight="bold" aria-hidden="true" />Depois de salvar, abra o seu cardápio uma vez. Em alguns minutos a plataforma mostra a primeira visita.</p>
        </section>
      </div>
      <style>{`
        .pxl-pro { grid-column: 1 / -1; }
        .pxl { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; max-width: 1080px; padding: 16px; font-family: var(--font-base); }
        @media (min-width: 900px) { .pxl { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 24px; } }
        .pxl-card { display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .pxl-cab { display: flex; align-items: center; gap: 12px; }
        .pxl-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: #F4F1F2; }
        .pxl-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .pxl-tx b { font-size: 15.5px; font-weight: 600; color: var(--ui-texto); }
        .pxl-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pxl-sub-cel { display: none; } @media (max-width: 420px) { .pxl-sub-pc { display: none; } .pxl-sub-cel { display: inline; } }
        .pxl-como { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
        .pxl-passos { margin: 0; padding: 12px 14px 12px 32px; border-radius: 12px; background: #F7F4F5; font-size: 13.5px; line-height: 1.5; color: var(--ui-texto-2); }
        .pxl-passos li { display: list-item; white-space: normal; }
        .pxl-passos li + li { margin-top: 6px; }
        .pxl-ev { gap: 10px; }
        .pxl-ev-t { font-size: 15px; font-weight: 600; color: var(--ui-texto); }
        .pxl-ev > span { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto); }
        .pxl-ev > span svg { flex: none; color: var(--ui-verde); }
      `}</style>
    </>
  );
}
