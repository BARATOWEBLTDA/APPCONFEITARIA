import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Janelinha "Você chegou ao limite do plano grátis" (produtos ou clientes). */
export default function LimitePlano({ tipo, limite, onClose }: { tipo: "produtos" | "clientes"; limite: number; onClose: () => void }) {
  const navigate = useNavigate();
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  const txt = tipo === "produtos"
    ? { t: `Você chegou a ${limite} produtos`, s: `O plano grátis tem até ${limite} produtos no cardápio. No PRO, você cadastra todo o seu cardápio, sem limite.`, e: "🧁" }
    : { t: `Você chegou a ${limite} clientes`, s: `O plano grátis guarda até ${limite} clientes. No PRO, toda a sua clientela e o histórico de compras ficam num lugar só, sem limite.`, e: "👥" };
  return (
    <div className="lim-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label={txt.t}>
      <div className="lim-box" onClick={e => e.stopPropagation()}>
        <div className="lim-ic" aria-hidden="true">{txt.e}<img src="/coroa.png" alt="" /></div>
        <b className="lim-t">{txt.t}</b>
        <p className="lim-s">{txt.s}</p>
        <p className="lim-ok">✓ Tudo o que você já cadastrou continua salvo.</p>
        <button type="button" className="lim-cta" onClick={() => navigate("/assinar")}>Conhecer o PRO</button>
        <button type="button" className="lim-x" onClick={onClose}>Agora não</button>
      </div>
      <style>{`
        .lim-ov { position: fixed; inset: 0; z-index: 3000; background: rgba(45,31,38,.55); display: flex; align-items: flex-end; justify-content: center; font-family: var(--font-base); }
        @media (min-width: 768px) { .lim-ov { align-items: center; } }
        .lim-box { width: 100%; max-width: 420px; background: #fff; border-radius: 22px 22px 0 0; padding: 24px 22px calc(18px + env(safe-area-inset-bottom, 0px)); text-align: center; color: #2C1219; animation: limUp .25s ease; }
        @media (min-width: 768px) { .lim-box { border-radius: 22px; } }
        @keyframes limUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
        .lim-ic { position: relative; width: 64px; height: 64px; margin: 0 auto; border-radius: 18px; background: #FFF1F6; display: flex; align-items: center; justify-content: center; font-size: 30px; }
        .lim-ic img { position: absolute; right: -8px; top: -10px; width: 26px; height: 26px; object-fit: contain; }
        .lim-t { display: block; font-size: 19px; font-weight: 800; margin-top: 14px; letter-spacing: -.01em; }
        .lim-s { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 8px 4px 0; }
        .lim-ok { font-size: 12.5px; color: #15803D; font-weight: 700; margin: 12px 0 0; }
        .lim-cta { display: block; width: 100%; margin-top: 18px; border: none; border-radius: 12px; padding: 14px; font-family: inherit; font-size: 15px; font-weight: 700; color: #fff; background: #E85A8C; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; }
        .lim-x { display: block; width: 100%; margin-top: 8px; padding: 10px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 600; color: #9A8E94; cursor: pointer; }
      `}</style>
    </div>
  );
}
