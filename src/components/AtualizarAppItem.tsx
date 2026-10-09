import { useEffect, useState } from "react";
import { ArrowsClockwise, CaretRight } from "@phosphor-icons/react";
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
    <button type="button" className="cf9-item" onClick={atualizar} disabled={atualizando}>
      <span className="cf9-ic cf9-ic--cinza" aria-hidden="true"><ArrowsClockwise size={20} weight="bold" className={atualizando ? "atz-girando" : undefined} /></span>
      <span className="cf9-tx">
        <b>Atualizar app</b>
        <small className={temNova ? "on" : ""}>
          {atualizando ? "Atualizando…" : temNova ? "Nova versão disponível"
            : (dataVersao(__BUILD_ID__) ? `Versão ${VERSAO_APP} · de ${dataVersao(__BUILD_ID__)}` : `Versão ${VERSAO_APP}`)}
        </small>
      </span>
      {temNova && !atualizando && <span className="cf9-ponto" aria-hidden="true" />}
      <CaretRight size={18} weight="bold" className="cf9-seta" aria-hidden="true" />
    </button>
  );
}
