/**
 * Visual das telas do financeiro (03/10): fundo cinza-rosado (antes: cartão branco em fundo branco,
 * tudo "chapado") e cartões com borda e sombra suaves, pra destacar do fundo.
 * Vale só enquanto uma tela do financeiro está aberta.
 */
const CARTOES = [
  ".fd-k", ".fd-k2", ".fd-card", ".fd-mes", ".fd-mais-g button", ".cxc-movs", ".pvc",
  ".far-k", ".far-it", ".far-vazio", ".fap-k", ".fap-it", ".fap-pagas", ".fap-vazio",
  ".tx-k", ".tx-lista", ".tx-vazio", ".pf-mes",
  ".cu-k:not(.destaque)", ".cu-card", ".lu-card", ".lu-vazio", ".lu-mes",
].join(", ");

export default function EstiloFinanceiro() {
  return (
    <style>{`
      body, .layout-root, .layout-main { background-color: #F4EEF1 !important; }
      ${CARTOES} {
        border-color: #EADFE4 !important;
        box-shadow: 0 1px 2px rgba(44, 18, 25, .05), 0 8px 22px -6px rgba(44, 18, 25, .10) !important;
      }
      /* as bordas coloridas continuam (a regra acima não pode apagar) */
      .fd-k2.rec { border-left-color: #F59E0B !important; } .fd-k2.pag { border-left-color: #EF4444 !important; }
      .far-k--atr, .fap-k--atr { border-color: #FECACA !important; }
      .cxc, .cu-k.destaque { box-shadow: 0 10px 26px -8px rgba(107, 35, 64, .55) !important; }
      .fd-bt, .tx-bt.e, .tx-bt.s, .far-rec, .fap-pag { box-shadow: 0 6px 14px -6px rgba(44, 18, 25, .45); }
      /* valores no Bold (700): o Black (800/900) ficou pesado. Só o saldo do caixa e o custo da hora continuam no Black */
      .fd-k b, .fd-k2 b, .pvc-g b, .far-k b, .far-it-v b, .fap-k b, .fap-it-v b, .fap-pg b, .tx-k b, .tx-it-v,
      .cu-k:not(.destaque) b, .cu-it-v, .cu-mo-l b, .lu-l b, .lu-eq-v, .lu-p-h span, .cxc-mv-v, .fd-fl-res b, .tx-dl b {
        font-weight: 700 !important;
      }
      .pf-seg, .tx-seg, .fo-seg { background: #E9DFE4 !important; }
    `}</style>
  );
}
