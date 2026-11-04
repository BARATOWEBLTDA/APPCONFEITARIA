// ── PropostaOrcamento.tsx ────────────────────────────────────────────────────
// (6.82) A proposta como o cliente vê: a mesma na página pública (/orcamento/:token),
// na prévia da etapa Enviar e no resumo depois de respondido.
// Título e dados empilhados (o nome em cima, o valor embaixo), à esquerda; só os preços dos itens à direita.
// ─────────────────────────────────────────────────────────────────────────────
import { CalendarBlank, Clock, MapPin, Package, Truck, UsersThree } from '@phosphor-icons/react'
import { FORMA_ORC, brl, dataCurta, diaSemanaCurto, horaCurta, valorSinal, totalOrcamento, type Orcamento } from '@/lib/orcamentos'

export default function PropostaOrcamento({ o, montando }: { o: Orcamento; montando?: { condicoes: boolean } }) {
  const total = totalOrcamento(o)
  const sinal = valorSinal(o, total)
  const resto = Math.max(0, total - sinal)
  const itens = o.itens || []
  const nome = (o.cliente_nome || '').trim().split(' ')[0]
  const titulo = (o.nome_evento || o.ocasiao || '').trim() || (nome ? `Orçamento para ${nome}` : 'Seu orçamento')
  const verCond = !montando || montando.condicoes
  const varios = !!(o.data_evento && o.data_evento_fim && o.data_evento_fim > o.data_evento)

  const dados: [typeof CalendarBlank, string, string, boolean?][] = []
  if (o.data_evento) dados.push([CalendarBlank, varios ? 'Dias' : 'Data', varios ? `${dataCurta(o.data_evento)} a ${dataCurta(o.data_evento_fim)}` : diaSemanaCurto(o.data_evento)])
  if (o.horario_evento) dados.push([Clock, 'Horário', horaCurta(o.horario_evento)])
  if (o.pessoas) dados.push([UsersThree, 'Pessoas', `${o.pessoas} pessoas`])
  dados.push([Truck, o.tipo_entrega === 'entrega' ? 'Entrega' : 'Retirada', o.tipo_entrega === 'entrega' ? 'No local' : 'Na loja'])
  if (o.local_evento) dados.push([MapPin, 'Local', o.local_evento, true])

  return (
    <div className="pp">
      <header className="pp-cab">
        <small>Orçamento{o.numero ? ` #${o.numero}` : ''}</small>
        <h2>{titulo}</h2>
        {nome && (o.nome_evento || o.ocasiao) && <p>Para {o.cliente_nome}</p>}
      </header>
      {o.mensagem && <p className="pp-msg">{o.mensagem}</p>}

      <section className="pp-sec">
        <h3>O evento</h3>
        <div className="pp-dados">
          {dados.map(([Ic, r, v, largo]) => (
            <div key={r} className={largo ? 'pp-d pp-d--largo' : 'pp-d'}>
              <span className="pp-d-ic" aria-hidden="true"><Ic size={18} weight="regular" /></span>
              <span className="pp-d-tx"><small>{r}</small><b>{v}</b></span>
            </div>
          ))}
        </div>
      </section>

      <section className="pp-sec">
        <h3>Itens</h3>
        {itens.length === 0 && montando ? <p className="pp-vz">Os itens e o total aparecem aqui conforme você monta.</p> : (
          <div className="pp-itens">
            {itens.map((i, k) => (
              <div key={i.id || k} className="pp-it">
                <span className="pp-it-ft" aria-hidden="true">{i.imagem_url ? <img src={i.imagem_url} alt="" /> : <Package size={18} />}</span>
                <span className="pp-it-tx"><b>{Number(i.quantidade) > 1 ? `${i.quantidade} × ` : ''}{i.nome}</b>{i.detalhe && <small>{i.detalhe}</small>}</span>
                <em>{brl((Number(i.quantidade) || 1) * (Number(i.valor_unitario) || 0))}</em>
              </div>
            ))}
          </div>
        )}
        {(itens.length > 0 || !montando) && <div className="pp-contas">
          {o.tipo_entrega === 'entrega' && <p><span>Entrega</span><b>{Number(o.taxa_entrega) > 0 ? brl(Number(o.taxa_entrega)) : 'Grátis'}</b></p>}
          {Number(o.acrescimo) > 0 && <p><span>Acréscimo</span><b>{brl(Number(o.acrescimo))}</b></p>}
          {Number(o.desconto) > 0 && <p className="ok"><span>Desconto</span><b>− {brl(Number(o.desconto))}</b></p>}
          <p className="pp-total"><span>Total</span><b>{brl(total)}</b></p>
        </div>}
      </section>

      {verCond && <section className="pp-sec">
        <h3>Pagamento</h3>
        <div className="pp-dados">
          {o.sinal_tipo === 'total'
            ? <div className="pp-d"><span className="pp-d-tx"><small>Para reservar a data</small><b>{brl(total)}</b></span></div>
            : sinal > 0
              ? <>
                <div className="pp-d"><span className="pp-d-tx"><small>Sinal para reservar</small><b>{brl(sinal)}</b></span></div>
                <div className="pp-d"><span className="pp-d-tx"><small>Na entrega</small><b>{brl(resto)}</b></span></div>
              </>
              : <div className="pp-d"><span className="pp-d-tx"><small>Quando pagar</small><b>Na entrega</b></span></div>}
          <div className="pp-d"><span className="pp-d-tx"><small>Forma de pagamento</small><b>{FORMA_ORC[o.forma_pagamento] || 'A combinar'}</b></span></div>
          {o.validade && <div className="pp-d"><span className="pp-d-tx"><small>Válido até</small><b>{diaSemanaCurto(o.validade)}</b></span></div>}
        </div>
      </section>}
    </div>
  )
}
