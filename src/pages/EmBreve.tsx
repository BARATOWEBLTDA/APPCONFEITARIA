import { useNavigate } from "react-router-dom";
import { Lightbulb, Package } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia } from "@/components/base";
import "./clientes.css";

/**
 * Tela que ainda não existe (Estoque), no padrão do app (etapa 13). Promoções e Meus arquivos saíram (09/10).
 * Antes era um título com emoji e "Em breve..." solto na tela.
 */
const TELAS = {
  estoque: {
    titulo: "Estoque", icone: Package,
    texto: "Aqui você vai poder acompanhar quanto tem de cada ingrediente e receber um aviso quando estiver acabando.",
  },
} as const;

export default function EmBreve({ tela }: { tela: keyof typeof TELAS }) {
  const navigate = useNavigate();
  const t = TELAS[tela];
  const Icone = t.icone;
  return (
    <>
      <AppPageHeader title={t.titulo} subtitle="Em breve" />
      <div className="cl9">
        <TelaVazia caixa icone={<Icone size={30} />} titulo="Estamos preparando esta tela" texto={t.texto}
          acao={<Botao variante="secundario" icone={<Lightbulb size={20} weight="bold" />} onClick={() => navigate("/solicitar-recurso")}>Contar o que você precisa</Botao>} />
      </div>
    </>
  );
}
