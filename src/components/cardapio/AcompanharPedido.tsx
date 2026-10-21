import type { CSSProperties } from 'react'
import { Cake, Check } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { linkWhatsApp } from '@/lib/telefone'
import { lojaAtualNome, lojaAtualWhatsApp } from './lojaAtual'
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
      ? { titulo: `Pix a conferir · ${dinheiro(Number(p.pix_informado_valor))}`, sub: 'A loja confere no banco', estado: 'atencao' }
      : { titulo: 'Aguardando o Pix', sub: 'Pague pra confirmar o pedido', estado: 'atencao' })
  }

  e.push({ titulo: o >= 1 ? 'Aceito pela loja' : 'Esperando a loja aceitar', sub: o >= 1 ? quandoFoi(tempo(p, 'agendado', 'confirmado')) : 'A loja confirma em breve', estado: st(0) === 'agora' ? 'agora' : 'feito' })
  e.push({ titulo: 'Em produção', sub: o === 2 ? 'A loja avisa quando ficar pronto' : o > 2 ? quandoFoi(tempo(p, 'em_producao', 'em_preparo')) : undefined, estado: st(2) })
  if (ret) {
    e.push({ titulo: 'Pronto pra retirar', sub: o >= 3 ? (quandoFoi(tempo(p, 'aguardando_retirada', 'finalizado', 'pronto')) || 'Já pode buscar') : undefined, estado: o >= 3 ? (o >= 5 ? 'feito' : 'agora') : 'depois' })
    e.push({ titulo: 'Retirado', sub: diaCombinado(p, false) ? `Combinado ${diaCombinado(p, false)}` : undefined, estado: o >= 5 ? 'feito' : 'depois' })
  } else {
    e.push({ titulo: 'Saiu pra entrega', sub: o === 3 ? 'Ficou pronto, sai em breve' : o === 4 ? (quandoFoi(tempo(p, 'em_entrega', 'a_caminho')) || 'A caminho') : undefined, estado: o >= 5 ? 'feito' : o >= 3 ? 'agora' : 'depois' })
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
  if (o === 3) return ret ? 'Pronto pra retirar' : 'Ficou pronto'
  if (o === 4) return 'Saiu pra entrega'
  return ret ? 'Retirado' : 'Entregue'
}

export function AcompanharPedido({ p, cor, corTopo }: { p: Pedido; cor: string; corTopo?: string }) {
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

      <ul className="acp-itens">
        {itens.map((it, i) => (
          <li key={i}>
            <span className="acp-foto">{it.produtos?.imagem_url ? <img src={it.produtos.imagem_url} alt="" loading="lazy" /> : <Cake size={22} weight="duotone" />}</span>
            <span className="acp-it-nome"><b>{it.nome_produto}</b><small>{qtdTexto(Number(it.quantidade) || 1, it.produtos?.forma_venda)}</small></span>
            <em>{dinheiro((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1))}</em>
          </li>
        ))}
        <li className="acp-total"><b>Total</b><em>{dinheiro(p.valor_total)}</em></li>
      </ul>

      {zap && (
        <a className="acp-zap" href={zap} target="_blank" rel="noreferrer"><IconeWhatsApp size={20} />Falar com a loja no WhatsApp</a>
      )}
    </article>
  )
}
