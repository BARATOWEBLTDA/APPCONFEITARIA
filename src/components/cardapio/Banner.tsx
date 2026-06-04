interface BannerProps {
  borderColor: string
  bannerGradient?: string
}

export function Banner({ bannerGradient }: BannerProps) {
  return (
    <div style={{
      position: 'relative',
      height: '220px',
      width: '100%',
      overflow: 'hidden',
      backgroundImage: bannerGradient || 'linear-gradient(135deg, #d11b70 0%, #ff6fae 50%, #ff9acb 100%)',
      backgroundSize: '200% 200%',
      animation: 'gradient-x 3s ease infinite'
    }} />
  )
}
