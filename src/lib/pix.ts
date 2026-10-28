/**
 * Pix "copia e cola" (BR Code estático do Banco Central), feito no navegador, sem intermediário (20/10).
 * O mesmo texto vira o QR Code. Qualquer app de banco lê.
 *   00 formato · 26 conta (br.gov.bcb.pix + chave) · 52 categoria · 53 moeda (986 = real) · 54 valor
 *   58 país · 59 nome · 60 cidade · 62 identificador · 63 conferência (CRC16)
 */

/** Pix da loja pro cardápio (só vem quando a loja ligou e preencheu tudo) */
export type PixLoja = { chave: string; nome: string; cidade: string; modo: 'sinal' | 'total' | 'escolha'; pct: number; retirada?: boolean }

export type TipoChave = 'cpf' | 'celular' | 'email' | 'aleatoria'

const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Chave do jeito que o Banco Central espera: celular com +55, CPF/CNPJ só números, e-mail minúsculo. */
export function normalizarChave(chave: string, tipo: TipoChave): string {
  const c = String(chave || '').trim()
  if (tipo === 'email') return c.toLowerCase()
  if (tipo === 'aleatoria') return c.toLowerCase()
  const d = c.replace(/\D/g, '')
  if (tipo === 'celular') return d ? `+55${d.replace(/^55(?=\d{10,11}$)/, '')}` : ''
  return d
}

/** Adivinha o tipo de uma chave já salva (pra mostrar na tela de configuração). */
export function tipoDaChave(chave: string): TipoChave {
  const c = String(chave || '').trim()
  if (c.includes('@')) return 'email'
  if (/^\+55\d{10,11}$/.test(c)) return 'celular'
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'aleatoria'
  return 'cpf'
}

/** Dígitos verificadores do CPF */
export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
/** Dígitos verificadores do CNPJ */
export function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false
  const dv = (n: number) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = pesos.reduce((t, p, i) => t + Number(d[i]) * p, 0); const r = s % 11; return r < 2 ? 0 : 11 - r }
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13])
}

/** A chave está no formato certo? Devolve o problema em palavras (ou '' se estiver certa). */
export function problemaNaChave(chave: string, tipo: TipoChave): string {
  const c = normalizarChave(chave, tipo)
  if (!c) return 'Escreva a chave Pix'
  if (tipo === 'cpf' && c.length !== 11 && c.length !== 14) return 'CPF tem 11 números e CNPJ tem 14'
  // (27/10) confere os dígitos: o celular (11 números) passava como CPF e o Pix saía com uma chave que não existe
  if (tipo === 'cpf' && c.length === 11 && !cpfValido(c)) return 'CPF inválido. Se for celular, use a aba Celular'
  if (tipo === 'cpf' && c.length === 14 && !cnpjValido(c)) return 'CNPJ inválido. Confira os números'
  if (tipo === 'celular' && !/^\+55\d{10,11}$/.test(c)) return 'Coloque o celular com DDD'
  if (tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return 'Confira o e-mail'
  if (tipo === 'aleatoria' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c)) return 'A chave aleatória tem 32 letras e números, com tracinhos'
  return ''
}

/** Valor do sinal em centavos exatos (o banco faz a mesma conta). */
export function valorDoSinal(total: number, pct: number): number {
  const centavos = Math.round((Number(total) || 0) * 100)
  const p = Math.min(90, Math.max(10, Math.round(Number(pct) || 50)))
  return Math.round(centavos * p / 100) / 100
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`

function crc16(texto: string): string {
  let crc = 0xffff
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Texto do Pix copia e cola. */
export function codigoPix(o: { chave: string; nome: string; cidade: string; valor: number; identificador?: string }): string {
  const limpa = (s: string, max: number) => semAcento(String(s || '')).replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max)
  const nome = limpa(o.nome, 25) || 'LOJA'
  const cidade = limpa(o.cidade, 15) || 'BRASIL'
  const txid = semAcento(String(o.identificador || '')).replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', o.chave)
  let p = campo('00', '01')
    + campo('26', conta)
    + campo('52', '0000')
    + campo('53', '986')
    + (o.valor > 0 ? campo('54', (Math.round(o.valor * 100) / 100).toFixed(2)) : '')
    + campo('58', 'BR')
    + campo('59', nome)
    + campo('60', cidade)
    + campo('62', campo('05', txid))
    + '6304'
  p += crc16(p)
  return p
}
