/**
 * (25/10) Um artigo da Central de Ajuda (/ajuda/:slug): resumo, botão que abre a tela, "Nesta página",
 * passo a passo com prints, dicas, "Isto ajudou?" (fica salvo em ajuda_votos) e as telas relacionadas.
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowUpRight, CaretDown, CaretRight, Check, Clock, Lifebuoy, Lightbulb, ListBullets, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import AppPageHeader from '@/components/AppPageHeader'
import { Botao, TelaVazia } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { TEMAS, artigoPorSlug } from '@/lib/ajuda'
import { CartaoSuporte } from './Ajuda'
import AjudaEsquema from './AjudaEsquema'
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
  const [motivo, setMotivo] = useState('')
  const [enviado, setEnviado] = useState(false)

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
    setEnviado(false)
    await salvar({ util, motivo: null })
  }
  /** grava o voto; se o banco ainda não tiver a coluna "motivo", grava só o sim/não */
  const salvar = async (extra: { util: boolean; motivo: string | null }) => {
    const { error } = await supabase.from('ajuda_votos').upsert({ artigo: a.slug, ...extra, updated_at: new Date().toISOString() }, { onConflict: 'user_id,artigo' })
    if (error) await supabase.from('ajuda_votos').upsert({ artigo: a.slug, util: extra.util }, { onConflict: 'user_id,artigo' })
  }
  const enviarMotivo = async () => {
    const t = motivo.trim()
    if (!t) return
    setEnviado(true)
    await salvar({ util: false, motivo: t.slice(0, 500) })
  }
  const irPara = (id: string) => {
    setIndice(false)
    document.getElementById(`ca-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const Bloco = ({ children }: { children: ReactNode }) => <section className="ca-card">{children}</section>

  // (27/10) formato novo: resumo, "Em resumo", esquema da tela, explicação em texto e dúvidas comuns
  const novo = !!(a.esquema || a.intro)

  return (<>
    <AppPageHeader title={tema?.nome || 'Ajuda'} subtitle="Central de Ajuda" voltar={tema ? `/ajuda/tema/${tema.id}` : '/ajuda'} />
    <div className="ca ca--art">
      {novo ? (<>
        <Bloco>
          <div className="ca-meta">{tema && <span className="ca-tag">{tema.nome}</span>}<span className="ca-min"><Clock size={16} aria-hidden="true" />{a.minutos} min de leitura</span></div>
          <h1 className="ca-tit">{a.titulo}</h1>
          {a.intro && <p className="ca-intro"><Rico t={a.intro} /></p>}
          {a.abrir && <Botao cheio className="ca-abrir-topo" iconeDepois={<ArrowUpRight size={18} weight="bold" />} onClick={() => navigate(a.abrir!.rota)}>{a.abrir.rotulo}</Botao>}
          {!!a.pontos?.length && (
            <div className="ca-pontos">
              <p className="ce-rot">Em resumo</p>
              <ul>{a.pontos.map(t => <li key={t}><Check size={16} weight="bold" aria-hidden="true" /><span><Rico t={t} /></span></li>)}</ul>
            </div>
          )}
        </Bloco>
        {a.esquema && <AjudaEsquema e={a.esquema} />}
        {!!a.textos?.length && (
          <section className="ca-card ca-txt">
            {a.textos.map(x => (
              <div key={x.titulo} className="ca-txt-p">
                <h2>{x.titulo}</h2>
                {x.texto?.map((t, i) => <p key={i}><Rico t={t} /></p>)}
                {x.lista && <ul className="ca-txt-lista">{x.lista.map((t, i) => <li key={i}><Rico t={t} /></li>)}</ul>}
                {x.passos && <ol className="ca-passos">{x.passos.map((t, i) => <li key={i}><Rico t={t} /></li>)}</ol>}
                {x.dica && <p className="ca-dica"><Lightbulb size={18} weight="bold" aria-hidden="true" /><span><Rico t={x.dica} /></span></p>}
              </div>
            ))}
          </section>
        )}
        {!!a.duvidas?.length && (
          <section className="ca-card ca-duv">
            <h2>Dúvidas comuns</h2>
            {a.duvidas.map(d => (
              <details key={d.p}>
                <summary><span>{d.p}</span><CaretDown size={18} weight="bold" aria-hidden="true" /></summary>
                <p><Rico t={d.r} /></p>
              </details>
            ))}
          </section>
        )}
      </>) : (<>
      <Bloco>
        <div className="ca-meta">{tema && <span className="ca-tag">{tema.nome}</span>}<span className="ca-min"><Clock size={16} aria-hidden="true" />{a.minutos} min de leitura</span></div>
        <h1 className="ca-tit">{a.titulo}</h1>
        <p className="ca-resumo">{a.resumo}</p>
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

      {a.abrir && <div className="ca-abrir"><Botao cheio iconeDepois={<ArrowUpRight size={18} weight="bold" />} onClick={() => navigate(a.abrir!.rota)}>{a.abrir.rotulo}</Botao></div>}
      </>)}

      <section className="ca-card ca-voto-card">
        <div className="ca-voto">
          {/* (28/10) textos curtos: "Que bom! Obrigado." empurrava o Sim e o Não para fora da tela */}
          <b>{voto === null ? 'Isto ajudou?' : voto ? 'Obrigado!' : enviado ? 'Obrigado!' : 'O que faltou?'}</b>
          <div>
            <button type="button" aria-pressed={voto === true} onClick={() => void votar(true)}><ThumbsUp size={20} weight={voto === true ? 'fill' : 'bold'} />Sim</button>
            <button type="button" aria-pressed={voto === false} onClick={() => void votar(false)}><ThumbsDown size={20} weight={voto === false ? 'fill' : 'bold'} />Não</button>
          </div>
        </div>
        {voto === false && !enviado && (
          <div className="ca-motivo">
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={500} rows={3} placeholder="Conte o que não ficou claro" aria-label="O que faltou neste artigo" autoFocus />
            <Botao cheio disabled={!motivo.trim()} onClick={() => void enviarMotivo()}>Enviar</Botao>
          </div>
        )}
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
