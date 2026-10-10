import { SeloVerificado } from './SeloVerificado'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Lightning, CalendarBlank, Truck } from '@phosphor-icons/react'
import { DesignSettings, Configuracoes } from '@/types/database'
import { seloEntrega } from '@/lib/entregaProduto'
import './cardapioModelo1.css'

// ─────────────────────────────────────────────────────────────
// CardapioModelo1 — topo do cardápio no celular (o padrão de todas as lojas)
// 08/10 · 3.28: etiquetas de verdade (vêm do que a loja marcou), "aberto agora" com a bolinha
// piscando, endereço do jeito que ela escolheu em Dados da loja, logo maior e selo novo.
// ─────────────────────────────────────────────────────────────

interface CardapioModeloProps {
  design: DesignSettings
  config: Configuracoes | null
  verificada?: boolean
  produtos?: any[]
}

const DIAS_MAP: Record<string, number> = {
  "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4,
  "Sexta": 5, "Sábado": 6, "Domingo": 0
}
const DIAS_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const curtoHora = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

type Status = { aberto: boolean; msg: string; curto: string }

export function getStatusLoja(horarioJson: any): Status | null {
  if (!horarioJson) return null
  try {
    const h = typeof horarioJson === 'string' ? JSON.parse(horarioJson) : horarioJson
    const now = new Date()
    const diaSemana = now.getDay()
    const horaAtual = now.getHours() * 60 + now.getMinutes()
    const toMin = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm }
    const isDiaAtivo = (dia: number) => {
      if (dia === 6 && h.abre_sabado) return true
      if (dia === 0 && h.abre_domingo) return true
      return (h.dias || []).some((d: string) => DIAS_MAP[d] === dia)
    }
    const getHorarioDia = (dia: number) => {
      if (dia === 6 && h.abre_sabado) return { ab: toMin(h.sabado_abertura || '09:00'), fe: toMin(h.sabado_fechamento || '14:00') }
      if (dia === 0 && h.abre_domingo) return { ab: toMin(h.domingo_abertura || '09:00'), fe: toMin(h.domingo_fechamento || '14:00') }
      return { ab: toMin(h.abertura || '08:00'), fe: toMin(h.fechamento || '18:00') }
    }
    if (isDiaAtivo(diaSemana)) {
      const { ab, fe } = getHorarioDia(diaSemana)
      if (horaAtual >= ab && horaAtual < fe) return { aberto: true, msg: `Aberto agora · até ${hhmm(fe)}`, curto: `Aberto · até ${curtoHora(fe)}` }
      if (horaAtual < ab) return { aberto: false, msg: `Fechado · abre hoje às ${hhmm(ab)}`, curto: `Fechado · abre ${curtoHora(ab)}` }
    }
    for (let i = 1; i <= 7; i++) {
      const proximo = (diaSemana + i) % 7
      if (isDiaAtivo(proximo)) {
        const { ab } = getHorarioDia(proximo)
        const label = i === 1 ? 'amanhã' : DIAS_LABEL[proximo]
        return { aberto: false, msg: `Fechado · abre ${label} às ${hhmm(ab)}`, curto: `Fechado · abre ${label} ${curtoHora(ab)}` }
      }
    }
    return { aberto: false, msg: 'Fechado', curto: 'Fechado' }
  } catch { return null }
}

/** Endereço do jeito que a loja escolheu em Dados da loja (Completo · Só a cidade · Não mostrar) */
export function getEnderecoData(config: Configuracoes | null): { linha: string; completo: string } | null {
  if (!config?.endereco) return null
  const c: any = config
  const modo = c.mostrar_localizacao ? 'completo' : c.mostrar_apenas_cidade ? 'cidade' : 'nada'
  if (modo === 'nada') return null
  try {
    const e = typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco
    const cidadeUf = [e.cidade, e.estado].filter(Boolean).join(' - ')
    if (modo === 'cidade') return cidadeUf ? { linha: cidadeUf, completo: cidadeUf } : null
    const rua = e.rua ? e.rua + (e.numero ? `, ${e.numero}` : '') : ''
    const linha = [rua, e.bairro].filter(Boolean).join(' · ') || cidadeUf
    const completo = [rua, e.bairro, cidadeUf, e.cep].filter(Boolean).join(', ')
    return linha ? { linha, completo } : null
  } catch { return null }
}

/** Etiquetas que o cliente vê: só o que a loja faz de verdade */
export function etiquetasDaLoja(config: Configuracoes | null, produtos: any[] = []) {
  const formas: string[] = (config as any)?.formas_entrega || []
  const entrega = formas.some(f => f === 'entrega_propria' || f === 'motoboy' || f === 'uber_flash')
  const selos = produtos.map(p => seloEntrega(p))
  const pronta = selos.some(s => s?.tipo === 'pronta')
  const encomenda = selos.some(s => s?.tipo === 'encomenda')
  return [
    entrega && { Ic: Truck, t: 'Entrega' },
    pronta && { Ic: Lightning, t: 'Pronta entrega' },
    encomenda && { Ic: CalendarBlank, t: 'Sob encomenda' },
  ].filter(Boolean) as { Ic: typeof Truck; t: string }[]
}

