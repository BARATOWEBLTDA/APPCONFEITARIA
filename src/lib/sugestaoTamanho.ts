/**
 * (13/10) "Sugerir os outros": com o preço de UM tamanho, preenche os outros em proporção.
 *  · com número no nome: "Aro 20" cresce pela área do bolo (aro²); "Serve 20", "2 kg", "50 un" crescem em linha reta
 *  · sem número (P, M, G): cada tamanho acima soma 40% do preço do primeiro
 * Arredonda pra reais inteiros. Só mexe nos tamanhos sem preço.
 */
type Op = { id: string; nome: string; preco: number };

const numeroDe = (nome: string): number | null => {
  const m = String(nome).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

export function sugerirPrecosTamanho<T extends Op>(opcoes: T[]): T[] | null {
  const iBase = opcoes.findIndex(o => o.preco > 0);
  if (iBase < 0 || !opcoes.some(o => !(o.preco > 0))) return null;
  const base = opcoes[iBase];
  const nBase = numeroDe(base.nome);
  const todosComNumero = nBase !== null && opcoes.every(o => numeroDe(o.nome) !== null);
  const porArea = /\baro\b/i.test(base.nome);
  return opcoes.map((o, i) => {
    if (o.preco > 0) return o;
    let fator: number;
    if (todosComNumero) {
      const n = numeroDe(o.nome)!;
      fator = porArea ? (n * n) / (nBase! * nBase!) : n / nBase!;
    } else {
      fator = Math.max(0.4, 1 + 0.4 * (i - iBase));
    }
    return { ...o, preco: Math.max(1, Math.round(base.preco * fator)) };
  });
}
