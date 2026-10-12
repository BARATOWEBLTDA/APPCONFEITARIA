/* Conta do cliente no cardápio (08/10 · 3.31): o que Pedidos e Perfil usam juntos */
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Wallet, Storefront, Truck, UserCircle, WhatsappLogo } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import { Campo, Janela } from '@/components/base'
import { digitosTelefone, linkWhatsApp } from '@/lib/telefone'
import { explicarErro } from '@/lib/erros'
import { lojaAtualWhatsApp } from './lojaAtual'
import { digitosAoDigitar } from './telefoneDigitado'
import './contaCliente.css'

export type Cliente = { id: string; nome: string; telefone: string }
export type ItemPedido = { nome_produto: string; quantidade: number; valor_unitario: number; produtos?: { imagem_url?: string } }
export type Pedido = {
  id: string; numero: number; status: string; created_at: string; valor_total: number
  forma_pagamento: string; status_pagamento: string; tipo_entrega: string
  data_entrega?: string; horario_entrega?: string
  pedido_itens?: ItemPedido[]
}

export const dinheiro = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// 10/10: tira o +55 antes da máscara (antes "+55 41 99999-8888" virava "(55) 41999-9988").
// digitando = no campo, enquanto a pessoa escreve (não confunde o DDD 55 com o código do país)
export const mascaraTel = (v: string, digitando = false) => {
  const n = digitando ? digitosAoDigitar(v) : digitosTelefone(v).slice(0, 11)
  if (n.length > 10) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
  if (n.length > 6) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`
  if (n.length > 2) return `(${n.slice(0, 2)}) ${n.slice(2)}`
  return n
}

const chave = (loja: string) => `cardapio_cliente_${loja}`
export function lerCliente(loja: string): Cliente | null {
  try { const s = localStorage.getItem(chave(loja)); return s ? JSON.parse(s) : null } catch { return null }
}
export function guardarCliente(loja: string, c: Cliente | null) {
  try { if (c) localStorage.setItem(chave(loja), JSON.stringify(c)); else localStorage.removeItem(chave(loja)) } catch { /* sem localStorage */ }
}

/** Pedidos desse telefone nessa loja (função segura no banco) */
export function usePedidosCliente(loja: string, cliente: Cliente | null) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(false)
  const buscar = async () => {
    if (!cliente?.telefone || !loja) { setPedidos([]); return }
    setCarregando(true)
    try {
      const { data, error } = await supabase.rpc('cardapio_pedidos_do_cliente', { p_loja: loja, p_telefone: cliente.telefone })
      if (error) console.error('Erro ao buscar pedidos:', error)
      setPedidos(Array.isArray(data) ? data : [])
    } catch (err) { console.error('Erro ao buscar pedidos:', err) }
    setCarregando(false)
  }
  useEffect(() => { buscar() }, [loja, cliente?.telefone]) // eslint-disable-line react-hooks/exhaustive-deps
  return { pedidos, carregando, buscar }
}

/* ─── Entrar (um passo só: o WhatsApp; se for a primeira vez, pede o nome) ─── */
export function JanelaEntrar({ aberta, aoFechar, loja, cor, aoEntrar }: { aberta: boolean; aoFechar: () => void; loja: string; cor: string; aoEntrar: (c: Cliente) => void }) {
  const [tel, setTel] = useState('')
  const [nome, setNome] = useState('')
  const [novo, setNovo] = useState(false)
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  useEffect(() => { if (aberta) { setTel(''); setNome(''); setNovo(false); setErro('') } }, [aberta])

  const entrar = async () => {
    setErro('')
    const digitos = tel.replace(/\D/g, '')
    if (digitos.length < 10) { setErro('Coloque o número com DDD'); return }
    if (novo && !nome.trim()) { setErro('Falta o seu nome'); return }
    setIndo(true)
    try {
      // Já tem cadastro: só procura. Primeira vez: cria com o nome (a mesma função do pedido)
      const { data: lista, error } = await supabase.rpc('cardapio_cliente', novo
        ? { p_loja: loja, p_telefone: tel, p_nome: nome.trim() }
        : { p_loja: loja, p_telefone: digitos })
      // (11/10) falha na consulta (sem internet, banco fora) não é "número novo":
      // antes a cliente antiga caía no formulário de primeira vez
      if (error) { setErro(explicarErro(error, 'Não deu pra entrar agora. Tente de novo.')); setIndo(false); return }
      const r = Array.isArray(lista) ? lista[0] : null
      if (r) {
        const c = { id: r.id, nome: r.nome, telefone: r.telefone }
        guardarCliente(loja, c); aoEntrar(c); aoFechar()
      } else if (!novo) setNovo(true)
      else setErro('Não deu pra entrar agora. Tente de novo.')
    } catch (err) { setErro(explicarErro(err, 'Não deu pra entrar agora. Tente de novo.')) }
    setIndo(false)
  }

  return (
    <Janela aberta={aberta} aoFechar={aoFechar} tipo="conteudo" titulo={novo ? 'Primeira vez por aqui' : 'Entrar'}
      acoes={<button type="button" className="cc-bt" style={{ background: cor }} disabled={indo} onClick={entrar}>{indo ? 'Entrando…' : novo ? 'Criar e entrar' : 'Continuar'}</button>} umaAcao>
      <div className="cc-entrar">
        <p>{novo ? 'Não achamos esse número. Como você se chama?' : 'Use o WhatsApp que você coloca nos pedidos. Assim você acompanha tudo por aqui.'}</p>
        <Campo rotulo="WhatsApp" value={tel} inputMode="tel" autoComplete="tel" placeholder="(00) 90000-0000" autoFocus={!novo}
          onChange={e => { setTel(mascaraTel(e.target.value, true)); setNovo(false); setErro('') }}
          onKeyDown={e => { if (e.key === 'Enter') entrar() }}
          erro={!novo && erro ? erro : undefined} />
        {novo && (
          <Campo rotulo="Nome" value={nome} autoComplete="name" placeholder="Como você se chama?" autoFocus
            onChange={e => { setNome(e.target.value); setErro('') }}
            onKeyDown={e => { if (e.key === 'Enter') entrar() }}
            erro={erro || undefined} />
        )}
      </div>
    </Janela>
  )
}

/** Tela de quem ainda não entrou */
export function SemConta({ cor, titulo, texto, aoEntrar, icone }: { cor: string; titulo: string; texto: string; aoEntrar: () => void; icone?: ReactNode }) {
  return (
    <div className="cc-sem">
      <span className="cc-sem-ic" style={{ color: cor, background: `${cor}14` }}>{icone || <UserCircle size={40} weight="duotone" />}</span>
      <b>{titulo}</b>
      <p>{texto}</p>
      <button type="button" className="cc-bt" style={{ background: cor }} onClick={aoEntrar}>Entrar com o WhatsApp</button>
    </div>
  )
}

/* ─── Cartão do pedido ─── */
const FEITOS = ['concluido', 'entregue', 'cancelado']
export const pedidoAberto = (p: Pedido) => !FEITOS.includes(p.status)

// 10/10: conhece as situações que o app grava hoje (e as antigas). Antes, tudo o que não era antigo
// caía em "Entregue/Retirado": pedido agendado ou em entrega aparecia como entregue.
function situacao(p: Pedido): { txt: string; passo: number; tom: 'and' | 'ok' | 'off' } {
  const ret = p.tipo_entrega === 'retirada'
  switch (p.status) {
    case 'aguardando_pagamento': return { txt: 'Aguardando pagamento', passo: 1, tom: 'and' }
    case 'novo':
    case 'aguardando_aceite': return { txt: 'Esperando a loja confirmar', passo: 1, tom: 'and' }
    case 'confirmado':
    case 'agendado': return { txt: 'Confirmado', passo: 1, tom: 'and' }
    case 'em_producao':
    case 'em_preparo': return { txt: 'Em produção', passo: 2, tom: 'and' }
    case 'pronto':
    case 'finalizado': return { txt: ret ? 'Pronto pra retirar' : 'Pronto', passo: 3, tom: 'and' }
    case 'aguardando_retirada': return { txt: 'Pronto pra retirar', passo: 3, tom: 'and' }
    case 'a_caminho':
    case 'em_entrega': return { txt: 'Saiu pra entrega', passo: 3, tom: 'and' }
    case 'concluido':
    case 'entregue': return { txt: ret ? 'Retirado' : 'Entregue', passo: 4, tom: 'ok' }
    case 'cancelado': return { txt: 'Cancelado', passo: 0, tom: 'off' }
    // Situação que esta tela não conhece: nunca diz que foi entregue
    default: return { txt: 'Em andamento', passo: 1, tom: 'and' }
  }
}

const PAGAMENTO: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Cartão de crédito', debito: 'Cartão de débito' }

export function CartaoPedido({ p, cor }: { p: Pedido; cor: string }) {
  const s = situacao(p)
  const aberto = pedidoAberto(p)
  const ret = p.tipo_entrega === 'retirada'
  const feito = p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '') : ''
  const quando = p.data_entrega
    ? new Date(p.data_entrega + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '') + (p.horario_entrega ? ` às ${p.horario_entrega.slice(0, 5)}` : '')
    : ''
  const itens = p.pedido_itens || []
  // 10/10: o WhatsApp é o da loja desta aba, e o link trata o +55 e o DDD 55 (lib/telefone)
  const zap = linkWhatsApp(lojaAtualWhatsApp(), `Oi! Queria saber do meu pedido #${p.numero}`)
  const pago = p.status_pagamento === 'pago'
  const pag = PAGAMENTO[p.forma_pagamento] || p.forma_pagamento || ''

  return (
    <article className={`cc-ped${s.tom === 'off' ? ' off' : ''}`}>
      <header className="cc-ped-cab">
        <span><b>Pedido #{p.numero}</b><small>Feito em {feito}</small></span>
        <strong>{dinheiro(p.valor_total)}</strong>
      </header>

      <p className={`cc-sit cc-sit--${s.tom}`}>
        {s.tom === 'ok' ? <i className="cc-sit-ok"><Check size={12} weight="bold" /></i> : <i className="cc-sit-pt" style={s.tom === 'and' ? { background: cor } : undefined} />}
        {s.txt}
      </p>
      {aberto && (
        <div className="cc-passos" aria-hidden="true">
          {[1, 2, 3, 4].map(n => <i key={n} style={n <= s.passo ? { background: cor } : undefined} />)}
        </div>
      )}

      <ul className="cc-itens">
        {itens.slice(0, 3).map((it, i) => (
          <li key={i}><b>{String(Number(it.quantidade) || 1).replace('.', ',')}×</b> {it.nome_produto}</li>
        ))}
        {itens.length > 3 && <li className="cc-mais">e mais {itens.length - 3} {itens.length - 3 === 1 ? 'item' : 'itens'}</li>}
      </ul>

      <div className="cc-ped-pe">
        <span>{ret ? <Storefront size={18} weight="bold" /> : <Truck size={18} weight="bold" />}{ret ? 'Retirada' : 'Entrega'}{quando ? ` · ${quando}` : ''}</span>
        {pag && <span><Wallet size={18} weight="bold" />{pag} · {pago ? <em className="ok">pago</em> : `paga na ${ret ? 'retirada' : 'entrega'}`}</span>}
      </div>

      {aberto && zap && (
        <a className="cc-zap" href={zap} target="_blank" rel="noreferrer">
          <WhatsappLogo size={20} weight="bold" />Falar com a loja
        </a>
      )}
    </article>
  )
}
