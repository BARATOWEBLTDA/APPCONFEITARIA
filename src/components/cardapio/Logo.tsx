import { Star } from 'lucide-react'

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

export function Logo({ logoUrl, borderColor, storeName, storeDescription, corNome, avaliacaoMedia = 4.9, hideStars = false }: LogoProps) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} size={14} fill={i < Math.floor(rating) ? '#fbbf24' : 'none'} color={i < Math.ceil(rating) ? '#fbbf24' : '#d1d5db'} />
    ))
  }

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
          <p style={{ fontSize: '14px', color: '#6b7280' }}>{storeDescription}</p>
        </div>
      </div>
    </div>
  )
}
