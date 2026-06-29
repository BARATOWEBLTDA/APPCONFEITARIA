import { useState, useEffect, type ChangeEvent } from "react";

interface FinNumberInputProps {
  value: number | "";
  onChange: (value: number | "") => void;
  /** Valor mínimo (default 0) */
  min?: number;
  /** Valor máximo */
  max?: number;
  /** Permite decimais (default false → só inteiros) */
  allowDecimal?: boolean;
  /** Sufixo opcional, mostrado à direita (ex.: "h", "dias") */
  suffix?: string;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Input numérico do Financeiro, com validação automática de min/max.
 *
 * - Bloqueia caracteres não-numéricos durante a digitação.
 * - Limita ao max no blur (digitar 50 com max=24 vira 24).
 * - Aceita sufixo visual à direita ("h", "dias", etc.).
 *
 * @example
 * <FinNumberInput value={horas} onChange={setHoras} min={1} max={24} suffix="h" />
 */
export default function FinNumberInput({
  value,
  onChange,
  min = 0,
  max,
  allowDecimal = false,
  suffix,
  placeholder,
  autoFocus,
  id,
  disabled,
}: FinNumberInputProps) {
  const [internal, setInternal] = useState<string>(value === "" ? "" : String(value));

  useEffect(() => {
    if (value === "") {
      setInternal("");
    } else if (parseFloat(internal.replace(",", ".")) !== value) {
      setInternal(String(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    let raw = e.target.value;
    const pattern = allowDecimal ? /[^\d.,]/g : /[^\d]/g;
    raw = raw.replace(pattern, "");
    setInternal(raw);

    if (raw === "") {
      onChange("");
      return;
    }
    const num = allowDecimal ? parseFloat(raw.replace(",", ".")) : parseInt(raw, 10);
    if (isNaN(num)) return;
    onChange(num);
  }

  function handleBlur() {
    if (internal === "") return;
    const num = allowDecimal ? parseFloat(internal.replace(",", ".")) : parseInt(internal, 10);
    if (isNaN(num)) {
      setInternal("");
      onChange("");
      return;
    }
    let bounded = num;
    if (max !== undefined && bounded > max) bounded = max;
    if (bounded < min) bounded = min;
    setInternal(String(bounded));
    onChange(bounded);
  }

  return (
    <div className="fin-num">
      <input
        id={id}
        type="text"
        inputMode={allowDecimal ? "decimal" : "numeric"}
        className="fin-input fin-num-input"
        value={internal}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
      />
      {suffix && <span className="fin-num-suffix" aria-hidden="true">{suffix}</span>}

      <style>{`
        .fin-num {
          position: relative;
          width: 100%;
        }
        .fin-num-input {
          font-variant-numeric: tabular-nums;
          font-weight: var(--fw-semibold);
        }
        .fin-num-suffix {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: var(--font-input);
          font-weight: var(--fw-semibold);
          color: var(--text-muted);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
