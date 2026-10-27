import { seloEntrega } from "@/lib/entregaProduto";
import { unidadePreco } from '@/lib/formaVenda'
import KitPicker from '@/components/cardapio/KitPicker'
import { precoCardapio, precoDoTamanho, descontoCardapio, comDesconto, tamanhosEsgotados, precoCardapioComPromocao } from '@/lib/precoCardapio'
import { produtosDaLojaAtual, lojaAtualId } from '@/components/cardapio/lojaAtual'
import { pesoDoNome, pesoDoTamanho } from '@/lib/itemSacola'
import { r2 } from '@/lib/moeda'
import { avisar } from '@/components/base'
import { kitAtivo, calcularKit, selecaoInicial, kitUnico, kitsValidos, palavraKit, type KitSelecao } from '@/lib/kitQuantidade'
import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, CalendarBlank, Camera, CaretLeft, CaretRight, Check, Fire, Lightning, Minus, Plus, X } from '@phosphor-icons/react'
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
  pede_frase?: boolean
  descricao?: string | null
  categorias: string[] // IDs dos produtos vinculados (vazio = todos)
  pede_referencia?: boolean // (19/10) marcado no cardápio, abre o anexo da foto de referência (ex.: Topo de bolo)
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
  const unG = String((g as any).rendimento_unidade || '').trim() // (13/10) além de pessoas e fatias, a unidade que ela escreveu (copos, potes…)
  const nomeOp = (op: any) => {
    const peso = op.peso_kg && pesoDoNome(op.nome) !== Number(op.peso_kg) ? `${String(op.peso_kg).replace('.', ',')} kg` : '' // (10/10) não repete quando o nome já é o peso
    return peso && g.tipo === 'tamanho' ? `${op.nome} · ${peso}` : op.nome
  }
  const serveOp = (op: any) => op.serve ? (/^\d+$/.test(String(op.serve).trim()) ? (emFatias ? `${String(op.serve).trim()} fatias` : unG && unG !== 'pessoas' ? `Serve até ${String(op.serve).trim()} ${unG}` : `Serve até ${String(op.serve).trim()} pessoas`) : `Serve até ${op.serve}`) : ''
  // (20/10) escolha única feita: o subtítulo mostra o que foi escolhido ("5 kg · serve até 50 pessoas")
  const opEscolhida = !multi && valor ? g.opcoes.find((o: any) => o.id === valor) : null
  const resumo = opEscolhida ? [nomeOp(opEscolhida), serveOp(opEscolhida).replace(/^Serve/, 'serve')].filter(Boolean).join(' · ') : ''
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
        <span><b>{titulo}</b><small className={resumo && !falta ? 'pm-g-resumo' : undefined}>{falta ? `${regra} para continuar` : resumo || regra}</small></span>
        <span className="pm-g-dir">
          {multi && max > 1 && <em>{qtdMarcada}/{max}</em>}
          {obrig && (ok ? <i className="pm-ok" aria-label="Escolhido"><Check size={14} weight="bold" /></i> : <i className="pm-obr">Obrigatório</i>)}
        </span>
      </header>
      <div role={multi ? 'group' : 'radiogroup'} aria-label={titulo}>
        {g.opcoes.map((op: any) => {
          const on = marcado(op.id)
          const preco = precoDaOpcao(g, op)
          const serve = serveOp(op)
          const esgotado = !!op.esgotado // (14/10) a confeiteira marcou esse tamanho como esgotado
          const bloqueado = esgotado || (multi && !on && max > 1 && qtdMarcada >= max)
          return (
            <button key={op.id} type="button" className="pm-op" role={multi ? 'checkbox' : 'radio'} aria-checked={on} disabled={bloqueado} onClick={() => tocar(op.id)}>
              <span className="pm-op-tx"><b>{nomeOp(op)}</b>{serve && <small>{serve}</small>}</span>
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

export function ProductModal({ isOpen, onClose, product: produtoAberto, corBotao = '#ec4899', onAdicionar, rotuloAdicionar, previa }: Props) {
  // (21/10) "Peça também": o cliente troca de produto sem fechar a janela
  const [outro, setOutro] = useState<Produto | null>(null)
  useEffect(() => { setOutro(null) }, [produtoAberto, isOpen])
  const product = outro || produtoAberto
  const { addItem } = useCart()
  const [quantity, setQuantity] = useState(1)
  // Kit por quantidade (docinhos/salgados): quantos de cada sabor
  const [kitSel, setKitSel] = useState<KitSelecao>({ kitId: '', qtdLivre: 0, qtds: {} })
  const kitCfg = kitAtivo((product as any)?.kit_qtd) ? (product as any).kit_qtd : null
  const kitInfo = kitCfg ? calcularKit(kitCfg, kitSel) : null
  const [observations, setObservations] = useState('')
  const [imgIndex, setImgIndex] = useState(0)

  // ═══ V3 — escolhas por tipo de grupo ═══════════════════════════════
  // massa: id única, cobertura: id única, sabor: id única, tamanho: id única
  // recheios: array de ids (múltiplos)
  const [escolhaMassa, setEscolhaMassa] = useState<string | null>(null)
  const [escolhasRecheio, setEscolhasRecheio] = useState<string[]>([])
  const [escolhaCobertura, setEscolhaCobertura] = useState<string | null>(null)
  const [escolhaSabor, setEscolhaSabor] = useState<string | null>(null)
  const [escolhaTamanho, setEscolhaTamanho] = useState<string | null>(null)

  // ═══ Personalizações da biblioteca (aba /complementos) ══════════════
  // Buscamos direto no banco quando o modal abre. Se o dono cadastrou
  // extras marcados pra esse produto (ou pra todos), aparecem aqui.
  const [extrasBiblioteca, setExtrasBiblioteca] = useState<ExtraBiblioteca[]>([])
  const [extrasMarcados, setExtrasMarcados] = useState<Set<string>>(new Set())
  const extrasDoProduto = useRef<string | null>(null)
  // (24/10) frase escrita pelo cliente no complemento que pede frase (ex.: Escrita no bolo)
  const [frases, setFrases] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!isOpen || !product) {
      setExtrasMarcados(new Set())
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
      // (24/10) a v4 traz foto de referência, categorias e frase · (27/10) as versões antigas saíram do banco
      const r = await supabase.rpc('cardapio_extras_v4', { p_loja: uid })
      if (!r.error && Array.isArray(r.data)) data = r.data
      else {
        // a confeiteira logada (Nova venda) lê a própria tabela
        const d = await supabase.from('biblioteca_extras').select('*').eq('user_id', uid)
        data = (d.data as any[]) || null
      }
      return { data }
    })().then(({ data }) => {
        if (!valendo) return
        if (!data) { setExtrasBiblioteca([]); return }
        // Filtra: (24/10) nas categorias marcadas (pelo nome da categoria do produto), nos produtos marcados ou em todos
        const filtrados = (data as ExtraBiblioteca[]).filter(e => {
          const cats: string[] = Array.isArray(e.categorias) ? e.categorias : []
          const doCardapio: string[] = Array.isArray((e as any).categorias_cardapio) ? (e as any).categorias_cardapio : []
          if (doCardapio.length > 0) return doCardapio.includes(String((product as any).categoria || ''))
          return cats.length === 0 || cats.includes(product.id)
        })
        setExtrasBiblioteca(filtrados)
      }).catch(() => { /* sem internet: fica sem os adicionais */ })
    return () => { valendo = false }
  }, [isOpen, product?.id])
  // (19/10) complemento marcado que pede foto de referência (ex.: Topo de bolo)
  const refDoExtra = extrasBiblioteca.find(e => e.pede_referencia && extrasMarcados.has(e.id)) || null

  const toggleExtra = (id: string) => {
    setExtrasMarcados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // Upload da foto de referência (opcional). Cliente escolhe uma imagem
  // pra ilustrar o que quer (ex: "queria um bolo assim").


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
      setQuantity(1); setObservations(''); setImgIndex(0)
      // (27/10) trocando de produto pelo "Peça também", os complementos marcados não passam para o próximo
      setExtrasMarcados(new Set()); setFrases({})
      setEscolhaMassa(null); setEscolhasRecheio([]); setEscolhaCobertura(null)
      setEscolhaSabor(null); setEscolhaTamanho(null)
      if (kitAtivo((product as any).kit_qtd)) setKitSel(selecaoInicial((product as any).kit_qtd))
    }
  }, [product, isOpen])

  // (02/10) Aqui havia uma SEGUNDA trava de rolagem igual à de cima. Ela rodava com a página já
  // congelada (posição 0) e jogava o cardápio pro topo ao abrir e ao fechar o produto. Removida.

  // Autoplay removido — cliente controla clicando nas miniaturas

  const isKg = product?.forma_venda === 'kg'

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
    // (27/10) complementos (topo, vela…) sempre no preço cheio: a promoção é do produto.
    // Antes o topo de R$ 25 aparecia "+ R$ 22,17" num produto com 11% de desconto.
    adicionaisTotal += extrasBibliotecaTotal

    // (11/10) centavos por uma conta só (r2 + comDesconto), a mesma do cartão e do preço ao lado de cada opção.
    // Antes era toFixed aqui e Math.round lá: 0,5 kg de R$ 31,99 dava R$ 16,00 no cartão e R$ 15,99 no botão.
    const subtotal = r2(baseEfetivo + adicionaisTotal)
    const final = r2(comDesconto(r2(baseEfetivo + adicionaisTotal - extrasBibliotecaTotal), descPct) + extrasBibliotecaTotal)
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
  const [zoom, setZoom] = useState(false) // (20/10) computador: zoom na foto ao passar o mouse
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
    // (21/10) só com 2 fotos: de 3 pra cima o cliente escolhe nas miniaturas (a grande não troca sozinha)
    if (!isOpen || imagensMemo.length !== 2) return
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

  // (21/10) Prova social de verdade: quantos pedidos levaram este produto nos últimos 30 dias (só o número)
  const [pedidos30, setPedidos30] = useState(0)
  useEffect(() => {
    setPedidos30(0)
    const loja = (product as any)?.user_id || lojaAtualId(), id = product?.id
    if (!isOpen || !loja || !id || previa || onAdicionar) return
    let vivo = true
    void supabase.rpc('cardapio_pedidos_do_produto', { p_loja: loja, p_produto: id }).then(({ data }) => { if (vivo && typeof data === 'number') setPedidos30(data) })
    return () => { vivo = false }
  }, [product?.id, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  // (21/10) Peça também: 3 da mesma categoria (completa com outras), disponíveis e com foto
  const sugestoes = useMemo(() => {
    if (!product || previa || onAdicionar) return [] as Produto[]
    const todos = produtosDaLojaAtual().filter((p: any) => p.id !== product.id && p.disponivel !== false && p.imagem_url && !tamanhosEsgotados(p)) as Produto[]
    const cat = (product as any).categoria
    return [...todos.filter((p: any) => p.categoria === cat), ...todos.filter((p: any) => p.categoria !== cat)].slice(0, 3)
  }, [product?.id, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

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
      .map(e => ({ id: e.id, nome: e.nome, valor: Number(e.valor) || 0, ...(e.pede_frase && (frases[e.id] || '').trim() ? { frase: frases[e.id].trim() } : {}) }))

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
      // (24/10) o item aceita foto de referência: o Finalizar pedido mostra o campo para enviar
      pedeReferencia: !onAdicionar && ((product as any).aceita_referencia === true || !!refDoExtra) ? (refDoExtra && (product as any).aceita_referencia !== true ? refDoExtra.nome : 'Foto de referência') : undefined,
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
  // (24/10) kit "ele escolhe" (cento): a quantidade já é escolhida em unidades lá em cima; o contador "1 kit" embaixo confundia e cortava o botão
  const semQuantidade = (isKg && !kgLivre) || (!!kitCfg && (kitCfg as any).modo === 'livre')
  const passo = kgLivre ? 0.5 : 1
  const minimo = kgLivre ? 0.5 : 1
  // (21/10) kit: "1 kit" (antes só "1": não dava pra saber se era 1 kit ou 1 doce)
  const qtdTexto = kgLivre ? `${String(quantity).replace('.', ',')} kg` : kitCfg ? `${quantity} ${quantity === 1 ? 'kit' : 'kits'}` : String(quantity)
  // (21/10) kit faltando: o botão diz quantos faltam ("Faltam 75 doces")
  const textoFalta = (p: string) => {
    if (p !== 'kit' || !kitInfo || !kitCfg) return TEXTO_FALTA[p]
    const palavra = palavraKit(kitCfg as any)
    if (kitInfo.restante > 0) return `Faltam ${kitInfo.restante} ${palavra}`
    if (kitInfo.restante < 0) return `Passou ${-kitInfo.restante} ${palavra}`
    return TEXTO_FALTA.kit
  }

  const images = imagensMemo
  // (21/10) de 3 fotos pra cima: a principal grande e as outras em quadrados (computador embaixo dela; celular no meio,
  // entre a foto e o fundo). Com 2, continua passando de lado.
  const grade = images.length >= 3
  const outras = images.map((src, i) => ({ src, i })).filter(x => x.i !== imgIndex)
  const verFoto = (i: number) => {
    pausar(); setImgIndex(i)
    const tr = trilhoRef.current
    if (tr && tr.offsetParent !== null) tr.scrollTo({ left: i * tr.clientWidth, behavior: 'smooth' })
  }
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
  // (24/10) "cada sabor tem o seu preço" sem sabor escolhido: mostra o sabor mais barato (na prévia do cadastro
  // o preço do produto ainda é 0 e aparecia "R$ 0,00 conforme o sabor")
  const precosSabor = saborComPreco && !opSabor && !gTamanho ? ((gSabor as any)?.opcoes || []).map((o: any) => Number(o?.preco) || 0).filter((v: number) => v > 0) : []
  const valorTopo = semTamanho ? comDesconto(precoCardapio(product).valor, descPct) : precosSabor.length && !(calculo.final > 0) ? comDesconto(Math.min(...precosSabor), descPct) : calculo.final
  const pMin = precosTam.length ? Math.min(...precosTam) : valorTopo
  const pMax = precosTam.length ? Math.max(...precosTam) : valorTopo
  // (20/10) os tamanhos têm preços diferentes? (decide se a linha do "a partir de" existe, escolhido ou não)
  const precosTodos = gTamanho ? (gTamanho.opcoes || []).map((o: any) => precoDoTamanho(o, tamanhoPorPeso, porKg)).filter((v: number) => v > 0) : []
  const precoTamVaria = precosTodos.length > 1 && Math.max(...precosTodos) > Math.min(...precosTodos)
  // (20/10) "a partir de" com promoção: o menor preço sem desconto, riscado
  const cheios = semTamanho && descPct > 0 ? (gTamanho!.opcoes || []).map((o: any) => precoDoTamanho(o, tamanhoPorPeso, porKg)).filter((v: number) => v > 0) : []
  const pMinCheio = cheios.length ? Math.min(...cheios) : 0
  const temFoto = images.length > 0
  const aviso = selo?.tipo === 'encomenda' ? (
    <div className="pm-aviso"><CalendarBlank size={20} weight="bold" aria-hidden="true" /><span><b>Encomende com {selo.prazo} de antecedência</b><small>Você escolhe o dia ao finalizar o pedido.</small></span></div>
  ) : !previa && !tamanhosEsgotados(product) ? (
    // (21/10) sem prazo de encomenda = pronta entrega (computador; o celular segue como estava)
    <div className="pm-aviso pm-aviso--pronta"><Lightning size={20} weight="fill" aria-hidden="true" /><span><b>Pronta entrega</b><small>Não precisa agendar com antecedência.</small></span></div>
  ) : null

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
        <div className="pm-tit"><h2>{nome}</h2>
          {/* (20/10) computador: o X ao lado do nome (sai a faixa de cima que repetia o nome) */}
          <button type="button" className="pm-x-pc" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button></div>
        {product.descricao && <p className="pm-desc">{product.descricao}</p>}
        <div className="pm-preco">
          {/* (19/10) com tamanhos: "a partir de R$ X" (o menor), em vez de "R$ X a R$ Y" */}
          {/* (20/10) a linha do "a partir de" fica reservada depois de escolher: a lista não sobe */}
          {gTamanho && !kitInfo && precoTamVaria && <small className="pm-apartir" style={semTamanho ? undefined : { visibility: 'hidden' }}>a partir de</small>}
          {/* (20/10) "a partir de" numa linha só dele; o preço cheio riscado vem depois do preço */}
          <strong className={descPct > 0 ? 'pm-preco-promo' : undefined}>{formatCurrency(semTamanho ? pMin : valorTopo)}</strong>
          <em>{semTamanho ? '' /* (20/10) com tamanhos o bolo é vendido por tamanho: sem "por kg" */ : kitCfg ? ((kitCfg as any).modo === 'livre' ? (Number((kitCfg as any).livre?.min) === 100 ? 'o cento' : `${(kitCfg as any).livre?.min} un.`) : kitUnico(kitCfg as any) ? `o kit · ${kitsValidos(kitCfg as any)[0].qtd} ${palavraKit(kitCfg as any)}` : 'o kit') : gTamanho ? '' : saborComPreco && !opSabor ? 'conforme o sabor' : unidadePreco(product.forma_venda)}</em>
          {semTamanho ? (pMinCheio > pMin && <s>{formatCurrency(pMinCheio)}</s>) : (descPct > 0 && calculo.subtotal > valorTopo && <s>{formatCurrency(calculo.subtotal)}</s>)}
          {descPct > 0 && <span className="pm-off">-{Math.round(descPct * 100)}%</span>}
        </div>
        {aviso}
      </div>

      {kitCfg && (
        <section ref={el => { secoes.current['kit'] = el }} className={`pm-g${faltou === 'kit' ? ' falta' : ''}`}>
          <header className="pm-g-cab"><span><b>{(kitCfg as any).modo === 'livre' ? 'Quantidade e sabores' : 'Monte o seu kit'}</b><small>{faltou === 'kit' ? 'Complete o kit para continuar' : `Até ${(kitCfg as any).max_sabores || 1} ${((kitCfg as any).max_sabores || 1) === 1 ? 'sabor' : 'sabores'}, de ${Math.max(1, (kitCfg as any).passo_sabor || 1)} em ${Math.max(1, (kitCfg as any).passo_sabor || 1)}`}</small></span>
            {/* (21/10) "Obrigatório" discreto no kit: o botão de baixo já não deixa avançar sem montar */}
            <span className="pm-g-dir">{kitInfo?.completo ? <i className="pm-ok"><Check size={14} weight="bold" /></i> : <i className="pm-obr pm-obr--leve">Obrigatório</i>}</span></header>
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
              <Fragment key={e.id}>
              <button type="button" className="pm-op" role="checkbox" aria-checked={on} onClick={() => toggleExtra(e.id)}>
                <span className="pm-op-tx"><b>{e.nome}</b>{e.descricao && <small>{e.descricao}</small>}</span>
                {/* (27/10) complemento no preço cheio, igual ao cadastro (a promoção é só do produto) */}
                <span className={`pm-op-p${gratis ? ' gratis' : ''}`}>{gratis ? 'Grátis' : `+ ${formatCurrency(Number(e.valor))}`}</span>
                <span className="pm-ctl cx" style={on ? { borderColor: corBotao, background: corBotao } : undefined} aria-hidden="true">{on && <Check size={14} weight="bold" color="#fff" />}</span>
              </button>
              {/* (24/10) complemento que pede frase: ao marcar, abre o campo logo embaixo */}
              {on && e.pede_frase && (
                <label className="pm-frase">
                  <span>Qual frase vai no bolo?</span>
                  <input type="text" maxLength={40} placeholder="Ex.: Parabéns, Ana!" value={frases[e.id] || ''} onChange={ev => setFrases(f => ({ ...f, [e.id]: ev.target.value }))} />
                  <small>{(frases[e.id] || '').length}/40</small>
                </label>
              )}
              </Fragment>
            )
          })}
        </section>
      )}

      {/* (24/10) a foto de referência é enviada no fim do pedido, antes de pagar (aqui só avisa) */}
      {!onAdicionar && !previa && ((product as any).aceita_referencia === true || refDoExtra) && (
        <p className="pm-ref-aviso"><Camera size={16} weight="bold" aria-hidden="true" />A foto de referência vai no fim do pedido</p>
      )}

      {/* (20/10) a observação saiu daqui: o recado vai no fim do pedido, antes de pagar */}
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
      <button type="button" className={`pm-add${faltou ? ' treme' : ''}${pendente ? ' so-texto pm-add--falta' : ''}`} style={{ background: corBotao }} onClick={tentarAdicionar}>
        <span>{pendente ? textoFalta(pendente) : (rotuloAdicionar || 'Adicionar')}</span>
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
  // (20/10) zoom como em marketplace: a foto aumenta dentro do quadro e segue o mouse (sem biblioteca)
  const zoomFoto = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) { if (zoom) setZoom(false); return }
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--zx', `${Math.round(((e.clientX - r.left) / r.width) * 1000) / 10}%`)
    e.currentTarget.style.setProperty('--zy', `${Math.round(((e.clientY - r.top) / r.height) * 1000) / 10}%`)
    pausar()
    if (!zoom) setZoom(true)
  }
  const irFoto = (d: number) => { pausar(); setImgIndex(i => (i + d + images.length) % images.length) }

  return createPortal(
    <div className={`pm-veu${previa ? ' pm-veu--previa' : ''}`} onClick={onClose}>
      <div ref={caixaRef} tabIndex={-1} className={`pm${temFoto ? '' : ' pm--sem-foto'}`} style={{ ['--pm-cor' as any]: corBotao }} role="dialog" aria-modal="true" aria-label={nome} onClick={e => e.stopPropagation()}>
        {/* celular: barra que aparece ao rolar · computador: topo com o nome */}
        <div className={`pm-barra${barra ? ' on' : ''}`}>
          <button type="button" className="pm-bt" aria-label="Voltar" onClick={onClose}><ArrowLeft size={22} weight="bold" /></button>
          <b>{nome}</b>
          <button type="button" className="pm-bt pm-bt-x" aria-label="Fechar" onClick={onClose}><X size={22} weight="bold" /></button>
        </div>

        {images.length > 0 && (
          <div className="pm-lado">
            <div className={`pm-ft-pc${zoom ? ' zoom' : ''}`} onMouseMove={zoomFoto} onMouseLeave={() => setZoom(false)}>
              {/* (20/10) a foto inteira, sem corte; atrás, ela mesma borrada preenche as sobras */}
              <img className="pm-ft-fundo" src={images[imgIndex] || images[0]} alt="" aria-hidden="true" />
              {images.map((src, i) => <img key={src + i} src={src} alt={i === imgIndex ? nome : ''} className={i === imgIndex ? 'on' : ''} />)}
              {images.length > 1 && (<>
                <button type="button" className="pm-ft-seta esq" aria-label="Foto anterior" onClick={() => irFoto(-1)}><CaretLeft size={20} weight="bold" /></button>
                <button type="button" className="pm-ft-seta dir" aria-label="Próxima foto" onClick={() => irFoto(1)}><CaretRight size={20} weight="bold" /></button>
                <span className="pm-ft-cont">{imgIndex + 1}/{images.length}</span>
              </>)}
            </div>
            {/* (21/10) as outras fotos em quadrados, juntos na largura da grande. A descrição e o prazo foram pra direita. */}
            {grade && (
              <div className="pm-mini">
                {outras.map(x => (
                  <button key={x.src + x.i} type="button" aria-label={`Ver a foto ${x.i + 1}`} onClick={() => verFoto(x.i)}><img src={x.src} alt="" /></button>
                ))}
              </div>
            )}
            {pedidos30 >= 5 && (
              <p className="pm-social"><Fire size={18} weight="fill" aria-hidden="true" /><span><b>Pedido {pedidos30} vezes</b> nos últimos 30 dias</span></p>
            )}
            {sugestoes.length > 0 && (
              <section className="pm-tambem" aria-label="Peça também">
                <h3>Peça também</h3>
                <div className="pm-tambem-l">
                  {sugestoes.map(p => {
                    const pc = precoCardapioComPromocao(p)
                    return (
                      <button key={p.id} type="button" onClick={() => { setOutro(p); roloRef.current?.scrollTo({ top: 0 }) }}>
                        <span className="pm-tambem-ft"><img src={p.imagem_url!.split(',')[0].trim()} alt="" loading="lazy" /></span>
                        <span className="pm-tambem-tx"><b>{p.nome}</b><em>{pc.aPartir && <small>a partir de</small>}{formatCurrency(pc.final)}</em></span>
                      </button>
                    )
                  })}
                </div>
              </section>
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
                  {/* (27/10) celular: a foto inteira desliza, com bolinhas e o "1/4" (antes 3 miniaturas grandes cobriam a foto) */}
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
