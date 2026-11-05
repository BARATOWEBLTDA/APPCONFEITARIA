// ── EquipeMonta.tsx ──────────────────────────────────────────────────────────
// (04/11 · 6.81) Recurso do PRO: a equipe Doonly monta o cardápio da confeiteira
// (cadastra os produtos, cria a logo e os banners). Cartão em destaque na página do PRO
// e na Aparência. PRO: chama a equipe no WhatsApp. Grátis: leva para o teste do PRO.
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { Crown, HandHeart } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { CTA_PRO } from "@/lib/beneficiosPro";
import { usePlano } from "@/hooks/usePlano";
import { useProfile } from "@/hooks/useProfile";
import "./equipeMonta.css";

export const WHATSAPP_EQUIPE = "5511978414991";

/** abre o WhatsApp da equipe com o pedido de montagem já escrito */
export function pedirMontagem(nome?: string | null, loja?: string | null) {
  const quem = [nome, loja].filter(Boolean).join(" · ");
  const msg = `Olá! Sou PRO e quero que a equipe Doonly monte o meu cardápio (produtos, logo e banners).${quem ? `\nNome: ${quem}` : ""}`;
  window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
}

export default function EquipeMonta({ className = "", semBotao = false }: { className?: string; semBotao?: boolean }) {
  const navigate = useNavigate();
  const { isPro, loading } = usePlano();
  const { profile } = useProfile();
  if (loading) return null;
  return (
    <section className={`eqm ${className}`}>
      <span className="eqm-ic" aria-hidden="true"><HandHeart size={26} weight="duotone" /></span>
      <span className="eqm-tx">
        <b><span className="eqm-g">A equipe Doonly monta seu cardápio</span><span className="eqm-c">Montamos seu cardápio</span>{!isPro && !semBotao && <em className="eqm-pro">PRO</em>}</b>
        {/* (6.106) no celular, título e frase curtos, cada um numa linha */}
        <small><span className="eqm-g">Cadastramos seus produtos e criamos a logo e os banners da sua loja. Você só manda as fotos e os preços.</span><span className="eqm-c">Produtos, logo e banners prontos</span></small>
      </span>
      {semBotao ? null : isPro
        ? <Botao className="eqm-bt" icone={<IconeWhatsApp size={20} />} onClick={() => pedirMontagem(profile?.nome as string | undefined, profile?.nome_loja as string | undefined)}>Pedir para a equipe</Botao>
        : <Botao className="eqm-bt" icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>{CTA_PRO}</Botao>}
    </section>
  );
}
