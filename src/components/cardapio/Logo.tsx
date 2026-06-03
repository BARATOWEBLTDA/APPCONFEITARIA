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

export function Logo({ logoUrl, borderColor, storeName, storeDescription, corNome, avaliacaoMedia = 4.9, hideStars = false, configuracoes }: LogoProps) {
  const [modalEndereco, setModalEndereco] = useState(false)

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
        <div style={{ textAlign: 'center', marginTop: '32px', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: corNome || '#1f2937', marginBottom: '8px' }}>{storeName}</h1>

          {!hideStars && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>{renderStars(avaliacaoMedia)}</div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{avaliacaoMedia}/5.0</span>
            </div>
          )}

          {storeDescription && (
            <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px', lineHeight: '1.5' }}>{storeDescription}</p>
          )}

          {/* Cidade */}
          {(mostrarCidade || mostrarCompleto) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: 500 }}>{cidade}</span>
              {mostrarCompleto && (
                <button
                  onClick={() => setModalEndereco(true)}
                  style={{ fontSize: '12px', color: borderColor || '#ec4899', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Ver endereço completo
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal endereço completo */}
      {modalEndereco && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setModalEndereco(false)}>
          <div style={{ background: 'white', borderRadius: '24px 24px 0 0', padding: '1.5rem', width: '100%', maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={borderColor || '#ec4899'} strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>Endereço</span>
            </div>
            <p style={{ fontFamily: 'Inter,sans-serif', fontSize: '0.9rem', color: '#374151', lineHeight: '1.6', marginBottom: '1.25rem' }}>{enderecoCompleto}</p>
            <button
              onClick={() => setModalEndereco(false)}
              style={{ width: '100%', padding: '0.85rem', background: borderColor || '#ec4899', color: 'white', border: 'none', borderRadius: '50px', fontFamily: 'Inter,sans-serif', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
