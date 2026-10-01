import { supabase } from "@/lib/supabase";
import { criarNotificacaoPessoal } from "@/lib/notificacoesUsuario";

/** As 24 conquistas do Doonly (aprovadas 30/09) */
export type Metrica = "pedidos" | "pedidosCardapio" | "clientes" | "produtos" | "fichas" | "cardapio" | "pro" | "mesesPro";
export interface Conquista { codigo: string; emoji: string; nome: string; descricao: string; grupo: string; metrica: Metrica; alvo: number }

const c = (codigo: string, emoji: string, nome: string, descricao: string, grupo: string, metrica: Metrica, alvo: number): Conquista => ({ codigo, emoji, nome, descricao, grupo, metrica, alvo });
export const CONQUISTAS: Conquista[] = [
  c("pedido-1", "📦", "1º pedido", "O começo de uma jornada incrível.", "Pedidos e clientes", "pedidos", 1),
  c("pedido-cardapio-1", "📲", "1º pedido pelo cardápio", "Seu cardápio digital já está vendendo por você.", "Pedidos e clientes", "pedidosCardapio", 1),
  c("pedido-10", "🛍️", "10 pedidos", "Dez clientes felizes!", "Pedidos e clientes", "pedidos", 10),
  c("pedido-50", "🎁", "50 pedidos", "Sua confeitaria está pegando ritmo.", "Pedidos e clientes", "pedidos", 50),
  c("pedido-100", "🏅", "100 pedidos", "Cem pedidos entregues. Que marca!", "Pedidos e clientes", "pedidos", 100),
  c("pedido-250", "🎖️", "250 pedidos", "Você é referência no seu bairro.", "Pedidos e clientes", "pedidos", 250),
  c("pedido-500", "🏆", "500 pedidos", "Meio milhar de pedidos!", "Pedidos e clientes", "pedidos", 500),
  c("pedido-1000", "👑", "1.000 pedidos", "Mil pedidos. Você é gigante!", "Pedidos e clientes", "pedidos", 1000),
  c("cliente-1", "🙋", "1º cliente", "Seu primeiro cliente cadastrado.", "Pedidos e clientes", "clientes", 1),
  c("cliente-10", "👥", "10 clientes", "Sua carteira de clientes está crescendo.", "Pedidos e clientes", "clientes", 10),
  c("cliente-50", "🤝", "50 clientes", "Cinquenta pessoas confiam no seu trabalho.", "Pedidos e clientes", "clientes", 50),
  c("cliente-100", "💖", "100 clientes", "Cem clientes! Sua marca é querida.", "Pedidos e clientes", "clientes", 100),
  c("cardapio", "🌐", "Cardápio publicado", "Seu cardápio digital está no ar.", "Cardápio e produtos", "cardapio", 1),
  c("produto-1", "🧁", "1º produto", "O primeiro doce do seu cardápio.", "Cardápio e produtos", "produtos", 1),
  c("produto-5", "🍰", "5 produtos", "Seu cardápio está ganhando forma.", "Cardápio e produtos", "produtos", 5),
  c("produto-10", "🎂", "10 produtos", "Um cardápio cheio de opções.", "Cardápio e produtos", "produtos", 10),
  c("produto-25", "🍬", "25 produtos", "Variedade é com você!", "Cardápio e produtos", "produtos", 25),
  c("produto-50", "🍫", "50 produtos", "Um verdadeiro catálogo de doces.", "Cardápio e produtos", "produtos", 50),
  c("ficha-1", "🧮", "1ª ficha técnica", "Agora você sabe quanto cada doce custa.", "Cardápio e produtos", "fichas", 1),
  c("ficha-10", "📊", "10 fichas técnicas", "Precificação profissional de verdade.", "Cardápio e produtos", "fichas", 10),
  c("pro", "💎", "Virou PRO", "Bem-vinda ao time PRO!", "PRO", "pro", 1),
  c("pro-3m", "📅", "3 meses PRO", "Três meses crescendo com o PRO.", "PRO", "mesesPro", 3),
  c("pro-6m", "🌟", "6 meses PRO", "Meio ano de PRO!", "PRO", "mesesPro", 6),
  c("pro-12m", "🎉", "1 ano PRO", "Um ano inteiro com o Doonly PRO.", "PRO", "mesesPro", 12),
];
export const GRUPOS = ["Pedidos e clientes", "Cardápio e produtos", "PRO"];

