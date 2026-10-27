// Entrega e pagamento (08/10 · 3.26, no padrão do guia).
// O que salva continua igual (salva sozinho 2s depois de mexer; cupons na tabela loja_cupons).
// Mudou o visual: campos e botões do app, cupom novo/editar numa janela, convite pro PRO sem borrão.
import CampoData from '@/components/CampoData'
import { Check, Crown, PencilSimple, Plus, Trash, QrCode, ShareNetwork, Ticket, Truck, Wallet, WarningCircle, PixLogo, Money, CreditCard, Storefront, Moped, Motorcycle, Car, ChatCircleText } from "@phosphor-icons/react"
import type { Icon } from "@phosphor-icons/react"
import ListaChaves from "@/components/loja/ListaChaves"
import { normalizarChave, problemaNaChave, tipoDaChave, type TipoChave } from '@/lib/pix'
import { cupomDisponivel, MAX_CUPONS_ATIVOS, regraCupom, textoDesconto } from '@/lib/cupons'
import type { DadosImagemCupom } from '@/lib/imagemCupom'
import ImagemCupom from '@/components/marketing/ImagemCupom'
import { fotoDaLoja, getCardapioUrl, useProfile } from '@/hooks/useProfile'
import { Botao, Campo, Janela, TelaVazia, Titulo, avisar, confirmar } from "@/components/base"
import "@/components/loja/editoresLoja.css"
import "./entregaPagamento.css"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { explicarErro } from "@/lib/erros"
import { parseNumBR, mascaraReais, reaisParaCampo } from "@/lib/numeroBR"
import { marcarPagamentoConferido } from "@/lib/primeirosPassos"
import { useNavigate, useLocation } from "react-router-dom"
import AppPageHeader from "@/components/AppPageHeader"
import { usePlano } from "@/hooks/usePlano"
import { LIMITE_CUPONS_ATIVOS_GRATIS } from '@/lib/limitesPlano'

const PAGAMENTOS = [
  { key: 'pix',                label: 'Pix', sub: 'Na hora, sem taxa' },
  { key: 'dinheiro',           label: 'Dinheiro', sub: 'Na entrega ou na retirada' },
  { key: 'credito',            label: 'Cartão de crédito', sub: 'Na maquininha' },
  { key: 'debito',             label: 'Cartão de débito', sub: 'Na maquininha' },
  // 02/10: só as 4 formas (as mesmas que o cliente vê na finalização). As antigas continuam salvas, mas não aparecem.
]

const ICONE_PAG: Record<string, Icon> = { pix: PixLogo, dinheiro: Money, credito: CreditCard, debito: CreditCard }
const ICONE_ENT: Record<string, Icon> = { retirada: Storefront, entrega_propria: Moped, motoboy: Motorcycle, uber_flash: Car, combinar: ChatCircleText }

const ENTREGAS = [
  { key: 'retirada',        label: 'Retirada no local', sub: 'Busca no seu endereço' },
  { key: 'entrega_propria', label: 'Entrega própria', sub: 'Você leva até o cliente' },
  { key: 'motoboy',         label: 'Motoboy', sub: 'Um entregador leva para você' },
  { key: 'uber_flash',      label: 'Uber Flash', sub: 'Você chama pelo app da Uber' },
  { key: 'combinar',        label: 'Combinar pelo WhatsApp', sub: 'Vocês acertam na conversa' },
]

// Converte o que ela digita (10,50 · 1.250,00 · 10.5 · 1.000) em número.
// (11/10) Usa o leitor do app: o daqui lia "1.000" como 1 (pedido mínimo de R$ 1.000 virava R$ 1).
const numBR = parseNumBR

type PixTela = { pixOnline: boolean; pixTipo: TipoChave; pixChave: string; pixNome: string; pixCidade: string; pixModo: string; pixPct: string }
const pctDoSinal = (v: string) => Math.min(90, Math.max(10, Math.round(Number(String(v).replace(',', '.')) || 50)))
/** O que falta pra ligar o Pix pelo cardápio ('' = está tudo certo) */
const faltaNoPix = (x: PixTela) => problemaNaChave(x.pixChave, x.pixTipo) || (!x.pixNome.trim() ? 'Escreva o nome de quem recebe' : !x.pixCidade.trim() ? 'Escreva a cidade' : '')
const pixParaSalvar = (x: PixTela) => ({
  pix_online: x.pixOnline && !faltaNoPix(x),
  pix_chave: normalizarChave(x.pixChave, x.pixTipo) || null,
  pix_nome: x.pixNome.trim() || null,
  pix_cidade: x.pixCidade.trim() || null,
  pix_modo: x.pixModo === 'sinal' || x.pixModo === 'total' ? x.pixModo : 'escolha',
  pix_sinal_pct: pctDoSinal(x.pixPct),
})

