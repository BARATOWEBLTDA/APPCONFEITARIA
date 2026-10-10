/**
 * Busca TODAS as linhas de uma consulta do Supabase, de 1.000 em 1.000 (10/10).
 * O Supabase devolve no máximo 1.000 linhas por consulta, sem avisar: somas e listas
 * feitas no aparelho ficavam cortadas quando a conta passava disso.
 *
 *   const { data, error } = await buscarTudo<Pedido>((de, ate) =>
 *     supabase.from("pedidos").select("id, valor_total").eq("user_id", uid).order("id").range(de, ate));
 *
 * A consulta PRECISA ter uma ordem fixa (termine com .order("id")), senão as páginas podem repetir ou pular linhas.
 * Se uma página falhar, devolve o erro e nenhuma linha (melhor avisar do que somar pela metade).
 */
type Resposta<T> = { data: T[] | null; error: unknown };

export async function buscarTudo<T = any>(
  consulta: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  porPagina = 1000,
  maximoDePaginas = 50,
): Promise<{ data: T[]; error: unknown }> {
  const tudo: T[] = [];
  for (let pagina = 0; pagina < maximoDePaginas; pagina++) {
    const de = pagina * porPagina;
    const { data, error } = await consulta(de, de + porPagina - 1);
    if (error) return { data: [], error };
    const linhas = data || [];
    tudo.push(...linhas);
    if (linhas.length < porPagina) break;
  }
  return { data: tudo, error: null };
}
