import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkle, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

interface Update {
  key: string;
  emoji: string;
  categoria: string;
  categoriaCor: "verde" | "rosa" | "vermelho" | "amarelo" | "azul" | "roxo";
  titulo: string;
  descricao: string;
  cta: string;
  path: string;
  prioridade: number; // maior = mais no topo
}

const STATUS_ATIVOS = ["aguardando", "confirmado", "em_preparo", "pronto"];
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
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

// Aniversariantes nos próximos 7 dias
function calcularAniversariantesSemana(clientes: any[]): { total: number; primeiro: string | null } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  let total = 0;
  let primeiro: string | null = null;
  let menorDias = Infinity;

  clientes.forEach((c) => {
    if (!c.data_nasc) return;
    const [, mes, dia] = String(c.data_nasc).slice(0, 10).split("-").map(Number);
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
      const hojeISO = hoje.toISOString().slice(0, 10);
      const semana = inicioFimSemana();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
      const inicioMesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10);
      const fimMesAnt = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10);
      const dataLimite60d = new Date(hoje); dataLimite60d.setDate(hoje.getDate() - 60);

      const [
        pedidosAtrasadosRes,
        entregasSemanaRes,
        clientesRes,
        produtosSemFotoRes,
        pedidosMesRes,
        pedidosMesAntRes,
        totalPedidosRes,
        clientesComVendaRes,
      ] = await Promise.all([
        // 1. Pedidos atrasados (entrega passou e não foi entregue)
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lt("data_entrega", hojeISO)
          .in("status", STATUS_ATIVOS),
        // 2. Entregas essa semana
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("data_entrega", semana.inicio)
          .lte("data_entrega", semana.fim)
          .in("status", STATUS_ATIVOS),
        // 3. Clientes com data_nasc pra aniversariantes
        supabase
          .from("clientes")
          .select("nome, data_nasc")
          .eq("user_id", userId)
          .not("data_nasc", "is", null),
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
          .gte("data_pedido", inicioMes)
          .in("status", STATUS_ENTREGUE),
        // 6. Faturamento mês anterior
        supabase
          .from("pedidos")
          .select("valor_total")
          .eq("user_id", userId)
          .gte("data_pedido", inicioMesAnt)
          .lte("data_pedido", fimMesAnt)
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
          .gte("data_pedido", dataLimite60d.toISOString().slice(0, 10))
          .not("cliente_id", "is", null),
      ]);

      const lista: Update[] = [];

      // 1️⃣ Pedidos atrasados (prioridade máxima)
      const nAtrasados = pedidosAtrasadosRes.count || 0;
      if (nAtrasados > 0) {
        lista.push({
          key: "atrasados",
          emoji: "⚠️",
          categoria: "Urgente",
          categoriaCor: "vermelho",
          titulo: `${nAtrasados} ${nAtrasados === 1 ? "pedido atrasado" : "pedidos atrasados"}`,
          descricao: nAtrasados === 1
            ? "Uma entrega passou da data — atualize o status."
            : `${nAtrasados} entregas passaram da data — atualize os status.`,
          cta: "Ver pedidos",
          path: "/pedidos",
          prioridade: 100,
        });
      }

      // 2️⃣ Entregas essa semana
      const nEntregas = entregasSemanaRes.count || 0;
      if (nEntregas > 0) {
        lista.push({
          key: "entregas-semana",
          emoji: "⏰",
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
          emoji: "🎂",
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
      if (marcoAtingido) {
        lista.push({
          key: `marco-${marcoAtingido}`,
          emoji: "🏆",
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
            emoji: "📈",
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
            emoji: "📉",
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
          emoji: "📸",
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
            emoji: "💤",
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
      <div className="mu-header">
        <Sparkle size={18} weight="fill" />
        <h2>Suas atualizações</h2>
      </div>
      <div className="mu-list">
        {updates.map((u) => (
          <button key={u.key} className="mu-item" onClick={() => navigate(u.path)}>
            <span className="mu-emoji">{u.emoji}</span>
            <div className="mu-body">
              <span className={`mu-cat mu-cat--${u.categoriaCor}`}>{u.categoria}</span>
              <p className="mu-title">{u.titulo}</p>
              <p className="mu-desc">{u.descricao}</p>
              <span className="mu-cta">{u.cta} <CaretRight size={11} weight="bold" /></span>
            </div>
          </button>
        ))}
      </div>

      <style>{`
        .mu-root {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.06);
        }
        .mu-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1.15rem 1.25rem;
          color: var(--text-title);
        }
        .mu-header h2 {
          margin: 0;
          font-size: 0.95rem;
          font-weight: var(--fw-bold);
        }
        .mu-list { display: flex; flex-direction: column; }
        .mu-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.9rem 1.25rem;
          background: transparent;
          border: none;
          border-top: 1px solid var(--border);
          font-family: inherit;
          text-align: left;
          cursor: pointer;
          transition: background var(--dur-fast);
          width: 100%;
        }
        .mu-item:hover { background: var(--bg-body); }
        .mu-item:active { background: #F5F0F2; }
        .mu-emoji {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: #FFF5F9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }
        .mu-body { flex: 1; min-width: 0; }
        .mu-cat {
          display: inline-block;
          font-size: 9.5px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .mu-cat--verde     { background: #DCFCE7; color: #15803D; }
        .mu-cat--rosa      { background: #FCE7F3; color: #C33A6E; }
        .mu-cat--vermelho  { background: #FEE2E2; color: #B91C1C; }
        .mu-cat--amarelo   { background: #FEF3C7; color: #B45309; }
        .mu-cat--azul      { background: #DBEAFE; color: #1D4ED8; }
        .mu-cat--roxo      { background: #EDE9FE; color: #6D28D9; }
        .mu-title {
          margin: 0;
          font-size: 0.85rem;
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          line-height: 1.3;
        }
        .mu-desc {
          margin: 3px 0 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .mu-cta {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          margin-top: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #C33A6E;
        }
      `}</style>
    </div>
  );
}
