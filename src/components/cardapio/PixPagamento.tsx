import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, PixLogo } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { avisar } from '@/components/base'
import { formatCurrency } from '@/utils/helpers'
import { codigoPix, tipoDaChave, valorDoSinal, type PixLoja } from '@/lib/pix'
import { SeloVerificado } from './SeloVerificado'
import './pixPagamento.css'

/**
 * Pagar com Pix (20/10 · 21/10 com a cara da loja).
 * Aparece depois que o pedido foi criado. Sinal ou tudo já foi escolhido na Finalizar.
 * No celular o principal é "Copiar código Pix" (não dá pra ler o QR da própria tela); o QR fica em "Mostrar QR Code".
 * No computador o QR já vem aberto. "Já paguei" avisa a loja (o pedido fica "Pix a conferir").
 */
type Props = {
  pix: PixLoja
  pedidoId: string
  numero: number
  total: number
  tipo: 'sinal' | 'total'
  loja: string
  cor: string
  corTopo?: string
  logoUrl?: string | null
  verificada?: boolean
  /** "entrega" ou "retirada" (pro "Falta R$ X na retirada") */
  quando: string
  aoPagar: (info: { tipo: 'sinal' | 'total'; valor: number }) => void
  aoDepois: () => void
}

const NOME_CHAVE = { cpf: 'CPF/CNPJ', celular: 'celular', email: 'e-mail', aleatoria: 'aleatória' } as const

export function PixPagamento({ pix, pedidoId, numero, total, tipo, loja, cor, corTopo, logoUrl, verificada, quando, aoPagar, aoDepois }: Props) {
  const sinal = valorDoSinal(total, pix.pct)
  const valor = tipo === 'sinal' ? sinal : total
  const resto = Math.round((total - sinal) * 100) / 100
  const codigo = useMemo(() => codigoPix({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valor, identificador: numero ? `PED${numero}` : '' }), [pix, valor, numero])
  const [qr, setQr] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    // correção alta (H): o símbolo do Pix no meio não atrapalha a leitura
    QRCode.toDataURL(codigo, { width: 440, margin: 1, errorCorrectionLevel: 'H', color: { dark: '#2C1219', light: '#FFFFFF' } }).then(u => { if (vivo) setQr(u) }, () => { if (vivo) setQr('') })
    return () => { vivo = false }
  }, [codigo])

  // plano B: navegador de dentro do Instagram/Facebook às vezes bloqueia a cópia moderna
  const copiarTexto = async (t: string) => {
    try { await navigator.clipboard.writeText(t); return true } catch { /* tenta o jeito antigo */ }
    try {
      const ta = document.createElement('textarea')
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length)
      const ok = document.execCommand('copy'); ta.remove(); return ok
    } catch { return false }
  }
  const copiar = async () => {
    if (await copiarTexto(codigo)) { setCopiado(true); avisar('Código copiado. Cole no app do seu banco.', { tipo: 'ok' }) }
    else { avisar('Não deu para copiar. Segure o código e copie, ou use o QR Code.', { tipo: 'erro' }) }
  }

  const jaPaguei = async () => {
    if (enviando) return
    setEnviando(true)
    try {
      const { data, error } = await supabase.rpc('cardapio_pix_informado', { p_pedido: pedidoId, p_tipo: tipo })
      if (error) throw error
      const r: any = data
      aoPagar({ tipo: r?.tipo === 'sinal' ? 'sinal' : r?.tipo === 'total' ? 'total' : tipo, valor: Number(r?.valor) || valor })
    } catch {
      avisar('Não deu para avisar a loja. Confira a internet e toque de novo.', { tipo: 'erro' })
    } finally { setEnviando(false) }
  }

  return (
    <div className="px-tela" style={{ '--px-cor': cor } as CSSProperties}>
      <div className="sc-topo sc-topo--loja" style={{ background: corTopo || '#BF6B84' }}>
        <span />
        <span className="sc-topo-loja">
          <span className="sc-topo-logo" style={{ borderColor: cor }}>{logoUrl ? <img src={logoUrl} alt="" /> : <b>{(loja || 'D').charAt(0).toUpperCase()}</b>}</span>
          <span><b>Pagamento</b><small className="sc-topo-nome">{loja}{verificada && <SeloVerificado tamanho={14} />}</small></span>
        </span>
        <span />
        <span className="sc-topo-curva" aria-hidden="true" />
      </div>

      <div className="px">
        <section className="px-card px-valor">
          {numero > 0 && <small>Pedido #{numero}</small>}
          <span>{tipo === 'sinal' ? `Sinal de ${pix.pct}% no Pix` : 'Total no Pix'}</span>
          <b>{formatCurrency(valor)}</b>
          {tipo === 'sinal' && resto > 0.009 && <em>Falta {formatCurrency(resto)} na {quando}</em>}
        </section>

        {/* (21/10) QR sempre aberto (fechado ficava escondido); embaixo, o copia e cola */}
        <section className="px-card px-pagar">
          <div className="px-qr">
            {qr ? <img src={qr} alt="QR Code do Pix" width={190} height={190} /> : <span className="ui-gira" aria-label="Gerando o QR Code" />}
            {qr && <span className="px-qr-logo" aria-hidden="true"><PixLogo size={22} weight="fill" /></span>}
          </div>
          <small className="px-qr-dica">Leia o QR Code com o app do banco</small>
          <span className="px-ou" aria-hidden="true">ou</span>
          <button type="button" className={`px-copiar${copiado ? ' ok' : ''}`} onClick={copiar}>
            {copiado ? <Check size={20} weight="bold" /> : <Copy size={20} weight="bold" />}{copiado ? 'Código copiado' : 'Copiar código Pix'}
          </button>
          <code className="px-cod">{codigo}</code>
          <ol className="px-passos">
            <li><i>1</i><span>Copie o código Pix</span></li>
            <li><i>2</i><span>No banco, use <b>Pix copia e cola</b></span></li>
            <li><i>3</i><span>Volte aqui e aperte <b>Já paguei</b></span></li>
          </ol>
        </section>

        <p className="px-para"><span>Para</span><b>{pix.nome}</b><small>Chave {NOME_CHAVE[tipoDaChave(pix.chave)]}</small></p>
      </div>

      <footer className="sc-pe px-pe">
        <button type="button" className="sc-bt-pri cheio px-pago" style={{ background: cor }} disabled={enviando} onClick={jaPaguei}>
          <span>{enviando ? 'Avisando a loja…' : 'Já paguei'}</span>
        </button>
        <button type="button" className="px-depois" onClick={aoDepois}>Pagar depois, pelo WhatsApp</button>
      </footer>
    </div>
  )
}
