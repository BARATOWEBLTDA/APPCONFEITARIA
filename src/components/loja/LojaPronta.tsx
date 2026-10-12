import { useEffect, useState } from 'react'
import { ArrowSquareOut, Check, Copy } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { getCardapioUrl } from '@/hooks/useProfile'
import { avisar } from '@/components/base'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { formatCurrency } from '@/utils/helpers'
import './loja.css'

/**
 * Loja pronta (4.27) · o fim dos Primeiros passos: a prévia do cardápio, o link com Copiar e Abrir,
 * e o botão pra mandar o link no WhatsApp. Usado no cartão do Início e na janela que abre uma vez quando ela termina.
 */
type Produto = { id: string; nome: string; imagem_url?: string | null; preco_normal?: number | null }

export function LojaProntaConteudo({ profile }: { profile: any }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [copiado, setCopiado] = useState(false)
  const link = getCardapioUrl(profile)

  useEffect(() => {
    if (!profile?.id) return
    let vivo = true
    supabase.from('produtos').select('id, nome, imagem_url, preco_normal').eq('user_id', profile.id).eq('disponivel', true)
      .order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => { if (vivo && Array.isArray(data)) setProdutos(data as Produto[]) }, () => {})
    return () => { vivo = false }
  }, [profile?.id])

  const cor = profile?.cor_navbar || profile?.cor_borda || '#E85A8C'
  const logo = profile?.logo_url || profile?.foto_url || ''
  const texto = `Oi! Agora você pode fazer sua encomenda pelo meu cardápio: ${link}`

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { avisar('Não deu pra copiar. Segure no link pra copiar.', { tipo: 'erro' }) }
  }

  return (
    <div className="lp">
      <div className="lp-previa" aria-label="Prévia do seu cardápio">
        <div className="lp-topo" style={{ background: cor }} />
        <div className="lp-loja">
          <span className="lp-logo" style={{ borderColor: cor }}>{logo ? <img src={logo} alt="" /> : <b style={{ color: cor }}>{String(profile?.nome_loja || 'D').charAt(0)}</b>}</span>
          <b className="lp-nome">{profile?.nome_loja || 'Sua confeitaria'}</b>
          {profile?.descricao_loja && <small className="lp-desc">{profile.descricao_loja}</small>}
        </div>
        {produtos.length > 0 && (
          <div className="lp-prods">
            {produtos.map(p => {
              const img = String(p.imagem_url || '').split(',')[0].trim()
              return (
                <span key={p.id} className="lp-prod">
                  {img ? <img src={img} alt="" /> : <i />}
                  <small>{p.nome}</small>
                  {Number(p.preco_normal) > 0 && <em>{formatCurrency(Number(p.preco_normal))}</em>}
                </span>
              )
            })}
          </div>
        )}
      </div>

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
