import { useEffect, useRef, useState } from "react";
import { WifiSlash } from "@phosphor-icons/react";
import { avisar } from "@/components/base";
import "./sistema.css";

/**
 * Sem internet (10/10): o aviso do próprio app, no lugar do silêncio (ou do erro em inglês).
 * Enquanto o aparelho estiver sem conexão, fica uma pílula no alto da tela; quando a conexão
 * volta, ela some e sobe o aviso rápido "Internet de volta.". Vale pro app e pro cardápio da cliente.
 */
export default function SemInternet() {
  const [fora, setFora] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const jaCaiu = useRef(fora);

  useEffect(() => {
    const caiu = () => { jaCaiu.current = true; setFora(true); };
    const voltou = () => {
      setFora(false);
      if (jaCaiu.current) { jaCaiu.current = false; avisar("Internet de volta."); }
    };
    window.addEventListener("offline", caiu);
    window.addEventListener("online", voltou);
    return () => { window.removeEventListener("offline", caiu); window.removeEventListener("online", voltou); };
  }, []);

  if (!fora) return <div className="sis-net-ar" aria-live="assertive" />;
  return (
    <div className="sis-net-ar" aria-live="assertive">
      <div className="sis-net" role="status">
        <span className="sis-net-ic" aria-hidden="true"><WifiSlash size={13} weight="bold" /></span>
        <span className="sis-net-t">Você está sem internet</span>
      </div>
    </div>
  );
}