/** (17/10) embutido: aparece dentro de Dados da loja (mesma tela), sem o cabeçalho próprio */
/** (19/10) parte: "entrega" (Dados da loja, sem cupons) ou "cupons" (Marketing › Cupons, só os cupons) */
/** (22/10) celular, Dados da loja: o que está na tela, pra lista mostrar o resumo de cada parte */
export type EstadoEntregaPagamento = { formasPagamento: string[]; formasEntrega: string[]; taxa: number; porBairro: number; pixOnline: boolean; pixPronto: boolean; pixTipo: string; pixModo: string; pixPct: string }
/** (27/10) Gravação da tela de Entrega e pagamento em andamento (Pagamento, Pix e Entrega abrem a mesma tela) */
let gravacaoEmAndamento: Promise<unknown> | null = null

export default function CheckoutConfigPage({ embutido = false, parte = "tudo", so, onEstado }: { embutido?: boolean; parte?: "tudo" | "entrega" | "cupons"; so?: "pag" | "pix" | "ent"; onEstado?: (e: EstadoEntregaPagamento) => void } = {}) {
  const verEntrega = parte !== "cupons", verCupons = parte !== "entrega"
  const navigate = useNavigate()
  // (15/10) aberta por Configurações: o voltar leva de volta pra lá (senão, pro Cardápio)
  const voltarPara = (useLocation().state as any)?.de === "/configuracoes" ? "/configuracoes" : "/cardapio"
  const { isPro } = usePlano()
  const { profile } = useProfile()
  const [imagemCupom, setImagemCupom] = useState<DadosImagemCupom | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [savingCupons, setSavingCupons] = useState(false)
  const cuponsAntigosNoPerfil = useRef(false) // (27/10) os cupons ainda vieram do perfil antigo: o próximo salvar limpa a cópia de lá
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
  // (20/10) Pix pelo cardápio: desligado = tudo como antes (o cliente combina no WhatsApp)
  const [pixOnline, setPixOnline] = useState(false)
  const [pixTipo, setPixTipo] = useState<TipoChave>('cpf')
  const [pixChave, setPixChave] = useState('')
  const [pixNome, setPixNome] = useState('')
  const [pixCidade, setPixCidade] = useState('')
  const [pixModo, setPixModo] = useState<'escolha' | 'sinal' | 'total'>('escolha')
  const [pixPct, setPixPct] = useState('50')
  // (27/10) "Outro" fica aberto mesmo digitando 30 ou 50 (antes o campo sumia no meio da digitação)
  const [pctOutro, setPctOutro] = useState(false)

  // (10/10) Se a leitura do perfil ou dos cupons falhar, a tela NÃO abre: antes abria com os valores padrão e o
  // salvamento automático gravava isso por cima (formas de entrega, taxas por bairro e todos os cupons sumiam).
  const [erroCarga, setErroCarga] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const load = async () => {
      setErroCarga(false); setLoading(true)
      if (gravacaoEmAndamento) await gravacaoEmAndamento // a tela de antes ainda estava salvando
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setErroCarga(true); return }
      setUserId(user.id)
      const { data, error } = await supabase.from('profiles').select('formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro, endereco_retirada, horario_retirada, exibir_campo_troco, cupons_desconto, aceita_agendamento, prazo_minimo_horas, pix_online, pix_chave, pix_nome, pix_cidade, pix_modo, pix_sinal_pct, nome_loja, endereco').eq('id', user.id).single()
      if (error || !data) { setErroCarga(true); return }
      // (13/10) abriu e viu como o cliente vai pagar e receber: conta como o passo "Pagamento e entrega" (salva sozinho)
      marcarPagamentoConferido(user.id)
      if (data) {
        setFormasPagamento(data.formas_pagamento || ['pix'])
        setFormasEntrega(data.formas_entrega || ['retirada'])
        setValorEntregaPropria(reaisParaCampo(data.valor_entrega_propria))
        setEntregaPorBairro((data.entrega_por_bairro || []).map((b: any) => ({ bairro: b.bairro, valor: reaisParaCampo(b.valor) || '0,00' })))
        setEnderecoRetirada(data.endereco_retirada || '')
        setHorarioRetirada(data.horario_retirada || '')
        setExibirCampoTroco(data.exibir_campo_troco !== false)
        // Cupons ficam na tabela privada loja_cupons (fallback: os antigos do perfil)
        const { data: lc, error: erroCupons } = await supabase.from('loja_cupons').select('cupons').eq('user_id', user.id).maybeSingle()
        if (erroCupons) { setErroCarga(true); return }
        const listaCupons = Array.isArray(lc?.cupons) ? lc!.cupons : (data.cupons_desconto || [])
        cuponsAntigosNoPerfil.current = !Array.isArray(lc?.cupons) && Array.isArray(data.cupons_desconto) && data.cupons_desconto.length > 0
        setCupons((listaCupons || []).map((c: any) => ({
          codigo: c.codigo || '',
          tipo: c.tipo || 'percentual',
          valor: c.valor?.toString() || '0',
          ativo: c.ativo !== false,
          data_inicio: c.data_inicio || '',
          data_fim: c.data_fim || '',
          limite_uso: c.limite_uso?.toString() || '',
          valor_minimo: reaisParaCampo(c.valor_minimo),
          usos: c.usos || 0,
          publico: c.publico === 'primeiro_pedido' ? 'primeiro_pedido' : 'todos',
        })))
        setAceitaAgendamento(data.aceita_agendamento !== false)
        setPrazoMinimo(data.prazo_minimo_horas != null ? data.prazo_minimo_horas.toString() : '24')
        const d: any = data
        setPixOnline(d.pix_online === true)
        const tipo = tipoDaChave(d.pix_chave || '')
        setPixTipo(tipo)
        setPixChave(tipo === 'celular' ? String(d.pix_chave || '').replace(/^\+55/, '') : (d.pix_chave || ''))
        // nome e cidade já vêm da loja (dá pra trocar)
        setPixNome(d.pix_nome || d.nome_loja || '')
        // (27/10) o endereço da loja fica gravado como texto JSON: lê a cidade dele (antes vinha sempre vazia)
        let cidadeLoja = ''
        try { const e = typeof d.endereco === 'string' ? JSON.parse(d.endereco) : d.endereco; cidadeLoja = String(e?.cidade || '') } catch { /* endereço antigo em texto livre */ }
        setPixCidade(d.pix_cidade || cidadeLoja.slice(0, 15))
        setPixModo(d.pix_modo === 'sinal' || d.pix_modo === 'total' ? d.pix_modo : 'escolha')
        setPixPct(String(d.pix_sinal_pct || 50))
        setPctOutro(![30, 50].includes(Number(d.pix_sinal_pct || 50)))
      }
      setLoading(false)
    }
    load()
  }, [tentativa])

  // 09/10: não salva (nem mostra "Salvo") só por ter aberto a tela; salva depois que algo muda
  const foto = JSON.stringify([formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo, pixOnline, pixTipo, pixChave, pixNome, pixCidade, pixModo, pixPct])
  const salvoRef = useRef<string | null>(null)
  useEffect(() => { if (!loading) salvoRef.current = foto }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  // 10/10: o que está na tela agora (o salvamento sempre grava o mais novo, inclusive ao sair da tela)
  const pixTela = { pixOnline, pixTipo, pixChave, pixNome, pixCidade, pixModo, pixPct }
  const telaRef = useRef({ userId, formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, exibirCampoTroco, cupons, pix: pixTela })
  const pendenteRef = useRef(false)

  /**
   * Grava tudo (10/10). Confere o erro do banco: se falhar, avisa e NÃO diz "Salvo".
   * Os usos de cada cupom vêm do banco na hora de gravar: a tela pode estar com a contagem antiga
   * (um pedido com cupom chegou com a tela aberta) e não pode regravar o número velho por cima.
   */
  const salvarTudo = (opcoes: { aviso?: string; limparCuponsDoPerfil?: boolean } = {}): Promise<boolean> => {
    // (27/10) a próxima tela que abrir espera esta gravação terminar antes de ler (senão lia o antigo e gravava por cima)
    const p = salvarTudoAgora(opcoes)
    gravacaoEmAndamento = p.catch(() => false)
    return p
  }
  const salvarTudoAgora = async (opcoes: { aviso?: string; limparCuponsDoPerfil?: boolean } = {}): Promise<boolean> => {
    const t = telaRef.current
    if (!t.userId) return false
    pendenteRef.current = false
    try {
      const { error: erroPerfil } = await supabase.from('profiles').update({
        formas_pagamento: t.formasPagamento,
        formas_entrega: t.formasEntrega,
        valor_entrega_propria: t.valorEntregaPropria ? numBR(t.valorEntregaPropria) : 0,
        entrega_por_bairro: t.entregaPorBairro.map(b => ({ bairro: b.bairro.trim(), valor: Math.max(0, numBR(b.valor) || 0) }))
          .filter((b, i, l) => b.bairro && l.findIndex(x => x.bairro.toLowerCase() === b.bairro.toLowerCase()) === i),
        exibir_campo_troco: t.exibirCampoTroco,
        // (20/10) Pix pelo cardápio: só fica ligado com a chave, o nome e a cidade certos (senão o cardápio paga como antes)
        ...pixParaSalvar(t.pix),
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
      if (opcoes.limparCuponsDoPerfil || cuponsAntigosNoPerfil.current) {
        const { error: erroLimpar } = await supabase.from('profiles').update({ cupons_desconto: [] }).eq('id', t.userId)
        if (erroLimpar) console.error('[Doonly] cupons antigos do perfil:', erroLimpar)
        else cuponsAntigosNoPerfil.current = false
      }
      avisar(opcoes.aviso || 'Salvo', { tipo: 'ok' })
      return true
    } catch (err) {
      // Não gravou: continua pendente (tenta de novo na próxima mudança ou ao sair da tela)
      pendenteRef.current = true
      avisar(explicarErro(err, 'Não deu para salvar. Tente de novo.'), { tipo: 'erro' })
      return false
    }
  }
  const salvarTudoRef = useRef(salvarTudo)
  // Roda a cada mudança, antes dos efeitos de baixo: deixa nas refs o que está na tela agora
  const estadoRef = useRef('')
  useEffect(() => {
    telaRef.current = { userId, formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, exibirCampoTroco, cupons, pix: pixTela }
    salvarTudoRef.current = salvarTudo
    if (onEstado && !loading) {
      const e: EstadoEntregaPagamento = { formasPagamento, formasEntrega, taxa: numBR(valorEntregaPropria), porBairro: entregaPorBairro.filter(b => b.bairro.trim()).length,
        pixOnline, pixPronto: !faltaNoPix(pixTela), pixTipo, pixModo, pixPct }
      const k = JSON.stringify(e)
      if (k !== estadoRef.current) { estadoRef.current = k; onEstado(e) }
    }
  })

  useEffect(() => {
    if (loading || !userId) return
    if (salvoRef.current === null || salvoRef.current === foto) return
    salvoRef.current = foto
    pendenteRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => { timerRef.current = null; salvarTudoRef.current() }, 2000)
  }, [formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo, pixOnline, pixTipo, pixChave, pixNome, pixCidade, pixModo, pixPct]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // (27/10) taxa por bairro: antes o cardápio usava a lista, mas não tinha onde editar
  const [porBairro, setPorBairro] = useState(false)
  useEffect(() => { if (!loading) setPorBairro(entregaPorBairro.length > 0) }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  const mudarBairro = (i: number, campo: 'bairro' | 'valor', v: string) => setEntregaPorBairro(prev => prev.map((b, k) => k === i ? { ...b, [campo]: campo === 'valor' ? v.replace(/[^0-9.,]/g, '') : v } : b))
  const usarTaxaUnica = async () => {
    if (entregaPorBairro.some(b => b.bairro.trim())) {
      const ok = await confirmar({ titulo: 'Usar uma taxa só?', texto: 'A lista de bairros é apagada e vale a taxa única para todos.', rotulo: 'Usar taxa única', rotuloVoltar: 'Voltar' })
      if (!ok) return
    }
    setEntregaPorBairro([]); setPorBairro(false)
  }
  const nomesBairro = entregaPorBairro.map(b => b.bairro.trim().toLowerCase()).filter(Boolean)
  const bairroRepetido = nomesBairro.find((n, i) => nomesBairro.indexOf(n) !== i)

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
    // (27/10) código repetido misturava a contagem de usos dos dois cupons
    const codigoNovo = cupomForm.codigo.trim().toUpperCase()
    if (cupons.some((c, idx) => idx !== editandoIndex && String(c.codigo || '').trim().toUpperCase() === codigoNovo)) return avisar('Já existe um cupom com esse código', { tipo: 'erro' })
    // (27/10) cupom que já nasce sem valer
    if (cupomForm.limite_uso !== '' && cupomForm.limite_uso != null && Number(cupomForm.limite_uso) <= 0) return avisar('O limite de usos tem que ser 1 ou mais', { tipo: 'erro' })
    if (cupomForm.ativo && cupomForm.data_fim && cupomForm.data_fim < hojeIso) return avisar('A data do fim já passou', { tipo: 'erro' })
    // (20/10) cupons ativos por vez (o cliente usa 1 por pedido) · (27/10) grátis: 1; vencido ou esgotado não conta
    const maxAtivos = isPro ? MAX_CUPONS_ATIVOS : LIMITE_CUPONS_ATIVOS_GRATIS
    const outrosAtivos = cupons.filter((c, idx) => idx !== editandoIndex && situacaoCupom(c) === 'Ativo').length
    if (cupomForm.ativo && outrosAtivos >= maxAtivos) return avisar(maxAtivos === 1 ? 'No grátis, 1 cupom ativo por vez. Pause o outro ou salve este pausado.' : `Você já tem ${maxAtivos} cupons ativos. Pause um deles ou salve este pausado.`, { tipo: 'erro' })
    setCupons(prev => {
      if (editandoIndex === -1) return [...prev, { ...cupomForm, usos: 0 }]
      return prev.map((c, idx) => idx === editandoIndex ? { ...cupomForm, usos: c.usos || 0 } : c)
    })
    setEditandoIndex(null)
    setCupomForm(cupomVazio)
  }
  const excluirCupomEditando = async () => {
    if (editandoIndex === null || editandoIndex < 0) return
    const ok = await confirmar({ titulo: `Excluir o cupom ${cupons[editandoIndex]?.codigo || ''}?`, texto: 'Ele para de funcionar no cardápio. Não dá para desfazer.', rotulo: 'Excluir', rotuloVoltar: 'Cancelar', perigo: true })
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

  // (23/10) ticket do cupom: as regras em uma linha só ("Só no 1º pedido · 12 de 50 usos · até 25/12") e a situação
  const diaMes = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
  const hojeIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const detalheCupom = (c: typeof cupons[number]) => {
    const p: string[] = []
    if (c.publico === 'primeiro_pedido') p.push('só no 1º pedido')
    if (c.valor_minimo && numBR(c.valor_minimo) > 0) p.push(`acima de R$ ${dinheiroBR(c.valor_minimo)}`)
    if (c.limite_uso) p.push(`${c.usos || 0} de ${c.limite_uso} usos`)
    else if (c.usos) p.push(`${c.usos} ${c.usos === 1 ? 'uso' : 'usos'}`)
    if (c.data_inicio && c.data_inicio > hojeIso) p.push(`a partir de ${diaMes(c.data_inicio)}`)
    if (c.data_fim) p.push(`até ${diaMes(c.data_fim)}`)
    const t = p.length ? p.join(' · ') : 'vale em qualquer pedido'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }
  const situacaoCupom = (c: typeof cupons[number]) => !c.ativo ? 'Pausado' : c.data_fim && c.data_fim < hojeIso ? 'Vencido' : c.limite_uso && (c.usos || 0) >= Number(c.limite_uso) ? 'Esgotado' : 'Ativo'
  const abrirImagemCupom = (c: typeof cupons[number]) => {
    const vitrine = { codigo: c.codigo, tipo: c.tipo, valor: numBR(c.valor), valor_minimo: c.valor_minimo ? numBR(c.valor_minimo) : null, data_fim: c.data_fim || null, publico: c.publico === 'primeiro_pedido' ? 'primeiro_pedido' as const : 'todos' as const }
    const regra = regraCupom(vitrine)
    const p: any = profile || {}
    setImagemCupom({
      nomeLoja: p.nome_loja || '', logo: fotoDaLoja(p), cor: p.cor_botao || '',
      desconto: textoDesconto(c), regra: regra.charAt(0).toUpperCase() + regra.slice(1),
      validade: c.data_fim && !regra.startsWith('até') ? `Válido até ${diaMes(c.data_fim)}` : undefined,
      codigo: c.codigo, link: getCardapioUrl(profile),
    })
  }

  // (17/10) já preenchido aparece resumido, com "Editar" (o mesmo padrão de Dados da loja). Tudo continua salvando sozinho.
  const [resumidoTela, setResumido] = useState<{ pag: boolean; ent: boolean } | null>(null)
  // (22/10) celular: cada parte abre sozinha numa gaveta, já no formulário (sem o resumo com Editar)
  const resumido = so ? { pag: false, ent: false } : resumidoTela
  useEffect(() => {
    if (!loading && !erroCarga && resumidoTela === null) setResumido({ pag: formasPagamento.length > 0, ent: formasEntrega.length > 0 })
  }, [loading, erroCarga, resumidoTela]) // eslint-disable-line react-hooks/exhaustive-deps
  const botaoEditar = (b: 'pag' | 'ent') => resumido?.[b]
    ? <button type="button" className="ep-editar" onClick={() => setResumido(r => r ? { ...r, [b]: false } : r)}><PencilSimple size={16} weight="bold" aria-hidden="true" />Editar</button>
    : undefined
  const CURTO_PAG: Record<string, string> = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }

  const Cabeca = ({ Ic, titulo, apoio, acao }: { Ic: typeof Wallet; titulo: string; apoio?: string; acao?: React.ReactNode }) => (
    <div className="ep-cab"><span className="ep-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio} acao={acao}>{titulo}</Titulo></div>
  )
  const Chave = ({ on, rotulo, apoio, aoMudar }: { on: boolean; rotulo: string; apoio?: string; aoMudar: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} className="ep-sw-l" onClick={() => aoMudar(!on)}>
      <span className="ep-sw-tx"><b>{rotulo}</b>{apoio && <small>{apoio}</small>}</span><span className="ep-sw" aria-hidden="true" />
    </button>
  )
  const dinheiroBR = (v: string) => { const n = numBR(v); return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  // com erro, "loading" continua ligado: o salvamento automático só arma depois de uma leitura que deu certo
  if (erroCarga) return (
    <>
      {!embutido && <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate(voltarPara)} />}
      <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar" texto="Confira a internet e tente de novo." acao={<Botao variante="suave" tamanho="m" onClick={() => setTentativa(t => t + 1)}>Tentar de novo</Botao>} />
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
        {embutido && verEntrega && !so && <h2 className="ep-sec-tit">Entrega e pagamento</h2>}
        {verEntrega && !so && <p className="ep-salva"><Check size={16} weight="bold" aria-hidden="true" />{embutido ? "Esta parte salva sozinha." : "Tudo aqui salva sozinho."}</p>}

        {verEntrega && <>
        {/* Pagamento */}
        {(!so || so === 'pag') && <section className="ep-card">
          <Cabeca Ic={Wallet} titulo={resumido?.pag ? "Pagamento" : "Formas de pagamento"} apoio={resumido?.pag ? undefined : "Marque só as que você aceita"} acao={botaoEditar('pag')} />
          {resumido?.pag ? (
            <div className="ep-res">
              <div className="ep-res-chips">{PAGAMENTOS.filter(p => formasPagamento.includes(p.key)).map(p => <span key={p.key}>{CURTO_PAG[p.key] || p.label}</span>)}</div>
              {formasPagamento.includes('dinheiro') && exibirCampoTroco && <small className="ep-res-obs">Pergunta o troco no dinheiro</small>}
            </div>
          ) : (<>
          {/* (23/10) lista com chave, igual ao passo "Pagamento e entrega" (antes: caixinhas rosa) */}
          <ListaChaves itens={PAGAMENTOS.map(p => ({ chave: p.key, Ic: ICONE_PAG[p.key] || Wallet, rotulo: p.label, sub: p.sub, on: formasPagamento.includes(p.key), aoTocar: () => togglePagamento(p.key) }))} />
          {formasPagamento.includes('dinheiro') && (
            <Chave on={exibirCampoTroco} rotulo='Perguntar "Troco para quanto?"' apoio="Quando o cliente pagar em dinheiro" aoMudar={setExibirCampoTroco} />
          )}
          </>)}
        </section>}

        {/* (20/10) Pix pelo cardápio */}
        {so === 'pix' && !formasPagamento.includes('pix') && <p className="ep-pix-aviso"><WarningCircle size={18} weight="bold" aria-hidden="true" />Marque Pix em Pagamento para usar o Pix pelo cardápio.</p>}
        {(!so || so === 'pix') && formasPagamento.includes('pix') && (
        <section className="ep-card">
          <Cabeca Ic={QrCode} titulo="Pix pelo cardápio" apoio="O cliente paga com QR Code" />
          <Chave on={pixOnline} rotulo="Receber Pix pelo cardápio" apoio={pixOnline ? 'Você confirma em Pedidos' : 'Desligado: paga pelo WhatsApp'} aoMudar={setPixOnline} />
          {pixOnline && (
            <div className="ep-pix">
              <div className="ui-campo">
                <span className="ui-campo-r" id="ep-pix-tipo"><span>Tipo da chave</span></span>
                <div className="ep-seg ep-seg--4" role="radiogroup" aria-labelledby="ep-pix-tipo">
                  {([['cpf', 'CPF/CNPJ'], ['celular', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Aleatória']] as [TipoChave, string][]).map(([k, n]) => (
                    <button key={k} type="button" role="radio" aria-checked={pixTipo === k} onClick={() => { if (pixTipo !== k) { setPixTipo(k); setPixChave('') } }}>{n}</button>
                  ))}
                </div>
              </div>
              <Campo rotulo="Chave Pix" value={pixChave}
                inputMode={pixTipo === 'cpf' || pixTipo === 'celular' ? 'numeric' : pixTipo === 'email' ? 'email' : 'text'}
                prefixo={pixTipo === 'celular' ? '+55' : undefined}
                placeholder={pixTipo === 'cpf' ? 'Só os números' : pixTipo === 'celular' ? '(41) 9 9999-0000' : pixTipo === 'email' ? 'voce@email.com' : 'Cole a chave aqui'}
                erro={pixChave.trim() && problemaNaChave(pixChave, pixTipo) ? problemaNaChave(pixChave, pixTipo) : undefined}
                onChange={e => setPixChave(e.target.value)} />
              <div className="ep-g2">
                <Campo rotulo="Nome de quem recebe" value={pixNome} maxLength={25} onChange={e => setPixNome(e.target.value)} />
                <Campo rotulo="Cidade" value={pixCidade} maxLength={15} onChange={e => setPixCidade(e.target.value)} />
              </div>
              <div className="ui-campo">
                <span className="ui-campo-r" id="ep-pix-modo"><span>Quanto o cliente paga no Pix</span></span>
                <div className="ppf-mos ppf-mos--chk ep-pix-modo" role="radiogroup" aria-labelledby="ep-pix-modo">
                  {([['escolha', 'O cliente escolhe', 'Sinal ou o total, na hora de pagar'], ['sinal', 'Só o sinal', 'O resto ele paga na entrega'], ['total', 'Só o total', 'Paga tudo antes']] as const).map(([k, n, sub]) => (
                    <button key={k} type="button" role="radio" aria-checked={pixModo === k} className={pixModo === k ? 'on' : ''} onClick={() => setPixModo(k)}>
                      <i aria-hidden="true">{pixModo === k && <Check size={13} weight="bold" />}</i><span><b>{n}</b><small><em>{sub}</em></small></span>
                    </button>
                  ))}
                </div>
              </div>
              {pixModo !== 'total' && (
                <div className="ui-campo">
                  <span className="ui-campo-r" id="ep-pix-pct"><span>Valor do sinal</span></span>
                  <div className="ep-seg" role="radiogroup" aria-labelledby="ep-pix-pct">
                    {['30', '50'].map(v => <button key={v} type="button" role="radio" aria-checked={!pctOutro && pixPct === v} onClick={() => { setPctOutro(false); setPixPct(v) }}>{v}%</button>)}
                    <button type="button" role="radio" aria-checked={pctOutro} onClick={() => { if (!pctOutro) { setPctOutro(true); if (pixPct === '30' || pixPct === '50') setPixPct('40') } }}>Outro</button>
                  </div>
                  {pctOutro && (
                    <div className="ep-pix-pct">
                      <Campo rotulo="Porcentagem do sinal" depois={<span className="ui-campo-pre" aria-hidden="true">%</span>} inputMode="numeric" value={pixPct} maxLength={2} dica="De 10% a 90% do total"
                        onChange={e => setPixPct(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        onBlur={() => setPixPct(String(pctDoSinal(pixPct)))} />
                    </div>
                  )}
                </div>
              )}
              {faltaNoPix(pixTela)
                ? <p className="ep-pix-aviso"><WarningCircle size={18} weight="bold" aria-hidden="true" />{faltaNoPix(pixTela)} para ligar.</p>
                : <p className="ep-pix-ok"><Check size={18} weight="bold" aria-hidden="true" />Pronto: o cliente já vê o Pix.</p>}
            </div>
          )}
        </section>
        )}

        {/* Entrega */}
        {(!so || so === 'ent') && <section className="ep-card">
          <Cabeca Ic={Truck} titulo={resumido?.ent ? "Entrega" : "Formas de entrega"} apoio={resumido?.ent ? undefined : "Marque as que o cliente pode escolher"} acao={botaoEditar('ent')} />
          {resumido?.ent ? (
            <div className="ep-res">
              {ENTREGAS.filter(e => formasEntrega.includes(e.key)).map(e => (
                <span key={e.key} className="ep-res-li"><Check size={16} weight="bold" aria-hidden="true" />{e.label}
                  {e.key === 'entrega_propria' && <em>{entregaPorBairro.some(b => b.bairro.trim()) ? `Por bairro (${entregaPorBairro.filter(b => b.bairro.trim()).length})` : numBR(valorEntregaPropria) > 0 ? `R$ ${dinheiroBR(valorEntregaPropria)}` : 'Grátis'}</em>}</span>
              ))}
            </div>
          ) : (<>
          <ListaChaves itens={ENTREGAS.map(e => ({ chave: e.key, Ic: ICONE_ENT[e.key] || Truck, rotulo: e.label, sub: e.sub, on: formasEntrega.includes(e.key), aoTocar: () => toggleEntrega(e.key) }))} />
          {formasEntrega.includes('entrega_propria') && (
            <div className="ep-taxa">
              <div className="ep-seg" role="radiogroup" aria-label="Como cobrar a entrega">
                <button type="button" role="radio" aria-checked={!porBairro} onClick={() => { if (porBairro) void usarTaxaUnica() }}>Taxa única</button>
                <button type="button" role="radio" aria-checked={porBairro} onClick={() => { if (!porBairro) { setPorBairro(true); if (!entregaPorBairro.length) setEntregaPorBairro([{ bairro: '', valor: '' }]) } }}>Por bairro</button>
              </div>
              {!porBairro ? (
                <Campo rotulo="Taxa da entrega própria" prefixo="R$" inputMode="numeric" placeholder="0,00" value={valorEntregaPropria}
                  dica="Cobrada em todo pedido com entrega própria"
                  onChange={e => setValorEntregaPropria(mascaraReais(e.target.value))} />
              ) : (
                <div className="ep-bairros">
                  {entregaPorBairro.map((b, i) => (
                    <div key={i} className="ep-bairro">
                      <Campo rotulo="" aria-label="Bairro" placeholder="Bairro" value={b.bairro} onChange={e => mudarBairro(i, 'bairro', e.target.value)} />
                      <Campo rotulo="" aria-label="Taxa" prefixo="R$" inputMode="numeric" placeholder="0,00" value={b.valor} onChange={e => mudarBairro(i, 'valor', mascaraReais(e.target.value))} />
                      <button type="button" className="ep-bairro-x" aria-label={`Tirar ${b.bairro || 'este bairro'}`} onClick={() => setEntregaPorBairro(prev => prev.filter((_, k) => k !== i))}><Trash size={20} weight="bold" /></button>
                    </div>
                  ))}
                  {bairroRepetido && <p className="ep-bairro-erro" role="alert">Bairro repetido. Deixe só um.</p>}
                  <Botao variante="link" icone={<Plus size={16} weight="bold" />} onClick={() => setEntregaPorBairro(prev => [...prev, { bairro: '', valor: '' }])}>Adicionar bairro</Botao>
                  <p className="ep-bairro-dica">O cliente escolhe o bairro e paga a taxa dele. Taxa 0 é entrega grátis.</p>
                </div>
              )}
            </div>
          )}
          </>)}
        </section>}

        </>}

        {/* Cupons */}
        {verCupons && <section className="ep-card ep-largo">
          <Cabeca Ic={Ticket} titulo="Cupons de desconto" apoio={isPro ? 'Quantos quiser. Os 2 mais novos aparecem no topo do cardápio, e o cliente usa 1 por pedido.' : '1 ativo por vez. Ele aparece no topo do cardápio, e o cliente usa 1 por pedido.'}
 />
          {!cupomDisponivel(isPro) ? (
            <div className="ep-pro">
              <p>Crie cupons para atrair clientes novos e trazer de volta quem já comprou.</p>
              <Botao variante="vinho" icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>
            </div>
          ) : cupons.length === 0 ? (
            <div className="ep-vazio">
              <p>Nenhum cupom ainda.</p>
              <Botao icone={<Plus size={20} weight="bold" />} onClick={abrirNovoCupom}>Criar cupom</Botao>
            </div>
          ) : (
            <>
              {/* (23/10) cada cupom é um ticket, igual ao que o cliente vê no topo do cardápio; "Compartilhar" monta a imagem do cupom */}
              <div className="ep-cupons">
                {cupons.map((c, i) => {
                  const sit = situacaoCupom(c)
                  return (
                    <div key={i} className={`epv${sit === 'Ativo' ? '' : ' off'}`}>
                      <button type="button" className="epv-t" onClick={() => abrirEditarCupom(i)} aria-label={`Editar o cupom ${c.codigo}`}>
                        <span className="epv-tx"><b>{textoDesconto(c)}</b><small>{detalheCupom(c)}</small></span>
                        <span className={`epv-sit${sit === 'Ativo' ? ' on' : ''}`}><i aria-hidden="true" />{sit}</span>
                      </button>
                      <div className="epv-c">
                        <b>{c.codigo}</b>
                        <button type="button" className="epv-sh" onClick={() => abrirImagemCupom(c)}><ShareNetwork size={16} weight="bold" aria-hidden="true" />Compartilhar</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="ep-cupons-pe">
                <Botao variante="suave" icone={<Plus size={20} weight="bold" />} onClick={abrirNovoCupom}>Novo cupom</Botao>
                {/* (27/10) o "Salvar cupons" saiu: a tela já salva sozinha (o botão confundia depois de criar o cupom) */}
              </div>
            </>
          )}
        </section>}
      </div>

      <ImagemCupom dados={imagemCupom} aoFechar={() => setImagemCupom(null)} />

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
              <div className="ui-campo"><span className="ui-campo-r"><span>Começa em</span><small>opcional</small></span>
                <CampoData valor={cupomForm.data_inicio} onChange={d => setCupomForm({ ...cupomForm, data_inicio: d })} max={cupomForm.data_fim || undefined} titulo="Cupom vale a partir de" placeholder="Hoje" curto /></div>
              <div className="ui-campo"><span className="ui-campo-r"><span>Vale até</span><small>opcional</small></span>
                <CampoData valor={cupomForm.data_fim} onChange={d => setCupomForm({ ...cupomForm, data_fim: d })} min={cupomForm.data_inicio || undefined} titulo="Cupom vale até" placeholder="Sem fim" curto /></div>
            </div>
            <div className="ep-g2">
              <Campo rotulo="Limite" opcional inputMode="numeric" placeholder="Sem limite" value={cupomForm.limite_uso}
                onChange={e => setCupomForm({ ...cupomForm, limite_uso: e.target.value.replace(/\D/g, '') })} />
              <Campo rotulo="Mínimo" opcional prefixo="R$" inputMode="numeric" placeholder="0,00" value={cupomForm.valor_minimo}
                onChange={e => setCupomForm({ ...cupomForm, valor_minimo: mascaraReais(e.target.value) })} />
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
