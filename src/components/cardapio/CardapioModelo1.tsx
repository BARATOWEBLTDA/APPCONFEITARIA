import { useState } from 'react'
import { Star, MagnifyingGlass, MapPin, Lightning, CalendarBlank, Truck } from '@phosphor-icons/react'
import { DesignSettings, Configuracoes } from '@/types/database'

// ─────────────────────────────────────────────────────────────
// CardapioModelo1 — Layout "Editorial Hero"
//
// Modelo PRO #1 do cardápio público mobile.
// Inspirado em apps de delivery premium (Sischef, iFood Pro).
//
// Estrutura:
//   Hero fullscreen (banner) → logo sobreposta → badge avaliação
//   → status aberto/fechado → nome + descrição → info row
//   (pronta entrega, sob encomenda, entrega e retirada) → endereço
//
// Substitui o header padrão Free (bloco sólido + Logo + BannerAd).
// Daqui pra baixo (categorias, produtos, footer) tudo permanece igual.
//
// Dados: 100% dos dados já existem em DesignSettings + Configuracoes.
// Zero colunas novas no banco.
//
// Nomenclatura:
//   CardapioModelo1 — este (hero editorial)
//   CardapioModelo2 — futuro
//   CardapioModelo3 — futuro
//
// Uso em CardapioPublico.tsx:
//   isPro ? <CardapioModelo1 design={design} config={config} />
//         : <HeaderFree />
// ─────────────────────────────────────────────────────────────

interface CardapioModeloProps {
  design: DesignSettings
  config: Configuracoes | null
}

// ── Status da loja (mesma lógica do Logo.tsx) ────────────────
const DIAS_MAP: Record<string, number> = {
  "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4,
  "Sexta": 5, "Sábado": 6, "Domingo": 0
}
const DIAS_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function getStatusLoja(horarioJson: string | null): { aberto: boolean; msg?: string } | null {
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
      if (horaAtual >= ab && horaAtual < fe) return { aberto: true }
      if (horaAtual < ab) return { aberto: false, msg: `Abre hoje às ${h.abertura || '08:00'}` }
    }
    for (let i = 1; i <= 7; i++) {
      const proximo = (diaSemana + i) % 7
      if (isDiaAtivo(proximo)) {
        const { ab } = getHorarioDia(proximo)
        const hh = Math.floor(ab / 60).toString().padStart(2, '0')
        const mm = (ab % 60).toString().padStart(2, '0')
        const label = i === 1 ? 'amanhã' : DIAS_LABEL[proximo]
        return { aberto: false, msg: `Abre ${label} às ${hh}:${mm}` }
      }
    }
    return { aberto: false, msg: 'Fechado' }
  } catch { return null }
}

// ── Endereço formatado ───────────────────────────────────────
function getEnderecoTexto(config: Configuracoes | null): string {
  if (!config?.endereco) return ''
  try {
    const e = typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco
    const parts: string[] = []
    if (e.rua) parts.push(e.rua + (e.numero ? `, ${e.numero}` : ''))
    if (e.bairro) parts.push(e.bairro)
    if (e.cidade) parts.push(e.cidade + (e.estado ? ` - ${e.estado}` : ''))
    return parts.join(', ')
  } catch { return '' }
}

