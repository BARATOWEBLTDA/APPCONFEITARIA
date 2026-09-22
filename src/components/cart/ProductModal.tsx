import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { Produto } from '@/types/database'
import { formatCurrency } from '@/utils/helpers'
import type { EscolhasV3, EscolhaOpcao, PrecoBreakdownCarrinho } from '@/types/cart'
import { carregarGruposDoBanco, type GrupoOpcoes, type TipoGrupo } from '@/lib/produto-grupos'
import {
  calcularAdicionalOpcao,
  existeConflitoSaborTamanho,
  aplicarRegraConflito,
  REGRA_CONFLITO_DEFAULT,
} from '@/lib/produto-precificacao'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
  corBotao?: string
}

export function ProductModal({ isOpen, onClose, product, corBotao = '#ec4899' }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [observations, setObservations] = useState('')
  const [showObs, setShowObs] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)

  // ═══ V3 — escolhas por tipo de grupo ═══════════════════════════════
  // massa: id única, cobertura: id única, sabor: id única, tamanho: id única
  // recheios: array de ids (múltiplos)
  const [escolhaMassa, setEscolhaMassa] = useState<string | null>(null)
  const [escolhasRecheio, setEscolhasRecheio] = useState<string[]>([])
  const [escolhaCobertura, setEscolhaCobertura] = useState<string | null>(null)
  const [escolhaSabor, setEscolhaSabor] = useState<string | null>(null)
  const [escolhaTamanho, setEscolhaTamanho] = useState<string | null>(null)
  const [showTamanhoDropdown, setShowTamanhoDropdown] = useState(false)

  // ═══ Carrega grupos usando o helper (V3 ou fallback antigo) ═══════
  const grupos = useMemo<GrupoOpcoes[]>(() => {
    if (!product) return []
    return carregarGruposDoBanco(product)
  }, [product])

  const grupoAtivo = (tipo: TipoGrupo): GrupoOpcoes | null => {
    const g = grupos.find(x => x.tipo === tipo)
    return g && g.ativo && g.opcoes.length > 0 ? g : null
  }

  const gMassa = grupoAtivo('massa')
  const gRecheio = grupoAtivo('recheio')
  const gCobertura = grupoAtivo('cobertura')
  const gSabor = grupoAtivo('sabor')
  const gTamanho = grupoAtivo('tamanho')

  // Reset ao abrir/trocar produto
  useEffect(() => {
    if (product) {
      setQuantity(1); setObservations(''); setShowObs(false); setImgIndex(0)
      setEscolhaMassa(null); setEscolhasRecheio([]); setEscolhaCobertura(null)
      setEscolhaSabor(null); setEscolhaTamanho(null)
    }
  }, [product])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !product) return
    const imgs = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []
    if (imgs.length <= 1) return
    const timer = setInterval(() => setImgIndex(i => (i + 1) % imgs.length), 3000)
    return () => clearInterval(timer)
  }, [isOpen, product])

  const isKg = product?.forma_venda === 'kg'
  const step = isKg ? 0.5 : 1
  const minQtd = isKg ? 0.5 : 1
  const inc = () => setQuantity(q => Math.min(q + step, 50))
  const dec = () => setQuantity(q => Math.max(q - step, minQtd))

  // Preço base do produto (com promoção aplicada, se houver)
  const basePrice = product
    ? (product.promocao && product.preco_promocional ? product.preco_promocional : product.preco_normal)
    : 0

  const descPct = product
    ? ((product as any).tipo_promocao === 'percentual' && product.promocao
      ? ((product as any).desconto_percentual || 0) / 100
      : product.promocao && product.preco_promocional && product.preco_normal > 0
        ? 1 - (product.preco_promocional / product.preco_normal)
        : 0)
    : 0

  // ═══ Helpers de opção ═════════════════════════════════════════════
  const acharOpcao = (g: GrupoOpcoes | null, id: string | null): any => {
    if (!g || !id) return null
    return g.opcoes.find((o: any) => o.id === id) || null
  }

  const opMassa = acharOpcao(gMassa, escolhaMassa)
  const opCobertura = acharOpcao(gCobertura, escolhaCobertura)
  const opSabor = acharOpcao(gSabor, escolhaSabor)
  const opTamanho = acharOpcao(gTamanho, escolhaTamanho)
  const opsRecheios = escolhasRecheio.map(id => acharOpcao(gRecheio, id)).filter(Boolean)

  // ═══ Cálculo do preço em tempo real ═══════════════════════════════
  const calculo = useMemo<PrecoBreakdownCarrinho>(() => {
    if (!product) {
      return { base: 0, adicionais: 0, subtotal: 0, desconto: 0, final: 0 } as any
    }
    let baseEfetivo = basePrice

    // Se tamanho ativo e escolhido, considera preço/peso do tamanho
    if (opTamanho) {
      const gt = grupos.find(x => x.tipo === 'tamanho') as any
      const modo = gt?.modo_preco_tamanho || 'preco_fixo'
      if (modo === 'preco_fixo' && opTamanho.preco > 0) {
        baseEfetivo = opTamanho.preco
      } else if (modo === 'por_peso' && opTamanho.peso_kg) {
        baseEfetivo = basePrice * opTamanho.peso_kg
      }
    }

    // Se Sabor tem preço próprio: pode ser conflito ou não
    let adicionalSaborForcado = 0
    if (opSabor && gSabor) {
      const gs = grupos.find(x => x.tipo === 'sabor') as any
      const temPrecoProprio = !!gs?.sabor_tem_preco_proprio
      if (temPrecoProprio && opSabor.preco > 0) {
        // Verifica conflito com tamanho
        const conflito = existeConflitoSaborTamanho({
          sabor_ativo: true,
          sabor_tem_preco_proprio: true,
          sabor_tem_opcao_com_preco: true,
          tamanho_ativo: !!gTamanho,
          tamanho_tem_opcao_com_preco: !!gTamanho?.opcoes.some((o: any) => (o.preco || 0) > 0),
        })
        if (conflito && opTamanho) {
          const regra = gs?.regra_conflito_tamanho || REGRA_CONFLITO_DEFAULT
          const resultado = aplicarRegraConflito(regra, opTamanho.preco || 0, opSabor.preco || 0)
          baseEfetivo = resultado.base_efetivo
          adicionalSaborForcado = resultado.adicional_sabor
        } else {
          // Sem conflito — sabor substitui base
          baseEfetivo = opSabor.preco
        }
      }
    }

    // Soma adicionais das opções escolhidas
    let adicionaisTotal = 0
    const ctx = {
      quantidade_pedido: quantity,
      quantidade_base: (product as any).quantidade_base || null,
      forma_venda: product.forma_venda,
      tamanho_escolhido_peso_kg: opTamanho?.peso_kg || null,
    }
    if (opMassa) adicionaisTotal += calcularAdicionalOpcao(opMassa, ctx)
    if (opCobertura) adicionaisTotal += calcularAdicionalOpcao(opCobertura, ctx)
    if (opsRecheios.length > 0) {
      opsRecheios.forEach(r => adicionaisTotal += calcularAdicionalOpcao(r, ctx))
    }
    // Sabor adicional (quando NÃO tem preço próprio) OU adicional do conflito
    if (adicionalSaborForcado > 0) {
      adicionaisTotal += adicionalSaborForcado
    } else if (opSabor) {
      const gs = grupos.find(x => x.tipo === 'sabor') as any
      if (!gs?.sabor_tem_preco_proprio) {
        adicionaisTotal += calcularAdicionalOpcao(opSabor, ctx)
      }
    }

    const subtotal = baseEfetivo + adicionaisTotal
    const desconto = descPct > 0 ? parseFloat((subtotal * descPct).toFixed(2)) : 0
    const final = parseFloat((subtotal - desconto).toFixed(2))

    return {
      preco_base_original: product.preco_normal || 0,
      base_efetivo: parseFloat(baseEfetivo.toFixed(2)),
      adicionais_total: parseFloat(adicionaisTotal.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      desconto,
      final,
    }
  }, [product, grupos, quantity, opMassa, opCobertura, opSabor, opTamanho, opsRecheios.length, basePrice, descPct])

  // ═══ Validação: obrigatórios preenchidos ═══════════════════════════
  const podeAdicionar = useMemo(() => {
    if (gMassa && gMassa.min_selecionavel > 0 && !escolhaMassa) return false
    if (gCobertura && gCobertura.min_selecionavel > 0 && !escolhaCobertura) return false
    if (gSabor && gSabor.min_selecionavel > 0 && !escolhaSabor) return false
    if (gTamanho && gTamanho.min_selecionavel > 0 && !escolhaTamanho) return false
    if (gRecheio && gRecheio.min_selecionavel > 0 && escolhasRecheio.length < gRecheio.min_selecionavel) return false
    return true
  }, [gMassa, gCobertura, gSabor, gTamanho, gRecheio, escolhaMassa, escolhaCobertura, escolhaSabor, escolhaTamanho, escolhasRecheio.length])

  // ═══ Early return DEPOIS de todos os hooks (regra do React) ══════
  if (!isOpen || !product) return null

  const totalDisplay = calculo.final * quantity

  // ═══ Handler pra adicionar no carrinho ═════════════════════════════
  const handleAdd = () => {
    if (!podeAdicionar) return

    const escolhas: EscolhasV3 = {}
    if (opMassa) escolhas.massa = { id: opMassa.id, nome: opMassa.nome, adicional: opMassa.adicional || 0 }
    if (opCobertura) escolhas.cobertura = { id: opCobertura.id, nome: opCobertura.nome, adicional: opCobertura.adicional || 0 }
    if (opsRecheios.length > 0) {
      escolhas.recheios = opsRecheios.map(r => ({ id: r.id, nome: r.nome, adicional: r.adicional || 0 }))
    }
    if (opSabor) {
      const gs = grupos.find(x => x.tipo === 'sabor') as any
      const e: EscolhaOpcao = { id: opSabor.id, nome: opSabor.nome, adicional: opSabor.adicional || 0 }
      if (gs?.sabor_tem_preco_proprio && opSabor.preco) e.preco_proprio = opSabor.preco
      escolhas.sabor = e
    }
    if (opTamanho) {
      const e: EscolhaOpcao = { id: opTamanho.id, nome: opTamanho.nome }
      if (opTamanho.preco) e.preco_fixo = opTamanho.preco
      if (opTamanho.peso_kg) e.peso_kg = opTamanho.peso_kg
      escolhas.tamanho = e
    }

    addItem({
      id: product.id, name: product.nome, description: product.descricao || '',
      price: calculo.final,
      imageUrl: product.imagem_url,
      saleType: product.forma_venda,
      quantity, observations,
      // Legado
      selectedMassa: opMassa?.nome || '',
      selectedRecheio: opsRecheios.length > 0 ? opsRecheios.map(r => r.nome).join(', ') : '',
      selectedCobertura: opCobertura?.nome || '',
      // V3
      escolhas: Object.keys(escolhas).length > 0 ? escolhas : undefined,
      precoBreakdown: calculo,
    })
    onClose()
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const images = product.imagem_url?.split(',').map((s: string) => s.trim()).filter(Boolean) || []

  const FORMA_LABEL: Record<string, string> = {
    unidade: 'unidade', fatia: 'fatia', kg: 'kg', cento: 'cento',
    'tamanho': 'unidade', 'kit-caixa': 'kit', 'kit-festa': 'kit', outros: 'un'
  }

  // ═══ Render de grupo (radio / checkbox) ═══════════════════════════
  const RenderGrupo = ({ g, tipoEscolha, valorAtual, onChange, useDropdown }: {
    g: GrupoOpcoes
    tipoEscolha: 'single' | 'multi'
    valorAtual: string | string[] | null
    onChange: (v: any) => void
    useDropdown?: boolean
  }) => {
    const eh = (id: string) => tipoEscolha === 'multi'
      ? Array.isArray(valorAtual) && valorAtual.includes(id)
      : valorAtual === id

    const gs = grupos.find(x => x.tipo === g.tipo) as any
    const saborTemPrecoProprio = g.tipo === 'sabor' && !!gs?.sabor_tem_preco_proprio

    const toggle = (id: string) => {
      if (tipoEscolha === 'multi') {
        const arr = Array.isArray(valorAtual) ? [...valorAtual] : []
        const idx = arr.indexOf(id)
        if (idx >= 0) {
          arr.splice(idx, 1)
        } else if (arr.length < (g.max_selecionavel || 1)) {
          arr.push(id)
        }
        onChange(arr)
      } else {
        onChange(valorAtual === id ? null : id)
      }
    }

    const hintObrigatoriedade = g.min_selecionavel > 0
      ? (g.min_selecionavel === g.max_selecionavel
          ? `Escolha ${g.min_selecionavel}`
          : `Escolha ${g.min_selecionavel} a ${g.max_selecionavel}`)
      : 'Opcional'

    // ═══ Modo dropdown (usado pra tamanhos com muitas opções) ═══
    if (useDropdown && tipoEscolha === 'single') {
      const idSel = typeof valorAtual === 'string' ? valorAtual : null
      const opSel = g.opcoes.find((o: any) => o.id === idSel)
      let precoLabelSel = ''
      if (opSel) {
        if (g.tipo === 'sabor' && saborTemPrecoProprio && opSel.preco > 0) precoLabelSel = formatCurrency(opSel.preco)
        else if (g.tipo === 'tamanho' && opSel.preco > 0) precoLabelSel = formatCurrency(opSel.preco)
        else if ((opSel.adicional || 0) > 0) precoLabelSel = `+${formatCurrency(opSel.adicional)}`
      }
      return (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>{g.nome_exibicao}</span>
            <span style={{ fontSize: '11px', color: g.min_selecionavel > 0 ? '#831843' : 'var(--text-muted)', background: g.min_selecionavel > 0 ? '#FCE0E9' : 'var(--border)', padding: '2px 8px', borderRadius: '50px', fontWeight: 700 }}>
              {hintObrigatoriedade}
            </span>
          </div>
          {/* Botão principal do dropdown */}
          <button
            onClick={() => setShowTamanhoDropdown(v => !v)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', borderRadius: '10px',
              border: `2px solid ${opSel ? corBotao : 'var(--border)'}`,
              background: opSel ? `${corBotao}12` : 'var(--bg-card)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: opSel ? corBotao : 'var(--text-muted)', textAlign: 'left' }}>
              {opSel ? opSel.nome : 'Selecione uma opção'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {precoLabelSel && (
                <span style={{ fontSize: 13, fontWeight: 700, color: corBotao }}>{precoLabelSel}</span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', transform: showTamanhoDropdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </button>
          {/* Lista expandida em grid */}
          {showTamanhoDropdown && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, padding: 10, background: 'var(--bg-subtle)', borderRadius: 10, maxHeight: 260, overflowY: 'auto' }}>
              {g.opcoes.map((op: any) => {
                const ativo = op.id === idSel
                let precoLabel = ''
                if (g.tipo === 'sabor' && saborTemPrecoProprio && op.preco > 0) precoLabel = formatCurrency(op.preco)
                else if (g.tipo === 'tamanho' && op.preco > 0) precoLabel = formatCurrency(op.preco)
                else if ((op.adicional || 0) > 0) precoLabel = `+${formatCurrency(op.adicional)}`
                return (
                  <button
                    key={op.id}
                    onClick={() => { toggle(op.id); setShowTamanhoDropdown(false) }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      padding: '8px 4px', borderRadius: 8,
                      border: `1.5px solid ${ativo ? corBotao : 'transparent'}`,
                      background: ativo ? `${corBotao}15` : '#fff',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: ativo ? corBotao : 'var(--text-primary)' }}>{op.nome}</span>
                    {precoLabel && <span style={{ fontSize: 11, fontWeight: 600, color: ativo ? corBotao : 'var(--text-muted)' }}>{precoLabel}</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    return (
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>
            {g.nome_exibicao}
          </span>
          <span style={{
            fontSize: '11px', color: g.min_selecionavel > 0 ? '#831843' : 'var(--text-muted)',
            background: g.min_selecionavel > 0 ? '#FCE0E9' : 'var(--border)',
            padding: '2px 8px', borderRadius: '50px', fontWeight: 700,
          }}>
            {hintObrigatoriedade}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {g.opcoes.map((op: any) => {
            const ativo = eh(op.id)
            // Rótulo de preço/adicional na direita
            let precoLabel = ''
            if (g.tipo === 'sabor' && saborTemPrecoProprio && op.preco > 0) {
              precoLabel = formatCurrency(op.preco)
            } else if (g.tipo === 'tamanho' && op.preco > 0) {
              precoLabel = formatCurrency(op.preco)
            } else if ((op.adicional || 0) > 0) {
              precoLabel = `+${formatCurrency(op.adicional)}`
            }
            const pesoLabel = (g.tipo === 'tamanho' && op.peso_kg) ? ` (~${op.peso_kg.toString().replace('.', ',')} kg)` : ''

            return (
              <button
                key={op.id}
                onClick={() => toggle(op.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: '10px',
                  border: `2px solid ${ativo ? corBotao : 'var(--border)'}`,
                  background: ativo ? `${corBotao}15` : 'var(--bg-card)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500, textAlign: 'left' }}>
                  {op.nome}{pesoLabel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {precoLabel && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: ativo ? corBotao : 'var(--text-secondary)' }}>
                      {precoLabel}
                    </span>
                  )}
                  <div style={{
                    width: '18px', height: '18px',
                    borderRadius: tipoEscolha === 'multi' ? '4px' : '50%',
                    border: `2px solid ${ativo ? corBotao : '#d1d5db'}`,
                    background: ativo ? corBotao : 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {ativo && tipoEscolha === 'single' && (
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />
                    )}
                    {ativo && tipoEscolha === 'multi' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
    }}
      onClick={onClose}
    >
      <div style={{
        background: 'var(--bg-card)', width: '100%', maxWidth: '500px',
        maxHeight: '95vh', overflowY: 'auto',
        borderRadius: isDesktop ? '20px' : '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header com foto */}
        <div style={{ position: 'relative', height: '260px', background: '#F5F3EF', overflow: 'hidden' }}>
          {images[imgIndex] ? (
            <img src={images[imgIndex]} alt={product.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B4A9AE' }}>
              Sem foto
            </div>
          )}
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.65)', color: '#fff',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Nome + descrição */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-title)', margin: 0 }}>{product.nome}</h2>
            {product.descricao && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}>
                {product.descricao}
              </p>
            )}
          </div>

          {/* Preço em destaque */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: '#FDF3F7', borderRadius: 10, border: '1px solid #FCE0E9',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6B5D64' }}>Preço unitário</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: corBotao }}>
              {formatCurrency(calculo.final)} <span style={{ fontSize: 12, color: '#6B5D64', fontWeight: 700 }}>/{FORMA_LABEL[product.forma_venda] || 'un'}</span>
            </span>
          </div>

          {/* Grupos V3 (renderiza os ativos) */}
          {gTamanho && (
            <RenderGrupo g={gTamanho} tipoEscolha="single" valorAtual={escolhaTamanho} onChange={setEscolhaTamanho} useDropdown />
          )}
          {gSabor && (
            <RenderGrupo g={gSabor} tipoEscolha="single" valorAtual={escolhaSabor} onChange={setEscolhaSabor} />
          )}
          {gMassa && (
            <RenderGrupo g={gMassa} tipoEscolha="single" valorAtual={escolhaMassa} onChange={setEscolhaMassa} />
          )}
          {gRecheio && (
            <RenderGrupo
              g={gRecheio}
              tipoEscolha={gRecheio.max_selecionavel > 1 ? 'multi' : 'single'}
              valorAtual={gRecheio.max_selecionavel > 1 ? escolhasRecheio : (escolhasRecheio[0] || null)}
              onChange={(v: any) => {
                if (Array.isArray(v)) setEscolhasRecheio(v)
                else setEscolhasRecheio(v ? [v] : [])
              }}
            />
          )}
          {gCobertura && (
            <RenderGrupo g={gCobertura} tipoEscolha="single" valorAtual={escolhaCobertura} onChange={setEscolhaCobertura} />
          )}

          {/* Quantidade */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-title)' }}>Quantidade</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={dec} style={{
                width: 36, height: 36, borderRadius: '50%', border: '1.5px solid #E5D8DE',
                background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Minus size={16} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
                {isKg ? `${quantity.toFixed(1).replace('.', ',')} kg` : quantity}
              </span>
              <button onClick={inc} style={{
                width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${corBotao}`,
                background: corBotao, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Botão adicionar */}
          <button
            onClick={handleAdd}
            disabled={!podeAdicionar}
            style={{
              padding: '14px', borderRadius: 12, border: 'none', cursor: podeAdicionar ? 'pointer' : 'not-allowed',
              background: podeAdicionar ? corBotao : '#E5D8DE', color: '#fff',
              fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              transition: 'all 0.15s',
            }}
          >
            <span>
              {podeAdicionar ? 'Adicionar ao carrinho' : 'Escolha as opções obrigatórias'}
            </span>
            {podeAdicionar && <span>{formatCurrency(totalDisplay)}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
