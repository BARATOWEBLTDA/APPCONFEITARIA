import { useEffect, useState } from "react";
import { dataISO } from "@/lib/pedidoStatus";
import { useNavigate } from "react-router-dom";
import { CaretRight, Clock, Cake, Trophy, TrendUp, TrendDown, Camera, Moon } from "@phosphor-icons/react";
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
const STATUS_ATIVOS = ["aguardando_pagamento", "aguardando_aceite", "novo", "pendente", "agendado", "confirmado", "em_producao", "em_preparo", "finalizado", "pronto", "aguardando_retirada", "aguardando_entrega", "em_entrega", "a_caminho"];
const STATUS_ENTREGUE = ["entregue", "concluido"];
const MAX_VISIVEIS = 4;

// Calcula domingo→sábado da semana atual
function inicioFimSemana() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 = dom
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - diaSemana);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(inicio.getDate() + 6);
  fim.setHours(23, 59, 59, 999);
  return { inicio: dataISO(inicio), fim: dataISO(fim) };
}

// Aniversariantes nos próximos 7 dias
function calcularAniversariantesSemana(clientes: any[]): { total: number; primeiro: string | null } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let total = 0;
  let primeiro: string | null = null;
  let menorDias = Infinity;

  clientes.forEach((c) => {
    if (!c.data_nascimento) return;
    const [, mes, dia] = String(c.data_nascimento).slice(0, 10).split("-").map(Number);
    if (!mes || !dia) return;
    const aniv = new Date(hoje.getFullYear(), mes - 1, dia);
    if (aniv < hoje) aniv.setFullYear(aniv.getFullYear() + 1);
    const dias = Math.floor((aniv.getTime() - hoje.getTime()) / 86400000);
    if (dias >= 0 && dias <= 7) {
      total++;
      if (dias < menorDias) {
        menorDias = dias;
        primeiro = c.nome || null;
      }
    }
  });

  return { total, primeiro };
}

export default function MinhasAtualizacoes() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const userId = profile.id;
      const hoje = new Date();
      // (07/10 · 3.02) datas no horário do Brasil: antes, depois das 21h, a semana ganhava um dia
      const semana = inicioFimSemana();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString(); // o instante exato em que o mês começou aqui
      const inicioMesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString();
      const dataLimite60d = new Date(hoje); dataLimite60d.setDate(hoje.getDate() - 60);

      const [
        entregasSemanaRes,
        clientesRes,
        produtosSemFotoRes,
        pedidosMesRes,
        pedidosMesAntRes,
        totalPedidosRes,
        clientesComVendaRes,
      ] = await Promise.all([
        // 2. Entregas essa semana
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("data_entrega", semana.inicio)
          .lte("data_entrega", semana.fim)
          .in("status", STATUS_ATIVOS),
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
          .gte("created_at", inicioMes)
          .in("status", STATUS_ENTREGUE),
        // 6. Faturamento mês anterior
        supabase
          .from("pedidos")
          .select("valor_total")
          .eq("user_id", userId)
          .gte("created_at", inicioMesAnt)
          .lt("created_at", inicioMes) // até o fim do mês passado (antes o último dia ficava de fora)
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
          .gte("created_at", dataLimite60d.toISOString().slice(0, 10))
          .not("cliente_id", "is", null),
      ]);

      const lista: Update[] = [];

      // (07/10 · 3.07) Os pedidos atrasados saíram daqui: já aparecem no "Seu dia", no topo do Início, e estavam repetidos.

      // 2️⃣ Entregas essa semana
      const nEntregas = entregasSemanaRes.count || 0;
      if (nEntregas > 0) {
        lista.push({
          key: "entregas-semana",
          Icone: Clock,
          categoria: "Esta semana",
          categoriaCor: "azul",
          titulo: `${nEntregas} ${nEntregas === 1 ? "entrega essa semana" : "entregas essa semana"}`,
          descricao: nEntregas === 1
            ? "Você tem uma entrega programada — se organize."
            : "Se organize pra dar conta de todas as entregas.",
          cta: "Ver agenda",
          path: "/agenda",
          prioridade: 80,
        });
      }

      // 3️⃣ Aniversariantes
      const aniv = calcularAniversariantesSemana(clientesRes.data || []);
      if (aniv.total > 0) {
        const primeiroNome = aniv.primeiro?.split(" ")[0] || "";
        lista.push({
          key: "aniversarios",
          Icone: Cake,
          categoria: "Oportunidade",
          categoriaCor: "rosa",
          titulo: aniv.total === 1
            ? `${primeiroNome} faz aniversário essa semana!`
            : `${aniv.total} aniversariantes essa semana`,
          descricao: aniv.total === 1
            ? "Mande uma mensagem e ofereça um bolo especial."
            : `${primeiroNome} e outros — mande mensagens e ofereça bolos.`,
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
        if (diff >= 20) {
          lista.push({
            key: "faturamento-up",
            Icone: TrendUp,
            categoria: "Conquista",
            categoriaCor: "verde",
            titulo: `Faturamento subiu ${diff.toFixed(0)}%!`,
            descricao: `Comparado ao mês passado. Continue nesse ritmo!`,
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
            descricao: `Comparado ao mês passado — hora de reativar clientes.`,
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

      // 7️⃣ Clientes sumidos (comparação: total de clientes vs ativos)
      // Só faz sentido se tem base > 5
      if ((clientesRes.data?.length || 0) >= 5) {
        const clientesAtivos = new Set((clientesComVendaRes.data || []).map((v: any) => v.cliente_id));
        const totalCli = clientesRes.data?.length || 0;
        const sumidos = totalCli - clientesAtivos.size;
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
  }, [profile?.id]);

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
        .mu-header h2 { margin: 0; font-family: var(--font-base); font-size: 16px; font-weight: 800; line-height: 1.3; }
        .mu-list { display: flex; flex-direction: column; }
        .mu-item { display: flex; align-items: flex-start; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; margin: 0; padding: 12px 16px; background: transparent; border: 0; border-top: 1px solid var(--ui-linha); color: var(--ui-texto); font-family: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: background-color var(--dur-fast) linear; }
        @media (hover: hover) { .mu-item:hover { background: var(--ui-linha); } }
        .mu-item:active { background: var(--ui-cinza); }
        .mu-item:focus-visible { outline: 3px solid rgba(var(--ui-rosa-rgb), .45); outline-offset: -3px; }
        .mu-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .mu-body { flex: 1; min-width: 0; }
        .mu-cat { display: block; font-size: 12.5px; font-weight: 700; line-height: 1.3; color: var(--ui-rosa-escuro); }
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
