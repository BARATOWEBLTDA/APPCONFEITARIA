import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'

interface Props {
  imageSrc: string
  aspect?: number
  cropShape?: 'rect' | 'round'
  onCancel: () => void
  onCropDone: (croppedBlob: Blob) => void
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.setAttribute('crossOrigin', 'anonymous')
    img.src = url
  })

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<Blob> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.92))
}

export function ImageCropper({ imageSrc, aspect = 1, cropShape = 'round', onCancel, onCropDone }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleDone = async () => {
    setLoading(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropDone(blob)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '380px',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
          <button onClick={onCancel} style={{ background: 'var(--menu-hover-bg)', border: 'none', borderRadius: '8px', padding: '7px 14px', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <span style={{ fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-title)' }}>
            {cropShape === 'round' ? 'Ajustar logo' : 'Ajustar foto'}
          </span>
          <button onClick={handleDone} disabled={loading} style={{ background: '#ec4899', border: 'none', borderRadius: '8px', padding: '7px 14px', color: 'white', fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : 'Confirmar'}
          </button>
        </div>

        {/* Área do crop */}
        <div style={{ position: 'relative', width: '100%', height: '300px', background: '#1a1a1a' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            style={{
              containerStyle: { background: '#1a1a1a' },
              cropAreaStyle: {
                border: `2px solid #ec4899`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              },
            }}
          />
        </div>

        {/* Slider */}
        <div style={{ padding: '10px 20px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: '#ec4899', height: '3px', cursor: 'pointer' }} />
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </div>
      </div>
    </div>
  )
}
