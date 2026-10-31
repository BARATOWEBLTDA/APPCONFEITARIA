import { useEffect, useState } from "react";
import { Copy, Crown, LinkSimple } from "@phosphor-icons/react";
import { getCardapioUrl } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { explicarErro } from "@/lib/erros";
import { Botao, Campo, avisar } from "@/components/base";
import { useProfile, refreshProfile } from "@/hooks/useProfile";
import { usePlano } from "@/hooks/usePlano";
import RecursoPro from "@/components/billing/RecursoPro";

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
  const atual = String((profile as any)?.slug_personalizado || "");
  const [nome, setNome] = useState(atual);
  const [salvando, setSalvando] = useState(false);
  const [proAberto, setProAberto] = useState(false);
  useEffect(() => { setNome(atual); }, [atual]);
  const codigo = (profile as any)?.codigo_publico || "";
  if (!profile?.id || !codigo) return null;

  const sugestao = paraNomeNoLink((profile as any)?.nome_loja || "");
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

  // (30/10 · 5.54) o link numa pílula branca com "Copiar", em destaque
  const copiar = async () => {
    try { await navigator.clipboard.writeText(getCardapioUrl(profile)); avisar("Link copiado", { tipo: "ok" }); }
    catch { avisar("Não deu para copiar. Tente de novo.", { tipo: "erro" }); }
  };
  const pilula = (fim: string) => (
    <div className="nnl-pill">
      <LinkSimple size={18} aria-hidden="true" />
      <span>doonly.com.br/c/{codigo}/<b>{fim}</b></span>
      <button type="button" onClick={copiar}><Copy size={15} weight="bold" aria-hidden="true" />Copiar</button>
    </div>
  );

  if (!isPro) return (
    <div className="nnl">
      {pilula("cardapio")}
      <Botao variante="suave" tamanho="m" icone={<Crown size={18} weight="fill" />} onClick={() => setProAberto(true)}>Usar o nome da loja</Botao>
      {proAberto && <RecursoPro titulo="Nome da loja no link" texto={`No PRO o seu link fica doonly.com.br/c/${codigo}/${sugestao || "nome-da-loja"}, mais fácil de lembrar e de divulgar.`} onClose={() => setProAberto(false)} />}
    </div>
  );

  return (
    <div className="nnl">
      <Campo rotulo="Nome no link" placeholder={sugestao || "nome-da-loja"} value={nome} erro={erro}
        onChange={e => setNome(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      {pilula(limpo || "cardapio")}
      {mudou && <Botao tamanho="m" carregando={salvando} onClick={salvar}>Salvar link</Botao>}
    </div>
  );
}
