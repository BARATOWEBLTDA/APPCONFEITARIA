// Entrega e pagamento (08/10 · 3.26, no padrão do guia).
// O que salva continua igual (salva sozinho 2s depois de mexer; cupons na tabela loja_cupons).
// Mudou o visual: campos e botões do app, cupom novo/editar numa janela, convite pro PRO sem borrão.
import CampoData from '@/components/CampoData'
import { CalendarBlank, CaretRight, Check, Crown, CurrencyCircleDollar, Plus, Tag, Ticket, Truck, Users, Wallet } from "@phosphor-icons/react"
import { Botao, Campo, Janela, Titulo, avisar, confirmar } from "@/components/base"
import "./entregaPagamento.css"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useNavigate } from "react-router-dom"
import AppPageHeader from "@/components/AppPageHeader"
import { usePlano } from "@/hooks/usePlano"

const PAGAMENTOS = [
  { key: 'pix',                label: 'Pix' },
  { key: 'dinheiro',           label: 'Dinheiro' },
  { key: 'credito',            label: 'Cartão de crédito' },
  { key: 'debito',             label: 'Cartão de débito' },
  // 02/10: só as 4 formas (as mesmas que o cliente vê na finalização). As antigas continuam salvas, mas não aparecem.
]

const ENTREGAS = [
  { key: 'retirada',        label: 'Retirada no local' },
  { key: 'entrega_propria', label: 'Entrega própria' },
  { key: 'motoboy',         label: 'Motoboy' },
  { key: 'uber_flash',      label: 'Uber Flash' },
  { key: 'combinar',        label: 'Combinar pelo WhatsApp' },
]

