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
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.overflow = ''
        window.scrollTo(0, scrollY)
      }
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Autoplay removido — cliente controla clicando nas miniaturas

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

    // ═══ Modo lista vertical limpa (Modelo 2 — pra tamanhos) ═══
    if (useDropdown && tipoEscolha === 'single') {
      const idSel = typeof valorAtual === 'string' ? valorAtual : null
      return (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-title)' }}>{g.nome_exibicao}</span>
            <span style={{ fontSize: '11px', color: g.min_selecionavel > 0 ? '#831843' : 'var(--text-muted)', background: g.min_selecionavel > 0 ? '#FCE0E9' : 'var(--border)', padding: '2px 8px', borderRadius: '50px', fontWeight: 700 }}>
              {hintObrigatoriedade}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.opcoes.map((op: any) => {
              const ativo = op.id === idSel
              let precoLabel = ''
              if (g.tipo === 'sabor' && saborTemPrecoProprio && op.preco > 0) precoLabel = formatCurrency(op.preco)
              else if (g.tipo === 'tamanho' && op.preco > 0) precoLabel = formatCurrency(op.preco)
              else if ((op.adicional || 0) > 0) precoLabel = `+${formatCurrency(op.adicional)}`
              const serveTxt = op.serve ? `Serve ${op.serve} ${/^\d+$/.test(String(op.serve).trim()) ? 'pessoas' : ''}`.trim() : ''
              return (
                <button
                  key={op.id}
                  onClick={() => toggle(op.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 14px', borderRadius: 10,
                    border: `1.5px solid ${ativo ? corBotao : '#F0EBED'}`,
                    background: ativo ? `${corBotao}0D` : 'var(--bg-card)',
                    cursor: 'pointer', transition: 'all 0.12s',
                    width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      border: `2px solid ${ativo ? corBotao : '#D1D5DB'}`,
                      background: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {ativo && <span style={{ width: 10, height: 10, borderRadius: '50%', background: corBotao }} />}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: ativo ? corBotao : 'var(--text-primary)' }}>{op.nome}</span>
                      {serveTxt && (
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>{serveTxt}</span>
                      )}
                    </div>
                  </div>
                  {precoLabel && (
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#16a34a', flexShrink: 0, marginLeft: 8 }}>
                      {precoLabel}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
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
      position: 'fixed',
      top: 0, left: 0, right: 0,
      // Mobile: deixa a bottom nav (~52px) visível embaixo. Desktop: cobre tudo.
      bottom: isDesktop ? 0 : 'calc(52px + env(safe-area-inset-bottom, 0px))',
      zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: isDesktop ? 'center' : 'flex-end', justifyContent: 'center',
      touchAction: 'none', // impede scroll do fundo no mobile
      overscrollBehavior: 'contain',
    }}
      onClick={onClose}
    >
      <div style={{
        background: 'var(--bg-card)', width: '100%', maxWidth: '500px',
        maxHeight: '100%',
        height: isDesktop ? 'auto' : '100%',
        borderRadius: isDesktop ? '20px' : '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', // não deixa scroll no wrapper
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header com foto — FIXO no topo */}
        <div style={{ position: 'relative', height: '240px', minHeight: '240px', background: '#F5F3EF', overflow: 'hidden', flexShrink: 0 }}>
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
          {/* Contador discreto quando tem múltiplas fotos */}
          {images.length > 1 && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(0,0,0,0.65)', color: '#fff',
              padding: '4px 10px', borderRadius: 20,
              fontSize: 11, fontWeight: 700,
              backdropFilter: 'blur(8px)',
            }}>
              {imgIndex + 1} / {images.length}
            </div>
          )}
        </div>

        {/* Miniaturas — só aparece se tem mais de 1 foto (PRO) */}
        {images.length > 1 && (
          <div style={{
            display: 'flex', gap: 6, padding: '10px 16px 0',
            overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                style={{
                  width: 56, height: 56, borderRadius: 8,
                  flexShrink: 0, overflow: 'hidden',
                  border: `2px solid ${i === imgIndex ? corBotao : 'transparent'}`,
                  background: '#F5F3EF', padding: 0, cursor: 'pointer',
                  opacity: i === imgIndex ? 1 : 0.65,
                  transition: 'opacity 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { if (i !== imgIndex) e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { if (i !== imgIndex) e.currentTarget.style.opacity = '0.65' }}
              >
                <img
                  src={img}
                  alt={`${product.nome} — foto ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Nome + descrição — corpo scrollável */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#2C1219', margin: 0, textAlign: 'center', lineHeight: 1.15, letterSpacing: '-0.01em' }}>{product.nome}</h2>
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
        </div>{/* fim body scrollável */}

        {/* Footer fixo — Botão adicionar sempre visível */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <button
            onClick={handleAdd}
            disabled={!podeAdicionar}
            style={{
              width: '100%',
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
