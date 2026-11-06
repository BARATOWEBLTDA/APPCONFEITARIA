import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";

/**
 * (13/10) O que falta cadastrar pro app mostrar os números certos (lucro, caixa, contas).
 * Cada item vira uma notificação (uma vez só, pela chave) e uma linha no cartão "Falta pouco" da Início.
 * Leitura que falha não vira aviso: o item só aparece quando dá pra ter certeza que falta.
 */
export type AvisoCadastro = {
  chave: string; titulo: string; texto: string; link: string;
  /** abrir: a tela abre direto no que resolve · destacar: o balão em cima do lugar de tocar (04/11 · 6.20) */
  estado?: { abrir?: string; destacar?: { alvo: string; titulo: string; texto: string; acao?: string } };
  icone: "custos" | "maquininha" | "ficha" | "caixa" | "conta" | "entrega" | "descricao" | "banner" | "cupom" | "complemento" | "cliente" | "whatsapp";
  /** (04/11) WhatsApp: "Está certo" confirma aqui mesmo (some até o número mudar) */
  confirmarWhats?: string;
  /** (16/10) dica do cardápio: aparece no cartão, mas não vira notificação */
  semNotificar?: boolean;
  /** (15/10) pro cartão "Pra fazer": urgência e a linha curta (cabe numa linha no celular) */
  nivel: "urgente" | "atencao" | "normal"; curto: { t: string; s: string };
};

/** O que os avisos leem do perfil da loja */
type PerfilAvisos = {
  formas_pagamento?: string[] | null; formas_entrega?: string[] | null; entrega_modo?: string | null; valor_entrega_propria?: number | null;
  entrega_por_bairro?: unknown[] | null; caixa_inicio_em?: string | null; banner_url?: string | null; banner1_url?: string | null; banner_topo_url?: string | null;
};
type ProdutoAvisos = { id: string; nome: string | null; descricao: string | null; produto_insumos: { id: string }[] | null };

