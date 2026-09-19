import { supabase } from "./supabase";

export type BibliotecaCategoria = "massa" | "recheio" | "cobertura" | "tamanho";

export interface BibliotecaOpcao {
  id: string;
  categoria: BibliotecaCategoria;
  nome: string;
  preco_padrao: number;
  vezes_usado: number;
}

// Singularizar categorias que vêm no plural
const singularizar = (plural: string): BibliotecaCategoria => {
  const map: Record<string, BibliotecaCategoria> = {
    massas: "massa",
    recheios: "recheio",
    coberturas: "cobertura",
    tamanhos: "tamanho",
  };
  return (map[plural] || plural) as BibliotecaCategoria;
};

// Buscar opções da biblioteca por categoria (ordenadas por mais usadas)
export async function listarBiblioteca(
  categoriaPlural: string
): Promise<BibliotecaOpcao[]> {
  const categoria = singularizar(categoriaPlural);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from("biblioteca_opcoes")
    .select("*")
    .eq("user_id", userData.user.id)
    .eq("categoria", categoria)
    .order("vezes_usado", { ascending: false })
    .order("nome", { ascending: true });

  if (error) {
    console.warn("[biblioteca] erro ao listar:", error.message);
    return [];
  }
  return data || [];
}

// Salvar opção na biblioteca (ou incrementar vezes_usado se já existe)
export async function salvarNaBiblioteca(
  categoriaPlural: string,
  nome: string,
  precoPadrao: number = 0
): Promise<void> {
  const categoria = singularizar(categoriaPlural);
  const nomeTrim = nome.trim();
  if (!nomeTrim) return;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  // Tenta inserir. Se já existe (constraint UNIQUE), incrementa vezes_usado
  const { error: errInsert } = await supabase
    .from("biblioteca_opcoes")
    .insert({
      user_id: userData.user.id,
      categoria,
      nome: nomeTrim,
      preco_padrao: precoPadrao,
      vezes_usado: 1,
    });

  if (errInsert) {
    // Se erro é conflito de UNIQUE, incrementa vezes_usado
    if (errInsert.code === "23505") {
      const { data: existe } = await supabase
        .from("biblioteca_opcoes")
        .select("id, vezes_usado")
        .eq("user_id", userData.user.id)
        .eq("categoria", categoria)
        .eq("nome", nomeTrim)
        .single();
      if (existe) {
        await supabase
          .from("biblioteca_opcoes")
          .update({ vezes_usado: (existe.vezes_usado || 0) + 1 })
          .eq("id", existe.id);
      }
    } else {
      console.warn("[biblioteca] erro ao salvar:", errInsert.message);
    }
  }
}

// Deletar da biblioteca
export async function deletarDaBiblioteca(id: string): Promise<void> {
  const { error } = await supabase
    .from("biblioteca_opcoes")
    .delete()
    .eq("id", id);
  if (error) console.warn("[biblioteca] erro ao deletar:", error.message);
}
