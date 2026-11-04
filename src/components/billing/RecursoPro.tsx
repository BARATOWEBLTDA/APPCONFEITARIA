import { useNavigate } from "react-router-dom";
import { SELO_TESTE } from "@/lib/beneficiosPro";
import { Botao, Janela } from "@/components/base";

/**
 * Convite do PRO (o mesmo em todo o app) quando a conta grátis toca num recurso do PRO.
 * (04/11 · 6.20) mais amigável: o mascote de coroa no lugar do ícone, o título fala do que ela ganha,
 * o selo "7 dias grátis · cancele quando quiser" e "Agora não" + "Testar grátis".
 * `titulo`: o ganho ("Traga seus clientes em segundos"); `texto`: uma frase do que o recurso faz.
 */
export function ConvitePro({ aberto = true, titulo, texto, onClose }: { aberto?: boolean; titulo: string; texto: string; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <Janela aberta={aberto} aoFechar={onClose} titulo={titulo} texto={texto} className="cpro"
      icone={<img src="/marca/leve/bolo-coroa.webp" alt="" className="cpro-masc" width={96} height={96} />}
      acoes={<><Botao variante="secundario" onClick={onClose}>Agora não</Botao><Botao variante="vinho" onClick={() => { onClose(); navigate("/assinar"); }} data-foco-inicial>Testar grátis</Botao></>}>
      <span className="cpro-selo">{SELO_TESTE} · cancele quando quiser</span>
      <style>{`
        .cpro .ui-janela-ic { width: 104px; height: 104px; margin-bottom: 8px; background: radial-gradient(circle, #FFE9A8 0%, rgba(255,233,168,0) 70%); }
        .cpro .cpro-masc { width: 96px; height: 96px; object-fit: contain; filter: drop-shadow(0 6px 12px rgba(153,53,86,.2)); }
        .cpro-selo { display: inline-flex; align-items: center; height: 28px; margin-top: 14px; padding: 0 12px; border-radius: 99px; background: var(--ui-verde-fundo); color: var(--ui-verde); font-size: 13px; font-weight: 600; white-space: nowrap; }
      `}</style>
    </Janela>
  );
}

export default function RecursoPro({ titulo, texto, onClose }: { titulo: string; texto: string; onClose: () => void }) {
  return <ConvitePro titulo={titulo} texto={texto} onClose={onClose} />;
}
