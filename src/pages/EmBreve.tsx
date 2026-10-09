import { useNavigate } from "react-router-dom";
import { Archive, Lightbulb, Package, Tag } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, TelaVazia } from "@/components/base";
import "./clientes.css";

/**
 * Telas que ainda não existem (Promoções, Estoque, Meus arquivos), no padrão do app (etapa 13).
 * Antes era um título com emoji e "Em breve..." solto na tela.
 */
const TELAS = {
  promocoes: {
    titulo: "Promoções", icone: Tag,
    texto: "Em breve você vai poder criar promoções com data pra começar e acabar, e elas aparecem sozinhas no seu cardápio.",
  },
  estoque: {
    titulo: "Estoque", icone: Package,
    texto: "Em breve você vai poder acompanhar quanto tem de cada ingrediente e receber um aviso quando estiver acabando.",
  },
  arquivos: {
    titulo: "Meus arquivos", icone: Archive,
    texto: "Em breve você vai poder guardar aqui fotos, artes e documentos da confeitaria, tudo num lugar só.",
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
