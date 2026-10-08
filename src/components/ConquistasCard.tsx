import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight, Medal, Trophy, X } from "@phosphor-icons/react";
import { Botao, BotaoIcone, Janela } from "@/components/base";
import { useProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import { verificarAvisosPro } from "@/lib/notificacoesUsuario";
import { CONQUISTAS, marcarConquista, proximaConquista, sincronizarConquistas, type ResultadoConquistas } from "@/lib/conquistas";
import "./conquistasCard.css";

/**
 * Cartão "Suas conquistas" do Início + o aviso da conquista nova.
 * (07/10 · 3.09) Refeito no padrão do guia: cartão branco como os outros do Início, cores do themes.css (saíram o degradê,
 * a borda colorida, o lilás e o azul), ícone desenhado no lugar do emoji, e o aviso da conquista nova usa a janela do app.
 * A lógica (o que conta, quando comemora, o que marca como visto) é a mesma.
 */
export default function ConquistasCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const [r, setR] = useState<ResultadoConquistas | null>(null);
  const [celebrar, setCelebrar] = useState<string | null>(null);
  const ultimaCel = useRef<(typeof CONQUISTAS)[number] | null>(null);

  useEffect(() => {
    if (!profile) return;
    verificarAvisosPro(profile); // PRO vencendo / mensalidade atrasada
    sincronizarConquistas(profile, isPro).then(res => {
      if (!res) return;
      setR(res);
      const pend = CONQUISTAS.filter(q => res.feitas[q.codigo] && !res.feitas[q.codigo].celebrada);
      if (pend.length) setCelebrar(pend[pend.length - 1].codigo);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, isPro]);

  if (!r) return null;
  const nova = [...CONQUISTAS].reverse().find(q => r.feitas[q.codigo] && !r.feitas[q.codigo].vista);
  const prox = proximaConquista(r);
  const qCel = celebrar ? CONQUISTAS.find(q => q.codigo === celebrar) : null;
  const nome = (profile?.nome || "").split(" ")[0];

  // ✕ tira do cartão todas as conquistas novas de uma vez
  const fecharNova = () => {
    const pend = CONQUISTAS.filter(q => r.feitas[q.codigo] && !r.feitas[q.codigo].vista);
    pend.forEach(q => marcarConquista(q.codigo, { vista: true }));
    setR({ ...r, feitas: Object.fromEntries(Object.entries(r.feitas).map(([k, v]) => [k, { ...v, vista: true }])) });
  };
  const fecharCel = () => {
    if (!celebrar) return;
    const pend = CONQUISTAS.filter(q => r.feitas[q.codigo] && !r.feitas[q.codigo].celebrada);
    pend.forEach(q => marcarConquista(q.codigo, { celebrada: true }));
    setR({ ...r, feitas: Object.fromEntries(Object.entries(r.feitas).map(([k, v]) => [k, { ...v, celebrada: true }])) });
    setCelebrar(null);
  };

  // guarda a última conquista comemorada pra janela não ficar vazia enquanto fecha
  if (qCel) ultimaCel.current = qCel;
  const c = ultimaCel.current;
  const feito = prox ? Math.min(r.valores[prox.metrica], prox.alvo) : 0;

  return (
    <>
      <div className="cqc">
        <div className="cqc-h">
          <h2>Suas conquistas</h2>
          <button type="button" className="cqc-link" onClick={() => navigate("/conquistas")}>Ver todas <CaretRight size={16} weight="bold" aria-hidden="true" /></button>
        </div>
        {nova && (
          <div className="cqc-nova">
            <span className="cqc-ic" aria-hidden="true"><Medal size={24} weight="bold" /></span>
            <div className="cqc-tx"><small>Nova conquista</small><b>{nova.nome}</b><p>{nova.descricao}</p></div>
            <BotaoIcone rotulo="Fechar" variante="limpo" tamanho="p" onClick={fecharNova}><X size={16} weight="bold" /></BotaoIcone>
          </div>
        )}
        {prox && (
          <div className="cqc-prox">
            <div className="cqc-pl"><span>Próxima: <b>{prox.nome}</b></span><span>{feito} de {prox.alvo}</span></div>
            <div className="cqc-bar" role="progressbar" aria-label={`Próxima conquista: ${prox.nome}`} aria-valuemin={0} aria-valuemax={prox.alvo} aria-valuenow={feito}>
              <i style={{ width: `${Math.min(100, (r.valores[prox.metrica] / prox.alvo) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      <Janela
        aberta={!!qCel} aoFechar={fecharCel}
        titulo={c ? `Nova conquista: ${c.nome}` : ""} texto={c ? `${nome ? `Parabéns, ${nome}! ` : "Parabéns! "}${c.descricao}` : ""}
        icone={<Trophy size={32} />}
        acoes={<>
          <Botao variante="secundario" onClick={fecharCel}>Fechar</Botao>
          <Botao onClick={() => { fecharCel(); navigate("/conquistas"); }} data-foco-inicial>Ver conquistas</Botao>
        </>}
      />
    </>
  );
}
