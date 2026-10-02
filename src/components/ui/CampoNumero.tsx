import { useEffect, useRef, useState } from "react";
import { parseNumBR } from "@/lib/numeroBR";

/**
 * Campo de número que aceita vírgula (02/10).
 * O <input type="number"> não aceita "0,5" no teclado do iPhone em português
 * (o valor vinha vazio e a quantidade virava 0). Este campo é texto com teclado
 * numérico, guarda o que ela digita ("0," no meio da digitação) e entrega o número.
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValor: (n: number) => void;
  inteiro?: boolean;
};

const mostrar = (n: number | null | undefined, inteiro?: boolean) =>
  !n ? "" : inteiro ? String(Math.round(n)) : String(n).replace(".", ",");

export default function CampoNumero({ value, onValor, inteiro, ...rest }: Props) {
  const [txt, setTxt] = useState(mostrar(value, inteiro));
  const ultimo = useRef<number>(Number(value) || 0);

  // Valor mudou por fora (ex.: carregou o pedido): atualiza o que aparece
  useEffect(() => {
    const n = Number(value) || 0;
    if (n !== ultimo.current) { ultimo.current = n; setTxt(mostrar(n, inteiro)); }
  }, [value, inteiro]);

  return (
    <input
      {...rest}
      type="text"
      inputMode={inteiro ? "numeric" : "decimal"}
      autoComplete="off"
      value={txt}
      onChange={e => {
        const limpo = e.target.value.replace(inteiro ? /[^\d]/g : /[^\d.,]/g, "");
        setTxt(limpo);
        const n = inteiro ? parseInt(limpo || "0", 10) || 0 : parseNumBR(limpo);
        ultimo.current = n;
        onValor(n);
      }}
    />
  );
}
