import { useEffect, useState } from "react";
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

  // Link oficial do cardápio (/c/código/slug). Sem ele, o endereço antigo (/cardapio/id).
  const { profile } = useProfile();
  useEffect(() => {
    const oficial = profile ? getCardapioUrl(profile) : "";
    if (oficial) { setUrl(oficial); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUrl(`${window.location.origin}/cardapio/${user.id}`);
    });
  }, [profile?.id, (profile as any)?.codigo_publico]);

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
    if (navigator.share) {
      try { await navigator.share({ title: "Meu cardápio", url }); } catch { /* fechou */ }
    } else {
      await copiar();
    }
  };

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
              <div className="pv-cel-tela"><iframe src={url} title="Prévia do cardápio no celular" /></div>
            </div>
          ) : (
            <iframe className="pv-pc" src={url} title="Prévia do cardápio no computador" />
          )}
        </div>
      ) : (
        <div className="pv-carregando"><span className="ui-gira" aria-hidden="true" /><p>Carregando a prévia…</p></div>
      )}
    </div>
  );
}
