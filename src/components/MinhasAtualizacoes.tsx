import { useEffect, useRef, useState } from "react";
import { dataISO } from "@/lib/pedidoStatus";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import { Cake, TrendUp, TrendDown, Camera, Moon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

export interface Update {
  key: string;
  /** ícone desenhado (guia A14): sem emoji */
  Icone: Icon;
  categoria: string;
  categoriaCor: "verde" | "rosa" | "vermelho" | "amarelo" | "azul" | "roxo";
  titulo: string;
  descricao: string;
  cta: string;
  path: string;
  prioridade: number; // maior = mais no topo
  /** (15/10) linha curta do "Pra fazer" (cabe numa linha no celular) */
  curto: { t: string; s: string };
}

// Status atuais (+ antigos). Antes eram nomes que o app não usa mais, e nada aparecia (30/09)
const STATUS_ENTREGUE = ["entregue", "concluido"];

/**
 * O MESMO trecho do mês anterior (11/10): do dia 1 até o mesmo dia e hora, limitado ao fim daquele mês.
 * Dia 3 de outubro às 14h compara com 1 a 3 de setembro até as 14h. Dia 31 de março compara com fevereiro inteiro.
 * Antes o mês até hoje era comparado com o mês passado INTEIRO: todo começo de mês dizia "faturamento caiu 90%".
 */
function mesmoTrechoDoMesAnterior(agora: Date): { inicio: Date; fim: Date } {
  const inicioDesteMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const mesmoMomento = new Date(agora.getFullYear(), agora.getMonth() - 1, agora.getDate(), agora.getHours(), agora.getMinutes(), agora.getSeconds(), agora.getMilliseconds());
  // dia 31 num mês anterior de 30 (ou 29, 30 e 31 em fevereiro) cairia neste mês: para no fim do mês anterior
  return { inicio, fim: mesmoMomento < inicioDesteMes ? mesmoMomento : inicioDesteMes };
}

// Aniversariantes nos próximos 7 dias (hoje até hoje + 6)
function calcularAniversariantesSemana(clientes: any[]): { total: number; primeiro: string | null; nomes: string[]; dias: number } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let total = 0;
  let primeiro: string | null = null;
  let menorDias = Infinity;
  const lista: { nome: string; dias: number }[] = [];

  clientes.forEach((c) => {
    if (!c.data_nascimento) return;
    const [, mes, dia] = String(c.data_nascimento).slice(0, 10).split("-").map(Number);
    if (!mes || !dia) return;
    const aniv = new Date(hoje.getFullYear(), mes - 1, dia);
    if (aniv < hoje) aniv.setFullYear(aniv.getFullYear() + 1);
    const dias = Math.round((aniv.getTime() - hoje.getTime()) / 86400000);
    if (dias >= 0 && dias <= 6) { // 11/10: 7 dias contando hoje (antes 0 a 7 eram 8 dias)
      total++;
      lista.push({ nome: String(c.nome || "").trim().split(" ")[0], dias });
      if (dias < menorDias) {
        menorDias = dias;
        primeiro = c.nome || null;
      }
    }
  });

  const nomes = lista.sort((a, b) => a.dias - b.dias).map(x => x.nome).filter(Boolean);
  return { total, primeiro, nomes, dias: menorDias };
}

/**
 * (15/10) Os avisos do Início (aniversário, faturamento, produtos sem foto, clientes sumidos) viraram um gancho:
 * quem mostra agora é o cartão "Pra fazer", junto com o que falta cadastrar.
 */
