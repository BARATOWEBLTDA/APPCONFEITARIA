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
    <Star key={i} size={14} fill={i < Math.floor(rating) ? '#fbbf24' : 'none'} color={i < Math.ceil(rating) ? '#fbbf24' : '#d1d5db'} />
  ))

  return (
    <div style={{ position: 'relative', maxWidth: '560px', margin: '0 auto' }}>
      {/* Logo circular */}
      <div style={{ position: 'absolute', top: '-48px', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        {logoUrl ? (
          <div style={{
            width: '96px', height: '96px', borderRadius: '50%',
            border: `3px solid ${borderColor || '#ec4899'}`,
            padding: '3px', backgroundColor: 'white', overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
          </div>
        ) : (
          <div style={{
            width: '96px', height: '96px', borderRadius: '50%',
            border: `3px solid ${borderColor || '#ec4899'}`,
            backgroundColor: borderColor || '#ec4899',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '36px', color: 'white',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            {storeName?.charAt(0) || '🧁'}
          </div>
        )}
      </div>

      {/* Card info */}
      <div style={{
        backgroundColor: 'white', borderRadius: '12px',
        padding: '60px 24px 20px',
        marginTop: '-48px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        textAlign: 'center',
        position: 'relative', zIndex: 20,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: corNome || '#1f2937', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
          {storeName}
        </h1>
        {!hideStars && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '1px' }}>{renderStars(avaliacaoMedia)}</div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280' }}>{avaliacaoMedia}/5.0</span>
          </div>
        )}
        {storeDescription && (
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0, lineHeight: 1.5 }}>{storeDescription}</p>
        )}
      </div>
    </div>
  )
}
