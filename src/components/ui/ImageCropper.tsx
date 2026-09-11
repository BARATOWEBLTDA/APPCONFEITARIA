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
    <div className="ic-overlay">
      <div className="ic-modal">
        {/* Header: só o X */}
        <div className="ic-hdr">
          <button className="ic-close" onClick={onCancel} aria-label="Fechar">✕</button>
        </div>

        {/* Área do crop */}
        <div className="ic-crop-area">
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

        {/* Slider (limpo, sem ícones) + texto embaixo */}
        <div className="ic-slider-wrap">
          <div className="ic-slider-track-wrap">
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="ic-slider"
              aria-label="Zoom"
              style={{ ['--fill' as any]: `${((zoom - 1) / 2 * 100).toFixed(1)}%` }}
            />
          </div>
          <p className="ic-hint">Ajuste a melhor posição para sua foto</p>
        </div>

        {/* Botão confirmar 3D rosa */}
        <div className="ic-footer">
          <button className="ic-btn-confirm" onClick={handleDone} disabled={loading}>
            {loading ? "..." : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}><polyline points="20 6 9 17 4 12"/></svg>
                Confirmar
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .ic-overlay {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(45, 31, 38, 0.7);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          font-family: var(--font-base) !important;
          animation: icOvIn 0.2s ease;
        }
        @keyframes icOvIn { from { opacity: 0; } to { opacity: 1; } }
        .ic-modal {
          background: #fff;
          border-radius: 20px;
          width: 100%;
          max-width: 440px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          display: flex; flex-direction: column;
          animation: icModalIn 0.25s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes icModalIn {
          from { opacity: 0; transform: scale(0.94); }
          to   { opacity: 1; transform: scale(1); }
        }
        .ic-modal, .ic-modal * { font-family: var(--font-base) !important; }

        /* Header discreto — só X */
        .ic-hdr {
          display: flex; justify-content: flex-end;
          padding: 12px 12px 0;
        }
        .ic-close {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: #F5EEF0;
          color: #6B5D64;
          border: none;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: var(--font-base) !important;
        }
        .ic-close:hover {
          background: #2D1F26;
          color: #fff;
        }

        /* Área do crop */
        .ic-crop-area {
          position: relative;
          width: calc(100% - 40px);
          margin: 12px 20px 0;
          height: 300px;
          background: #1a1a1a;
          border-radius: 10px;
          overflow: hidden;
        }

        /* Slider */
        .ic-slider-wrap {
          padding: 20px 20px 8px;
          display: flex; flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .ic-slider-track-wrap {
          width: 60%;
        }
        .ic-slider {
          width: 100%;
          height: 8px;
          background: #F0EBED;
          border-radius: 999px;
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
          outline: none;
        }
        /* Preenchimento gradient rosa (Chrome/Safari) */
        .ic-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #E85A8C 0%, #E85A8C var(--fill, 45%), #F0EBED var(--fill, 45%), #F0EBED 100%);
        }
        .ic-slider::-moz-range-track {
          height: 8px;
          border-radius: 999px;
          background: #F0EBED;
        }
        .ic-slider::-moz-range-progress {
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(90deg, #E85A8C, #C33A6E);
        }
        /* Thumb branco com borda rosa */
        .ic-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px; height: 20px;
          background: #fff;
          border: 3px solid #E85A8C;
          border-radius: 50%;
          box-shadow: 0 3px 10px rgba(232, 90, 140, 0.4);
          cursor: pointer;
          margin-top: -6px;
          transition: transform 0.12s ease;
        }
        .ic-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .ic-slider::-moz-range-thumb {
          width: 20px; height: 20px;
          background: #fff;
          border: 3px solid #E85A8C;
          border-radius: 50%;
          box-shadow: 0 3px 10px rgba(232, 90, 140, 0.4);
          cursor: pointer;
        }
        .ic-hint {
          font-size: 12px;
          color: #6B5D64;
          font-weight: 500;
          font-style: italic;
          margin: 0;
          text-align: center;
        }

        /* Footer com botão confirmar 3D */
        .ic-footer {
          display: flex;
          padding: 12px 20px 20px;
          padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
        }
        .ic-btn-confirm {
          flex: 1;
          padding: 14px;
          background: #E85A8C;
          color: #fff;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          box-shadow: 0 4px 0 #C33A6E;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-base) !important;
          transition: transform 0.08s ease, box-shadow 0.08s ease;
        }
        .ic-btn-confirm:hover:not(:disabled) { filter: brightness(1.05); }
        .ic-btn-confirm:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 0 0 #C33A6E;
        }
        .ic-btn-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
