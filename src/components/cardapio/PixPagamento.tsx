import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, PixLogo } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { avisar } from '@/components/base'
import { formatCurrency } from '@/utils/helpers'
import { codigoPix, valorDoSinal, type PixLoja } from '@/lib/pix'
import './pixPagamento.css'

/**
 * Pagar com Pix (20/10). Aparece depois que o pedido foi criado, quando a loja recebe Pix pelo cardápio.
 * QR Code e "copia e cola" feitos aqui no navegador (sem intermediário). "Já paguei" avisa a loja
 * (o pedido fica "Pix a conferir"); a confeiteira confere no banco e confirma em Pedidos.
 */
type Props = {
  pix: PixLoja
  pedidoId: string
  numero: number
  total: number
  loja: string
  cor: string
  /** "entrega" ou "retirada" (pro "Falta R$ X na entrega") */
  quando: string
  aoPagar: (info: { tipo: 'sinal' | 'total'; valor: number }) => void
  aoDepois: () => void
}

export function PixPagamento({ pix, pedidoId, numero, total, loja, cor, quando, aoPagar, aoDepois }: Props) {
  const sinal = valorDoSinal(total, pix.pct)
  const [tipo, setTipo] = useState<'sinal' | 'total'>(pix.modo === 'total' ? 'total' : 'sinal')
  const valor = tipo === 'sinal' ? sinal : total
  const codigo = useMemo(() => codigoPix({ chave: pix.chave, nome: pix.nome, cidade: pix.cidade, valor, identificador: numero ? `PED${numero}` : '' }), [pix, valor, numero])
  const [qr, setQr] = useState('')
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(codigo, { width: 440, margin: 1, color: { dark: '#2C1219', light: '#FFFFFF' } }).then(u => { if (vivo) setQr(u) }, () => { if (vivo) setQr('') })
    return () => { vivo = false }
  }, [codigo])
  useEffect(() => { setCopiado(false) }, [codigo])

  const copiar = async () => {
    try { await navigator.clipboard.writeText(codigo); setCopiado(true); avisar('Código Pix copiado. Cole no app do seu banco.', { tipo: 'ok' }) }
    catch { avisar('Não deu pra copiar. Segure o código e copie.', { tipo: 'erro' }) }
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
      avisar('Não deu pra avisar a loja. Confira a internet e toque de novo.', { tipo: 'erro' })
    } finally { setEnviando(false) }
  }

  return (
    <div className="px">
      <div className="px-in">
        <span className="px-ic" aria-hidden="true"><PixLogo size={30} weight="fill" /></span>
        <h2>Pague com Pix</h2>
        <p className="px-sub">{numero > 0 ? <>Pedido <b>#{numero}</b> · </> : null}{loja}</p>

        {pix.modo === 'escolha' && (
          <div className="px-seg" role="radiogroup" aria-label="Quanto vai pagar agora">
            <button type="button" role="radio" aria-checked={tipo === 'sinal'} style={tipo === 'sinal' ? { borderColor: cor } : undefined} onClick={() => setTipo('sinal')}>
              <small>Sinal ({pix.pct}%)</small><b>{formatCurrency(sinal)}</b>
            </button>
            <button type="button" role="radio" aria-checked={tipo === 'total'} style={tipo === 'total' ? { borderColor: cor } : undefined} onClick={() => setTipo('total')}>
              <small>Tudo</small><b>{formatCurrency(total)}</b>
            </button>
          </div>
        )}

        <div className="px-valor">
          <small>{tipo === 'sinal' ? `Sinal de ${pix.pct}%` : 'Valor do Pix'}</small>
          <b>{formatCurrency(valor)}</b>
          {tipo === 'sinal' && <span>Falta {formatCurrency(Math.round((total - sinal) * 100) / 100)} na {quando}</span>}
        </div>

        <div className="px-qr">{qr ? <img src={qr} alt="QR Code do Pix" width={220} height={220} /> : <span className="ui-gira" aria-label="Gerando o QR Code" />}</div>

        <div className="px-cc">
          <small>Pix copia e cola</small>
          <div className="px-cc-l">
            <code>{codigo}</code>
            <button type="button" onClick={copiar} style={{ color: cor }}>{copiado ? <Check size={18} weight="bold" /> : <Copy size={18} weight="bold" />}{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </div>
        <p className="px-dica">Abra o app do banco, escolha Pix e leia o QR Code ou cole o código. Quem recebe: <b>{pix.nome}</b></p>

        <button type="button" className="sc-bt-pri cheio px-pago" style={{ background: cor }} disabled={enviando} onClick={jaPaguei}>
          <span>{enviando ? 'Avisando a loja…' : 'Já paguei'}</span>
        </button>
        <button type="button" className="px-depois" onClick={aoDepois}>Pagar depois, pelo WhatsApp</button>
      </div>
    </div>
  )
}