export function useAtualizacoes(): { updates: Update[]; loading: boolean } {
  const { profile } = useProfile();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  // (11/10) app aberto de um dia pro outro: quando vira o dia, refaz os avisos (aniversário, entregas dos próximos 7 dias…)
  const diaAtual = useDiaAtual();
  // (15/10) ao voltar pro app também refaz (antes só na virada do dia)
  const [voltou, setVoltou] = useState(0);
  useAoVoltar(() => setVoltou(v => v + 1));
  const contaCarregada = useRef<string | null>(null);
  useEffect(() => {
    if (!profile?.id) return;
    let cancelado = false;
    (async () => {
      // só esconde o cartão na primeira busca da conta: ao virar o dia, troca o conteúdo sem piscar
      if (contaCarregada.current !== profile.id) setLoading(true);
      const userId = profile.id;
      const hoje = new Date();
      const trechoAnt = mesmoTrechoDoMesAnterior(hoje);
      // (11/10) faturamento comparado pela DATA DE ENTREGA (antes pela criação): último dia do trecho, inclusive
      const fimAntISO = dataISO(new Date(Math.min(
        new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate()).getTime(),
        new Date(hoje.getFullYear(), hoje.getMonth(), 0).getTime(),
      )));
      // (11/10) meia-noite daqui, 60 dias atrás (antes era o texto "AAAA-MM-DD" no horário de Londres)
      const dataLimite60d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 60);

      const [
        clientesRes,
        produtosSemFotoRes,
        pedidosMesRes,
        pedidosMesAntRes,
        clientesComVendaRes,
        compraramAntesRes,
      ] = await Promise.all([
        // 3. Clientes com data_nascimento pra aniversariantes
        supabase
          .from("clientes")
          .select("nome, data_nascimento")
          .eq("user_id", userId)
          .not("data_nascimento", "is", null),
        // 4. Produtos sem foto
        supabase
          .from("produtos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("imagem_url", null),
        // 5. Faturamento mês atual
        supabase
          .from("pedidos")
          .select("valor_total")
          .eq("user_id", userId)
          .gte("data_entrega", dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)))
          .lte("data_entrega", dataISO(hoje))
          .in("status", STATUS_ENTREGUE),
        // 6. Faturamento do MESMO trecho do mês anterior (do dia 1 até o mesmo dia e hora)
        supabase
          .from("pedidos")
          .select("valor_total")
          .eq("user_id", userId)
          .gte("data_entrega", dataISO(trechoAnt.inicio))
          .lte("data_entrega", fimAntISO)
          .in("status", STATUS_ENTREGUE),
        // 8. Clientes que compraram nos últimos 60 dias
        supabase
          .from("pedidos")
          .select("cliente_id")
          .eq("user_id", userId)
          .gte("created_at", dataLimite60d.toISOString())
          .not("cliente_id", "is", null),
        // 9. (15/10) Quem comprou entre 1 ano e 60 dias atrás: só esses podem estar "sumidos"
        //    (antes contava todos os clientes cadastrados, inclusive quem nunca comprou)
        supabase
          .from("pedidos")
          .select("cliente_id")
          .eq("user_id", userId)
          .gte("created_at", new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate()).toISOString())
          .lt("created_at", dataLimite60d.toISOString())
          .not("cliente_id", "is", null),
      ]);
      if (cancelado) return;
      // (15/10) alguma busca falhou (sem internet): mantém o que já estava (antes podia mostrar "faturamento caiu 100%")
      if ([clientesRes, produtosSemFotoRes, pedidosMesRes, pedidosMesAntRes, clientesComVendaRes, compraramAntesRes].some(r => r.error)) {
        if (contaCarregada.current !== userId) setLoading(false);
        return;
      }
      contaCarregada.current = userId;

      const lista: Update[] = [];

      // (07/10 · 3.07) Os pedidos atrasados saíram daqui: já aparecem no "Seu dia", no topo do Início, e estavam repetidos.

      // (15/10) "N entregas nos próximos 7 dias" saiu: repetia o cartão Próximas entregas, logo acima

      // 3️⃣ Aniversariantes
      const aniv = calcularAniversariantesSemana(clientesRes.data || []);
      if (aniv.total > 0) {
        const primeiroNome = aniv.primeiro?.split(" ")[0] || "";
        const quando = aniv.dias === 0 ? "hoje" : aniv.dias === 1 ? "amanhã" : `em ${aniv.dias} dias`;
        lista.push({
          key: "aniversarios",
          Icone: Cake,
          categoria: "Oportunidade",
          categoriaCor: "rosa",
          titulo: aniv.total === 1
            ? `${primeiroNome} faz aniversário ${quando}!`
            : `${aniv.total} aniversariantes nos próximos 7 dias`,
          descricao: aniv.total === 1
            ? "Mande uma mensagem e ofereça um bolo especial."
            : `${aniv.total === 2 && aniv.nomes.length === 2 ? `${aniv.nomes[0]} e ${aniv.nomes[1]}` : `${primeiroNome} e mais ${aniv.total - 1}`} — mande mensagens e ofereça bolos.`,
          cta: "Ver clientes",
          path: "/clientes",
          prioridade: 70,
          curto: aniv.total === 1 ? { t: `Aniversário de ${primeiroNome}`, s: quando === "hoje" ? "É hoje" : quando === "amanhã" ? "É amanhã" : `Daqui ${aniv.dias} dias` }
            : { t: `${aniv.total} aniversariantes`, s: "Nos próximos 7 dias" },
        });
      }

      // 5️⃣ Recorde/comparação de faturamento (só se tem >= 1 pedido nos 2 meses)
      const fatMes = (pedidosMesRes.data || []).reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
      const fatMesAnt = (pedidosMesAntRes.data || []).reduce((s: number, p: any) => s + Number(p.valor_total || 0), 0);
      if (fatMes > 0 && fatMesAnt > 0) {
        const diff = ((fatMes - fatMesAnt) / fatMesAnt) * 100;
        // 11/10: o texto diz o que foi comparado (os mesmos dias dos dois meses)
        const comparado = hoje.getDate() === 1 ? "Hoje, comparado com o dia 1 do mês passado" : `Do dia 1 ao dia ${hoje.getDate()}, comparado com os mesmos dias do mês passado`;
        if (diff >= 20) {
          lista.push({
            key: "faturamento-up",
            Icone: TrendUp,
            categoria: "Conquista",
            categoriaCor: "verde",
            titulo: `Faturamento subiu ${diff.toFixed(0)}%!`,
            descricao: `${comparado}. Continue nesse ritmo!`,
            cta: "Ver financeiro",
            path: "/financeiro",
            prioridade: 60,
            curto: { t: `Faturamento subiu ${diff.toFixed(0)}%`, s: "Em relação ao mês passado" },
          });
        } else if (diff <= -20) {
          lista.push({
            key: "faturamento-down",
            Icone: TrendDown,
            categoria: "Atenção",
            categoriaCor: "amarelo",
            titulo: `Faturamento caiu ${Math.abs(diff).toFixed(0)}%`,
            descricao: `${comparado}. Hora de reativar clientes.`,
            cta: "Ver financeiro",
            path: "/financeiro",
            prioridade: 40,
            curto: { t: `Faturamento caiu ${Math.abs(diff).toFixed(0)}%`, s: "Em relação ao mês passado" },
          });
        }
      }

      // 6️⃣ Produtos sem foto
      const nSemFoto = produtosSemFotoRes.count || 0;
      if (nSemFoto > 0) {
        lista.push({
          key: "produtos-sem-foto",
          Icone: Camera,
          categoria: "Dica",
          categoriaCor: "roxo",
          titulo: nSemFoto === 1
            ? "1 produto sem foto"
            : `${nSemFoto} produtos sem foto`,
          descricao: "Produto com foto vende mais. Adicione para chamar atenção no cardápio.",
          cta: "Ver produtos",
          path: "/produtos",
          prioridade: 30,
          curto: { t: nSemFoto === 1 ? "1 produto sem foto" : `${nSemFoto} produtos sem foto`, s: "Foto vende mais" },
        });
      }

      // 7️⃣ Clientes sumidos: compraram no último ano, mas não nos últimos 60 dias
      {
        const ativos = new Set((clientesComVendaRes.data || []).map((v: any) => v.cliente_id));
        const sumidos = new Set((compraramAntesRes.data || []).map((v: any) => v.cliente_id).filter((id: any) => !ativos.has(id))).size;
        if (sumidos >= 3) {
          lista.push({
            key: "clientes-sumidos",
            Icone: Moon,
            categoria: "Oportunidade",
            categoriaCor: "rosa",
            titulo: `${sumidos} clientes sumidos`,
            descricao: `Sem comprar há mais de 60 dias. Mande uma mensagem para chamar de volta.`,
            cta: "Ver clientes",
            path: "/clientes",
            prioridade: 20,
            curto: { t: `${sumidos} clientes sumidos`, s: "Sem comprar há 60 dias" },
          });
        }
      }

      // Ordena por prioridade decrescente
      lista.sort((a, b) => b.prioridade - a.prioridade);
      setUpdates(lista);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [profile?.id, diaAtual, voltou]);

  return { updates, loading };
}