export function CardapioModelo1({ design, config, verificada = false, produtos = [] }: CardapioModeloProps) {
  const [modalEndereco, setModalEndereco] = useState(false)
  const accent = design.cor_borda || design.cor_botao || '#E85A8C'
  const ehBranco = (c?: string | null) => !c || ['#fff', '#ffffff', '#fefefe', 'white', 'transparent'].includes(c.trim().toLowerCase())
  const corFaixa = !ehBranco(design.cor_navbar) ? design.cor_navbar! : (!ehBranco(design.cor_borda) ? design.cor_borda! : '#E85A8C')
  const corIcone = !ehBranco(design.cor_botao) ? design.cor_botao! : accent
  const status = getStatusLoja(config?.horario || null)
  const endereco = getEnderecoData(config)
  const etiquetas = etiquetasDaLoja(config, produtos)

  const isColorLight = (hex: string): boolean => {
    const c = hex.replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.substring(0, 2), 16), g = parseInt(c.substring(2, 4), 16), b = parseInt(c.substring(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
  }
  const rawCorNome = design.cor_nome || '#1f2937'
  // Sem cor escolhida pela confeiteira: escuro (o fundo é claro); cor clara some no fundo claro
  const corNome = rawCorNome && !['#1f2937', '#000000', '#000', '#111111'].includes(String(rawCorNome).trim().toLowerCase()) && !isColorLight(rawCorNome) ? rawCorNome : '#2C1219'
  const fundo = design.cor_background && design.cor_background.toLowerCase() !== '#fef2f2' ? design.cor_background : '#F7F4F5'

  return (
    <div className="cm1-root">
      <div className={`cm1-hero${design.banner_topo_url ? ' cm1-hero--foto' : ''}`}>
        {design.banner_topo_url
          ? <div className="cm1-hero-img" style={{ backgroundImage: `url(${design.banner_topo_url})` }} />
          : <div className="cm1-hero-faixa" style={{ backgroundColor: corFaixa }}><span className="cm1-hero-pontos" /></div>}
        {status && (
          <div className={`cm1-status${status.aberto ? ' aberto' : ''}`}>
            <i aria-hidden="true" />
            <span className="cm1-st-g">{status.msg}</span>
            <span className="cm1-st-c">{status.curto}</span>
          </div>
        )}
      </div>

      <div className="cm1-content" style={{ background: fundo, ['--cm1-fundo' as any]: fundo }}>
        <div className="cm1-logo" style={{ borderColor: accent }}>
          {design.logo_url
            ? <img src={design.logo_url} alt={design.nome_loja || ''} />
            : <span style={{ background: design.cor_background || '#FCE0E9', color: accent }}>{(design.nome_loja || 'D').charAt(0).toUpperCase()}</span>}
        </div>

        <h1 className="cm1-nome" style={{ color: corNome }}>
          {design.nome_loja || 'Minha Confeitaria'}{verificada && <SeloVerificado tamanho={22} />}
        </h1>
        {design.descricao_loja && <p className="cm1-descricao">{design.descricao_loja}</p>}

        {etiquetas.length > 0 && (
          <div className="cm1-info" style={{ gridTemplateColumns: `repeat(${etiquetas.length}, minmax(0, 1fr))` }}>
            {etiquetas.map(({ Ic, t }) => <span key={t}><Ic size={22} weight="duotone" color={corIcone} /><small>{t}</small></span>)}
          </div>
        )}

        {endereco && (
          <p className="cm1-endereco">
            <MapPin size={18} weight="bold" aria-hidden="true" />
            <span>{endereco.linha}</span>
            <button type="button" onClick={() => setModalEndereco(true)} style={{ color: corIcone }}>Ver no mapa</button>
          </p>
        )}
      </div>

      {/* ── Endereço: mini mapa + Waze/Google Maps (o jeito de sempre) ── */}
      {modalEndereco && endereco && createPortal(
        <div className="cm1-mapa-veu" onClick={() => setModalEndereco(false)}>
          <div className="cm1-mapa" role="dialog" aria-modal="true" aria-label="Endereço da loja" onClick={e => e.stopPropagation()}>
            <iframe width="100%" height="200" style={{ border: 'none', display: 'block' }} title="Mapa"
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(endereco.completo)}`} allowFullScreen />
            <div className="cm1-mapa-corpo">
              <p className="cm1-mapa-end"><MapPin size={20} weight="bold" color={corIcone} aria-hidden="true" />{endereco.completo}</p>
              <div className="cm1-mapa-bts">
                <a className="waze" href={`https://waze.com/ul?q=${encodeURIComponent(endereco.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/waze.png" alt="" />Waze</a>
                <a className="gmaps" href={`https://maps.google.com/?q=${encodeURIComponent(endereco.completo)}`} target="_blank" rel="noopener noreferrer"><img src="/google-maps.png" alt="" />Google Maps</a>
              </div>
              <button type="button" className="cm1-mapa-fechar" onClick={() => setModalEndereco(false)}>Fechar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
