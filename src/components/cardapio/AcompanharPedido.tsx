import { nomeExtra, textoSaboresKit } from '@/lib/kitTexto'
import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Cake, Check, ImageSquare, PixLogo } from '@phosphor-icons/react'
import type { PixLoja } from '@/lib/pix'
import { PixPagamento } from './PixPagamento'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import '@/components/cart/sacola.css'
import { renderItemFromSnapshot } from '@/lib/pedido-snapshot'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { linkWhatsApp } from '@/lib/telefone'
import { lojaAtualCheckout, lojaAtualNome, lojaAtualWhatsApp, lojaAtualLogo, lojaAtualVerificada } from './lojaAtual'
import { dinheiro, type Pedido } from './contaCliente'
import './acompanharPedido.css'

/**
 * Acompanhar o pedido (21/10): pedido em andamento com topo na cor da loja, a frase do momento,
 * a linha do tempo com a hora de cada etapa (gravada pelo banco) e o Pix certo (a conferir / sinal pago / pago).
 */

/** "1 kg", "500 g", "2 unidades" */
function qtdTexto(q: number, forma?: string | null): string {
  if (forma === 'kg') return q < 1 ? `${Math.round(q * 1000)} g` : `${String(q).replace('.', ',')} kg`
  return `${String(q).replace('.', ',')} ${q === 1 ? 'unidade' : 'unidades'}`
}

