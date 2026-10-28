/**
 * (24/10) Página pública da proposta (/orcamento/:token): a cliente vê os itens, os valores, a data e as condições
 * e aprova (vira pedido na Agenda da loja) ou recusa. "Baixar PDF" imprime a página (dá para salvar em PDF).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, FilePdf, Storefront, X } from '@phosphor-icons/react'
import { CampoArea, Janela, avisar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { brl, hojeISO, textoEntrega, dataLonga, textoCondicoes, totalOrcamento, valorSinal, type Orcamento } from '@/lib/orcamentos'
import './orcamentos.css'

type Ver = Orcamento & { loja: { nome: string; logo?: string | null; codigo?: string } | null; pedido_numero?: number | null }

export default function OrcamentoVer() {
  const { token } = useParams()
  const [o, setO] = useState<Ver | null | undefined>(undefined)
  const [indo, setIndo] = useState(false)
  const [recusar, setRecusar] = useState(false)
  const [motivo, setMotivo] = useState('')

  const carregar = () => supabase.rpc('orcamento_ver', { p_token: token }).then(({ data, error }) => {
    const d = !error && data ? (data as any) : null
    if (d) d.itens = (d.itens || []).map((i: any, k: number) => ({ ...i, id: String(k), quantidade: Number(i.quantidade) || 1, valor_unitario: Number(i.valor_unitario) || 0 }))
    setO(d)
  })
  useEffect(() => { document.title = 'Orçamento'; void carregar() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (aprovar: boolean) => {
    setIndo(true)
    try {
      const { data, error } = await supabase.rpc('orcamento_responder', { p_token: token, p_aprovar: aprovar, p_motivo: aprovar ? null : motivo.trim() || null })
      if (error) throw error
      if (!(data as any)?.ok) avisar((data as any)?.erro || 'Não deu para responder agora.', { tipo: 'erro' })
      setRecusar(false); await carregar(); window.scrollTo({ top: 0 })
    } catch (e) { avisar(explicarErro(e, 'Não deu para responder. Confira a internet e tente de novo.'), { tipo: 'erro' }) }
    finally { setIndo(false) }
  }

  if (o === undefined) return <div className="orp"><div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div></div>
  if (!o) return <div className="orp"><div className="orp-box"><section className="orp-card orp-fim"><h1>Orçamento não encontrado</h1><p>Confira o link com a confeitaria.</p></section></div></div>

  const total = totalOrcamento(o)
  const sinal = valorSinal(o, total)
  const nomeLoja = o.loja?.nome || 'Confeitaria'
  const vencido = o.status === 'enviado' && !!o.validade && o.validade < hojeISO()

  return (
    <div className="orp orp--ver"><div className="orp-box">
      <header className="orp-topo">
        {o.loja?.logo ? <img src={o.loja.logo} alt="" /> : <span className="orp-ini"><Storefront size={22} weight="bold" /></span>}
        <span><b>{nomeLoja}</b><small>Orçamento #{o.numero}{o.cliente_nome ? ` para ${o.cliente_nome.split(' ')[0]}` : ''}</small></span>
      </header>

      {o.status === 'aprovado' && (
        <section className="orp-card orp-fim orp-fim--p">
          <span className="orp-ok" aria-hidden="true"><Check size={34} weight="bold" /></span>
          <h1>Orçamento aprovado!</h1>
          <p>A {nomeLoja} já recebeu{o.pedido_numero ? ` e o pedido #${o.pedido_numero} está na agenda` : ''}. Ela vai falar com você pelo WhatsApp para combinar {sinal > 0 ? 'o sinal e ' : ''}os detalhes.</p>
        </section>
      )}
      {o.status === 'recusado' && (
        <section className="orp-card orp-fim orp-fim--p"><h1>Orçamento recusado</h1><p>A {nomeLoja} já foi avisada. Se mudar de ideia, é só chamar a loja.</p></section>
      )}
      {vencido && <section className="orp-card orp-aviso">Este orçamento venceu em {dataLonga(o.validade)}. Peça um novo à loja.</section>}

      {o.mensagem && <section className="orp-card"><p className="orp-msg">{o.mensagem}</p></section>}

      {(o.data_evento || o.nome_evento || o.pessoas) && (
        <section className="orp-card">
          <dl className="orc-kv">
            {o.nome_evento && <><dt>Evento</dt><dd>{o.nome_evento}</dd></>}
            {o.data_evento && <><dt>Data</dt><dd>{dataLonga(o.data_evento)}</dd></>}
            {o.pessoas && <><dt>Pessoas</dt><dd>{o.pessoas}</dd></>}
            {o.local_evento && <><dt>Local</dt><dd>{o.local_evento}</dd></>}
            <dt>{o.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada'}</dt><dd>{o.tipo_entrega === 'entrega' ? 'No seu endereço' : 'Na loja'}</dd>
          </dl>
        </section>
      )}

      <section className="orp-card">
        <div className="orc-prev-itens">
          {(o.itens || []).map(i => (
            <div key={i.id}><span><b>{i.quantidade > 1 ? `${i.quantidade} × ` : ''}{i.nome}</b>{i.detalhe && <small>{i.detalhe}</small>}</span><em>{brl(i.quantidade * i.valor_unitario)}</em></div>
          ))}
          {o.tipo_entrega === 'entrega' && <div><span><b>Entrega</b></span><em>{textoEntrega(o.taxa_entrega)}</em></div>}
          {Number(o.acrescimo) > 0 && <div><span><b>Acréscimo</b></span><em>{brl(o.acrescimo)}</em></div>}
          {Number(o.desconto) > 0 && <div className="ok"><span><b>Desconto</b></span><em>− {brl(o.desconto)}</em></div>}
        </div>
        <div className="orc-prev-tot"><span>Total</span><b>{brl(total)}</b></div>
        <p className="orc-prev-cond">{textoCondicoes(o, total)}{sinal > 0 && o.sinal_tipo !== 'total' ? ` · resto ${brl(Math.max(0, total - sinal))} na entrega` : ''}</p>
      </section>

      <button type="button" className="orp-pdf" onClick={() => window.print()}><FilePdf size={18} weight="bold" />Baixar PDF</button>

      {o.status === 'enviado' && !vencido && (
        <div className="orp-pe orp-pe--2">
          <button type="button" className="orp-bt orp-bt--sec" disabled={indo} onClick={() => setRecusar(true)}>Recusar</button>
          <button type="button" className="orp-bt" disabled={indo} onClick={() => void responder(true)}>{indo ? 'Enviando…' : 'Aprovar orçamento'}</button>
        </div>
      )}
    </div>

    <Janela aberta={recusar} aoFechar={() => setRecusar(false)} tipo="conteudo" titulo="Recusar o orçamento?"
      acoes={<><button type="button" className="orp-bt orp-bt--sec" onClick={() => setRecusar(false)}>Voltar</button><button type="button" className="orp-bt orp-bt--perigo" disabled={indo} onClick={() => void responder(false)}><X size={18} weight="bold" />Recusar</button></>}>
      <CampoArea rotulo="Quer contar o motivo?" opcional rows={3} value={motivo} maxLength={300} placeholder="Ex.: ficou acima do que eu queria gastar" onChange={e => setMotivo(e.target.value)} />
    </Janela>
    </div>
  )
}
