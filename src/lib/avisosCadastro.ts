import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";
import { deIso, expediente } from "@/lib/agendaCardapio";
import { avisoFechado, diaDaSemana, diaDeVolta, diasAte, fechadoEm, hojeBr, lerFechados, proximosFeriados, textoAviso, textoPeriodo } from "@/lib/diasFechados";

/**
 * (13/10) O que falta cadastrar pro app mostrar os números certos (lucro, caixa, contas).
 * Cada item vira uma notificação (uma vez só, pela chave) e uma linha no cartão "Falta pouco" da Início.
 * Leitura que falha não vira aviso: o item só aparece quando dá pra ter certeza que falta.
 */
export type AvisoCadastro = {
  chave: string; titulo: string; texto: string; link: string;
  /** abrir: a tela abre direto no que resolve · destacar: o balão em cima do lugar de tocar (04/11 · 6.20) */
  estado?: { abrir?: string; destacar?: { alvo: string; titulo: string; texto: string; acao?: string } };
  icone: "custos" | "maquininha" | "ficha" | "caixa" | "conta" | "entrega" | "descricao" | "banner" | "cupom" | "complemento" | "cliente" | "whatsapp"
    | "receber" | "pausa" | "orcamento" | "divulgar" | "pix" | "categoria" | "feriado" | "ferias";
  /** (6.179) feriado chegando: "Vou fechar" marca o dia como fechado; "Abre normal" some */
  feriado?: { data: string; nome: string };
  /** (6.182) pagamento atrasado: "Já recebi" registra o que falta (pergunta antes) */
  receber?: { pedidoId: string; falta: number; forma: string | null; parcial: boolean; rotulo: string };
  /** (6.178) dinheiro atrasado: "Cobrar" abre o WhatsApp da cliente com esse texto */
  cobrar?: { telefone: string; texto: string };
  /** (6.178) o botão de baixo é "Não quero" (some de vez neste aparelho), no lugar do "Agora não" */
  naoQuero?: boolean;
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
  // ───── (6.178) passos novos: dinheiro atrasado, loja pausada, orçamentos, divulgar, Pix e categorias ─────
  try { l.push(...await passosExtras(uid, pf as Record<string, unknown> | null, ehProAviso, ((produtos.data as ProdutoAvisos[]) || []).length)); } catch { /* falhou: segue sem os passos novos */ }
  return l;
}

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const primeiroNome = (n?: string | null) => String(n || "").trim().split(/\s+/)[0] || "";

