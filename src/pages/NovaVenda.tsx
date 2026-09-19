import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/use-mobile'
import AppPageHeader from '@/components/AppPageHeader'
import HorarioSheet from '@/components/HorarioSheet'
import { tocarSom } from '@/hooks/useSom'
import { criarBreakdownV1, criarPersonalizacoesV1, SNAPSHOT_VERSION_ATUAL } from '@/lib/pedido-snapshot'

// ── Tipos ─────────────────────────────────────────────────────────────────
type TipoVenda = 'encomenda' | 'pronta_entrega' | null
type TipoEntrega = 'retirada' | 'entrega'
type SituacaoPag = 'total' | 'parcial' | 'fiado'

interface ItemVenda {
  produto_id?: string
  nome_produto: string
  quantidade: number
  valor_unitario: number
  imagem_url?: string
  forma_venda?: string
  observacoes: string
}

interface Cliente {
  id: string
  nome: string
  telefone?: string
  whatsapp?: string
  rua?: string
  numero?: string
  bairro?: string
  cidade?: string
  complemento?: string
}

interface Produto {
  id: string
  nome: string
  preco_normal: number
  forma_venda?: string
  imagem_url?: string
  categoria?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────
const formatMoney = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

// "2026-05-22" → "22/05/2026"
const formatDataBR = (iso: string): string => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const parseMoney = (s: string): number => {
  const clean = s.replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

// Máscara ao digitar: "150" → "1,50" / "1500" → "15,00" / "150000" → "1.500,00"
const parseMaskMoney = (s: string): number => {
  const digits = s.replace(/\D/g, '')
  if (!digits) return 0
  return parseInt(digits) / 100
}
const formatMaskMoney = (v: number): string => {
  if (!v) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const initialsOf = (name: string) => {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

// "BOLO DE CHOCOLATE" -> "Bolo de Chocolate"
const toTitleCase = (str: string): string => {
  const preposicoes = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'a', 'o', 'em', 'na', 'no'])
  return str.toLowerCase().split(/\s+/).map((word, i) => {
    if (i > 0 && preposicoes.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(' ')
}

// ── Etapas ────────────────────────────────────────────────────────────────
const ETAPAS_ENCOMENDA = ['Venda', 'Cliente', 'Entrega', 'Pagamento', 'Revisar']
const ETAPAS_PRONTA    = ['Venda', 'Cliente', 'Entrega', 'Pagamento', 'Revisar']

// ─────────────────────────────────────────────────────────────────────────
export default function NovaVenda() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // ── State principal ─────────────────────────────────────────────────────
  const [etapa, setEtapa] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoVenda>(null)
  const [itens, setItens] = useState<ItemVenda[]>([])
  const [semCliente, setSemCliente] = useState(false)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [modoNovoCli, setModoNovoCli] = useState(false)

  const [tipoEntrega, setTipoEntrega] = useState<TipoEntrega>('retirada')
  const [dataEntrega, setDataEntrega] = useState('')
  const [horarioEntrega, setHorarioEntrega] = useState('')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [enderecoCidade, setEnderecoCidade] = useState('Curitiba')
  const [enderecoComplemento, setEnderecoComplemento] = useState('')
  const [taxaEntrega, setTaxaEntrega] = useState(0)

  const [desconto, setDesconto] = useState(0)
  const [acrescimo, setAcrescimo] = useState(0)
  const [situacaoPag, setSituacaoPag] = useState<SituacaoPag>('total')
  const [valorParcial, setValorParcial] = useState(0)
  const [statusPedido, setStatusPedido] = useState<'aguardando_aceite' | 'agendado' | 'finalizado' | 'entregue'>('agendado')
  const [dataPrevistaPagamento, setDataPrevistaPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('PIX')

  const [observacoes, setObservacoes] = useState('')

  // Modal produtos
  const [modalProduto, setModalProduto] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string | null>(null)
  const [dropdownAberto, setDropdownAberto] = useState(false)

  // Modal cliente
  const [modalCliente, setModalCliente] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [sucessoAberto, setSucessoAberto] = useState(false)
  const [pedidoCriado, setPedidoCriado] = useState<any>(null)
  const [producaoExpandida, setProducaoExpandida] = useState(false)
  const [resumoAberto, setResumoAberto] = useState(false)
  const [horaSheetAberto, setHoraSheetAberto] = useState(false)
  const dataRef = useRef<HTMLInputElement>(null)
  const dataPrevRef = useRef<HTMLInputElement>(null)
  const [enderecoCep, setEnderecoCep] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  // Busca CEP via ViaCEP
  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (!data.erro) {
        if (data.logradouro) setEnderecoRua(data.logradouro)
        if (data.bairro) setEnderecoBairro(data.bairro)
        if (data.localidade) setEnderecoCidade(data.localidade)
      }
    } catch {}
    setCepLoading(false)
  }

  // Formata CEP enquanto digita: "12345678" → "12345-678"
  const formatCep = (v: string): string => {
    const digits = v.replace(/\D/g, '').slice(0, 8)
    if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`
    return digits
  }

  // ── Load inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      setUserId(user.id)
      const [{ data: prds }, { data: cls }] = await Promise.all([
        supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url,categoria').eq('user_id', user.id).order('nome'),
        supabase.from('clientes').select('id,nome,telefone,whatsapp,rua,numero,bairro,cidade,complemento').eq('user_id', user.id).order('nome'),
      ])
      setProdutos(prds || [])
      setClientes(cls || [])
    })
  }, [])

  // Trava scroll do body quando modal aberto
  useEffect(() => {
    if (modalProduto || modalCliente) {
      const original = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = original }
    }
  }, [modalProduto, modalCliente])

  // Ajusta tipoEntrega default quando muda o tipo de venda
  useEffect(() => {
    setTipoEntrega('retirada')
  }, [tipo])

  // Scroll pro topo quando muda de etapa ou entra na tela de sucesso
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [etapa, sucessoAberto])

  // ── Cálculos ────────────────────────────────────────────────────────────
  const subtotalProdutos = useMemo(
    () => itens.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0),
    [itens]
  )
  const total = useMemo(
    () => Math.max(0, subtotalProdutos + (tipoEntrega === 'entrega' ? taxaEntrega : 0) - desconto + acrescimo),
    [subtotalProdutos, taxaEntrega, desconto, acrescimo, tipoEntrega]
  )

  // Lista de categorias com contagem (ordenada)
  const categoriasComContagem = useMemo(() => {
    const map = new Map<string, number>()
    produtos.forEach(p => {
      const cat = (p.categoria || '').trim()
      if (cat) map.set(cat, (map.get(cat) || 0) + 1)
    })
    return Array.from(map.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [produtos])

  // Etapas dinâmicas
  const etapas = tipo === 'pronta_entrega' ? ETAPAS_PRONTA : ETAPAS_ENCOMENDA
  const totalEtapas = etapas.length
  const etapaLabelAtual = etapas[etapa - 1]

  // ── Validação por etapa ────────────────────────────────────────────────
  const podeAvancar = (): boolean => {
    if (etapaLabelAtual === 'Venda') return tipo !== null && itens.length > 0
    if (etapaLabelAtual === 'Cliente') return true
    if (etapaLabelAtual === 'Entrega') {
      if (tipo === 'encomenda' && !dataEntrega) return false
      if (tipoEntrega === 'entrega' && !enderecoRua) return false
      return true
    }
    return true
  }

  const proximaEtapa = () => {
    if (podeAvancar() && etapa < totalEtapas) setEtapa(e => e + 1)
  }
  const voltarEtapa = () => {
    if (etapa > 1) setEtapa(e => e - 1)
    else navigate('/pedidos')
  }

  // ── Adicionar produto ──────────────────────────────────────────────────
  const addProduto = (p: Produto) => {
    setItens([...itens, {
      produto_id: p.id,
      nome_produto: p.nome,
      quantidade: 1,
      valor_unitario: p.preco_normal,
      imagem_url: p.imagem_url,
      forma_venda: p.forma_venda,
      observacoes: '',
    }])
    setModalProduto(false)
    setBuscaProduto('')
    setFiltroCategoria(null)
    setDropdownAberto(false)
  }
  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx))
  const duplicarItem = (idx: number) => {
    const item = itens[idx]
    if (!item) return
    // Insere duplicado logo abaixo do original
    const novoItens = [...itens]
    novoItens.splice(idx + 1, 0, { ...item, observacoes: '' })
    setItens(novoItens)
  }
  const atualizarQtd = (idx: number, qtd: number) => {
    if (qtd < 1) return
    setItens(itens.map((it, i) => i === idx ? { ...it, quantidade: qtd } : it))
  }
  const atualizarObs = (idx: number, obs: string) => {
    setItens(itens.map((it, i) => i === idx ? { ...it, observacoes: obs } : it))
  }

  // ── Selecionar cliente ─────────────────────────────────────────────────
  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setClienteTelefone(c.telefone || c.whatsapp || '')
    setSemCliente(false)
    setModoNovoCli(false)
    // Puxa endereço cadastrado (se tiver)
    if (c.rua) setEnderecoRua(c.rua)
    if (c.numero) setEnderecoNumero(c.numero)
    if (c.bairro) setEnderecoBairro(c.bairro)
    if (c.cidade) setEnderecoCidade(c.cidade)
    if (c.complemento) setEnderecoComplemento(c.complemento)
    setModalCliente(false)
    setBuscaCliente('')
  }

  // ── Finalizar Venda ────────────────────────────────────────────────────
  const finalizarVenda = async () => {
    if (!userId || salvando) return
    setSalvando(true)

    // Status escolhido pela confeiteira
    let status: string = statusPedido
    let statusPag: string = 'pago'
    let valorRecebido = total

    // Se pronta entrega + já saiu, força entregue
    if (tipo === 'pronta_entrega' && tipoEntrega === 'retirada') {
      status = 'entregue'
    }

    if (situacaoPag === 'fiado') {
      statusPag = 'pendente'
      valorRecebido = 0
    } else if (situacaoPag === 'parcial') {
      statusPag = 'parcial'
      valorRecebido = valorParcial
    }

    const { data: novoPedido, error } = await supabase.from('pedidos').insert({
      user_id: userId,
      cliente_id: clienteId,
      cliente_nome: semCliente ? '' : clienteNome,
      cliente_telefone: semCliente ? '' : clienteTelefone,
      status,
      status_pagamento: statusPag,
      valor_recebido: valorRecebido,
      valor_total: total,
      valor_produtos: subtotalProdutos,
      desconto,
      taxa_entrega: tipoEntrega === 'entrega' ? taxaEntrega : 0,
      forma_pagamento: formaPagamento,
      tipo_entrega: tipoEntrega,
      data_entrega: tipo === 'encomenda' ? dataEntrega : new Date().toISOString().slice(0, 10),
      horario_entrega: tipo === 'encomenda' ? horarioEntrega : null,
      endereco_rua: enderecoRua,
      endereco_numero: enderecoNumero,
      endereco_bairro: enderecoBairro,
      endereco_cidade: enderecoCidade,
      endereco_complemento: enderecoComplemento,
      origem: 'manual',
      tipo_venda: tipo,
      observacoes,
      data_prevista_pagamento: situacaoPag === 'fiado' ? dataPrevistaPagamento : null,
    }).select().single()

    if (error || !novoPedido) {
      alert('Erro ao salvar: ' + (error?.message || 'desconhecido'))
      setSalvando(false)
      return
    }

    // Inserir itens (com snapshot v1 — Passo 0A)
    const itensInsert = itens.map(it => ({
      pedido_id: novoPedido.id,
      produto_id: it.produto_id,
      nome_produto: it.nome_produto,
      quantidade: it.quantidade,
      valor_unitario: it.valor_unitario,
      observacoes: it.observacoes || '',
      imagem_url: it.imagem_url || null,
      // ─── Snapshot Passo 0A ─────────────────────────────────────────
      // NovaVenda hoje não coleta massa/recheio/cobertura/sabor/tamanho
      // Salva estrutura vazia. Passo 1 (GRUPO_OPCOES) vai enriquecer.
      personalizacoes: criarPersonalizacoesV1({}),
      preco_breakdown: criarBreakdownV1({ final: it.valor_unitario }),
      snapshot_version: SNAPSHOT_VERSION_ATUAL,
    }))
    const { error: errItens } = await supabase.from('pedido_itens').insert(itensInsert)
    if (errItens) {
      alert('Pedido salvo, mas os produtos falharam: ' + errItens.message)
      console.error('Erro ao inserir itens:', errItens)
    }

    // Registra criação no histórico (silencioso — não falha se tabela não existir)
    supabase.from('pedido_historico').insert({
      pedido_id: novoPedido.id,
      user_id: userId,
      evento: 'Pedido criado',
      descricao: `Pedido ${tipo === 'pronta_entrega' ? 'de pronta entrega' : 'de encomenda'} registrado manualmente`,
    }).then(() => {}, () => {})

    // Salva dados do pedido pra mostrar na tela de sucesso
    setPedidoCriado({
      id: novoPedido.id,
      numero: novoPedido.numero || novoPedido.id.slice(0, 8),
      itens: [...itens],
      clienteNome: semCliente || !clienteNome ? '' : clienteNome,
      clienteTelefone: semCliente ? '' : clienteTelefone,
      total,
      tipo,
      dataEntrega,
      horarioEntrega,
    })
    setSucessoAberto(true)
    setSalvando(false)
    tocarSom('pedido')
  }

  // Reset completo pra nova venda
  const resetVenda = () => {
    setEtapa(1)
    setTipo(null)
    setItens([])
    setClienteId(null); setClienteNome(''); setClienteTelefone(''); setSemCliente(false); setModoNovoCli(false)
    setTipoEntrega('retirada')
    setDataEntrega(''); setHorarioEntrega('')
    setEnderecoRua(''); setEnderecoNumero(''); setEnderecoBairro(''); setEnderecoCidade('Curitiba'); setEnderecoComplemento(''); setTaxaEntrega(0); setEnderecoCep('')
    setDesconto(0); setAcrescimo(0); setSituacaoPag('total'); setValorParcial(0); setDataPrevistaPagamento(''); setFormaPagamento('PIX'); setStatusPedido('agendado')
    setObservacoes('')
    setPedidoCriado(null); setSucessoAberto(false); setProducaoExpandida(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const isUltima = etapa === totalEtapas

  // ═══ Tela de sucesso ═══
  if (sucessoAberto && pedidoCriado) {
    return (
      <>
        <div className="nv-sucesso-wrap">
          <div className="nv-sucesso-card">
            <div className="nv-suc-ico-wrap">
              <div className="nv-suc-check">✓</div>
            </div>
            <h1 className="nv-suc-titulo">Venda registrada!</h1>
            <p className="nv-suc-sub">Pedido salvo com sucesso</p>

            {/* Resumo cliente + total */}
            <div className="nv-suc-resumo">
              <div>
                <div className="nv-suc-cliente">{pedidoCriado.clienteNome ? toTitleCase(pedidoCriado.clienteNome) : 'Venda avulsa'}</div>
                {pedidoCriado.clienteTelefone && <div className="nv-suc-tel">{pedidoCriado.clienteTelefone}</div>}
              </div>
              <div>
                <div className="nv-suc-total-lbl">Total</div>
                <div className="nv-suc-total-val">{formatMoney(pedidoCriado.total)}</div>
              </div>
            </div>

            {/* Accordion produção */}
            {pedidoCriado.tipo === 'encomenda' && (
              <div className="nv-suc-prod-card" onClick={() => setProducaoExpandida(v => !v)}>
                <div className="nv-suc-prod-header">
                  <div className="nv-suc-prod-ico">🎂</div>
                  <div className="nv-suc-prod-info">
                    <div className="nv-suc-prod-titulo">1 produção criada</div>
                    <div className="nv-suc-prod-sub">{producaoExpandida ? 'Toque para esconder' : 'Toque para ver detalhes'}</div>
                  </div>
                  <span className={`nv-suc-chevron ${producaoExpandida ? 'nv-suc-chevron--open' : ''}`}>⌄</span>
                </div>
                {producaoExpandida && (
                  <div className="nv-suc-prod-lista">
                    {pedidoCriado.itens.map((it: ItemVenda, idx: number) => (
                      <div key={idx} className="nv-suc-prod-linha">
                        <div style={{ flex: 1 }}>
                          <div className="nv-suc-prod-nome">{toTitleCase(it.nome_produto)}</div>
                          <div className="nv-suc-prod-qtd">Quantidade: {it.quantidade}</div>
                          {it.observacoes && <div className="nv-suc-prod-obs">↳ {it.observacoes}</div>}
                        </div>
                        {pedidoCriado.dataEntrega && (
                          <div className="nv-suc-prod-data">
                            Agendado para<br />
                            {new Date(pedidoCriado.dataEntrega + 'T00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            {pedidoCriado.horarioEntrega && ` · ${pedidoCriado.horarioEntrega}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Botões */}
            <button className="nv-suc-btn-primary" onClick={resetVenda}>+ Nova Venda</button>
            <div className="nv-suc-btns-sec">
              <button className="nv-suc-btn-ghost" onClick={() => navigate('/pedidos')}>
                <span className="nv-suc-btn-em">📋</span>
                Ver pedidos
              </button>
              <button className="nv-suc-btn-ghost nv-suc-btn-ghost--pro" title="Recurso PRO">
                <span className="nv-suc-btn-em">📄</span>
                Exportar PDF
                <span className="nv-suc-badge nv-suc-badge--pro">✨ PRO</span>
              </button>
            </div>
          </div>
        </div>

        <style>{`
          .nv-sucesso-wrap {
            min-height: 100vh;
            padding: 20px 12px;
            display: flex; align-items: flex-start; justify-content: center;
            font-family: var(--font-base) !important;
          }
          .nv-sucesso-card {
            background: #fff;
            border-radius: 16px;
            max-width: 480px;
            width: 100%;
            padding: 32px 22px 24px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.06);
          }
          @media (max-width: 640px) {
            .nv-sucesso-wrap { padding: 0; }
            .nv-sucesso-card { border-radius: 0; box-shadow: none; min-height: 100vh; padding: 28px 18px 24px; }
          }

          .nv-suc-ico-wrap {
            width: 84px; height: 84px; border-radius: 50%;
            background: linear-gradient(160deg, #D1FAE5 0%, #A7F3D0 100%);
            display: flex; align-items: center; justify-content: center;
            margin: 8px auto 16px;
            box-shadow: 0 6px 20px rgba(16,185,129,0.25);
          }
          .nv-suc-check {
            width: 40px; height: 40px; border-radius: 50%;
            background: #10B981; color: #fff;
            display: flex; align-items: center; justify-content: center;
            font-size: 22px; font-weight: 900;
            font-family: var(--font-base) !important;
          }
          .nv-suc-titulo {
            text-align: center;
            font-size: 22px; font-weight: 900; letter-spacing: -0.02em;
            color: #2D1F26; margin: 0;
            font-family: var(--font-base) !important;
          }
          .nv-suc-sub {
            text-align: center;
            font-size: 13px; color: #6B5D64;
            margin: 4px 0 20px;
            font-family: var(--font-base) !important;
          }

          .nv-suc-resumo {
            background: linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%);
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 12px;
            display: flex; align-items: center; justify-content: space-between; gap: 10px;
          }
          .nv-suc-cliente { font-size: 13px; font-weight: 800; color: #831843; font-family: var(--font-base) !important; }
          .nv-suc-tel { font-size: 11px; color: #E85A8C; margin-top: 2px; font-family: var(--font-base) !important; }
          .nv-suc-total-lbl { font-size: 10px; color: #E85A8C; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; text-align: right; font-family: var(--font-base) !important; }
          .nv-suc-total-val { font-size: 20px; font-weight: 900; color: #831843; letter-spacing: -0.02em; text-align: right; font-family: var(--font-base) !important; }

          .nv-suc-prod-card {
            background: #FAFAFA;
            border: 1.5px solid #F0EBED;
            border-radius: 12px;
            padding: 14px 16px;
            margin-bottom: 18px;
            cursor: pointer;
            transition: border-color 0.15s;
          }
          .nv-suc-prod-card:hover { border-color: #E5D8DE; }
          .nv-suc-prod-header { display: flex; align-items: center; gap: 10px; }
          .nv-suc-prod-ico { width: 36px; height: 36px; border-radius: 8px; background: #FDF3F7; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
          .nv-suc-prod-info { flex: 1; min-width: 0; }
          .nv-suc-prod-titulo { font-size: 13.5px; font-weight: 900; color: #2D1F26; font-family: var(--font-base) !important; }
          .nv-suc-prod-sub { font-size: 11px; color: #6B5D64; margin-top: 2px; font-family: var(--font-base) !important; }
          .nv-suc-chevron { color: #E85A8C; transition: transform 0.2s; font-size: 16px; font-weight: 900; flex-shrink: 0; }
          .nv-suc-chevron--open { transform: rotate(180deg); }
          .nv-suc-prod-lista {
            margin-top: 12px; padding-top: 12px;
            border-top: 1px dashed #E5D8DE;
            animation: nvSucIn 0.2s ease;
          }
          .nv-suc-prod-linha {
            display: flex; justify-content: space-between; gap: 12px;
            padding: 8px 0;
            font-size: 12px;
          }
          .nv-suc-prod-linha + .nv-suc-prod-linha { border-top: 1px dashed #F0EBED; }
          .nv-suc-prod-nome { color: #2D1F26; font-weight: 800; font-family: var(--font-base) !important; }
          .nv-suc-prod-qtd { color: #6B5D64; margin-top: 2px; font-family: var(--font-base) !important; }
          .nv-suc-prod-obs { color: #E85A8C; margin-top: 3px; font-size: 11px; font-style: italic; font-family: var(--font-base) !important; }
          .nv-suc-prod-data { color: #E85A8C; font-weight: 800; font-size: 10.5px; text-align: right; line-height: 1.4; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; font-family: var(--font-base) !important; }
          @keyframes nvSucIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 400px; } }

          .nv-suc-btn-primary {
            all: unset;
            width: 100%; box-sizing: border-box;
            padding: 14px;
            background: linear-gradient(180deg, #E85A8C 0%, #C33A6E 100%);
            color: #fff;
            border-radius: 10px;
            font-size: 14px; font-weight: 900; letter-spacing: -0.01em;
            text-align: center;
            cursor: pointer;
            box-shadow: 0 4px 0 #A02D5A;
            margin-bottom: 10px;
            font-family: var(--font-base) !important;
          }
          .nv-suc-btn-primary:active { transform: translateY(4px); box-shadow: 0 0 0 #A02D5A; }

          .nv-suc-btns-sec { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .nv-suc-btn-ghost {
            all: unset;
            padding: 12px 8px;
            background: #fff;
            border: 1.5px solid #F0EBED;
            color: #2D1F26;
            border-radius: 10px;
            font-size: 12.5px; font-weight: 700;
            text-align: center;
            cursor: pointer;
            box-sizing: border-box;
            position: relative;
            font-family: var(--font-base) !important;
          }
          .nv-suc-btn-ghost:hover { border-color: #E5D8DE; }
          .nv-suc-btn-em { font-size: 16px; display: block; margin-bottom: 2px; line-height: 1; }
          .nv-suc-btn-ghost--disabled {
            opacity: 0.55;
            cursor: not-allowed;
          }
          .nv-suc-btn-ghost--pro {
            border-color: #E5C580;
            background: linear-gradient(160deg, #FFFBEB 0%, #FEF3C7 100%);
          }
          .nv-suc-btn-ghost--pro:hover { border-color: #D4A855; }
          .nv-suc-badge {
            position: absolute;
            top: 4px; right: 4px;
            background: #FDF3F7;
            color: #E85A8C;
            font-size: 8.5px; font-weight: 800;
            padding: 2px 5px; border-radius: 4px;
            text-transform: uppercase; letter-spacing: 0.05em;
          }
          .nv-suc-badge--pro {
            background: linear-gradient(160deg, #F59E0B 0%, #D97706 100%);
            color: #fff;
            box-shadow: 0 2px 4px rgba(217,119,6,0.3);
          }
        `}</style>
      </>
    )
  }

  return (
    <>
    <AppPageHeader
      title="Registrar Venda"
      subtitle="Encomenda ou pronta entrega"
      infoIcon="🛒"
      infoContent={
        <>
          <p>Aqui você <strong>cadastra vendas rápido</strong> — sejam encomendas com data marcada ou pronta entrega que o cliente levou na hora.</p>
          <p>Cada etapa <strong>libera a próxima</strong> conforme você preenche. Não precisa se preocupar com ordem — tudo vai pro seu financeiro e pedidos automaticamente.</p>
        </>
      }
      infoTip={<>Você pode <strong>voltar</strong> a qualquer etapa clicando na bolinha do topo.</>}
    />

    <div className="nv-root">

      {/* Barra de progresso */}
      <div className="nv-progress">
        <div className="nv-pb-bar">
          <div className="nv-pb-fill" style={{ width: `${(etapa / totalEtapas) * 100}%` }} />
        </div>
      </div>

      {/* Corpo da etapa */}
      <div className="nv-corpo">

        {/* ═══ ETAPA 1: Venda (Tipo + Produtos) ═══ */}
        {etapaLabelAtual === 'Venda' && (
          <>
            <h2 className="nv-titulo">Que tipo de venda é essa?</h2>
            <p className="nv-sub">Escolha e depois adicione os produtos</p>
            <div className="nv-tipos">
              <button
                type="button"
                data-tipo="encomenda"
                className={`nv-tipo-card ${tipo === 'encomenda' ? 'nv-tipo-card--ativo' : ''}`}
                onClick={() => setTipo('encomenda')}
              >
                <div className="nv-tipo-emoji nv-tipo-emoji--img">
                  <img src="/Sistema/encomenda.png" alt="Encomenda" />
                </div>
                <div className="nv-tipo-nome">Encomenda</div>
                <div className="nv-tipo-desc">Pra buscar ou entregar em outra data</div>
              </button>
              <button
                type="button"
                data-tipo="pronta_entrega"
                className={`nv-tipo-card ${tipo === 'pronta_entrega' ? 'nv-tipo-card--ativo' : ''}`}
                onClick={() => setTipo('pronta_entrega')}
              >
                <div className="nv-tipo-emoji nv-tipo-emoji--img">
                  <img src="/Sistema/prontaentrega.png" alt="Pronta Entrega" />
                </div>
                <div className="nv-tipo-nome">Pronta Entrega</div>
                <div className="nv-tipo-desc">Cliente já está levando</div>
              </button>
            </div>

            <button
              type="button"
              className={`nv-add-produto ${tipo ? 'nv-add-produto--ativo' : 'nv-add-produto--dis'}`}
              disabled={!tipo}
              onClick={() => setModalProduto(true)}
            >
              + Adicionar Produto
            </button>

            {itens.length === 0 ? (
              <div className="nv-area-vazia">
                <div className="nv-area-vazia-1">Nenhum produto adicionado</div>
                <div className="nv-area-vazia-2">Clique em <b>"Adicionar Produto"</b> para começar</div>
              </div>
            ) : (
              <div className="nv-area-produtos">
                {itens.map((it, idx) => (
                  <div key={idx} className="nv-p-item">
                    <div className="nv-p-item-topo">
                      <div className="nv-p-item-img">
                        {it.imagem_url ? <img src={it.imagem_url} alt={it.nome_produto} /> : <span>🎂</span>}
                      </div>
                      <div className="nv-p-item-info">
                        <div className="nv-p-item-nome">{toTitleCase(it.nome_produto)}</div>
                        <div className="nv-p-item-linha-preco">
                          <span className="nv-p-item-preco">{formatMoney(it.valor_unitario * it.quantidade)}</span>
                          <span className="nv-p-item-unit">{formatMoney(it.valor_unitario)}{it.forma_venda ? ` / ${it.forma_venda}` : ' un.'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="nv-p-item-controls">
                      <div className="nv-qtd">
                        <button className="nv-qtd-btn" onClick={() => atualizarQtd(idx, it.quantidade - 1)} type="button">−</button>
                        <span className="nv-qtd-num">{it.quantidade}</span>
                        <button className="nv-qtd-btn" onClick={() => atualizarQtd(idx, it.quantidade + 1)} type="button">+</button>
                      </div>
                      <div style={{ flex: 1 }} />
                      <button className="nv-p-item-dup" onClick={() => duplicarItem(idx)} type="button" aria-label="Duplicar" title="Duplicar produto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button className="nv-p-item-lixo" onClick={() => removerItem(idx)} type="button" aria-label="Remover">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      className="nv-p-item-obs"
                      placeholder="Observação (opcional)..."
                      value={it.observacoes}
                      onChange={e => atualizarObs(idx, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className={`nv-resumo-mini ${resumoAberto ? 'nv-resumo-mini--open' : ''}`}>
              <button
                type="button"
                className="nv-resumo-header"
                onClick={() => setResumoAberto(!resumoAberto)}
              >
                <div className="nv-resumo-header-info">
                  <div className="nv-resumo-mini-lbl">Resumo da Venda</div>
                  <div className="nv-resumo-header-total">{formatMoney(total)}</div>
                </div>
                <svg className="nv-resumo-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {resumoAberto && (
                <div className="nv-resumo-corpo">
                  {itens.length > 0 && (
                    <div className="nv-resumo-mini-sub">
                      <span>Produtos ({itens.length} {itens.length === 1 ? 'item' : 'itens'})</span>
                      <span>{formatMoney(subtotalProdutos)}</span>
                    </div>
                  )}
                  <div className="nv-resumo-mini-row">
                    <span>Total</span>
                    <span className="nv-resumo-mini-val">{formatMoney(total)}</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ ETAPA 2: Cliente (opcional) ═══ */}
        {etapaLabelAtual === 'Cliente' && (
          <>
            <h2 className="nv-titulo" style={{ marginBottom: 18 }}>Cliente</h2>

            {clienteId && !modoNovoCli ? (
              /* Cliente escolhido - card detalhado */
              (() => {
                const temEndereco = enderecoRua && enderecoRua.trim().length > 0
                const enderecoLinha = [
                  enderecoRua && `${enderecoRua}${enderecoNumero ? ', ' + enderecoNumero : ''}`,
                  enderecoBairro,
                ].filter(Boolean).join(' · ')
                const mapsQuery = encodeURIComponent(
                  [enderecoRua, enderecoNumero, enderecoBairro, enderecoCidade].filter(Boolean).join(' ')
                )
                return (
                  <div className="nv-cli-card">
                    <div className="nv-cli-card-topo">
                      <div className="nv-cli-avatar">{initialsOf(clienteNome)}</div>
                      <div className="nv-cli-nome-wrap">
                        <div className="nv-cli-card-nome">{toTitleCase(clienteNome)}</div>
                        <div className="nv-cli-card-badge">✓ Cliente cadastrado</div>
                      </div>
                      <button
                        className="nv-cli-card-x"
                        onClick={() => {
                          setClienteId(null); setClienteNome(''); setClienteTelefone('');
                          setEnderecoRua(''); setEnderecoNumero(''); setEnderecoBairro('');
                          setEnderecoComplemento('');
                        }}
                        type="button"
                        aria-label="Remover cliente"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>

                    <div className="nv-cli-card-dados">
                      <div className="nv-cli-card-linha">
                        <div className="nv-cli-card-ico">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        </div>
                        <div>
                          <div className="nv-cli-card-lbl">Telefone</div>
                          <div className="nv-cli-card-txt">{clienteTelefone || 'Não informado'}</div>
                        </div>
                      </div>

                      <div className="nv-cli-card-linha">
                        <div className="nv-cli-card-ico">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={temEndereco ? "currentColor" : "#9A8B93"} strokeWidth={2}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </div>
                        <div>
                          <div className="nv-cli-card-lbl">Endereço</div>
                          <div className={`nv-cli-card-txt ${!temEndereco ? 'nv-cli-card-txt--vazio' : ''}`}>
                            {temEndereco ? enderecoLinha : 'Sem endereço cadastrado'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {temEndereco && (
                      <a
                        className="nv-cli-mapa"
                        href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <div className="nv-cli-mapa-bg" />
                        <div className="nv-cli-mapa-pin">
                          <svg width="30" height="38" viewBox="0 0 24 30"><path fill="#E85A8C" stroke="#fff" strokeWidth={1.5} d="M12 0C5.4 0 0 5.4 0 12c0 9 12 18 12 18s12-9 12-18c0-6.6-5.4-12-12-12z"/><circle cx={12} cy={12} r={4.5} fill="#fff"/></svg>
                        </div>
                        <div className="nv-cli-mapa-btn">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>
                          Abrir Maps
                        </div>
                      </a>
                    )}
                  </div>
                )
              })()
            ) : (
              /* Seletor + botão + */
              <div className="nv-cli-row">
                <button className="nv-cli-selector" onClick={() => setModalCliente(true)} type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span>Escolha um cliente (opcional)</span>
                </button>
                <button
                  className={`nv-cli-add ${modoNovoCli ? 'nv-cli-add--cancel' : ''}`}
                  onClick={() => {
                    if (modoNovoCli) {
                      // Cancelar novo cliente
                      setModoNovoCli(false); setClienteNome(''); setClienteTelefone('');
                    } else {
                      setModoNovoCli(true); setClienteId(null); setClienteNome(''); setClienteTelefone('');
                    }
                  }}
                  type="button"
                  aria-label={modoNovoCli ? "Cancelar" : "Cadastrar novo"}
                >
                  {modoNovoCli ? '✕' : '+'}
                </button>
              </div>
            )}

            {/* Form novo cliente */}
            {modoNovoCli && (
              <div className="nv-form-novo">
                <div className="nv-form-novo-titulo">✚ Novo Cliente</div>
                <label className="nv-label">Nome</label>
                <input className="nv-input" placeholder="Nome completo" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
                <label className="nv-label" style={{ marginTop: 12 }}>Telefone / WhatsApp</label>
                <input className="nv-input" placeholder="(41) 99999-0000" value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} />
                <p className="nv-hint">💡 Será cadastrado automaticamente ao finalizar</p>
              </div>
            )}

            {/* Hint só quando vazio */}
            {!clienteId && !modoNovoCli && (
              <p className="nv-hint-centered">Sem cliente, será registrada como venda avulsa</p>
            )}
          </>
        )}

        {/* ═══ ETAPA 3: Entrega ═══ */}
        {etapaLabelAtual === 'Entrega' && (
          <>
            <h2 className="nv-titulo">Como será a entrega?</h2>
            <p className="nv-sub">Escolha a modalidade de entrega</p>

            <div className="nv-ent-tipos">
              <button
                type="button"
                data-modo="retirada"
                className={`nv-ent-card ${tipoEntrega === 'retirada' ? 'nv-ent-card--ativo' : ''}`}
                onClick={() => setTipoEntrega('retirada')}
              >
                <div className="nv-ent-emoji nv-ent-emoji--img">
                  <img src="/Sistema/retirada.png" alt="Retirada na loja" />
                </div>
                <div className="nv-ent-nome">Retirada<br />na loja</div>
                <div className="nv-ent-desc">Cliente vai buscar o produto</div>
              </button>
              <button
                type="button"
                data-modo="delivery"
                className={`nv-ent-card ${tipoEntrega === 'entrega' ? 'nv-ent-card--ativo' : ''}`}
                onClick={() => setTipoEntrega('entrega')}
              >
                <div className="nv-ent-emoji nv-ent-emoji--img">
                  <img src="/Sistema/moto.png" alt="Entrega" />
                </div>
                <div className="nv-ent-nome">Entrega</div>
                <div className="nv-ent-desc">Entregue no endereço do cliente</div>
              </button>
            </div>

            {/* Aviso contextual */}
            <div className="nv-ent-aviso">
              <div className="nv-ent-aviso-txt">
                {tipoEntrega === 'retirada' && 'O cliente buscará o produto com você.'}
                {tipoEntrega === 'entrega' && 'O produto será entregue ao cliente.'}
              </div>
            </div>

            {/* Data + Hora — encomenda sempre precisa */}
            {tipo === 'encomenda' && (
              <div className="nv-agend-card">
                <div className="nv-agend-header">
                  <div className="nv-agend-header-ico">📅</div>
                  <div className="nv-agend-header-txt">
                    {tipoEntrega === 'entrega' ? 'Agendamento da entrega' : 'Agendamento da retirada'}
                  </div>
                </div>
                <div className="nv-grid-agend">
                  <div>
                    <label className="nv-label">Data</label>
                    <button type="button" className="nv-input nv-input-btn" onClick={() => { const el = dataRef.current; if (el?.showPicker) el.showPicker(); else el?.click() }}>
                      {dataEntrega ? formatDataBR(dataEntrega) : <span className="nv-input-btn-ph">Definir data</span>}
                      <svg className="nv-input-btn-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </button>
                    <input ref={dataRef} type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} className="nv-hidden-date" />
                  </div>
                  <div>
                    <label className="nv-label">Hora</label>
                    <button type="button" className="nv-input nv-input-btn" onClick={() => setHoraSheetAberto(true)}>
                      {horarioEntrega || <span className="nv-input-btn-ph">Definir hora</span>}
                      <svg className="nv-input-btn-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Endereço + Frete — Entrega */}
            {tipoEntrega === 'entrega' && (
              <>
                <div className="nv-ent-endereco">
                  <div className="nv-ent-secao-lbl">📍 Endereço de entrega</div>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <label className="nv-label">CEP</label>
                    <input
                      className="nv-input"
                      inputMode="numeric"
                      placeholder="00000-000"
                      value={enderecoCep}
                      maxLength={9}
                      onChange={e => {
                        const masked = formatCep(e.target.value)
                        setEnderecoCep(masked)
                        if (masked.replace(/\D/g, '').length === 8) fetchCep(masked)
                      }}
                    />
                    {cepLoading && <span className="nv-cep-loading">🔍 Buscando…</span>}
                  </div>
                  <div className="nv-grid-2" style={{ marginBottom: 10 }}>
                    <div>
                      <label className="nv-label">Rua</label>
                      <input className="nv-input" value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} placeholder="Rua Brigadeiro Franco" />
                    </div>
                    <div>
                      <label className="nv-label">Número</label>
                      <input className="nv-input" value={enderecoNumero} onChange={e => setEnderecoNumero(e.target.value)} placeholder="1234" />
                    </div>
                  </div>
                  <div className="nv-grid-2" style={{ marginBottom: 10 }}>
                    <div>
                      <label className="nv-label">Bairro</label>
                      <input className="nv-input" value={enderecoBairro} onChange={e => setEnderecoBairro(e.target.value)} placeholder="Batel" />
                    </div>
                    <div>
                      <label className="nv-label">Cidade</label>
                      <input className="nv-input" value={enderecoCidade} onChange={e => setEnderecoCidade(e.target.value)} />
                    </div>
                  </div>
                  <label className="nv-label">Complemento / Referência</label>
                  <input className="nv-input" value={enderecoComplemento} onChange={e => setEnderecoComplemento(e.target.value)} placeholder="Apto 302, portão azul, etc" />
                </div>

                <div className="nv-ent-frete">
                  <div className="nv-ent-frete-ico">💰</div>
                  <div className="nv-ent-frete-info">
                    <div className="nv-ent-frete-lbl">Valor do frete</div>
                    <input
                      className="nv-ent-frete-inp"
                      inputMode="decimal"
                      placeholder="R$ 0,00"
                      value={formatMaskMoney(taxaEntrega)}
                      onChange={e => setTaxaEntrega(parseMaskMoney(e.target.value))}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══ ETAPA 5: Pagamento ═══ */}
        {etapaLabelAtual === 'Pagamento' && (
          <>
            <h2 className="nv-titulo">Como o cliente pagou?</h2>
            <p className="nv-sub">Forma, situação e ajustes de valor</p>

            {/* Total em destaque */}
            <div className="nv-pag-total">
              <div className="nv-pag-total-lbl">Total da venda</div>
              <div className="nv-pag-total-val">{formatMoney(total)}</div>
            </div>

            {/* Forma de pagamento */}
            <div className="nv-agend-card">
              <div className="nv-agend-header">
                <div className="nv-agend-header-ico">💳</div>
                <div className="nv-agend-header-txt">Forma de pagamento</div>
              </div>
              <div className="nv-pag-formas">
                {[
                  { key: 'PIX', emoji: '💠' },
                  { key: 'Dinheiro', emoji: '💵' },
                  { key: 'Cartão', emoji: '💳' },
                  { key: 'Boleto', emoji: '📄' },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`nv-pag-forma ${formaPagamento === f.key ? 'nv-pag-forma--ativo' : ''}`}
                    onClick={() => setFormaPagamento(f.key)}
                  >
                    <span className="nv-pag-forma-em">{f.emoji}</span>
                    {f.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Situação */}
            <div className="nv-agend-card">
              <div className="nv-agend-header">
                <div className="nv-agend-header-ico">✅</div>
                <div className="nv-agend-header-txt">Situação do pagamento</div>
              </div>
              <div className="nv-pag-sit-cards">
                <label className={`nv-pag-sit-card ${situacaoPag === 'total' ? 'nv-pag-sit-card--ativo' : ''}`}>
                  <input type="radio" checked={situacaoPag === 'total'} onChange={() => setSituacaoPag('total')} />
                  <span className="nv-pag-sit-radio" />
                  <div className="nv-pag-sit-info">
                    <div className="nv-pag-sit-nome">Pagamento completo</div>
                    <div className="nv-pag-sit-desc">Recebi {formatMoney(total)} agora</div>
                  </div>
                </label>
                <label className={`nv-pag-sit-card ${situacaoPag === 'parcial' ? 'nv-pag-sit-card--ativo' : ''}`}>
                  <input type="radio" checked={situacaoPag === 'parcial'} onChange={() => setSituacaoPag('parcial')} />
                  <span className="nv-pag-sit-radio" />
                  <div className="nv-pag-sit-info">
                    <div className="nv-pag-sit-nome">Pagamento parcial</div>
                    <div className="nv-pag-sit-desc">Recebi só uma parte</div>
                  </div>
                </label>
                {situacaoPag === 'parcial' && (
                  <input
                    className="nv-input"
                    style={{ marginTop: 4 }}
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={formatMaskMoney(valorParcial)}
                    onChange={e => setValorParcial(parseMaskMoney(e.target.value))}
                  />
                )}
                <label className={`nv-pag-sit-card ${situacaoPag === 'fiado' ? 'nv-pag-sit-card--ativo' : ''}`}>
                  <input type="radio" checked={situacaoPag === 'fiado'} onChange={() => setSituacaoPag('fiado')} />
                  <span className="nv-pag-sit-radio" />
                  <div className="nv-pag-sit-info">
                    <div className="nv-pag-sit-nome">Fiado</div>
                    <div className="nv-pag-sit-desc">Cliente vai pagar depois</div>
                  </div>
                </label>
                {situacaoPag === 'fiado' && (
                  <div style={{ marginTop: 4 }}>
                    <label className="nv-label">Data prevista pagamento</label>
                    <button type="button" className="nv-input nv-input-btn" onClick={() => { const el = dataPrevRef.current; if (el?.showPicker) el.showPicker(); else el?.click() }}>
                      {dataPrevistaPagamento ? formatDataBR(dataPrevistaPagamento) : <span className="nv-input-btn-ph">Definir data</span>}
                      <svg className="nv-input-btn-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </button>
                    <input ref={dataPrevRef} type="date" value={dataPrevistaPagamento} onChange={e => setDataPrevistaPagamento(e.target.value)} className="nv-hidden-date" />
                  </div>
                )}
              </div>
            </div>

            {/* Descontos e acréscimos */}
            <div className="nv-agend-card">
              <div className="nv-agend-header">
                <div className="nv-agend-header-ico">🎫</div>
                <div className="nv-agend-header-txt">Descontos e acréscimos (opcional)</div>
              </div>
              <div className="nv-grid-2">
                <div>
                  <label className="nv-label">Desconto</label>
                  <input className="nv-input" inputMode="numeric" placeholder="R$ 0,00" value={formatMaskMoney(desconto)} onChange={e => setDesconto(parseMaskMoney(e.target.value))} />
                </div>
                <div>
                  <label className="nv-label">Acréscimo</label>
                  <input className="nv-input" inputMode="numeric" placeholder="R$ 0,00" value={formatMaskMoney(acrescimo)} onChange={e => setAcrescimo(parseMaskMoney(e.target.value))} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ ETAPA 6: Revisar ═══ */}
        {etapaLabelAtual === 'Revisar' && (
          <>
            <h2 className="nv-titulo">Confira antes de finalizar</h2>
            <p className="nv-sub">Escolha o status inicial e revise os dados</p>

            {/* Seletor de status inicial */}
            <div className="nv-status-cards">
              <div className="nv-status-lbl">Status do pedido</div>
              <div className="nv-status-grid">
                <button type="button" className={`nv-status-card ${statusPedido === 'aguardando_aceite' ? 'nv-status-card--ativo' : ''}`} onClick={() => setStatusPedido('aguardando_aceite')}>
                  <div className="nv-status-emoji">📥</div>
                  <div className="nv-status-nome">Aguardando<br />aprovação</div>
                </button>
                <button type="button" className={`nv-status-card ${statusPedido === 'agendado' ? 'nv-status-card--ativo' : ''}`} onClick={() => setStatusPedido('agendado')}>
                  <div className="nv-status-emoji">📅</div>
                  <div className="nv-status-nome">Agendado</div>
                </button>
                <button type="button" className={`nv-status-card ${statusPedido === 'finalizado' ? 'nv-status-card--ativo' : ''}`} onClick={() => setStatusPedido('finalizado')}>
                  <div className="nv-status-emoji">✨</div>
                  <div className="nv-status-nome">Finalizado</div>
                </button>
                <button type="button" className={`nv-status-card ${statusPedido === 'entregue' ? 'nv-status-card--ativo' : ''}`} onClick={() => setStatusPedido('entregue')}>
                  <div className="nv-status-emoji">✅</div>
                  <div className="nv-status-nome">Entregue</div>
                </button>
              </div>
            </div>

            <div className="nv-cupom">
              {/* Cabeçalho: tipo + info organizada */}
              <div className="nv-cupom-head">
                <div className="nv-cupom-tipo">
                  {tipo === 'encomenda' ? '📅 ENCOMENDA' : '⚡ PRONTA ENTREGA'}
                </div>
                <div className="nv-cupom-linha nv-cupom-linha--head">
                  <span>Cliente</span>
                  <b>{semCliente || !clienteNome ? 'Venda avulsa' : toTitleCase(clienteNome)}</b>
                </div>
                {clienteTelefone && (
                  <div className="nv-cupom-linha nv-cupom-linha--head">
                    <span>Telefone</span>
                    <b>{clienteTelefone}</b>
                  </div>
                )}
                <div className="nv-cupom-linha nv-cupom-linha--head">
                  <span>Data do pedido</span>
                  <b>{new Date().toLocaleDateString('pt-BR')}</b>
                </div>
                {tipo === 'encomenda' && dataEntrega && (
                  <div className="nv-cupom-linha nv-cupom-linha--head">
                    <span>Data da entrega</span>
                    <b>{new Date(dataEntrega + 'T00:00').toLocaleDateString('pt-BR')}</b>
                  </div>
                )}
                {tipo === 'encomenda' && horarioEntrega && (
                  <div className="nv-cupom-linha nv-cupom-linha--head">
                    <span>Horário</span>
                    <b>{horarioEntrega}</b>
                  </div>
                )}
                <div className="nv-cupom-linha nv-cupom-linha--head">
                  <span>Modalidade</span>
                  <b>
                    {tipoEntrega === 'retirada' && '🏠 Retirada na loja'}
                    {tipoEntrega === 'entrega' && '🛵 Entrega'}
                  </b>
                </div>
              </div>

              {/* Produtos */}
              <div className="nv-cupom-secao">
                <div className="nv-cupom-secao-lbl">Produtos</div>
                {itens.map((it, idx) => (
                  <div key={idx}>
                    <div className="nv-cupom-linha">
                      <span>{it.quantidade}× {toTitleCase(it.nome_produto)}</span>
                      <b>{formatMoney(it.valor_unitario * it.quantidade)}</b>
                    </div>
                    {it.observacoes && (
                      <div className="nv-cupom-obs">↳ {it.observacoes}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Breakdown */}
              <div className="nv-cupom-secao">
                <div className="nv-cupom-linha nv-cupom-linha--dim">
                  <span>Subtotal</span>
                  <b>{formatMoney(subtotalProdutos)}</b>
                </div>
                {tipoEntrega === 'entrega' && taxaEntrega > 0 && (
                  <div className="nv-cupom-linha nv-cupom-linha--dim">
                    <span>Frete</span>
                    <b>{formatMoney(taxaEntrega)}</b>
                  </div>
                )}
                {desconto > 0 && (
                  <div className="nv-cupom-linha nv-cupom-linha--dim">
                    <span>Desconto</span>
                    <b>−{formatMoney(desconto)}</b>
                  </div>
                )}
                {acrescimo > 0 && (
                  <div className="nv-cupom-linha nv-cupom-linha--dim">
                    <span>Acréscimo</span>
                    <b>+{formatMoney(acrescimo)}</b>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="nv-cupom-total">
                <div className="nv-cupom-total-lbl">TOTAL</div>
                <div className="nv-cupom-total-val">{formatMoney(total)}</div>
              </div>

              {/* Pagamento — breakdown se parcial ou fiado */}
              {(situacaoPag === 'parcial' || situacaoPag === 'fiado') && (
                <div className="nv-cupom-secao">
                  <div className="nv-cupom-secao-lbl">Pagamento</div>
                  {situacaoPag === 'parcial' && (
                    <>
                      <div className="nv-cupom-linha nv-cupom-linha--dim">
                        <span>Recebido</span>
                        <b>{formatMoney(valorParcial)}</b>
                      </div>
                      <div className="nv-cupom-linha nv-cupom-linha--dev">
                        <span>A receber</span>
                        <b>{formatMoney(Math.max(0, total - valorParcial))}</b>
                      </div>
                    </>
                  )}
                  {situacaoPag === 'fiado' && (
                    <>
                      <div className="nv-cupom-linha nv-cupom-linha--dim">
                        <span>Recebido</span>
                        <b>R$ 0,00</b>
                      </div>
                      <div className="nv-cupom-linha nv-cupom-linha--dev">
                        <span>A receber</span>
                        <b>{formatMoney(total)}</b>
                      </div>
                      {dataPrevistaPagamento && (
                        <div className="nv-cupom-linha nv-cupom-linha--dim">
                          <span>Previsão de pagamento</span>
                          <b>{new Date(dataPrevistaPagamento + 'T00:00').toLocaleDateString('pt-BR')}</b>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Rodapé: entrega + pagamento */}
              <div className="nv-cupom-secao nv-cupom-secao--foot">
                <div className="nv-cupom-linha">
                  <span>
                    {tipoEntrega === 'entrega' ? '🛵 Entrega' : '🏠 Retirada na loja'}
                    {tipo === 'encomenda' && dataEntrega && ` em ${new Date(dataEntrega + 'T00:00').toLocaleDateString('pt-BR')}`}
                    {tipo === 'encomenda' && horarioEntrega && ` · ${horarioEntrega}`}
                  </span>
                </div>
                {tipoEntrega === 'entrega' && enderecoRua && (
                  <div className="nv-cupom-linha nv-cupom-linha--dim">
                    <span>{enderecoRua}{enderecoNumero && `, ${enderecoNumero}`}</span>
                  </div>
                )}
                <div className="nv-cupom-linha">
                  <span>
                    💳 {formaPagamento || 'Não definido'} · {' '}
                    {situacaoPag === 'total' && 'Pago total'}
                    {situacaoPag === 'parcial' && `Parcial (${formatMoney(valorParcial)})`}
                    {situacaoPag === 'fiado' && `Fiado${dataPrevistaPagamento ? ` até ${new Date(dataPrevistaPagamento + 'T00:00').toLocaleDateString('pt-BR')}` : ''}`}
                  </span>
                </div>
              </div>
            </div>

            <label className="nv-label" style={{ marginTop: 16 }}>📝 Observações (opcional)</label>
            <textarea className="nv-input" style={{ minHeight: 140, resize: 'vertical' }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Cuidados especiais, alergias, decoração..." />
          </>
        )}

      </div>

      {/* Rodapé só com botões */}
      <div className="nv-footer">
        <div />
        <div className="nv-footer-btns">
          <button className="nv-btn nv-btn-voltar" onClick={voltarEtapa} type="button">
            {etapa === 1 ? '← Cancelar' : '← Voltar'}
          </button>
          {isUltima ? (
            <button className="nv-btn nv-btn-final" onClick={finalizarVenda} disabled={salvando} type="button">
              {salvando ? 'Salvando...' : '✓ Finalizar Venda'}
            </button>
          ) : (
            <button className="nv-btn nv-btn-avancar" onClick={proximaEtapa} disabled={!podeAvancar()} type="button">
              {etapas[etapa]} →
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ═══ MODAL: escolher produto ═══ */}
    {modalProduto && (() => {
      const produtosFiltrados = produtos.filter(p => {
        const matchBusca = p.nome.toLowerCase().includes(buscaProduto.toLowerCase())
        const matchCat = !filtroCategoria || (p.categoria || '').trim() === filtroCategoria
        return matchBusca && matchCat
      })
      const labelFiltro = filtroCategoria || 'Todas'
      const temCategorias = categoriasComContagem.length > 0
      return (
      <div className="nv-modal-overlay" onClick={() => { setModalProduto(false); setDropdownAberto(false); }}>
        <div className="nv-modal" onClick={e => e.stopPropagation()}>
          <h3 className="nv-modal-title">Escolher produto</h3>

          <div className="nv-filtro-row">
            <input className="nv-input" placeholder="Buscar produto..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} />
            {temCategorias && (
              <div className={`nv-dropdown ${dropdownAberto ? 'nv-dropdown--open' : ''}`}>
                <button
                  type="button"
                  className={`nv-dropdown-btn ${filtroCategoria ? 'nv-dropdown-btn--ativo' : ''}`}
                  onClick={() => setDropdownAberto(!dropdownAberto)}
                >
                  <span>{labelFiltro}</span>
                  <svg className="nv-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                {dropdownAberto && (
                  <div className="nv-dropdown-menu">
                    <button
                      type="button"
                      className={`nv-dropdown-item ${!filtroCategoria ? 'nv-dropdown-item--ativo' : ''}`}
                      onClick={() => { setFiltroCategoria(null); setDropdownAberto(false); }}
                    >
                      <span>Todas</span>
                      <span className="nv-dropdown-count">{produtos.length}</span>
                    </button>
                    {categoriasComContagem.map(c => (
                      <button
                        key={c.nome}
                        type="button"
                        className={`nv-dropdown-item ${filtroCategoria === c.nome ? 'nv-dropdown-item--ativo' : ''}`}
                        onClick={() => { setFiltroCategoria(c.nome); setDropdownAberto(false); }}
                      >
                        <span>{c.nome}</span>
                        <span className="nv-dropdown-count">{c.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="nv-modal-lista">
            {produtosFiltrados.map(p => (
              <button key={p.id} type="button" className="nv-modal-item" onClick={() => addProduto(p)}>
                <div className="nv-modal-item-img">{p.imagem_url ? <img src={p.imagem_url} alt={p.nome} /> : '🎂'}</div>
                <div className="nv-modal-item-nome">{toTitleCase(p.nome)}</div>
                <div className="nv-modal-item-preco">{formatMoney(p.preco_normal)}</div>
              </button>
            ))}
            {produtos.length === 0 && <p className="nv-empty">Nenhum produto cadastrado. <a href="/produtos">Cadastre um produto</a></p>}
            {produtos.length > 0 && produtosFiltrados.length === 0 && <p className="nv-empty">Nenhum produto encontrado com esse filtro</p>}
          </div>
          <button className="nv-btn nv-btn-voltar" style={{ marginTop: 12, width: '100%' }} onClick={() => { setModalProduto(false); setDropdownAberto(false); }}>Fechar</button>
        </div>
      </div>
      )
    })()}

    {/* ═══ MODAL: buscar cliente ═══ */}
    {modalCliente && (
      <div className="nv-modal-overlay" onClick={() => setModalCliente(false)}>
        <div className="nv-modal" onClick={e => e.stopPropagation()}>
          <h3 className="nv-modal-title">Buscar cliente</h3>
          <input className="nv-input" placeholder="Nome ou telefone..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} />
          <div className="nv-modal-lista">
            {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || (c.telefone || '').includes(buscaCliente)).map(c => (
              <button key={c.id} type="button" className="nv-modal-item" onClick={() => selecionarCliente(c)}>
                <div className="nv-modal-item-avatar">{initialsOf(c.nome)}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="nv-modal-item-nome">{toTitleCase(c.nome)}</div>
                  {c.telefone && <div className="nv-modal-item-sub">{c.telefone}</div>}
                </div>
              </button>
            ))}
            {clientes.length === 0 && <p className="nv-empty">Nenhum cliente cadastrado ainda</p>}
          </div>
          <button className="nv-btn nv-btn-voltar" style={{ marginTop: 12, width: '100%' }} onClick={() => setModalCliente(false)}>Fechar</button>
        </div>
      </div>
    )}

    {/* ═══ Bottom sheet horário ═══ */}
    {horaSheetAberto && (
      <HorarioSheet
        value={horarioEntrega}
        onChange={setHorarioEntrega}
        onClose={() => setHoraSheetAberto(false)}
        titulo="Horário de entrega"
      />
    )}

    <style>{`
      .nv-root {
        max-width: 720px;
        margin: 1.25rem auto;
        background: #fff;
        border-radius: 12px;
        box-shadow: 0 6px 24px rgba(0,0,0,0.05);
        font-family: var(--font-base) !important;
        display: flex;
        flex-direction: column;
      }
      @media (max-width: 767px) {
        .nv-root { margin: 0; border-radius: 0; min-height: calc(100vh - 180px); box-shadow: none; }
      }

      /* Barra de progresso */
      .nv-progress {
        display: flex;
        justify-content: center;
        padding: 28px 20px 12px;
        background: #fff;
        border-radius: 12px 12px 0 0;
      }
      .nv-pb-bar {
        width: 82%;
        height: 10px;
        background: #FCE0E9;
        border-radius: 999px;
        overflow: hidden;
      }
      .nv-pb-fill {
        height: 100%;
        background: #E85A8C;
        border-radius: 999px;
        transition: width 0.35s ease;
      }
      @media (max-width: 767px) {
        .nv-progress { padding: 22px 16px 10px; border-radius: 10px 10px 0 0; }
      }

      /* Corpo */
      .nv-corpo { padding: 24px 28px; flex: 1; }
      @media (max-width: 767px) { .nv-corpo { padding: 20px; } }
      .nv-titulo { font-size: 18px; font-weight: 900; letter-spacing: -0.01em; color: #2D1F26; margin: 0 0 4px; font-family: var(--font-base) !important; }
      .nv-sub { font-size: 13px; color: #6B5D64; margin: 0 0 18px; font-family: var(--font-base) !important; }

      /* Tipos venda */
      .nv-tipos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }

      /* Botão adicionar produto (largura total) */
      .nv-add-produto {
        all: unset;
        display: block; box-sizing: border-box; width: 100%;
        padding: 13px;
        border-radius: 10px;
        font-size: 13.5px; font-weight: 800;
        letter-spacing: 0.01em;
        text-align: center;
        cursor: pointer;
        font-family: var(--font-base) !important;
        margin-bottom: 18px;
        transition: filter 0.12s, transform 0.08s;
      }
      .nv-add-produto--ativo {
        background: #E85A8C; color: #fff;
        box-shadow: 0 3px 0 #C33A6E;
        animation: nvPulseSutil 0.7s ease-in-out 3;
      }
      .nv-add-produto--ativo:hover { filter: brightness(1.05); }
      .nv-add-produto--ativo:active { transform: translateY(3px); box-shadow: 0 0 0 #C33A6E; animation: none; }

      @keyframes nvPulseSutil {
        0%, 100% { transform: scale(1); box-shadow: 0 3px 0 #C33A6E; }
        50% { transform: scale(1.025); box-shadow: 0 6px 16px rgba(232,90,140,0.35), 0 3px 0 #C33A6E; }
      }
      .nv-add-produto--dis {
        background: #F5F1F3; color: #B8ACB1;
        cursor: not-allowed;
      }

      /* Área vazia (empty state) */
      .nv-area-vazia {
        background: #FAFAFA;
        border: 1.5px dashed #E5D8DE;
        border-radius: 10px;
        padding: 60px 20px;
        text-align: center;
        min-height: 220px;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: var(--font-base) !important;
      }
      .nv-area-vazia-1 { font-size: 14px; font-weight: 700; color: #6B5D64; margin-bottom: 6px; font-family: var(--font-base) !important; }
      .nv-area-vazia-2 { font-size: 12.5px; color: #9A8B93; font-family: var(--font-base) !important; }
      .nv-area-vazia-2 b { font-weight: 700; color: #E85A8C; }

      /* Área com produtos */
      .nv-area-produtos {
        background: #FAFAFA;
        border: 1.5px dashed #E5D8DE;
        border-radius: 10px;
        padding: 6px;
        display: flex; flex-direction: column; gap: 6px;
        min-height: 180px;
      }
      .nv-p-item {
        background: #fff;
        border: 1px solid #F0EBED;
        border-radius: 8px;
        padding: 12px;
      }
      .nv-p-item-topo {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 8px;
      }
      .nv-p-item-img {
        width: 60px; height: 60px; border-radius: 9px;
        background: #F5EEF0; display: flex; align-items: center; justify-content: center;
        font-size: 28px; overflow: hidden; flex-shrink: 0;
      }
      .nv-p-item-img img { width: 100%; height: 100%; object-fit: cover; }
      .nv-p-item-info { flex: 1; min-width: 0; }
      .nv-p-item-nome {
        font-size: 14px; font-weight: 700; color: #2D1F26;
        font-family: var(--font-base) !important;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nv-p-item-linha-preco {
        display: flex; align-items: baseline; gap: 8px;
        margin-top: 4px;
        flex-wrap: wrap;
      }
      .nv-p-item-preco {
        font-size: 16px; font-weight: 900; letter-spacing: -0.01em;
        color: #2D1F26; font-family: var(--font-base) !important;
      }
      .nv-p-item-unit { font-size: 11.5px; color: #9A8B93; font-family: var(--font-base) !important; }
      .nv-p-item-controls {
        display: flex; align-items: center; gap: 6px;
        flex-wrap: nowrap;
        margin-bottom: 8px;
      }
      .nv-qtd {
        display: inline-flex; align-items: center; gap: 4px;
        background: #F5F1F3; border-radius: 6px; padding: 2px;
        flex-shrink: 0;
      }
      .nv-qtd-btn { all: unset; width: 26px; height: 26px; border-radius: 5px; background: #fff; color: #2D1F26; font-weight: 800; text-align: center; cursor: pointer; font-family: var(--font-base); box-shadow: 0 1px 2px rgba(0,0,0,0.04); display: flex; align-items: center; justify-content: center; }
      .nv-qtd-btn:hover { background: #EBE5E8; }
      .nv-qtd-num { font-size: 12px; font-weight: 800; min-width: 22px; text-align: center; }
      .nv-p-item-obs {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 12px;
        border: 1.5px solid #F0EBED;
        border-radius: 6px;
        font-size: 12px;
        font-family: var(--font-base) !important;
        background: #fff;
        outline: none;
        transition: border-color 0.12s;
        color: #2D1F26;
      }
      .nv-p-item-obs:focus { border-color: #E85A8C; }
      .nv-p-item-obs::placeholder { color: #B8ACB1; font-style: italic; }
      .nv-p-item-lixo { all: unset; padding: 6px; color: #DC2626; cursor: pointer; border-radius: 5px; flex-shrink: 0; }
      .nv-p-item-lixo:hover { background: #FEE2E2; }
      .nv-p-item-dup { all: unset; padding: 6px; color: #6B5D64; cursor: pointer; border-radius: 5px; flex-shrink: 0; }
      .nv-p-item-dup:hover { background: #F0EBED; color: #E85A8C; }

      /* Sub-linha resumo (Produtos xN) */
      .nv-resumo-mini-sub {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; color: #6B5D64;
        padding: 4px 0 6px;
        border-bottom: 1px dashed #F0EBED;
        margin-bottom: 6px;
        font-family: var(--font-base) !important;
      }
      .nv-resumo-mini-sub span:last-child { font-weight: 700; color: #2D1F26; }

      /* Resumo mini (accordion na etapa 1) */
      .nv-resumo-mini {
        margin-top: 20px;
        background: #FDFAFB;
        border: 1.5px solid #F0EBED;
        border-radius: 10px;
        font-family: var(--font-base) !important;
        overflow: hidden;
      }
      .nv-resumo-header {
        all: unset;
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; box-sizing: border-box;
        padding: 14px 18px;
        cursor: pointer;
        font-family: var(--font-base) !important;
      }
      .nv-resumo-header:hover { background: #FAF3F6; }
      .nv-resumo-header-info { flex: 1; min-width: 0; }
      .nv-resumo-mini-lbl {
        font-size: 10.5px; font-weight: 800;
        color: #9A8B93;
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--font-base) !important;
      }
      .nv-resumo-header-total {
        font-size: 20px; font-weight: 900; letter-spacing: -0.02em;
        color: #2D1F26;
        margin-top: 3px;
        font-family: var(--font-base) !important;
      }
      .nv-resumo-chevron {
        color: #6B5D64;
        flex-shrink: 0;
        transition: transform 0.2s ease;
      }
      .nv-resumo-mini--open .nv-resumo-chevron { transform: rotate(180deg); color: #E85A8C; }

      .nv-resumo-corpo {
        padding: 0 18px 14px;
        border-top: 1px dashed #F0EBED;
        padding-top: 12px;
        animation: nvResumoIn 0.2s ease;
      }
      @keyframes nvResumoIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .nv-resumo-mini-row {
        display: flex; justify-content: space-between; align-items: center;
        margin-top: 8px;
      }
      .nv-resumo-mini-row > span:first-child {
        font-size: 13px; font-weight: 700; color: #2D1F26;
      }
      .nv-resumo-mini-val {
        font-size: 20px; font-weight: 900; letter-spacing: -0.02em; color: #2D1F26;
        font-family: var(--font-base) !important;
      }
      .nv-tipo-card {
        all: unset;
        padding: 22px 14px; border-radius: 14px;
        cursor: pointer;
        text-align: center; box-sizing: border-box;
        border: 2px solid transparent;
        box-shadow: 0 3px 10px rgba(0,0,0,0.06);
        transition: all 0.15s;
        font-family: var(--font-base) !important;
      }
      .nv-tipo-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); }

      /* Encomenda - rosa */
      .nv-tipo-card[data-tipo="encomenda"] {
        background: linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%);
      }
      .nv-tipo-card[data-tipo="encomenda"] .nv-tipo-nome,
      .nv-tipo-card[data-tipo="encomenda"] .nv-tipo-desc {
        color: #831843;
      }
      .nv-tipo-card[data-tipo="encomenda"].nv-tipo-card--ativo {
        border-color: #E85A8C;
        box-shadow: 0 6px 20px rgba(232,90,140,0.25);
      }

      /* Pronta Entrega - amarelo */
      .nv-tipo-card[data-tipo="pronta_entrega"] {
        background: linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%);
      }
      .nv-tipo-card[data-tipo="pronta_entrega"] .nv-tipo-nome,
      .nv-tipo-card[data-tipo="pronta_entrega"] .nv-tipo-desc {
        color: #78350F;
      }
      .nv-tipo-card[data-tipo="pronta_entrega"].nv-tipo-card--ativo {
        border-color: #D97706;
        box-shadow: 0 6px 20px rgba(217,119,6,0.25);
      }

      .nv-tipo-emoji { font-size: 40px; margin-bottom: 6px; display: block; line-height: 1; }
      .nv-tipo-emoji--img {
        height: 44px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 6px;
      }
      .nv-tipo-emoji--img img {
        height: 100%;
        width: auto;
        object-fit: contain;
      }
      .nv-tipo-nome { font-size: 14.5px; font-weight: 900; letter-spacing: -0.01em; font-family: var(--font-base) !important; }
      .nv-tipo-desc { font-size: 11.5px; margin-top: 4px; line-height: 1.35; font-weight: 600; opacity: 0.8; font-family: var(--font-base) !important; }

      /* Itens da venda */
      .nv-empty {
        text-align: center;
        padding: 30px 20px;
        color: #9A8B93;
        font-size: 13px;
        font-family: var(--font-base) !important;
      }
      .nv-itens { display: flex; flex-direction: column; gap: 8px; }
      .nv-item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px; background: #FDFAFB;
        border-radius: 8px; border: 1.5px solid #F5EEF0;
      }
      .nv-item-img { width: 40px; height: 40px; background: #F5EEF0; border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 20px; overflow: hidden; flex-shrink: 0; }
      .nv-item-img img { width: 100%; height: 100%; object-fit: cover; }
      .nv-item-info { flex: 1; min-width: 0; }
      .nv-item-nome { font-size: 13.5px; font-weight: 700; color: #2D1F26; font-family: var(--font-base) !important; }
      .nv-item-qtd-row { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
      .nv-qtd-btn { all: unset; width: 22px; height: 22px; border-radius: 5px; background: #F5F1F3; color: #2D1F26; font-weight: 800; text-align: center; cursor: pointer; font-family: var(--font-base); }
      .nv-qtd-btn:hover { background: #EBE5E8; }
      .nv-qtd-num { font-size: 12.5px; font-weight: 700; min-width: 22px; text-align: center; }
      .nv-item-unit { font-size: 11.5px; color: #9A8B93; margin-left: 6px; }
      .nv-item-preco { font-size: 13.5px; font-weight: 800; color: #2D1F26; white-space: nowrap; font-family: var(--font-base) !important; }
      .nv-item-lixo { all: unset; padding: 6px; color: #DC2626; cursor: pointer; border-radius: 5px; }
      .nv-item-lixo:hover { background: #FEE2E2; }

      .nv-add-btn {
        all: unset;
        background: #FDFAFB; border: 2px dashed #D5CBCF;
        padding: 14px; border-radius: 8px;
        text-align: center; color: #E85A8C;
        font-size: 13px; cursor: pointer;
        margin-top: 12px; font-weight: 800;
        display: block; box-sizing: border-box; width: 100%;
        font-family: var(--font-base) !important;
      }
      .nv-add-btn:hover { border-color: #E85A8C; background: #FDF3F7; }

      /* Cliente - Seletor + botão + */
      .nv-cli-row {
        display: flex; gap: 8px; align-items: stretch;
        margin-bottom: 8px;
      }
      .nv-cli-selector {
        all: unset;
        flex: 1; min-width: 0;
        display: flex; align-items: center; gap: 8px;
        padding: 12px 14px;
        border: 1.5px solid #E5D8DE; background: #fff;
        border-radius: 10px; cursor: pointer;
        font-size: 13px; color: #9A8B93;
        box-sizing: border-box;
        font-family: var(--font-base) !important;
        transition: border-color 0.12s;
      }
      .nv-cli-selector:hover { border-color: #E85A8C; }
      .nv-cli-selector svg { color: #9A8B93; flex-shrink: 0; }
      .nv-cli-add {
        all: unset;
        width: 44px; height: 44px;
        border-radius: 10px;
        background: #E85A8C; color: #fff;
        cursor: pointer;
        font-size: 20px; font-weight: 900;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 3px 0 #C33A6E;
        flex-shrink: 0;
        transition: filter 0.12s, transform 0.08s;
        font-family: var(--font-base) !important;
        box-sizing: border-box;
      }
      .nv-cli-add:hover { filter: brightness(1.05); }
      .nv-cli-add:active { transform: translateY(3px); box-shadow: 0 0 0 #C33A6E; }
      .nv-cli-add--cancel { background: #6B5D64; box-shadow: 0 3px 0 #4A3540; }
      .nv-cli-add--cancel:active { box-shadow: 0 0 0 #4A3540; }

      /* Card cliente escolhido */
      .nv-cli-escolhido {
        background: #FDF3F7;
        border: 1.5px solid #E85A8C;
        border-radius: 10px;
        padding: 12px 14px;
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 10px;
      }
      .nv-cli-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #E85A8C, #C33A6E);
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 800;
        flex-shrink: 0;
        font-family: var(--font-base) !important;
      }
      .nv-cli-info { flex: 1; min-width: 0; }
      .nv-cli-nome { font-size: 13.5px; font-weight: 800; color: #2D1F26; font-family: var(--font-base) !important; }
      .nv-cli-tel { font-size: 11.5px; color: #6B5D64; margin-top: 1px; font-family: var(--font-base) !important; }
      .nv-cli-x {
        all: unset;
        padding: 6px; border-radius: 50%;
        color: #6B5D64; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .nv-cli-x:hover { background: rgba(0,0,0,0.05); color: #DC2626; }

      /* Card cliente DETALHADO */
      .nv-cli-card {
        background: #fff;
        border: 1.5px solid #E85A8C;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .nv-cli-card-topo {
        display: flex; align-items: center; gap: 12px;
        padding: 14px;
        background: linear-gradient(180deg, #FDF3F7 0%, #FAE8EF 100%);
      }
      .nv-cli-card .nv-cli-avatar {
        width: 44px; height: 44px;
        font-size: 14px;
        box-shadow: 0 3px 8px rgba(232,90,140,0.25);
      }
      .nv-cli-nome-wrap { flex: 1; min-width: 0; }
      .nv-cli-card-nome { font-size: 15px; font-weight: 800; color: #2D1F26; font-family: var(--font-base) !important; letter-spacing: -0.005em; }
      .nv-cli-card-badge {
        font-size: 10px; color: #E85A8C; font-weight: 800;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-top: 2px;
        font-family: var(--font-base) !important;
      }
      .nv-cli-card-x {
        all: unset;
        padding: 6px; border-radius: 50%;
        color: #6B5D64; cursor: pointer;
        background: rgba(255,255,255,0.5);
        display: flex; align-items: center; justify-content: center;
      }
      .nv-cli-card-x:hover { background: #fff; color: #DC2626; }

      .nv-cli-card-dados {
        padding: 10px 14px;
        display: flex; flex-direction: column; gap: 8px;
        background: #fff;
      }
      .nv-cli-card-linha {
        display: flex; align-items: center; gap: 10px;
      }
      .nv-cli-card-ico {
        width: 28px; height: 28px; border-radius: 6px;
        background: #FDF3F7;
        display: flex; align-items: center; justify-content: center;
        color: #E85A8C; flex-shrink: 0;
      }
      .nv-cli-card-lbl {
        color: #9A8B93; font-size: 10.5px;
        text-transform: uppercase; letter-spacing: 0.05em;
        font-weight: 700;
        font-family: var(--font-base) !important;
      }
      .nv-cli-card-txt {
        color: #2D1F26; font-size: 12.5px;
        font-weight: 600;
        margin-top: 1px;
        font-family: var(--font-base) !important;
      }
      .nv-cli-card-txt--vazio { color: #9A8B93; font-style: italic; font-weight: 500; }

      /* Mini mapa */
      .nv-cli-mapa {
        display: block;
        height: 140px;
        background: linear-gradient(135deg, #F0F7F2 0%, #E7F0EA 100%);
        position: relative;
        border-top: 1px solid #F0EBED;
        overflow: hidden;
        cursor: pointer;
        text-decoration: none;
      }
      .nv-cli-mapa-bg {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px);
        background-size: 20px 20px;
      }
      .nv-cli-mapa-pin {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -100%);
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.25));
      }
      .nv-cli-mapa-btn {
        position: absolute; bottom: 8px; right: 8px;
        background: #fff; padding: 6px 10px; border-radius: 6px;
        font-size: 10.5px; font-weight: 800;
        color: #2D1F26; text-transform: uppercase; letter-spacing: 0.06em;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        display: flex; align-items: center; gap: 4px;
        font-family: var(--font-base) !important;
      }

      /* Form novo cliente */
      .nv-form-novo {
        background: #FAFAFA;
        border: 1.5px solid #F0EBED;
        border-radius: 10px;
        padding: 14px;
        margin-top: 8px;
      }
      .nv-form-novo-titulo {
        font-size: 11px; font-weight: 800; color: #E85A8C;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-bottom: 10px;
        font-family: var(--font-base) !important;
      }

      /* Hint centralizado */
      .nv-hint-centered {
        font-size: 11.5px; color: #9A8B93;
        margin-top: 10px; text-align: center;
        font-style: italic;
        font-family: var(--font-base) !important;
      }

      /* Inputs & Labels */
      .nv-label {
        font-size: 11px; font-weight: 800; color: #6B5D64;
        text-transform: uppercase; letter-spacing: 0.05em;
        display: block; margin-bottom: 4px;
        font-family: var(--font-base) !important;
      }
      .nv-input {
        padding: 10px 12px; border: 1.5px solid #E5D8DE;
        border-radius: 8px; font-size: 13.5px;
        font-family: var(--font-base) !important;
        background: #fff; width: 100%; box-sizing: border-box;
        outline: none; transition: border-color 0.12s;
        color: #2D1F26;
      }
      .nv-input:focus { border-color: #E85A8C; }

      .nv-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

      /* Card agendamento (cinza) */
      .nv-agend-card {
        background: #FAFAFA;
        border: 1.5px solid #F0EBED;
        border-radius: 12px;
        padding: 14px;
        margin-top: 14px;
      }
      .nv-agend-header {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 12px;
      }
      .nv-agend-header-ico {
        width: 32px; height: 32px; border-radius: 8px;
        background: #FDF3F7;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
      }
      .nv-agend-header-txt {
        font-size: 11px; font-weight: 800; color: #E85A8C;
        text-transform: uppercase; letter-spacing: 0.06em;
        font-family: var(--font-base) !important;
      }
      .nv-grid-agend { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

      /* Botão que abre picker (input visual) */
      .nv-input-btn {
        cursor: pointer;
        text-align: left;
        font-family: var(--font-base) !important;
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px;
        white-space: nowrap;
        overflow: hidden;
      }
      .nv-input-btn:hover { border-color: #E85A8C; }
      .nv-input-btn-ph { color: #9A8B93; font-style: italic; }
      .nv-input-btn-ico { color: #9A8B93; flex-shrink: 0; }
      .nv-input-btn:hover .nv-input-btn-ico { color: #E85A8C; }

      /* Input date escondido (só usado pra abrir picker nativo) */
      .nv-hidden-date {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
      }

      /* ═══ Etapa Revisar — Status cards ═══ */
      .nv-status-cards {
        margin-bottom: 16px;
      }
      .nv-status-lbl {
        font-size: 11px; font-weight: 800; color: #E85A8C;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-bottom: 10px;
        font-family: var(--font-base) !important;
      }
      .nv-status-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .nv-status-card {
        all: unset;
        padding: 12px 8px;
        border: 1.5px solid #F0EBED;
        background: #fff;
        border-radius: 10px;
        cursor: pointer;
        text-align: center;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        transition: all 0.15s;
        font-family: var(--font-base) !important;
      }
      .nv-status-card:hover { border-color: #E5D8DE; }
      .nv-status-card--ativo {
        border-color: #E85A8C;
        background: #FDF3F7;
      }
      .nv-status-emoji {
        font-size: 22px;
        line-height: 1;
      }
      .nv-status-nome {
        font-size: 12px;
        font-weight: 800;
        color: #4A3540;
        line-height: 1.2;
        font-family: var(--font-base) !important;
      }
      .nv-status-card--ativo .nv-status-nome {
        color: #E85A8C;
      }

      /* ═══ Etapa Revisar — cupom fiscal ═══ */
      .nv-cupom {
        border: 2px dashed #E5D8DE;
        border-radius: 12px;
        padding: 18px 16px;
        background: #FAFAFA;
        font-family: var(--font-base) !important;
      }
      .nv-cupom-head {
        padding-bottom: 14px;
        border-bottom: 1px dashed #D5CBCF;
      }
      .nv-cupom-tipo {
        text-align: center;
        font-size: 10.5px; font-weight: 800;
        color: #6B5D64;
        letter-spacing: 0.1em;
        margin-bottom: 10px;
        font-family: var(--font-base) !important;
      }
      .nv-cupom-linha--head {
        padding: 3px 0 !important;
      }
      .nv-cupom-linha--head span {
        color: #6B5D64 !important;
        font-weight: 600 !important;
      }
      .nv-cupom-linha--head b {
        color: #2D1F26 !important;
        font-weight: 800 !important;
      }

      .nv-cupom-secao {
        padding: 12px 0;
        border-bottom: 1px dashed #D5CBCF;
      }
      .nv-cupom-secao--foot { border-bottom: 0; padding-bottom: 0; }
      .nv-cupom-secao-lbl {
        font-size: 10px; font-weight: 800;
        color: #9A8B93;
        text-transform: uppercase; letter-spacing: 0.08em;
        margin-bottom: 8px;
        font-family: var(--font-base) !important;
      }
      .nv-cupom-linha {
        display: flex; justify-content: space-between; align-items: center;
        gap: 12px;
        padding: 4px 0;
        font-size: 12.5px;
        font-family: var(--font-base) !important;
      }
      .nv-cupom-linha span {
        color: #2D1F26;
        flex: 1; min-width: 0;
        word-break: break-word;
      }
      .nv-cupom-linha b {
        color: #2D1F26; font-weight: 800;
        text-align: right;
        white-space: nowrap;
      }
      .nv-cupom-linha--dim span,
      .nv-cupom-linha--dim b {
        color: #6B5D64 !important;
        font-weight: 600 !important;
      }
      .nv-cupom-linha--dev span {
        color: #991B1B !important;
        font-weight: 700 !important;
      }
      .nv-cupom-linha--dev b {
        color: #991B1B !important;
        font-weight: 900 !important;
      }
      .nv-cupom-obs {
        font-size: 11px;
        color: #E85A8C;
        font-style: italic;
        padding: 2px 0 4px 12px;
        font-family: var(--font-base) !important;
      }

      .nv-cupom-total {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 0 4px;
      }
      .nv-cupom-total-lbl {
        font-size: 11px; font-weight: 800;
        color: #E85A8C;
        letter-spacing: 0.08em;
        font-family: var(--font-base) !important;
      }
      .nv-cupom-total-val {
        font-size: 26px; font-weight: 900;
        color: #831843;
        letter-spacing: -0.02em;
        font-family: var(--font-base) !important;
      }

      /* ═══ Etapa Pagamento ═══ */
      .nv-pag-total {
        background: linear-gradient(160deg, #FDF3F7 0%, #FAE8EF 100%);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        margin-bottom: 4px;
      }
      .nv-pag-total-lbl {
        font-size: 11px; font-weight: 800; color: #E85A8C;
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--font-base) !important;
      }
      .nv-pag-total-val {
        font-size: 30px; font-weight: 900; letter-spacing: -0.02em;
        color: #831843; margin-top: 4px;
        font-family: var(--font-base) !important;
      }

      /* Formas de pagamento (chips) */
      .nv-pag-formas { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; }
      .nv-pag-forma {
        all: unset;
        padding: 10px 6px;
        border: 1.5px solid #F0EBED;
        background: #fff;
        border-radius: 8px;
        font-size: 11.5px; font-weight: 700;
        text-align: center;
        cursor: pointer;
        color: #4A3540;
        box-sizing: border-box;
        font-family: var(--font-base) !important;
        transition: all 0.15s;
      }
      .nv-pag-forma:hover { border-color: #E5D8DE; }
      .nv-pag-forma--ativo {
        border-color: #E85A8C;
        background: #FDF3F7;
        color: #E85A8C;
        font-weight: 800;
      }
      .nv-pag-forma-em {
        font-size: 18px; display: block; margin-bottom: 2px; line-height: 1;
      }

      /* Situação — cards com radio */
      .nv-pag-sit-cards { display: flex; flex-direction: column; gap: 8px; }
      .nv-pag-sit-card {
        padding: 12px 14px;
        border: 1.5px solid #F0EBED;
        background: #fff;
        border-radius: 10px;
        cursor: pointer;
        display: flex; align-items: center; gap: 10px;
        transition: all 0.15s;
      }
      .nv-pag-sit-card:hover { border-color: #E5D8DE; }
      .nv-pag-sit-card--ativo {
        border-color: #E85A8C;
        background: #FDF3F7;
      }
      .nv-pag-sit-card input[type="radio"] { display: none; }
      .nv-pag-sit-radio {
        width: 18px; height: 18px; border-radius: 50%;
        border: 2px solid #D5CBCF;
        flex-shrink: 0;
      }
      .nv-pag-sit-card--ativo .nv-pag-sit-radio {
        border-color: #E85A8C;
        background: #E85A8C;
        box-shadow: inset 0 0 0 3px #fff;
      }
      .nv-pag-sit-info { flex: 1; }
      .nv-pag-sit-nome {
        font-size: 13px; font-weight: 800; color: #2D1F26;
        font-family: var(--font-base) !important;
      }
      .nv-pag-sit-card--ativo .nv-pag-sit-nome { color: #E85A8C; }
      .nv-pag-sit-desc {
        font-size: 11px; color: #6B5D64; margin-top: 2px;
        font-family: var(--font-base) !important;
      }

      /* ═══ Etapa Entrega ═══ */

      .nv-ent-tipos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .nv-ent-tipos--3 { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
      .nv-ent-card {
        all: unset;
        padding: 16px 8px; border-radius: 12px;
        cursor: pointer;
        text-align: center; box-sizing: border-box;
        border: 2px solid transparent;
        background: #F5F1F3;
        transition: all 0.15s;
        font-family: var(--font-base) !important;
      }
      .nv-ent-card:hover { background: #EBE5E8; }
      .nv-ent-card .nv-ent-nome,
      .nv-ent-card .nv-ent-desc { color: #4A3540; }

      /* Ativo — padrão rosa do app */
      .nv-ent-card--ativo {
        background: #FDF3F7 !important;
        border-color: #E85A8C;
        box-shadow: 0 4px 12px rgba(232,90,140,0.15);
      }
      .nv-ent-card--ativo .nv-ent-nome,
      .nv-ent-card--ativo .nv-ent-desc { color: #E85A8C !important; }

      .nv-ent-emoji { font-size: 26px; margin-bottom: 4px; display: block; line-height: 1; }
      .nv-ent-emoji--img {
        height: 32px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 4px;
      }
      .nv-ent-emoji--img img {
        height: 100%;
        width: auto;
        object-fit: contain;
      }
      .nv-ent-nome { font-size: 12.5px; font-weight: 900; letter-spacing: -0.01em; line-height: 1.15; font-family: var(--font-base) !important; }
      .nv-ent-desc { font-size: 10px; margin-top: 6px; font-weight: 600; opacity: 0.85; font-family: var(--font-base) !important; line-height: 1.3; }

      /* Card aviso — apenas texto centralizado */
      .nv-ent-aviso {
        border-radius: 10px;
        padding: 14px 16px;
        margin-top: 14px;
        background: #FDF3F7;
        color: #831843;
        text-align: center;
        font-family: var(--font-base) !important;
      }
      .nv-ent-aviso-txt {
        font-size: 12.5px; font-weight: 700; line-height: 1.4;
        font-family: var(--font-base) !important;
      }

      /* Confirmação pronta entrega + retirada */
      .nv-ent-confirma {
        display: flex; align-items: center; gap: 12px;
        background: linear-gradient(160deg, #D1FAE5 0%, #A7F3D0 100%);
        border-radius: 12px;
        padding: 14px 16px;
        margin-top: 16px;
      }
      .nv-ent-confirma-ico {
        width: 36px; height: 36px; border-radius: 50%;
        background: #10B981; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; font-weight: 900;
        flex-shrink: 0;
      }
      .nv-ent-confirma-titulo { font-size: 13.5px; font-weight: 900; color: #065F46; font-family: var(--font-base) !important; }
      .nv-ent-confirma-sub { font-size: 11.5px; color: #047857; margin-top: 2px; font-family: var(--font-base) !important; }

      /* Card endereço */
      .nv-ent-endereco {
        background: #FAFAFA;
        border: 1.5px solid #F0EBED;
        border-radius: 12px;
        padding: 14px 16px;
        margin-top: 16px;
      }
      .nv-ent-secao-lbl {
        font-size: 11px; font-weight: 800; color: #E85A8C;
        text-transform: uppercase; letter-spacing: 0.06em;
        margin-bottom: 12px;
        font-family: var(--font-base) !important;
      }
      .nv-cep-loading {
        position: absolute;
        right: 12px; top: 34px;
        font-size: 11px;
        color: #E85A8C;
        font-weight: 700;
        font-style: italic;
        font-family: var(--font-base) !important;
      }

      /* Card frete (amarelo destacado) */
      .nv-ent-frete {
        display: flex; align-items: center; gap: 12px;
        background: linear-gradient(160deg, #FEF3C7 0%, #FDE68A 100%);
        border-radius: 12px;
        padding: 12px 14px;
        margin-top: 10px;
      }
      .nv-ent-frete-ico {
        width: 40px; height: 40px; border-radius: 10px;
        background: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }
      .nv-ent-frete-info { flex: 1; min-width: 0; }
      .nv-ent-frete-lbl {
        font-size: 10.5px; font-weight: 800; color: #92400E;
        text-transform: uppercase; letter-spacing: 0.05em;
        font-family: var(--font-base) !important;
      }
      .nv-ent-frete-inp {
        border: 0; background: transparent;
        font-size: 18px; font-weight: 900; letter-spacing: -0.01em;
        color: #78350F;
        outline: none; width: 100%; margin-top: 2px;
        font-family: var(--font-base) !important;
        padding: 0;
      }
      .nv-ent-frete-inp::placeholder { color: #A16207; opacity: 0.6; }

      /* Radios entrega */
      .nv-radio-row { display: flex; gap: 8px; margin-bottom: 16px; }
      .nv-radio {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 14px; border-radius: 8px;
        border: 1.5px solid #F0EBED; cursor: pointer;
        font-size: 13px; font-weight: 700; flex: 1;
        font-family: var(--font-base) !important;
      }
      .nv-radio--ativo { border-color: #E85A8C; background: #FDF3F7; color: #E85A8C; }
      .nv-radio input { display: none; }
      .nv-radio-dot {
        width: 14px; height: 14px; border-radius: 50%;
        border: 2px solid #D5CBCF; flex-shrink: 0;
        transition: all 0.12s;
      }
      .nv-radio--ativo .nv-radio-dot, .nv-pag-opcao--ativo .nv-radio-dot {
        border-color: #E85A8C; background: #E85A8C; box-shadow: inset 0 0 0 2.5px #fff;
      }

      /* Pagamento */
      .nv-formas { display: flex; gap: 6px; flex-wrap: wrap; }
      .nv-forma {
        all: unset;
        padding: 8px 14px; border-radius: 6px;
        border: 1.5px solid #F0EBED; cursor: pointer;
        font-size: 12.5px; font-weight: 700;
        color: #4A3540; box-sizing: border-box;
        font-family: var(--font-base) !important;
      }
      .nv-forma:hover { border-color: #E85A8C; }
      .nv-forma--ativo { border-color: #E85A8C; background: #FDF3F7; color: #E85A8C; }

      .nv-pag-opcoes { display: flex; flex-direction: column; gap: 6px; }
      .nv-pag-opcao {
        display: flex; align-items: center; gap: 8px;
        padding: 10px 14px; border-radius: 8px;
        border: 1.5px solid #F0EBED; cursor: pointer;
        font-size: 13px; font-weight: 700;
        color: #2D1F26;
        font-family: var(--font-base) !important;
      }
      .nv-pag-opcao input { display: none; }
      .nv-pag-opcao--ativo { border-color: #E85A8C; background: #FDF3F7; }

      /* Resumo */
      .nv-resumo { display: flex; flex-direction: column; gap: 6px; }
      .nv-r-linha {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 14px; background: #FAFAFA;
        border-radius: 8px; font-size: 13px;
        font-family: var(--font-base) !important;
      }
      .nv-r-linha span { color: #6B5D64; font-weight: 700; }
      .nv-r-linha b { color: #2D1F26; font-weight: 700; text-align: right; }

      /* Rodapé */
      .nv-footer {
        background: #fff;
        padding: 14px 20px 20px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; border-radius: 0 0 12px 12px;
      }
      .nv-footer-total { display: flex; flex-direction: column; }
      .nv-footer-lbl { font-size: 10.5px; text-transform: uppercase; color: #9A8B93; font-weight: 800; letter-spacing: 0.06em; }
      .nv-footer-val { font-size: 22px; font-weight: 900; color: #2D1F26; letter-spacing: -0.02em; margin-top: -2px; font-family: var(--font-base) !important; }
      .nv-footer-btns { display: flex; gap: 8px; flex-shrink: 0; }
      .nv-btn {
        all: unset;
        padding: 10px 18px; border-radius: 8px;
        font-size: 13px; font-weight: 800; cursor: pointer;
        letter-spacing: 0.01em; box-sizing: border-box;
        text-align: center;
        font-family: var(--font-base) !important;
        transition: filter 0.12s, transform 0.08s;
      }
      .nv-btn-voltar { background: #F5F1F3; color: #6B5D64; }
      .nv-btn-voltar:hover { background: #EBE5E8; }
      .nv-btn-avancar { background: #E85A8C; color: #fff; box-shadow: 0 3px 0 #C33A6E; }
      .nv-btn-avancar:hover:not(:disabled) { filter: brightness(1.05); }
      .nv-btn-avancar:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 #C33A6E; }
      .nv-btn-avancar:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
      .nv-btn-final { background: #16A34A; color: #fff; box-shadow: 0 3px 0 #15803D; padding: 10px 22px; }
      .nv-btn-final:hover:not(:disabled) { filter: brightness(1.05); }
      .nv-btn-final:active:not(:disabled) { transform: translateY(3px); box-shadow: 0 0 0 #15803D; }
      .nv-btn-final:disabled { opacity: 0.6; cursor: not-allowed; }

      /* Modais */
      .nv-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(45,31,38,0.55);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 20px; z-index: 10000;
        animation: nvMOverIn 0.15s ease-out;
      }
      @keyframes nvMOverIn { from { opacity: 0; } to { opacity: 1; } }
      .nv-modal {
        background: #fff; border-radius: 14px;
        padding: 20px; max-width: 460px; width: 100%;
        height: 80vh; max-height: 640px;
        display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        font-family: var(--font-base) !important;
      }
      .nv-modal-title { font-size: 16px; font-weight: 900; color: #2D1F26; margin: 0 0 12px; font-family: var(--font-base) !important; }

      /* Filtro row (busca + dropdown) */
      .nv-filtro-row {
        display: flex; gap: 8px; align-items: stretch;
        margin-bottom: 4px;
      }
      .nv-filtro-row .nv-input { flex: 1; min-width: 0; }
      .nv-dropdown {
        position: relative;
        flex-shrink: 0;
        min-width: 120px;
      }
      .nv-dropdown-btn {
        all: unset;
        box-sizing: border-box;
        width: 100%;
        display: flex; align-items: center; justify-content: space-between; gap: 6px;
        padding: 10px 12px;
        border: 1.5px solid #E5D8DE;
        background: #fff;
        border-radius: 8px;
        font-size: 13px; font-weight: 600;
        color: #2D1F26;
        cursor: pointer;
        font-family: var(--font-base) !important;
        transition: border-color 0.12s;
      }
      .nv-dropdown-btn:hover { border-color: #E85A8C; }
      .nv-dropdown-btn--ativo { border-color: #E85A8C; background: #FDF3F7; color: #E85A8C; font-weight: 800; }
      .nv-caret { color: #9A8B93; transition: transform 0.15s; flex-shrink: 0; }
      .nv-dropdown--open .nv-caret { transform: rotate(180deg); color: #E85A8C; }

      .nv-dropdown-menu {
        position: absolute;
        top: calc(100% + 4px); right: 0;
        min-width: 180px;
        max-height: 260px;
        overflow-y: auto;
        background: #fff;
        border: 1.5px solid #F0EBED;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        padding: 4px;
        z-index: 10;
      }
      .nv-dropdown-item {
        all: unset;
        box-sizing: border-box;
        display: flex; justify-content: space-between; align-items: center;
        width: 100%;
        padding: 8px 12px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 13px;
        color: #2D1F26;
        font-family: var(--font-base) !important;
      }
      .nv-dropdown-item:hover { background: #FDFAFB; }
      .nv-dropdown-item--ativo { background: #FDF3F7; color: #E85A8C; font-weight: 700; }
      .nv-dropdown-count {
        font-size: 11px; color: #9A8B93; font-weight: 700;
        margin-left: 8px;
      }
      .nv-dropdown-item--ativo .nv-dropdown-count { color: #E85A8C; }
      .nv-modal-lista { flex: 1; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
      .nv-modal-item {
        all: unset;
        display: flex; align-items: center; gap: 10px;
        padding: 10px; border-radius: 8px; cursor: pointer;
        transition: background 0.12s;
        font-family: var(--font-base) !important;
      }
      .nv-modal-item:hover { background: #FDFAFB; }
      .nv-modal-item-img {
        width: 52px; height: 52px; border-radius: 8px;
        background: #F5EEF0; display: flex; align-items: center; justify-content: center;
        font-size: 24px; overflow: hidden; flex-shrink: 0;
      }
      .nv-modal-item-img img { width: 100%; height: 100%; object-fit: cover; }
      .nv-modal-item-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #E85A8C, #C33A6E);
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 800; flex-shrink: 0;
      }
      .nv-modal-item-nome {
        flex: 1;
        min-width: 0;
        font-size: 13px; font-weight: 700; color: #2D1F26;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nv-modal-item-sub { font-size: 11.5px; color: #6B5D64; margin-top: 2px; }
      .nv-modal-item-preco { font-size: 13px; font-weight: 800; color: #2D1F26; }
    `}</style>
    </>
  )
}
