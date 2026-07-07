import { useState } from 'react'
import { Star, MagnifyingGlass, MapPin, Lightning, CalendarBlank, Truck } from '@phosphor-icons/react'
import { DesignSettings, Configuracoes } from '@/types/database'

// ─────────────────────────────────────────────────────────────
// CardapioModelo1 — Layout "Editorial Hero" (v2 refinado)
//
// Modelo #1 do cardápio público mobile.
//
// v2 mudanças:
//   - Hero menor (175px), mais compacto
//   - Logo maior (78px) e mais próxima do hero
//   - Curva suave na transição hero→conteúdo (padrão iFood/Rappi)
//   - Status badge reposicionado e sempre visível
//   - Fallback de hero sem imagem com pattern sutil
//   - Espaçamentos otimizados (menos gaps vazios)
//   - Descrição ausente não deixa gap visual
// ─────────────────────────────────────────────────────────────

interface CardapioModeloProps {
  design: DesignSettings
  config: Configuracoes | null
}

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

  // Detecta se cor_nome é clara demais pro fundo #f8f8f8 do Modelo1.
  // No layout Padrão, cor_nome clara funciona (fundo colorido).
  // No Modelo1, o fundo é claro — precisa de texto escuro.
  const isColorLight = (hex: string): boolean => {
    const c = hex.replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    // Luminância relativa (fórmula W3C)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.6 // acima de 0.6 = claro demais pra fundo claro
  }
  const rawCorNome = design.cor_nome || '#1f2937'
  const corNome = isColorLight(rawCorNome) ? '#1f2937' : rawCorNome

  const handleSearchClick = () => {
    setSearchOpen(o => !o)
    if (!searchOpen) {
      setTimeout(() => {
        const el = document.getElementById('cm1-search-input')
        if (el) el.focus()
      }, 100)
    }
  }

  return (
    <div className="cm1-root">
      {/* ── Hero ───────────────────────────────────────── */}
      <div className="cm1-hero">
        {heroImage ? (
          <img src={heroImage} alt={design.nome_loja || 'Banner'} className="cm1-hero-img" />
        ) : (
          <div className="cm1-hero-fallback" style={{ background: `linear-gradient(135deg, ${accent}88 0%, ${accent} 60%, ${accent}dd 100%)` }}>
            <div className="cm1-hero-pattern" />
          </div>
        )}
        <div className="cm1-hero-overlay" />

        {/* Busca flutuante */}
        <button className="cm1-search-btn" onClick={handleSearchClick} aria-label="Buscar produtos">
          <MagnifyingGlass size={17} weight="bold" color="#fff" />
        </button>

        {/* Badge de avaliação */}
        {avaliacao > 0 && (
          <div className="cm1-rating">
            <Star size={12} weight="fill" color="#78350f" />
            <span>{avaliacao.toFixed(1)}</span>
          </div>
        )}

        {/* Logo sobreposta */}
        <div className="cm1-logo-wrap" style={{ borderColor: accent }}>
          {design.logo_url ? (
            <img src={design.logo_url} alt={design.nome_loja || ''} className="cm1-logo-img" />
          ) : (
            <div className="cm1-logo-fallback" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}>
              {(design.nome_loja || 'D').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── Conteúdo com curva suave ───────────────────── */}
      <div className="cm1-content">
        {/* Status badge (dentro do content, alinhado à direita, acima do nome) */}
        {status && (
          <div className="cm1-status-row">
            <div className={`cm1-status ${status.aberto ? 'cm1-status-open' : 'cm1-status-closed'}`}>
              <span className="cm1-status-dot" />
              {status.aberto ? 'Aberto agora' : (status.msg || 'Fechado')}
            </div>
          </div>
        )}

        <h1 className="cm1-nome" style={{ color: corNome }}>
          {design.nome_loja || 'Minha Confeitaria'}
        </h1>

        {design.descricao_loja && (
          <p className="cm1-descricao">{design.descricao_loja}</p>
        )}

        {/* Info Row */}
        <div className="cm1-info-row">
          <div className="cm1-info-item">
            <Lightning size={18} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Pronta</span>
              <span>entrega</span>
            </div>
          </div>
          <div className="cm1-info-divider" />
          <div className="cm1-info-item">
            <CalendarBlank size={18} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Sob</span>
              <span>encomenda</span>
            </div>
          </div>
          <div className="cm1-info-divider" />
          <div className="cm1-info-item">
            <Truck size={18} weight="duotone" color={accent} />
            <div className="cm1-info-text">
              <span>Entrega e</span>
              <span>retirada</span>
            </div>
          </div>
        </div>

        {/* Endereço */}
        {endereco && (
          <div className="cm1-endereco">
            <MapPin size={13} weight="bold" style={{ flexShrink: 0, color: '#9ca3af' }} />
            <span>{endereco}</span>
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
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const s = document.querySelector('.container.mx-auto')
                if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            className="cm1-search-input"
          />
          <button className="cm1-search-close" onClick={() => { setSearchOpen(false); setSearchTerm('') }}>✕</button>
        </div>
      )}

      <style>{`
        .cm1-root {
          position: relative;
          z-index: 1;
        }

        /* ── Hero (compacto: 175px) ───────────────────── */
        .cm1-hero {
          position: relative;
          width: 100%;
          height: 175px;
          overflow: visible;
        }
        .cm1-hero-img {
          width: 100%;
          height: 175px;
          object-fit: cover;
          display: block;
        }
        .cm1-hero-fallback {
          width: 100%;
          height: 175px;
          position: relative;
        }
        /* Pattern sutil quando não tem foto */
        .cm1-hero-pattern {
          position: absolute;
          inset: 0;
          opacity: 0.08;
          background-image: radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px),
                            radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px),
                            radial-gradient(circle at 50% 80%, #fff 1.5px, transparent 1.5px);
          background-size: 60px 60px, 80px 80px, 40px 40px;
        }
        .cm1-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 100%);
          pointer-events: none;
        }

        /* ── Busca flutuante ──────────────────────────── */
        .cm1-search-btn {
          position: absolute;
          top: 12px;
          right: 14px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(0,0,0,0.3);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5;
        }
        .cm1-search-btn:active { background: rgba(0,0,0,0.45); }

        /* ── Search bar ───────────────────────────────── */
        .cm1-search-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 16px 12px;
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
          background: none; border: none; font-size: 16px;
          color: #9ca3af; cursor: pointer; padding: 0 2px; line-height: 1;
        }
        @keyframes cm1SlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── Rating badge ─────────────────────────────── */
        .cm1-rating {
          position: absolute;
          bottom: 36px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 3px;
          background: #fbbf24;
          padding: 3px 9px;
          border-radius: 20px;
          z-index: 3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .cm1-rating span {
          font-size: 11px;
          font-weight: 700;
          color: #78350f;
          line-height: 1;
        }

        /* ── Logo sobreposta (maior: 78px) ────────────── */
        .cm1-logo-wrap {
          position: absolute;
          bottom: -22px;
          right: 18px;
          width: 78px;
          height: 78px;
          border-radius: 50%;
          background: #fff;
          border: 3px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 6;
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
          font-size: 32px;
          font-weight: 800;
          font-family: inherit;
          letter-spacing: -0.02em;
        }

        /* ── Conteúdo com curva ────────────────────────── */
        .cm1-content {
          position: relative;
          z-index: 2;
          margin-top: -24px;
          background: #f8f8f8;
          border-radius: 24px 24px 0 0;
          padding: 20px 16px 14px;
        }

        /* ── Status (dentro do content, acima do nome) ── */
        .cm1-status-row {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 8px;
        }
        .cm1-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 20px;
          letter-spacing: 0.01em;
        }
        .cm1-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: inline-block;
        }
        .cm1-status-open {
          background: #dcfce7;
          color: #166534;
        }
        .cm1-status-open .cm1-status-dot { background: #16a34a; }
        .cm1-status-closed {
          background: #fef2f2;
          color: #991b1b;
        }
        .cm1-status-closed .cm1-status-dot { background: #dc2626; }

        /* ── Nome e descrição ─────────────────────────── */
        .cm1-nome {
          margin: 0 0 2px;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.01em;
          padding-right: 90px; /* espaço pra logo não sobrepor */
        }
        .cm1-descricao {
          margin: 0 0 12px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.35;
          padding-right: 90px;
        }
        /* Se não tem descrição, o nome fica com margin-bottom menor */
        .cm1-nome:last-child {
          margin-bottom: 12px;
        }

        /* ── Info row ─────────────────────────────────── */
        .cm1-info-row {
          display: flex;
          align-items: stretch;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          margin-bottom: 12px;
          background: #fff;
        }
        .cm1-info-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 10px 4px;
          text-align: center;
        }
        .cm1-info-text {
          display: flex;
          flex-direction: column;
          line-height: 1.15;
        }
        .cm1-info-text span {
          font-size: 10.5px;
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
          gap: 5px;
          margin-bottom: 6px;
        }
        .cm1-endereco span {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.35;
        }
      `}</style>
    </div>
  )
}