async function passosExtras(uid: string, pf: Record<string, unknown> | null, ehPro: boolean, qtdProdutos: number): Promise<AvisoCadastro[]> {
  const l: AvisoCadastro[] = [];
  const hoje = diaISO(0);
  const seteDias = new Date(Date.now() - 7 * 86400000).toISOString();
  const [peds, orcs, visitas, cats] = await Promise.all([
    // pedidos com dinheiro a receber que já passou da data combinada (ou entregues e ainda sem pagar)
    supabase.from("pedidos").select("id, numero, cliente_nome, cliente_telefone, valor_total, valor_recebido, forma_pagamento, status, status_pagamento, data_entrega, data_prevista_pagamento")
      .eq("user_id", uid).neq("status_pagamento", "pago").not("status", "in", "(cancelado,recusado,aguardando_aceite,novo,pendente,aguardando_pagamento)")
      .or(`data_prevista_pagamento.lt.${hoje},and(status.eq.entregue,data_entrega.lt.${hoje})`).order("data_entrega", { ascending: true }).limit(60),
    ehPro ? supabase.from("orcamentos").select("id, numero, cliente_nome, status, origem, created_at, enviado_em").eq("user_id", uid).in("status", ["novo", "enviado"]).order("created_at", { ascending: true }).limit(30) : Promise.resolve({ data: [], error: null }),
    pf?.codigo_publico ? supabase.from("cardapio_visitas").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", seteDias) : Promise.resolve({ count: null, error: null }),
    qtdProdutos > 5 ? supabase.from("categorias").select("id", { count: "exact", head: true }).eq("user_id", uid) : Promise.resolve({ count: null, error: null }),
  ]);

  // 1) dinheiro atrasado: um passo por pedido (até 3), com "Cobrar" e "Já recebi"
  type P = { id: string; numero: number | null; forma_pagamento: string | null; cliente_nome: string | null; cliente_telefone: string | null; valor_total: number | null; valor_recebido: number | null; status: string; data_entrega: string | null; data_prevista_pagamento: string | null };
  if (!peds.error) {
    const atrasados = ((peds.data as P[]) || []).map(p => ({ p, falta: Math.round(((Number(p.valor_total) || 0) - (Number(p.valor_recebido) || 0)) * 100) / 100 })).filter(x => x.falta > 0.009);
    for (const { p, falta } of atrasados.slice(0, 3)) {
      const quem = primeiroNome(p.cliente_nome) || `Pedido #${p.numero ?? ""}`.trim();
      const desde = p.data_prevista_pagamento && p.data_prevista_pagamento < hoje ? p.data_prevista_pagamento : String(p.data_entrega || "").slice(0, 10);
      const tel = String(p.cliente_telefone || "").replace(/\D/g, "");
      l.push({ chave: `receber_atrasado_${p.id}`, icone: "receber", semNotificar: true, nivel: "urgente",
        receber: { pedidoId: p.id, falta, forma: p.forma_pagamento, parcial: (Number(p.valor_recebido) || 0) > 0, rotulo: `${p.cliente_nome || "Cliente"} · pedido #${p.numero ?? ""}` },
        titulo: `${quem} · ${brl(falta)} atrasado`, texto: desde ? `Combinou pagar até ${ddmm(desde)}. Já recebeu? Toque em Já recebi.` : "Já recebeu? Toque em Já recebi.",
        link: `/pedidos/${p.id}/editar?aba=pagamento`, curto: { t: `${quem} · ${brl(falta)}`, s: desde ? `Atrasado desde ${ddmm(desde)}` : "Pagamento atrasado" },
        ...(tel.length >= 10 ? { cobrar: { telefone: tel, texto: `Oi, ${primeiroNome(p.cliente_nome) || "tudo bem"}! Passando pra lembrar do pagamento do pedido #${p.numero ?? ""}: ficou ${brl(falta)}. Qualquer coisa me chama 😊` } } : {}) });
    }
  }

  // 2) loja pausada: clientes não conseguem pedir
  if (pf?.loja_pausada === true) l.push({ chave: "loja_pausada", icone: "pausa", semNotificar: true, nivel: "atencao", titulo: "Sua loja está pausada",
    texto: "Enquanto estiver pausada, as clientes não conseguem pedir pelo cardápio.", link: "/cardapio", curto: { t: "Loja pausada", s: "Clientes não conseguem pedir" } });

  // 3) orçamentos (PRO): pedido pelo link sem proposta há mais de 1 dia; enviado sem resposta há 3 dias
  if (ehPro && !orcs.error) {
    type O = { id: string; numero: number | null; cliente_nome: string | null; status: string; origem: string | null; created_at: string; enviado_em: string | null };
    const agora = Date.now();
    for (const o of ((orcs.data as O[]) || [])) {
      const nome = primeiroNome(o.cliente_nome);
      if (o.status === "novo" && agora - new Date(o.created_at).getTime() > 86400000) l.push({ chave: `orc_sem_proposta_${o.id}`, icone: "orcamento", semNotificar: true, nivel: "atencao",
        titulo: nome ? `Orçamento de ${nome}` : `Orçamento #${o.numero ?? ""}`, texto: "Chegou pelo link e está esperando a sua proposta.", link: `/orcamentos/${o.id}`,
        curto: { t: nome ? `Orçamento de ${nome}` : `Orçamento #${o.numero ?? ""}`, s: "Esperando sua proposta" } });
      else if (o.status === "enviado" && o.enviado_em && agora - new Date(o.enviado_em).getTime() > 3 * 86400000) l.push({ chave: `orc_sem_resposta_${o.id}`, icone: "orcamento", semNotificar: true, nivel: "normal",
        titulo: `Orçamento #${o.numero ?? ""} sem resposta`, texto: `${nome || "O cliente"} ainda não respondeu. Que tal chamar no WhatsApp?`, link: `/orcamentos/${o.id}`,
        curto: { t: `Orçamento #${o.numero ?? ""} sem resposta`, s: "Chame no WhatsApp" } });
    }
  }

  // 4) cardápio publicado sem nenhuma visita na semana
  const criadoHa = pf?.created_at ? Date.now() - new Date(String(pf.created_at)).getTime() : 0;
  if (!visitas.error && visitas.count === 0 && pf?.codigo_publico && criadoHa > 7 * 86400000) l.push({ chave: "divulgar_cardapio", icone: "divulgar", semNotificar: true, nivel: "normal",
    titulo: "Divulgue seu cardápio", texto: "Ninguém abriu o cardápio esta semana. Mande o link no WhatsApp e no Instagram.", link: "/cardapio", curto: { t: "Divulgue seu cardápio", s: "Nenhuma visita na semana" } });

  // 5) aceita Pix mas o Pix pelo cardápio está desligado ("Não quero" some de vez)
  const formas = Array.isArray(pf?.formas_pagamento) ? (pf!.formas_pagamento as string[]).map(f => String(f).toLowerCase()) : [];
  if (formas.some(f => f.includes("pix")) && pf?.pix_online !== true) l.push({ chave: "ligar_pix_cardapio", icone: "pix", semNotificar: true, nivel: "normal", naoQuero: true,
    titulo: "Ligue o Pix pelo cardápio", texto: "A cliente paga o sinal ou o total na hora de pedir, e você recebe antes de fazer.", link: "/cardapio-config", estado: { abrir: "pix" },
    curto: { t: "Pix pelo cardápio", s: "Receba antes de fazer" } });

  // 6) mais de 5 produtos e nenhuma categoria
  if (!cats.error && cats.count === 0 && qtdProdutos > 5) l.push({ chave: "criar_categorias", icone: "categoria", semNotificar: true, nivel: "normal",
    titulo: "Organize por categorias", texto: "Bolos, doces, salgados… com categorias a cliente acha mais rápido no cardápio.", link: "/categorias", curto: { t: "Organize por categorias", s: "Fica mais fácil achar" } });

  // 7) (6.179) de férias agora ou começando nesta semana
  const fechados = lerFechados(pf?.dias_fechados);
  const hojeB = hojeBr();
  const av = avisoFechado(fechados, hojeB, 7);
  if (av && (av.agora || diasAte(av.f.inicio, hojeB) <= 7)) {
    const um = av.f.inicio === av.f.fim;
    const volta = ddmm(diaDeVolta(av.f));
    const clientesVeem = !!avisoFechado(fechados, hojeB); // o aviso do cardápio já apareceu (antecedência que ela escolheu)
    l.push({ chave: `ferias_${av.f.inicio}_${av.f.fim}`, icone: "ferias", semNotificar: true, nivel: av.agora ? "atencao" : "normal",
      titulo: av.agora ? (um ? "Loja fechada hoje" : `De férias até ${ddmm(av.f.fim)}`) : um ? `Fechada no dia ${ddmm(av.f.inicio)}` : `Férias de ${textoPeriodo(av.f)}`,
      texto: av.agora ? `O cardápio avisa as clientes e aceita encomendas a partir do dia ${volta}.` : `O cardápio não deixa marcar esses dias.${clientesVeem ? " As clientes já veem o aviso no topo." : ` ${textoAviso(av.f)} no topo do cardápio.`}`,
      link: "/cardapio-config", estado: { abrir: "ferias" },
      curto: { t: av.agora ? (um ? "Fechada hoje" : `De férias até ${ddmm(av.f.fim)}`) : um ? `Fechada dia ${ddmm(av.f.inicio)}` : `Férias de ${textoPeriodo(av.f)}`, s: av.agora ? `Volta dia ${volta}` : clientesVeem ? "O cardápio já avisa" : textoAviso(av.f) } });
  }

  // 8) (6.179) feriado nos próximos 3 dias num dia que a loja abre: "Sua loja abre no feriado?"
  if (pf?.horario) {
    for (const f of proximosFeriados(hojeB, 3)) {
      const em = diasAte(f.data, hojeB);
      if (em < 1 || fechadoEm(f.data, fechados) || !expediente(deIso(f.data), pf.horario)) continue;
      const quando = em === 1 ? "Amanhã" : diaDaSemana(f.data).replace(/^./, c => c.toUpperCase());
      l.push({ chave: `feriado_${f.data}`, icone: "feriado", semNotificar: true, nivel: "atencao", feriado: { data: f.data, nome: f.nome },
        titulo: `${quando} é feriado: ${f.nome}`, texto: `${quando}, ${ddmm(f.data)}, é ${f.nome}. Sua loja abre? Se fechar, o cardápio não deixa marcar entrega nem retirada nesse dia.`,
        link: "/cardapio-config", estado: { abrir: "ferias" },
        curto: { t: `Abre no feriado de ${ddmm(f.data)}?`, s: f.nome } });
      break;
    }
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
