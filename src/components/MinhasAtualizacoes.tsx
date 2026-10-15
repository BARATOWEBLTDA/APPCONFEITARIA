import { useEffect, useRef, useState } from "react";
import { dataISO } from "@/lib/pedidoStatus";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import { useNavigate } from "react-router-dom";
import { CaretRight, Cake, Trophy, TrendUp, TrendDown, Camera, Moon } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

interface Update {
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
}

// Status atuais (+ antigos). Antes eram nomes que o app não usa mais, e nada aparecia (30/09)
const STATUS_ENTREGUE = ["entregue", "concluido"];
const MAX_VISIVEIS = 4;

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

export default function MinhasAtualizacoes() {
  const { profile } = useProfile();
  const navigate = useNavigate();
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
        totalPedidosRes,
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
        // 7. Total de pedidos (marco)
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
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
      if ([clientesRes, produtosSemFotoRes, pedidosMesRes, pedidosMesAntRes, totalPedidosRes, clientesComVendaRes, compraramAntesRes].some(r => r.error)) {
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
        });
      }

      // 4️⃣ Marco de pedidos
      const totalPed = totalPedidosRes.count || 0;
      const marcos = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000];
      const marcoAtingido = marcos.find(m => totalPed === m);
      if (marcoAtingido && false) { // agora fica no cartão "Suas conquistas"
        lista.push({
          key: `marco-${marcoAtingido}`,
          Icone: Trophy,
          categoria: "Conquista",
          categoriaCor: "amarelo",
          titulo: marcoAtingido === 1
            ? "Seu primeiro pedido concluído!"
            : `${marcoAtingido} pedidos concluídos!`,
          descricao: marcoAtingido === 1
            ? "Parabéns! O começo de uma jornada incrível."
            : `Marco importante. Continue crescendo!`,
          cta: "Ver pedidos",
          path: "/pedidos",
          prioridade: 90,
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
          descricao: "Fotos vendem 3x mais — adicione pra atrair mais clientes.",
          cta: "Ver produtos",
          path: "/produtos",
          prioridade: 30,
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
            descricao: `Sem compras há mais de 60 dias — mande uma mensagem pra reativar.`,
            cta: "Ver clientes",
            path: "/clientes",
            prioridade: 20,
          });
        }
      }

      // Ordena por prioridade decrescente
      lista.sort((a, b) => b.prioridade - a.prioridade);
      setUpdates(lista.slice(0, MAX_VISIVEIS));
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [profile?.id, diaAtual, voltou]);

  if (loading) return null;
  if (updates.length === 0) return null;

  return (
    <div className="mu-root">
      {/* (07/10 · 3.05) no padrão do guia: ícone desenhado no lugar do emoji, rótulo em texto no lugar da etiqueta em maiúsculas,
          letras de 12,5px pra cima e cores pelo themes.css */}
      <div className="mu-header">
        <h2>Suas atualizações</h2>
      </div>
      <div className="mu-list">
        {updates.map((u) => (
          <button key={u.key} type="button" className={`mu-item mu-item--${u.categoriaCor}`} onClick={() => navigate(u.path)}>
            <span className="mu-ic" aria-hidden="true"><u.Icone size={20} weight="bold" /></span>
            <div className="mu-body">
              <span className="mu-cat">{u.categoria}</span>
              <p className="mu-title">{u.titulo}</p>
              <p className="mu-desc">{u.descricao}</p>
              <span className="mu-cta">{u.cta} <CaretRight size={16} weight="bold" aria-hidden="true" /></span>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .mu-root { overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); }
        .mu-header { padding: 16px 16px 12px; color: var(--ui-texto); }
        .mu-header h2 { margin: 0; font-family: var(--font-base); font-size: 16px; font-weight: 700; line-height: 1.3; }
        .mu-list { display: flex; flex-direction: column; }
        .mu-item { display: flex; align-items: flex-start; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; margin: 0; padding: 12px 16px; background: transparent; border: 0; border-top: 1px solid var(--ui-linha); color: var(--ui-texto); font-family: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: background-color var(--dur-fast) linear; }
        @media (hover: hover) { .mu-item:hover { background: var(--ui-linha); } }
        .mu-item:active { background: var(--ui-cinza); }
        .mu-item:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
        .mu-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .mu-body { flex: 1; min-width: 0; }
        .mu-cat { display: block; font-size: 13px; font-weight: 500; line-height: 1.3; color: var(--ui-rosa-escuro); }
        .mu-title { margin: 2px 0 0; font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); }
        .mu-desc { margin: 2px 0 0; font-size: 13.5px; font-weight: 500; line-height: 1.45; color: var(--ui-texto-2); }
        .mu-cta { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 13.5px; font-weight: 700; color: var(--ui-rosa-escuro); }
        /* a cor diz a situação: vermelho = atrasado, laranja = atenção, verde = deu certo; o resto fica no rosa */
        .mu-item--vermelho .mu-ic { background: var(--ui-vermelho-fundo); color: var(--ui-vermelho); }
        .mu-item--vermelho .mu-cat { color: var(--ui-vermelho); }
        .mu-item--amarelo .mu-ic { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .mu-item--amarelo .mu-cat { color: var(--ui-laranja); }
        .mu-item--verde .mu-ic { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .mu-item--verde .mu-cat { color: var(--ui-verde); }
      `}</style>
    </div>
  );
}
