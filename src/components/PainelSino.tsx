import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import AbasAvisos from "@/components/AbasAvisos";
import { ConteudoNotif } from "@/pages/Notificacoes";
import { ConteudoNovidades } from "@/pages/Noticias";

/**
 * (09/11) Computador: o sino abre este painel por cima da tela (o padrão de Shopify, Stripe, Linear, GitHub), sem trocar
 * de página. Abas Notificações e Novidades, a mesma lista do celular, "Ver todas" no rodapé.
 * Fecha ao clicar fora, no Esc ou ao abrir uma notificação/novidade.
 */
export default function PainelSino({ fechar, ancora }: { fechar: () => void; ancora: React.RefObject<HTMLElement> }) {
  const navigate = useNavigate();
  const [aba, setAba] = useState<"notificacoes" | "novidades">("notificacoes");
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      const t = e.target as Node;
      if (caixa.current?.contains(t) || ancora.current?.contains(t)) return;
      fechar();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [fechar, ancora]);

  return (
    <>
    {/* (09/11) escurece em volta: o foco fica no painel; clicar no escuro fecha */}
    <div className="sp-fundo" aria-hidden="true" />
    <div ref={caixa} className="sp" role="dialog" aria-label="Notificações"
      // tocar numa novidade (é um link) também fecha
      onClick={e => { if ((e.target as HTMLElement).closest("a")) fechar(); }}>
      <div className="sp-cab"><b>Notificações</b></div>
      <div className="sp-abas"><AbasAvisos atual={aba} onTrocar={setAba} /></div>
      <div className="sp-lista">
        {aba === "notificacoes" ? <ConteudoNotif aoIr={fechar} /> : <ConteudoNovidades />}
      </div>
      <button type="button" className="sp-todas" onClick={() => { fechar(); navigate(aba === "notificacoes" ? "/notificacoes" : "/noticias"); }}>
        Ver todas <CaretRight size={14} weight="bold" aria-hidden="true" />
      </button>
      <style>{`
        .sp-fundo { position: fixed; inset: 0; z-index: 59; background: rgba(36, 26, 30, .32); animation: spFundo .16s ease-out; }
        @keyframes spFundo { from { opacity: 0; } to { opacity: 1; } }
        .sp { position: absolute; top: calc(100% + 10px); right: 0; z-index: 60; display: flex; flex-direction: column; width: 420px; max-height: min(640px, calc(100vh - 110px)); overflow: hidden; border: 1px solid #ECE7E9; border-radius: 16px; background: #F4F3F3; box-shadow: 0 18px 48px rgba(36, 26, 30, .16), 0 2px 8px rgba(36, 26, 30, .06); font-family: var(--font-base); text-align: left; animation: spEntra .14s ease-out; }
        @keyframes spEntra { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        .sp-cab { padding: 16px 18px 10px; background: #fff; }
        .sp-cab b { font-size: 16px; font-weight: 500; color: #3B3236; }
        .sp-abas { padding: 0 14px 12px; background: #fff; border-bottom: 1px solid #ECE7E9; }
        .sp-abas .aba-av { margin: 0; }
        .sp-lista { flex: 1; min-height: 0; overflow-y: auto; padding: 0 12px 12px; overscroll-behavior: contain; }
        .sp-lista .nf-topo { margin-top: 12px; }
        .sp-lista .nf-dia { margin: 14px 2px 6px; }
        .sp-lista .nf-it { min-height: 62px; padding: 9px 12px; }
        .sp-lista .ui-vazio, .sp-lista [class*="tela-vazia"] { margin: 24px 0; }
        .sp-lista .nl-lista { margin: 12px 0 0; overflow: hidden; border: 1px solid #ECE7E9; border-radius: 16px; }
        .sp-lista .nl-it { gap: 12px; padding: 12px 14px; }
        .sp-lista .nl-it-img { width: 64px; height: 36px; }
        .sp-lista .nl-it-t, .sp-lista .nl-it-d { -webkit-line-clamp: 1; }
        .sp-lista .nl-it-t { font-size: 14px; }
        .sp-lista .nl-it-d { font-size: 12.5px; }
        .sp-lista .nl-it { align-items: center; }
        .sp-lista .nl-it time { font-size: 12px; }
        .sp-todas { display: flex; align-items: center; justify-content: center; gap: 4px; flex: none; height: 46px; margin: 0; padding: 0; border: 0; border-top: 1px solid #ECE7E9; background: #fff; font-family: inherit; font-size: 13.5px; font-weight: 500; color: var(--ui-rosa-botao, #CC2E66); cursor: pointer; }
        .sp-todas:hover { background: #FAF8F9; }
      `}</style>
    </div>
    </>
  );
}
