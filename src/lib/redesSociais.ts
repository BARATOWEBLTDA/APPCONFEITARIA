/**
 * Instagram e Facebook da loja (4.25). A confeiteira pode digitar "@doceformiga", "doceformiga"
 * ou colar o link inteiro: aqui vira sempre o mesmo formato.
 *   Instagram: guarda só o usuário, sem @ ("doceformiga")
 *   Facebook:  guarda o que vem depois de facebook.com/ ("doceformiga" ou "profile.php?id=123")
 */

export function limparInstagram(v: string | null | undefined): string {
  let s = String(v || '').trim()
  const m = s.match(/instagram\.com\/([^/?#\s]+)/i)
  if (m) s = m[1]
  s = s.replace(/^@+/, '').replace(/\s+/g, '')
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s.toLowerCase() : ''
}

export function limparFacebook(v: string | null | undefined): string {
  let s = String(v || '').trim()
  const m = s.match(/(?:facebook|fb)\.com\/(.+)$/i)
  if (m) s = m[1]
  s = s.replace(/^@+/, '').replace(/[#].*$/, '').replace(/\/+$/, '').replace(/\s+/g, '')
  if (/^profile\.php\?id=\d+/i.test(s)) return s.replace(/&.*$/, '')
  s = s.replace(/\?.*$/, '')
  return /^[A-Za-z0-9.\-_/]{1,80}$/.test(s) ? s : ''
}

export const linkInstagram = (v?: string | null) => { const u = limparInstagram(v); return u ? `https://instagram.com/${u}` : '' }
export const linkFacebook = (v?: string | null) => { const u = limparFacebook(v); return u ? `https://facebook.com/${u}` : '' }
export const arrobaInstagram = (v?: string | null) => { const u = limparInstagram(v); return u ? `@${u}` : '' }
export const nomeFacebook = (v?: string | null) => (limparFacebook(v) ? 'Facebook' : '')
