/**
 * (01/11 · 5.99) Cardápio do cliente mais rápido: os dados da loja começam a chegar junto com o app,
 * sem esperar o código da tela do cardápio baixar (antes era uma fila: app → tela → loja → produtos → fotos).
 * Cada resposta antecipada é usada uma vez só; se não servir, o cardápio busca do jeito normal.
 */
import { supabase } from '@/lib/supabase'
import type { PostgrestError } from '@supabase/supabase-js'

type Resposta<T = unknown> = { data: T; error: PostgrestError | null }
let loja: { chave: string; p: Promise<Resposta<{ id?: string } | null>> } | null = null
let resto: { id: string; p: Promise<Resposta[]> } | null = null

export function anteciparCardapio(chave: string) {
  if (!chave) return
  const p = Promise.resolve(supabase.rpc('cardapio_loja', { p_chave: chave })) as Promise<Resposta<{ id?: string } | null>>
  loja = { chave, p }
  p.then(r => {
    const id = r?.data?.id
    if (!id || r.error) return
    resto = {
      id,
      p: Promise.all([
        supabase.rpc('cardapio_produtos', { p_loja: id }),
        supabase.rpc('cardapio_categorias', { p_loja: id }),
        supabase.rpc('cardapio_tem_cupom', { p_loja: id }),
        supabase.rpc('cardapio_cupons_vitrine', { p_loja: id }),
      ].map(q => Promise.resolve(q) as Promise<Resposta>)),
    }
  }, () => { /* sem internet: o cardápio tenta de novo do jeito normal */ })
}

export function lojaAntecipada(chave: string): Promise<Resposta<{ id?: string } | null>> | null {
  if (!loja || loja.chave !== chave) return null
  const p = loja.p; loja = null; return p
}

export function restoAntecipado(id: string): Promise<Resposta[]> | null {
  if (!resto || resto.id !== id) return null
  const p = resto.p; resto = null; return p
}
