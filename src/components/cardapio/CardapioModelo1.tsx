import { useState } from 'react'
import { Star, MapPin, Lightning, CalendarBlank, Truck } from '@phosphor-icons/react'
import { DesignSettings, Configuracoes } from '@/types/database'

// ─────────────────────────────────────────────────────────────
// CardapioModelo1 — Layout "Editorial Hero" (v3)
//
// v3 mudanças:
//   - Removeu lupa/busca flutuante (já existe busca nativa no ProductList)
//   - "Aberto agora" moveu pro hero (onde ficava a estrela)
//   - Estrelas moveram pra ao lado do nome da loja
//   - Espaçamentos refinados título/descrição
//   - Removeu useState/searchOpen (não precisa mais)
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

function getEnderecoData(config: Configuracoes | null): { curto: string; completo: string; mapsUrl: string } | null {
  if (!config?.endereco) return null
  try {
    const e = typeof config.endereco === 'string' ? JSON.parse(config.endereco) : config.endereco
    // Versão curta: bairro + cidade
    const partesCurtas: string[] = []
    if (e.bairro) partesCurtas.push(e.bairro)
    if (e.cidade) partesCurtas.push(e.cidade)
    const curto = partesCurtas.join(', ') || ''
    // Versão completa pra Google Maps
    const partesCompletas: string[] = []
    if (e.rua) partesCompletas.push(e.rua + (e.numero ? `, ${e.numero}` : ''))
    if (e.bairro) partesCompletas.push(e.bairro)
    if (e.cidade) partesCompletas.push(e.cidade + (e.estado ? ` - ${e.estado}` : ''))
    if (e.cep) partesCompletas.push(e.cep)
    const completo = partesCompletas.join(', ')
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(completo)}`
    return curto ? { curto, completo, mapsUrl } : null
  } catch { return null }
}

export function CardapioModelo1({ design, config }: CardapioModeloProps) {
  const [modalEndereco, setModalEndereco] = useState(false)
  const accent = design.cor_borda || design.cor_botao || '#ec4899'
  const banners = [design.banner_url, design.banner1_url, design.banner2_url, design.banner3_url].filter(Boolean)
  const heroImage = banners[0] || ''
  const status = getStatusLoja(config?.horario || null)
  const enderecoData = getEnderecoData(config)
  const avaliacao = config?.avaliacao_media ?? 0

  const isColorLight = (hex: string): boolean => {
    const c = hex.replace('#', '')
    if (c.length < 6) return false
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
  }
  const rawCorNome = design.cor_nome || '#1f2937'
  const corNome = isColorLight(rawCorNome) ? '#1f2937' : rawCorNome

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

        {/* Status badge no hero (bottom-left, onde ficava a estrela) */}
        {status && (
          <div className={`cm1-hero-status ${status.aberto ? 'cm1-hero-status-open' : 'cm1-hero-status-closed'}`}>
            <span className="cm1-hero-status-dot" />
            {status.aberto ? 'Aberto agora' : (status.msg || 'Fechado')}
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
        {/* Nome + Estrelas inline */}
        <div className="cm1-nome-row">
          <h1 className="cm1-nome" style={{ color: corNome }}>
            {design.nome_loja || 'Minha Confeitaria'}
          </h1>
          {avaliacao > 0 && (
            <div className="cm1-rating-inline">
              <Star size={14} weight="fill" color="#fbbf24" />
              <span>{avaliacao.toFixed(1)}</span>
            </div>
          )}
        </div>

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

        {/* Endereço compacto + Ver no mapa (abre modal com Waze/Google Maps) */}
        {enderecoData && (
          <div className="cm1-endereco">
            <MapPin size={13} weight="bold" style={{ flexShrink: 0, color: '#9ca3af' }} />
            <span>{enderecoData.curto}</span>
            <button onClick={() => setModalEndereco(true)} className="cm1-ver-mapa" style={{ color: accent }}>
              Ver no mapa
            </button>
          </div>
        )}
      </div>

      {/* ── Modal de endereço (bottom sheet com mini mapa + Waze/Maps) ── */}
      {modalEndereco && enderecoData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setModalEndereco(false)}>
          <div style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>

            {/* Mini mapa */}
            <iframe
              width="100%"
              height="200"
              style={{ border: 'none', display: 'block' }}
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(enderecoData.completo)}`}
              allowFullScreen
            />

            <div style={{ padding: '1.25rem' }}>
              {/* Endereço completo */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <p style={{ fontFamily: 'inherit', fontSize: '0.9rem', color: '#374151', lineHeight: '1.5', margin: 0 }}>{enderecoData.completo}</p>
              </div>

              {/* Botões Waze + Google Maps */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(enderecoData.completo)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', background: '#33CCFF', color: 'white', borderRadius: '12px', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  <img src="/waze.png" alt="Waze" width="20" height="20" style={{objectFit:'contain'}} />
                  Waze
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(enderecoData.completo)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', background: '#ecf3ff', color: '#4285f4', borderRadius: '12px', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  <img src="/google-maps.png" alt="Google Maps" width="20" height="20" style={{objectFit:'contain'}} />
                  Google Maps
                </a>
              </div>

              <button
                onClick={() => setModalEndereco(false)}
                style={{ width: '100%', padding: '0.85rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '50px', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cm1-root {
          position: relative;
          z-index: 1;
        }

        /* ── Hero (175px) ─────────────────────────────── */
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

        /* ── Status badge no hero (bottom-left) ───────── */
        .cm1-hero-status {
          position: absolute;
          bottom: 36px;
          left: 16px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 20px;
          z-index: 3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          letter-spacing: 0.01em;
        }
        .cm1-hero-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }
        .cm1-hero-status-open {
          background: rgba(255,255,255,0.95);
          color: #166534;
        }
        .cm1-hero-status-open .cm1-hero-status-dot { background: #16a34a; }
        .cm1-hero-status-closed {
          background: rgba(255,255,255,0.95);
          color: #991b1b;
        }
        .cm1-hero-status-closed .cm1-hero-status-dot { background: #dc2626; }

        /* ── Logo sobreposta (78px) ───────────────────── */
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
          padding: 22px 16px 14px;
        }

        /* ── Nome + Estrelas na mesma linha ────────────── */
        .cm1-nome-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 4px;
          padding-right: 80px; /* espaço pra logo não sobrepor */
        }
        .cm1-nome {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.01em;
          flex-shrink: 1;
          min-width: 0;
        }
        .cm1-rating-inline {
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }
        .cm1-rating-inline span {
          font-size: 13px;
          font-weight: 700;
          color: #92400e;
          line-height: 1;
        }

        /* ── Descrição ────────────────────────────────── */
        .cm1-descricao {
          margin: 0 0 14px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
          padding-right: 80px;
        }
        /* Se não tem descrição, nome-row precisa de margin-bottom maior */
        .cm1-nome-row:last-child {
          margin-bottom: 14px;
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
        .cm1-ver-mapa {
          font-size: 12px;
          font-weight: 600;
          text-decoration: underline;
          white-space: nowrap;
          flex-shrink: 0;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
        }
      `}</style>
    </div>
  )
}
