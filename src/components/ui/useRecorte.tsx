import { useEffect, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { avisar } from '@/components/base'

/**
 * Recorte antes de enviar (09/10 · 3.53). Toda foto escolhida do celular passa pela janela "Recortar foto".
 * Uso: const recorte = useRecorte(enviar); <input type="file" onChange={recorte.escolher} />; {recorte.janela}
 * "enviar" recebe a foto já recortada (jpg).
 */
export function useRecorte(enviar: (foto: File) => void, opcoes: { aspect?: number; forma?: 'rect' | 'round' } = {}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])

  const escolher = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { avisar('Escolha uma foto (jpg ou png).', { tipo: 'erro' }); return }
    setSrc(URL.createObjectURL(f))
  }

  // Vai direto pro body: assim funciona mesmo dentro de janelas que se mexem (transform) ou partes escondidas
  const janela = src ? createPortal(
    <ImageCropper
      imageSrc={src}
      aspect={opcoes.aspect ?? 1}
      cropShape={opcoes.forma ?? 'round'}
      onCancel={() => setSrc(null)}
      onCropDone={blob => { setSrc(null); enviar(new File([blob], 'foto.jpg', { type: 'image/jpeg' })) }}
    />,
    document.body,
  ) : null

  return { escolher, janela }
}
