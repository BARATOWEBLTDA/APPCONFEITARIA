/**
 * Foto de referência (11/10): reduz pra no máximo 1280 px no lado maior e devolve em JPEG (qualidade 0,8).
 * Dá erro quando o arquivo não é uma imagem que o aparelho consegue abrir.
 */
export function reduzirFoto(file: File, ladoMaximo = 1280, qualidade = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const largura = img.naturalWidth, altura = img.naturalHeight
        if (!largura || !altura) throw new Error('imagem sem tamanho')
        const escala = Math.min(1, ladoMaximo / Math.max(largura, altura))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(largura * escala))
        canvas.height = Math.max(1, Math.round(altura * escala))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem canvas')
        // fundo branco: imagem com transparência não fica preta no JPEG
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dados = canvas.toDataURL('image/jpeg', qualidade)
        if (!dados.startsWith('data:image/jpeg')) throw new Error('não gerou a imagem')
        resolve(dados)
      } catch (err) { reject(err) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('não é uma imagem')) }
    img.src = url
  })
}
