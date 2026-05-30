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

export function DesktopLogo({ logoUrl, borderColor, storeName, storeDescription, corNome, avaliacaoMedia = 4.9, hideStars = false }: LogoProps) {
  const renderStars = (rating: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={20} fill={i < Math.floor(rating) ? '#fbbf24' : 'none'} color={i < Math.ceil(rating) ? '#fbbf24' : '#d1d5db'} />
  ))

  return (
    <div className="relative">
      <div style={{ position: 'absolute', top: '-70px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        {logoUrl ? (
          <div style={{ width: '220px', height: '220px', borderRadius: '50%', border: `4px solid ${borderColor || '#ec4899'}`, padding: '4px', backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '4px solid white', overflow: 'hidden' }}>
              <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
            </div>
          </div>
        ) : (
          <div style={{ width: '220px', height: '220px', borderRadius: '50%', border: `4px solid ${borderColor || '#ec4899'}`, backgroundColor: borderColor || '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '72px', color: 'white' }}>
            {storeName?.charAt(0) || '🧁'}
          </div>
        )}
      </div>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '8px', paddingTop: '140px', margin: '0 auto', marginTop: '-140px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 20, position: 'relative', maxWidth: '700px' }}>
        <div style={{ textAlign: 'center', marginTop: '48px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 700, color: corNome || '#1f2937', marginBottom: '12px' }}>{storeName}</h1>
          {!hideStars && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>{renderStars(avaliacaoMedia)}</div>
              <span style={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>{avaliacaoMedia}/5.0</span>
            </div>
          )}
          <p style={{ fontSize: '16px', color: '#6b7280' }}>{storeDescription}</p>
        </div>
      </div>
    </div>
  )
}
