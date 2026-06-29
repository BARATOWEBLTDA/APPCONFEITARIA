import { useState } from "react";
import {
  FinModal,
  FinModalFooter,
  FinField,
  FinMoneyInput,
  FinNumberInput,
  FinDaysOfWeek,
} from "@/components/financeiro";

export interface MaoObraInput {
  salario_mensal: number;
  horas_dia: number;
  dias_semana_array: number[];
}

interface ModalMaoObraProps {
  config: MaoObraInput;
  onClose: () => void;
  onSave: (data: MaoObraInput) => void;
}

/**
 * Modal de configuração da Mão de Obra.
 *
 * Mudanças em relação ao modal antigo:
 *  - Salário com prefixo R$ embutido (FinMoneyInput).
 *  - Horas por dia limitadas a 1-24 (FinNumberInput valida no blur).
 *  - "Dias por semana" passa a ser seleção dos dias específicos (Seg-Dom).
 *    O array selecionado tem comprimento N = qtd de dias trabalhados,
 *    e mantém compatibilidade com o campo `dias_semana` (int) que continua
 *    no banco durante a transição.
 */
export default function ModalMaoObra({ config, onClose, onSave }: ModalMaoObraProps) {
  const [salario, setSalario] = useState<number | "">(config.salario_mensal || "");
  const [horas, setHoras] = useState<number | "">(config.horas_dia || 8);
  const [dias, setDias] = useState<number[]>(
    config.dias_semana_array && config.dias_semana_array.length > 0
      ? config.dias_semana_array
      : [1, 2, 3, 4, 5]
  );
  const [erro, setErro] = useState("");

  function submit() {
    const s = typeof salario === "number" ? salario : 0;
    const h = typeof horas === "number" ? horas : 0;
    if (s < 0) {
      setErro("Salário não pode ser negativo");
      return;
    }
    if (h <= 0 || h > 24) {
      setErro("Horas por dia deve estar entre 1 e 24");
      return;
    }
    if (dias.length === 0) {
      setErro("Selecione pelo menos 1 dia da semana");
      return;
    }
    setErro("");
    onSave({
      salario_mensal: s,
      horas_dia: h,
      dias_semana_array: dias,
    });
  }

  // Resumo dinâmico para o usuário entender o que está configurando
  const horasSemana = (typeof horas === "number" ? horas : 0) * dias.length;
  const horasMes = horasSemana * 4.345;

  return (
    <FinModal
      title="Configurar mão de obra"
      onClose={onClose}
      footer={
        <FinModalFooter onCancel={onClose} onConfirm={submit} confirmLabel="Salvar" />
      }
    >
      <FinField label="Quanto você quer ganhar por mês?">
        <FinMoneyInput value={salario} onChange={setSalario} placeholder="0,00" autoFocus />
      </FinField>

      <FinField label="Horas por dia" hint="Entre 1 e 24 horas">
        <FinNumberInput
          value={horas}
          onChange={setHoras}
          min={1}
          max={24}
          allowDecimal
          placeholder="8"
          suffix="h"
        />
      </FinField>

      <FinField
        label="Dias trabalhados na semana"
        hint="Toque nos dias em que você costuma produzir"
        error={erro && dias.length === 0 ? erro : undefined}
      >
        <FinDaysOfWeek value={dias} onChange={setDias} />
      </FinField>

      <div className="mo-resumo">
        <div>
          <span className="mo-resumo-label">Horas/semana</span>
          <strong>{horasSemana || 0}h</strong>
        </div>
        <div>
          <span className="mo-resumo-label">Horas/mês</span>
          <strong>{horasMes.toFixed(0)}h</strong>
        </div>
      </div>

      {erro && dias.length > 0 && (
        <span className="mo-erro" role="alert">{erro}</span>
      )}

      <style>{`
        .mo-resumo {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-2);
          padding: var(--space-3);
          background: var(--bg-subtle);
          border-radius: var(--radius-md);
        }
        .mo-resumo > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .mo-resumo-label {
          font-size: var(--font-caption);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: var(--ls-wide);
        }
        .mo-resumo strong {
          font-size: var(--font-card-title);
          font-weight: var(--fw-black);
          color: var(--text-title);
          letter-spacing: var(--ls-tight);
        }
        .mo-erro {
          font-size: var(--font-caption);
          color: var(--error);
          font-weight: var(--fw-semibold);
        }
      `}</style>
    </FinModal>
  );
}
