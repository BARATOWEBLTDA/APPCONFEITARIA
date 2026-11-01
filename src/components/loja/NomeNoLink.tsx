import { useEffect, useState } from "react";
import { CTA_PRO } from "@/lib/beneficiosPro";
import { Crown } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import { Botao, Campo, avisar } from "@/components/base";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";

/** "Doce Formiga!" → "doce-formiga": sem acento, minúsculo, hífen no lugar dos espaços (até 40 letras) */
export function paraNomeNoLink(t: string): string {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 40).replace(/-+$/, "");
}
const NOME_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * (27/10) Nome no link do cardápio (PRO): doonly.com.br/c/ABCD/doce-formiga em vez de /cardapio.
 * O código da loja continua no link, então dois nomes iguais em lojas diferentes não se misturam.
 * A página do PRO prometia esse recurso, mas não tinha onde configurar.
 */
export default function NomeNoLink() {
  const { profile } = useProfile();
  const { isPro } = usePlano();
  const atual = String(profile?.slug_personalizado || "");
  const [nome, setNome] = useState(atual);
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setNome(atual); }, [atual]);
  const codigo = profile?.codigo_publico || "";
  if (!profile?.id || !codigo) return null;

  const sugestao = paraNomeNoLink(profile?.nome_loja || "");
  const limpo = paraNomeNoLink(nome);
  const erro = nome && (limpo.length < 3 || !NOME_VALIDO.test(limpo)) ? "Use 3 letras ou mais" : limpo === "cardapio" ? "Escolha outro nome" : undefined;
  const mudou = limpo !== atual;

  const salvar = async () => {
    if (erro || salvando) return;
    setSalvando(true);
    try {
      const { error } = await supabase.from("profiles").update({ slug_personalizado: limpo || null }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      avisar(limpo ? "Link salvo" : "Link voltou para o padrão", { tipo: "ok" });
    } catch (e) {
      avisar(explicarErro(e, "Não deu para salvar. Tente de novo."), { tipo: "erro" });
    }
    setSalvando(false);
  };

  // (31/10 · 5.91) aqui é para personalizar o link, não para copiar (copiar fica em Minha loja / Visão geral)
  const linha = (fim: string, cls = "") => <span className={`nnl-url ${cls}`.trim()}>doonly.com.br/c/{codigo}/<b>{fim}</b></span>;

  if (!isPro) return (
    <div className="nnl nnl--gratis">
      <div className="nnl-comp">
        <p><small>Hoje</small>{linha("cardapio", "nnl-url--hoje")}</p>
        <p><small>No PRO</small>{linha(sugestao || "nome-da-loja", "nnl-url--pro")}</p>
      </div>
      <Botao variante="vinho" tamanho="m" icone={<Crown size={18} weight="fill" />} onClick={() => navigate("/assinar")}>{CTA_PRO}</Botao>
    </div>
  );

  return (
    <div className="nnl">
      <Campo rotulo="Nome no link" placeholder={sugestao || "nome-da-loja"} value={nome} erro={erro}
        onChange={e => setNome(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <p className="nnl-assim"><small>Assim fica</small>{linha(limpo || "cardapio", "nnl-url--pro")}</p>
      {!nome && sugestao && <Botao variante="link" tamanho="p" onClick={() => setNome(sugestao)}>Usar “{sugestao}”</Botao>}
      {mudou && <Botao tamanho="m" carregando={salvando} onClick={salvar}>Salvar link</Botao>}
    </div>
  );
}
