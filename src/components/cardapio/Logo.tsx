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

  const accent = borderColor || '#E85A8C'
  const iconeAtalho = (d: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block' }}>
      <path d={d} />
    </svg>
  )

  return (
    <div className="relative">
      {/* Logo: menor e com sombra, "pousado" na borda de cima do card
          (o marginTop negativo do card "sobe" este wrapper junto, por isso -58 = metade do logo) */}
      <div style={{ position: 'absolute', top: '-58px', left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
        {logoUrl ? (
          <div style={{ width: '116px', height: '116px', borderRadius: '50%', padding: '4px', backgroundColor: 'white', boxShadow: '0 6px 18px rgba(60,20,35,0.18)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: `2px solid ${accent}`, overflow: 'hidden', background: '#fff' }}>
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%', display: 'block' }} />
            </div>
          </div>
        ) : (
          <div style={{ width: '116px', height: '116px', borderRadius: '50%', border: '4px solid white', backgroundColor: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: 'white', boxShadow: '0 6px 18px rgba(60,20,35,0.18)' }}>
            {storeName?.charAt(0) || '🧁'}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '18px', padding: '66px 16px 14px', margin: '0 14px', marginTop: '-70px', boxShadow: '0 8px 24px rgba(60,20,35,0.10)', zIndex: 20, position: 'relative', textAlign: 'center' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-title)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{storeName}</h1>

        {/* Status + nota numa linha só */}
        {(status || !hideStars) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '5px', fontSize: '12.5px', fontWeight: 700, flexWrap: 'wrap' }}>
            {status && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: status.aberto ? '#15803d' : '#dc2626' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: status.aberto ? '#22c55e' : '#ef4444', flexShrink: 0 }} />
                {status.aberto ? 'Aberto agora' : `Fechado · ${status.msg}`}
              </span>
            )}
            {status && !hideStars && <span style={{ color: '#D1D5DB' }}>·</span>}
            {!hideStars && <span style={{ color: '#B45309' }}>★ {Number(avaliacaoMedia || 0).toFixed(1)}</span>}
          </div>
        )}

        {storeDescription && (
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '10px 4px 0' }}>{storeDescription}</p>
        )}

        {/* Atalhos de entrega (iguais ao Modelo 1) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', border: '1px solid #F0EBED', borderRadius: '12px', marginTop: '12px' }}>
          {[
            { d: 'M13 2 4 14h7l-1 8 9-12h-7z', l1: 'Pronta', l2: 'entrega' },
            { d: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM16 3v4M8 3v4M3 10h18', l1: 'Sob', l2: 'encomenda' },
            { d: 'M1 6h14v11H1zM15 10h4l3 3v4h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', l1: 'Entrega e', l2: 'retirada' },
          ].map((a, i) => (
            <div key={a.l2} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '9px 4px', borderLeft: i > 0 ? '1px solid #F0EBED' : 'none' }}>
              {iconeAtalho(a.d)}
              <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-title)', lineHeight: 1.2 }}>{a.l1}<br />{a.l2}</span>
            </div>
          ))}
        </div>

        {/* Cidade + Ver no mapa */}
        {(cidade || enderecoCompleto) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>{cidade}</span>
            {enderecoCompleto && (
              <button onClick={() => setModalEndereco(true)} style={{ fontSize: '12px', color: accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Ver no mapa
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal endereço completo */}
      {modalEndereco && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--bg-overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setModalEndereco(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '480px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            
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
                <p style={{ fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5', margin: 0 }}>{enderecoCompleto}</p>
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                <a
                  href={`https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.7rem', background: '#33CCFF', color: 'white', borderRadius: '12px', fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none' }}
                >
                  <img src="/waze.png" alt="Waze" width="20" height="20" style={{objectFit:'contain'}} />
                  Waze
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(enderecoCompleto)}`}
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
                style={{ width: '100%', padding: '0.85rem', background: 'var(--menu-hover-bg)', color: 'var(--text-primary)', border: 'none', borderRadius: '50px', fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
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
