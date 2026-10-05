import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Janela que sobe de baixo (no computador, centralizada) — o mesmo padrão das janelas novas do financeiro.
 * Reaproveitada nas telas refeitas (Custos, Transações, Lucratividade).
 */
export default function Folha({ titulo, sub, onClose, children }: { titulo: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return createPortal(
    <div className="fo-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="fo" onClick={e => e.stopPropagation()}>
        <span className="fo-alca" aria-hidden="true" />
        <b className="fo-t">{titulo}</b>{sub && <small className="fo-s">{sub}</small>}
        {children}
      </div>
      <style>{FOLHA_CSS}</style>
    </div>, document.body);
}

/** Estilos dos campos dentro das janelas (fo-*) */
export const FOLHA_CSS = `
  .fo-ov { position: fixed; inset: 0; z-index: 1300; background: rgba(45,31,38,.5); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
  @media (min-width: 768px) { .fo-ov { align-items: center; } }
  .fo { width: 100%; max-width: 460px; background: #fff; border-radius: 22px 22px 0 0; padding: 10px 18px calc(18px + env(safe-area-inset-bottom, 0px)); max-height: 92dvh; overflow-y: auto; color: #2C1219; animation: foSobe .22s ease; }
  @media (min-width: 768px) { .fo { border-radius: 22px; } }
  @keyframes foSobe { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  .fo-alca { display: block; width: 40px; height: 4px; border-radius: 9px; background: #E5DDE1; margin: 0 auto 12px; }
  .fo-t { display: block; font-size: 19px; font-weight: 900; } .fo-s { display: block; font-size: 13px; color: #6B5D64; margin-top: 2px; line-height: 1.4; }
  .fo-lb { display: block; font-size: 13px; font-weight: 700; color: #4B3A42; margin: 14px 0 6px; } .fo-lb em { font-style: normal; font-weight: 500; color: #9A8E94; }
  .fo-in { display: flex; align-items: center; gap: 6px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; height: 48px; background: #fff; }
  .fo-in:focus-within { border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .fo-in span { font-size: 15px; color: #6B5D64; font-weight: 700; }
  .fo-in input { flex: 1; min-width: 0; border: none; outline: none; font-family: inherit; font-size: 17px; font-weight: 800; color: #2C1219; background: none; }
  .fo-txt { width: 100%; box-sizing: border-box; height: 48px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 0 12px; font-family: inherit; font-size: 16px; color: #2C1219; }
  .fo-txt:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
  .fo-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .fo-chips button { border: 1.5px solid #EDE6E9; background: #fff; border-radius: 10px; padding: 8px 12px; font-family: inherit; font-size: 13px; font-weight: 700; color: #2C1219; cursor: pointer; }
  .fo-chips button.on { border-color: #E85A8C; background: #FFF1F6; color: #C33A6E; }
  .fo-seg { display: flex; background: #F5F0F2; border-radius: 10px; padding: 3px; }
  .fo-seg button { flex: 1; border: none; background: none; border-radius: 8px; padding: 9px; font-family: inherit; font-size: 13.5px; font-weight: 800; color: #6B5D64; cursor: pointer; }
  .fo-seg button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .fo-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .fo-sw { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; padding: 12px; border: 1.5px solid #EDE6E9; border-radius: 12px; cursor: pointer; }
  .fo-sw b { display: block; font-size: 14px; } .fo-sw small { font-size: 12px; color: #6B5D64; }
  .fo-sw i { width: 42px; height: 24px; border-radius: 99px; background: #E5DDE1; position: relative; flex-shrink: 0; transition: background .15s; }
  .fo-sw i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
  .fo-sw.on i { background: #16A34A; } .fo-sw.on i::after { transform: translateX(18px); }
  .fo-dica { margin-top: 12px; background: #FAF7F8; border-radius: 12px; padding: 10px 12px; font-size: 12.5px; color: #4B3A42; line-height: 1.45; }
  .fo-dica b { color: #2C1219; }
  .fo-erro { margin: 10px 0 0; font-size: 13px; font-weight: 800; color: #DC2626; }
  .fo-cta { margin-top: 16px; width: 100%; border: none; border-radius: 14px; padding: 15px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
  .fo-cta.escuro { background: #2C1219; box-shadow: none; } .fo-cta.vermelho { background: #DC2626; box-shadow: none; }
  .fo-cta:disabled { opacity: .6; cursor: default; }
  .fo-sec { display: block; width: 100%; margin-top: 6px; border: none; background: none; padding: 12px; font-family: inherit; font-size: 14px; font-weight: 700; color: #DC2626; cursor: pointer; }
  .fo-sec.neutro { color: #6B5D64; }
`;
