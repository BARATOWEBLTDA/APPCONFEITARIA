import { seloEntrega } from "@/lib/entregaProduto";
import { unidadeCliente } from '@/lib/formaVenda'
import KitPicker from '@/components/cardapio/KitPicker'
import { precoCardapio, precoDoTamanho, descontoCardapio, comDesconto, tamanhosEsgotados } from '@/lib/precoCardapio'
import { pesoDoNome, pesoDoTamanho, cortarTexto } from '@/lib/itemSacola'
import { r2 } from '@/lib/moeda'
import { avisar } from '@/components/base'
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
  /** (14/10) Prévia do cadastro: janela menor no centro, sem foto de referência/observação, botão "Entendi" só fecha */
  previa?: boolean
}

/**
 * Foto de referência (11/10): reduz pra no máximo 1280 px no lado maior e devolve em JPEG (qualidade 0,8).
 * Dá erro quando o arquivo não é uma imagem que o aparelho consegue abrir.
 */
function reduzirFoto(file: File, ladoMaximo = 1280, qualidade = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const largura = img.naturalWidth, altura = img.naturalHeight
        if (!largura || !altura) throw new Error('imagem sem tamanho')
        const escala = Math.min(1, ladoMaximo / Math.max(largura, altura))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(largura * escala))
        canvas.height = Math.max(1, Math.round(altura * escala))
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('sem canvas')
        // fundo branco: imagem com transparência não fica preta no JPEG
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const dados = canvas.toDataURL('image/jpeg', qualidade)
        if (!dados.startsWith('data:image/jpeg')) throw new Error('não gerou a imagem')
        resolve(dados)
      } catch (err) { reject(err) } finally { URL.revokeObjectURL(url) }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('não é uma imagem')) }
    img.src = url
  })
}

/** Texto do botão enquanto falta uma escolha obrigatória */
const TEXTO_FALTA: Record<string, string> = {
  kit: 'Monte o seu kit', tamanho: 'Escolha o tamanho', sabor: 'Escolha o sabor',
  massa: 'Escolha a massa', recheio: 'Escolha o recheio', cobertura: 'Escolha a cobertura',
}

// ═══ Um grupo de opções (faixa cinza + lista) ═════════════════════
// (11/10) Fica FORA do ProductModal: declarado lá dentro, era um componente novo a cada render
// e a lista inteira era desmontada e montada de novo a cada toque (perdia o foco e a rolagem).
interface GrupoProps {
  chave: string
  g: GrupoOpcoes
  multi: boolean
  valor: string | string[] | null
  aoMudar: (v: any) => void
  /** onde o modal guarda cada seção (pra rolar até a que falta) */
  secoes: React.MutableRefObject<Record<string, HTMLElement | null>>
  /** grupo obrigatório que ficou sem escolha */
  faltou: string | null
  emFatias: boolean
  corBotao: string
  /** texto do preço ao lado da opção ("" = não mostra) */
  precoDaOpcao: (g: GrupoOpcoes, op: any) => string
}

