import { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { MagnifyingGlassMinus, MagnifyingGlassPlus, X } from '@phosphor-icons/react'
import { Botao, BotaoIcone, avisar } from '@/components/base'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import './imageCropper.css'

/**
 * Recortar foto (08/10 · 3.20, no padrão do guia). Usada na foto do perfil, na logo da loja e na foto do produto.
 * Título e dica, foto maior com moldura branca, zoom com botões de 44px dos lados, "Cancelar" e "Usar esta foto".
 * No celular sobe de baixo (como as janelas do app); no tablet e no computador fica no centro.
 * Esc e o "voltar" do Android fecham sem salvar. O recorte e a qualidade da foto salva são os mesmos de antes.
 */

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
  const caixa = useRef<HTMLDivElement>(null)
  const cancelar = () => { if (!loading) onCancel() }
  useSobreposicao(true, cancelar, caixa)

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const mudarZoom = (d: number) => setZoom(z => Math.min(3, Math.max(1, Math.round((z + d) * 100) / 100)))

  const handleDone = async () => {
    if (!croppedAreaPixels || loading) return
    setLoading(true)
    try {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels)
      onCropDone(blob)
    } catch (e) {
      console.error(e)
      avisar('Não deu pra usar essa foto. Tente outra.', { tipo: 'erro' })
    }
    setLoading(false)
  }

  return (
    <div className="rf-veu" onClick={e => { if (e.target === e.currentTarget) cancelar() }}>
      <div className="rf" ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="rf-titulo">
        <div className="rf-topo">
          <div>
            <h2 id="rf-titulo">{cropShape === 'round' ? 'Ajustar a foto' : 'Ajustar a foto do produto'}</h2>
            <p>Arraste pra posicionar. Aproxime com os dedos ou com a barra.</p>
          </div>
          <BotaoIcone rotulo="Fechar sem salvar" variante="limpo" onClick={cancelar} disabled={loading}><X size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="rf-area">
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
              containerStyle: { background: '#2C1219' },
              cropAreaStyle: { border: '2px solid #fff', boxShadow: '0 0 0 9999px rgba(44, 18, 25, .6)' },
            }}
          />
        </div>

        <div className="rf-zoom">
          <BotaoIcone rotulo="Afastar" onClick={() => mudarZoom(-0.2)} disabled={zoom <= 1}><MagnifyingGlassMinus size={20} weight="bold" /></BotaoIcone>
          <input
            type="range" min={1} max={3} step={0.05} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            aria-label="Aproximar a foto"
            style={{ ['--fill' as any]: `${((zoom - 1) / 2 * 100).toFixed(1)}%` }}
          />
          <BotaoIcone rotulo="Aproximar" onClick={() => mudarZoom(0.2)} disabled={zoom >= 3}><MagnifyingGlassPlus size={20} weight="bold" /></BotaoIcone>
        </div>

        <div className="rf-pe">
          <Botao variante="secundario" onClick={cancelar} disabled={loading}>Cancelar</Botao>
          <Botao onClick={handleDone} carregando={loading}>Usar esta foto</Botao>
        </div>
      </div>
    </div>
  )
}
