import { useEffect, useRef, useState } from 'react'
import { ArrowSquareOut, Check, Copy } from '@phosphor-icons/react'
import { getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import './loja.css'

/**
 * Loja pronta (4.27) · o fim dos Primeiros passos: a prévia do cardápio, o link com Copiar e Abrir,
 * e o botão pra mandar o link no WhatsApp. Usado no cartão do Início e na janela que abre uma vez quando ela termina.
 */
/** O cardápio real num celular em miniatura: carrega o link oficial e mostra o topo, sem deixar tocar */
function PreviaReal({ url }: { url: string }) {
  const caixa = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(0.8)
  const [sobra, setSobra] = useState(0)
  const [carregou, setCarregou] = useState(false)
  useEffect(() => {
    const el = caixa.current
    if (!el) return
    const medir = () => { const e = Math.min(1, el.clientWidth / 390); setEscala(e); setSobra(Math.max(0, (el.clientWidth - 390 * e) / 2)) }
    medir()
    const ro = new ResizeObserver(medir); ro.observe(el)
    return () => ro.disconnect()
  }, [url])
  if (!url) return null
  return (
    <div ref={caixa} className="lp-previa" aria-label="Prévia do seu cardápio">
      {!carregou && <span className="lp-carregando"><i className="ui-gira" aria-hidden="true" />Abrindo o seu cardápio…</span>}
      <iframe src={url} title="Prévia do cardápio" tabIndex={-1} aria-hidden="true" onLoad={() => setCarregou(true)}
        style={{ width: 390, height: 844, left: sobra, transform: `scale(${escala})`, opacity: carregou ? 1 : 0 }} />
    </div>
  )
}

export function LojaProntaConteudo({ profile }: { profile: any }) {
  const [copiado, setCopiado] = useState(false)
  const link = getCardapioUrl(profile)

  const texto = `Oi! Agora você pode fazer sua encomenda pelo meu cardápio: ${link}`

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu pra copiar. Segure no link pra copiar.', { tipo: 'erro' }) }
  }

  return (
    <div className="lp">
      {/* (4.27) a prévia é o cardápio de verdade (o mesmo link que o cliente abre), no modelo que a loja escolheu */}
      <PreviaReal url={(() => { const u = getCardapioUrl(profile, window.location.origin); return u ? `${u}?previa=1` : '' })()} />

      <p className="lp-url" title={link}>{link.replace(/^https?:\/\//, '')}</p>
      <div className="lj-link-bts">
        <button type="button" className="lj-bt" onClick={copiar}>{copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{copiado ? 'Copiado' : 'Copiar'}</button>
        <a className="lj-bt" href={link} target="_blank" rel="noopener noreferrer"><ArrowSquareOut size={18} aria-hidden="true" />Abrir</a>
      </div>
      <a className="lp-zap" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
        <IconeWhatsApp size={20} />Mandar o link no WhatsApp
      </a>
    </div>
  )
}
