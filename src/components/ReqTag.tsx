/**
 * ReqTag — marca "obrigatório" ao lado do rótulo, igual à do campo padrão do app (08/10 · 3.22: sem a estrela).
 * Uso: <label>Nome <ReqTag /></label>
 */
export default function ReqTag() {
  return <span className="req-tag">obrigatório</span>;
}

/** (14/10) a mesma marca, pro campo opcional: mesmo lugar e tamanho, em cinza (igual ao "opcional" dos campos do guia) */
export function OptTag() {
  return <span className="req-tag req-tag--opt">opcional</span>;
}