export interface EstadoConquista { codigo: string; conquistada_em: string; vista: boolean; celebrada: boolean }
export interface ResultadoConquistas { valores: Record<Metrica, number>; feitas: Record<string, EstadoConquista>; novas: Conquista[] }

const STATUS_ENTREGUE = ["entregue", "concluido"];

/** Calcula as métricas, guarda as conquistas novas e avisa (sem notificar em massa na 1ª vez) */
// Evita rodar duas vezes ao mesmo tempo (ex.: Início e página abertos juntos)
let emAndamento: Promise<ResultadoConquistas | null> | null = null;
export function sincronizarConquistas(profile: any, isPro: boolean): Promise<ResultadoConquistas | null> {
  if (!emAndamento) emAndamento = _sincronizar(profile, isPro).finally(() => { setTimeout(() => { emAndamento = null; }, 1500); });
  return emAndamento;
}
async function _sincronizar(profile: any, isPro: boolean): Promise<ResultadoConquistas | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const uid = user.id;
  const [ped, pedC, cli, prods, est] = await Promise.all([
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("user_id", uid).in("status", STATUS_ENTREGUE),
    supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("origem", "cardapio"),
    supabase.from("clientes").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from("produtos").select("id, produto_insumos(id)").eq("user_id", uid),
    supabase.from("conquistas_usuario").select("codigo, conquistada_em, vista, celebrada").eq("user_id", uid),
  ]);
  const listaProd: any[] = (prods.data as any[]) || [];
  const feitas: Record<string, EstadoConquista> = {};
  ((est.data as any[]) || []).forEach(r => { feitas[r.codigo] = r; });
  const proDesde = feitas["pro"]?.conquistada_em ? new Date(feitas["pro"].conquistada_em).getTime() : Date.now();
  const valores: Record<Metrica, number> = {
    pedidos: ped.count || 0,
    pedidosCardapio: pedC.count || 0,
    clientes: cli.count || 0,
    produtos: listaProd.length,
    fichas: listaProd.filter(p => (p.produto_insumos || []).length > 0).length,
    cardapio: profile?.cardapio_publicado ? 1 : 0,
    pro: isPro ? 1 : 0,
    mesesPro: isPro && feitas["pro"] ? Math.floor((Date.now() - proDesde) / (30 * 86400000)) : 0,
  };
  const primeiraVez = Object.keys(feitas).length === 0;
  const novas = CONQUISTAS.filter(q => !feitas[q.codigo] && valores[q.metrica] >= q.alvo);
  if (novas.length) {
    const agora = new Date().toISOString();
    // 1ª vez: registra o que ela já tinha em silêncio (só a mais recente ganha o cartão)
    const linhas = novas.map((q, i) => ({ user_id: uid, codigo: q.codigo, conquistada_em: agora,
      vista: primeiraVez ? i !== novas.length - 1 : false, celebrada: primeiraVez }));
    const { error } = await supabase.from("conquistas_usuario").upsert(linhas, { onConflict: "user_id,codigo", ignoreDuplicates: true });
    if (!error) {
      linhas.forEach(l => { feitas[l.codigo] = { codigo: l.codigo, conquistada_em: l.conquistada_em, vista: l.vista, celebrada: l.celebrada }; });
      if (!primeiraVez) for (const q of novas) {
        await criarNotificacaoPessoal({ tipo: "conquista", titulo: `Nova conquista: ${q.nome} 🏆`, mensagem: q.descricao, link: "/conquistas", chave: `conquista-${q.codigo}` });
      }
    }
  }
  return { valores, feitas, novas: primeiraVez ? [] : novas };
}

export async function marcarConquista(codigo: string, patch: { vista?: boolean; celebrada?: boolean }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("conquistas_usuario").update(patch).eq("user_id", user.id).eq("codigo", codigo);
}

/** Próxima conquista de pedidos (ou a mais próxima de qualquer tipo) pra barra de progresso */
export function proximaConquista(r: ResultadoConquistas): Conquista | null {
  const faltam = CONQUISTAS.filter(q => !r.feitas[q.codigo] && q.metrica !== "pro" && q.metrica !== "mesesPro");
  const ped = faltam.find(q => q.metrica === "pedidos");
  if (ped) return ped;
  return faltam.sort((a, b) => (r.valores[b.metrica] / b.alvo) - (r.valores[a.metrica] / a.alvo))[0] || null;
}
