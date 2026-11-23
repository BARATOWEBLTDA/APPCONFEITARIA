// (22/11) Biblioteca de opções reaproveitáveis entre produtos.
// Massa, recheio, cobertura e sabor cadastrados uma vez e importados em outros produtos.
// Tabelas salvas em: public.biblioteca_opcoes (massa/recheio/cobertura/sabor)
//                   public.biblioteca_tabelas_tamanhos (presets de tabela de tamanho)
import { supabase } from "@/lib/supabase";

export type TipoBiblioteca = "massa" | "recheio" | "cobertura" | "sabor";

export type OpcaoBiblioteca = {
  id: string;
  tipo: TipoBiblioteca;
  nome: string;
  adicional: number;
  tipo_adicional?: "fixo" | "por_kg" | "por_unidade" | "por_quantidade" | null;
  preco?: number | null;
  created_at?: string;
};

export type TabelaTamanhosBiblioteca = {
  id: string;
  nome: string;
  modo_preco_tamanho: "preco_fixo" | "por_peso";
  opcoes_json: Array<{ id?: string; nome: string; preco?: number; peso_kg?: number | null; serve?: string }>;
  rendimento_unidade?: string | null;
  created_at?: string;
};

// ── Opções (massa/recheio/cobertura/sabor) ──────────────────────────

export async function listarBibliotecaOpcoes(tipo: TipoBiblioteca): Promise<OpcaoBiblioteca[]> {
  const { data, error } = await supabase
    .from("biblioteca_opcoes")
    .select("id, tipo, nome, adicional, tipo_adicional, preco, created_at")
    .eq("tipo", tipo)
    .order("nome", { ascending: true });
  if (error) { console.warn("listarBibliotecaOpcoes:", error.message); return []; }
  return (data || []) as OpcaoBiblioteca[];
}

export async function salvarNaBiblioteca(tipo: TipoBiblioteca, opcoes: Array<{ nome: string; adicional?: number; tipo_adicional?: string; preco?: number }>): Promise<{ ok: boolean; adicionados: number; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, adicionados: 0, error: "Sem sessão" };

  // Não salvar duplicatas: lê o que já tem e filtra
  const atuais = await listarBibliotecaOpcoes(tipo);
  const norm = (s: string) => String(s || "").trim().toLowerCase();
  const existentes = new Set(atuais.map(a => norm(a.nome)));
  const novos = opcoes
    .filter(o => o.nome && !existentes.has(norm(o.nome)))
    .map(o => ({
      user_id: user.id,
      tipo,
      nome: String(o.nome).trim(),
      adicional: Number(o.adicional) || 0,
      tipo_adicional: o.tipo_adicional || "fixo",
      preco: o.preco ?? null,
    }));
  if (novos.length === 0) return { ok: true, adicionados: 0 };

  const { error } = await supabase.from("biblioteca_opcoes").insert(novos);
  if (error) return { ok: false, adicionados: 0, error: error.message };
  return { ok: true, adicionados: novos.length };
}

export async function apagarDaBiblioteca(id: string): Promise<boolean> {
  const { error } = await supabase.from("biblioteca_opcoes").delete().eq("id", id);
  if (error) { console.warn("apagarDaBiblioteca:", error.message); return false; }
  return true;
}

// ── Tabelas de tamanho (presets inteiros) ────────────────────────────

export async function listarTabelasTamanhos(): Promise<TabelaTamanhosBiblioteca[]> {
  const { data, error } = await supabase
    .from("biblioteca_tabelas_tamanhos")
    .select("id, nome, modo_preco_tamanho, opcoes_json, rendimento_unidade, created_at")
    .order("nome", { ascending: true });
  if (error) { console.warn("listarTabelasTamanhos:", error.message); return []; }
  return (data || []) as TabelaTamanhosBiblioteca[];
}

export async function salvarTabelaTamanhos(nome: string, grupo: { modo_preco_tamanho?: string; opcoes: Array<{ id?: string; nome?: string; preco?: number; peso_kg?: number | null; serve?: string }>; rendimento_unidade?: string }): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sem sessão" };
  const row = {
    user_id: user.id,
    nome: String(nome || "").trim() || "Minha tabela",
    modo_preco_tamanho: (grupo.modo_preco_tamanho === "por_peso" ? "por_peso" : "preco_fixo") as "por_peso" | "preco_fixo",
    opcoes_json: grupo.opcoes.map(o => ({
      nome: String(o.nome || "").trim(),
      preco: Number(o.preco) || 0,
      ...(Number(o.peso_kg) > 0 ? { peso_kg: Number(o.peso_kg) } : {}),
      ...(o.serve ? { serve: o.serve } : {}),
    })),
    rendimento_unidade: grupo.rendimento_unidade || null,
  };
  const { error } = await supabase.from("biblioteca_tabelas_tamanhos").insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function apagarTabelaTamanhos(id: string): Promise<boolean> {
  const { error } = await supabase.from("biblioteca_tabelas_tamanhos").delete().eq("id", id);
  if (error) { console.warn("apagarTabelaTamanhos:", error.message); return false; }
  return true;
}
