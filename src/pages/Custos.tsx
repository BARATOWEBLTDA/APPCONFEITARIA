// Custos — gestão de custos fixos, variáveis e mão de obra
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  CaretLeft, Plus, PencilSimple, Trash, X, House,
  Calculator, Percent, Clock, Buildings, Coin, Info,
} from "@phosphor-icons/react";

type CustoFixo = {
  id: string;
  nome: string;
  valor: number;
  ativo: boolean;
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
  dias_semana: number;
};

type Tab = "resumo" | "mao-obra" | "fixos" | "variaveis";

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const VALOR_BASE_VARIAVEL = 100; // base usada para estimar custos variáveis

export default function Custos() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("resumo");

  const [fixos, setFixos] = useState<CustoFixo[]>([]);
  const [variaveis, setVariaveis] = useState<CustoVariavel[]>([]);
  const [maoObra, setMaoObra] = useState<ConfigMaoObra>({
    salario_mensal: 0,
    horas_dia: 8,
    dias_semana: 5,
  });

  // ── Modais ──
  const [modalFixo, setModalFixo] = useState<CustoFixo | "novo" | null>(null);
  const [modalVar, setModalVar] = useState<CustoVariavel | "novo" | null>(null);
  const [modalMaoObra, setModalMaoObra] = useState(false);
  const [deleteFixo, setDeleteFixo] = useState<CustoFixo | null>(null);
  const [deleteVar, setDeleteVar] = useState<CustoVariavel | null>(null);

  // ── Carrega usuário ──
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  // ── Carrega dados ──
  useEffect(() => {
    if (!userId) return;
    loadAll();
  }, [userId]);

  async function loadAll() {
    if (!userId) return;
    setLoading(true);
    const [f, v, m] = await Promise.all([
      supabase.from("custos_fixos").select("*").eq("user_id", userId).order("nome"),
      supabase.from("custos_variaveis").select("*").eq("user_id", userId).order("nome"),
      supabase.from("config_mao_obra").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (f.data) setFixos(f.data);
    if (v.data) setVariaveis(v.data);
    if (m.data) {
      setMaoObra({
        salario_mensal: Number(m.data.salario_mensal) || 0,
        horas_dia: Number(m.data.horas_dia) || 8,
        dias_semana: Number(m.data.dias_semana) || 5,
      });
    }
    setLoading(false);
  }

  // ── Totais derivados ──
  const totalFixosMes = useMemo(
    () => fixos.filter(f => f.ativo).reduce((s, f) => s + Number(f.valor), 0),
    [fixos]
  );

  const horasSemana = maoObra.horas_dia * maoObra.dias_semana;
  const horasMes = horasSemana * 4.345; // semanas por mês

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

  // Estimativa de custos variáveis para uma venda hipotética
  const estimativaVariaveis = useMemo(() => {
    return variaveis.filter(v => v.ativo).reduce((s, v) => {
      if (v.tipo === "percentual") {
        return s + (VALOR_BASE_VARIAVEL * Number(v.valor) / 100);
      }
      return s + Number(v.valor);
    }, 0);
  }, [variaveis]);

  // ── CRUD: Custos Fixos ──
  async function salvarFixo(nome: string, valor: number, ativo: boolean, id?: string) {
    if (!userId) return;
    if (id) {
      await supabase.from("custos_fixos")
        .update({ nome, valor, ativo })
        .eq("id", id);
    } else {
      await supabase.from("custos_fixos")
        .insert({ user_id: userId, nome, valor, ativo });
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
  async function salvarVariavel(
    nome: string,
    tipo: "percentual" | "fixo",
    valor: number,
    ativo: boolean,
    id?: string
  ) {
    if (!userId) return;
    if (id) {
      await supabase.from("custos_variaveis")
        .update({ nome, tipo, valor, ativo })
        .eq("id", id);
    } else {
      await supabase.from("custos_variaveis")
        .insert({ user_id: userId, nome, tipo, valor, ativo });
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

  // ── Salvar mão de obra ──
  async function salvarMaoObra(salario: number, horas: number, dias: number) {
    if (!userId) return;
    await supabase.from("config_mao_obra")
      .upsert({
        user_id: userId,
        salario_mensal: salario,
        horas_dia: horas,
        dias_semana: dias,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    setModalMaoObra(false);
    loadAll();
  }

  return (
    <div className="cu-root">
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
      <div className="cu-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "resumo"}
          className={`cu-tab ${tab === "resumo" ? "active" : ""}`}
          onClick={() => setTab("resumo")}
        >
          <House size={16} weight="duotone" />
          <span>Resumo</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "mao-obra"}
          className={`cu-tab ${tab === "mao-obra" ? "active" : ""}`}
          onClick={() => setTab("mao-obra")}
        >
          <Clock size={16} weight="duotone" />
          <span>Mão de Obra</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "fixos"}
          className={`cu-tab ${tab === "fixos" ? "active" : ""}`}
          onClick={() => setTab("fixos")}
        >
          <Buildings size={16} weight="duotone" />
          <span>Fixos</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "variaveis"}
          className={`cu-tab ${tab === "variaveis" ? "active" : ""}`}
          onClick={() => setTab("variaveis")}
        >
          <Percent size={16} weight="duotone" />
          <span>Variáveis</span>
        </button>
      </div>

      {/* ── Resumo ── */}
      {tab === "resumo" && (
        <div className="cu-content">
          <h2 className="cu-section-label">Resumo geral dos custos</h2>
          <div className="cu-summary">
            <div className="cu-sum-card">
              <div className="cu-sum-icon" style={{ background: "var(--primary-light)", color: "var(--text-title)" }}>
                <Buildings size={18} weight="duotone" />
              </div>
              <div className="cu-sum-body">
                <p className="cu-sum-label">Custos fixos (mês)</p>
                <p className="cu-sum-value">{fmtMoney(totalFixosMes)}</p>
              </div>
            </div>
            <div className="cu-sum-card">
              <div className="cu-sum-icon" style={{ background: "var(--primary-light)", color: "var(--text-title)" }}>
                <Calculator size={18} weight="duotone" />
              </div>
              <div className="cu-sum-body">
                <p className="cu-sum-label">Mão de obra (mês)</p>
                <p className="cu-sum-value">{fmtMoney(maoObra.salario_mensal)}</p>
              </div>
            </div>
            <div className="cu-sum-card">
              <div className="cu-sum-icon" style={{ background: "var(--primary-light)", color: "var(--text-title)" }}>
                <Clock size={18} weight="duotone" />
              </div>
              <div className="cu-sum-body">
                <p className="cu-sum-label">
                  Custo por hora
                  <span className="cu-sum-info" title="Soma de custos fixos + mão de obra dividido pelas horas trabalhadas no mês">
                    <Info size={12} weight="regular" />
                  </span>
                </p>
                <p className="cu-sum-value">{fmtMoney(custoPorHora)}</p>
              </div>
            </div>
            <div className="cu-sum-card">
              <div className="cu-sum-icon" style={{ background: "var(--primary-light)", color: "var(--text-title)" }}>
                <Percent size={18} weight="duotone" />
              </div>
              <div className="cu-sum-body">
                <p className="cu-sum-label">Variáveis (est. {fmtMoney(VALOR_BASE_VARIAVEL)})</p>
                <p className="cu-sum-value">~{fmtMoney(estimativaVariaveis)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mão de Obra ── */}
      {tab === "mao-obra" && (
        <div className="cu-content">
          <div className="cu-card">
            <div className="cu-card-header">
              <Calculator size={20} weight="duotone" />
              <h2 className="cu-card-title">Calculadora de Mão de Obra</h2>
            </div>
            <p className="cu-card-desc">
              Calcule o valor da sua hora de trabalho com base no salário desejado e na carga horária.
              Esse valor será usado para precificar o tempo de produção de cada receita.
            </p>

            <div className="cu-mo-config">
              <div className="cu-mo-header">
                <Clock size={20} weight="duotone" />
                <div>
                  <p className="cu-mo-title">Mão de Obra Configurada</p>
                  <p className="cu-mo-sub">{maoObra.horas_dia}h/dia, {maoObra.dias_semana} dias/semana</p>
                </div>
              </div>
              <p className="cu-mo-value">{fmtMoney(maoObra.salario_mensal)}</p>
              <button className="cu-btn-secondary" onClick={() => setModalMaoObra(true)}>
                <PencilSimple size={14} weight="bold" />
                Editar configuração
              </button>
            </div>

            <h3 className="cu-section-label">Resumo dos cálculos</h3>
            <div className="cu-mo-grid">
              <div className="cu-mo-stat">
                <p className="cu-mo-stat-label">Horas/semana</p>
                <p className="cu-mo-stat-value">{horasSemana}h</p>
              </div>
              <div className="cu-mo-stat">
                <p className="cu-mo-stat-label">Horas/mês</p>
                <p className="cu-mo-stat-value">{horasMes.toFixed(0)}h</p>
              </div>
              <div className="cu-mo-stat">
                <p className="cu-mo-stat-label">Valor/hora</p>
                <p className="cu-mo-stat-value">{fmtMoney(valorHora)}</p>
              </div>
              <div className="cu-mo-stat">
                <p className="cu-mo-stat-label">Valor/dia</p>
                <p className="cu-mo-stat-value">{fmtMoney(valorDia)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Custos Fixos ── */}
      {tab === "fixos" && (
        <div className="cu-content">
          <div className="cu-card">
            <div className="cu-card-header">
              <Buildings size={20} weight="duotone" />
              <h2 className="cu-card-title">Gestão de Custos Fixos</h2>
            </div>
            <p className="cu-card-desc">
              Custos fixos mensais (aluguel, internet, energia) e despesas recorrentes.
              Esses custos compõem o custo por hora da sua empresa.
            </p>

            <div className="cu-list-header">
              <h3 className="cu-section-label">
                <Coin size={14} weight="duotone" /> {fixos.length} {fixos.length === 1 ? "custo cadastrado" : "custos cadastrados"}
              </h3>
              <button className="cu-btn-primary" onClick={() => setModalFixo("novo")}>
                <Plus size={14} weight="bold" />
                Adicionar
              </button>
            </div>

            {loading ? (
              <p className="cu-empty">Carregando…</p>
            ) : fixos.length === 0 ? (
              <div className="cu-empty">
                <Buildings size={32} weight="duotone" />
                <p>Nenhum custo fixo cadastrado</p>
              </div>
            ) : (
              <div className="cu-list">
                {fixos.map(f => (
                  <div key={f.id} className={`cu-item ${!f.ativo ? "inativo" : ""}`}>
                    <div className="cu-item-info">
                      <p className="cu-item-nome">{f.nome}</p>
                      {!f.ativo && <span className="cu-badge-inativo">inativo</span>}
                    </div>
                    <p className="cu-item-valor">{fmtMoney(Number(f.valor))}<span>/mês</span></p>
                    <div className="cu-item-actions">
                      <button className="cu-icon-btn" onClick={() => setModalFixo(f)} aria-label="Editar">
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
            )}
          </div>
        </div>
      )}

      {/* ── Custos Variáveis ── */}
      {tab === "variaveis" && (
        <div className="cu-content">
          <div className="cu-card">
            <div className="cu-card-header">
              <Percent size={20} weight="duotone" />
              <h2 className="cu-card-title">Custos Variáveis da Venda</h2>
            </div>
            <p className="cu-card-desc">
              Despesas atreladas diretamente a cada venda: taxas de cartão, comissões de
              plataformas, embalagens. Podem ser percentuais (%) ou valor fixo (R$).
            </p>

            <div className="cu-list-header">
              <h3 className="cu-section-label">
                <Coin size={14} weight="duotone" /> {variaveis.length} {variaveis.length === 1 ? "custo cadastrado" : "custos cadastrados"}
              </h3>
              <button className="cu-btn-primary" onClick={() => setModalVar("novo")}>
                <Plus size={14} weight="bold" />
                Adicionar
              </button>
            </div>

            {loading ? (
              <p className="cu-empty">Carregando…</p>
            ) : variaveis.length === 0 ? (
              <div className="cu-empty">
                <Percent size={32} weight="duotone" />
                <p>Nenhum custo variável cadastrado</p>
              </div>
            ) : (
              <div className="cu-list">
                {variaveis.map(v => (
                  <div key={v.id} className={`cu-item ${!v.ativo ? "inativo" : ""}`}>
                    <div className="cu-item-info">
                      <p className="cu-item-nome">{v.nome}</p>
                      {!v.ativo && <span className="cu-badge-inativo">inativo</span>}
                    </div>
                    <p className="cu-item-valor">
                      {v.tipo === "percentual"
                        ? `${Number(v.valor).toFixed(2)}%`
                        : fmtMoney(Number(v.valor))}
                    </p>
                    <div className="cu-item-actions">
                      <button className="cu-icon-btn" onClick={() => setModalVar(v)} aria-label="Editar">
                        <PencilSimple size={14} weight="bold" />
                      </button>
                      <button className="cu-icon-btn cu-icon-btn--danger" onClick={() => setDeleteVar(v)} aria-label="Excluir">
                        <Trash size={14} weight="bold" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Custo Fixo */}
      {modalFixo && (
        <ModalFixo
          item={modalFixo === "novo" ? null : modalFixo}
          onClose={() => setModalFixo(null)}
          onSave={salvarFixo}
        />
      )}

      {/* Modal Custo Variável */}
      {modalVar && (
        <ModalVariavel
          item={modalVar === "novo" ? null : modalVar}
          onClose={() => setModalVar(null)}
          onSave={salvarVariavel}
        />
      )}

      {/* Modal Mão de Obra */}
      {modalMaoObra && (
        <ModalMaoObra
          config={maoObra}
          onClose={() => setModalMaoObra(false)}
          onSave={salvarMaoObra}
        />
      )}

      {/* Confirmações */}
      {deleteFixo && (
        <ConfirmDelete
          nome={deleteFixo.nome}
          onClose={() => setDeleteFixo(null)}
          onConfirm={excluirFixo}
        />
      )}
      {deleteVar && (
        <ConfirmDelete
          nome={deleteVar.nome}
          onClose={() => setDeleteVar(null)}
          onConfirm={excluirVariavel}
        />
      )}

      <style>{`
        .cu-root {
          font-family: var(--font-base);
          padding: var(--space-5) var(--space-4) 6rem;
          display: flex; flex-direction: column; gap: var(--space-4);
          max-width: 980px; margin: 0 auto;
        }

        /* Header */
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

        /* Tabs */
        .cu-tabs {
          display: flex; gap: var(--space-1);
          padding: var(--space-1);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .cu-tab {
          display: inline-flex; align-items: center; gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--text-secondary);
          font-family: inherit;
          font-size: var(--font-helper);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          white-space: nowrap;
          transition: background var(--dur-fast) var(--ease-out),
                      color var(--dur-fast) var(--ease-out);
        }
        .cu-tab.active {
          background: var(--bg-card);
          color: var(--text-title);
          box-shadow: var(--shadow-sm);
        }

        .cu-content { display: flex; flex-direction: column; gap: var(--space-3); }

        /* Section label */
        .cu-section-label {
          display: inline-flex; align-items: center; gap: var(--space-1);
          font-size: var(--font-section-label);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }

        /* Summary grid */
        .cu-summary {
          display: flex; flex-direction: column;
          gap: var(--space-3);
        }
        @media (min-width: 600px) {
          .cu-summary { display: grid; grid-template-columns: repeat(2, 1fr); }
        }
        .cu-sum-card {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--pad-card);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .cu-sum-icon {
          width: 38px; height: 38px;
          border-radius: var(--radius-md);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .cu-sum-body { flex: 1; min-width: 0; }
        .cu-sum-label {
          display: flex; align-items: center; gap: var(--space-1);
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          margin: 0 0 var(--space-1);
        }
        .cu-sum-info {
          display: inline-flex; cursor: help;
          color: var(--text-muted);
        }
        .cu-sum-value {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          line-height: var(--lh-tight);
          letter-spacing: var(--ls-tight);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Card genérico */
        .cu-card {
          padding: var(--pad-card);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .cu-card-header {
          display: flex; align-items: center; gap: var(--space-2);
          color: var(--text-title);
        }
        .cu-card-title {
          font-size: var(--font-card-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }
        .cu-card-desc {
          font-size: var(--font-helper);
          color: var(--text-secondary);
          line-height: var(--lh-normal);
          margin: 0;
        }

        /* Mão de obra config */
        .cu-mo-config {
          padding: var(--pad-card);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
          display: flex; flex-direction: column; gap: var(--space-3);
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
        .cu-mo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }
        .cu-mo-stat {
          padding: var(--space-3);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }
        .cu-mo-stat-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
          margin: 0 0 var(--space-1);
        }
        .cu-mo-stat-value {
          font-size: var(--font-card-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
        }

        /* Lista */
        .cu-list-header {
          display: flex; align-items: center; justify-content: space-between;
          gap: var(--space-2);
        }
        .cu-list {
          display: flex; flex-direction: column;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .cu-item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3);
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
        }
        .cu-item:last-of-type { border-bottom: none; }
        .cu-item.inativo { opacity: 0.55; }
        .cu-item-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-2); }
        .cu-item-nome {
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-title);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cu-badge-inativo {
          font-size: var(--font-caption);
          font-weight: var(--fw-bold);
          color: var(--text-muted);
          background: var(--bg-subtle);
          padding: 2px var(--space-2);
          border-radius: var(--radius-full);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }
        .cu-item-valor {
          font-size: var(--font-button);
          font-weight: var(--fw-black);
          color: var(--text-title);
          margin: 0;
          letter-spacing: var(--ls-tight);
          white-space: nowrap;
        }
        .cu-item-valor span {
          font-size: var(--font-caption);
          font-weight: var(--fw-medium);
          color: var(--text-muted);
          margin-left: 2px;
        }
        .cu-item-actions { display: flex; gap: var(--space-1); flex-shrink: 0; }
        .cu-icon-btn {
          width: 30px; height: 30px;
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
        }

        .cu-empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-6) var(--space-4);
          color: var(--text-muted);
          text-align: center;
          font-size: var(--font-button);
        }
        .cu-empty p { margin: 0; }

        /* Botões */
        .cu-btn-primary {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          background: var(--primary);
          color: var(--text-inverse);
          border: none;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
        }
        .cu-btn-primary:hover { background: var(--primary-dark); }
        .cu-btn-secondary {
          display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1);
          padding: var(--space-2) var(--space-4);
          background: var(--btn-secondary-bg);
          color: var(--btn-secondary-text);
          border: 1px solid var(--btn-secondary-border);
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          cursor: pointer;
          transition: background var(--dur-fast) var(--ease-out);
          align-self: flex-start;
        }
        .cu-btn-secondary:hover { background: var(--btn-secondary-hover); }

        /* ── Modal styles (compartilhados) ── */
        .cu-modal-overlay {
          position: fixed; inset: 0;
          background: var(--bg-overlay);
          display: flex; align-items: flex-end; justify-content: center;
          z-index: 100;
          padding: var(--space-4);
        }
        @media (min-width: 600px) {
          .cu-modal-overlay { align-items: center; }
        }
        .cu-modal {
          width: 100%; max-width: 480px;
          background: var(--bg-card);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          padding: var(--pad-modal);
          display: flex; flex-direction: column; gap: var(--space-4);
          max-height: 90vh;
          overflow-y: auto;
        }
        @media (min-width: 600px) {
          .cu-modal { border-radius: var(--radius-xl); }
        }
        .cu-modal-header {
          display: flex; align-items: center; justify-content: space-between;
        }
        .cu-modal-title {
          font-size: var(--font-modal-title);
          font-weight: var(--fw-bold);
          color: var(--text-title);
          margin: 0;
        }
        .cu-modal-close {
          width: 32px; height: 32px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--bg-subtle);
          border: none;
          border-radius: var(--radius-full);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .cu-modal-form { display: flex; flex-direction: column; gap: var(--space-3); }
        .cu-field { display: flex; flex-direction: column; gap: var(--space-1); }
        .cu-field-label {
          font-size: var(--font-field-label);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
        }
        .cu-input {
          padding: var(--pad-input);
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-input);
          color: var(--text-primary);
          transition: border-color var(--dur-fast) var(--ease-out);
        }
        .cu-input:focus {
          outline: none;
          border-color: var(--border-focus);
          box-shadow: var(--focus-ring);
        }
        .cu-radio-group { display: flex; gap: var(--space-2); }
        .cu-radio {
          flex: 1;
          padding: var(--space-3);
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-semibold);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all var(--dur-fast) var(--ease-out);
        }
        .cu-radio.active {
          background: var(--primary-light);
          border-color: var(--primary);
          color: var(--text-title);
        }
        .cu-check-row {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: var(--font-button);
          color: var(--text-secondary);
          cursor: pointer;
        }
        .cu-check-row input { accent-color: var(--primary); }
        .cu-modal-actions {
          display: flex; gap: var(--space-2);
          margin-top: var(--space-2);
        }
        .cu-modal-actions button { flex: 1; padding: var(--space-3); }
        .cu-modal-confirm {
          padding: var(--space-2) var(--space-3);
          background: var(--error);
          color: #FFFFFF;
          border: none;
          border-radius: var(--radius-full);
          font-family: inherit;
          font-size: var(--font-button);
          font-weight: var(--fw-bold);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────
   Sub-componentes: Modais
   ────────────────────────────────────────── */

function ModalFixo({
  item, onClose, onSave,
}: {
  item: CustoFixo | null;
  onClose: () => void;
  onSave: (nome: string, valor: number, ativo: boolean, id?: string) => void;
}) {
  const [nome, setNome] = useState(item?.nome || "");
  const [valor, setValor] = useState(item ? String(item.valor) : "");
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  function submit() {
    const v = parseFloat(valor.replace(",", "."));
    if (!nome.trim() || isNaN(v) || v < 0) return;
    onSave(nome.trim(), v, ativo, item?.id);
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <div className="cu-modal-header">
          <h2 className="cu-modal-title">{item ? "Editar custo fixo" : "Novo custo fixo"}</h2>
          <button className="cu-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} weight="bold" /></button>
        </div>
        <div className="cu-modal-form">
          <div className="cu-field">
            <label className="cu-field-label">Nome</label>
            <input
              className="cu-input"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Aluguel, Internet, Energia"
              autoFocus
            />
          </div>
          <div className="cu-field">
            <label className="cu-field-label">Valor mensal (R$)</label>
            <input
              className="cu-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <label className="cu-check-row">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            Ativo (somar no custo do mês)
          </label>
          <div className="cu-modal-actions">
            <button className="cu-btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="cu-btn-primary" onClick={submit}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalVariavel({
  item, onClose, onSave,
}: {
  item: CustoVariavel | null;
  onClose: () => void;
  onSave: (nome: string, tipo: "percentual" | "fixo", valor: number, ativo: boolean, id?: string) => void;
}) {
  const [nome, setNome] = useState(item?.nome || "");
  const [tipo, setTipo] = useState<"percentual" | "fixo">(item?.tipo || "percentual");
  const [valor, setValor] = useState(item ? String(item.valor) : "");
  const [ativo, setAtivo] = useState(item?.ativo ?? true);

  function submit() {
    const v = parseFloat(valor.replace(",", "."));
    if (!nome.trim() || isNaN(v) || v < 0) return;
    onSave(nome.trim(), tipo, v, ativo, item?.id);
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <div className="cu-modal-header">
          <h2 className="cu-modal-title">{item ? "Editar custo variável" : "Novo custo variável"}</h2>
          <button className="cu-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} weight="bold" /></button>
        </div>
        <div className="cu-modal-form">
          <div className="cu-field">
            <label className="cu-field-label">Nome</label>
            <input
              className="cu-input"
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Taxa iFood, Maquininha, Embalagem"
              autoFocus
            />
          </div>
          <div className="cu-field">
            <label className="cu-field-label">Tipo</label>
            <div className="cu-radio-group">
              <button
                className={`cu-radio ${tipo === "percentual" ? "active" : ""}`}
                onClick={() => setTipo("percentual")}
              >% Percentual</button>
              <button
                className={`cu-radio ${tipo === "fixo" ? "active" : ""}`}
                onClick={() => setTipo("fixo")}
              >R$ Fixo</button>
            </div>
          </div>
          <div className="cu-field">
            <label className="cu-field-label">{tipo === "percentual" ? "Valor (%)" : "Valor (R$)"}</label>
            <input
              className="cu-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <label className="cu-check-row">
            <input type="checkbox" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            Ativo (usar no cálculo de preço de venda)
          </label>
          <div className="cu-modal-actions">
            <button className="cu-btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="cu-btn-primary" onClick={submit}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalMaoObra({
  config, onClose, onSave,
}: {
  config: ConfigMaoObra;
  onClose: () => void;
  onSave: (salario: number, horas: number, dias: number) => void;
}) {
  const [salario, setSalario] = useState(String(config.salario_mensal));
  const [horas, setHoras] = useState(String(config.horas_dia));
  const [dias, setDias] = useState(String(config.dias_semana));

  function submit() {
    const s = parseFloat(salario.replace(",", "."));
    const h = parseFloat(horas.replace(",", "."));
    const d = parseInt(dias);
    if (isNaN(s) || isNaN(h) || isNaN(d) || s < 0 || h <= 0 || d <= 0 || d > 7) return;
    onSave(s, h, d);
  }

  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <div className="cu-modal-header">
          <h2 className="cu-modal-title">Configurar mão de obra</h2>
          <button className="cu-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} weight="bold" /></button>
        </div>
        <div className="cu-modal-form">
          <div className="cu-field">
            <label className="cu-field-label">Quanto você quer ganhar por mês? (R$)</label>
            <input
              className="cu-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={salario}
              onChange={e => setSalario(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="cu-field">
            <label className="cu-field-label">Horas por dia</label>
            <input
              className="cu-input"
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0.5"
              max="24"
              value={horas}
              onChange={e => setHoras(e.target.value)}
            />
          </div>
          <div className="cu-field">
            <label className="cu-field-label">Dias por semana</label>
            <input
              className="cu-input"
              type="number"
              inputMode="numeric"
              min="1"
              max="7"
              value={dias}
              onChange={e => setDias(e.target.value)}
            />
          </div>
          <div className="cu-modal-actions">
            <button className="cu-btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="cu-btn-primary" onClick={submit}>Salvar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({
  nome, onClose, onConfirm,
}: {
  nome: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="cu-modal-overlay" onClick={onClose}>
      <div className="cu-modal" onClick={e => e.stopPropagation()}>
        <div className="cu-modal-header">
          <h2 className="cu-modal-title">Excluir custo</h2>
          <button className="cu-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} weight="bold" /></button>
        </div>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--font-button)" }}>
          "{nome}" será removido permanentemente. Esta ação não pode ser desfeita.
        </p>
        <div className="cu-modal-actions">
          <button className="cu-btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="cu-modal-confirm" onClick={onConfirm}>Excluir</button>
        </div>
      </div>
    </div>
  );
}
