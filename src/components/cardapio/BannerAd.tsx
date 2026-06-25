import { useState, useEffect, useRef } from 'react'

interface BannerAdProps {
  bannerUrl?: string
  banner1Url?: string
  banner2Url?: string
  banner3Url?: string
  isPro?: boolean
}

export function BannerAd({ bannerUrl, banner1Url, banner2Url, banner3Url, isPro }: BannerAdProps) {
  const banners = isPro
    ? [bannerUrl, banner1Url, banner2Url, banner3Url].filter(Boolean) as string[]
    : [bannerUrl].filter(Boolean) as string[]

  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (banners.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % banners.length)
    }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [banners.length])

  if (banners.length === 0) return null

  if (banners.length === 1) {
    return (
      <div style={{ padding: '0 16px', marginBottom: '8px' }}>
        <img
          src={banners[0]}
          alt="Banner"
          style={{ width: '100%', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: '12px' }}
          onError={e => { e.currentTarget.style.display = 'none' }}
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px', marginBottom: '8px' }}>
      {/* Wrapper com overflow hidden e border radius */}
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
        {/* Slides */}
        <div style={{ display: 'flex', transition: 'transform 0.5s ease', transform: `translateX(-${current * 100}%)` }}>
          {banners.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Banner ${i + 1}`}
              style={{ width: '100%', flexShrink: 0, height: 'auto', objectFit: 'contain', display: 'block' }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          ))}
        </div>

        {/* Pontos indicadores */}
        <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i === current ? '#ec4899' : 'rgba(255,255,255,0.7)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all var(--dur-slow) var(--ease-out)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
