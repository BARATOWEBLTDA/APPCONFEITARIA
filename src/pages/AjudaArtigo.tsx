/**
 * (25/10) Um artigo da Central de Ajuda (/ajuda/:slug): resumo, botão que abre a tela, "Nesta página",
 * passo a passo com prints, dicas, "Isto ajudou?" (fica salvo em ajuda_votos) e as telas relacionadas.
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, CaretDown, CaretRight, Clock, Lifebuoy, Lightbulb, ListBullets, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import { Botao, TelaVazia } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { TEMAS, artigoPorSlug } from '@/lib/ajuda'
import { CartaoSuporte } from './Ajuda'
import './centralAjuda.css'

/** **negrito** → <b> */
function Rico({ t }: { t: string }) {
  const partes = t.split(/\*\*(.+?)\*\*/g)
  return <>{partes.map((p, i) => (i % 2 ? <b key={i}>{p}</b> : <Fragment key={i}>{p}</Fragment>))}</>
}

export default function AjudaArtigo() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const a = artigoPorSlug(slug)
  const [indice, setIndice] = useState(false)
  const [voto, setVoto] = useState<boolean | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0 })
    if (!a) return
    supabase.from('ajuda_votos').select('util').eq('artigo', a.slug).maybeSingle().then(({ data }) => { if (data) setVoto((data as any).util) })
  }, [a?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return (<>
    <AppPageHeader title="Central de Ajuda" subtitle="Artigo" voltar="/ajuda" />
    <div className="ca"><TelaVazia caixa icone={<Lifebuoy size={30} />} titulo="Artigo não encontrado" texto="Ele pode ter mudado de lugar." acao={<Botao onClick={() => navigate('/ajuda')}>Ver os assuntos</Botao>} /></div>
  </>)

  const tema = TEMAS.find(t => t.id === a.tema)
  const votar = async (util: boolean) => {
    setVoto(util)
    await supabase.from('ajuda_votos').upsert({ artigo: a.slug, util }, { onConflict: 'user_id,artigo' })
  }
  const irPara = (id: string) => {
    setIndice(false)
    document.getElementById(`ca-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const Bloco = ({ children }: { children: ReactNode }) => <section className="ca-card">{children}</section>

  return (<>
    <AppPageHeader title={tema?.nome || 'Ajuda'} subtitle="Central de Ajuda" voltar={tema ? `/ajuda/tema/${tema.id}` : '/ajuda'} />
    <div className="ca ca--art">
      <Bloco>
        <div className="ca-meta">{tema && <span className="ca-tag">{tema.nome}</span>}<span className="ca-min"><Clock size={16} aria-hidden="true" />{a.minutos} min de leitura</span></div>
        <h1 className="ca-tit">{a.titulo}</h1>
        <p className="ca-resumo">{a.resumo}</p>
        {a.abrir && <Botao cheio iconeDepois={<ArrowUpRight size={18} weight="bold" />} onClick={() => navigate(a.abrir!.rota)}>{a.abrir.rotulo}</Botao>}
        <div className={`ca-ind${indice ? ' on' : ''}`}>
          <button type="button" className="ca-ind-bt" aria-expanded={indice} onClick={() => setIndice(v => !v)}>
            <ListBullets size={20} weight="bold" aria-hidden="true" /><b>Nesta página</b><small>· {a.secoes.length} partes</small><CaretDown size={18} weight="bold" aria-hidden="true" />
          </button>
          {indice && <ol>{a.secoes.map(s => <li key={s.id}><button type="button" onClick={() => irPara(s.id)}>{s.titulo}</button></li>)}</ol>}
        </div>
      </Bloco>

      {a.secoes.map((s, k) => (
        <section key={s.id} id={`ca-${s.id}`} className="ca-card ca-sec">
          <h2><i>{k + 1}</i>{s.titulo}</h2>
          {s.exemplo && <p className="ca-ex">{s.exemplo}</p>}
          {s.texto?.map((t, i) => <p key={i}><Rico t={t} /></p>)}
          {s.passos && <ol className="ca-passos">{s.passos.map((p, i) => <li key={i}><Rico t={p} /></li>)}</ol>}
          {s.imagens?.map(im => (
            <div key={im.src} className="ca-tela">
              <figure className={`ca-fig${im.alta ? ' ca-fig--alta' : ''}`}><img src={im.src} alt={im.alt} loading="lazy" /></figure>
              {!!im.marcas?.length && (
                <ol className="ca-marcas">{im.marcas.map((m, i) => <li key={i}><i aria-hidden="true">{i + 1}</i><span><Rico t={m} /></span></li>)}</ol>
              )}
            </div>
          ))}
          {s.dica && <p className="ca-dica"><Lightbulb size={18} weight="bold" aria-hidden="true" /><span><Rico t={s.dica} /></span></p>}
        </section>
      ))}

      <section className="ca-card ca-voto">
        <b>{voto === null ? 'Isto ajudou?' : voto ? 'Que bom! Obrigado por avisar.' : 'Obrigado. Vamos melhorar este artigo.'}</b>
        <div>
          <button type="button" aria-pressed={voto === true} onClick={() => void votar(true)}><ThumbsUp size={20} weight={voto === true ? 'fill' : 'bold'} />Sim</button>
          <button type="button" aria-pressed={voto === false} onClick={() => void votar(false)}><ThumbsDown size={20} weight={voto === false ? 'fill' : 'bold'} />Não</button>
        </div>
      </section>

      {!!a.relacionadas?.length && (<>
        <h2 className="ca-h2">Telas relacionadas</h2>
        <section className="ca-lista">
          {a.relacionadas.map(r => (
            <button key={r.rota} type="button" className="ca-art" onClick={() => navigate(r.rota)}>
              <span className="ca-art-tx"><b>{r.rotulo}</b><small>{r.apoio}</small></span>
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          ))}
        </section>
      </>)}
      <CartaoSuporte />
    </div>
  </>)
}
