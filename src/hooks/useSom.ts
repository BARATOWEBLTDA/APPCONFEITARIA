/**
 * Hook para tocar sons no app.
 * Usa Web Audio API (sem arquivos externos).
 * Respeita a preferência do usuário salva em localStorage.
 *
 * Uso:
 * ```tsx
 * const { tocar, sonsHabilitados, toggleSons } = useSom()
 * tocar('sucesso')
 * ```
 */

type SomTipo = 'sucesso' | 'erro' | 'click' | 'notificacao' | 'pedido'

const STORAGE_KEY = 'doonly_sons_habilitados'
const STORAGE_NOTIF_KEY = 'doonly_som_notificacao'
const STORAGE_PEDIDO_KEY = 'doonly_som_pedido'

// Cache do AudioContext (só cria uma vez)
let ctx: AudioContext | null = null
const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      ctx = new AC()
    } catch {
      return null
    }
  }
  return ctx
}

// Toca uma nota simples
const tocarNota = (freq: number, inicio: number, duracao: number, volume = 0.15) => {
  const audio = getCtx()
  if (!audio) return

  const osc = audio.createOscillator()
  const gain = audio.createGain()

  osc.type = 'sine'
  osc.frequency.value = freq

  const t = audio.currentTime + inicio
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, t + duracao)

  osc.connect(gain)
  gain.connect(audio.destination)

  osc.start(t)
  osc.stop(t + duracao)
}

// Verifica se sons estão habilitados
export const sonsHabilitados = (): boolean => {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(STORAGE_KEY)
  return v === null ? true : v === 'true' // default true
}

// Ativa/desativa sons
export const setSonsHabilitados = (v: boolean): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, String(v))
}

// Sub-preferência: som de notificação
export const somNotificacaoHabilitado = (): boolean => {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(STORAGE_NOTIF_KEY)
  return v === null ? true : v === 'true'
}
export const setSomNotificacaoHabilitado = (v: boolean): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_NOTIF_KEY, String(v))
}

// Sub-preferência: som de pedido novo
export const somPedidoHabilitado = (): boolean => {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(STORAGE_PEDIDO_KEY)
  return v === null ? true : v === 'true'
}
export const setSomPedidoHabilitado = (v: boolean): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_PEDIDO_KEY, String(v))
}

/**
 * Toca um som pré-definido.
 * Silenciosamente ignora se o usuário desativou sons.
 */
export const tocarSom = (tipo: SomTipo): void => {
  if (!sonsHabilitados()) return
  // Sub-toggles específicos: se OFF, não toca mesmo com o mestre ON
  if (tipo === 'notificacao' && !somNotificacaoHabilitado()) return
  if (tipo === 'pedido' && !somPedidoHabilitado()) return

  const audio = getCtx()
  if (!audio) return

  // Alguns browsers exigem retomar o contexto após interação
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {})
  }

  if (tipo === 'sucesso') {
    // Acorde ascendente Dó → Mi → Sol (C major)
    tocarNota(523.25, 0, 0.15)     // C5 (Dó)
    tocarNota(659.25, 0.08, 0.15)  // E5 (Mi)
    tocarNota(783.99, 0.16, 0.3)   // G5 (Sol)
  } else if (tipo === 'erro') {
    // Nota descendente triste (curta)
    tocarNota(392, 0, 0.15, 0.12)      // G4
    tocarNota(329.63, 0.1, 0.2, 0.12)  // E4
  } else if (tipo === 'click') {
    // Click curto
    tocarNota(880, 0, 0.05, 0.08)
  } else if (tipo === 'notificacao') {
    // "Ding-ding" delicado — duas notas rápidas em intervalo de terça maior
    tocarNota(1046.5, 0, 0.1, 0.14)    // C6
    tocarNota(1318.5, 0.12, 0.18, 0.14) // E6
  } else if (tipo === 'pedido') {
    // Sino de caixa registradora — celebrativo, mais alegre
    tocarNota(1568, 0, 0.08, 0.16)      // G6
    tocarNota(1975, 0.05, 0.08, 0.14)   // B6
    tocarNota(2093, 0.1, 0.35, 0.18)    // C7 (final, mais longo)
  }
}

/**
 * Hook opcional pra usar em componentes React.
 * Fornece tocar() + estado atual + toggle.
 */
export default function useSom() {
  return {
    tocar: tocarSom,
    sonsHabilitados: sonsHabilitados(),
    setHabilitado: setSonsHabilitados,
  }
}
