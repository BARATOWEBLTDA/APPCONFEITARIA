import type { ReactNode } from "react";
import { Camera } from "@phosphor-icons/react";
import { getStatusLoja } from "@/components/cardapio/CardapioModelo1";
import { SeloVerificado } from "@/components/cardapio/SeloVerificado";
import { topoEscurecido } from "@/lib/coresCardapio";
import "./cardapioModelo1.css";

/**
 * (23/10) Prévia do topo do cardápio, com as mesmas peças (classes cm1-*) do cardápio de verdade:
 * faixa com a cor e os pontinhos (ou a foto do topo), logo à direita, nome com o selo, situação e "Sobre a loja",
 * e um pedaço da busca e das categorias. Usa as cores da loja, então acompanha o que ela escolher em Aparência.
 */
export type DadosPrevia = {
  nome_loja?: string | null; logo_url?: string | null; foto_url?: string | null; horario?: any; loja_pausada?: boolean | null;
  cor_navbar?: string | null; cor_borda?: string | null; cor_nome?: string | null; banner_topo_url?: string | null;
};

const ehBranco = (c?: string | null) => !c || ["#fff", "#ffffff", "#fefefe", "white", "transparent"].includes(c.trim().toLowerCase());
const clara = (hex: string) => {
  const c = hex.replace("#", ""); if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
};

export default function PreviaTopoCardapio({ d, onLogo, enviando = false }: { d: DadosPrevia; onLogo?: () => void; enviando?: boolean }) {
  // mesmas regras do CardapioModelo1
  const borda = d.cor_borda || "#E85A8C";
  const faixa = topoEscurecido(!ehBranco(d.cor_navbar) ? d.cor_navbar! : (!ehBranco(d.cor_borda) ? d.cor_borda! : "#BF6B84"));
  const corNome = d.cor_nome && !clara(d.cor_nome) ? d.cor_nome : "#2C1219";
  const status = d.loja_pausada ? { aberto: false, msg: "Pedidos pausados", curto: "Pedidos pausados" } : getStatusLoja(d.horario || null);
  const img = d.logo_url || d.foto_url || "";
  const nome = String(d.nome_loja || "").trim() || "Sua confeitaria";
  const logo: ReactNode = enviando ? <span className="ptc-vazio"><span className="ui-gira" aria-label="Enviando" /></span>
    : img ? <img src={img} alt="" />
    : <span className="ptc-vazio"><Camera size={24} weight="fill" aria-hidden="true" /><small>Sua logo</small></span>;
  return (
    <div className="ptc" aria-label="Prévia do topo do cardápio">
      <div className={`cm1-hero${d.banner_topo_url ? " cm1-hero--foto" : ""}`}>
        {d.banner_topo_url
          ? <div className="cm1-hero-img" style={{ backgroundImage: `url(${d.banner_topo_url})` }} />
          : <div className="cm1-hero-faixa" style={{ backgroundColor: faixa }}><span className="cm1-hero-pontos" /></div>}
      </div>
      <div className="cm1-content ptc-corpo">
        {onLogo
          ? <button type="button" className={`cm1-logo ptc-logo${img ? "" : " ptc-logo--vazia"}`} style={img ? { borderColor: borda } : undefined} onClick={onLogo} aria-label={img ? "Trocar a logo" : "Escolher a logo"}>{logo}</button>
          : <div className={`cm1-logo ptc-logo${img ? "" : " ptc-logo--vazia"}`} style={img ? { borderColor: borda } : undefined}>{logo}</div>}
        <b className="cm1-nome ptc-nome" style={{ color: corNome }}><span>{nome}</span><SeloVerificado tamanho={16} /></b>
        <div className="cm1-sl ptc-sl">
          {status ? (
            <span className={`cm1-sl-st${status.aberto ? " aberto" : ""}`}>
              <i aria-hidden="true" /><b>{status.msg.split(" · ")[0]}</b>
              {status.curto.includes(" · ") && <span> · {status.curto.split(" · ").slice(1).join(" · ")}</span>}
            </span>
          ) : <span />}
          <span className="ptc-sobre">Sobre a loja ›</span>
        </div>
        <div className="ptc-busca">Buscar no cardápio</div>
        <div className="ptc-cats"><b>Bolos</b><span>Doces</span><span>Salgados</span></div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .ptc { position: relative; overflow: hidden; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); text-align: left; font-family: var(--font-base); }
  .ptc .cm1-hero { height: 84px; }
  .ptc .cm1-hero--foto { height: 96px; }
  .ptc .ptc-corpo { margin-top: -18px; padding: 12px 14px 12px; background: var(--ui-branco); border-radius: 16px 16px 0 0; }
  .ptc .ptc-logo { top: -46px; right: 12px; width: 84px; height: 84px; border-width: 3px; box-shadow: 0 0 0 3px var(--ui-branco), 0 4px 12px rgba(44,18,25,.16); cursor: pointer; font-family: inherit; }
  .ptc .ptc-logo--vazia { border: 2px dashed #E8AFC4; background: #FFF4F8; padding: 0; }
  .ptc .ptc-vazio { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 100%; height: 100%; color: var(--ui-rosa-escuro); font-size: 11px; font-weight: 700; }
  .ptc .ptc-vazio small { font-size: 11px; font-weight: 700; }
  .ptc .ptc-nome { padding-right: 92px; font-size: 19px; white-space: nowrap; overflow: hidden; }
  .ptc .ptc-nome > span { overflow: hidden; text-overflow: ellipsis; }
  .ptc .ptc-sl { margin-top: 2px; font-size: 13px; }
  .ptc .ptc-sobre { flex: none; font-weight: 700; color: #EC4899; }
  .ptc .ptc-busca { display: flex; align-items: center; height: 38px; margin-top: 12px; padding: 0 12px; border: 1px solid var(--ui-borda); border-radius: 20px; font-size: 13px; color: var(--ui-texto-3); }
  .ptc .ptc-cats { display: flex; gap: 14px; margin-top: 12px; font-size: 13px; font-weight: 600; color: var(--ui-texto-3); white-space: nowrap; }
  .ptc .ptc-cats b { padding-bottom: 4px; border-bottom: 2px solid var(--ui-texto); color: var(--ui-texto); font-weight: 600; }
`;
