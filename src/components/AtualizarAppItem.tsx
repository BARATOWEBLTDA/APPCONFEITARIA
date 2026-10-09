import { useEffect, useState } from "react";
import { VERSAO_APP } from "@/lib/versao";

/**
 * Item "Atualizar app" (Configurações → Ações rápidas).
 * Mostra a data da versão em uso e avisa se já existe uma mais nova no ar.
 * Tocar recarrega o app (tudo já fica salvo no banco, nada se perde).
 */
function dataVersao(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

export default function AtualizarAppItem() {
  const [temNova, setTemNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => { if (!cancelado && v?.id && v.id !== __BUILD_ID__) setTemNova(true); })
      .catch(() => { /* offline ou rodando em dev: ignora */ });
    return () => { cancelado = true; };
  }, []);

  const atualizar = () => {
    setAtualizando(true);
    window.location.reload();
  };

  return (
    <button className="cfgp-quick-item" onClick={atualizar} disabled={atualizando}>
      <span className="cfgp-quick-ico cfgp-quick-ico--gray">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={atualizando ? "atz-girando" : undefined}>
          <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </span>
      <div className="cfgp-quick-info">
        <div className="cfgp-quick-name">Atualizar app</div>
        <div className={`cfgp-quick-desc${temNova ? " atz-nova" : ""}`}>
          {atualizando
            ? "Atualizando..."
            : temNova
              ? "Nova versão disponível"
              : (dataVersao(__BUILD_ID__) ? `Versão ${VERSAO_APP} · de ${dataVersao(__BUILD_ID__)}` : `Versão ${VERSAO_APP}`)}
        </div>
      </div>
      {temNova && !atualizando && <span className="atz-dot" aria-hidden="true" />}
      <svg className="cfgp-quick-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
      <style>{`
        .atz-nova { color: #C33A6E !important; font-weight: 600; }
        .atz-dot { width: 8px; height: 8px; border-radius: 50%; background: #E85A8C; flex-shrink: 0; }
        .atz-girando { animation: atzGira 0.8s linear infinite; }
        @keyframes atzGira { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