const diaISO = (somar = 0) => { const d = new Date(); d.setDate(d.getDate() + somar); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export async function lerAvisosCadastro(uid: string): Promise<AvisoCadastro[]> {
  const [fixos, variaveis, perfil, produtos, contas, maoObra, nComplementos, nClientes, eu, cupons] = await Promise.all([
    supabase.from("custos_fixos").select("id").eq("user_id", uid).limit(1),
    supabase.from("custos_variaveis").select("*").eq("user_id", uid),
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("produtos").select("id, nome, descricao, produto_insumos(id)").eq("user_id", uid).eq("disponivel", true),
    // (15/10) também as que vencem hoje e as atrasadas (antes só as de amanhã)
    supabase.from("contas_pagar").select("id, descricao, vencimento, valor").eq("user_id", uid).eq("status", "pendente").lte("vencimento", diaISO(1)).order("vencimento"),
    // (04/11 · 6.20) mão de obra, complementos, clientes e o WhatsApp conferido
    supabase.from("config_mao_obra").select("salario_mensal").eq("user_id", uid).maybeSingle(),
    supabase.from("biblioteca_extras").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase.auth.getUser(),
    // (6.177) os cupons moram em loja_cupons (o campo antigo do perfil fica vazio)
    supabase.from("loja_cupons").select("cupons").eq("user_id", uid).maybeSingle(),
  ]);
  const l: AvisoCadastro[] = [];
  // contas primeiro (são as mais urgentes): atrasada, hoje, amanhã. A chave muda com a situação, pra avisar de novo quando vira "hoje"
  if (!contas.error) for (const c of (contas.data as { id: string; descricao: string | null; vencimento: string | null; valor: number | null }[]) || []) {
    const v = String(c.vencimento || "").slice(0, 10);
    const sit = v < diaISO(0) ? "atrasada" : v === diaISO(0) ? "hoje" : "amanha";
    l.push({ chave: sit === "amanha" ? `conta_vence_${c.id}` : `conta_${sit}_${c.id}`, icone: "conta",
      titulo: `${sit === "atrasada" ? "Atrasada" : sit === "hoje" ? "Vence hoje" : "Vence amanhã"}: ${c.descricao}`,
      texto: "Pague ou marque como paga em A pagar para o seu caixa ficar sempre certo.", link: "/financeiro/a-pagar", estado: { abrir: `pagar:${c.id}` },
      nivel: sit === "amanha" ? "atencao" : "urgente",
      curto: { t: String(c.descricao), s: `${sit === "atrasada" ? "Já venceu" : sit === "hoje" ? "Vence hoje" : "Vence amanhã"}${Number(c.valor) > 0 ? ` · ${Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}` } });
  }
  // (16/10) custos fixos e taxa da maquininha ficam na mesma tela: viram um aviso só ("Custos e taxas")
  const faltaFixos = !fixos.error && (fixos.data || []).length === 0;
  const vendeCartao = !perfil.error && ((perfil.data as PerfilAvisos | null)?.formas_pagamento || []).some((f: string) => f === "credito" || f === "debito");
  const temTaxa = ((variaveis.data as { forma?: string | null; nome?: string | null }[]) || []).some(v => v.forma || /maquin/i.test(String(v.nome || "")));
  const faltaTaxa = vendeCartao && !variaveis.error && !temTaxa;
  // (04/11 · 6.20) a ficha técnica não pergunta mais a mão de obra e os custos invisíveis: o aviso pede aqui
  const pfCustos = !perfil.error ? (perfil.data as { custos_invisiveis_pct?: number | null } | null) : null;
  const faltaMao = !maoObra.error && !(Number((maoObra.data as { salario_mensal?: number | null } | null)?.salario_mensal) > 0);
  const faltaInvis = !!pfCustos && pfCustos.custos_invisiveis_pct == null;
  if ((faltaMao || faltaInvis) && !faltaFixos && !faltaTaxa)
    l.push({ chave: "falta_mao_obra", icone: "custos", titulo: faltaMao && faltaInvis ? "Defina sua mão de obra e os custos invisíveis" : faltaMao ? "Defina sua mão de obra" : "Defina os custos invisíveis",
      texto: "Seu trabalho, o gás, a luz e as perdas entram no custo de cada produto. Sem eles, o preço sai baixo.", link: "/custos", estado: { abrir: faltaMao ? "mao" : "invisiveis" }, nivel: "normal",
      curto: { t: faltaMao ? "Sua mão de obra" : "Custos invisíveis", s: "Para o custo sair certo" } });
  if (faltaFixos || faltaTaxa) {
    const s = faltaFixos && faltaTaxa ? "Aluguel, luz e a maquininha" : faltaFixos ? "Aluguel, luz, internet" : "Para ver o lucro de cada venda";
    l.push({ chave: "falta_custos", icone: "custos", titulo: faltaFixos && faltaTaxa ? "Cadastre seus custos e a taxa da maquininha" : faltaFixos ? "Cadastre seus custos fixos" : "Cadastre a taxa da maquininha",
      texto: faltaFixos && faltaTaxa ? "Aluguel, luz e a taxa da maquininha entram no custo de cada produto." : faltaFixos ? "Aluguel, luz e internet entram no custo. Sem eles, o lucro parece maior." : "A taxa muda no débito e no crédito. Cadastre para ver o lucro de cada venda.", link: "/custos", estado: { abrir: faltaFixos ? "fixo" : "maquininha" }, nivel: "normal",
      curto: { t: faltaFixos ? "Custos e taxas" : "Taxa da maquininha", s } });
  }
  const semFicha = !produtos.error ? ((produtos.data as ProdutoAvisos[]) || []).filter(p => !(p.produto_insumos || []).length).length : 0;
  if (semFicha > 0)
    l.push({ chave: "falta_ficha_tecnica", icone: "ficha", titulo: semFicha === 1 ? "1 produto sem ficha técnica" : `${semFicha} produtos sem ficha técnica`, texto: "Monte a receita de cada produto para saber o custo e o lucro de verdade.", link: "/ficha-tecnica", estado: { abrir: "sem-ficha" }, nivel: "normal", curto: { t: `${semFicha} sem ficha técnica`, s: "Para saber o custo de verdade" } });
  if (!perfil.error && perfil.data && (perfil.data as PerfilAvisos).caixa_inicio_em == null)
    l.push({ chave: "falta_saldo_caixa", icone: "caixa", titulo: "Informe o saldo do caixa", texto: "Diga quanto tem hoje na gaveta e no banco para o Financeiro bater certinho.", link: "/financeiro", estado: { abrir: "saldo" }, nivel: "normal", curto: { t: "Saldo do caixa", s: "Quanto tem hoje" } });
  // (16/10) o "Pra vender mais" do cardápio veio pra cá: taxa de entrega, descrição dos produtos e banner
  const pf: PerfilAvisos | null = !perfil.error ? perfil.data : null;
  if (pf) {
    const fe: string[] = Array.isArray(pf.formas_entrega) ? pf.formas_entrega : [];
    // (28/10) por raio ou por cidade já é uma taxa definida
    // (04/11 · 6.20) taxa vazia não é grátis: o cardápio mostra "a combinar". Grátis (0) marcado, a combinar, raio e cidade são escolhas dela.
    const semTaxa = fe.includes("entrega_propria") && !["raio", "cidade", "combinar"].includes(pf.entrega_modo) && pf.valor_entrega_propria == null && !(Array.isArray(pf.entrega_por_bairro) && pf.entrega_por_bairro.length);
    if (semTaxa) l.push({ chave: "falta_taxa_entrega", icone: "entrega", titulo: "Defina a taxa de entrega", texto: "Sem a taxa, o cardápio mostra a entrega como \"a combinar\" e você acerta o valor em cada pedido.",
      link: "/checkout-config", nivel: "atencao", curto: { t: "Taxa de entrega", s: "Hoje aparece \"a combinar\"" } });
  }
  // (04/11 · 6.20) diz qual produto e abre direto na descrição (com a Doo IA pra ajudar)
  const listaSemDesc = !produtos.error ? ((produtos.data as ProdutoAvisos[]) || []).filter(p => !String(p.descricao || "").trim()) : [];
  const semDesc = listaSemDesc.length;
  if (semDesc > 0) {
    const primeiro = String(listaSemDesc[0].nome || "Produto").trim();
    l.push({ chave: "falta_descricao", icone: "descricao", semNotificar: true, titulo: semDesc === 1 ? `${primeiro} está sem descrição` : `${semDesc} produtos sem descrição`,
      texto: semDesc === 1 ? "Conte o sabor, o tamanho e quantas pessoas serve. A Doo IA pode escrever pra você." : `Comece pelo ${primeiro}: conte o sabor, o tamanho e quantas pessoas serve. A Doo IA pode escrever pra você.`,
      link: "/produtos", estado: { abrir: `descricao:${listaSemDesc[0].id}` }, nivel: "normal",
      curto: { t: semDesc === 1 ? `${primeiro} sem descrição` : `${semDesc} sem descrição`, s: "Sabor, tamanho e quantos serve" } });
  }
  if (pf && !(pf.banner_url || pf.banner1_url)) l.push({ chave: "falta_banner", icone: "banner", semNotificar: true, titulo: "Crie um banner de promoção",
    texto: "Anuncie a promoção da semana no topo do cardápio, antes dos produtos.", link: "/cardapio-design", nivel: "normal", curto: { t: "Banner de promoção", s: "No topo do cardápio" },
    estado: { destacar: { alvo: ".ap-enviar.ap-slot:not(.ap-slot--logo):not(.ap-slot--topo)", titulo: "Toque aqui para pôr o banner", texto: "Escolha uma imagem da promoção. Ela aparece no topo do cardápio.", acao: "Escolher imagem" } } });
  // (04/11 · 6.20) "Pra vender mais": só depois que o cardápio tem produto (não compete com os primeiros passos)
  const pfP = (perfil.data || {}) as { plano?: string | null; pro_expira_em?: string | null };
  const ehProAviso = pfP.plano === "pro" && (!pfP.pro_expira_em || new Date(pfP.pro_expira_em) > new Date());
  const temProduto = !produtos.error && ((produtos.data as ProdutoAvisos[]) || []).length > 0;
  const listaCupons = (cupons.data as { cupons?: unknown[] | null } | null)?.cupons;
  const semCupom = !cupons.error && !(Array.isArray(listaCupons) && listaCupons.length) && !(Array.isArray((pf as { cupons_desconto?: unknown[] | null } | null)?.cupons_desconto) && ((pf as { cupons_desconto?: unknown[] }).cupons_desconto || []).length);
  // (6.177) cupom é do PRO: no grátis o passo levaria só pro convite
  if (ehProAviso && temProduto && semCupom) l.push({ chave: "falta_cupom", icone: "cupom", semNotificar: true, titulo: "Crie seu primeiro cupom",
    texto: "Um cupom de desconto traz cliente nova e faz quem já comprou voltar.", link: "/cupons", nivel: "normal", curto: { t: "Seu primeiro cupom", s: "Pra trazer cliente nova" },
    estado: { destacar: { alvo: ".guia-novo-cupom", titulo: "Crie o cupom aqui", texto: "Escolha o código (ex.: BEMVINDA10) e o desconto. A cliente usa no cardápio.", acao: "Criar cupom" } } });
  // (6.29) adicionais são do PRO: no grátis o aviso levaria só pro convite do PRO
  const pfPlano = (perfil.data || {}) as { plano?: string | null; pro_expira_em?: string | null };
  const ehPro = pfPlano.plano === "pro" && (!pfPlano.pro_expira_em || new Date(pfPlano.pro_expira_em) > new Date());
  if (ehPro && temProduto && !nComplementos.error && !(nComplementos.count || 0)) l.push({ chave: "falta_complemento", icone: "complemento", semNotificar: true, titulo: "Cadastre adicionais",
    texto: "Topo de bolo, velas e escrita: o cliente marca no produto e cada pedido vale mais.", link: "/complementos", nivel: "normal", curto: { t: "Adicionais", s: "Topo, velas e escrita" },
    estado: { destacar: { alvo: ".guia-novo-complemento", titulo: "Crie o primeiro adicional", texto: "Por exemplo: Topo de bolo, com a foto da ideia que o cliente manda.", acao: "Criar adicional" } } });
  if (temProduto && !nClientes.error && !(nClientes.count || 0)) l.push({ chave: "falta_cliente", icone: "cliente", semNotificar: true, titulo: "Cadastre sua primeira cliente",
    texto: "Com as clientes no app, você manda parabéns no aniversário e vê o que cada uma comprou.", link: "/clientes", nivel: "normal", curto: { t: "Primeira cliente", s: "Aniversário e histórico" },
    estado: { destacar: { alvo: ".guia-novo-cliente", titulo: "Cadastre a cliente aqui", texto: "Nome e WhatsApp já bastam. Quem pede pelo cardápio entra sozinha.", acao: "Cadastrar cliente" } } });
  // (04/11 · 6.20) o WhatsApp que recebe os pedidos: pede pra conferir (volta se o número mudar)
  // (6.177) número com +55 na frente também sai formatado (antes aparecia "5541999990000")
  const tel0 = String((pf as { telefone?: string | null } | null)?.telefone || "").replace(/\D/g, "");
  const tel = (tel0.length === 12 || tel0.length === 13) && tel0.startsWith("55") ? tel0.slice(2) : tel0;
  const conferido = String((eu.data?.user?.user_metadata as { whatsapp_ok?: string } | undefined)?.whatsapp_ok || "");
  if (tel.length >= 10 && conferido !== tel) {
    const fmt = tel.length === 11 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}` : tel.length === 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}` : tel;
    l.push({ chave: `conferir_whatsapp_${tel}`, icone: "whatsapp", semNotificar: true, titulo: "Confira o WhatsApp dos pedidos", confirmarWhats: tel,
      texto: `Os pedidos chegam no ${fmt}. Está certo?`, link: "/cardapio-config", nivel: "atencao", curto: { t: "WhatsApp dos pedidos", s: fmt },
      estado: { abrir: "loja", destacar: { alvo: "#dl-in-whats", titulo: "Corrija o WhatsApp aqui", texto: "É nele que chegam os pedidos do cardápio." } } });
  }
  return l;
}

/** Manda cada aviso pras notificações (uma vez só por chave) */
export function notificarAvisosCadastro(avisos: AvisoCadastro[]) {
  // (15/10) velocidade: cada aviso vira notificação no máximo 1 vez por dia neste aparelho
  // (antes conferia no banco, aviso por aviso, toda vez que o Início abria)
  const d = new Date(), hoje = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const k = "doonly_avisos_notificados";
  let feitos: { dia: string; chaves: string[] } = { dia: hoje, chaves: [] };
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v?.dia === hoje && Array.isArray(v.chaves)) feitos = v; } catch { /* sem localStorage ou valor inválido: começa do zero */ }
  const novos = avisos.filter(a => !a.semNotificar && !feitos.chaves.includes(a.chave));
  if (!novos.length) return;
  for (const a of novos) criarNotificacaoPessoal({ tipo: "aviso", titulo: a.titulo, mensagem: a.texto, link: a.link, chave: a.chave }).catch(() => {});
  try { localStorage.setItem(k, JSON.stringify({ dia: hoje, chaves: [...feitos.chaves, ...novos.map(a => a.chave)] })); } catch { /* sem localStorage (aba anônima): segue sem lembrar */ }
}
