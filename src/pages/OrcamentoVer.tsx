/**
 * (24/10) Página pública da proposta (/orcamento/:token): a cliente vê os itens, os valores, a data e as condições
 * e aprova (vira pedido na Agenda da loja) ou recusa. "Baixar PDF" gera o mesmo PDF da loja (03/11; antes imprimia a página).
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, FilePdf, X } from '@phosphor-icons/react'
import { CampoArea, Janela, avisar } from '@/components/base'
import { supabase } from '@/lib/supabase'
import { explicarErro } from '@/lib/erros'
import { hojeISO, dataLonga, totalOrcamento, valorSinal, type ItemOrcamento, type Orcamento } from '@/lib/orcamentos'
import TopoLojaOrcamento from '@/components/TopoLojaOrcamento'
import PropostaOrcamento from '@/components/PropostaOrcamento'
import { gerarOrcamentoPDF } from '@/lib/gerarOrcamentoPDF'
import { lojaPublica } from '@/lib/pdfDoonly'
import './orcamentos.css'

/** O que a função do banco devolve */
type RespostaRpc = { ok?: boolean; erro?: string } | null
type Ver = Orcamento & { loja: { nome: string; logo?: string | null; codigo?: string; contato?: { telefone?: string | null; instagram?: string | null; cidade?: string | null; estado?: string | null } | null } | null; pedido_numero?: number | null }

export default function OrcamentoVer() {
  const { token } = useParams()
  const [o, setO] = useState<Ver | null | undefined>(undefined)
  const [indo, setIndo] = useState(false)
  const [recusar, setRecusar] = useState(false)
  const [motivo, setMotivo] = useState('')

  const carregar = () => supabase.rpc('orcamento_ver', { p_token: token }).then(({ data, error }) => {
    const d = !error && data ? (data as Ver) : null
    if (d) d.itens = (d.itens || []).map((i: ItemOrcamento, k: number) => ({ ...i, id: String(k), quantidade: Number(i.quantidade) || 1, valor_unitario: Number(i.valor_unitario) || 0 }))
    setO(d)
  })
  useEffect(() => { document.title = 'Orçamento'; void carregar() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const responder = async (aprovar: boolean) => {
    setIndo(true)
    try {
      const { data, error } = await supabase.rpc('orcamento_responder', { p_token: token, p_aprovar: aprovar, p_motivo: aprovar ? null : motivo.trim() || null })
      if (error) throw error
      if (!(data as RespostaRpc)?.ok) avisar((data as RespostaRpc)?.erro || 'Não deu para responder agora.', { tipo: 'erro' })
      setRecusar(false); await carregar(); window.scrollTo({ top: 0 })
    } catch (e) { avisar(explicarErro(e, 'Não deu para responder. Confira a internet e tente de novo.'), { tipo: 'erro' }) }
    finally { setIndo(false) }
  }

  if (o === undefined) return <div className="orp"><div className="orc-carregando"><span className="ui-gira" aria-label="Carregando" /></div></div>
  if (!o) return <div className="orp"><div className="orp-box"><section className="orp-card orp-fim"><h1>Orçamento não encontrado</h1><p>Confira o link com a confeitaria.</p></section></div></div>

  const sinal = valorSinal(o, totalOrcamento(o))
  const nomeLoja = o.loja?.nome || 'Confeitaria'
  const vencido = o.status === 'enviado' && !!o.validade && o.validade < hojeISO()

  const topo = <TopoLojaOrcamento nome={nomeLoja} logo={o.loja?.logo} codigo={o.loja?.codigo} />
  const pdf = () => void gerarOrcamentoPDF(o, null, lojaPublica(o.loja))

  // (6.82) respondido: só o aviso no meio da tela (aprovado ganha o "Baixar orçamento em PDF"), sem repetir a proposta
  if (o.status === 'aprovado' || o.status === 'recusado') return (
    <div className="orp orp--fim"><div className="orp-box">
      {topo}
      <section className="orp-fim orp-fim--solto">
        {o.status === 'aprovado' ? <>
          <span className="orp-ok" aria-hidden="true"><Check size={34} weight="bold" /></span>
          <h1>Orçamento aprovado!</h1>
          <p>A {nomeLoja} já recebeu e vai falar com você pelo WhatsApp para combinar {sinal > 0 ? 'o sinal e ' : ''}os detalhes.</p>
          <button type="button" className="orp-bt" onClick={pdf}><FilePdf size={20} weight="bold" />Baixar orçamento em PDF</button>
        </> : <>
          <h1>Orçamento recusado</h1>
          <p>A {nomeLoja} já foi avisada. Se mudar de ideia, é só chamar a loja no WhatsApp.</p>
        </>}
      </section>
    </div></div>
  )

  return (
    <div className="orp orp--ver"><div className="orp-box">
      {topo}
      {vencido && <section className="orp-card orp-aviso">Este orçamento venceu em {dataLonga(o.validade)}. Peça um novo à loja.</section>}
      <section className="orp-card"><PropostaOrcamento o={o} /></section>
      <button type="button" className="orp-pdf" onClick={pdf}><FilePdf size={18} weight="bold" />Baixar orçamento em PDF</button>

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