export function CardapioModelo1({ design, config }: CardapioModeloProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const accent = design.cor_borda || design.cor_botao || '#ec4899'
  const banners = [design.banner_url, design.banner1_url, design.banner2_url, design.banner3_url].filter(Boolean)
  const heroImage = banners[0] || ''
  const status = getStatusLoja(config?.horario || null)
  const endereco = getEnderecoTexto(config)
  const avaliacao = config?.avaliacao_media ?? 0
  const corNome = design.cor_nome || '#1f2937'

  const handleSearchClick = () => {
    setSearchOpen(o => !o)
    if (!searchOpen) {
      setTimeout(() => {
        const el = document.getElementById('cm1-search-input')
        if (el) el.focus()
      }, 100)
    }
  }

  const handleSearchSubmit = () => {
    if (!searchTerm.trim()) return
    const productSection = document.querySelector('.container.mx-auto')
    if (productSection) productSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="cm1-root">
      {/* ── Hero Image ─────────────────────────────────── */}
      <div className="cm1-hero" style={{ background: heroImage ? undefined : `linear-gradient(135deg, ${accent}cc 0%, ${accent} 100%)` }}>
        {heroImage && (
          <img src={heroImage} alt={design.nome_loja || 'Banner'} className="cm1-hero-img" />
        )}
        <div className="cm1-hero-overlay" />

        {/* Busca flutuante */}
        <button className="cm1-search-btn" onClick={handleSearchClick} aria-label="Buscar produtos">
          <MagnifyingGlass size={18} weight="bold" color="#fff" />
        </button>

        {/* Badge de avaliação */}
        {avaliacao > 0 && (
          <div className="cm1-rating">
            <Star size={13} weight="fill" color="#78350f" />
            <span>{avaliacao.toFixed(1)}</span>
          </div>
        )}

        {/* Logo sobreposta */}
        <div className="cm1-logo-wrap" style={{ borderColor: accent }}>
          {design.logo_url ? (
            <img src={design.logo_url} alt={design.nome_loja || ''} className="cm1-logo-img" />
          ) : (
            <div className="cm1-logo-fallback" style={{ background: `linear-gradient(135deg, ${accent}dd, ${accent})` }}>
              {(design.nome_loja || 'D').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Badge status */}
        {status && (
          <div className={`cm1-status ${status.aberto ? 'cm1-status-open' : 'cm1-status-closed'}`}>
            {status.aberto ? 'aberto agora' : (status.msg || 'fechado')}
          </div>
        )}
      </div>

      {/* ── Search bar expandida ───────────────────────── */}
      {searchOpen && (
        <div className="cm1-search-bar" style={{ borderColor: accent }}>
          <MagnifyingGlass size={16} weight="bold" color={accent} style={{ flexShrink: 0 }} />
          <input
            id="cm1-search-input"
            type="text"
            placeholder="Buscar no cardápio..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
            className="cm1-search-input"
          />
          <button className="cm1-search-close" onClick={() => { setSearchOpen(false); setSearchTerm('') }}>
            ✕
          </button>
        </div>
      )}

      {/* ── Info Section ───────────────────────────────── */}
      <div className="cm1-info" style={{ marginTop: '22px' }}>
        <h1 className="cm1-nome" style={{ color: corNome }}>{design.nome_loja || 'Minha Confeitaria'}</h1>
        {design.descricao_loja && (
          <p className="cm1-descricao">{design.descricao_loja}</p>
        )}

        {/* Info Row */}
        <div className="cm1-info-row">
          <div className="cm1-info-item">
            <Lightning size={20} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Pronta</span>
              <span>entrega</span>
            </div>
          </div>
          <div className="cm1-info-divider" />
          <div className="cm1-info-item">
            <CalendarBlank size={20} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Sob</span>
              <span>encomenda</span>
            </div>
          </div>
          <div className="cm1-info-divider" />
          <div className="cm1-info-item">
            <Truck size={20} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Entrega e</span>
              <span>retirada</span>
            </div>
          </div>
        </div>

        {/* Endereço */}
        {endereco && (
          <div className="cm1-endereco">
            <MapPin size={14} weight="bold" style={{ flexShrink: 0, color: '#9ca3af' }} />
            <span>{endereco}</span>
          </div>
        )}
      </div>

      <style>{`
        .cm1-root {
          position: relative;
          z-index: 1;
        }

        /* ── Hero ─────────────────────────────────────── */
        .cm1-hero {
          position: relative;
          width: 100%;
          height: 220px;
          overflow: hidden;
        }
        .cm1-hero-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cm1-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.35) 100%);
          pointer-events: none;
        }

        /* ── Busca flutuante ──────────────────────────── */
        .cm1-search-btn {
          position: absolute;
          top: 14px;
          right: 14px;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(0,0,0,0.35);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
          transition: background 0.2s;
        }
        .cm1-search-btn:active {
          background: rgba(0,0,0,0.5);
        }

        /* ── Search bar ───────────────────────────────── */
        .cm1-search-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 16px 0;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1.5px solid;
          background: #fff;
          animation: cm1SlideDown 0.2s ease both;
        }
        .cm1-search-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          color: #1f2937;
          font-family: inherit;
          background: transparent;
        }
        .cm1-search-input::placeholder { color: #9ca3af; }
        .cm1-search-close {
          background: none;
          border: none;
          font-size: 16px;
          color: #9ca3af;
          cursor: pointer;
          padding: 0 2px;
          line-height: 1;
        }
        @keyframes cm1SlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Rating badge ─────────────────────────────── */
        .cm1-rating {
          position: absolute;
          bottom: 14px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 4px;
          background: #fbbf24;
          padding: 4px 10px;
          border-radius: 20px;
          z-index: 3;
        }
        .cm1-rating span {
          font-size: 12px;
          font-weight: 700;
          color: #78350f;
          line-height: 1;
        }

        /* ── Logo sobreposta ──────────────────────────── */
        .cm1-logo-wrap {
          position: absolute;
          bottom: -28px;
          right: 20px;
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
          overflow: hidden;
        }
        .cm1-logo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 50%;
        }
        .cm1-logo-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 28px;
          font-weight: 800;
          font-family: inherit;
        }

        /* ── Status badge ─────────────────────────────── */
        .cm1-status {
          position: absolute;
          bottom: -4px;
          right: 72px;
          font-size: 10px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 10px;
          white-space: nowrap;
          z-index: 4;
          letter-spacing: 0.01em;
        }
        .cm1-status-open {
          background: #dcfce7;
          color: #166534;
        }
        .cm1-status-closed {
          background: #fef2f2;
          color: #991b1b;
        }

        /* ── Info section ─────────────────────────────── */
        .cm1-info {
          padding: 0 16px;
        }
        .cm1-nome {
          margin: 0 0 4px;
          font-size: 20px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.01em;
        }
        .cm1-descricao {
          margin: 0 0 14px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
        }

        /* ── Info row ─────────────────────────────────── */
        .cm1-info-row {
          display: flex;
          align-items: stretch;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          margin-bottom: 14px;
          background: #fafafa;
        }
        .cm1-info-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 6px;
          text-align: center;
        }
        .cm1-info-text {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .cm1-info-text span {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }
        .cm1-info-divider {
          width: 1px;
          background: #e5e7eb;
          align-self: stretch;
        }

        /* ── Endereço ─────────────────────────────────── */
        .cm1-endereco {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 16px;
        }
        .cm1-endereco span {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}
