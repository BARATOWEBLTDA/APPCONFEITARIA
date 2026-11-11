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

type SomTipo = 'sucesso' | 'erro' | 'click' | 'notificacao' | 'pedido' | 'acao'

const STORAGE_KEY = 'doonly_sons_habilitados'
const STORAGE_NOTIF_KEY = 'doonly_som_notificacao'
const STORAGE_PEDIDO_KEY = 'doonly_som_pedido'
const STORAGE_AVISOS_KEY = 'doonly_som_avisos'

// Cache do AudioContext (só cria uma vez)
let ctx: AudioContext | null = null
const getCtx = (): AudioContext | null => {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    } catch {
      return null
    }
  }
  return ctx
}

// (30/10 · 5.45) volume do app (0 a 100), vale para todos os sons
const STORAGE_VOLUME_KEY = 'doonly_volume'
export const volumeApp = (): number => {
  if (typeof window === 'undefined') return 100
  const v = Number(localStorage.getItem(STORAGE_VOLUME_KEY))
  return localStorage.getItem(STORAGE_VOLUME_KEY) === null || !Number.isFinite(v) ? 100 : Math.max(0, Math.min(100, v))
}
export const setVolumeApp = (v: number): void => { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_VOLUME_KEY, String(Math.round(v))) }

// (11/11) sons gravados (public/sons, do Material Design do Google, CC BY 4.0): carregam uma vez e ficam guardados
const buffers: Record<string, AudioBuffer | null | undefined> = {}
const carregarArquivo = (nome: string): void => {
  if (buffers[nome] !== undefined) return
  const audio = getCtx()
  if (!audio) return
  buffers[nome] = null
  fetch(`/sons/${nome}.mp3`).then(r => r.arrayBuffer()).then(b => audio.decodeAudioData(b)).then(buf => { buffers[nome] = buf }).catch(() => { delete buffers[nome] })
}
/** toca o arquivo; devolve false se ainda não carregou (aí quem chamou usa o som sintetizado) */
// (11/11) toques e prévias tocam num "canal" só: um novo para o anterior (antes, ao trocar de opção, os dois tocavam juntos)
let noCanal: AudioBufferSourceNode | null = null
let esperaCanal = 0
const pararCanal = () => {
  window.clearTimeout(esperaCanal)
  try { noCanal?.stop() } catch { /* já tinha parado */ }
  noCanal = null
}
const tocarArquivo = (nome: string, ganho = 1, canal = false): boolean => {
  const audio = getCtx()
  const buf = buffers[nome]
  if (!audio || !buf) { carregarArquivo(nome); return false }
  if (canal) pararCanal()
  const v = ganho * (volumeApp() / 100)
  if (v <= 0.0005) return true
  const src = audio.createBufferSource(); src.buffer = buf
  const g = audio.createGain(); g.gain.value = v
  src.connect(g); g.connect(audio.destination); src.start()
  if (canal) { noCanal = src; src.onended = () => { if (noCanal === src) noCanal = null } }
  return true
}
/** deixa os sons prontos no primeiro toque na tela (o navegador só libera áudio depois de um toque) */
if (typeof window !== 'undefined') {
  const preparar = () => { (['aviso', 'erro', 'venda'] as GrupoSom[]).forEach(g => carregarArquivo(arquivoDe(g))); const t = toqueEscolhido(); if (t === 'suave') carregarArquivo('pedido-suave'); if (t === 'minimal') carregarArquivo('pedido-minimal'); window.removeEventListener('pointerdown', preparar) }
  window.addEventListener('pointerdown', preparar, { passive: true })
}

