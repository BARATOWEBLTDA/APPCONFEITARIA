/**
 * (6.119) Avisos do pedido no celular do CLIENTE (cardápio, "Acompanhar o pedido").
 * O cliente toca em Ativar: o navegador pede a permissão, o aparelho é inscrito (Web Push) e o banco guarda
 * a inscrição só para aquele pedido (cardapio_avisos_pedido). Quando a loja muda a situação, o servidor avisa.
 * Android: direto no navegador. iPhone: só com o cardápio adicionado à tela de início (regra da Apple).
 */
import { supabase } from '@/lib/supabase'
import { ehIphone, estaInstalado } from '@/lib/notifications'

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''
const CHAVE = (id: string) => `doonly_avisos_pedido_${id}`

function chaveBinaria(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, c => c.charCodeAt(0))
}

export type EstadoAvisos = 'indisponivel' | 'iphone' | 'bloqueado' | 'desligado' | 'ligado'

/** O que mostrar no cartão: dá para ligar? já está ligado neste aparelho? */
export function estadoAvisos(pedidoId: string): EstadoAvisos {
  if (typeof window === 'undefined' || !VAPID) return 'indisponivel'
  if (ehIphone() && !estaInstalado()) return 'iphone'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponivel'
  if (Notification.permission === 'denied') return 'bloqueado'
  try { if (localStorage.getItem(CHAVE(pedidoId)) === '1' && Notification.permission === 'granted') return 'ligado' } catch { /* sem armazenamento */ }
  return 'desligado'
}

/** Liga os avisos deste pedido neste aparelho. Devolve o estado novo. Nunca lança. */
export async function ligarAvisos(pedidoId: string): Promise<EstadoAvisos> {
  try {
    if (!VAPID || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'indisponivel'
    const permissao = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permissao !== 'granted') return permissao === 'denied' ? 'bloqueado' : 'desligado'
    const reg = (await navigator.serviceWorker.getRegistration('/')) || (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBinaria(VAPID) as BufferSource }))
    const j = sub.toJSON()
    if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) return 'desligado'
    const { data, error } = await supabase.rpc('cardapio_avisos_pedido', { p_pedido: pedidoId, p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
    if (error || data !== true) return 'desligado'
    try { localStorage.setItem(CHAVE(pedidoId), '1') } catch { /* sem armazenamento: liga do mesmo jeito */ }
    return 'ligado'
  } catch (e) {
    console.warn('[Doonly] não deu para ligar os avisos do pedido:', e)
    return 'desligado'
  }
}
