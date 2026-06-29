// Custos — gestão de custos fixos, variáveis e mão de obra.
// Reescrito sobre o design system /components/financeiro.
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  CaretLeft, Plus, PencilSimple, Trash, House,
  Calculator, Percent, Clock, Buildings, Coin, Info,
} from "@phosphor-icons/react";
import {
  FinTabs,
  FinCard,
  FinEmpty,
  FinInputGlobalStyles,
  type FinTab,
} from "@/components/financeiro";
import BtnNovo from "@/components/BtnNovo";
import ModalCustoFixo, { type CustoFixoInput } from "./custos/ModalCustoFixo";
import ModalCustoVariavel, { type CustoVariavelInput } from "./custos/ModalCustoVariavel";
import ModalMaoObra, { type MaoObraInput } from "./custos/ModalMaoObra";
import ConfirmDeleteCusto from "./custos/ConfirmDeleteCusto";

type CustoFixo = {
  id: string;
  nome: string;
  valor: number;
  ativo: boolean;
  dia_vencimento: number | null;
};

type CustoVariavel = {
  id: string;
  nome: string;
  tipo: "percentual" | "fixo";
  valor: number;
  ativo: boolean;
};

type ConfigMaoObra = {
  salario_mensal: number;
  horas_dia: number;
  dias_semana_array: number[];
};

type TabKey = "resumo" | "mao-obra" | "fixos" | "variaveis";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VALOR_BASE_VARIAVEL = 100;

const TABS: FinTab<TabKey>[] = [
  { key: "resumo", label: "Resumo", icon: <House size={18} weight="duotone" /> },
  { key: "mao-obra", label: "Mão de obra", icon: <Clock size={18} weight="duotone" /> },
  { key: "fixos", label: "Custos fixos", icon: <Buildings size={18} weight="duotone" /> },
  { key: "variaveis", label: "Custos variáveis", icon: <Percent size={18} weight="duotone" /> },
];

