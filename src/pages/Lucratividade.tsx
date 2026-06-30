// Lucratividade — página estratégica do Financeiro.
//
// Responde a 1 pergunta: "Estou ganhando dinheiro? Onde?"
//
// Renderiza dois cenários de forma natural, baseado nos dados reais:
//   A) Iniciante: sem custos preenchidos -> mostra faturamento, canais,
//      comparativo, e convida a preencher fichas tecnicas.
//   B) Engajada: custos preenchidos -> tudo + composicao, top produtos,
//      ponto de equilibrio, margem.
//
// Calculos:
//   receita        = SUM(pedidos.valor_total) onde status_pagamento='pago'
//   custo_diretos  = SUM(pedido_itens.custo_unitario_snapshot * quantidade)
//   custos_fixos   = SUM(custos_fixos.valor) ativos
//   mao_obra       = config_mao_obra.salario_mensal
//   custos_var     = SUM(custos_variaveis ativos aplicados sobre receita)
//   lucro_liquido  = receita - (custo_diretos + custos_fixos + mao_obra + custos_var)
//   margem         = lucro_liquido / receita * 100
//   ponto_equilib  = (custos_fixos + mao_obra) / margem_contribuicao
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  CaretLeft, CaretRight, ChartLineUp, TrendUp, TrendDown,
  Storefront, Trophy, Target, Lightbulb, Coins,
} from "@phosphor-icons/react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { FinCard, FinEmpty, FinInputGlobalStyles } from "@/components/financeiro";

/* ─────────── Tipos ─────────── */

type LucratividadeMes = {
  user_id: string;
  mes: string;
  qtd_pedidos: number;
  receita_bruta: number;
  receita_produtos: number;
  receita_taxa_entrega: number;
  descontos_aplicados: number;
  custo_produtos_vendidos: number;
  itens_vendidos: number;
};

type ProdutoMes = {
  user_id: string;
  mes: string;
  produto_id: string | null;
  nome_produto: string;
  imagem_url: string | null;
  quantidade_vendida: number;
  receita: number;
  custo: number;
  lucro_bruto: number;
};

type PedidoOrigem = {
  origem: string;
  valor_total: number;
};

type CustoFixo = { valor: number; ativo: boolean };
type CustoVariavel = { tipo: "percentual" | "fixo"; valor: number; ativo: boolean };
type ConfigMaoObra = { salario_mensal: number };

/* ─────────── Helpers ─────────── */

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

