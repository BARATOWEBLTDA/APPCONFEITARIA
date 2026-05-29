export function BannerAd({ bannerUrl }: { bannerUrl?: string }) {
  if (!bannerUrl) return null
  return (
    <div className="mx-4 mb-4">
      <img src={bannerUrl} alt="Banner" className="w-full h-auto rounded-lg" />
    </div>
  )
}
