import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useIsMobile } from '@/hooks/use-mobile'
import AppPageHeader from '@/components/AppPageHeader'

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
}

interface Produto {
  id: string
  nome: string
  preco_normal: number
  forma_venda?: string
  imagem_url?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────
const formatMoney = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

const parseMoney = (s: string): number => {
  const clean = s.replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

const initialsOf = (name: string) => {
  return name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?'
}

// ── Etapas ────────────────────────────────────────────────────────────────
const ETAPAS_ENCOMENDA = ['Tipo', 'Produtos', 'Cliente', 'Entrega', 'Pagamento', 'Revisar']
const ETAPAS_PRONTA    = ['Tipo', 'Produtos', 'Cliente', 'Pagamento', 'Revisar']

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
  const [dataPrevistaPagamento, setDataPrevistaPagamento] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('PIX')

  const [observacoes, setObservacoes] = useState('')

  // Modal produtos
  const [modalProduto, setModalProduto] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [buscaProduto, setBuscaProduto] = useState('')

  // Modal cliente
  const [modalCliente, setModalCliente] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')

  const [salvando, setSalvando] = useState(false)

  // ── Load inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      setUserId(user.id)
      const [{ data: prds }, { data: cls }] = await Promise.all([
        supabase.from('produtos').select('id,nome,preco_normal,forma_venda,imagem_url').eq('user_id', user.id).order('nome'),
        supabase.from('clientes').select('id,nome,telefone,whatsapp').eq('user_id', user.id).order('nome'),
      ])
      setProdutos(prds || [])
      setClientes(cls || [])
    })
  }, [])

  // ── Cálculos ────────────────────────────────────────────────────────────
  const subtotalProdutos = useMemo(
    () => itens.reduce((acc, i) => acc + i.valor_unitario * i.quantidade, 0),
    [itens]
  )
  const total = useMemo(
    () => Math.max(0, subtotalProdutos + (tipoEntrega === 'entrega' && tipo === 'encomenda' ? taxaEntrega : 0) - desconto + acrescimo),
    [subtotalProdutos, taxaEntrega, desconto, acrescimo, tipoEntrega, tipo]
  )

  // Etapas dinâmicas (pronta entrega pula "Entrega")
  const etapas = tipo === 'pronta_entrega' ? ETAPAS_PRONTA : ETAPAS_ENCOMENDA
  const totalEtapas = etapas.length

  // ── Validação por etapa ────────────────────────────────────────────────
  const podeAvancar = (): boolean => {
    if (etapa === 1) return tipo !== null
    if (etapa === 2) return itens.length > 0
    if (etapa === 3) return semCliente || clienteNome.trim().length > 0
    if (tipo === 'encomenda' && etapa === 4) {
      if (!dataEntrega) return false
      if (tipoEntrega === 'entrega' && !enderecoRua) return false
      return true
    }
    // Pagamento é a penúltima
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
  }
  const removerItem = (idx: number) => setItens(itens.filter((_, i) => i !== idx))
  const atualizarQtd = (idx: number, qtd: number) => {
    if (qtd < 1) return
    setItens(itens.map((it, i) => i === idx ? { ...it, quantidade: qtd } : it))
  }

  // ── Selecionar cliente ─────────────────────────────────────────────────
  const selecionarCliente = (c: Cliente) => {
    setClienteId(c.id)
    setClienteNome(c.nome)
    setClienteTelefone(c.telefone || c.whatsapp || '')
    setSemCliente(false)
    setModalCliente(false)
    setBuscaCliente('')
  }

  // ── Finalizar Venda ────────────────────────────────────────────────────
  const finalizarVenda = async () => {
    if (!userId || salvando) return
    setSalvando(true)

    // Status calculado
    let status = 'agendado'
    let statusPag: string = 'pago'
    let valorRecebido = total

    if (tipo === 'pronta_entrega') {
      status = 'entregue'
    } else if (situacaoPag === 'fiado') {
      statusPag = 'pendente'
      valorRecebido = 0
      status = 'aguardando_pagamento'
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
      taxa_entrega: tipo === 'encomenda' && tipoEntrega === 'entrega' ? taxaEntrega : 0,
      forma_pagamento: formaPagamento,
      tipo_entrega: tipo === 'pronta_entrega' ? 'retirada' : tipoEntrega,
      data_entrega: tipo === 'encomenda' ? dataEntrega : null,
      horario_entrega: tipo === 'encomenda' ? horarioEntrega : null,
      endereco_rua: enderecoRua,
      endereco_numero: enderecoNumero,
      endereco_bairro: enderecoBairro,
      endereco_cidade: enderecoCidade,
      endereco_complemento: enderecoComplemento,
      origem: 'manual',
      observacoes,
      data_prevista_pagamento: situacaoPag === 'fiado' ? dataPrevistaPagamento : null,
    }).select().single()

    if (error || !novoPedido) {
      alert('Erro ao salvar: ' + (error?.message || 'desconhecido'))
      setSalvando(false)
      return
    }

    // Inserir itens
    const itensInsert = itens.map(it => ({
      pedido_id: novoPedido.id,
      produto_id: it.produto_id,
      nome_produto: it.nome_produto,
      quantidade: it.quantidade,
      valor_unitario: it.valor_unitario,
      observacoes: it.observacoes || '',
    }))
    await supabase.from('pedido_itens').insert(itensInsert)

    navigate('/pedidos')
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const etapaLabelAtual = etapas[etapa - 1]
  const isUltima = etapa === totalEtapas

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

        {/* ═══ ETAPA 1: Tipo ═══ */}
        {etapaLabelAtual === 'Tipo' && (
          <>
            <h2 className="nv-titulo">Que tipo de venda é essa?</h2>
            <p className="nv-sub">Isso ajuda a organizar seu fluxo</p>
            <div className="nv-tipos">
              <button
                type="button"
                className={`nv-tipo-card ${tipo === 'encomenda' ? 'nv-tipo-card--ativo' : ''}`}
                onClick={() => setTipo('encomenda')}
              >
                <div className="nv-tipo-emoji">📅</div>
                <div className="nv-tipo-nome">Encomenda</div>
                <div className="nv-tipo-desc">Cliente vai buscar/receber em outra data</div>
              </button>
              <button
                type="button"
                className={`nv-tipo-card ${tipo === 'pronta_entrega' ? 'nv-tipo-card--ativo' : ''}`}
                onClick={() => setTipo('pronta_entrega')}
              >
                <div className="nv-tipo-emoji">⚡</div>
                <div className="nv-tipo-nome">Pronta Entrega</div>
                <div className="nv-tipo-desc">Levou agora (venda avulsa)</div>
              </button>
            </div>
          </>
        )}

        {/* ═══ ETAPA 2: Produtos ═══ */}
        {etapaLabelAtual === 'Produtos' && (
          <>
            <h2 className="nv-titulo">O que o cliente pediu?</h2>
            <p className="nv-sub">Adicione os produtos e quantidades</p>

            {itens.length === 0 ? (
              <div className="nv-empty">
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎂</div>
                <p>Nenhum produto adicionado ainda</p>
              </div>
            ) : (
              <div className="nv-itens">
                {itens.map((it, idx) => (
                  <div key={idx} className="nv-item">
                    <div className="nv-item-img">
                      {it.imagem_url ? <img src={it.imagem_url} alt={it.nome_produto} /> : <span>🎂</span>}
                    </div>
                    <div className="nv-item-info">
                      <div className="nv-item-nome">{it.nome_produto}</div>
                      <div className="nv-item-qtd-row">
                        <button className="nv-qtd-btn" onClick={() => atualizarQtd(idx, it.quantidade - 1)} type="button">−</button>
                        <span className="nv-qtd-num">{it.quantidade}</span>
                        <button className="nv-qtd-btn" onClick={() => atualizarQtd(idx, it.quantidade + 1)} type="button">+</button>
                        <span className="nv-item-unit">× {formatMoney(it.valor_unitario)}</span>
                      </div>
                    </div>
                    <div className="nv-item-preco">{formatMoney(it.valor_unitario * it.quantidade)}</div>
                    <button className="nv-item-lixo" onClick={() => removerItem(idx)} type="button" aria-label="Remover">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button className="nv-add-btn" onClick={() => setModalProduto(true)} type="button">
              + Adicionar produto
            </button>
          </>
        )}

        {/* ═══ ETAPA 3: Cliente ═══ */}
        {etapaLabelAtual === 'Cliente' && (
          <>
            <h2 className="nv-titulo">Quem é o cliente?</h2>
            <p className="nv-sub">Selecione, cadastre ou registre sem cliente</p>

            <div className="nv-cli-opts">
              <button className={`nv-cli-btn ${!semCliente && clienteId ? 'nv-cli-btn--ativo' : ''}`} onClick={() => setModalCliente(true)} type="button">
                🔍 Buscar existente
              </button>
              <button className={`nv-cli-btn ${!semCliente && !clienteId && clienteNome ? 'nv-cli-btn--ativo' : ''}`} onClick={() => { setClienteId(null); setSemCliente(false); setClienteNome(''); setClienteTelefone(''); }} type="button">
                + Novo cliente
              </button>
              {tipo === 'pronta_entrega' && (
                <button className={`nv-cli-btn ${semCliente ? 'nv-cli-btn--ativo' : ''}`} onClick={() => { setSemCliente(true); setClienteId(null); setClienteNome(''); setClienteTelefone(''); }} type="button">
                  Sem cliente
                </button>
              )}
            </div>

            {!semCliente && (
              <div className="nv-cli-form">
                <label className="nv-label">Nome</label>
                <input className="nv-input" placeholder="Nome completo" value={clienteNome} onChange={e => { setClienteNome(e.target.value); if (clienteId) setClienteId(null); }} />
                <label className="nv-label" style={{ marginTop: 12 }}>Telefone / WhatsApp</label>
                <input className="nv-input" placeholder="(41) 99999-0000" value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} />
                {!clienteId && clienteNome && (
                  <p className="nv-hint">💡 Este cliente será cadastrado automaticamente ao finalizar</p>
                )}
              </div>
            )}

            {semCliente && (
              <div className="nv-empty" style={{ marginTop: 16 }}>
                <p>Venda avulsa — sem cliente cadastrado</p>
              </div>
            )}
          </>
        )}

        {/* ═══ ETAPA 4: Entrega (só encomenda) ═══ */}
        {etapaLabelAtual === 'Entrega' && (
          <>
            <h2 className="nv-titulo">Como será a entrega?</h2>
            <p className="nv-sub">Retirada no local ou delivery até o cliente</p>

            <div className="nv-radio-row">
              <label className={`nv-radio ${tipoEntrega === 'retirada' ? 'nv-radio--ativo' : ''}`}>
                <input type="radio" checked={tipoEntrega === 'retirada'} onChange={() => setTipoEntrega('retirada')} />
                <span className="nv-radio-dot" />
                <span>🛍 Retirada</span>
              </label>
              <label className={`nv-radio ${tipoEntrega === 'entrega' ? 'nv-radio--ativo' : ''}`}>
                <input type="radio" checked={tipoEntrega === 'entrega'} onChange={() => setTipoEntrega('entrega')} />
                <span className="nv-radio-dot" />
                <span>🛵 Delivery</span>
              </label>
            </div>

            <div className="nv-grid-2">
              <div>
                <label className="nv-label">Data</label>
                <input className="nv-input" type="date" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} />
              </div>
              <div>
                <label className="nv-label">Horário</label>
                <input className="nv-input" type="time" value={horarioEntrega} onChange={e => setHorarioEntrega(e.target.value)} />
              </div>
            </div>

            {tipoEntrega === 'entrega' && (
              <>
                <div className="nv-grid-2" style={{ marginTop: 12 }}>
                  <div>
                    <label className="nv-label">Rua</label>
                    <input className="nv-input" value={enderecoRua} onChange={e => setEnderecoRua(e.target.value)} placeholder="Rua Brigadeiro Franco" />
                  </div>
                  <div>
                    <label className="nv-label">Número</label>
                    <input className="nv-input" value={enderecoNumero} onChange={e => setEnderecoNumero(e.target.value)} placeholder="1234" />
                  </div>
                </div>
                <div className="nv-grid-2" style={{ marginTop: 12 }}>
                  <div>
                    <label className="nv-label">Bairro</label>
                    <input className="nv-input" value={enderecoBairro} onChange={e => setEnderecoBairro(e.target.value)} placeholder="Batel" />
                  </div>
                  <div>
                    <label className="nv-label">Cidade</label>
                    <input className="nv-input" value={enderecoCidade} onChange={e => setEnderecoCidade(e.target.value)} />
                  </div>
                </div>
                <label className="nv-label" style={{ marginTop: 12 }}>Complemento / Referência</label>
                <input className="nv-input" value={enderecoComplemento} onChange={e => setEnderecoComplemento(e.target.value)} placeholder="Apto 302, portão azul, etc" />
                <label className="nv-label" style={{ marginTop: 12 }}>Valor do frete</label>
                <input className="nv-input" inputMode="decimal" placeholder="R$ 0,00" value={taxaEntrega === 0 ? '' : taxaEntrega.toString().replace('.', ',')} onChange={e => setTaxaEntrega(parseMoney(e.target.value))} />
              </>
            )}
          </>
        )}

        {/* ═══ ETAPA 5: Pagamento ═══ */}
        {etapaLabelAtual === 'Pagamento' && (
          <>
            <h2 className="nv-titulo">Como o cliente pagou?</h2>
            <p className="nv-sub">Descontos, acréscimos e situação do pagamento</p>

            <div className="nv-grid-2">
              <div>
                <label className="nv-label">Desconto</label>
                <input className="nv-input" inputMode="decimal" placeholder="R$ 0,00" value={desconto === 0 ? '' : desconto.toString().replace('.', ',')} onChange={e => setDesconto(parseMoney(e.target.value))} />
              </div>
              <div>
                <label className="nv-label">Acréscimo</label>
                <input className="nv-input" inputMode="decimal" placeholder="R$ 0,00" value={acrescimo === 0 ? '' : acrescimo.toString().replace('.', ',')} onChange={e => setAcrescimo(parseMoney(e.target.value))} />
              </div>
            </div>

            <label className="nv-label" style={{ marginTop: 16 }}>Forma de pagamento</label>
            <div className="nv-formas">
              {['PIX', 'Dinheiro', 'Cartão', 'Boleto'].map(f => (
                <button key={f} type="button" className={`nv-forma ${formaPagamento === f ? 'nv-forma--ativo' : ''}`} onClick={() => setFormaPagamento(f)}>
                  {f}
                </button>
              ))}
            </div>

            <label className="nv-label" style={{ marginTop: 20 }}>Situação</label>
            <div className="nv-pag-opcoes">
              <label className={`nv-pag-opcao ${situacaoPag === 'total' ? 'nv-pag-opcao--ativo' : ''}`}>
                <input type="radio" checked={situacaoPag === 'total'} onChange={() => setSituacaoPag('total')} />
                <span className="nv-radio-dot" />
                <span>✅ Recebi total ({formatMoney(total)})</span>
              </label>
              <label className={`nv-pag-opcao ${situacaoPag === 'parcial' ? 'nv-pag-opcao--ativo' : ''}`}>
                <input type="radio" checked={situacaoPag === 'parcial'} onChange={() => setSituacaoPag('parcial')} />
                <span className="nv-radio-dot" />
                <span>💵 Recebi só parte</span>
              </label>
              {situacaoPag === 'parcial' && (
                <input
                  className="nv-input"
                  style={{ marginLeft: 28 }}
                  inputMode="decimal"
                  placeholder="Valor recebido"
                  value={valorParcial === 0 ? '' : valorParcial.toString().replace('.', ',')}
                  onChange={e => setValorParcial(parseMoney(e.target.value))}
                />
              )}
              <label className={`nv-pag-opcao ${situacaoPag === 'fiado' ? 'nv-pag-opcao--ativo' : ''}`}>
                <input type="radio" checked={situacaoPag === 'fiado'} onChange={() => setSituacaoPag('fiado')} />
                <span className="nv-radio-dot" />
                <span>📝 Fiado (cliente vai pagar depois)</span>
              </label>
              {situacaoPag === 'fiado' && (
                <div style={{ marginLeft: 28 }}>
                  <label className="nv-label" style={{ marginTop: 4 }}>Data prevista pagamento</label>
                  <input className="nv-input" type="date" value={dataPrevistaPagamento} onChange={e => setDataPrevistaPagamento(e.target.value)} />
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ ETAPA 6: Revisar ═══ */}
        {etapaLabelAtual === 'Revisar' && (
          <>
            <h2 className="nv-titulo">Revisar antes de finalizar</h2>
            <p className="nv-sub">Confira tudo — pode editar no menu do pedido depois</p>

            <div className="nv-resumo">
              <div className="nv-r-linha"><span>📦 Tipo</span><b>{tipo === 'encomenda' ? 'Encomenda' : 'Pronta Entrega'}</b></div>
              <div className="nv-r-linha"><span>🎂 Produtos</span><b>{itens.length} {itens.length === 1 ? 'item' : 'itens'} · {formatMoney(subtotalProdutos)}</b></div>
              <div className="nv-r-linha"><span>👤 Cliente</span><b>{semCliente ? 'Sem cliente' : (clienteNome || 'Não informado')}</b></div>
              {tipo === 'encomenda' && (
                <div className="nv-r-linha">
                  <span>{tipoEntrega === 'entrega' ? '🛵 Delivery' : '🛍 Retirada'}</span>
                  <b>{dataEntrega ? new Date(dataEntrega + 'T00:00').toLocaleDateString('pt-BR') : '—'}{horarioEntrega && ` · ${horarioEntrega}`}{tipoEntrega === 'entrega' && taxaEntrega > 0 && ` · ${formatMoney(taxaEntrega)}`}</b>
                </div>
              )}
              {(desconto > 0 || acrescimo > 0) && (
                <div className="nv-r-linha">
                  <span>🎫 Ajustes</span>
                  <b>{desconto > 0 && `−${formatMoney(desconto)}`}{acrescimo > 0 && ` +${formatMoney(acrescimo)}`}</b>
                </div>
              )}
              <div className="nv-r-linha">
                <span>💰 Pagamento</span>
                <b style={{ color: situacaoPag === 'total' ? '#14532D' : situacaoPag === 'parcial' ? '#92400E' : '#991B1B' }}>
                  {situacaoPag === 'total' ? `✓ Pago ${formatMoney(total)}` : situacaoPag === 'parcial' ? `Parcial ${formatMoney(valorParcial)} / ${formatMoney(total)}` : `Fiado ${formatMoney(total)}`}
                  {' · '}{formaPagamento}
                </b>
              </div>
            </div>

            <label className="nv-label" style={{ marginTop: 20 }}>Observações (opcional)</label>
            <textarea className="nv-input" style={{ minHeight: 70 }} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Cuidados especiais, alergias, decoração..." />
          </>
        )}

      </div>

      {/* Rodapé com total + botões */}
      <div className="nv-footer">
        {etapa > 1 ? (
          <div className="nv-footer-total">
            <span className="nv-footer-lbl">Total</span>
            <span className="nv-footer-val">{formatMoney(total)}</span>
          </div>
        ) : (
          <div />
        )}
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
              Avançar →
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ═══ MODAL: escolher produto ═══ */}
    {modalProduto && (
      <div className="nv-modal-overlay" onClick={() => setModalProduto(false)}>
        <div className="nv-modal" onClick={e => e.stopPropagation()}>
          <h3 className="nv-modal-title">Escolher produto</h3>
          <input className="nv-input" placeholder="Buscar produto..." value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} autoFocus />
          <div className="nv-modal-lista">
            {produtos.filter(p => p.nome.toLowerCase().includes(buscaProduto.toLowerCase())).map(p => (
              <button key={p.id} type="button" className="nv-modal-item" onClick={() => addProduto(p)}>
                <div className="nv-modal-item-img">{p.imagem_url ? <img src={p.imagem_url} alt={p.nome} /> : '🎂'}</div>
                <div className="nv-modal-item-nome">{p.nome}</div>
                <div className="nv-modal-item-preco">{formatMoney(p.preco_normal)}</div>
              </button>
            ))}
            {produtos.length === 0 && <p className="nv-empty">Nenhum produto cadastrado. <a href="/produtos">Cadastre um produto</a></p>}
          </div>
          <button className="nv-btn nv-btn-voltar" style={{ marginTop: 12, width: '100%' }} onClick={() => setModalProduto(false)}>Fechar</button>
        </div>
      </div>
    )}

    {/* ═══ MODAL: buscar cliente ═══ */}
    {modalCliente && (
      <div className="nv-modal-overlay" onClick={() => setModalCliente(false)}>
        <div className="nv-modal" onClick={e => e.stopPropagation()}>
          <h3 className="nv-modal-title">Buscar cliente</h3>
          <input className="nv-input" placeholder="Nome ou telefone..." value={buscaCliente} onChange={e => setBuscaCliente(e.target.value)} autoFocus />
          <div className="nv-modal-lista">
            {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) || (c.telefone || '').includes(buscaCliente)).map(c => (
              <button key={c.id} type="button" className="nv-modal-item" onClick={() => selecionarCliente(c)}>
                <div className="nv-modal-item-avatar">{initialsOf(c.nome)}</div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div className="nv-modal-item-nome">{c.nome}</div>
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
        min-height: calc(100vh - 240px);
      }
      @media (max-width: 767px) {
        .nv-root { margin: 0; border-radius: 0; min-height: calc(100vh - 180px); box-shadow: none; }
      }

      /* Barra de progresso */
      .nv-progress {
        display: flex;
        justify-content: center;
        padding: 18px 20px 14px;
        border-bottom: 1px solid #F0EBED;
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
        .nv-progress { padding: 14px 16px 12px; border-radius: 10px 10px 0 0; }
      }

      /* Corpo */
      .nv-corpo { padding: 24px 28px; flex: 1; }
      @media (max-width: 767px) { .nv-corpo { padding: 20px; } }
      .nv-titulo { font-size: 18px; font-weight: 900; letter-spacing: -0.01em; color: #2D1F26; margin: 0 0 4px; font-family: var(--font-base) !important; }
      .nv-sub { font-size: 13px; color: #6B5D64; margin: 0 0 18px; font-family: var(--font-base) !important; }

      /* Tipos venda */
      .nv-tipos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 500px) { .nv-tipos { grid-template-columns: 1fr; } }
      .nv-tipo-card {
        all: unset;
        padding: 24px 20px; border-radius: 12px;
        border: 2px solid #F0EBED; cursor: pointer;
        text-align: center; box-sizing: border-box;
        transition: all 0.15s; font-family: var(--font-base) !important;
      }
      .nv-tipo-card:hover { border-color: #E85A8C; transform: translateY(-2px); }
      .nv-tipo-card--ativo { border-color: #E85A8C; background: #FDF3F7; }
      .nv-tipo-emoji { font-size: 36px; margin-bottom: 8px; }
      .nv-tipo-nome { font-size: 15px; font-weight: 800; color: #2D1F26; }
      .nv-tipo-desc { font-size: 12px; color: #6B5D64; margin-top: 4px; line-height: 1.4; }

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

      /* Cliente */
      .nv-cli-opts { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
      .nv-cli-btn {
        all: unset;
        flex: 1; padding: 10px; border-radius: 8px;
        border: 1.5px solid #F0EBED; background: #fff;
        font-size: 12.5px; font-weight: 700; cursor: pointer;
        color: #4A3540; text-align: center;
        min-width: 120px; box-sizing: border-box;
        font-family: var(--font-base) !important;
      }
      .nv-cli-btn:hover { border-color: #E85A8C; }
      .nv-cli-btn--ativo { border-color: #E85A8C; background: #FDF3F7; color: #E85A8C; }
      .nv-cli-form { display: flex; flex-direction: column; }
      .nv-hint { font-size: 11.5px; color: #6B5D64; margin-top: 6px; font-family: var(--font-base) !important; }

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
        background: #FAFAFA;
        border-top: 1px solid #F0EBED;
        padding: 14px 20px;
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; border-radius: 0 0 12px 12px;
        position: sticky; bottom: 0;
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
        max-height: 80vh; display: flex; flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.35);
        font-family: var(--font-base) !important;
      }
      .nv-modal-title { font-size: 16px; font-weight: 900; color: #2D1F26; margin: 0 0 12px; font-family: var(--font-base) !important; }
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
        width: 36px; height: 36px; border-radius: 7px;
        background: #F5EEF0; display: flex; align-items: center; justify-content: center;
        font-size: 18px; overflow: hidden; flex-shrink: 0;
      }
      .nv-modal-item-img img { width: 100%; height: 100%; object-fit: cover; }
      .nv-modal-item-avatar {
        width: 36px; height: 36px; border-radius: 50%;
        background: linear-gradient(135deg, #E85A8C, #C33A6E);
        color: #fff; display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-weight: 800; flex-shrink: 0;
      }
      .nv-modal-item-nome { flex: 1; font-size: 13px; font-weight: 700; color: #2D1F26; }
      .nv-modal-item-sub { font-size: 11.5px; color: #6B5D64; margin-top: 2px; }
      .nv-modal-item-preco { font-size: 13px; font-weight: 800; color: #2D1F26; }
    `}</style>
    </>
  )
}
