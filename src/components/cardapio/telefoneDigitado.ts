import { digitosTelefone } from '@/lib/telefone'

/**
 * Dígitos do telefone enquanto a pessoa digita ou cola (10/10), no máximo 11 (DDD + número).
 * Tira o +55 de número colado ou preenchido pelo navegador ("+55 41 99999-8888", "5541999998888"),
 * que antes era cortado nos 11 primeiros dígitos e virava "(55) 41999-9988".
 * Cuidado com o DDD 55: "55999991234" mais um dígito a mais (12 dígitos, sem "+") NÃO é código do país,
 * então fica como sempre foi (o dígito a mais é ignorado).
 */
export function digitosAoDigitar(v: string | null | undefined): string {
  const texto = String(v ?? '')
  const cru = texto.replace(/\D/g, '')
  const duvida = cru.length === 12 && cru.startsWith('559') && !/^\s*\+/.test(texto) // "55 41 3333-4444" (fixo com código do país) não entra aqui
  return (duvida ? cru : digitosTelefone(texto)).slice(0, 11)
}
