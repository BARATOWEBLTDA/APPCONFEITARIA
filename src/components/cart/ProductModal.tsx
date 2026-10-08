import { seloEntrega } from "@/lib/entregaProduto";
import { unidadeCliente } from '@/lib/formaVenda'
import KitPicker from '@/components/cardapio/KitPicker'
import { precoCardapio } from '@/lib/precoCardapio'
import { kitAtivo, calcularKit, selecaoInicial, type KitSelecao } from '@/lib/kitQuantidade'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarBlank, Camera, Check, Minus, Plus, X } from '@phosphor-icons/react'
import { useSobreposicao } from '@/components/base/useSobreposicao'
import './productModal.css'
import { useCart } from '@/hooks/useCart'
import { supabase } from '@/lib/supabase'
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

// Personalização da biblioteca (tabela biblioteca_extras).
// Cadastradas pelo dono do cardápio na aba "Personalização".
interface ExtraBiblioteca {
  id: string
  nome: string
  valor: number
  categorias: string[] // IDs dos produtos vinculados (vazio = todos)
}

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Produto | null
  corBotao?: string
  /** Editar pedido (03/10): recebe o item escolhido em vez de colocar no carrinho */
  onAdicionar?: (item: any) => void
  rotuloAdicionar?: string
}

export function ProductModal({ isOpen, onClose, product, corBotao = '#ec4899', onAdicionar, rotuloAdicionar }: Props) {
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  // Kit por quantidade (docinhos/salgados): quantos de cada sabor
  const [kitSel, setKitSel] = useState<KitSelecao>({ kitId: '', qtdLivre: 0, qtds: {} })
  const kitCfg = kitAtivo((product as any)?.kit_qtd) ? (product as any).kit_qtd : null
  const kitInfo = kitCfg ? calcularKit(kitCfg, kitSel) : null
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

  // ═══ Personalizações da biblioteca (aba /complementos) ══════════════
  // Buscamos direto no banco quando o modal abre. Se o dono cadastrou
  // extras marcados pra esse produto (ou pra todos), aparecem aqui.
  const [extrasBiblioteca, setExtrasBiblioteca] = useState<ExtraBiblioteca[]>([])
  const [extrasMarcados, setExtrasMarcados] = useState<Set<string>>(new Set())
  const [rolagem, setRolagem] = useState(0)
  const [fotoRef, setFotoRef] = useState<string | null>(null)
  const [fotoRefUploading, setFotoRefUploading] = useState(false)

  useEffect(() => {
    if (!isOpen || !product) {
      setExtrasMarcados(new Set())
      setFotoRef(null)
      setRolagem(0)
      return
    }
    const uid = (product as any).user_id
    if (!uid) return
    // 02/10: pelo cardápio (cliente sem login) a tabela não pode ser lida direto — usa a função segura.
    // Se a função ainda não existir no banco (SQL não rodado), tenta a leitura direta.
    ;(async () => {
      let data: any[] | null = null
      const r = await supabase.rpc('cardapio_extras', { p_loja: uid })
      if (!r.error && Array.isArray(r.data)) data = r.data
      else {
        const d = await supabase.from('biblioteca_extras').select('id, nome, valor, categorias').eq('user_id', uid)
        data = (d.data as any[]) || null
      }
      return { data }
    })().then(({ data }) => {
        if (!data) { setExtrasBiblioteca([]); return }
        // Filtra: sem categorias (aparece em todos) ou vinculado a esse produto
        const filtrados = (data as ExtraBiblioteca[]).filter(e => {
          const cats: string[] = Array.isArray(e.categorias) ? e.categorias : []
          return cats.length === 0 || cats.includes(product.id)
        })
        setExtrasBiblioteca(filtrados)
      })
  }, [isOpen, product?.id])

  const toggleExtra = (id: string) => {
    setExtrasMarcados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Upload da foto de referência (opcional). Cliente escolhe uma imagem
  // pra ilustrar o que quer (ex: "queria um bolo assim").
  const handleFotoRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !product) return
    setFotoRefUploading(true)
    try {
      // Salvar como base64 no state — só é enviado junto do pedido.
      // Pra armazenar no storage precisaria de auth do cliente; base64 é mais simples.
      const reader = new FileReader()
      reader.onload = () => {
        setFotoRef(reader.result as string)
        setFotoRefUploading(false)
      }
      reader.onerror = () => setFotoRefUploading(false)
      reader.readAsDataURL(file)
    } catch {
      setFotoRefUploading(false)
    }
  }

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

  // Reset ao abrir/trocar produto (inclusive reabrindo o MESMO produto)
  useEffect(() => {
    if (product && isOpen) {
      setQuantity(1); setObservations(''); setShowObs(false); setImgIndex(0)
      setEscolhaMassa(null); setEscolhasRecheio([]); setEscolhaCobertura(null)
      setEscolhaSabor(null); setEscolhaTamanho(null)
      if (kitAtivo((product as any).kit_qtd)) setKitSel(selecaoInicial((product as any).kit_qtd))
    }
  }, [product, isOpen])

  // (02/10) Aqui havia uma SEGUNDA trava de rolagem igual à de cima. Ela rodava com a página já
  // congelada (posição 0) e jogava o cardápio pro topo ao abrir e ao fechar o produto. Removida.

  // Autoplay removido — cliente controla clicando nas miniaturas

  const isKg = product?.forma_venda === 'kg'
  const step = isKg ? 0.5 : 1
  const minQtd = isKg ? 0.5 : 1
  const inc = () => setQuantity(q => Math.min(q + step, 50))
  const dec = () => setQuantity(q => Math.max(q - step, minQtd))

  // Preço base = preço CHEIO. A promoção entra uma vez só, pelo descPct lá embaixo
  // (antes usava o preço promocional E aplicava o desconto de novo: 52,90 → 47,61 → 42,85)
  const basePrice = product ? (product.preco_normal || 0) : 0

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

    // Kit por quantidade: o preço vem do kit escolhido
    if (kitInfo) baseEfetivo = kitInfo.preco

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

    // Extras da biblioteca de personalização — soma valor dos marcados
    let extrasBibliotecaTotal = 0
    extrasMarcados.forEach(id => {
      const e = extrasBiblioteca.find(x => x.id === id)
      if (e) extrasBibliotecaTotal += Number(e.valor) || 0
    })
    adicionaisTotal += extrasBibliotecaTotal

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
  }, [product, grupos, quantity, opMassa, opCobertura, opSabor, opTamanho, opsRecheios.length, basePrice, descPct, extrasMarcados, extrasBiblioteca, kitInfo?.preco])

  // ═══ Validação: obrigatórios preenchidos ═══════════════════════════
  const podeAdicionar = useMemo(() => {
    if (gMassa && gMassa.min_selecionavel > 0 && !escolhaMassa) return false
    if (gCobertura && gCobertura.min_selecionavel > 0 && !escolhaCobertura) return false
    if (gSabor && gSabor.min_selecionavel > 0 && !escolhaSabor) return false
    if (gTamanho && gTamanho.min_selecionavel > 0 && !escolhaTamanho) return false
    if (gRecheio && gRecheio.min_selecionavel > 0 && escolhasRecheio.length < gRecheio.min_selecionavel) return false
    if (kitInfo && !kitInfo.completo) return false
    return true
  }, [gMassa, gCobertura, gSabor, gTamanho, gRecheio, escolhaMassa, escolhaCobertura, escolhaSabor, escolhaTamanho, escolhasRecheio.length, kitInfo?.completo])

  // ═══ 08/10 · 3.29 — tela no estilo iFood ═══════════════════════════
  const caixaRef = useRef<HTMLDivElement>(null)
  const roloRef = useRef<HTMLDivElement>(null)
  const trilhoRef = useRef<HTMLDivElement>(null)
  const secoes = useRef<Record<string, HTMLElement | null>>({})
  const [faltou, setFaltou] = useState<string | null>(null)
  const [barra, setBarra] = useState(false)
  const pausaAte = useRef(0)
  useSobreposicao(isOpen && !!product, onClose, caixaRef)
  useEffect(() => { if (isOpen) { setFaltou(null); setBarra(false) } }, [isOpen, product?.id])
  // O que falta escolher (na ordem da tela)
  const pendente = useMemo(() => {
    if (kitInfo && !kitInfo.completo) return 'kit'
    if (gTamanho && gTamanho.min_selecionavel > 0 && !escolhaTamanho) return 'tamanho'
    if (gSabor && gSabor.min_selecionavel > 0 && !escolhaSabor) return 'sabor'
    if (gMassa && gMassa.min_selecionavel > 0 && !escolhaMassa) return 'massa'
    if (gRecheio && gRecheio.min_selecionavel > 0 && escolhasRecheio.length < gRecheio.min_selecionavel) return 'recheio'
    if (gCobertura && gCobertura.min_selecionavel > 0 && !escolhaCobertura) return 'cobertura'
    return null
  }, [kitInfo?.completo, gTamanho, gSabor, gMassa, gRecheio, gCobertura, escolhaTamanho, escolhaSabor, escolhaMassa, escolhasRecheio.length, escolhaCobertura])
  useEffect(() => { if (faltou && faltou !== pendente) setFaltou(null) }, [pendente, faltou])

  // Fotos: trocam sozinhas a cada 4 s, bem suave (para quando a cliente mexe; não roda com "reduzir movimento")
  const imagensMemo = useMemo(() => product?.imagem_url?.split(',').map((x: string) => x.trim()).filter(Boolean) || [], [product?.imagem_url])
  useEffect(() => {
    if (!isOpen || imagensMemo.length < 2) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => {
      if (Date.now() < pausaAte.current) return
      setImgIndex(i => {
        const prox = (i + 1) % imagensMemo.length
        const tr = trilhoRef.current
        if (tr && tr.offsetParent !== null) tr.scrollTo({ left: prox * tr.clientWidth, behavior: 'smooth' })
        return prox
      })
    }, 4000)
    return () => window.clearInterval(t)
  }, [isOpen, imagensMemo.length])

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
    if (kitInfo) escolhas.kit = kitInfo.escolha

    // Extras da biblioteca (aba /complementos) — nome + valor de cada marcado
    const extrasEscolhidos = extrasBiblioteca
      .filter(e => extrasMarcados.has(e.id))
      .map(e => ({ id: e.id, nome: e.nome, valor: Number(e.valor) || 0 }))

    ;(onAdicionar || addItem)({
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
      // Personalização (biblioteca de extras)
      extrasBiblioteca: extrasEscolhidos.length > 0 ? extrasEscolhidos : undefined,
      fotoReferencia: fotoRef || undefined,
    } as any)
    onClose()
  }

  // Tocou em "Adicionar" faltando escolha: rola até o grupo e marca em vermelho
  const tentarAdicionar = () => {
    if (pendente) {
      setFaltou(pendente)
      const el = secoes.current[pendente]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    handleAdd()
  }

  // Quantidade: produto por kg (sem tamanho) anda de 0,5 kg; o resto, de 1 em 1.
  // Por kg COM tamanho a quantidade fica 1 (o tamanho já define o peso).
  const kgLivre = isKg && !gTamanho && !kitCfg
  const semQuantidade = isKg && !kgLivre
  const passo = kgLivre ? 0.5 : 1
  const minimo = kgLivre ? 0.5 : 1
  const qtdTexto = kgLivre ? `${String(quantity).replace('.', ',')} kg` : String(quantity)

  const images = imagensMemo
  const nome = product.nome
  const selo = seloEntrega(product)

  // Preço do topo: com tamanhos e nada escolhido, a faixa de preços; senão o preço calculado
  const semTamanho = !!gTamanho && !opTamanho && !kitInfo
  const precosTam = semTamanho ? (gTamanho!.opcoes || []).map((o: any) => {
    const modo = (gTamanho as any)?.modo_preco_tamanho || 'preco_fixo'
    const v = modo === 'por_peso' ? basePrice * (Number(o.peso_kg) || 0) : (Number(o.preco) || 0)
    return Math.round(v * (1 - descPct) * 100) / 100
  }).filter((v: number) => v > 0) : []
  const valorTopo = semTamanho ? Math.round(precoCardapio(product).valor * (1 - descPct) * 100) / 100 : calculo.final
  const pMin = precosTam.length ? Math.min(...precosTam) : valorTopo
  const pMax = precosTam.length ? Math.max(...precosTam) : valorTopo

  // ═══ Um grupo de opções (faixa cinza + lista) ═════════════════════
  const Grupo = ({ chave, g, multi, valor, aoMudar }: { chave: string; g: GrupoOpcoes; multi: boolean; valor: string | string[] | null; aoMudar: (v: any) => void }) => {
    const marcado = (id: string) => multi ? Array.isArray(valor) && valor.includes(id) : valor === id
    const qtdMarcada = multi ? (Array.isArray(valor) ? valor.length : 0) : (valor ? 1 : 0)
    const max = multi ? (g.max_selecionavel || 1) : 1
    const obrig = g.min_selecionavel > 0
    const ok = obrig && qtdMarcada >= g.min_selecionavel
    const gs = grupos.find(x => x.tipo === g.tipo) as any
    const saborTemPrecoProprio = g.tipo === 'sabor' && !!gs?.sabor_tem_preco_proprio
    const titulo = g.tipo === 'tamanho' ? 'Escolha o tamanho' : g.nome_exibicao
    const regra = !multi
      ? (obrig ? 'Escolha 1 opção' : 'Escolha até 1 opção')
      : g.min_selecionavel > 0 && g.min_selecionavel === max ? `Escolha ${max} ${max === 1 ? 'opção' : 'opções'}`
      : g.min_selecionavel > 0 ? `Escolha de ${g.min_selecionavel} a ${max} opções`
      : `Escolha até ${max} ${max === 1 ? 'opção' : 'opções'}`
    const falta = faltou === chave
    const tocar = (id: string) => {
      if (multi) {
        const arr = Array.isArray(valor) ? [...valor] : []
        const i = arr.indexOf(id)
        if (i >= 0) arr.splice(i, 1)
        else if (arr.length < max) arr.push(id)
        else if (max === 1) { arr.splice(0, 1, id) }
        aoMudar(arr)
      } else {
        aoMudar(valor === id ? (obrig ? id : null) : id)
      }
    }
    const emFatias = (product as any)?.grupo_tamanhos?.rendimento_unidade === 'fatias'
    return (
      <section ref={el => { secoes.current[chave] = el }} className={`pm-g${falta ? ' falta' : ''}`}>
        <header className="pm-g-cab">
          <span><b>{titulo}</b><small>{falta ? `${regra} pra continuar` : regra}</small></span>
          <span className="pm-g-dir">
            {multi && max > 1 && <em>{qtdMarcada}/{max}</em>}
            {obrig && (ok ? <i className="pm-ok" aria-label="Escolhido"><Check size={14} weight="bold" /></i> : <i className="pm-obr">Obrigatório</i>)}
          </span>
        </header>
        <div role={multi ? 'group' : 'radiogroup'} aria-label={titulo}>
          {g.opcoes.map((op: any) => {
            const on = marcado(op.id)
            let preco = ''
            if (g.tipo === 'sabor' && saborTemPrecoProprio && op.preco > 0) preco = formatCurrency(op.preco)
            else if (g.tipo === 'tamanho' && op.preco > 0) preco = formatCurrency(op.preco)
            else if (g.tipo === 'tamanho' && (g as any).modo_preco_tamanho === 'por_peso' && op.peso_kg && basePrice > 0) preco = formatCurrency(Math.round(basePrice * op.peso_kg * 100) / 100)
            else if ((op.adicional || 0) > 0) preco = `+ ${formatCurrency(op.adicional)}`
            const peso = op.peso_kg ? `${String(op.peso_kg).replace('.', ',')} kg` : ''
            const serve = op.serve ? (/^\d+$/.test(String(op.serve).trim()) ? (emFatias ? `${String(op.serve).trim()} fatias` : `Serve ${String(op.serve).trim()} pessoas`) : `Serve ${op.serve}`) : ''
            const bloqueado = multi && !on && max > 1 && qtdMarcada >= max
            return (
              <button key={op.id} type="button" className="pm-op" role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={bloqueado} onClick={() => tocar(op.id)}>
                <span className="pm-op-tx"><b>{peso && g.tipo === 'tamanho' ? `${op.nome} · ${peso}` : op.nome}</b>{serve && <small>{serve}</small>}</span>
                {preco && <span className="pm-op-p">{preco}</span>}
                <span className={`pm-ctl${multi ? ' cx' : ''}`} style={on ? { borderColor: corBotao, background: multi ? corBotao : '#fff' } : undefined} aria-hidden="true">
                  {on && (multi ? <Check size={14} weight="bold" color="#fff" /> : <i style={{ background: corBotao }} />)}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  const corpo = (
    <>
      <div className="pm-info">
        <h2>{nome}</h2>
        {product.descricao && <p>{product.descricao}</p>}
        <div className="pm-preco">
          {!semTamanho && descPct > 0 && calculo.subtotal > valorTopo && <s>{formatCurrency(calculo.subtotal)}</s>}
          <strong>{semTamanho && pMax > pMin ? `${formatCurrency(pMin)} a ${formatCurrency(pMax)}` : formatCurrency(semTamanho ? pMin : valorTopo)}</strong>
          <em>{semTamanho ? 'conforme o tamanho' : kitCfg ? 'o kit' : gTamanho ? '' : unidadeCliente(product.forma_venda)}</em>
        </div>
        {selo?.tipo === 'encomenda' && (
          <div className="pm-aviso"><CalendarBlank size={20} weight="bold" aria-hidden="true" /><span><b>Encomende com {selo.prazo} de antecedência</b><small>Você escolhe o dia ao finalizar o pedido.</small></span></div>
        )}
      </div>

      {kitCfg && (
        <section ref={el => { secoes.current['kit'] = el }} className={`pm-g${faltou === 'kit' ? ' falta' : ''}`}>
          <header className="pm-g-cab"><span><b>Monte o seu kit</b><small>{faltou === 'kit' ? 'Complete o kit pra continuar' : 'Escolha quantos de cada sabor'}</small></span>
            <span className="pm-g-dir">{kitInfo?.completo ? <i className="pm-ok"><Check size={14} weight="bold" /></i> : <i className="pm-obr">Obrigatório</i>}</span></header>
          <div className="pm-kit"><KitPicker kit={kitCfg} sel={kitSel} onChange={setKitSel} desconto={descPct} /></div>
        </section>
      )}
      {gTamanho && <Grupo chave="tamanho" g={gTamanho} multi={false} valor={escolhaTamanho} aoMudar={setEscolhaTamanho} />}
      {gSabor && <Grupo chave="sabor" g={gSabor} multi={false} valor={escolhaSabor} aoMudar={setEscolhaSabor} />}
      {gMassa && <Grupo chave="massa" g={gMassa} multi={false} valor={escolhaMassa} aoMudar={setEscolhaMassa} />}
      {gRecheio && (
        <Grupo chave="recheio" g={gRecheio} multi={gRecheio.max_selecionavel > 1}
          valor={gRecheio.max_selecionavel > 1 ? escolhasRecheio : (escolhasRecheio[0] || null)}
          aoMudar={(v: any) => setEscolhasRecheio(Array.isArray(v) ? v : (v ? [v] : []))} />
      )}
      {gCobertura && <Grupo chave="cobertura" g={gCobertura} multi={false} valor={escolhaCobertura} aoMudar={setEscolhaCobertura} />}

      {extrasBiblioteca.length > 0 && (
        <section className="pm-g">
          <header className="pm-g-cab"><span><b>Adicionais</b><small>Escolha quantos quiser</small></span></header>
          {extrasBiblioteca.map(e => {
            const on = extrasMarcados.has(e.id)
            const gratis = !e.valor || Number(e.valor) === 0
            return (
              <button key={e.id} type="button" className="pm-op" role="checkbox" aria-checked={on} onClick={() => toggleExtra(e.id)}>
                <span className="pm-op-tx"><b>{e.nome}</b></span>
                <span className={`pm-op-p${gratis ? ' gratis' : ''}`}>{gratis ? 'Grátis' : `+ ${formatCurrency(Number(e.valor))}`}</span>
                <span className="pm-ctl cx" style={on ? { borderColor: corBotao, background: corBotao } : undefined} aria-hidden="true">{on && <Check size={14} weight="bold" color="#fff" />}</span>
              </button>
            )
          })}
        </section>
      )}

      {!onAdicionar && (
        <section className="pm-g">
          <header className="pm-g-cab"><span><b>Foto de referência</b><small>Mostre uma ideia do que você quer</small></span></header>
          <label className="pm-foto">
            {fotoRef ? <img src={fotoRef} alt="Foto de referência" /> : <span className="pm-foto-ic"><Camera size={20} weight="bold" /></span>}
            <span className="pm-foto-tx"><b>{fotoRefUploading ? 'Carregando…' : fotoRef ? 'Foto anexada' : 'Enviar uma foto'}</b><small>{fotoRef ? 'Toque pra trocar' : 'Opcional'}</small></span>
            {fotoRef && <button type="button" className="pm-foto-x" aria-label="Tirar a foto" onClick={ev => { ev.preventDefault(); ev.stopPropagation(); setFotoRef(null) }}><X size={18} weight="bold" /></button>}
            <input type="file" accept="image/*" onChange={handleFotoRef} hidden />
          </label>
        </section>
      )}

      <section className="pm-g">
        <header className="pm-g-cab"><span><b>Alguma observação?</b></span><span className="pm-g-dir"><em>{observations.length}/140</em></span></header>
        <div className="pm-obs">
          <textarea value={observations} maxLength={140} rows={3} aria-label="Alguma observação?"
            placeholder={gTamanho || gMassa || gRecheio ? 'Ex.: escrever "Parabéns, Lia!" no bolo' : 'Ex.: deixar sem açúcar por cima'}
            onChange={e => setObservations(e.target.value.slice(0, 140))} />
        </div>
      </section>
    </>
  )

  const pe = (
    <footer className="pm-pe">
      {!semQuantidade && (
        <div className="pm-qtd">
          <button type="button" aria-label="Diminuir" disabled={quantity <= minimo} onClick={() => setQuantity(q => Math.max(minimo, Math.round((q - passo) * 10) / 10))}><Minus size={20} weight="bold" /></button>
          <b aria-live="polite">{qtdTexto}</b>
          <button type="button" aria-label="Aumentar" style={{ color: corBotao }} disabled={quantity >= 50} onClick={() => setQuantity(q => Math.min(50, Math.round((q + passo) * 10) / 10))}><Plus size={20} weight="bold" /></button>
        </div>
      )}
      <button type="button" className={`pm-add${faltou ? ' treme' : ''}`} style={{ background: corBotao }} onClick={tentarAdicionar}>
        <span>{rotuloAdicionar || 'Adicionar'}</span><strong>{formatCurrency(totalDisplay)}</strong>
      </button>
    </footer>
  )

  const aoRolar = (e: React.UIEvent<HTMLDivElement>) => {
    const alto = (e.currentTarget.querySelector('.pm-ft') as HTMLElement | null)?.offsetHeight || 0
    setBarra(e.currentTarget.scrollTop > Math.max(0, alto - 64))
  }
  const aoArrastarFoto = (e: React.UIEvent<HTMLDivElement>) => {
    const tr = e.currentTarget
    const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth))
    if (i !== imgIndex) setImgIndex(i)
  }
  const pausar = () => { pausaAte.current = Date.now() + 8000 }

  return createPortal(
    <div className="pm-veu" onClick={onClose}>
      <div ref={caixaRef} tabIndex={-1} className={`pm${images.length ? '' : ' pm--sem-foto'}`} role="dialog" aria-modal="true" aria-label={nome} onClick={e => e.stopPropagation()}>
        {/* celular: barra que aparece ao rolar · computador: topo com o nome */}
        <div className={`pm-barra${barra ? ' on' : ''}`}>
          <button type="button" className="pm-bt" aria-label="Voltar" onClick={onClose}><ArrowLeft size={22} weight="bold" /></button>
          <b>{nome}</b>
          <button type="button" className="pm-bt pm-bt-x" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button>
        </div>

        {images.length > 0 && (
          <div className="pm-lado">
            <div className="pm-ft-pc">
              {images.map((src, i) => <img key={src + i} src={src} alt={i === imgIndex ? nome : ''} className={i === imgIndex ? 'on' : ''} />)}
            </div>
            {images.length > 1 && (
              <div className="pm-mini">
                {images.map((src, i) => (
                  <button key={src + i} type="button" aria-label={`Foto ${i + 1}`} aria-pressed={i === imgIndex} style={i === imgIndex ? { borderColor: corBotao } : undefined}
                    onClick={() => { pausar(); setImgIndex(i) }}><img src={src} alt="" /></button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pm-dir">
          <div ref={roloRef} className="pm-rolo" onScroll={aoRolar}>
            {images.length > 0 && (
              <div className="pm-ft">
                <div ref={trilhoRef} className="pm-ft-trilho" onScroll={aoArrastarFoto} onTouchStart={pausar} onPointerDown={pausar}>
                  {images.map((src, i) => <img key={src + i} src={src} alt={i === 0 ? nome : ''} />)}
                </div>
                <button type="button" className="pm-voltar" aria-label="Voltar" onClick={onClose}><ArrowLeft size={22} weight="bold" /></button>
                {images.length > 1 && (<>
                  <span className="pm-ft-n">{imgIndex + 1}/{images.length}</span>
                  <span className="pm-ft-pts" aria-hidden="true">{images.map((_, i) => <i key={i} className={i === imgIndex ? 'on' : ''} />)}</span>
                </>)}
              </div>
            )}
            {!images.length && <div className="pm-espaco" />}
            {corpo}
          </div>
          {pe}
        </div>
      </div>
    </div>,
    document.body
  )
}