/* (11/11) a confeiteira escolhe o som de cada tipo (Notificações e sons). Sons gravados do Material Design (Google) */
export type GrupoSom = 'aviso' | 'erro' | 'venda'
export const OPCOES_SOM: Record<GrupoSom, { id: string; nome: string; arquivo: string }[]> = {
  aviso: [{ id: '1', nome: 'Confirmação', arquivo: 'aviso' }, { id: '2', nome: 'Notificação suave', arquivo: 'aviso-2' }],
  erro: [{ id: '1', nome: 'Alerta', arquivo: 'erro' }, { id: '2', nome: 'Cancelar suave', arquivo: 'erro-2' }],
  venda: [{ id: '1', nome: 'Comemoração', arquivo: 'venda' }, { id: '2', nome: 'Comemoração curta', arquivo: 'venda-2' }, { id: '3', nome: 'Comemoração alegre', arquivo: 'venda-3' }],
}
export const somEscolhido = (g: GrupoSom): string => {
  try { const v = localStorage.getItem(`doonly_som_${g}_escolhido`); if (v && OPCOES_SOM[g].some(o => o.id === v)) return v } catch { /* sem armazenamento */ }
  return '1'
}
export const setSomEscolhido = (g: GrupoSom, id: string): void => {
  try { localStorage.setItem(`doonly_som_${g}_escolhido`, id) } catch { /* sem armazenamento */ }
  carregarArquivo(arquivoDe(g, id))
}
const arquivoDe = (g: GrupoSom, id = somEscolhido(g)) => (OPCOES_SOM[g].find(o => o.id === id) || OPCOES_SOM[g][0]).arquivo
/** toca a prévia de uma opção (na tela de escolher) */
export const ouvirOpcao = (g: GrupoSom, id: string): void => {
  const audio = getCtx(); if (audio?.state === 'suspended') audio.resume().catch(() => {})
  const nome = arquivoDe(g, id)
  const ganho = g === 'aviso' ? 0.55 : g === 'erro' ? 0.6 : 0.8
  pararCanal()
  if (!tocarArquivo(nome, ganho, true)) esperaCanal = window.setTimeout(() => tocarArquivo(nome, ganho, true), 600)
}

// Toca uma nota simples
const tocarNota = (freq: number, inicio: number, duracao: number, volume = 0.15, tipo: OscillatorType = 'sine') => {
  const audio = getCtx()
  if (!audio) return
  volume = volume * (volumeApp() / 100)
  if (volume <= 0.0005) return

  const osc = audio.createOscillator()
  const gain = audio.createGain()

  osc.type = tipo
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

// (11/11) Sub-preferência: som dos avisos ("Salvo", "Pedido em produção"...)
export const somAvisosHabilitado = (): boolean => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_AVISOS_KEY) !== 'false'
}
export const setSomAvisosHabilitado = (v: boolean): void => { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_AVISOS_KEY, String(v)) }

// o último som que tocou: o som do aviso não toca em cima de outro (ex.: o "entregue" já tem o seu)
let ultimoSom = 0

/**
 * Toca um som pré-definido.
 * Silenciosamente ignora se o usuário desativou sons.
 */
