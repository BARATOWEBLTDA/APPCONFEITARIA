/**
 * (17/11) Catálogo dos recursos PRO que o admin pode liberar avulso por conta.
 * A conta ganha o recurso quando é PRO OU quando a chave está em profiles.recursos_extras
 * (ligada pelo painel admin). Pra liberar um recurso novo no futuro: some uma linha aqui
 * e troque a trava dele por temRecurso("chave").
 */
export type RecursoChave =
  | "pixel"
  | "lucratividade"
  | "mensagens"
  | "cupons"
  | "adicionais"
  | "orcamentos"
  | "planilha"
  | "pdf_sem_marca"
  | "doo_ia_plus"
  | "selo_verificado"
  | "cardapio_premium";

export const RECURSOS_PRO: { chave: RecursoChave; titulo: string; descricao: string }[] = [
  { chave: "pixel", titulo: "Pixel do Facebook", descricao: "Anúncios e rastreamento no cardápio" },
  { chave: "lucratividade", titulo: "Lucratividade", descricao: "Lucro por produto e visão geral" },
  { chave: "mensagens", titulo: "Mensagens personalizadas", descricao: "Textos próprios do WhatsApp" },
  { chave: "cupons", titulo: "Cupons", descricao: "Cupons de desconto sem limite" },
  { chave: "adicionais", titulo: "Adicionais", descricao: "Topo, velas e extras sem limite" },
  { chave: "orcamentos", titulo: "Orçamentos", descricao: "Fluxo de orçamento no cardápio" },
  { chave: "planilha", titulo: "Baixar a planilha", descricao: "Exportar pedidos em Excel" },
  { chave: "pdf_sem_marca", titulo: "PDF sem a marca", descricao: "PDF sem o rodapé do Doonly" },
  { chave: "doo_ia_plus", titulo: "Doo IA turbinada", descricao: "500 por dia e imagens" },
  { chave: "selo_verificado", titulo: "Selo de loja verificada", descricao: "Selo no cardápio" },
  { chave: "cardapio_premium", titulo: "Cardápio Premium", descricao: "Cores e modelo Premium" },
];

/** A conta tem o recurso? PRO vê tudo; senão, vale a liberação avulsa do admin. */
export function contaTemRecurso(isPro: boolean, recursosExtras: string[] | null | undefined, chave: RecursoChave): boolean {
  return isPro || (Array.isArray(recursosExtras) && recursosExtras.includes(chave));
}
