import { useState } from "react";
import {
  FinModal,
  FinModalFooter,
  FinField,
  FinMoneyInput,
  FinNumberInput,
} from "@/components/financeiro";

export interface CustoFixoInput {
  id?: string;
  nome: string;
  valor: number;
  ativo: boolean;
  dia_vencimento: number | null;
}

interface ModalCustoFixoProps {
  /** null = novo; objeto = edição */
  item: CustoFixoInput | null;
  onClose: () => void;
  onSave: (data: CustoFixoInput) => void;
}

/**
 * Modal de novo/editar custo fixo.
 * Campos: nome, valor mensal (R$), dia do vencimento (opcional 1-31), ativo.
 */
export default function ModalCustoFixo({ item, onClose, onSave }: ModalCustoFixoProps) {
  const [nome, setNome] = useState(item?.nome || "");
  const [valor, setValor] = useState<number | "">(item?.valor ?? "");
  const [diaVenc, setDiaVenc] = useState<number | "">(item?.dia_vencimento ?? "");
  const [ativo, setAtivo] = useState(item?.ativo ?? true);
  const [erro, setErro] = useState("");

  const editando = !!item?.id;

  function submit() {
    if (!nome.trim()) {
      setErro("Informe o nome do custo");
      return;
    }
    const v = typeof valor === "number" ? valor : 0;
    if (v <= 0) {
      setErro("Informe um valor maior que zero");
      return;
    }
    setErro("");
    onSave({
      id: item?.id,
      nome: nome.trim(),
      valor: v,
      ativo,
      dia_vencimento: diaVenc === "" ? null : diaVenc,
    });
  }

  return (
    <FinModal
      title={editando ? "Editar custo fixo" : "Novo custo fixo"}
      onClose={onClose}
      footer={
        <FinModalFooter
          onCancel={onClose}
          onConfirm={submit}
          confirmLabel="Salvar"
        />
      }
    >
      <FinField label="Nome" error={erro && !nome.trim() ? erro : undefined}>
        <input
          className="fin-input"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Aluguel, Internet, Energia"
          maxLength={60}
          autoFocus
        />
      </FinField>

      <FinField
        label="Valor mensal"
        error={erro && (typeof valor !== "number" || valor <= 0) ? erro : undefined}
      >
        <FinMoneyInput value={valor} onChange={setValor} placeholder="0,00" />
      </FinField>

      <FinField
        label="Dia do vencimento (opcional)"
        hint="Dia do mês em que esse custo costuma vencer. Usado em avisos futuros."
      >
        <FinNumberInput
          value={diaVenc}
          onChange={setDiaVenc}
          min={1}
          max={31}
          placeholder="Ex: 10"
          suffix="do mês"
        />
      </FinField>

      <label className="modal-check">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Ativo (somar no custo do mês)
      </label>

      <style>{`
        .modal-check {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--font-button);
          color: var(--text-secondary);
          cursor: pointer;
          padding: var(--space-2) 0;
        }
        .modal-check input { accent-color: var(--primary); width: 18px; height: 18px; }
      `}</style>
    </FinModal>
  );
}
