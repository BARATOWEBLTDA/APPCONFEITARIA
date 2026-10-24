import { useEffect, useState } from "react";
import { compartilharCardapio } from "@/lib/compartilharCardapio";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowSquareOut, Copy, Desktop, DeviceMobile, ShareNetwork } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile, getCardapioUrl } from "@/hooks/useProfile";
import { Botao, BotaoIcone, avisar } from "@/components/base";
import "./cardapioPrevia.css";

/**
 * Prévia do cardápio (08/10 · 3.27, no padrão do guia).
 * Mostra o cardápio de verdade (o link oficial) num celular ou na tela toda.
 * No celular, a prévia ocupa a tela e o topo traz Voltar e Compartilhar.
 */
type ViewMode = "mobile" | "desktop";

export default function CardapioPrevia() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("mobile");
  // Carregando dentro da moldura até o iframe avisar (onLoad); depois de 8s, oferece abrir em outra aba
  const [carregou, setCarregou] = useState(false);
  const [demorou, setDemorou] = useState(false);

  // Link oficial do cardápio (/c/código/slug). Sem ele, o endereço antigo (/cardapio/id).
  const { profile } = useProfile();
  useEffect(() => {
    const oficial = profile ? getCardapioUrl(profile) : "";
    if (oficial) { setUrl(oficial); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUrl(`${window.location.origin}/cardapio/${user.id}`);
    });
  }, [profile?.id, (profile as any)?.codigo_publico]);

  // (22/10) B11 · celular: abre o cardápio de verdade em tela cheia, com a faixa "Você está vendo como cliente"
  const celular = typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches;
  useEffect(() => {
    if (!celular || !url) return;
    let caminho = url;
    try { const u = new URL(url, window.location.origin); caminho = u.pathname + u.search; } catch { /* usa como veio */ }
    navigate(caminho + (caminho.includes("?") ? "&" : "?") + "comocliente=1", { replace: true });
  }, [celular, url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!url) return;
    setCarregou(false); setDemorou(false);
    const t = setTimeout(() => setDemorou(true), 8000);
    return () => clearTimeout(t);
  }, [url, viewMode]);

  const copiar = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("input");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    avisar("Link copiado", { tipo: "ok" });
  };

  const abrir = () => { if (url) window.open(url, "_blank"); };

  const compartilhar = async () => {
    if (!url) return;
    await compartilharCardapio(url); // (16/10) nativo; no computador copia
  };

  const espera = !carregou && (
    <div className="pv-espera" role="status">
      <span className="ui-gira" aria-hidden="true" />
      {demorou ? (
        <>
          <p>A prévia está demorando para carregar.</p>
          <Botao variante="secundario" tamanho="m" icone={<ArrowSquareOut size={20} weight="bold" />} onClick={abrir}>Abrir o cardápio em outra aba</Botao>
        </>
      ) : <p>Carregando a prévia…</p>}
    </div>
  );

  if (celular) return <div className="pv-carregando"><span className="ui-gira" aria-hidden="true" /><p>Abrindo seu cardápio…</p></div>;

  return (
    <div className="pv">
      <header className="pv-topo">
        <BotaoIcone rotulo="Voltar" variante="limpo" onClick={() => navigate("/cardapio")}><ArrowLeft size={20} weight="bold" /></BotaoIcone>
        <div className="pv-t"><b>Prévia do cardápio</b><small>É assim que o cliente vê</small></div>

        <div className="pv-modo" role="radiogroup" aria-label="Ver como">
          <button type="button" role="radio" aria-checked={viewMode === "mobile"} onClick={() => setViewMode("mobile")}><DeviceMobile size={20} weight="bold" />Celular</button>
          <button type="button" role="radio" aria-checked={viewMode === "desktop"} onClick={() => setViewMode("desktop")}><Desktop size={20} weight="bold" />Computador</button>
        </div>

        <div className="pv-acoes">
          <Botao variante="secundario" tamanho="m" icone={<ArrowSquareOut size={20} weight="bold" />} onClick={abrir} disabled={!url}>Abrir</Botao>
          <Botao tamanho="m" icone={<Copy size={20} weight="bold" />} onClick={copiar} disabled={!url}>Copiar link</Botao>
        </div>
        <BotaoIcone rotulo="Compartilhar o cardápio" variante="limpo" className="pv-share" onClick={compartilhar} disabled={!url}><ShareNetwork size={20} weight="bold" /></BotaoIcone>
      </header>

      {url ? (
        <div className={`pv-area pv-area--${viewMode}`}>
          {viewMode === "mobile" ? (
            <div className="pv-cel">
              <div className="pv-cel-tela"><iframe key={`m-${url}`} src={url} title="Prévia do cardápio no celular" onLoad={() => setCarregou(true)} />{espera}</div>
            </div>
          ) : (
            <div className="pv-pc-caixa">
              <iframe key={`d-${url}`} className="pv-pc" src={url} title="Prévia do cardápio no computador" onLoad={() => setCarregou(true)} />
              {espera}
            </div>
          )}
        </div>
      ) : (
        <div className="pv-carregando"><span className="ui-gira" aria-hidden="true" /><p>Carregando a prévia…</p></div>
      )}
    </div>
  );
}
