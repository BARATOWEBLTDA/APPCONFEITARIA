import { useEffect, useState } from 'react'

/**
 * Peças da marca (03/10) — as imagens ficam em public/marca/.
 *   <Mascote pose="acenando" />  → /marca/leve/acenando.webp (versão leve) ou /marca/acenando.png (original)
 *   <NomeDoonly cor="branco" />  → /marca/leve/texto.webp (pintado de branco pelo CSS)
 * Pose nova = colocar o arquivo .png na pasta com o nome da pose. Se ainda não existir, mostra a "acenando".
 * (07/10) Versões leves em public/marca/leve: os originais têm quase 1 MB cada; as leves, menos de 50 KB.
 */
export type PoseMascote = 'acenando' | 'comemorando' | 'chave' | 'preocupado' | 'lupa' | 'joinha'

const leve = (nome: string) => `/marca/leve/${nome}.webp`
const original = (nome: string) => `/marca/${nome}.png`

export function Mascote({ pose = 'acenando', className = '', alt = '' }: { pose?: PoseMascote; className?: string; alt?: string }) {
  const [src, setSrc] = useState(leve(pose))
  useEffect(() => { setSrc(leve(pose)) }, [pose])
  // ordem: versão leve da pose → original da pose → "acenando" leve → "acenando" original
  const proxima = () => {
    if (src === leve(pose) && pose !== 'acenando') setSrc(original(pose))
    else if (src === original(pose) && pose !== 'acenando') setSrc(leve('acenando'))
    else if (src === leve('acenando')) setSrc(original('acenando'))
  }
  return (
    <img src={src} alt={alt} aria-hidden={alt ? undefined : true} className={`mascote-doonly ${className}`} draggable={false} onError={proxima} />
  )
}

export function NomeDoonly({ cor = 'rosa', className = '' }: { cor?: 'rosa' | 'branco'; className?: string }) {
  const [src, setSrc] = useState(leve('texto'))
  return (
    <img src={src} alt="Doonly" className={`nome-doonly ${className}`} draggable={false}
      onError={() => { if (src !== original('texto')) setSrc(original('texto')) }}
      style={cor === 'branco' ? { filter: 'brightness(0) invert(1)' } : undefined} />
  )
}
