/**
 * ReqTag — Tag "obrigatório" padrão do Doonly (modelo 8).
 * Uso: <label>Nome <ReqTag /></label>
 */
export default function ReqTag() {
  return (
    <span className="req-tag">
      <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2l2.5 6.5L21 9l-5 4.5 1.5 6.5L12 16.5 6.5 20 8 13.5 3 9l6.5-.5L12 2z"/>
      </svg>
      obrigatório
    </span>
  );
}
