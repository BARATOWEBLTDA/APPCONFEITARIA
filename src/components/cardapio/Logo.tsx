import { Star } from 'lucide-react'
import { useState } from 'react'

interface LogoProps {
  logoUrl?: string
  borderColor?: string
  storeName?: string
  storeDescription?: string
  corNome?: string
  avaliacaoMedia?: number
  configuracoes?: any
  hideStars?: boolean
}

const DIAS_MAP: Record<string, number> = {
  "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4,
  "Sexta": 5, "Sábado": 6, "Domingo": 0
}
const DIAS_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function getStatusLoja(horarioJson: string | null) {
  if (!horarioJson) return null
  try {
    const h = typeof horarioJson === 'string' ? JSON.parse(horarioJson) : horarioJson
    const now = new Date()
    const diaSemana = now.getDay() // 0=dom, 1=seg...
    const horaAtual = now.getHours() * 60 + now.getMinutes()

    const toMin = (t: string) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm
    }

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
      // Ainda hoje mas depois do fechamento — verifica próximo dia
      if (horaAtual < ab) {
        const abre = h.abertura || '08:00'
        return { aberto: false, msg: `Abre hoje às ${abre}` }
      }
    }

    // Procura próximo dia com funcionamento
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

export function Logo({ logoUrl, borderColor, storeName, storeDescription, corNome, avaliacaoMedia = 4.9, hideStars = false, configuracoes }: LogoProps) {
  const [modalEndereco, setModalEndereco] = useState(false)
  const status = getStatusLoja(configuracoes?.horario || null)

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={14} fill={i < Math.floor(rating) ? '#fbbf24' : 'none'} color={i < Math.ceil(rating) ? '#fbbf24' : '#d1d5db'} />
    ))
  }

  // Monta endereço a partir do JSON
  const getEndereco = () => {
    if (!configuracoes?.endereco) return null
    try {
      const e = typeof configuracoes.endereco === 'string' ? JSON.parse(configuracoes.endereco) : configuracoes.endereco
      return e
    } catch { return null }
  }

  const endereco = getEndereco()
  const cidade = endereco?.cidade || ''
  const enderecoCompleto = endereco ? [
    endereco.rua && endereco.numero ? `${endereco.rua}, ${endereco.numero}` : endereco.rua,
    endereco.bairro,
    endereco.cidade && endereco.estado ? `${endereco.cidade} - ${endereco.estado}` : endereco.cidade,
    endereco.cep
  ].filter(Boolean).join(', ') : ''

  const mostrarCidade = configuracoes?.mostrar_apenas_cidade && cidade
  const mostrarCompleto = configuracoes?.mostrar_localizacao && enderecoCompleto

  return (
    <div className="relative">
      <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        {logoUrl ? (
          <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: `3px solid ${borderColor || '#ec4899'}`, padding: '3px', backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid white', overflow: 'hidden' }}>
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
            </div>
          </div>
        ) : (
          <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: `3px solid ${borderColor || '#ec4899'}`, backgroundColor: borderColor || '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', color: 'white' }}>
            {storeName?.charAt(0) || '🧁'}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '6px', paddingTop: '100px', margin: '0 16px', marginTop: '-100px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 20, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginTop: '28px', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: corNome || '#1f2937', marginBottom: '4px' }}>{storeName}</h1>

          {!hideStars && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>{renderStars(avaliacaoMedia)}</div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{avaliacaoMedia}/5.0</span>
            </div>
          )}

          {/* Cidade */}
          {(mostrarCidade || mostrarCompleto) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{cidade}</span>
              {mostrarCompleto && (
                <button onClick={() => setModalEndereco(true)} style={{ fontSize: '12px', color: borderColor || '#ec4899', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                  Ver endereço completo
                </button>
              )}
            </div>
          )}

          {storeDescription && (
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', lineHeight: '1.4', padding: '0 1.25rem' }}>{storeDescription}</p>
          )}

          {/* Status aberto/fechado */}
          {status && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '50px', background: status.aberto ? '#dcfce7' : '#fef2f2', marginBottom: '6px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: status.aberto ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: status.aberto ? '#15803d' : '#dc2626' }}>
                {status.aberto ? 'Aberto Agora' : `Fechado · ${status.msg}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Modal endereço completo */}
      {modalEndereco && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setModalEndereco(false)}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
            {/* Mini mapa */}
            <iframe
              width="100%"
              height="200"
              style={{ border: 'none', display: 'block' }}
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=${encodeURIComponent(enderecoCompleto)}`}
              allowFullScreen
            />

            <div style={{ padding: '1.25rem' }}>
              {/* Endereço */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={borderColor || '#ec4899'} strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                <p style={{ fontFamily: 'Nunito,sans-serif', fontSize: '0.9rem', color: '#374151', lineHeight: '1.5', margin: 0 }}>{enderecoCompleto}</p>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', background: '#00c0f3', color: 'white', borderRadius: '12px', fontFamily: 'Nunito,sans-serif', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  <img src="/waze.png" alt="Waze" width="20" height="20" style={{objectFit:'contain'}} />
                  Waze
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(enderecoCompleto)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', background: '#4285f4', color: 'white', borderRadius: '12px', fontFamily: 'Nunito,sans-serif', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  <img src="/google-maps.png" alt="Google Maps" width="20" height="20" style={{objectFit:'contain'}} />
                  Google Maps
                </a>
              </div>

              <button
                onClick={() => setModalEndereco(false)}
                style={{ width: '100%', padding: '0.85rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '50px', fontFamily: 'Nunito,sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
