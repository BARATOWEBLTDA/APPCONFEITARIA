/**
 * ReqTag — marca "obrigatório" ao lado do rótulo, igual à do campo padrão do app (08/10 · 3.22: sem a estrela).
 * Uso: <label>Nome <ReqTag /></label>
 */
export default function ReqTag() {
  return <span className="req-tag">obrigatório</span>;
}
