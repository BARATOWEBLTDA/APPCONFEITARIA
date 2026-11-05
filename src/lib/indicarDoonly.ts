/**
 * (6.119) "Indique o Doonly" (sem recompensa): a confeiteira manda o app para outra confeiteira.
 * O link leva o código dela (?ref=), assim o cadastro mostra "Fulana te indicou" e já abre na aba de criar conta.
 * Celular: abre o compartilhar do aparelho. Computador (ou sem compartilhar): abre o WhatsApp com o texto pronto.
 */
import { supabase } from '@/lib/supabase'

const TEXTO = 'Oi! Uso o Doonly para organizar meus pedidos, cardápio online e preços da confeitaria. Acho que vai te ajudar também, dá para testar grátis:'

export async function linkIndicacao(): Promise<string> {
  let ref = ''
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase.from('profiles').select('codigo_indicacao').eq('id', user.id).maybeSingle()
      ref = String(data?.codigo_indicacao || '').trim()
    }
  } catch { /* sem código: manda o link simples */ }
  return `https://doonly.com.br/cadastro${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`
}

/** Abre o compartilhar. Nunca lança. */
export async function indicarDoonly(): Promise<void> {
  const url = await linkIndicacao()
  const toque = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (toque && navigator.share) {
    try { await navigator.share({ title: 'Doonly', text: TEXTO, url }); return } catch (e) { if ((e as Error)?.name === 'AbortError') return }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(`${TEXTO} ${url}`)}`, '_blank', 'noopener')
}
