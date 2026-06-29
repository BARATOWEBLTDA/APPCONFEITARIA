import { useState, useEffect, type ChangeEvent } from "react";

interface FinMoneyInputProps {
  /** Valor numérico (em reais) */
  value: number | "";
  /** Recebe número (em reais) ou string vazia quando limpo */
  onChange: (value: number | "") => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  /** Valor máximo permitido (em reais). Default sem limite. */
  max?: number;
  /** Valor mínimo permitido (em reais). Default 0. */
  min?: number;
  disabled?: boolean;
}

/**
 * Input monetário com prefixo "R$" embutido (estilo bancos).
 *
 * - Aceita apenas dígitos e separadores (vírgula/ponto).
 * - Mostra "R$" dentro do input, à esquerda.
 * - No onBlur, formata para 2 casas decimais (1500 → 1.500,00).
 * - Envia para o pai um number puro (ou "" quando vazio), sem formatação.
 *
 * @example
 * <FinMoneyInput value={valor} onChange={setValor} placeholder="0,00" />
 */
export default function FinMoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
  id,
  max,
  min = 0,
  disabled,
}: FinMoneyInputProps) {
  // Estado interno em string pra permitir digitação livre
  const [internal, setInternal] = useState<string>(
    value === "" || value === 0 ? "" : formatBR(value)
  );

  // Sincroniza quando o valor externo muda (ex.: abrir modal de edição)
  useEffect(() => {
    if (value === "" || value === 0) {
      setInternal("");
    } else if (parseBR(internal) !== value) {
      setInternal(formatBR(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    // permite só dígitos, vírgula e ponto
    const cleaned = raw.replace(/[^\d.,]/g, "");
    setInternal(cleaned);

    const num = parseBR(cleaned);
    if (cleaned === "") {
      onChange("");
      return;
    }
    if (isNaN(num)) return;
    let bounded = num;
    if (max !== undefined && bounded > max) bounded = max;
    if (min !== undefined && bounded < min) bounded = min;
    onChange(bounded);
  }

  function handleBlur() {
    const num = parseBR(internal);
    if (internal === "" || isNaN(num)) {
      setInternal("");
      return;
    }
    setInternal(formatBR(num));
  }

  return (
    <div className={`fin-money ${disabled ? "fin-money--disabled" : ""}`}>
      <span className="fin-money-prefix" aria-hidden="true">R$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="fin-input fin-money-input"
        value={internal}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />

      <style>{`
        .fin-money {
          position: relative;
          width: 100%;
        }
        .fin-money-prefix {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: var(--font-input);
          font-weight: var(--fw-bold);
          color: var(--text-secondary);
          pointer-events: none;
          letter-spacing: 0.01em;
        }
        .fin-money-input {
          padding-left: 42px !important;
          font-variant-numeric: tabular-nums;
          font-weight: var(--fw-semibold);
        }
        .fin-money--disabled .fin-money-prefix {
          opacity: 0.55;
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────
   Helpers de formatação BR
   ────────────────────────────────────────── */

function parseBR(raw: string): number {
  if (!raw) return NaN;
  // remove pontos (milhar) e troca vírgula por ponto decimal
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  return parseFloat(normalized);
}

function formatBR(value: number): string {
  if (isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
