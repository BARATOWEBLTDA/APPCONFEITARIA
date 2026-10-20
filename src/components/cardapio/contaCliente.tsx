/* Conta do cliente no cardápio (08/10 · 3.31): o que Pedidos e Perfil usam juntos */
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Wallet, Storefront, Truck, UserCircle } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/IconeWhatsApp'
import { supabase } from '@/lib/supabase'
import { Campo, Janela } from '@/components/base'
import { digitosTelefone, linkWhatsApp } from '@/lib/telefone'
import { explicarErro } from '@/lib/erros'
import { lojaAtualWhatsApp } from './lojaAtual'
import { digitosAoDigitar } from './telefoneDigitado'
import './contaCliente.css'

/** token: código de acesso que o banco dá depois de um pedido ou de entrar com o número de um pedido (4.23) */
export type Cliente = { id: string; nome: string; telefone: string; token?: string }
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
  try { window.dispatchEvent(new Event('doonly:cliente')) } catch { /* sem window */ } // (20/10) o topo do computador mostra o nome
}

/** A função nova ainda não existe no banco (SQL 4.23 não rodado) */
export const semFuncaoNova = (e: any) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function/i.test(String(e.message || '')))

/** Pedidos desse telefone nessa loja (função segura no banco) */
export function usePedidosCliente(loja: string, cliente: Cliente | null) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(false)
  const buscar = async () => {
    if (!cliente?.telefone || !loja) { setPedidos([]); return }
    setCarregando(true)
    try {
      // (4.23) com o código de acesso; sem a função nova no banco, busca do jeito antigo
      let { data, error } = await supabase.rpc('cardapio_pedidos_do_cliente', { p_loja: loja, p_telefone: cliente.telefone, p_token: cliente.token || '' })
      if (error && semFuncaoNova(error)) ({ data, error } = await supabase.rpc('cardapio_pedidos_do_cliente', { p_loja: loja, p_telefone: cliente.telefone }))
      if (error) console.error('Erro ao buscar pedidos:', error)
      setPedidos(Array.isArray(data) ? data : [])
    } catch (err) { console.error('Erro ao buscar pedidos:', err) }
    setCarregando(false)
  }
  useEffect(() => { buscar() }, [loja, cliente?.telefone]) // eslint-disable-line react-hooks/exhaustive-deps
  return { pedidos, carregando, buscar }
}

/* ─── Entrar (4.23): o WhatsApp; quem já pediu confirma com o número de um pedido; quem nunca pediu diz o nome ─── */
export function JanelaEntrar({ aberta, aoFechar, loja, cor, aoEntrar }: { aberta: boolean; aoFechar: () => void; loja: string; cor: string; aoEntrar: (c: Cliente) => void }) {
  const [tel, setTel] = useState('')
  const [nome, setNome] = useState('')
  const [numero, setNumero] = useState('')
  const [etapa, setEtapa] = useState<'tel' | 'numero' | 'novo'>('tel')
  const [erro, setErro] = useState('')
  const [indo, setIndo] = useState(false)
  useEffect(() => { if (aberta) { setTel(''); setNome(''); setNumero(''); setEtapa('tel'); setErro('') } }, [aberta])

  // Jeito antigo (sem a função cardapio_entrar no banco): procura pelo telefone e, se for novo, pede o nome
  const entrarAntigo = async (digitos: string) => {
    const { data: lista, error } = await supabase.rpc('cardapio_cliente', etapa === 'novo'
      ? { p_loja: loja, p_telefone: tel, p_nome: nome.trim() }
      : { p_loja: loja, p_telefone: digitos })
    if (error) { setErro(explicarErro(error, 'Não deu pra entrar agora. Tente de novo.')); return }
    const r = Array.isArray(lista) ? lista[0] : null
    if (r) { const c = { id: r.id, nome: r.nome, telefone: r.telefone }; guardarCliente(loja, c); aoEntrar(c); aoFechar() }
    else if (etapa !== 'novo') setEtapa('novo')
    else setErro('Não deu pra entrar agora. Tente de novo.')
  }

  const entrar = async () => {
    setErro('')
    const digitos = tel.replace(/\D/g, '')
    if (digitos.length < 10) { setErro('Coloque o número com DDD'); return }
    if (etapa === 'novo' && !nome.trim()) { setErro('Falta o seu nome'); return }
    const num = parseInt(numero.replace(/\D/g, ''), 10)
    if (etapa === 'numero' && !num) { setErro('Coloque o número de um pedido seu'); return }
    setIndo(true)
    try {
      const { data, error } = await supabase.rpc('cardapio_entrar', {
        p_loja: loja, p_telefone: tel, p_numero: etapa === 'numero' ? num : null, p_nome: etapa === 'novo' ? nome.trim() : null,
      })
      if (error && semFuncaoNova(error)) { await entrarAntigo(digitos); setIndo(false); return }
      // (11/10) falha na consulta (sem internet, banco fora) não é "número novo"
      if (error) { setErro(explicarErro(error, 'Não deu pra entrar agora. Tente de novo.')); setIndo(false); return }
      const r: any = data
      if (r?.status === 'ok' && r.cliente) {
        const c: Cliente = { id: r.cliente.id, nome: r.cliente.nome, telefone: r.cliente.telefone || tel, token: r.token }
        guardarCliente(loja, c); aoEntrar(c); aoFechar()
      } else if (r?.status === 'precisa_numero') setEtapa('numero')
      else if (r?.status === 'novo') setEtapa('novo')
      else setErro(r?.erro || 'Não deu pra entrar agora. Tente de novo.')
    } catch (err) { setErro(explicarErro(err, 'Não deu pra entrar agora. Tente de novo.')) }
    setIndo(false)
  }

  const titulo = etapa === 'novo' ? 'Primeira vez por aqui' : 'Entrar'
  const texto = etapa === 'novo' ? 'Não achamos pedidos desse número. Como você se chama?'
    : etapa === 'numero' ? 'Pra sua segurança, confirme com o número de um pedido que você já fez aqui. Ele aparece na confirmação e na conversa do WhatsApp.'
    : 'Use o WhatsApp que você coloca nos pedidos. Assim você acompanha tudo por aqui.'

  return (
    <Janela aberta={aberta} aoFechar={aoFechar} tipo="conteudo" titulo={titulo}
      acoes={<button type="button" className="cc-bt" style={{ background: cor }} disabled={indo} onClick={entrar}>{indo ? 'Entrando…' : etapa === 'novo' ? 'Criar e entrar' : etapa === 'numero' ? 'Entrar' : 'Continuar'}</button>} umaAcao>
      <div className="cc-entrar">
        <p>{texto}</p>
        <Campo rotulo="WhatsApp" value={tel} inputMode="tel" autoComplete="tel" placeholder="(41) 9 9999-0000" autoFocus={etapa === 'tel'}
          onChange={e => { setTel(mascaraTel(e.target.value, true)); setEtapa('tel'); setErro('') }}
          onKeyDown={e => { if (e.key === 'Enter') entrar() }}
          erro={etapa === 'tel' && erro ? erro : undefined} />
        {etapa === 'numero' && (
          <Campo rotulo="Número de um pedido seu" value={numero} inputMode="numeric" placeholder="Ex.: 1049" autoFocus
            onChange={e => { setNumero(e.target.value.replace(/\D/g, '').slice(0, 9)); setErro('') }}
            onKeyDown={e => { if (e.key === 'Enter') entrar() }}
            erro={erro || undefined} />
        )}
        {etapa === 'novo' && (
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
          <IconeWhatsApp size={20} />Falar com a loja
        </a>
      )}
    </article>
  )
}