function Grupo({ chave, g, multi, valor, aoMudar, secoes, faltou, emFatias, corBotao, precoDaOpcao }: GrupoProps) {
  const marcado = (id: string) => multi ? Array.isArray(valor) && valor.includes(id) : valor === id
  const qtdMarcada = multi ? (Array.isArray(valor) ? valor.length : 0) : (valor ? 1 : 0)
  const max = multi ? (g.max_selecionavel || 1) : 1
  const obrig = g.min_selecionavel > 0
  const ok = obrig && qtdMarcada >= g.min_selecionavel
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
          const preco = precoDaOpcao(g, op)
          const peso = op.peso_kg && pesoDoNome(op.nome) !== Number(op.peso_kg) ? `${String(op.peso_kg).replace('.', ',')} kg` : '' // (10/10) não repete quando o nome já é o peso
          const un = String((g as any).rendimento_unidade || '').trim() // (13/10) além de pessoas e fatias, a unidade que ela escreveu (copos, potes…)
          const serve = op.serve ? (/^\d+$/.test(String(op.serve).trim()) ? (emFatias ? `${String(op.serve).trim()} fatias` : un && un !== 'pessoas' ? `Serve até ${String(op.serve).trim()} ${un}` : `Serve até ${String(op.serve).trim()} pessoas`) : `Serve até ${op.serve}`) : ''
          const esgotado = !!op.esgotado // (14/10) a confeiteira marcou esse tamanho como esgotado
          const bloqueado = esgotado || (multi && !on && max > 1 && qtdMarcada >= max)
          return (
            <button key={op.id} type="button" className="pm-op" role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={bloqueado} onClick={() => tocar(op.id)}>
              <span className="pm-op-tx"><b>{peso && g.tipo === 'tamanho' ? `${op.nome} · ${peso}` : op.nome}</b>{serve && <small>{serve}</small>}</span>
              {esgotado ? <span className="pm-op-p pm-op-esg">Esgotado</span> : preco && <span className="pm-op-p">{preco}</span>}
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

export function ProductModal({ isOpen, onClose, product, corBotao = '#ec4899', onAdicionar, rotuloAdicionar, previa }: Props) {
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
  const extrasDoProduto = useRef<string | null>(null)
  const [rolagem, setRolagem] = useState(0)
  const [fotoRef, setFotoRef] = useState<string | null>(null)
  const [fotoRefUploading, setFotoRefUploading] = useState(false)
  const fotoVez = useRef(0)

  useEffect(() => {
    if (!isOpen || !product) {
      setExtrasMarcados(new Set())
      fotoVez.current++ // foto que ainda estava sendo preparada não entra depois de fechar
      setFotoRefUploading(false)
      setFotoRef(null)
      setRolagem(0)
      return
    }
    // (11/10) trocou de produto: a lista de adicionais do produto anterior sai da tela na hora
    if (extrasDoProduto.current !== product.id) { extrasDoProduto.current = product.id; setExtrasBiblioteca([]) }
    const uid = (product as any).user_id
    if (!uid) return
    // 02/10: pelo cardápio (cliente sem login) a tabela não pode ser lida direto — usa a função segura.
    // Se a função ainda não existir no banco (SQL não rodado), tenta a leitura direta.
    // (11/10) resposta atrasada de outro produto (ou depois de fechar) não entra na tela
    let valendo = true
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
        if (!valendo) return
        if (!data) { setExtrasBiblioteca([]); return }
        // Filtra: sem categorias (aparece em todos) ou vinculado a esse produto
        const filtrados = (data as ExtraBiblioteca[]).filter(e => {
          const cats: string[] = Array.isArray(e.categorias) ? e.categorias : []
          return cats.length === 0 || cats.includes(product.id)
        })
        setExtrasBiblioteca(filtrados)
      }).catch(() => { /* sem internet: fica sem os adicionais */ })
    return () => { valendo = false }
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
    const campo = e.target
    const file = campo.files?.[0]
    campo.value = '' // escolher a mesma foto de novo volta a funcionar
    if (!file || !product) return
    // (11/10) só imagem, e reduzida antes de guardar (antes ia inteira, sem limite de tamanho)
    if (file.type && !file.type.startsWith('image/')) { avisar('Escolha uma foto. Outros arquivos não entram aqui.', { tipo: 'erro' }); return }
    const vez = ++fotoVez.current
    setFotoRefUploading(true)
    try {
      // Fica em base64 no state e só é enviada junto do pedido
      // (pra guardar no storage precisaria de login do cliente).
      const reduzida = await reduzirFoto(file)
      if (vez === fotoVez.current) setFotoRef(reduzida)
    } catch {
      if (vez === fotoVez.current) avisar('Não deu pra usar essa foto. Tente outra.', { tipo: 'erro' })
    }
    if (vez === fotoVez.current) setFotoRefUploading(false)
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

  // (11/10) a mesma regra do cartão do produto (lib/precoCardapio): promoção em % vale sempre;
  // promoção em valor só pra produto sem kit e sem tamanhos de preço fixo (antes virava desconto proporcional em todos os tamanhos)
  const descPct = product ? descontoCardapio(product) : 0

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
  // 10/10: tamanho "pelo peso" cadastrado sem o peso → lê o peso do nome da opção ("0,5kg", "500g").
  // O mesmo valor vale pro preço da opção, pro total e pro que vai pra sacola.
  const tamanhoPorPeso = (gTamanho as any)?.modo_preco_tamanho === 'por_peso'
  const pesoOpTamanho = opTamanho ? pesoDoTamanho(opTamanho, tamanhoPorPeso) : 0

  // ═══ Cálculo do preço em tempo real ═══════════════════════════════
  const calculo = useMemo<PrecoBreakdownCarrinho>(() => {
    if (!product) {
      return { base: 0, adicionais: 0, subtotal: 0, desconto: 0, final: 0 } as any
    }
    let baseEfetivo = basePrice

    // Se tamanho ativo e escolhido, considera preço/peso do tamanho
    // (11/10) a mesma função do preço mostrado ao lado de cada tamanho (lib/precoCardapio)
    if (opTamanho) {
      const doTamanho = precoDoTamanho(opTamanho, tamanhoPorPeso, basePrice)
      if (doTamanho > 0) baseEfetivo = doTamanho
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
        if (tamanhoPorPeso) {
          // (11/10) tamanho pelo peso: o preço do sabor é por kg (antes 3 kg custava o mesmo que 1 kg).
          // O `preco` antigo que sobrou na opção de tamanho não entra aqui (nem como "conflito").
          baseEfetivo = opTamanho && pesoOpTamanho > 0 ? opSabor.preco * pesoOpTamanho : opSabor.preco
        } else if (conflito && opTamanho) {
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
      tamanho_escolhido_peso_kg: pesoOpTamanho || null,
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

    // (11/10) centavos por uma conta só (r2 + comDesconto), a mesma do cartão e do preço ao lado de cada opção.
    // Antes era toFixed aqui e Math.round lá: 0,5 kg de R$ 31,99 dava R$ 16,00 no cartão e R$ 15,99 no botão.
    const subtotal = r2(baseEfetivo + adicionaisTotal)
    const final = comDesconto(subtotal, descPct)
    const desconto = r2(subtotal - final)

    return {
      preco_base_original: product.preco_normal || 0,
      base_efetivo: r2(baseEfetivo),
      adicionais_total: r2(adicionaisTotal),
      subtotal,
      desconto,
      final,
    }
    // 10/10: depende das escolhas de recheio (antes era só a quantidade: trocar o recheio A pelo B, com máximo de 1, mantinha o adicional do A)
  }, [product, grupos, quantity, opMassa, opCobertura, opSabor, opTamanho, pesoOpTamanho, tamanhoPorPeso, escolhasRecheio, basePrice, descPct, extrasMarcados, extrasBiblioteca, kitInfo?.preco]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Fotos: trocam sozinhas a cada 4 s, bem suave (para quando o cliente mexe; não roda com "reduzir movimento")
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

  const totalDisplay = r2(calculo.final * quantity) // (11/10) a linha da sacola faz a mesma conta

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
      // (11/10) pelo peso, o `preco` antigo da opção não vale (não vai pro pedido como "preço fixo")
      if (opTamanho.preco && !tamanhoPorPeso) e.preco_fixo = opTamanho.preco
      if (pesoOpTamanho > 0) e.peso_kg = pesoOpTamanho
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
  const gSaborCfg = grupos.find(x => x.tipo === 'sabor') as any
  const saborComPreco = !!gSabor && !!gSaborCfg?.sabor_tem_preco_proprio
  // (11/10) pelo peso com sabor de preço próprio escolhido: o kg custa o preço do sabor (igual ao total)
  const porKg = tamanhoPorPeso && saborComPreco && opSabor && opSabor.preco > 0 ? opSabor.preco : basePrice
  // (11/10) a mesma conta do total e do cartão: preço do tamanho + desconto (lib/precoCardapio)
  const precosTam = semTamanho ? (gTamanho!.opcoes || [])
    .map((o: any) => comDesconto(precoDoTamanho(o, tamanhoPorPeso, porKg), descPct))
    .filter((v: number) => v > 0) : []
  const valorTopo = semTamanho ? comDesconto(precoCardapio(product).valor, descPct) : calculo.final
  const pMin = precosTam.length ? Math.min(...precosTam) : valorTopo
  const pMax = precosTam.length ? Math.max(...precosTam) : valorTopo

  // ═══ Preço ao lado de cada opção (11/10): sai da mesma conta do total, já com a promoção ═══
  // Antes mostrava o preço cheio (o botão cobrava com desconto) e, pelo peso, o `preco` antigo da opção.
  const regraSabor = gSaborCfg?.regra_conflito_tamanho || REGRA_CONFLITO_DEFAULT
  // Sabor e tamanho (de preço fixo) com preço: vale a regra que a loja escolheu no cadastro
  const disputaPreco = saborComPreco && !!gTamanho && !tamanhoPorPeso && gTamanho.opcoes.some((o: any) => (o.preco || 0) > 0)
  const ctxOpcao = {
    quantidade_pedido: quantity,
    quantidade_base: (product as any).quantidade_base || null,
    forma_venda: product.forma_venda,
    tamanho_escolhido_peso_kg: pesoOpTamanho || null,
  }
  const precoDaOpcao = (g: GrupoOpcoes, op: any): string => {
    const comPromo = (v: number) => formatCurrency(comDesconto(v, descPct))
    if (g.tipo === 'tamanho') {
      // regra "o preço vem do sabor": com um sabor de preço próprio escolhido, o tamanho não muda o preço
      if (disputaPreco && regraSabor === 'preco_sabor' && opSabor && opSabor.preco > 0) return ''
      const v = precoDoTamanho(op, tamanhoPorPeso, porKg)
      return v > 0 ? comPromo(v) : ''
    }
    if (g.tipo === 'sabor' && saborComPreco) {
      const v = Number(op.preco) || 0
      if (!(v > 0)) return ''
      if (tamanhoPorPeso && gTamanho) {
        // tamanho pelo peso: o preço do sabor é por kg
        if (opTamanho && pesoOpTamanho > 0) return comPromo(v * pesoOpTamanho)
        if (!opTamanho && gTamanho.min_selecionavel > 0) return `${comPromo(v)} por kg`
        return comPromo(v)
      }
      if (disputaPreco && gTamanho && (opTamanho || gTamanho.min_selecionavel > 0)) {
        if (regraSabor === 'preco_sabor') return comPromo(v)
        if (regraSabor === 'tamanho_base_sabor_adicional') return `+ ${comPromo(v)}`
        return '' // "o preço vem do tamanho": o sabor não muda o preço
      }
      return comPromo(v)
    }
    // tamanho e sabor com preço próprio não somam adicional no total
    const ad = calcularAdicionalOpcao(op, ctxOpcao)
    return ad > 0 ? `+ ${comPromo(ad)}` : ''
  }
  const emFatias = (product as any)?.grupo_tamanhos?.rendimento_unidade === 'fatias'
  // O que todo grupo recebe igual (o componente Grupo fica fora daqui pra não ser remontado a cada toque)
  const doGrupo = { secoes, faltou, emFatias, corBotao, precoDaOpcao }

  const corpo = (
    <>
      <div className="pm-info">
        <h2>{nome}</h2>
        {product.descricao && <p>{product.descricao}</p>}
        <div className="pm-preco">
          {!semTamanho && descPct > 0 && calculo.subtotal > valorTopo && <s>{formatCurrency(calculo.subtotal)}</s>}
          <strong>{semTamanho && pMax > pMin ? `${formatCurrency(pMin)} a ${formatCurrency(pMax)}` : formatCurrency(semTamanho ? pMin : valorTopo)}</strong>
          <em>{semTamanho ? 'conforme o tamanho' : kitCfg ? ((kitCfg as any).modo === 'livre' ? (Number((kitCfg as any).livre?.min) === 100 ? 'o cento' : `${(kitCfg as any).livre?.min} un.`) : 'o kit') : gTamanho ? '' : saborComPreco && !opSabor ? 'conforme o sabor' : unidadeCliente(product.forma_venda)}</em>
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
      {gTamanho && <Grupo {...doGrupo} chave="tamanho" g={gTamanho} multi={false} valor={escolhaTamanho} aoMudar={setEscolhaTamanho} />}
      {gSabor && <Grupo {...doGrupo} chave="sabor" g={gSabor} multi={false} valor={escolhaSabor} aoMudar={setEscolhaSabor} />}
      {gMassa && <Grupo {...doGrupo} chave="massa" g={gMassa} multi={false} valor={escolhaMassa} aoMudar={setEscolhaMassa} />}
      {gRecheio && (
        <Grupo {...doGrupo} chave="recheio" g={gRecheio} multi={gRecheio.max_selecionavel > 1}
          valor={gRecheio.max_selecionavel > 1 ? escolhasRecheio : (escolhasRecheio[0] || null)}
          aoMudar={(v: any) => setEscolhasRecheio(Array.isArray(v) ? v : (v ? [v] : []))} />
      )}
      {gCobertura && <Grupo {...doGrupo} chave="cobertura" g={gCobertura} multi={false} valor={escolhaCobertura} aoMudar={setEscolhaCobertura} />}

      {extrasBiblioteca.length > 0 && (
        <section className="pm-g">
          <header className="pm-g-cab"><span><b>Adicionais</b><small>Escolha quantos quiser</small></span></header>
          {extrasBiblioteca.map(e => {
            const on = extrasMarcados.has(e.id)
            const gratis = !e.valor || Number(e.valor) === 0
            return (
              <button key={e.id} type="button" className="pm-op" role="checkbox" aria-checked={on} onClick={() => toggleExtra(e.id)}>
                <span className="pm-op-tx"><b>{e.nome}</b></span>
                {/* (11/10) com promoção, o adicional também entra com desconto no total: mostra o que é cobrado */}
                <span className={`pm-op-p${gratis ? ' gratis' : ''}`}>{gratis ? 'Grátis' : `+ ${formatCurrency(comDesconto(Number(e.valor), descPct))}`}</span>
                <span className="pm-ctl cx" style={on ? { borderColor: corBotao, background: corBotao } : undefined} aria-hidden="true">{on && <Check size={14} weight="bold" color="#fff" />}</span>
              </button>
            )
          })}
        </section>
      )}

      {!onAdicionar && !previa && (
        <section className="pm-g">
          <header className="pm-g-cab"><span><b>Foto de referência</b><small>Mostre uma ideia do que você quer</small></span></header>
          <label className="pm-foto">
            {fotoRef ? <img src={fotoRef} alt="Foto de referência" /> : <span className="pm-foto-ic"><Camera size={20} weight="bold" /></span>}
            <span className="pm-foto-tx"><b>{fotoRefUploading ? 'Carregando…' : fotoRef ? 'Foto anexada' : 'Enviar uma foto'}</b><small>{fotoRef ? 'Escolha outra pra trocar' : 'Opcional'}</small></span>
            {fotoRef && <button type="button" className="pm-foto-x" aria-label="Tirar a foto" onClick={ev => { ev.preventDefault(); ev.stopPropagation(); setFotoRef(null) }}><X size={18} weight="bold" /></button>}
            <input type="file" accept="image/*" onChange={handleFotoRef} hidden />
          </label>
        </section>
      )}

      {!previa && (
      <section className="pm-g">
        <header className="pm-g-cab"><span><b>Alguma observação?</b></span><span className="pm-g-dir"><em>{observations.length}/140</em></span></header>
        <div className="pm-obs">
          <textarea value={observations} maxLength={140} rows={3} aria-label="Alguma observação?"
            placeholder={gTamanho || gMassa || gRecheio ? 'Ex.: escrever "Parabéns, Lia!" no bolo' : 'Ex.: deixar sem açúcar por cima'}
            // (11/10) corta por caracteres inteiros: metade de emoji quebrava o link do WhatsApp do pedido
            onChange={e => setObservations(cortarTexto(e.target.value, 140))} />
        </div>
      </section>
      )}
    </>
  )

  const pe = previa ? (
    <footer className="pm-pe">
      <button type="button" className="pm-add so-texto" style={{ background: corBotao }} onClick={onClose}><span>Entendi</span></button>
    </footer>
  ) : (
    <footer className="pm-pe">
      {!semQuantidade && (
        <div className="pm-qtd">
          <button type="button" aria-label="Diminuir" disabled={quantity <= minimo} onClick={() => setQuantity(q => Math.max(minimo, Math.round((q - passo) * 10) / 10))}><Minus size={20} weight="bold" /></button>
          <b aria-live="polite">{qtdTexto}</b>
          <button type="button" aria-label="Aumentar" style={{ color: corBotao }} disabled={quantity >= 50} onClick={() => setQuantity(q => Math.min(50, Math.round((q + passo) * 10) / 10))}><Plus size={20} weight="bold" /></button>
        </div>
      )}
      {/* Faltando escolha obrigatória o botão diz o que falta; sem tamanho/kit ainda não mostra preço (seria o do menor como se estivesse escolhido) */}
      {/* (14/10) todos os tamanhos esgotados: o botão diz isso e não deixa pedir */}
      {/* (14/10) faltando escolha: só o texto ("Escolha a massa" cortava em "Escolha…" ao lado do preço) */}
      {tamanhosEsgotados(product) ? <button type="button" className="pm-add so-texto" disabled style={{ background: '#B5AAB0', cursor: 'not-allowed' }}><span>Esgotado no momento</span></button> :
      <button type="button" className={`pm-add${faltou ? ' treme' : ''}${pendente ? ' so-texto' : ''}`} style={{ background: corBotao }} onClick={tentarAdicionar}>
        <span>{pendente ? TEXTO_FALTA[pendente] : (rotuloAdicionar || 'Adicionar')}</span>
        {!pendente && <strong>{formatCurrency(totalDisplay)}</strong>}
      </button>}
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
    <div className={`pm-veu${previa ? ' pm-veu--previa' : ''}`} onClick={onClose}>
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
