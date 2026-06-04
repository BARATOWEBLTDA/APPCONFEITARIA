interface BannerAdProps {
  bannerUrl?: string
}

export function BannerAd({ bannerUrl }: BannerAdProps) {
  if (!bannerUrl || bannerUrl.trim() === '') return null

  return (
    <div style={{ margin: '0 1rem 1rem' }}>
      <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <img
          src={bannerUrl}
          alt="Banner"
          style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      </div>
    </div>
  )
}
