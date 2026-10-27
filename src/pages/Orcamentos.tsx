/**
 * (24/10) Orçamentos (PRO): os pedidos de orçamento que chegaram pelo link, os enviados e os respondidos.
 * Em cima, o link fixo da loja para pedir orçamento (copiar e compartilhar) e o "Novo orçamento" (montar sem pedido).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight, Check, Copy, Crown, FileText, Plus, ShareNetwork, WarningCircle } from '@phosphor-icons/react'
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
import './orcamentos.css'

type Aba = 'novos' | 'enviados' | 'aprovados' | 'recusados'
const ABAS: [Aba, string][] = [['novos', 'Novos'], ['enviados', 'Enviados'], ['aprovados', 'Aprovados'], ['recusados', 'Recusados']]
const daAba = (o: Orcamento, a: Aba) =>
  a === 'novos' ? o.status === 'novo' || o.status === 'rascunho' : a === 'enviados' ? o.status === 'enviado' : a === 'aprovados' ? o.status === 'aprovado' : o.status === 'recusado'

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
        <section className="orc-pro">
          <span className="orc-pro-ic" aria-hidden="true"><FileText size={30} weight="duotone" /></span>
          <h2>Orçamentos é um recurso do PRO</h2>
          <p>A cliente conta a ideia pelo seu link, você monta a proposta em minutos e ela aprova pelo celular. Aprovou, vira pedido na Agenda.</p>
          {/* (27/10) com o ícone de certo (a lista aparecia sem marcador) */}
          <ul>
            {['Link fixo para pedir orçamento', 'Proposta com os seus produtos ou itens personalizados', 'A cliente aprova pelo link e pode baixar em PDF'].map(t => (
              <li key={t}><Check size={16} weight="bold" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          <Botao icone={<Crown size={20} weight="fill" />} onClick={() => navigate('/assinar')}>Conhecer o PRO</Botao>
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
    </div>
  </>)
}
