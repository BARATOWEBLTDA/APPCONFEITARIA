import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// usePushSubscription — gerencia Web Push no browser
//
// Responsabilidades:
// 1. Registra o service worker (/sw.js)
// 2. Verifica se já tem subscription ativa
// 3. Pede permissão ao usuário e subscribe via pushManager
// 4. Salva subscription (endpoint, p256dh, auth) no Supabase
// 5. Expõe estado (suportado, permitido, inscrito) pro UI
//
// Compatibilidade:
// - Chrome Android: ✅ funciona nativo
// - Safari iOS 16.4+: ✅ funciona se PWA instalada (Add to Home Screen)
// - Safari iOS < 16.4: ❌ não suporta Web Push
// - Desktop Chrome/Firefox/Edge: ✅ funciona
//
// Uso:
//   const { isSupported, isSubscribed, subscribe, loading } = usePushSubscription()
//   <button onClick={subscribe} disabled={!isSupported || isSubscribed}>
//     Ativar notificações
//   </button>
// ─────────────────────────────────────────────────────────────

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Checa suporte e estado atual
  useEffect(() => {
    const check = async () => {
      // Verifica suporte do browser
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setIsSupported(false)
        return
      }
      setIsSupported(true)
      setPermission(Notification.permission)

      // Se já tem permissão, verifica se já tem subscription
      if (Notification.permission === 'granted') {
        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js')
          if (reg) {
            const sub = await reg.pushManager.getSubscription()
            if (sub) {
              setIsSubscribed(true)
            }
          }
        } catch (e) {
          console.warn('Push check failed:', e)
        }
      }
    }
    check()
  }, [])

  const subscribe = useCallback(async () => {
    if (!isSupported || !VAPID_PUBLIC_KEY) {
      setError('Notificações push não são suportadas neste navegador.')
      return false
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Registra service worker (se ainda não está)
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 2. Pede permissão
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Permissão de notificação negada.')
        setLoading(false)
        return false
      }

      // 3. Subscribe no Push Manager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })

      // 4. Extrai dados da subscription
      const subJson = subscription.toJSON()
      const endpoint = subJson.endpoint || ''
      const p256dh = subJson.keys?.p256dh || ''
      const auth = subJson.keys?.auth || ''

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Subscription incompleta')
      }

      // 5. Salva no Supabase (upsert por endpoint — evita duplicatas)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Você precisa estar logado para ativar notificações.')
        setLoading(false)
        return false
      }

      const { error: dbError } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
        }, { onConflict: 'endpoint' })

      if (dbError) {
        console.error('Erro ao salvar subscription:', dbError)
        throw new Error('Falha ao salvar subscription')
      }

      setIsSubscribed(true)
      setLoading(false)
      return true
    } catch (err: any) {
      console.error('Push subscribe error:', err)
      setError(err?.message || 'Erro ao ativar notificações.')
      setLoading(false)
      return false
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          // Remove do banco
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          // Cancela subscription no browser
          await sub.unsubscribe()
        }
      }
      setIsSubscribed(false)
    } catch (err) {
      console.error('Push unsubscribe error:', err)
    }
  }, [])

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    error,
    subscribe,
    unsubscribe,
  }
}