export default function Custos() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("resumo");

  const [fixos, setFixos] = useState<CustoFixo[]>([]);
  const [variaveis, setVariaveis] = useState<CustoVariavel[]>([]);
  const [maoObra, setMaoObra] = useState<ConfigMaoObra>({
    salario_mensal: 0,
    horas_dia: 8,
    dias_semana_array: [1, 2, 3, 4, 5],
  });

  // Modais
  const [modalFixo, setModalFixo] = useState<CustoFixoInput | "novo" | null>(null);
  const [modalVar, setModalVar] = useState<CustoVariavelInput | "novo" | null>(null);
  const [modalMaoObra, setModalMaoObra] = useState(false);
  const [deleteFixo, setDeleteFixo] = useState<CustoFixo | null>(null);
  const [deleteVar, setDeleteVar] = useState<CustoVariavel | null>(null);

  // Auth
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  // Load
  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  async function loadAll() {
    if (!userId) return;
    setLoading(true);
    const [f, v, m] = await Promise.all([
      supabase
        .from("custos_fixos")
        .select("id, nome, valor, ativo, dia_vencimento")
        .eq("user_id", userId)
        .order("nome"),
      supabase
        .from("custos_variaveis")
        .select("id, nome, tipo, valor, ativo")
        .eq("user_id", userId)
        .order("nome"),
      supabase
        .from("config_mao_obra")
        .select("salario_mensal, horas_dia, dias_semana, dias_semana_array")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (f.data) setFixos(f.data as CustoFixo[]);
    if (v.data) setVariaveis(v.data as CustoVariavel[]);
    if (m.data) {
      // Migra: se ainda não houver array salvo, deriva do número antigo (1..N)
      const arr: number[] = Array.isArray(m.data.dias_semana_array) && m.data.dias_semana_array.length > 0
        ? (m.data.dias_semana_array as number[])
        : Array.from({ length: Math.min(Math.max(Number(m.data.dias_semana) || 5, 1), 7) }, (_, i) => i + 1);
      setMaoObra({
        salario_mensal: Number(m.data.salario_mensal) || 0,
        horas_dia: Number(m.data.horas_dia) || 8,
        dias_semana_array: arr,
      });
    }
    setLoading(false);
  }

  // ── Totais ──
  const totalFixosMes = useMemo(
    () => fixos.filter(f => f.ativo).reduce((s, f) => s + Number(f.valor), 0),
    [fixos]
  );

  const horasSemana = maoObra.horas_dia * maoObra.dias_semana_array.length;
  const horasMes = horasSemana * 4.345;

  const custoPorHora = useMemo(() => {
    if (horasMes === 0) return 0;
    return (totalFixosMes + maoObra.salario_mensal) / horasMes;
  }, [totalFixosMes, maoObra.salario_mensal, horasMes]);

  const valorHora = useMemo(() => {
    if (horasMes === 0) return 0;
    return maoObra.salario_mensal / horasMes;
  }, [maoObra.salario_mensal, horasMes]);

  const valorDia = useMemo(
    () => valorHora * maoObra.horas_dia,
    [valorHora, maoObra.horas_dia]
  );

  const estimativaVariaveis = useMemo(() => {
    return variaveis.filter(v => v.ativo).reduce((s, v) => {
      if (v.tipo === "percentual") {
        return s + (VALOR_BASE_VARIAVEL * Number(v.valor) / 100);
      }
      return s + Number(v.valor);
    }, 0);
  }, [variaveis]);

  // ── CRUD: Custos Fixos ──
  async function salvarFixo(data: CustoFixoInput) {
    if (!userId) return;
    const payload = {
      nome: data.nome,
      valor: data.valor,
      ativo: data.ativo,
      dia_vencimento: data.dia_vencimento,
    };
    if (data.id) {
      await supabase.from("custos_fixos").update(payload).eq("id", data.id);
    } else {
      await supabase.from("custos_fixos").insert({ user_id: userId, ...payload });
    }
    setModalFixo(null);
    loadAll();
  }

  async function excluirFixo() {
    if (!deleteFixo) return;
    await supabase.from("custos_fixos").delete().eq("id", deleteFixo.id);
    setDeleteFixo(null);
    loadAll();
  }

  // ── CRUD: Custos Variáveis ──
  async function salvarVariavel(data: CustoVariavelInput) {
    if (!userId) return;
    const payload = {
      nome: data.nome,
      tipo: data.tipo,
      valor: data.valor,
      ativo: data.ativo,
    };
    if (data.id) {
      await supabase.from("custos_variaveis").update(payload).eq("id", data.id);
    } else {
      await supabase.from("custos_variaveis").insert({ user_id: userId, ...payload });
    }
    setModalVar(null);
    loadAll();
  }

  async function excluirVariavel() {
    if (!deleteVar) return;
    await supabase.from("custos_variaveis").delete().eq("id", deleteVar.id);
    setDeleteVar(null);
    loadAll();
  }

  // ── Mão de obra ──
  async function salvarMaoObra(data: MaoObraInput) {
    if (!userId) return;
    await supabase.from("config_mao_obra").upsert({
      user_id: userId,
      salario_mensal: data.salario_mensal,
      horas_dia: data.horas_dia,
      // Mantém compatibilidade com a coluna antiga
      dias_semana: data.dias_semana_array.length,
      dias_semana_array: data.dias_semana_array,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setModalMaoObra(false);
    loadAll();
  }

  return (
    <div className="cu-root">
      <FinInputGlobalStyles />

      {/* Header */}
      <div className="cu-page-header">
        <button className="cu-back" onClick={() => navigate("/financeiro")} aria-label="Voltar">
          <CaretLeft size={22} weight="bold" />
        </button>
        <div className="cu-page-titles">
          <h1 className="cu-title">Custos</h1>
          <p className="cu-sub">Gerencie seus custos e mão de obra</p>
        </div>
      </div>

      {/* Tabs */}
      <FinTabs tabs={TABS} active={tab} onChange={setTab} ariaLabel="Seções de custos" />

      {/* Resumo */}
      {tab === "resumo" && (
        <div className="cu-content">
          <h2 className="cu-section-label">Resumo geral dos custos</h2>
          <div className="cu-summary">
            <SumCard
              icon={<Buildings size={18} weight="duotone" />}
              label="Custos fixos (mês)"
              value={fmtMoney(totalFixosMes)}
            />
            <SumCard
              icon={<Calculator size={18} weight="duotone" />}
              label="Mão de obra (mês)"
              value={fmtMoney(maoObra.salario_mensal)}
            />
            <SumCard
              icon={<Clock size={18} weight="duotone" />}
              label={
                <>
                  Custo por hora{" "}
                  <span title="Soma de custos fixos + mão de obra dividido pelas horas trabalhadas no mês" style={{ display: "inline-flex", cursor: "help" }}>
                    <Info size={12} weight="regular" />
                  </span>
                </>
              }
              value={fmtMoney(custoPorHora)}
            />
            <SumCard
              icon={<Percent size={18} weight="duotone" />}
              label={`Variáveis (est. ${fmtMoney(VALOR_BASE_VARIAVEL)})`}
              value={`~${fmtMoney(estimativaVariaveis)}`}
            />
          </div>
        </div>
      )}

      {/* Mão de obra */}
      {tab === "mao-obra" && (
        <div className="cu-content">
          <FinCard
            icon={<Calculator size={20} weight="duotone" />}
            title="Calculadora de mão de obra"
            description="Calcule o valor da sua hora de trabalho com base no salário desejado e na carga horária. Esse valor será usado para precificar o tempo de produção de cada receita."
          >
            {maoObra.salario_mensal === 0 ? (
              <FinEmpty
                icon={<Calculator size={36} weight="duotone" />}
                title="Vamos calcular o valor da sua hora?"
                description="Em menos de 1 minuto você configura seu salário desejado e a carga horária."
                actionLabel="Calcular minha hora"
                onAction={() => setModalMaoObra(true)}
              />
            ) : (
              <>
                <div className="cu-mo-config">
                  <div className="cu-mo-header">
                    <Clock size={20} weight="duotone" />
                    <div>
                      <p className="cu-mo-title">Mão de obra configurada</p>
                      <p className="cu-mo-sub">
                        {maoObra.horas_dia}h/dia · {labelDiasArray(maoObra.dias_semana_array)}
                      </p>
                    </div>
                  </div>
                  <p className="cu-mo-value">{fmtMoney(maoObra.salario_mensal)}</p>
                  <div className="cu-mo-actions">
                    <BtnNovo
                      label="Editar configuração"
                      icon={<PencilSimple size={14} weight="bold" />}
                      onClick={() => setModalMaoObra(true)}
                      responsive={false}
                    />
                  </div>
                </div>

                <h3 className="cu-section-label">Resumo dos cálculos</h3>
                <div className="cu-mo-grid">
                  <Stat label="Horas/semana" value={`${horasSemana}h`} />
                  <Stat label="Horas/mês" value={`${horasMes.toFixed(0)}h`} />
                  <Stat label="Valor/hora" value={fmtMoney(valorHora)} />
                  <Stat label="Valor/dia" value={fmtMoney(valorDia)} />
                </div>
              </>
            )}
          </FinCard>
        </div>
      )}

      {/* Custos Fixos */}
      {tab === "fixos" && (
        <div className="cu-content">
          <FinCard
            icon={<Buildings size={20} weight="duotone" />}
            title="Gestão de custos fixos"
            description="Custos fixos mensais (aluguel, internet, energia) e despesas recorrentes. Compõem o custo por hora da sua empresa."
            headerAction={
              fixos.length > 0 ? (
                <BtnNovo label="Novo custo" onClick={() => setModalFixo("novo")} />
              ) : null
            }
          >
            {loading ? (
              <p className="cu-empty-line">Carregando…</p>
            ) : fixos.length === 0 ? (
              <FinEmpty
                icon={<Buildings size={36} weight="duotone" />}
                title="Você ainda não cadastrou nenhum custo fixo"
                description="Cadastre aluguel, energia, internet e outras despesas recorrentes para conhecer o custo real da sua produção."
                actionLabel="Cadastrar primeiro custo"
                onAction={() => setModalFixo("novo")}
              />
            ) : (
              <>
                <h3 className="cu-section-label">
                  <Coin size={14} weight="duotone" /> {fixos.length} {fixos.length === 1 ? "custo cadastrado" : "custos cadastrados"}
                </h3>
                <div className="cu-list">
                  {fixos.map(f => (
                    <div key={f.id} className={`cu-item ${!f.ativo ? "inativo" : ""}`}>
                      <div className="cu-item-info">
                        <p className="cu-item-nome">{f.nome}</p>
                        <div className="cu-item-meta">
                          {f.dia_vencimento && (
                            <span className="cu-badge">Vence dia {f.dia_vencimento}</span>
                          )}
                          {!f.ativo && <span className="cu-badge cu-badge--off">inativo</span>}
                        </div>
                      </div>
                      <p className="cu-item-valor">{fmtMoney(Number(f.valor))}<span>/mês</span></p>
                      <div className="cu-item-actions">
                        <button className="cu-icon-btn" onClick={() => setModalFixo({
                          id: f.id, nome: f.nome, valor: f.valor, ativo: f.ativo,
                          dia_vencimento: f.dia_vencimento,
                        })} aria-label="Editar">
                          <PencilSimple size={14} weight="bold" />
                        </button>
                        <button className="cu-icon-btn cu-icon-btn--danger" onClick={() => setDeleteFixo(f)} aria-label="Excluir">
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="cu-list-footer">
                    <span>Total mensal</span>
                    <strong>{fmtMoney(totalFixosMes)}</strong>
                  </div>
                </div>
              </>
            )}
          </FinCard>
        </div>
      )}

      {/* Custos Variáveis */}
      {tab === "variaveis" && (
        <div className="cu-content">
          <FinCard
            icon={<Percent size={20} weight="duotone" />}
            title="Custos variáveis da venda"
            description="Despesas atreladas diretamente a cada venda: taxas de cartão, comissões, embalagens. Podem ser percentuais (%) ou valor fixo (R$)."
            headerAction={
              variaveis.length > 0 ? (
                <BtnNovo label="Novo custo" onClick={() => setModalVar("novo")} />
              ) : null
            }
          >
            {loading ? (
              <p className="cu-empty-line">Carregando…</p>
            ) : variaveis.length === 0 ? (
              <FinEmpty
                icon={<Percent size={36} weight="duotone" />}
                title="Você ainda não cadastrou custos variáveis"
                description="Cadastre taxas de maquininha, comissões de iFood, embalagens e tudo que varia por venda."
                actionLabel="Cadastrar primeiro custo"
                onAction={() => setModalVar("novo")}
              />
            ) : (
              <>
                <h3 className="cu-section-label">
                  <Coin size={14} weight="duotone" /> {variaveis.length} {variaveis.length === 1 ? "custo cadastrado" : "custos cadastrados"}
                </h3>
                <div className="cu-list">
                  {variaveis.map(v => (
                    <div key={v.id} className={`cu-item ${!v.ativo ? "inativo" : ""}`}>
                      <div className="cu-item-info">
                        <p className="cu-item-nome">{v.nome}</p>
                        <div className="cu-item-meta">
                          <span className="cu-badge cu-badge--tipo">
                            {v.tipo === "percentual" ? "%" : "R$"}
                          </span>
                          {!v.ativo && <span className="cu-badge cu-badge--off">inativo</span>}
                        </div>
                      </div>
                      <p className="cu-item-valor">
                        {v.tipo === "percentual"
                          ? `${Number(v.valor).toFixed(2)}%`
                          : fmtMoney(Number(v.valor))}
                      </p>
                      <div className="cu-item-actions">
                        <button className="cu-icon-btn" onClick={() => setModalVar({
                          id: v.id, nome: v.nome, tipo: v.tipo, valor: v.valor, ativo: v.ativo,
                        })} aria-label="Editar">
                          <PencilSimple size={14} weight="bold" />
                        </button>
                        <button className="cu-icon-btn cu-icon-btn--danger" onClick={() => setDeleteVar(v)} aria-label="Excluir">
                          <Trash size={14} weight="bold" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </FinCard>
        </div>
      )}

      {/* Modais */}
      {modalFixo && (
        <ModalCustoFixo
          item={modalFixo === "novo" ? null : modalFixo}
          onClose={() => setModalFixo(null)}
          onSave={salvarFixo}
        />
      )}
      {modalVar && (
        <ModalCustoVariavel
          item={modalVar === "novo" ? null : modalVar}
          onClose={() => setModalVar(null)}
          onSave={salvarVariavel}
        />
      )}
      {modalMaoObra && (
        <ModalMaoObra
          config={maoObra}
          onClose={() => setModalMaoObra(false)}
          onSave={salvarMaoObra}
        />
      )}
      {deleteFixo && (
        <ConfirmDeleteCusto
          nome={deleteFixo.nome}
          onClose={() => setDeleteFixo(null)}
          onConfirm={excluirFixo}
        />
      )}
      {deleteVar && (
        <ConfirmDeleteCusto
          nome={deleteVar.nome}
          onClose={() => setDeleteVar(null)}
          onConfirm={excluirVariavel}
        />
      )}

      {/* Estilos exclusivos da página de Custos */}
      <style>{`
        .cu-root {
          font-family: var(--font-base);
          padding: var(--space-5) var(--space-4) 6rem;
          display: flex; flex-direction: column; gap: var(--space-4);
          max-width: 980px; margin: 0 auto;
        }
        .cu-page-header { display: flex; align-items: center; gap: var(--space-3); }
        .cu-back {
          width: 36px; height: 36px;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          color: var(--text-title);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .cu-back:hover { background: var(--bg-subtle); }
        .cu-page-titles { display: flex; flex-direction: column; gap: var(--space-1); }
        .cu-title {
          font-size: var(--font-page-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .cu-sub {
          font-size: var(--font-page-subtitle);
          color: var(--text-secondary);
          margin: 0;
        }
        .cu-content { display: flex; flex-direction: column; gap: var(--space-3); }
        .cu-section-label {
          display: inline-flex; align-items: center; gap: var(--space-1);
          font-size: var(--font-section-label);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }

        /* Resumo cards */
        .cu-summary {
          display: flex; flex-direction: column;
          gap: var(--space-3);
        }
        @media (min-width: 600px) {
          .cu-summary { display: grid; grid-template-columns: repeat(2, 1fr); }
        }

        /* Mão de obra */
        .cu-mo-config {
          padding: var(--pad-card);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          display: flex; flex-direction: column; gap: var(--space-3);
          align-items: center;
          text-align: center;
        }
        .cu-mo-header {
          display: flex; align-items: center; gap: var(--space-3);
          color: var(--text-title);
        }
        .cu-mo-title {
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }
        .cu-mo-sub {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          margin: 2px 0 0;
        }
        .cu-mo-value {
          font-size: var(--font-stat-value);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }
        .cu-mo-actions {
          display: flex; justify-content: center;
        }
        .cu-mo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }

        /* Lista */
        .cu-list {
          display: flex; flex-direction: column;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--bg-card);
        }
        .cu-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          border-bottom: 1px solid var(--border);
        }
        .cu-item:last-of-type { border-bottom: none; }
        .cu-item.inativo { opacity: 0.55; }
        .cu-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .cu-item-nome {
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cu-item-meta {
          display: flex; gap: var(--space-1); flex-wrap: wrap;
        }
        .cu-badge {
          font-size: 11px;
          font-weight: var(--fw-bold);
          color: var(--text-title);
          background: var(--primary-light);
          padding: 2px 8px;
          border-radius: var(--radius-full);
          letter-spacing: 0.02em;
        }
        .cu-badge--off {
          color: var(--text-muted);
          background: var(--bg-subtle);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }
        .cu-badge--tipo {
          background: #3d1a24;
          color: #fff;
        }
        .cu-item-valor {
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .cu-item-valor span {
          font-size: var(--font-caption);
          font-weight: var(--fw-medium);
          color: var(--text-muted);
          margin-left: 2px;
        }
        .cu-item-actions { display: flex; gap: var(--space-1); flex-shrink: 0; }
        .cu-icon-btn {
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--bg-subtle);
          border: none;
          border-radius: var(--radius-sm);
          color: var(--text-title);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .cu-icon-btn:hover { background: var(--primary-light); }
        .cu-icon-btn--danger:hover { background: rgba(239,68,68,0.15); color: var(--error); }
        .cu-list-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-3);
          background: var(--bg-subtle);
          font-size: var(--font-button);
          color: var(--text-secondary);
        }
        .cu-list-footer strong {
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: var(--ls-tight);
          font-variant-numeric: tabular-nums;
        }
        .cu-empty-line {
          padding: var(--space-4);
          color: var(--text-muted);
          text-align: center;
          font-size: var(--font-button);
          margin: 0;
        }
      `}</style>
    </div>
  );
}

/* ─── Subcomponentes internos ─── */

function SumCard({ icon, label, value }: {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: string;
}) {
  return (
    <div className="sum-card">
      <div className="sum-card-icon">{icon}</div>
      <div className="sum-card-body">
        <p className="sum-card-label">{label}</p>
        <p className="sum-card-value">{value}</p>
      </div>
      <style>{`
        .sum-card {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--pad-card);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .sum-card-icon {
          width: 38px; height: 38px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          background: var(--primary-light);
          color: var(--text-title);
        }
        .sum-card-body { flex: 1; min-width: 0; }
        .sum-card-label {
          display: flex; align-items: center; gap: var(--space-1);
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          margin: 0 0 var(--space-1);
        }
        .sum-card-value {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          line-height: var(--lh-tight);
          letter-spacing: var(--ls-tight);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <style>{`
        .stat {
          padding: var(--space-3);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }
        .stat-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          margin: 0 0 var(--space-1);
        }
        .stat-value {
          font-size: var(--font-card-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

/* ─── Helpers ─── */

function labelDiasArray(arr: number[]): string {
  if (arr.length === 7) return "todos os dias";
  if (arr.length === 5 && arr.join() === "1,2,3,4,5") return "seg–sex";
  if (arr.length === 6 && arr.join() === "1,2,3,4,5,6") return "seg–sáb";
  const map: Record<number, string> = {
    1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb", 7: "Dom",
  };
  return arr.map(d => map[d]).join(", ");
}
