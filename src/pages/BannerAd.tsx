interface BannerAdProps {
  bannerUrl?: string
}

export function BannerAd({ bannerUrl }: BannerAdProps) {
  if (!bannerUrl || bannerUrl.trim() === '') return null

  return (
    <div style={{ width: '100%', marginBottom: '1rem' }}>
      <img
        src={bannerUrl}
        alt="Banner"
        style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
        onError={(e) => { e.currentTarget.style.display = 'none' }}
      />
    </div>
  )
}