/** Ordem das situações (as antigas também) */
function ordem(status: string): number {
  switch (status) {
    case 'agendado': case 'confirmado': return 1
    case 'em_producao': case 'em_preparo': return 2
    case 'finalizado': case 'pronto': case 'aguardando_retirada': return 3
    case 'em_entrega': case 'a_caminho': return 4
    case 'entregue': case 'concluido': return 5
    default: return 0 // novo, aguardando_aceite, aguardando_pagamento
  }
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const dd = (n: number) => String(n).padStart(2, '0')
/** "Seg, 19/10 às 21:40" */
function quandoFoi(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dia = DIAS[d.getDay()]
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${dd(d.getDate())}/${dd(d.getMonth() + 1)} às ${dd(d.getHours())}:${dd(d.getMinutes())}`
}
/** "quarta, 28/10, às 14:00" */
function diaCombinado(p: Pedido, longo = true): string {
  if (!p.data_entrega) return ''
  const d = new Date(p.data_entrega + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const dia = (longo ? DIAS_LONGOS : DIAS)[d.getDay()]
  return `${dia}, ${dd(d.getDate())}/${dd(d.getMonth() + 1)}${p.horario_entrega ? `, às ${p.horario_entrega.slice(0, 5)}` : ''}`
}
/** primeira hora gravada entre as situações dadas */
const tempo = (p: Pedido, ...chaves: string[]) => chaves.map(k => p.status_tempos?.[k]).find(Boolean) || null

type Etapa = { titulo: string; sub?: string; estado: 'feito' | 'agora' | 'depois' | 'atencao' }

function etapasDo(p: Pedido): Etapa[] {
  const o = ordem(p.status)
  const ret = p.tipo_entrega === 'retirada'
  const lugar = ret ? 'retirada' : 'entrega'
  const total = Number(p.valor_total) || 0
  const recebido = p.status_pagamento === 'pago' ? total : Number(p.valor_recebido) || 0
  const falta = Math.max(0, Math.round((total - recebido) * 100) / 100)
  const st = (n: number): Etapa['estado'] => (o > n ? 'feito' : o === n ? 'agora' : 'depois')
  const e: Etapa[] = [{ titulo: 'Pedido recebido', sub: quandoFoi(p.created_at), estado: 'feito' }]

  // Pagamento: aparece quando já entrou dinheiro ou quando o pedido é de Pix pelo cardápio
  if (recebido > 0.009) {
    const pix = (p.forma_pagamento || '').toLowerCase().includes('pix')
    e.push(p.status_pagamento === 'pago' || falta < 0.01
      ? { titulo: `Pago · ${dinheiro(total)}`, sub: pix ? 'Pix confirmado' : quandoFoi(p.pago_em), estado: 'feito' }
      : { titulo: `Sinal pago · ${dinheiro(recebido)}`, sub: `Falta ${dinheiro(falta)} na ${lugar}`, estado: 'feito' })
  } else if (p.pix_online) {
    e.push(p.pix_informado_em && Number(p.pix_informado_valor) > 0
      ? { titulo: `Pix enviado · ${dinheiro(Number(p.pix_informado_valor))}`, sub: 'A loja está conferindo', estado: 'feito' }
      : { titulo: 'Aguardando o Pix', sub: 'Pague para confirmar o pedido', estado: 'atencao' })
  }

  e.push({ titulo: o >= 1 ? 'Aceito pela loja' : 'Esperando a loja aceitar', sub: o >= 1 ? quandoFoi(tempo(p, 'agendado', 'confirmado')) : 'A loja confirma em breve', estado: st(0) === 'agora' ? 'agora' : 'feito' })
  e.push({ titulo: 'Em produção', sub: o === 2 ? 'A loja avisa quando ficar pronto' : o > 2 ? quandoFoi(tempo(p, 'em_producao', 'em_preparo')) : undefined, estado: st(2) })
  if (ret) {
    e.push({ titulo: 'Pronto para retirar', sub: o >= 3 ? (quandoFoi(tempo(p, 'aguardando_retirada', 'finalizado', 'pronto')) || 'Já pode buscar') : undefined, estado: o >= 3 ? (o >= 5 ? 'feito' : 'agora') : 'depois' })
    e.push({ titulo: 'Retirado', sub: diaCombinado(p, false) ? `Combinado ${diaCombinado(p, false)}` : undefined, estado: o >= 5 ? 'feito' : 'depois' })
  } else {
    e.push({ titulo: 'Saiu para entrega', sub: o === 3 ? 'Ficou pronto, sai em breve' : o === 4 ? (quandoFoi(tempo(p, 'em_entrega', 'a_caminho')) || 'A caminho') : undefined, estado: o >= 5 ? 'feito' : o >= 3 ? 'agora' : 'depois' })
    e.push({ titulo: 'Entregue', sub: diaCombinado(p, false) ? `Previsto ${diaCombinado(p, false)}` : undefined, estado: o >= 5 ? 'feito' : 'depois' })
  }
  return e
}

function frase(p: Pedido): string {
  const o = ordem(p.status)
  const ret = p.tipo_entrega === 'retirada'
  const pago = p.status_pagamento === 'pago' || Number(p.valor_recebido) > 0
  if (o === 0) return p.pix_online && !pago && !p.pix_informado_em ? 'Falta pagar o Pix' : 'Esperando a loja aceitar'
  if (o === 1) return 'Pedido confirmado'
  if (o === 2) return 'Seu pedido está sendo feito'
  if (o === 3) return ret ? 'Pronto para retirar' : 'Ficou pronto'
  if (o === 4) return 'Saiu para entrega'
  return ret ? 'Retirado' : 'Entregue'
}

/** (27/10) Pix ainda não pago nem avisado: dá pra abrir o código de novo (antes, fechou a tela, perdeu o código) */
function pixParaPagar(p: Pedido): PixLoja | null {
  const pix = (lojaAtualCheckout() as { pix?: PixLoja | null } | null)?.pix
  if (!pix?.chave || !p.pix_online || p.pix_informado_em) return null
  if (['cancelado', 'recusado'].includes(p.status) || p.status_pagamento === 'pago' || Number(p.valor_recebido) > 0) return null
  return Number(p.valor_total) > 0 ? pix : null
}

export function AcompanharPedido({ p, cor, corTopo, aoAtualizar }: { p: Pedido; cor: string; corTopo?: string; aoAtualizar?: () => void }) {
  const pix = pixParaPagar(p)
  const [pagando, setPagando] = useState<'sinal' | 'total' | null>(null)
  const cobreRef = useRef<HTMLDivElement>(null)
  useSobreposicao(!!pagando, () => setPagando(null), cobreRef) // voltar do Android e Esc fecham o Pix
  const ret = p.tipo_entrega === 'retirada'
  const etapas = etapasDo(p)
  const itens = p.pedido_itens || []
  const quando = diaCombinado(p)
  const loja = lojaAtualNome()
  const zap = linkWhatsApp(lojaAtualWhatsApp(), `Oi! Queria saber do meu pedido #${p.numero}`)
  return (
    <article className="acp" style={{ '--acp-cor': cor } as CSSProperties}>
      <div className="acp-topo" style={{ background: corTopo || '#3D2420' }}>
        <small>Pedido #{p.numero}{loja ? ` · ${loja}` : ''}</small>
        <h3>{frase(p)}</h3>
        {quando && <span>{ret ? 'Retirada' : 'Entrega'} {quando}</span>}
      </div>

      <ol className="acp-linha">
        {etapas.map((e, i) => (
          <li key={i} className={`acp-et acp-et--${e.estado}`}>
            <i aria-hidden="true">{e.estado === 'feito' ? <Check size={14} weight="bold" /> : i + 1}</i>
            <span><b>{e.titulo}</b>{e.sub && <small>{e.sub}</small>}</span>
          </li>
        ))}
      </ol>

      {pix && (
        <button type="button" className="acp-pix" style={{ background: cor }} onClick={() => setPagando(pix.modo === 'total' ? 'total' : 'sinal')}>
          <PixLogo size={20} weight="fill" />Pagar com Pix
        </button>
      )}
      {pix && pagando && createPortal(
        <div ref={cobreRef} tabIndex={-1} className="px-cobre" role="dialog" aria-modal="true" aria-label="Pagar com Pix">
          <PixPagamento pix={pix} pedidoId={p.id} numero={p.numero} total={Number(p.valor_total) || 0} tipo={pagando}
            loja={loja} cor={cor} corTopo={corTopo} logoUrl={lojaAtualLogo()} verificada={lojaAtualVerificada()} quando={ret ? 'retirada' : 'entrega'}
            aoTrocarTipo={pix.modo === 'escolha' ? setPagando : undefined}
            aoPagar={() => { setPagando(null); aoAtualizar?.() }} aoDepois={() => setPagando(null)} textoDepois="Voltar para o pedido" />
        </div>,
        document.body,
      )}

      <ul className="acp-itens">
        {itens.map((it, i) => {
          const r = renderItemFromSnapshot({ ...it, snapshot_version: it.snapshot_version ?? 1 } as any)
          const pz = it.personalizacoes || {}
          const extras: any[] = Array.isArray(pz.extras) ? pz.extras : []
          const linhas = r.personalizacoesRender.map(l => `${l.label} ${l.valor}`)
          if (pz.kit?.sabores?.length) linhas.push(`${pz.kit.total} un. · ${textoSaboresKit(pz.kit.sabores)}`)
          return (
            <li key={i}>
              <span className="acp-foto">{it.produtos?.imagem_url ? <img src={String(it.produtos.imagem_url).split(',')[0]} alt="" loading="lazy" /> : <Cake size={22} weight="duotone" />}</span>
              <span className="acp-it-nome">
                <span className="acp-it-l1"><b>{it.nome_produto}</b><em>{dinheiro((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1))}</em></span>
                {(Number(it.quantidade) !== 1 || it.produtos?.forma_venda === 'kg') && <small>{qtdTexto(Number(it.quantidade) || 1, it.produtos?.forma_venda)}</small>}
                {linhas.map((t, n) => <small key={n}>{t}</small>)}
                {extras.map((x, n) => <span key={`x${n}`} className="acp-extra"><span>+ {nomeExtra(x)}</span></span>)}
                {it.tem_foto_referencia && <small className="acp-ref"><ImageSquare size={14} weight="bold" />Foto de referência enviada</small>}
                {it.observacoes && <small className="acp-obs">Obs.: {it.observacoes}</small>}
              </span>
            </li>
          )
        })}
        <li className="acp-total"><b>Total</b><em>{dinheiro(p.valor_total)}</em></li>
      </ul>

      {zap && (
        <a className="acp-zap" href={zap} target="_blank" rel="noreferrer"><IconeWhatsApp size={20} />Falar com a loja no WhatsApp</a>
      )}
    </article>
  )
}
