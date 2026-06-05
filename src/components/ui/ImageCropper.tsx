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
    <>
      {/* Overlay */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', padding: '8px 14px', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <span style={{ color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
            {cropShape === 'round' ? 'Ajustar logo' : 'Ajustar foto'}
          </span>
          <button onClick={handleDone} disabled={loading} style={{ background: '#ec4899', border: 'none', borderRadius: '8px', padding: '8px 14px', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '...' : 'Confirmar'}
          </button>
        </div>

        {/* Cropper */}
        <div style={{ flex: 1, position: 'relative' }}>
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
              containerStyle: { background: 'transparent' },
              cropAreaStyle: { border: '3px solid #ec4899', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }
            }}
          />
        </div>

        {/* Zoom slider */}
        <div style={{ padding: '16px 32px 32px', flexShrink: 0 }}>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', textAlign: 'center', margin: '0 0 8px', fontFamily: 'Inter, sans-serif' }}>Pinça ou use o slider para zoom</p>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#ec4899' }}
          />
        </div>
      </div>
    </>
  )
}
