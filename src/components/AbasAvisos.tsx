import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { contarNovidadesNaoLidas } from "@/lib/notificacoesUsuario";
import { contarNotifConfeiteira } from "@/lib/notifConfeiteira";

/**
 * (09/11) As duas abas da página do sino: Notificações (o que é da confeiteira) e Novidades (o que o Doonly posta).
 * Cada aba mostra quantas ainda não foram lidas.
 */
export default function AbasAvisos({ atual, onTrocar }: { atual: "notificacoes" | "novidades"; onTrocar?: (k: "notificacoes" | "novidades") => void }) {
  const navigate = useNavigate();
  const [n, setN] = useState({ notif: 0, novid: 0 });
  useEffect(() => {
    const ler = () => { Promise.all([contarNotifConfeiteira(), contarNovidadesNaoLidas()]).then(([notif, novid]) => setN({ notif, novid })).catch(() => {}); };
    ler();
    window.addEventListener("doonly:notif-mudou", ler);
    window.addEventListener("doonly:notif-nova", ler);
    return () => { window.removeEventListener("doonly:notif-mudou", ler); window.removeEventListener("doonly:notif-nova", ler); };
  }, []);
  const ir = (k: "notificacoes" | "novidades") => { if (onTrocar) { onTrocar(k); return; } if (k !== atual) navigate(k === "notificacoes" ? "/notificacoes" : "/noticias", { replace: true }); };
  return (
    <div className="aba-av" role="tablist" aria-label="Notificações e novidades">
      <button type="button" role="tab" aria-selected={atual === "notificacoes"} className={atual === "notificacoes" ? "on" : ""} onClick={() => ir("notificacoes")}>
        Notificações{n.notif > 0 && <em>{n.notif > 9 ? "9+" : n.notif}</em>}
      </button>
      <button type="button" role="tab" aria-selected={atual === "novidades"} className={atual === "novidades" ? "on" : ""} onClick={() => ir("novidades")}>
        Novidades{n.novid > 0 && <em>{n.novid > 9 ? "9+" : n.novid}</em>}
      </button>
      <style>{`
        .aba-av { display: flex; gap: 4px; width: 100%; max-width: 720px; margin: 0 auto 4px; padding: 4px; box-sizing: border-box; border-radius: 12px; background: #E7E5E6; }
        .aba-av button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 38px; margin: 0; padding: 0 8px; border: 0; border-radius: 9px; background: none; font-family: inherit; font-size: 14px; font-weight: 500; color: #6B5F64; white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .aba-av button.on { background: #fff; color: #241A1E; box-shadow: 0 1px 3px rgba(0, 0, 0, .08); }
        .aba-av em { min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; background: var(--ui-rosa-botao, #CC2E66); color: #fff; font-style: normal; font-size: 11px; font-weight: 600; line-height: 18px; text-align: center; }
      `}</style>
    </div>
  );
}
