import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { textoCardapio } from '@/lib/compartilharCardapio'
import { Copy, Check, Eye, QrCode } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { useProfile, getCardapioUrl, fotoDaLoja } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { avisar } from '@/components/base'
import { useLojaPronta } from '@/lib/primeirosPassos'
import { marcarCompartilhado } from '@/lib/primeirosPassos'
import './loja.css'

type Prod = { id: string; nome: string; preco_normal: number | null; imagem_url: string | null }
type PerfilCor = { banner_topo_url?: string | null; cor_botao?: string | null; cor_navbar?: string | null }
const real = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const primeira = (u?: string | null) => String(u || '').split(',')[0].trim()

/** Seu link de vendas · no Início do computador.
 *  (6.120) Mesmo desenho do cartão do celular (marrom, a loja em cima, "Mandar no WhatsApp" grande, Copiar, Ver e QR Code)
 *  e, do lado, um celular com o cardápio dela de verdade (foto do topo, logo e 2 produtos): ela vê o que o cliente recebe. */
export function LinkDeVendas() {
  const { profile } = useProfile()
  const [copiado, setCopiado] = useState(false)
  const [qr, setQr] = useState('')
  const [prods, setProds] = useState<Prod[]>([])
  const link = getCardapioUrl(profile)
  // (13/10) conta nova: o link só aparece quando o cardápio tem o que mostrar (antes abria um cardápio vazio)
  const pronta = useLojaPronta(profile?.id)

  useEffect(() => {
    if (!link) return
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#2C1219', light: '#FFFFFF' } }).then(setQr, () => setQr(''))
  }, [link])
  useEffect(() => {
    if (!profile?.id) return
    let vivo = true
    supabase.from('produtos').select('id, nome, preco_normal, imagem_url').eq('user_id', profile.id).eq('disponivel', true)
      .order('destaque', { ascending: false }).limit(2)
      .then(({ data }) => { if (vivo) setProds((data as Prod[] | null) ?? []) }, () => {})
    return () => { vivo = false }
  }, [profile?.id])

  if (!profile?.id || !link || pronta === false) return null

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu para copiar. Selecione o link para copiar.', { tipo: 'erro' }) }
  }
  const baixarQr = () => {
    if (!qr) return
    const a = document.createElement('a'); a.href = qr; a.download = `qrcode-cardapio-${profile?.codigo_publico || 'doonly'}.png`; a.click()
  }

  const zap = `https://wa.me/?text=${encodeURIComponent(textoCardapio(link, profile?.nome_loja))}` // (6.82) o mesmo texto do Compartilhar
  const nome = (profile.nome_loja || 'Minha loja').trim()
  const iniciais = nome.split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
  const foto = fotoDaLoja(profile)
  const pc = profile as typeof profile & PerfilCor
  const capa = primeira(pc.banner_topo_url)
  const cor = pc.cor_botao || '#E85A8C'
  const linkCurto = link.replace(/^https?:\/\/(www\.)?/, '')

  return (
    <section className="ldv" aria-label="Seu cardápio">
      <div className="ldv-esq">
        <div className="ldv-loja">
          <span className="ldv-logo" aria-hidden="true">{foto ? <img src={foto} alt="" /> : iniciais}</span>
          <span className="ldv-nome">
            <b>{nome}</b>
            <small><i aria-hidden="true" />No ar · <span title={link}>{linkCurto}</span></small>
          </span>
        </div>
        <a className="ldv-zap" href={zap} target="_blank" rel="noopener noreferrer" onClick={() => marcarCompartilhado(profile.id)}>
          <IconeWhatsApp size={20} />Mandar no WhatsApp
        </a>
        <div className="ldv-bts">
          <button type="button" className="ldv-b" onClick={copiar}>{copiado ? <Check size={17} weight="bold" aria-hidden="true" /> : <Copy size={17} weight="bold" aria-hidden="true" />}{copiado ? 'Copiado' : <><span className="ldv-longo">Copiar link</span><span className="ldv-curto">Copiar</span></>}</button>
          <a className="ldv-b" href={link} target="_blank" rel="noopener noreferrer"><Eye size={17} weight="bold" aria-hidden="true" />Ver</a>
          <button type="button" className="ldv-b" onClick={baixarQr} disabled={!qr}><QrCode size={17} weight="bold" aria-hidden="true" />QR Code</button>
        </div>
      </div>
      {/* o celular com o cardápio dela (só desenho: o toque abre o cardápio de verdade) */}
      <a className="ldv-cel" href={link} target="_blank" rel="noopener noreferrer" aria-label="Ver o cardápio como o cliente vê" tabIndex={-1}>
        <span className="ldv-tela">
          <span className="ldv-capa" style={capa ? { backgroundImage: `url(${capa})` } : { background: `linear-gradient(135deg, ${cor}, #F7C6D9)` }} />
          <span className="ldv-cel-logo">{foto ? <img src={foto} alt="" /> : iniciais}</span>
          <span className="ldv-cel-nome">{nome}</span>
          {prods.length > 0 ? prods.map(p => (
            <span key={p.id} className="ldv-pr">
              <span className="ldv-pr-f" style={primeira(p.imagem_url) ? { backgroundImage: `url(${primeira(p.imagem_url)})` } : undefined} />
              <span className="ldv-pr-t"><b>{p.nome}</b>{p.preco_normal ? <em style={{ color: cor }}>{real(Number(p.preco_normal))}</em> : null}</span>
            </span>
          )) : <><span className="ldv-pr ldv-pr--vz" /><span className="ldv-pr ldv-pr--vz" /></>}
        </span>
      </a>
    </section>
  )
}