export const tocarSom = (tipo: SomTipo): void => {
  if (!sonsHabilitados()) return
  // Sub-toggles específicos: se OFF, não toca mesmo com o mestre ON
  if (tipo === 'notificacao' && !somNotificacaoHabilitado()) return
  if (tipo === 'pedido' && !somPedidoHabilitado()) return
  if (tipo === 'acao' && !somAvisosHabilitado()) return
  const agora = Date.now()
  if (tipo === 'acao' && agora - ultimoSom < 600) return
  ultimoSom = agora

  const audio = getCtx()
  if (!audio) return

  // Alguns browsers exigem retomar o contexto após interação
  if (audio.state === 'suspended') {
    audio.resume().catch(() => {})
  }

  if (tipo === 'acao') {
    // (11/11) o som do aviso (escolhido pelo Bruno: "confirm up" do Material); sem o arquivo ainda, o "tic" sintetizado
    if (tocarArquivo(arquivoDe('aviso'), 0.55)) return
    tocarNota(880, 0, 0.09, 0.07)
    tocarNota(1318.5, 0.06, 0.14, 0.06)
  } else if (tipo === 'erro' && tocarArquivo(arquivoDe('erro'), 0.6)) {
    return
  } else if ((tipo === 'sucesso' || tipo === 'pedido') && tocarArquivo(arquivoDe('venda'), 0.8)) {
    // (11/11) venda registrada e pedido entregue: a comemoração escolhida
    return
  } else if (tipo === 'sucesso') {
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


/* ═══ (30/10 · 5.45) Som de pedido novo: 4 toques (como no Dora). Com o app aberto, repete até aceitar ou recusar ═══ */
export type ToqueId = 'telefone' | 'telefone_tocando' | 'sinal' | 'sino' | 'suave' | 'minimal'
export const TOQUES: { id: ToqueId; nome: string; cada: number }[] = [
  // (11/11) só os 2 toques gravados (Material Design, Google), escolhidos pelo Bruno; os sintetizados saíram da lista
  { id: 'suave', nome: 'Alarme suave', cada: 6 },
  { id: 'minimal', nome: 'Toque minimalista', cada: 10 },
]
const STORAGE_ALERTA_KEY = 'doonly_alerta_pedido'
const STORAGE_TOQUE_KEY = 'doonly_toque_pedido'
export const alertaPedidoHabilitado = (): boolean => {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_ALERTA_KEY) !== 'false'
}
export const setAlertaPedidoHabilitado = (v: boolean): void => { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_ALERTA_KEY, String(v)) }
export const toqueEscolhido = (): ToqueId => {
  const v = typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_TOQUE_KEY)
  return (TOQUES.some(t => t.id === v) ? v : 'suave') as ToqueId
}
export const setToqueEscolhido = (v: ToqueId): void => { if (typeof window !== 'undefined') localStorage.setItem(STORAGE_TOQUE_KEY, v); if (v === 'suave') carregarArquivo('pedido-suave'); if (v === 'minimal') carregarArquivo('pedido-minimal') }

/** Toca um toque de pedido novo uma vez (não depende de "Sons do app": é aviso de trabalho) */
export const tocarToque = (id: ToqueId = toqueEscolhido()): void => {
  const audio = getCtx()
  if (!audio) return
  if (audio.state === 'suspended') audio.resume().catch(() => {})
  if (id === 'suave' || id === 'minimal') {
    const nome = id === 'suave' ? 'pedido-suave' : 'pedido-minimal'
    pararCanal()
    if (tocarArquivo(nome, 0.9, true)) return
    // ainda carregando (primeira vez): tenta de novo em instantes; se não der, toca o sinal
    esperaCanal = window.setTimeout(() => { if (!tocarArquivo(nome, 0.9, true)) tocarToque('sinal') }, 700)
    return
  }
  if (id === 'telefone') {
    // toque de celular moderno: marimba subindo, duas vezes
    const m = [659.25, 783.99, 987.77, 1318.5]
    for (let r = 0; r < 2; r++) m.forEach((f, i) => tocarNota(f, r * 0.62 + i * 0.12, 0.22, 0.22, 'triangle'))
  } else if (id === 'telefone_tocando') {
    // telefone antigo: dois "trrrim" (duas notas juntas batendo rápido)
    for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) {
      const t = r * 0.62 + k * 0.045
      tocarNota(1180, t, 0.04, 0.16, 'square')
      tocarNota(1420, t + 0.02, 0.04, 0.12, 'square')
    }
  } else if (id === 'sinal') {
    // sinal do Doonly: três notas suaves subindo, com eco longo
    tocarNota(783.99, 0, 0.5, 0.26)
    tocarNota(987.77, 0.16, 0.5, 0.26)
    tocarNota(1318.5, 0.32, 0.9, 0.28)
  } else {
    // sino de balcão: "plim" metálico (fundamental + harmônicos de sino)
    const f = 1760
    tocarNota(f, 0, 1.2, 0.3)
    tocarNota(f * 2.76, 0, 0.6, 0.09)
    tocarNota(f * 5.4, 0, 0.3, 0.04)
  }
}
