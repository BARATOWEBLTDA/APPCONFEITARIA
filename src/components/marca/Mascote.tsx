import { useEffect, useState } from 'react'

/**
 * Peças da marca (03/10) — as imagens ficam em public/marca/.
 *   <Mascote pose="acenando" />  → /marca/acenando.png
 *   <NomeDoonly cor="branco" />  → /marca/texto.png (pintado de branco pelo CSS)
 * Pose nova = colocar o arquivo na pasta com o nome da pose. Se ainda não existir, mostra a "acenando".
 */
export type PoseMascote = 'acenando' | 'comemorando' | 'chave' | 'preocupado' | 'lupa' | 'joinha'

export function Mascote({ pose = 'acenando', className = '', alt = '' }: { pose?: PoseMascote; className?: string; alt?: string }) {
  const [src, setSrc] = useState(`/marca/${pose}.png`)
  useEffect(() => { setSrc(`/marca/${pose}.png`) }, [pose])
  return (
    <img src={src} alt={alt} aria-hidden={alt ? undefined : true} className={`mascote-doonly ${className}`} draggable={false}
      onError={() => { if (!src.endsWith('/acenando.png')) setSrc('/marca/acenando.png') }} />
  )
}

export function NomeDoonly({ cor = 'rosa', className = '' }: { cor?: 'rosa' | 'branco'; className?: string }) {
  return (
    <img src="/marca/texto.png" alt="Doonly" className={`nome-doonly ${className}`} draggable={false}
      style={cor === 'branco' ? { filter: 'brightness(0) invert(1)' } : undefined} />
  )
}
