/**
 * (24/10) Orçamentos (PRO): os pedidos de orçamento que chegaram pelo link, os enviados e os respondidos.
 * Em cima, o link fixo da loja para pedir orçamento (copiar e compartilhar) e o "Novo orçamento" (montar sem pedido).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CaretRight, Check, Copy, Crown, FileText, LinkSimple, Package, Plus, ShareNetwork, WarningCircle } from '@phosphor-icons/react'
import mascoteCoroa from '@/assets/mascote-coroa.webp'
import AppPageHeader from '@/components/AppPageHeader'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { Botao, TelaVazia, avisar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { useProfile } from '@/hooks/useProfile'
import { usePlano } from '@/hooks/usePlano'
import { linkWhatsApp } from '@/lib/telefone'
import { compartilharTexto } from '@/lib/compartilharCardapio'
import { brl, dataCurta, linkPedirOrcamento, semResposta, textoPedirOrcamento, totalOrcamento, type Orcamento } from '@/lib/orcamentos'
import { COMO_ORCAMENTOS, TOUR_ORCAMENTOS } from '@/lib/comoTelas'
import { chegouHa } from '@/components/pedidos/pedidoTexto'
import './orcamentos.css'

type Aba = 'novos' | 'enviados' | 'aprovados' | 'recusados'
const ABAS: [Aba, string][] = [['novos', 'Novos'], ['enviados', 'Enviados'], ['aprovados', 'Aprovados'], ['recusados', 'Recusados']]
const daAba = (o: Orcamento, a: Aba) =>
  a === 'novos' ? o.status === 'novo' || o.status === 'rascunho' : a === 'enviados' ? o.status === 'enviado' : a === 'aprovados' ? o.status === 'aprovado' : o.status === 'recusado'

/** (28/10) computador: o funil em quadro, uma coluna por situação (como o Quadro de pedidos). Celular: as abas de antes. */
function useComputador() {
  const q = '(min-width: 901px)'
  const [pc, setPc] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => { const m = window.matchMedia(q); const f = () => setPc(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return pc
}

export default function Orcamentos() {
  const navigate = useNavigate()
  const { profile } = useProfile()
  const { isPro, loading: carregandoPlano } = usePlano()
  const [lista, setLista] = useState<Orcamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<Aba>('novos')

  const carregar = async () => {
    setCarregando(true); setErro('')
    const { data, error } = await supabase.from('orcamentos').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) setErro(explicarErro(error, 'Tente de novo em instantes.'))
    else setLista((data as Orcamento[]) || [])
    setCarregando(false)
  }
  useEffect(() => { if (isPro) void carregar(); else setCarregando(false) }, [isPro])

  // abre na aba que tem novidade
  useEffect(() => {
    if (!lista.length) return
    if (!lista.some(o => daAba(o, 'novos')) && lista.some(o => daAba(o, 'enviados'))) setAba('enviados')
  }, [lista.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const link = linkPedirOrcamento((profile as any)?.codigo_publico, window.location.origin.includes('localhost') ? window.location.origin : undefined)
  const nomeLoja = (profile as any)?.nome_loja || 'Minha confeitaria'
  const contagem = useMemo(() => Object.fromEntries(ABAS.map(([k]) => [k, lista.filter(o => daAba(o, k)).length])) as Record<Aba, number>, [lista])
  const visiveis = lista.filter(o => daAba(o, aba))
  const pc = useComputador()
  // o quadro vai até o fim da tela: mede onde ele começa e usa o resto da altura
  const refQuadro = useRef<HTMLDivElement>(null)
  const [alturaQuadro, setAlturaQuadro] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (!pc) return
    const medir = () => { const el = refQuadro.current; if (el) setAlturaQuadro(Math.max(320, Math.floor(window.innerHeight - (el.getBoundingClientRect().top + window.scrollY) - 24))) }
    medir(); window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [pc, carregando])
  const infoDo = (o: Orcamento) => {
    const atrasado = semResposta(o)
    return {
      total: totalOrcamento(o), atrasado,
      linha: [o.ocasiao || o.nome_evento, o.pessoas ? `${o.pessoas} pessoas` : ''].filter(Boolean).join(' · '),
      sit: (o.status === 'novo' ? ['Novo', 'n'] : o.status === 'rascunho' ? ['Rascunho', 'r'] : o.status === 'enviado' ? [atrasado ? 'Sem resposta' : 'Aguardando', 'e'] : o.status === 'aprovado' ? ['Aprovado', 'a'] : ['Recusado', 'x']) as [string, string],
    }
  }
  const hojeISO = new Date().toLocaleDateString('sv-SE')
  // "Chegou há 2 h", "Enviado ontem às 18:40", "Aprovado em 24/10 às 09:10"
  const quandoDo = (o: Orcamento) => {
    if ((o.status === 'aprovado' || o.status === 'recusado') && o.respondido_em) return chegouHa(o.respondido_em).replace(/^Chegou/, o.status === 'aprovado' ? 'Aprovado' : 'Recusado')
    if (o.status === 'enviado' && o.enviado_em) return chegouHa(o.enviado_em).replace(/^Chegou/, 'Enviado')
    return o.origem === 'link' ? chegouHa(o.created_at) : chegouHa(o.created_at).replace(/^Chegou/, 'Criado')
  }
  const cobrar = (o: Orcamento) => o.cliente_telefone ? (
    <a className="orc-cobrar" href={linkWhatsApp(o.cliente_telefone, `Oi${o.cliente_nome ? `, ${o.cliente_nome.split(' ')[0]}` : ''}! Conseguiu ver o orçamento que te mandei?`)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
      <IconeWhatsApp size={16} />Sem resposta há 3 dias. Pedir retorno
    </a>
  ) : null

  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); avisar('Link copiado', { tipo: 'ok' }) }
    catch { avisar('Não deu para copiar. Tente de novo.', { tipo: 'erro' }) }
  }

  const cab = (
    <AppPageHeader title="Orçamentos" voltar="/pedidos" infoComo={COMO_ORCAMENTOS} infoTour={TOUR_ORCAMENTOS}
      subtitle={contagem.novos ? `${contagem.novos} ${contagem.novos === 1 ? 'pedido novo' : 'pedidos novos'}` : 'Monte propostas e envie por link'} />
  )

  if (!carregandoPlano && !isPro) {
    return (<>
      {cab}
      <div className="orc">
        {/* (30/10 · 5.48) no padrão das telas vazias do PC (igual a Complementos): no meio da tela, o texto e, ao lado, como a cliente vê */}
        {/* (30/10 · 5.67) no estilo da arte do Bruno: à esquerda o texto com os 3 recursos em ícones; à direita o fundo rosa
            com o mascote de coroa, a frase escrita à mão e o celular com a proposta. O tamanho do cartão é o mesmo */}
        <section className="orc-pro">
          <div className="orc-pro-tx">
          <span className="orc-pro-ic" aria-hidden="true"><FileText size={30} weight="duotone" /></span>
          <h2>Orçamentos é um recurso do <em>PRO</em></h2>
          <p>A cliente conta a ideia pelo seu link, você monta a proposta em minutos e ela aprova pelo celular. Aprovou, vira pedido na Agenda.</p>
          <ul>
            {([
              [LinkSimple, 'Link fixo para pedir orçamento', 'Compartilhe e receba os pedidos organizados'],
              [Package, 'Proposta com seus produtos', 'Ou itens personalizados, com fotos e valores'],
              [FileText, 'A cliente aprova pelo link', 'E pode baixar a proposta em PDF'],
            ] as const).map(([Ic, t, sub]) => (
              <li key={t}><span className="orc-pro-li-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><span className="orc-pro-li-tx"><b>{t}</b><small>{sub}</small></span></li>
            ))}
          </ul>
          <Botao icone={<Crown size={20} weight="fill" />} iconeDepois={<ArrowRight size={18} weight="bold" />} onClick={() => navigate('/assinar')}>Conhecer o PRO</Botao>
          </div>
          <figure className="orc-pro-ex" aria-hidden="true">
            <span className="orc-pro-frase">Mais propostas,<br />mais vendas!</span>
            {/* (5.69) as ondas rosa do fundo, como na arte: uma mais forte atrás e a clara por cima, onde o mascote pisa */}
            <svg className="orc-pro-onda" viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 70 C 140 10, 260 120, 400 70 S 560 20, 600 40 L600 260 L0 260 Z" fill="#F3A3C6" opacity=".55" />
              <path d="M0 120 C 120 70, 240 150, 380 120 S 540 80, 600 100 L600 260 L0 260 Z" fill="#EF8FB9" opacity=".35" />
              <path d="M0 175 C 90 140, 220 150, 330 190 S 520 250, 600 230 L600 260 L0 260 Z" fill="#FFF5F9" />
            </svg>
            <img className="orc-pro-masc" src={mascoteCoroa} alt="" />
            <div className="orc-pro-cel">
              <div className="orc-pro-cab"><small>Orçamento nº 12</small><i>Pendente</i><b>Bolo da Ana · 5 anos</b><span>Entrega sábado, 8 de novembro</span></div>
              <div className="orc-pro-it"><span><b>Bolo 2 andares</b><small>Tema jardim, 30 fatias</small></span><em>R$ 380,00</em></div>
              <div className="orc-pro-it"><span><b>Topo de bolo</b><small>Com o nome e a idade</small></span><em>R$ 25,00</em></div>
              <div className="orc-pro-it"><span><b>Docinhos</b><small>50 unidades</small></span><em>R$ 75,00</em></div>
              <div className="orc-pro-tot"><span>Total</span><b>R$ 480,00</b></div>
              <div className="orc-pro-bt">Aprovar orçamento</div>
              <div className="orc-pro-bt2">Baixar em PDF</div>
            </div>
          </figure>
        </section>
      </div>
    </>)
  }

  return (<>
    {cab}
    <div className="orc">
      <div className="orc-topo">
        <section className="orc-link">
          <div className="orc-link-tx"><b>Seu link de orçamento</b><small>{link || 'Publique o cardápio para ter o link'}</small></div>
          {link && <div className="orc-link-bts">
            <Botao variante="secundario" tamanho="m" icone={<Copy size={18} weight="bold" />} onClick={copiar}>Copiar</Botao>
            <Botao variante="suave" tamanho="m" icone={<ShareNetwork size={18} weight="bold" />} onClick={() => void compartilharTexto(textoPedirOrcamento(link), nomeLoja)}>Compartilhar</Botao>
          </div>}
        </section>
        <Botao className="orc-novo" icone={<Plus size={20} weight="bold" />} onClick={() => navigate('/orcamentos/novo')}>Novo orçamento</Botao>
      </div>

      {pc && !carregando && !erro ? (
        <div ref={refQuadro} className="orq" style={{ height: alturaQuadro ?? undefined }}>
          {ABAS.map(([k, nome]) => {
            const doCol = lista.filter(o => daAba(o, k))
            return (
              <section key={k} className={`orq-col orq-col--${k}`} aria-label={nome}>
                <p className="orq-t">{nome}<i>{doCol.length}</i></p>
                <div className="orq-lista">
                  {doCol.length === 0 ? <p className="orq-vazio">{k === 'novos' ? 'Os pedidos do seu link chegam aqui' : 'Nenhum orçamento aqui'}</p> : doCol.map(o => {
                    const x = infoDo(o)
                    return (
                      <article key={o.id} className={`orq-c${x.atrasado ? ' atr' : ''}`} tabIndex={0} onClick={() => navigate(`/orcamentos/${o.id}`)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/orcamentos/${o.id}`) } }}>
                        <p className="orq-nome"><b>{o.cliente_nome || 'Sem nome'}</b><span>#{o.numero}</span></p>
                        <p className="orq-s">{x.linha || (o.origem === 'link' ? 'Pediu pelo link' : 'Criado por você')}</p>
                        {/* (28/10) o que ela pediu, a foto e quanto quer gastar: dá pra decidir sem abrir */}
                        {o.descricao && <p className="orq-desc">“{o.descricao}”</p>}
                        {(o.fotos || []).length > 0 && <div className="orq-fotos">{(o.fotos || []).slice(0, 4).map((f, n) => <img key={n} src={f} alt="" loading="lazy" />)}{(o.fotos || []).length > 4 && <span>+{(o.fotos || []).length - 4}</span>}</div>}
                        <div className="orq-ls">
                          {o.data_evento && (() => { const passou = o.data_evento < hojeISO && (o.status === 'novo' || o.status === 'rascunho' || o.status === 'enviado'); return <p className={passou ? 'orq-passou' : undefined}><span>Festa:</span> {dataCurta(o.data_evento)}{passou ? ' · a data já passou' : ''}</p> })()}
                          {Number(o.orcamento_cliente) > 0 && (o.status === 'novo' || o.status === 'rascunho') && <p><span>Quer gastar:</span> até {brl(Number(o.orcamento_cliente))}</p>}
                          {x.total > 0 && <p><span>Valor:</span> {brl(x.total)}</p>}
                          {o.status === 'recusado' && o.motivo_recusa && <p><span>Motivo:</span> {o.motivo_recusa}</p>}
                          <p className="orq-quando">{quandoDo(o)}</p>
                          {(o.status === 'rascunho' || x.atrasado) && <p className={`orc-st orc-st--${x.sit[1]}`}>{x.sit[0]}</p>}
                        </div>
                        {o.status === 'novo' && <Botao tamanho="p" cheio onClick={e => { e.stopPropagation(); navigate(`/orcamentos/${o.id}`) }}>Responder</Botao>}
                        {x.atrasado && cobrar(o)}
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      ) : <>
      <div className="orc-abas" role="tablist" aria-label="Situação dos orçamentos">
        {ABAS.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}>{t}{contagem[k] > 0 && <i>{contagem[k]}</i>}</button>
        ))}
      </div>

      {carregando ? (
        <div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
      ) : erro ? (
        <TelaVazia caixa icone={<WarningCircle size={30} />} titulo="Não deu para carregar os orçamentos" texto={erro} acao={<Botao onClick={() => void carregar()}>Tentar de novo</Botao>} />
      ) : visiveis.length === 0 ? (
        <TelaVazia caixa icone={<FileText size={30} />}
          titulo={aba === 'novos' ? 'Nenhum orçamento novo' : aba === 'enviados' ? 'Nenhum orçamento esperando resposta' : aba === 'aprovados' ? 'Nenhum orçamento aprovado ainda' : 'Nenhum orçamento recusado'}
          texto={aba === 'novos' ? 'Compartilhe o seu link: os pedidos chegam aqui e você recebe o aviso no celular.' : undefined} />
      ) : (
        <section className="orc-lista">
          {visiveis.map(o => {
            const total = totalOrcamento(o)
            const atrasado = semResposta(o)
            const linha = [o.ocasiao || o.nome_evento, o.pessoas ? `${o.pessoas} pessoas` : '', o.data_evento ? dataCurta(o.data_evento) : ''].filter(Boolean).join(' · ')
            const sit = o.status === 'novo' ? ['Novo', 'n'] : o.status === 'rascunho' ? ['Rascunho', 'r'] : o.status === 'enviado' ? [atrasado ? 'Sem resposta' : 'Aguardando', 'e'] : o.status === 'aprovado' ? ['Aprovado', 'a'] : ['Recusado', 'x']
            return (
              <div key={o.id} className="orc-it">
                <button type="button" className="orc-it-b" onClick={() => navigate(`/orcamentos/${o.id}`)}>
                  <span className="orc-av" aria-hidden="true">{(o.cliente_nome || '?').trim().charAt(0).toUpperCase()}</span>
                  <span className="orc-it-tx">
                    <b>{o.cliente_nome || 'Sem nome'} <small>#{o.numero}</small></b>
                    <small>{linha || (o.origem === 'link' ? 'Pediu pelo link' : 'Criado por você')}</small>
                  </span>
                  <span className="orc-it-dir">
                    <em className={`orc-st orc-st--${sit[1]}`}>{sit[0]}</em>
                    {total > 0 && <small>{brl(total)}</small>}
                  </span>
                  <CaretRight size={18} weight="bold" aria-hidden="true" />
                </button>
                {atrasado && o.cliente_telefone && (
                  <a className="orc-cobrar" href={linkWhatsApp(o.cliente_telefone, `Oi${o.cliente_nome ? `, ${o.cliente_nome.split(' ')[0]}` : ''}! Conseguiu ver o orçamento que te mandei?`)} target="_blank" rel="noopener noreferrer">
                    <IconeWhatsApp size={16} />Enviado há mais de 3 dias. Pedir retorno
                  </a>
                )}
              </div>
            )
          })}
        </section>
      )}
      </>}
    </div>
  </>)
}
