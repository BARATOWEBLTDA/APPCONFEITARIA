import { useState } from "react";
import {
  FinModal,
  FinModalFooter,
  FinField,
  FinMoneyInput,
  FinNumberInput,
  FinSegmented,
} from "@/components/financeiro";

export interface CustoVariavelInput {
  id?: string;
  nome: string;
  tipo: "percentual" | "fixo";
  valor: number;
  ativo: boolean;
}

interface ModalCustoVariavelProps {
  item: CustoVariavelInput | null;
  onClose: () => void;
  onSave: (data: CustoVariavelInput) => void;
}

/**
 * Modal de novo/editar custo variável.
 * Campos: nome, tipo (% ou R$), valor, ativo.
 */
export default function ModalCustoVariavel({
  item,
  onClose,
  onSave,
}: ModalCustoVariavelProps) {
  const [nome, setNome] = useState(item?.nome || "");
  const [tipo, setTipo] = useState<"percentual" | "fixo">(item?.tipo || "percentual");
  const [valor, setValor] = useState<number | "">(item?.valor ?? "");
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
    if (tipo === "percentual" && v > 100) {
      setErro("Percentual não pode ser maior que 100%");
      return;
    }
    setErro("");
    onSave({
      id: item?.id,
      nome: nome.trim(),
      tipo,
      valor: v,
      ativo,
    });
  }

  return (
    <FinModal
      title={editando ? "Editar custo variável" : "Novo custo variável"}
      onClose={onClose}
      footer={
        <FinModalFooter onCancel={onClose} onConfirm={submit} confirmLabel="Salvar" />
      }
    >
      <FinField label="Nome" error={erro && !nome.trim() ? erro : undefined}>
        <input
          className="fin-input"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Taxa iFood, Maquininha, Embalagem"
          maxLength={60}
          autoFocus
        />
      </FinField>

      <FinField label="Tipo">
        <FinSegmented
          value={tipo}
          onChange={(k) => {
            setTipo(k);
            setValor("");
          }}
          options={[
            { key: "percentual", label: "% Percentual" },
            { key: "fixo", label: "R$ Fixo" },
          ]}
          ariaLabel="Tipo do custo variável"
        />
      </FinField>

      <FinField
        label={tipo === "percentual" ? "Valor (%)" : "Valor (R$)"}
        error={
          erro && (typeof valor !== "number" || valor <= 0 || (tipo === "percentual" && valor > 100))
            ? erro
            : undefined
        }
      >
        {tipo === "percentual" ? (
          <FinNumberInput
            value={valor}
            onChange={setValor}
            min={0}
            max={100}
            allowDecimal
            placeholder="0"
            suffix="%"
          />
        ) : (
          <FinMoneyInput value={valor} onChange={setValor} placeholder="0,00" />
        )}
      </FinField>

      <label className="modal-check">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
        />
        Ativo (usar no cálculo de preço de venda)
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
