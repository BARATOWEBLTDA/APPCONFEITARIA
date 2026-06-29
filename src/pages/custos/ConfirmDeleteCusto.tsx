import { FinModal, FinModalFooter } from "@/components/financeiro";

interface ConfirmDeleteCustoProps {
  nome: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Confirmação padronizada para exclusão de custos.
 */
export default function ConfirmDeleteCusto({
  nome,
  onClose,
  onConfirm,
}: ConfirmDeleteCustoProps) {
  return (
    <FinModal
      title="Excluir custo"
      onClose={onClose}
      maxWidth={420}
      footer={
        <FinModalFooter
          onCancel={onClose}
          onConfirm={onConfirm}
          confirmLabel="Excluir"
          confirmVariant="danger"
        />
      }
    >
      <p style={{
        margin: 0,
        color: "var(--text-secondary)",
        fontSize: "var(--font-button)",
        lineHeight: "var(--lh-normal)",
      }}>
        <strong style={{ color: "var(--text-title)" }}>"{nome}"</strong> será removido permanentemente.
        Esta ação não pode ser desfeita.
      </p>
    </FinModal>
  );
}