function isoMonthStart(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function labelOrigem(o: string): string {
  if (!o || o.trim() === "") return "Outro";
  if (o === "cardapio") return "Cardápio Doonly";
  if (o === "manual") return "Cadastro manual";
  return o; // Instagram, Facebook, Google, etc.
}

/* ─────────── Página ─────────── */

export default function Lucratividade() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Mês selecionado (default: mês atual)
  const [refDate, setRefDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [mesAtual, setMesAtual] = useState<LucratividadeMes | null>(null);
  const [mesAnterior, setMesAnterior] = useState<LucratividadeMes | null>(null);
  const [historico, setHistorico] = useState<LucratividadeMes[]>([]);
  const [produtosMes, setProdutosMes] = useState<ProdutoMes[]>([]);
  const [origens, setOrigens] = useState<PedidoOrigem[]>([]);

  const [custosFixos, setCustosFixos] = useState<CustoFixo[]>([]);
  const [custosVar, setCustosVar] = useState<CustoVariavel[]>([]);
  const [maoObra, setMaoObra] = useState<ConfigMaoObra>({ salario_mensal: 0 });

  /* Auth */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  /* Load */
  useEffect(() => {
    if (!userId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refDate]);

  async function loadAll() {
    if (!userId) return;
    setLoading(true);

    const mesAtualISO = isoMonthStart(refDate);
    const dPrev = new Date(refDate);
    dPrev.setMonth(dPrev.getMonth() - 1);
    const mesPrevISO = isoMonthStart(dPrev);

    const d6 = new Date(refDate);
    d6.setMonth(d6.getMonth() - 5);
    const mes6ISO = isoMonthStart(d6);

    const mesProx = new Date(refDate);
    mesProx.setMonth(mesProx.getMonth() + 1);

    const [lucr, lucrHist, prods, ped, fixos, vars, cfg] = await Promise.all([
      supabase.from("v_lucratividade_mes")
        .select("*").eq("user_id", userId)
        .in("mes", [mesAtualISO, mesPrevISO]),
      supabase.from("v_lucratividade_mes")
        .select("*").eq("user_id", userId)
        .gte("mes", mes6ISO).lte("mes", mesAtualISO)
        .order("mes"),
      supabase.from("v_lucratividade_produto_mes")
        .select("*").eq("user_id", userId).eq("mes", mesAtualISO)
        .order("receita", { ascending: false }),
      supabase.from("pedidos")
        .select("origem, valor_total")
        .eq("user_id", userId)
        .eq("status_pagamento", "pago")
        .gte("data_pedido", mesAtualISO)
        .lt("data_pedido", isoMonthStart(mesProx)),
      supabase.from("custos_fixos")
        .select("valor, ativo").eq("user_id", userId),
      supabase.from("custos_variaveis")
        .select("tipo, valor, ativo").eq("user_id", userId),
      supabase.from("config_mao_obra")
        .select("salario_mensal").eq("user_id", userId).maybeSingle(),
    ]);

    const atual = (lucr.data || []).find((r) => r.mes === mesAtualISO) || null;
    const anterior = (lucr.data || []).find((r) => r.mes === mesPrevISO) || null;
    setMesAtual(atual ? toLucr(atual) : null);
    setMesAnterior(anterior ? toLucr(anterior) : null);
    setHistorico((lucrHist.data || []).map(toLucr));
    setProdutosMes((prods.data || []).map(toProduto));
    setOrigens((ped.data || []) as PedidoOrigem[]);
    setCustosFixos((fixos.data || []) as CustoFixo[]);
    setCustosVar((vars.data || []) as CustoVariavel[]);
    if (cfg.data) setMaoObra({ salario_mensal: Number(cfg.data.salario_mensal) || 0 });

    setLoading(false);
  }

  /* ─────────── Cálculos derivados ─────────── */

  const calc = useMemo(() => {
    const receita = mesAtual?.receita_bruta ?? 0;
    const custoDireto = mesAtual?.custo_produtos_vendidos ?? 0;

    const totalFixos = custosFixos
      .filter((f) => f.ativo)
      .reduce((s, f) => s + Number(f.valor), 0);

    const salario = maoObra.salario_mensal;

    const totalVariaveis = custosVar
      .filter((v) => v.ativo)
      .reduce((s, v) => {
        if (v.tipo === "percentual") return s + (receita * Number(v.valor)) / 100;
        return s + Number(v.valor);
      }, 0);

    const custoTotal = custoDireto + totalFixos + salario + totalVariaveis;
    const lucroLiquido = receita - custoTotal;
    const margem = receita > 0 ? (lucroLiquido / receita) * 100 : 0;

    // Ponto de equilíbrio
    const margemContrib = receita > 0
      ? (receita - custoDireto - totalVariaveis) / receita
      : 0;
    const pontoEquilibrio = margemContrib > 0
      ? (totalFixos + salario) / margemContrib
      : 0;
    const progressoEquilibrio = pontoEquilibrio > 0
      ? Math.min((receita / pontoEquilibrio) * 100, 999)
      : 0;

    // Comparativo
    const receitaAnterior = mesAnterior?.receita_bruta ?? 0;
    const varReceita = receitaAnterior > 0
      ? ((receita - receitaAnterior) / receitaAnterior) * 100
      : null;

    // Detecta cenário A (iniciante)
    const semCustosDiretos = custoDireto === 0 && receita > 0;
    const cenarioIniciante = semCustosDiretos;

    return {
      receita, custoDireto, totalFixos, salario, totalVariaveis,
      custoTotal, lucroLiquido, margem,
      pontoEquilibrio, progressoEquilibrio,
      receitaAnterior, varReceita,
      cenarioIniciante,
    };
  }, [mesAtual, mesAnterior, custosFixos, custosVar, maoObra]);

  /* ─────────── Origens agregadas ─────────── */

  const origensAgg = useMemo(() => {
    const map = new Map<string, number>();
    origens.forEach((o) => {
      const key = labelOrigem(o.origem);
      map.set(key, (map.get(key) || 0) + Number(o.valor_total || 0));
    });
    return Array.from(map.entries())
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [origens]);

  const totalOrigens = origensAgg.reduce((s, o) => s + o.valor, 0);

  /* ─────────── Top produtos ordenados ─────────── */

  const topReceita = produtosMes.slice(0, 5);
  const topLucrativos = useMemo(() => {
    return [...produtosMes]
      .filter((p) => p.lucro_bruto > 0)
      .sort((a, b) => b.lucro_bruto - a.lucro_bruto)
      .slice(0, 5);
  }, [produtosMes]);

  /* ─────────── Histórico para sparkline ─────────── */

  const chartData = useMemo(() => {
    return historico.map((h) => {
      const d = new Date(h.mes);
      return {
        mes: MESES[d.getMonth()].slice(0, 3),
        receita: Number(h.receita_bruta) || 0,
      };
    });
  }, [historico]);

  /* ─────────── Navegação de mês ─────────── */

  function prevMonth() {
    const d = new Date(refDate);
    d.setMonth(d.getMonth() - 1);
    setRefDate(d);
  }
  function nextMonth() {
    const d = new Date(refDate);
    d.setMonth(d.getMonth() + 1);
    setRefDate(d);
  }
  const isMesAtual = useMemo(() => {
    const hoje = new Date();
    return (
      refDate.getMonth() === hoje.getMonth() &&
      refDate.getFullYear() === hoje.getFullYear()
    );
  }, [refDate]);

  /* ─────────── Render ─────────── */

  const semDados = !loading && calc.receita === 0;

  return (
    <div className="lu-root">
      <FinInputGlobalStyles />

      {/* Header */}
      <div className="lu-page-header">
        <button className="lu-back" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Voltar
        </button>
        <div className="lu-page-titles">
          <h1 className="lu-title">Lucratividade</h1>
          <p className="lu-sub">Onde está o seu lucro de verdade</p>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="lu-month-nav">
        <button onClick={prevMonth} aria-label="Mês anterior" className="lu-month-btn">
          <CaretLeft size={16} weight="bold" />
        </button>
        <span className="lu-month-label">
          {MESES[refDate.getMonth()]} de {refDate.getFullYear()}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Próximo mês"
          className="lu-month-btn"
          disabled={isMesAtual}
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </div>

      {loading ? (
        <div className="lu-loading">Carregando…</div>
      ) : semDados ? (
        <FinCard>
          <FinEmpty
            icon={<ChartLineUp size={36} weight="duotone" />}
            title="Nenhuma venda paga neste mês"
            description="Quando você marcar pedidos como pagos, aparece aqui a análise completa do seu lucro, margem e ponto de equilíbrio."
            actionLabel="Ver meus pedidos"
            onAction={() => navigate("/pedidos")}
          />
        </FinCard>
      ) : (
        <>
          {/* HERO */}
          <FinCard>
            <div className="lu-hero">
              {calc.cenarioIniciante ? (
                <>
                  <span className="lu-hero-eyebrow">Faturamento do mês</span>
                  <p className="lu-hero-value">{fmtMoney(calc.receita)}</p>
                  <p className="lu-hero-note">
                    {mesAtual?.qtd_pedidos ?? 0} {mesAtual?.qtd_pedidos === 1 ? "pedido pago" : "pedidos pagos"}
                  </p>
                </>
              ) : (
                <>
                  <span className="lu-hero-eyebrow">Lucro líquido do mês</span>
                  <p className={`lu-hero-value ${calc.lucroLiquido < 0 ? "lu-neg" : ""}`}>
                    {fmtMoney(calc.lucroLiquido)}
                  </p>
                  <p className="lu-hero-note">Margem de {fmtPct(calc.margem)}</p>
                </>
              )}

              {calc.varReceita !== null && (
                <div className={`lu-trend ${calc.varReceita >= 0 ? "lu-trend--up" : "lu-trend--down"}`}>
                  {calc.varReceita >= 0
                    ? <TrendUp size={14} weight="bold" />
                    : <TrendDown size={14} weight="bold" />}
                  {calc.varReceita >= 0 ? "+" : ""}{fmtPct(calc.varReceita)} vs. mês anterior
                </div>
              )}
            </div>

            {chartData.length > 1 && (
              <div className="lu-sparkline">
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(v: number) => fmtMoney(v)}
                      cursor={{ fill: "var(--bg-subtle)" }}
                      contentStyle={{
                        borderRadius: 8, border: "1px solid var(--border)",
                        background: "var(--bg-card)", fontSize: 12,
                      }}
                    />
                    <Bar dataKey="receita" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === chartData.length - 1 ? "#3d1a24" : "#ECC2D0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </FinCard>

          {/* CTA cenário A — pedido pra preencher custos */}
          {calc.cenarioIniciante && (
            <FinEmpty
              image="/Sistema/doo.png"
              title="Quer ver seu lucro de verdade?"
              description="Pra eu te mostrar quanto sobra no fim do mês, preciso saber quanto custa produzir cada produto. Preencha a ficha técnica e a análise aparece completa aqui."
              actionLabel="Preencher custos dos produtos"
              onAction={() => navigate("/produtos")}
            />
          )}

          {/* COMPOSIÇÃO — só no cenário B */}
          {!calc.cenarioIniciante && calc.receita > 0 && (
            <FinCard
              icon={<Coins size={20} weight="duotone" />}
              title="Para onde foi cada R$ 100"
              description="Composição do que entrou no caixa este mês."
            >
              <div className="lu-comp">
                <CompRow label="Ingredientes / matéria-prima" valor={calc.custoDireto} total={calc.receita} cor="#A86B7E" />
                <CompRow label="Custos fixos" valor={calc.totalFixos} total={calc.receita} cor="#C58FA1" />
                <CompRow label="Mão de obra" valor={calc.salario} total={calc.receita} cor="#D5A8B6" />
                <CompRow label="Taxas e embalagens" valor={calc.totalVariaveis} total={calc.receita} cor="#E4C2CD" />
                <CompRow label="Sobrou (lucro)" valor={Math.max(calc.lucroLiquido, 0)} total={calc.receita} cor="#3d1a24" destaque />
              </div>
            </FinCard>
          )}

          {/* TOP PRODUTOS */}
          {produtosMes.length > 0 && (
            <FinCard
              icon={<Trophy size={20} weight="duotone" />}
              title={calc.cenarioIniciante ? "Mais vendidos do mês" : "Mais lucrativos do mês"}
              description={
                calc.cenarioIniciante
                  ? "Ranking por receita. Quando você preencher os custos, vira ranking por lucro real."
                  : "Os produtos que mais geraram lucro para você este mês."
              }
            >
              <div className="lu-top">
                {(calc.cenarioIniciante ? topReceita : topLucrativos.length > 0 ? topLucrativos : topReceita)
                  .map((p, idx) => {
                    const margemP = p.receita > 0 ? (p.lucro_bruto / p.receita) * 100 : 0;
                    return (
                      <div key={(p.produto_id || "x") + idx} className="lu-top-item">
                        <span className="lu-top-rank">{idx + 1}</span>
                        <div className="lu-top-info">
                          <p className="lu-top-nome">{p.nome_produto}</p>
                          <p className="lu-top-meta">
                            {p.quantidade_vendida} vendidos
                            {!calc.cenarioIniciante && p.lucro_bruto > 0 && (
                              <> · margem {fmtPct(margemP)}</>
                            )}
                          </p>
                        </div>
                        <div className="lu-top-valor">
                          <strong>{fmtMoney(calc.cenarioIniciante ? p.receita : p.lucro_bruto)}</strong>
                          <span>{calc.cenarioIniciante ? "receita" : "lucro"}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </FinCard>
          )}

          {/* CANAIS */}
          {origensAgg.length > 0 && (
            <FinCard
              icon={<Storefront size={20} weight="duotone" />}
              title="Por onde vieram suas vendas"
              description="Distribuição da receita por canal de origem dos pedidos."
            >
              <div className="lu-canais">
                {origensAgg.map((c) => {
                  const pct = totalOrigens > 0 ? (c.valor / totalOrigens) * 100 : 0;
                  return (
                    <div key={c.nome} className="lu-canal">
                      <div className="lu-canal-head">
                        <span className="lu-canal-nome">{c.nome}</span>
                        <strong className="lu-canal-valor">{fmtMoney(c.valor)}</strong>
                      </div>
                      <div className="lu-canal-bar">
                        <div className="lu-canal-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="lu-canal-pct">{fmtPct(pct)} do total</span>
                    </div>
                  );
                })}
              </div>
            </FinCard>
          )}

          {/* PONTO DE EQUILÍBRIO */}
          {!calc.cenarioIniciante && calc.pontoEquilibrio > 0 && (
            <FinCard
              icon={<Target size={20} weight="duotone" />}
              title="Ponto de equilíbrio"
              description="O quanto você precisa faturar pra cobrir todos os custos do mês."
            >
              <div className="lu-equilib">
                <div className="lu-equilib-stats">
                  <div>
                    <span className="lu-equilib-label">Pra zerar o mês</span>
                    <strong>{fmtMoney(calc.pontoEquilibrio)}</strong>
                  </div>
                  <div>
                    <span className="lu-equilib-label">Já vendeu</span>
                    <strong>{fmtMoney(calc.receita)}</strong>
                  </div>
                </div>
                <div className="lu-equilib-bar">
                  <div
                    className="lu-equilib-bar-fill"
                    style={{
                      width: `${Math.min(calc.progressoEquilibrio, 100)}%`,
                      background: calc.progressoEquilibrio >= 100 ? "#3d1a24" : "#C58FA1",
                    }}
                  />
                </div>
                <p className="lu-equilib-msg">
                  <Lightbulb size={14} weight="duotone" />
                  {calc.progressoEquilibrio >= 100 ? (
                    <span>Você está <strong>{fmtMoney(calc.receita - calc.pontoEquilibrio)}</strong> acima do equilíbrio. Tudo isso é lucro de verdade.</span>
                  ) : (
                    <span>Faltam <strong>{fmtMoney(calc.pontoEquilibrio - calc.receita)}</strong> em vendas pra cobrir os custos do mês.</span>
                  )}
                </p>
              </div>
            </FinCard>
          )}
        </>
      )}

      <style>{`
        .lu-root {
          font-family: var(--font-base);
          padding: var(--space-5) var(--space-4) 6rem;
          display: flex; flex-direction: column; gap: var(--space-4);
          max-width: 980px; margin: 0 auto;
        }
        .lu-page-header {
          display: flex; flex-direction: column;
          align-items: flex-start;
          gap: var(--space-2);
        }
        .lu-back {
          display: inline-flex; align-items: center; gap: 6px; padding: 0;
          background: none; border: none; font-family: var(--font-base);
          font-size: var(--font-button); font-weight: var(--fw-medium);
          color: var(--text-secondary); cursor: pointer;
          transition: color var(--dur-fast) var(--ease-out);
        }
        .lu-back:hover { color: var(--text-title); }
        .lu-back:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 4px;
          border-radius: 4px;
        }
        .lu-page-titles { display: flex; flex-direction: column; gap: var(--space-1); }
        .lu-title {
          font-size: var(--font-page-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .lu-sub {
          font-size: var(--font-page-subtitle);
          color: var(--text-secondary);
          margin: 0;
        }

        .lu-month-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
        }
        .lu-month-btn {
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent;
          border: none;
          border-radius: var(--radius-full);
          color: var(--text-title);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .lu-month-btn:hover:not(:disabled) { background: var(--bg-subtle); }
        .lu-month-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .lu-month-label {
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
        }

        .lu-loading {
          padding: 3rem 1rem; text-align: center; color: var(--text-muted);
          font-size: var(--font-button);
        }

        .lu-hero {
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 4px;
          padding-bottom: var(--space-3);
        }
        .lu-hero-eyebrow {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }
        .lu-hero-value {
          font-size: clamp(2rem, 7vw, 2.6rem);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 4px 0 0;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
          line-height: 1.05;
        }
        .lu-hero-value.lu-neg { color: var(--error); }
        .lu-hero-note {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          margin: 4px 0 0;
        }
        .lu-trend {
          display: inline-flex; align-items: center; gap: 4px;
          margin-top: var(--space-2);
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
        }
        .lu-trend--up   { background: rgba(16,185,129,0.12); color: #047857; }
        .lu-trend--down { background: rgba(239,68,68,0.12);  color: var(--error); }

        .lu-sparkline { margin-top: var(--space-1); }

        .lu-comp { display: flex; flex-direction: column; gap: var(--space-2); }

        .lu-top {
          display: flex; flex-direction: column;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .lu-top-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          border-bottom: 1px solid var(--border);
        }
        .lu-top-item:last-child { border-bottom: none; }
        .lu-top-rank {
          width: 28px; height: 28px;
          display: inline-flex; align-items: center; justify-content: center;
          border-radius: var(--radius-full);
          background: var(--primary-light);
          color: var(--text-title);
          font-size: var(--font-helper);
          font-weight: var(--fw-bold);
          flex-shrink: 0;
        }
        .lu-top-info { flex: 1; min-width: 0; }
        .lu-top-nome {
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .lu-top-meta {
          font-size: var(--font-caption);
          color: var(--text-muted);
          margin: 2px 0 0;
        }
        .lu-top-valor {
          display: flex; flex-direction: column; align-items: flex-end;
          flex-shrink: 0;
        }
        .lu-top-valor strong {
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          font-variant-numeric: tabular-nums;
        }
        .lu-top-valor span {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          margin-top: 2px;
        }

        .lu-canais { display: flex; flex-direction: column; gap: var(--space-3); }
        .lu-canal { display: flex; flex-direction: column; gap: 6px; }
        .lu-canal-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .lu-canal-nome {
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
        }
        .lu-canal-valor {
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          font-variant-numeric: tabular-nums;
        }
        .lu-canal-bar {
          height: 8px;
          background: var(--bg-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .lu-canal-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3d1a24, #C58FA1);
          border-radius: var(--radius-full);
          transition: width 0.6s var(--ease-out);
        }
        .lu-canal-pct {
          font-size: var(--font-caption);
          color: var(--text-muted);
        }

        .lu-equilib { display: flex; flex-direction: column; gap: var(--space-3); }
        .lu-equilib-stats {
          display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2);
        }
        .lu-equilib-stats > div {
          padding: var(--space-3);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }
        .lu-equilib-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          display: block; margin-bottom: 4px;
        }
        .lu-equilib-stats strong {
          font-size: var(--font-card-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: var(--ls-tight);
          font-variant-numeric: tabular-nums;
        }
        .lu-equilib-bar {
          height: 12px;
          background: var(--bg-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .lu-equilib-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.8s var(--ease-out);
        }
        .lu-equilib-msg {
          display: flex; align-items: flex-start; gap: 6px;
          font-size: var(--font-helper);
          color: var(--text-secondary);
          line-height: 1.45;
          margin: 0;
          padding: var(--space-3);
          background: var(--primary-light);
          border-radius: var(--radius-md);
        }
        .lu-equilib-msg strong { color: var(--text-title); font-weight: var(--fw-bold); }
      `}</style>
    </div>
  );
}

/* ─────────── Subcomponentes ─────────── */

function CompRow({ label, valor, total, cor, destaque }: {
  label: string;
  valor: number;
  total: number;
  cor: string;
  destaque?: boolean;
}) {
  const pct = total > 0 ? (valor / total) * 100 : 0;
  return (
    <div className={`lu-comp-row ${destaque ? "lu-comp-row--destaque" : ""}`}>
      <div className="lu-comp-head">
        <span className="lu-comp-label">{label}</span>
        <strong className="lu-comp-valor">{fmtMoney(valor)}</strong>
      </div>
      <div className="lu-comp-bar" aria-hidden="true">
        <div className="lu-comp-bar-fill" style={{ width: `${pct}%`, background: cor }} />
      </div>
      <span className="lu-comp-pct">{fmtPct(pct)} da receita</span>

      <style>{`
        .lu-comp-row { display: flex; flex-direction: column; gap: 4px; }
        .lu-comp-row--destaque {
          padding: var(--space-2);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          margin-top: var(--space-1);
        }
        .lu-comp-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .lu-comp-label {
          font-size: var(--font-button);
          color: var(--text-secondary);
        }
        .lu-comp-row--destaque .lu-comp-label {
          font-weight: var(--fw-bold);
          color: var(--text-title);
        }
        .lu-comp-valor {
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          font-variant-numeric: tabular-nums;
        }
        .lu-comp-row--destaque .lu-comp-valor {
          font-weight: var(--fw-black);
        }
        .lu-comp-bar {
          height: 6px;
          background: var(--bg-subtle);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .lu-comp-row--destaque .lu-comp-bar { background: var(--bg-card); }
        .lu-comp-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.6s var(--ease-out);
        }
        .lu-comp-pct {
          font-size: var(--font-caption);
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

/* ─────────── Mappers ─────────── */

function toLucr(r: Record<string, unknown>): LucratividadeMes {
  return {
    user_id: String(r.user_id),
    mes: String(r.mes),
    qtd_pedidos: Number(r.qtd_pedidos) || 0,
    receita_bruta: Number(r.receita_bruta) || 0,
    receita_produtos: Number(r.receita_produtos) || 0,
    receita_taxa_entrega: Number(r.receita_taxa_entrega) || 0,
    descontos_aplicados: Number(r.descontos_aplicados) || 0,
    custo_produtos_vendidos: Number(r.custo_produtos_vendidos) || 0,
    itens_vendidos: Number(r.itens_vendidos) || 0,
  };
}

function toProduto(r: Record<string, unknown>): ProdutoMes {
  return {
    user_id: String(r.user_id),
    mes: String(r.mes),
    produto_id: r.produto_id ? String(r.produto_id) : null,
    nome_produto: String(r.nome_produto || ""),
    imagem_url: r.imagem_url ? String(r.imagem_url) : null,
    quantidade_vendida: Number(r.quantidade_vendida) || 0,
    receita: Number(r.receita) || 0,
    custo: Number(r.custo) || 0,
    lucro_bruto: Number(r.lucro_bruto) || 0,
  };
}