// Converte o que ela digita (10,50 · 1.250,00 · 10.5) em número
const numBR = (v: string | number | null | undefined): number => {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  if (!s) return 0
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export default function CheckoutConfigPage() {
  const navigate = useNavigate()
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
  const [cupons, setCupons] = useState<{ codigo: string; tipo: string; valor: string; ativo: boolean; data_inicio?: string; data_fim?: string; limite_uso?: string; valor_minimo?: string; usos?: number }[]>([])
  const [editandoIndex, setEditandoIndex] = useState<number | null>(null) // null = lista | -1 = novo | >=0 = editando
  const cupomVazio = { codigo: '', tipo: 'percentual', valor: '', ativo: true, data_inicio: '', data_fim: '', limite_uso: '', valor_minimo: '' }
  const [cupomForm, setCupomForm] = useState<typeof cupomVazio>(cupomVazio)
  const [aceitaAgendamento, setAceitaAgendamento] = useState(true)
  const [prazoMinimo, setPrazoMinimo] = useState('24')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('profiles').select('formas_pagamento, formas_entrega, valor_entrega_propria, entrega_por_bairro, endereco_retirada, horario_retirada, exibir_campo_troco, cupons_desconto, aceita_agendamento, prazo_minimo_horas').eq('id', user.id).single()
      if (data) {
        setFormasPagamento(data.formas_pagamento || ['pix'])
        setFormasEntrega(data.formas_entrega || ['retirada'])
        setValorEntregaPropria(data.valor_entrega_propria ? data.valor_entrega_propria.toString() : '')
        setEntregaPorBairro((data.entrega_por_bairro || []).map((b: any) => ({ bairro: b.bairro, valor: b.valor?.toString() || '0' })))
        setEnderecoRetirada(data.endereco_retirada || '')
        setHorarioRetirada(data.horario_retirada || '')
        setExibirCampoTroco(data.exibir_campo_troco !== false)
        // Cupons ficam na tabela privada loja_cupons (fallback: os antigos do perfil)
        const { data: lc } = await supabase.from('loja_cupons').select('cupons').eq('user_id', user.id).maybeSingle()
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
        })))
        setAceitaAgendamento(data.aceita_agendamento !== false)
        setPrazoMinimo(data.prazo_minimo_horas != null ? data.prazo_minimo_horas.toString() : '24')
      }
      setLoading(false)
    }
    load()
  }, [])

  // 09/10: não salva (nem mostra "Salvo") só por ter aberto a tela; salva depois que algo muda
  const foto = JSON.stringify([formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo])
  const salvoRef = useRef<string | null>(null)
  useEffect(() => { if (!loading) salvoRef.current = foto }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (loading || !userId) return
    if (salvoRef.current === null || salvoRef.current === foto) return
    salvoRef.current = foto
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await supabase.from('profiles').update({
        formas_pagamento: formasPagamento,
        formas_entrega: formasEntrega,
        valor_entrega_propria: valorEntregaPropria ? numBR(valorEntregaPropria) : 0,
        entrega_por_bairro: entregaPorBairro.filter(b => b.bairro.trim()).map(b => ({ bairro: b.bairro, valor: numBR(b.valor) })),
        exibir_campo_troco: exibirCampoTroco,
      }).eq('id', userId)
      // Cupons: tabela privada (o visitante do cardápio não consegue ler)
      const cuponsParaSalvar = cupons.filter(c => c.codigo.trim()).map(c => ({
          codigo: c.codigo,
          tipo: c.tipo,
          valor: numBR(c.valor),
          ativo: c.ativo,
          data_inicio: c.data_inicio || null,
          data_fim: c.data_fim || null,
          limite_uso: c.limite_uso ? parseInt(c.limite_uso) : null,
          valor_minimo: c.valor_minimo ? numBR(c.valor_minimo) : null,
          usos: c.usos || 0,
        }))
      await supabase.from('loja_cupons').upsert({ user_id: userId, cupons: cuponsParaSalvar, updated_at: new Date().toISOString() })
      avisar('Salvo', { tipo: 'ok' })
    }, 2000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [formasPagamento, formasEntrega, valorEntregaPropria, entregaPorBairro, enderecoRetirada, horarioRetirada, exibirCampoTroco, cupons, aceitaAgendamento, prazoMinimo])

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
    if (cupomForm.data_inicio && cupomForm.data_fim && cupomForm.data_fim < cupomForm.data_inicio) {
      return avisar('A data do fim tem que ser depois da do começo', { tipo: 'erro' })
    }
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
    if (timerRef.current) clearTimeout(timerRef.current)
    setSavingCupons(true)
    await supabase.from('loja_cupons').upsert({ user_id: userId, updated_at: new Date().toISOString(),
      cupons: cupons.filter(c => c.codigo.trim()).map(c => ({
        codigo: c.codigo,
        tipo: c.tipo,
        valor: numBR(c.valor),
        ativo: c.ativo,
        data_inicio: c.data_inicio || null,
        data_fim: c.data_fim || null,
        limite_uso: c.limite_uso ? parseInt(c.limite_uso) : null,
        valor_minimo: c.valor_minimo ? numBR(c.valor_minimo) : null,
        usos: c.usos || 0,
      })),
    })
    // Limpa a cópia antiga do perfil (o cardápio público consegue ler o perfil)
    await supabase.from('profiles').update({ cupons_desconto: [] }).eq('id', userId)
    setSavingCupons(false)
    avisar('Cupons salvos', { tipo: 'ok' })
  }

  const formatDate = (iso: string) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y.slice(2)}`
  }

  const Cabeca = ({ Ic, titulo, apoio, acao }: { Ic: typeof Wallet; titulo: string; apoio?: string; acao?: React.ReactNode }) => (
    <div className="ep-cab"><span className="ep-cab-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><Titulo apoio={apoio} acao={acao}>{titulo}</Titulo></div>
  )
  const Marcar = ({ on, rotulo, aoTocar }: { on: boolean; rotulo: string; aoTocar: () => void }) => (
    <button type="button" role="checkbox" aria-checked={on} className="ep-op" onClick={aoTocar}>
      <span>{rotulo}</span><span className="ep-cx" aria-hidden="true">{on && <Check size={16} weight="bold" />}</span>
    </button>
  )
  const Chave = ({ on, rotulo, apoio, aoMudar }: { on: boolean; rotulo: string; apoio?: string; aoMudar: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} className="ep-sw-l" onClick={() => aoMudar(!on)}>
      <span className="ep-sw-tx"><b>{rotulo}</b>{apoio && <small>{apoio}</small>}</span><span className="ep-sw" aria-hidden="true" />
    </button>
  )
  const descontoDe = (c: { tipo: string; valor: string }) => c.tipo === 'percentual' ? `${c.valor}% de desconto` : `R$ ${c.valor} de desconto`
  const dinheiroBR = (v: string) => { const n = numBR(v); return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  if (loading) return (
    <>
      <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate("/cardapio")} />
      <div className="ep-carregando"><span className="ui-gira" aria-label="Carregando" /></div>
    </>
  )

  const formAberto = editandoIndex !== null

  return (
    <>
      <AppPageHeader title="Entrega e pagamento" subtitle="Pagamento, entrega e cupons" onBack={() => navigate("/cardapio")} />
      <div className="ep">
        <p className="ep-salva"><Check size={16} weight="bold" aria-hidden="true" />Tudo aqui salva sozinho.</p>

        {/* Pagamento */}
        <section className="ep-card">
          <Cabeca Ic={Wallet} titulo="Formas de pagamento" apoio="Marque só as que você aceita" />
          <div className="ep-ops">
            {PAGAMENTOS.map(p => <Marcar key={p.key} on={formasPagamento.includes(p.key)} rotulo={p.label} aoTocar={() => togglePagamento(p.key)} />)}
          </div>
          {formasPagamento.includes('dinheiro') && (
            <Chave on={exibirCampoTroco} rotulo='Perguntar "Troco pra quanto?"' apoio="Quando o cliente pagar em dinheiro" aoMudar={setExibirCampoTroco} />
          )}
        </section>

        {/* Entrega */}
        <section className="ep-card">
          <Cabeca Ic={Truck} titulo="Formas de entrega" apoio="Marque as que o cliente pode escolher" />
          <div className="ep-ops">
            {ENTREGAS.map(e => <Marcar key={e.key} on={formasEntrega.includes(e.key)} rotulo={e.label} aoTocar={() => toggleEntrega(e.key)} />)}
          </div>
          {formasEntrega.includes('entrega_propria') && (
            <div className="ep-taxa">
              <Campo rotulo="Taxa da entrega própria" prefixo="R$" inputMode="decimal" placeholder="0,00" value={valorEntregaPropria}
                dica="Cobrada em todo pedido com entrega própria"
                onChange={e => setValorEntregaPropria(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </div>
          )}
        </section>

        {/* Cupons */}
        <section className="ep-card ep-largo">
          <Cabeca Ic={Ticket} titulo="Cupons de desconto" apoio="Códigos que o cliente usa ao finalizar o pedido"
 />
          {!isPro ? (
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
                      {(c.data_inicio || c.data_fim || c.limite_uso || c.valor_minimo) && (
                        <span className="ep-cupom-tags">
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
        </section>
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
