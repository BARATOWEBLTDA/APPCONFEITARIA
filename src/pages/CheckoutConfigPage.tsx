// Entrega e pagamento (08/10 · 3.26, no padrão do guia).
// O que salva continua igual (salva sozinho 2s depois de mexer; cupons na tabela loja_cupons).
// Mudou o visual: campos e botões do app, cupom novo/editar numa janela, convite pro PRO sem borrão.
import CampoData from '@/components/CampoData'
import { CalendarBlank, CaretRight, Check, Crown, PencilSimple, CurrencyCircleDollar, Plus, Tag, Ticket, Truck, UserPlus, Users, Wallet, WarningCircle } from "@phosphor-icons/react"
import { cupomDisponivel, MAX_CUPONS_ATIVOS } from '@/lib/cupons'
import { Botao, Campo, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base"
import "@/components/loja/editoresLoja.css"
import "./entregaPagamento.css"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { explicarErro } from "@/lib/erros"
import { parseNumBR } from "@/lib/numeroBR"
import { marcarPagamentoConferido } from "@/lib/primeirosPassos"
import { useNavigate, useLocation } from "react-router-dom"
import AppPageHeader from "@/components/AppPageHeader"
import { usePlano } from "@/hooks/usePlano"

const PAGAMENTOS = [
  { key: 'pix',                label: 'Pix', sub: 'Na hora, sem taxa' },
  { key: 'dinheiro',           label: 'Dinheiro', sub: 'Na entrega ou na retirada' },
  { key: 'credito',            label: 'Cartão de crédito', sub: 'Na maquininha' },
  { key: 'debito',             label: 'Cartão de débito', sub: 'Na maquininha' },
  // 02/10: só as 4 formas (as mesmas que o cliente vê na finalização). As antigas continuam salvas, mas não aparecem.
]

const ENTREGAS = [
  { key: 'retirada',        label: 'Retirada no local', sub: 'O cliente busca no seu endereço' },
  { key: 'entrega_propria', label: 'Entrega própria', sub: 'Você leva até o cliente' },
  { key: 'motoboy',         label: 'Motoboy', sub: 'Um entregador leva pra você' },
  { key: 'uber_flash',      label: 'Uber Flash', sub: 'Você chama pelo app da Uber' },
  { key: 'combinar',        label: 'Combinar pelo WhatsApp', sub: 'Vocês acertam na conversa' },
]

// Converte o que ela digita (10,50 · 1.250,00 · 10.5 · 1.000) em número.
// (11/10) Usa o leitor do app: o daqui lia "1.000" como 1 (pedido mínimo de R$ 1.000 virava R$ 1).
const numBR = parseNumBR

/** (17/10) embutido: aparece dentro de Dados da loja (mesma tela), sem o cabeçalho próprio */
/** (19/10) parte: "entrega" (Dados da loja, sem cupons) ou "cupons" (Marketing › Cupons, só os cupons) */
export default function CheckoutConfigPage({ embutido = false, parte = "tudo" }: { embutido?: boolean; parte?: "tudo" | "entrega" | "cupons" } = {}) {
  const verEntrega = parte !== "cupons", verCupons = parte !== "entrega"
  const navigate = useNavigate()
  // (15/10) aberta por Configurações: o voltar leva de volta pra lá (senão, pro Cardápio)
  const voltarPara = (useLocation().state as any)?.de === "/configuracoes" ? "/configuracoes" : "/cardapio"
  const { isPro } = usePlano()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [savingCupons, setSavingCupons] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [formasPagamento, setFormasPagamento] = useState<string[]>(['pix'])
  const [formasEntrega, setFormasEntrega] = useState<string[]>(['retirada'])
  const [valorEntregaPropria, setValorEntregaPropria] = useState('')
  const [entregaPorBairro, setEntregaPorBairro] = useState<{ bairro: string; valor: string }[]>([])
  const [enderecoRetirada, setEnderecoRetirada] = useState('')
  const [horarioRetirada, setHorarioRetirada] = useState('')
  const [exibirCampoTroco, setExibirCampoTroco] = useState(true)
  const [cupons, setCupons] = useState<{ codigo: string; tipo: string; valor: string; ativo: boolean; data_inicio?: string; data_fim?: string; limite_uso?: string; valor_minimo?: string; usos?: number; publico?: string }[]>([])
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null) // null = lista | -1 = novo | >=0 = editando
  const cupomVazio = { codigo: '', tipo: 'percentual', valor: '', ativo: true, data_inicio: '', data_fim: '', limite_uso: '', valor_minimo: '', publico: 'todos' }
  const [cupomForm, setCupomForm] = useState<typeof cupomVazio>(cupomVazio)
  const [aceitaAgendamento, setAceitaAgendamento] = useState(true)
  const [prazoMinimo, setPrazoMinimo] = useState('24')

  // (10/10) Se a leitura do perfil ou dos cupons falhar, a tela NÃO abre: antes abria com os valores padrão e o
  // salvamento automático gravava isso por cima (formas de entrega, taxas por bairro e todos os cupons sumiam).
  const [erroCarga, setErroCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const load = async () => {
      setErroCarga(false); setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setErroCarga(true); return }
      setUserId(user.id)
      const { data, error } = await supabase.from('profiles').select('formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro, endereco_retirada, horario_retirada, exibir_campo_troco, cupons_desconto, aceita_agendamento, prazo_minimo_horas').eq('id', user.id).single()
      if (error || !data) { setErroCarga(true); return }
      // (13/10) abriu e viu como o cliente vai pagar e receber: conta como o passo "Pagamento e entrega" (salva sozinho)
      marcarPagamentoConferido(user.id)
      if (data) {
        setFormasPagamento(data.formas_pagamento || ['pix'])
        setFormasEntrega(data.formas_entrega || ['retirada'])
        setValorEntregaPropria(data.valor_entrega_propria ? data.valor_entrega_propria.toString() : '')
        setEntregaPorBairro((data.entrega_por_bairro || []).map((b: any) => ({ bairro: b.bairro, valor: b.valor?.toString() || '0' })))
        setEnderecoRetirada(data.endereco_retirada || '')
        setHorarioRetirada(data.horario_retirada || '')
        setExibirCampoTroco(data.exibir_campo_troco !== false)
        // Cupons ficam na tabela privada loja_cupons (fallback: os antigos do perfil)
        const { data: lc, error: erroCupons } = await supabase.from('loja_cupons').select('cupons').eq('user_id', user.id).maybeSingle()
        if (erroCupons) { setErroCarga(true); return }
        const listaCupons = Array.isArray(lc?.cupons) ? lc!.cupons : (data.cupons_desconto || [])
        setCupons((listaCupons || []).map((c: any) => ({
          codigo: c.codigo || '',
          tipo: c.tipo || 'percentual',
          valor: c.valor?.toString() || '0',
          ativo: c.ativo !== false,
          data_inicio: c.data_inicio || '',
          data_fim: c.data_fim || '',
          limite_uso: c.limite_uso?.toString() || '',
          valor_minimo: c.valor_minimo?.toString() || '',
          usos: c.usos || 0,
          publico: c.publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos',
        })))
        setAceitaAgendamento(data.aceita_agendamento !== false)
        setPrazoMinimo(data.prazo_minimo_horas != null ? data.prazo_minimo_horas.toString() : '24')
      }
      setLoading(false)
    }
    load()
  }, [tentativa])

  // 09/10: não salva (nem mostra "Salvo") só por ter aberto a tela; salva depois que algo muda
  const foto = JSON.stringify([formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo])
  const salvoRef = useRef<string | null>(null)
  useEffect(() => { if (!loading) salvoRef.current = foto }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  // 10/10: o que está na tela agora (o salvamento sempre grava o mais novo, inclusive ao sair da tela)
  const telaRef = useRef({ userId, formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, exibirCampoTroco, cupons })
  const pendenteRef = useRef(false)

  /**
   * Grava tudo (10/10). Confere o erro do banco: se falhar, avisa e NÃO diz "Salvo".
   * Os usos de cada cupom vêm do banco na hora de gravar: a tela pode estar com a contagem antiga
   * (um pedido com cupom chegou com a tela aberta) e não pode regravar o número velho por cima.
   */
  const salvarTudo = async (opcoes: { aviso?: string; limparCuponsDoPerfil?: boolean } = {}): Promise<boolean> => {
    const t = telaRef.current
    if (!t.userId) return false
    pendenteRef.current = false
    try {
      const { error: erroPerfil } = await supabase.from('profiles').update({
        formas_pagamento: t.formasPagamento,
        formas_entrega: t.formasEntrega,
        valor_entrega_propria: t.valorEntregaPropria ? numBR(t.valorEntregaPropria) : 0,
        entrega_por_bairro: t.entregaPorBairro.filter(b => b.bairro.trim()).map(b => ({ bairro: b.bairro, valor: numBR(b.valor) })),
        exibir_campo_troco: t.exibirCampoTroco,
      }).eq('id', t.userId)
      if (erroPerfil) throw erroPerfil
      const usosNoBanco: Record<string, number> = {}
      const { data: atual } = await supabase.from('loja_cupons').select('cupons').eq('user_id', t.userId).maybeSingle()
      if (Array.isArray(atual?.cupons)) atual.cupons.forEach((c: any) => { if (c?.codigo) usosNoBanco[String(c.codigo).toUpperCase()] = Number(c.usos) || 0 })
      // Cupons: tabela privada (o visitante do cardápio não consegue ler)
      const cuponsParaSalvar = t.cupons.filter(c => c.codigo.trim()).map(c => ({
        codigo: c.codigo,
        tipo: c.tipo,
        valor: numBR(c.valor),
        ativo: c.ativo,
        data_inicio: c.data_inicio || null,
        data_fim: c.data_fim || null,
        limite_uso: c.limite_uso ? parseInt(c.limite_uso) : null,
        valor_minimo: c.valor_minimo ? numBR(c.valor_minimo) : null,
        publico: c.publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos',
        usos: Math.max(c.usos || 0, usosNoBanco[c.codigo.toUpperCase()] || 0),
      }))
      const { error: erroCupons } = await supabase.from('loja_cupons').upsert({ user_id: t.userId, cupons: cuponsParaSalvar, updated_at: new Date().toISOString() })
      if (erroCupons) throw erroCupons
      // Limpa a cópia antiga do perfil (o cardápio público consegue ler o perfil). Só depois de a tabela nova gravar:
      // se limpasse antes e o upsert falhasse, os cupons sumiam dos dois lugares.
      if (opcoes.limparCuponsDoPerfil) {
        const { error: erroLimpar } = await supabase.from('profiles').update({ cupons_desconto: [] }).eq('id', t.userId)
        if (erroLimpar) console.error('[Doonly] cupons antigos do perfil:', erroLimpar)
      }
      avisar(opcoes.aviso || 'Salvo', { tipo: 'ok' })
      return true
    } catch (err) {
      // Não gravou: continua pendente (tenta de novo na próxima mudança ou ao sair da tela)
      pendenteRef.current = true
      avisar(explicarErro(err, 'Não deu pra salvar. Tente de novo.'), { tipo: 'erro' })
      return false
    }
  }
  const salvarTudoRef = useRef(salvarTudo)
  // Roda a cada mudança, antes dos efeitos de baixo: deixa nas refs o que está na tela agora
  useEffect(() => {
    telaRef.current = { userId, formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, exibirCampoTroco, cupons }
    salvarTudoRef.current = salvarTudo
  })

  useEffect(() => {
    if (loading || !userId) return
    if (salvoRef.current === null || salvoRef.current === foto) return
    salvoRef.current = foto
    pendenteRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { timerRef.current = null; salvarTudoRef.current() }, 2000)
  }, [formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo]) // eslint-disable-line react-hooks/exhaustive-deps

  // 10/10: saiu da tela antes dos 2 s → salva na hora (antes a mudança era descartada em silêncio)
  useEffect(() => () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (pendenteRef.current) salvarTudoRef.current()
  }, [])

  // (11/10) Fechou o app ou a aba (ou mandou pro fundo) antes dos 2 s: salva na hora também.
  // Só grava se tiver mudança esperando; com erro de leitura nada fica esperando, então nada é gravado.
  useEffect(() => {
    const descarregar = () => {
      if (!pendenteRef.current) return
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
      salvarTudoRef.current()
    }
    const aoEsconder = () => { if (document.visibilityState === 'hidden') descarregar() }
    window.addEventListener('pagehide', descarregar)
    document.addEventListener('visibilitychange', aoEsconder)
    return () => {
      window.removeEventListener('pagehide', descarregar)
      document.removeEventListener('visibilitychange', aoEsconder)
    }
  }, [])

  const togglePagamento = (key: string) => {
    setFormasPagamento(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const toggleEntrega = (key: string) => {
    setFormasEntrega(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const abrirNovoCupom = () => {
    setCupomForm(cupomVazio)
    setEditandoIndex(-1)
  }
  const abrirEditarCupom = (i: number) => {
    setCupomForm({
      codigo: cupons[i].codigo,
      tipo: cupons[i].tipo,
      valor: cupons[i].valor,
      ativo: cupons[i].ativo,
      data_inicio: cupons[i].data_inicio || '',
      data_fim: cupons[i].data_fim || '',
      limite_uso: cupons[i].limite_uso || '',
      valor_minimo: cupons[i].valor_minimo || '',
      publico: cupons[i].publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos',
    })
    setEditandoIndex(i)
  }
  const cancelarEdicao = () => {
    setEditandoIndex(null)
    setCupomForm(cupomVazio)
  }
  const salvarCupomForm = () => {
    if (!cupomForm.codigo.trim()) return avisar('Escreva o código do cupom', { tipo: 'erro' })
    if (!cupomForm.valor || numBR(cupomForm.valor) <= 0) return avisar('Escreva quanto é o desconto', { tipo: 'erro' })
    // 10/10: desconto em porcentagem vai até 100
    if (cupomForm.tipo === 'percentual' && numBR(cupomForm.valor) > 100) return avisar('O desconto em porcentagem vai até 100%', { tipo: 'erro' })
    if (cupomForm.data_inicio && cupomForm.data_fim && cupomForm.data_fim < cupomForm.data_inicio) {
      return avisar('A data do fim tem que ser depois da do começo', { tipo: 'erro' })
    }
    // (20/10) até 3 cupons ativos por vez (o cliente usa 1 por pedido)
    const outrosAtivos = cupons.filter((c, idx) => c.ativo && idx !== editandoIndex).length
    if (cupomForm.ativo && outrosAtivos >= MAX_CUPONS_ATIVOS) return avisar(`Você já tem ${MAX_CUPONS_ATIVOS} cupons ativos. Pause um deles ou salve este pausado.`, { tipo: 'erro' })
    setCupons(prev => {
      if (editandoIndex === -1) return [...prev, { ...cupomForm, usos: 0 }]
      return prev.map((c, idx) => idx === editandoIndex ? { ...cupomForm, usos: c.usos || 0 } : c)
    })
    setEditandoIndex(null)
    setCupomForm(cupomVazio)
  }
  const excluirCupomEditando = async () => {
    if (editandoIndex === null || editandoIndex < 0) return
    const ok = await confirmar({ titulo: `Excluir o cupom ${cupons[editandoIndex]?.codigo || ''}?`, texto: 'Ele para de funcionar no cardápio. Não dá pra desfazer.', rotulo: 'Excluir', rotuloVoltar: 'Cancelar', perigo: true })
    if (!ok) return
    setCupons(prev => prev.filter((_, idx) => idx !== editandoIndex))
    setEditandoIndex(null)
    setCupomForm(cupomVazio)
  }

  const handleSalvarCupons = async () => {
    if (!userId) return
    // 10/10: grava tudo de uma vez (o que estava esperando os 2 s vai junto, sem gravar duas vezes) e confere o erro
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setSavingCupons(true)
    await salvarTudo({ aviso: 'Cupons salvos', limparCuponsDoPerfil: true })
    setSavingCupons(false)
  }

  const formatDate = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }

  // (17/10) já preenchido aparece resumido, com "Editar" (o mesmo padrão de Dados da loja). Tudo continua salvando sozinho.
  const [resumido, setResumido] = useState<{ pag: boolean; ent: boolean } | null>(null)
  useEffect(() => {
    if (!loading && !erroCarga && resumido === null) setResumido({ pag: formasPagamento.length > 0, ent: formasEntrega.length > 0 })
  }, [loading, erroCarga, resumido]) // eslint-disable-line react-hooks/exhaustive-deps
  const botaoEditar = (b: 'pag' | 'ent') => resumido?.[b]
    ? <button type="button" className="ep-editar" onClick={() => setResumido(r => r ? { ...r, [b]: false } : r)}><PencilSimple size={16} weight="bold" aria-hidden="true" />Editar</button>
    : undefined
  const CURTO_PAG: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }

  const Cabeca = ({ Ic, titulo, apoio, acao }: { Ic: typeof Wallet; titulo: string; apoio?: string; acao?: React.ReactNode }) => (
    <div className="ep-cab"><span className="ep-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio} acao={acao}>{titulo}</Titulo></div>
  )
  // (15/10) mesmo visual dos primeiros passos: caixinha à esquerda, nome e uma linha explicando
  const Marcar = ({ on, rotulo, sub, aoTocar }: { on: boolean; rotulo: string; sub?: string; aoTocar: () => void }) => (
    <button type="button" role="checkbox" aria-checked={on} className={on ? "on" : ""} onClick={aoTocar}>
      <i aria-hidden="true">{on && <Check size={13} weight="bold" />}</i><span><b>{rotulo}</b>{sub && <small><em>{sub}</em></small>}</span>
    </button>
  )
  const Chave = ({ on, rotulo, apoio, aoMudar }: { on: boolean; rotulo: string; apoio?: string; aoMudar: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} className="ep-sw-l" onClick={() => aoMudar(!on)}>
      <span className="ep-sw-tx"><b>{rotulo}</b>{apoio && <small>{apoio}</small>}</span><span className="ep-sw" aria-hidden="true" />
    </button>
  )
  const dinheiroBR = (v: string) => { const n = numBR(v); return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
  const descontoDe = (c: { tipo: string; valor: string }) => c.tipo === 'percentual' ? `${c.valor}% de desconto` : `R$ ${dinheiroBR(c.valor)} de desconto`

  // com erro, "loading" continua ligado: o salvamento automático só arma depois de uma leitura que deu certo
  if (erroCarga) return (
    <>
      {!embutido && <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate(voltarPara)} />}
      <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu pra carregar" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
    </>
  )
  if (loading) return (
    <>
      {!embutido && <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate(voltarPara)} />}
      <div className="ep-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
    </>
  )

  const formAberto = editandoIndex !== null

  return (
    <>
      {!embutido && <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate(voltarPara)} />}
      <div className={embutido ? "ep ep--embutido" : "ep"}>
        {embutido && verEntrega && <h2 className="ep-sec-tit">Entrega e pagamento</h2>}
        {verEntrega && <p className="ep-salva"><Check size={16} weight="bold" aria-hidden="true" />{embutido ? "Esta parte salva sozinha." : "Tudo aqui salva sozinho."}</p>}

        {verEntrega && <>
        {/* Pagamento */}
        <section className="ep-card">
          <Cabeca Ic={Wallet} titulo={resumido?.pag ? "Pagamento" : "Formas de pagamento"} apoio={resumido?.pag ? undefined : "Marque só as que você aceita"} acao={botaoEditar('pag')} />
          {resumido?.pag ? (
            <div className="ep-res">
              <div className="ep-res-chips">{PAGAMENTOS.filter(p => formasPagamento.includes(p.key)).map(p => <span key={p.key}>{CURTO_PAG[p.key] || p.label}</span>)}</div>
              {formasPagamento.includes('dinheiro') && exibirCampoTroco && <small className="ep-res-obs">Pergunta o troco no dinheiro</small>}
            </div>
          ) : (<>
          <div className="ppf-mos ppf-mos--chk">
            {PAGAMENTOS.map(p => <Marcar key={p.key} on={formasPagamento.includes(p.key)} rotulo={p.label} sub={p.sub} aoTocar={() => togglePagamento(p.key)} />)}
          </div>
          {formasPagamento.includes('dinheiro') && (
            <Chave on={exibirCampoTroco} rotulo='Perguntar "Troco pra quanto?"' apoio="Quando o cliente pagar em dinheiro" aoMudar={setExibirCampoTroco} />
          )}
          </>)}
        </section>

        {/* Entrega */}
        <section className="ep-card">
          <Cabeca Ic={Truck} titulo={resumido?.ent ? "Entrega" : "Formas de entrega"} apoio={resumido?.ent ? undefined : "Marque as que o cliente pode escolher"} acao={botaoEditar('ent')} />
          {resumido?.ent ? (
            <div className="ep-res">
              {ENTREGAS.filter(e => formasEntrega.includes(e.key)).map(e => (
                <span key={e.key} className="ep-res-li"><Check size={16} weight="bold" aria-hidden="true" />{e.label}
                  {e.key === 'entrega_propria' && <em>{numBR(valorEntregaPropria) > 0 ? `R$ ${dinheiroBR(valorEntregaPropria)}` : 'Grátis'}</em>}</span>
              ))}
            </div>
          ) : (<>
          <div className="ppf-mos ppf-mos--chk">
            {ENTREGAS.map(e => <Marcar key={e.key} on={formasEntrega.includes(e.key)} rotulo={e.label} sub={e.sub} aoTocar={() => toggleEntrega(e.key)} />)}
          </div>
          {formasEntrega.includes('entrega_propria') && (
            <div className="ep-taxa">
              <Campo rotulo="Taxa da entrega própria" prefixo="R$" inputMode="decimal" placeholder="0,00" value={valorEntregaPropria}
                dica="Cobrada em todo pedido com entrega própria"
                onChange={e => setValorEntregaPropria(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </div>
          )}
          </>)}
        </section>

        </>}

        {/* Cupons */}
        {verCupons && <section className="ep-card ep-largo">
          <Cabeca Ic={Ticket} titulo="Cupons de desconto" apoio={`Até ${MAX_CUPONS_ATIVOS} ativos por vez. Os ativos aparecem no topo do cardápio, e o cliente usa 1 por pedido.`}
 />
          {!cupomDisponivel(isPro) ? (
            <div className="ep-pro">
              <p>Crie cupons pra atrair clientes novos e trazer de volta quem já comprou.</p>
              <Botao variante="vinho" icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>
            </div>
          ) : cupons.length === 0 ? (
            <div className="ep-vazio">
              <p>Nenhum cupom ainda.</p>
              <Botao icone={<Plus size={20} weight="bold" />} onClick={abrirNovoCupom}>Criar cupom</Botao>
            </div>
          ) : (
            <>
              <div className="ep-cupons">
                {cupons.map((c, i) => (
                  <button key={i} type="button" className={`ep-cupom${c.ativo ? '' : ' off'}`} onClick={() => abrirEditarCupom(i)}>
                    <span className="ep-cupom-ic" aria-hidden="true"><Tag size={20} weight="bold" /></span>
                    <span className="ep-cupom-tx">
                      <b>{c.codigo}</b>
                      <span className="ep-cupom-d">{descontoDe(c)}</span>
                      {(c.publico === 'primeiro_pedido' || c.data_inicio || c.data_fim || c.limite_uso || c.valor_minimo) && (
                        <span className="ep-cupom-tags">
                          {c.publico === 'primeiro_pedido' && <small><UserPlus size={14} weight="bold" />Só no 1º pedido</small>}
                          {(c.data_inicio || c.data_fim) && <small><CalendarBlank size={14} weight="bold" />{c.data_inicio && c.data_fim ? `${formatDate(c.data_inicio)} a ${formatDate(c.data_fim)}` : c.data_fim ? `Até ${formatDate(c.data_fim)}` : `A partir de ${formatDate(c.data_inicio!)}`}</small>}
                          {c.limite_uso && <small><Users size={14} weight="bold" />{c.usos || 0} de {c.limite_uso} usos</small>}
                          {c.valor_minimo && <small><CurrencyCircleDollar size={14} weight="bold" />Mínimo R$ {dinheiroBR(c.valor_minimo)}</small>}
                        </span>
                      )}
                    </span>
                    <span className={`ep-cupom-sit ${c.ativo ? 'on' : ''}`}>{c.ativo ? 'Ativo' : 'Pausado'}</span>
                    <CaretRight size={16} weight="bold" className="ep-seta" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="ep-cupons-pe">
                <Botao variante="suave" icone={<Plus size={20} weight="bold" />} onClick={abrirNovoCupom}>Novo cupom</Botao>
                <Botao variante="secundario" carregando={savingCupons} onClick={handleSalvarCupons}>{savingCupons ? 'Salvando…' : 'Salvar cupons'}</Botao>
              </div>
            </>
          )}
        </section>}
      </div>

      {/* Novo / editar cupom */}
      <Janela aberta={formAberto} aoFechar={cancelarEdicao} tipo="conteudo" travada titulo={editandoIndex === -1 ? 'Novo cupom' : 'Editar cupom'}
        acoes={<><Botao variante="secundario" onClick={cancelarEdicao}>Cancelar</Botao><Botao onClick={salvarCupomForm}>{editandoIndex === -1 ? 'Criar cupom' : 'Salvar'}</Botao></>}>
        {formAberto && (
          <div className="ep-form">
            <Campo rotulo="Código do cupom" obrigatorio placeholder="Ex.: PROMO10" value={cupomForm.codigo} className="ep-codigo"
              dica="O cliente digita esse código ao finalizar o pedido"
              onChange={e => setCupomForm({ ...cupomForm, codigo: e.target.value.toUpperCase().replace(/\s/g, '') })} />
            <div className="ui-campo">
              <span className="ui-campo-r" id="ep-tipo"><span>Tipo de desconto</span></span>
              <div className="ep-seg" role="radiogroup" aria-labelledby="ep-tipo">
                <button type="button" role="radio" aria-checked={cupomForm.tipo === 'percentual'} onClick={() => setCupomForm({ ...cupomForm, tipo: 'percentual' })}>Porcentagem (%)</button>
                <button type="button" role="radio" aria-checked={cupomForm.tipo !== 'percentual'} onClick={() => setCupomForm({ ...cupomForm, tipo: 'fixo' })}>Valor (R$)</button>
              </div>
            </div>
            <Campo rotulo="Desconto" obrigatorio inputMode="decimal" placeholder="0" value={cupomForm.valor}
              prefixo={cupomForm.tipo === 'percentual' ? undefined : 'R$'} depois={cupomForm.tipo === 'percentual' ? <span className="ep-depois">%</span> : undefined}
              onChange={e => setCupomForm({ ...cupomForm, valor: e.target.value.replace(/[^0-9.,]/g, '') })} />

            {/* (20/10) para quem: todos ou só cliente novo (1º pedido, pelo WhatsApp) */}
            <div className="ui-campo">
              <span className="ui-campo-r" id="ep-publico"><span>Para quem</span></span>
              <div className="ep-seg" role="radiogroup" aria-labelledby="ep-publico">
                <button type="button" role="radio" aria-checked={cupomForm.publico !== 'primeiro_pedido'} onClick={() => setCupomForm({ ...cupomForm, publico: 'todos' })}>Todos os clientes</button>
                <button type="button" role="radio" aria-checked={cupomForm.publico === 'primeiro_pedido'} onClick={() => setCupomForm({ ...cupomForm, publico: 'primeiro_pedido' })}>Cliente novo</button>
              </div>
              <small className="ep-dica">{cupomForm.publico === 'primeiro_pedido' ? 'Vale só no 1º pedido de cada WhatsApp na sua loja.' : 'Qualquer cliente pode usar.'}</small>
            </div>

            <p className="ep-sep">Se quiser, limite o cupom</p>
            <div className="ep-g2">
              <div className="ui-campo"><span className="ui-campo-r"><span>Vale a partir de</span><small>opcional</small></span>
                <CampoData valor={cupomForm.data_inicio} onChange={d => setCupomForm({ ...cupomForm, data_inicio: d })} max={cupomForm.data_fim || undefined} titulo="Cupom vale a partir de" placeholder="Sem começo" curto /></div>
              <div className="ui-campo"><span className="ui-campo-r"><span>Vale até</span><small>opcional</small></span>
                <CampoData valor={cupomForm.data_fim} onChange={d => setCupomForm({ ...cupomForm, data_fim: d })} min={cupomForm.data_inicio || undefined} titulo="Cupom vale até" placeholder="Sem fim" curto /></div>
            </div>
            <div className="ep-g2">
              <Campo rotulo="Limite de usos" opcional inputMode="numeric" placeholder="Sem limite" value={cupomForm.limite_uso}
                onChange={e => setCupomForm({ ...cupomForm, limite_uso: e.target.value.replace(/\D/g, '') })} />
              <Campo rotulo="Pedido mínimo" opcional prefixo="R$" inputMode="decimal" placeholder="0,00" value={cupomForm.valor_minimo}
                onChange={e => setCupomForm({ ...cupomForm, valor_minimo: e.target.value.replace(/[^0-9.,]/g, '') })} />
            </div>
            <Chave on={cupomForm.ativo} rotulo="Cupom ativo" apoio="Desligado, o cliente não consegue usar" aoMudar={v => setCupomForm({ ...cupomForm, ativo: v })} />
            {editandoIndex !== null && editandoIndex >= 0 && (
              <Botao variante="link" className="ep-excluir" onClick={excluirCupomEditando}>Excluir cupom</Botao>
            )}
          </div>
        )}
      </Janela>
    </>
  )
}
