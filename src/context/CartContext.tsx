import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { CartItem } from '@/types/cart'
import { subtotalSacola } from '@/lib/itemSacola'
import { avisar } from '@/components/base'
import { pixelEvento } from '@/lib/facebookPixel'

interface CartContextType {
  items: CartItem[]
  totalItems: number
  totalPrice: number
  addItem: (item: CartItem) => void
  updateQuantity: (id: string, quantity: number) => void
  updateObservations: (id: string, observations: string) => void
  removeItem: (id: string) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | null>(null)

/** Normaliza undefined e null para null, evitando falso-negativo na comparação */
const norm = (v: string | null | undefined): string | null => v ?? null

/**
 * Sacola guardada no aparelho (11/10): antes ficava só na memória e sumia ao recarregar a página
 * (e na atualização automática do app). Fica no sessionStorage, uma por loja, só enquanto a aba está aberta.
 */
const chaveSacola = (loja: string) => `doonly_sacola_${loja}`
/** Foto de referência maior que isso não é guardada (o sessionStorage é pequeno): o item volta sem a foto. */
const FOTO_MAXIMA = 300 * 1024
/** (11/10) Sacola guardada vale por 12 h. */
const VALIDADE_SACOLA = 12 * 60 * 60 * 1000
const pesoDaFoto = (foto: unknown) => (typeof foto === 'string' ? Math.round(foto.length * 0.75) : 0)

function lerSacola(loja?: string): { itens: CartItem[]; semFoto: boolean } {
  if (!loja) return { itens: [], semFoto: false }
  try {
    const bruto = JSON.parse(sessionStorage.getItem(chaveSacola(loja)) || 'null')
    // (11/10) sacola com mais de 12 h é descartada (preços podem ter mudado); sem "em" (formato antigo) vale
    if (typeof bruto?.em === 'number' && Date.now() - bruto.em > VALIDADE_SACOLA) {
      sessionStorage.removeItem(chaveSacola(loja))
      return { itens: [], semFoto: false }
    }
    const lista: any[] = Array.isArray(bruto?.itens) ? bruto.itens : []
    let semFoto = false
    const itens = lista
      // (11/10) preço nulo, zero ou inválido: item descartado
      .filter(i => i && typeof i.id === 'string' && typeof i.name === 'string'
        && i.price != null && Number.isFinite(Number(i.price)) && Number(i.price) > 0
        && Number.isFinite(Number(i.quantity)) && Number(i.quantity) > 0)
      .map(({ fotoNaoGuardada, ...i }) => {
        if (fotoNaoGuardada) semFoto = true
        return { ...i, price: Number(i.price), quantity: Number(i.quantity) } as CartItem
      })
    return { itens, semFoto }
  } catch { return { itens: [], semFoto: false } }
}

function gravarSacola(loja: string, items: CartItem[]) {
  try {
    if (items.length === 0) { sessionStorage.removeItem(chaveSacola(loja)); return }
    const paraGuardar = (semFotos: boolean) => JSON.stringify({
      v: 1,
      em: Date.now(),
      itens: items.map((i: any) => {
        if (!i.fotoReferencia || (!semFotos && pesoDaFoto(i.fotoReferencia) <= FOTO_MAXIMA)) return i
        const { fotoReferencia: _foto, ...semFoto } = i
        return { ...semFoto, fotoNaoGuardada: true }
      }),
    })
    try { sessionStorage.setItem(chaveSacola(loja), paraGuardar(false)) }
    // não coube (muitas fotos): guarda os itens sem nenhuma foto
    catch {
      try { sessionStorage.setItem(chaveSacola(loja), paraGuardar(true)) }
      // (11/10) nem sem fotos coube: apaga a versão velha pra não voltar uma sacola desatualizada
      catch { sessionStorage.removeItem(chaveSacola(loja)) }
    }
  } catch { /* sem sessionStorage (ou cheio): a sacola fica só na memória, como antes */ }
}

/**
 * `loja`: código da loja no endereço do cardápio. Com ele, a sacola fica guardada e volta ao recarregar.
 * Sem ele (janela de produto dentro do app, em Editar pedido), nada é guardado.
 */
export function CartProvider({ children, loja }: { children: ReactNode; loja?: string }) {
  const [guardada] = useState(() => lerSacola(loja))
  const [items, setItems] = useState<CartItem[]>(guardada.itens)

  useEffect(() => {
    if (guardada.semFoto) avisar('Sua sacola voltou, mas a foto de referência não. Mande a foto para a loja pelo WhatsApp.', { tipo: 'info', duracao: 7000 })
  }, [guardada])

  useEffect(() => { if (loja) gravarSacola(loja, items) }, [loja, items])

  // Marca na página que tem sacola com itens (o app não recarrega sozinho enquanto ela está cheia)
  const temItens = items.length > 0
  useEffect(() => {
    if (!loja || !temItens) return
    document.documentElement.dataset.sacola = '1'
    return () => { delete document.documentElement.dataset.sacola }
  }, [loja, temItens])

  // Chave da linha: produto + TODAS as escolhas (tamanho, sabor, massa, recheios, cobertura,
  // adicionais, foto, observação) + preço. Opções diferentes = linha diferente na sacola.
  const chaveLinha = (it: any): string => {
    const base = JSON.stringify({
      id: it.id,
      escolhas: it.escolhas ?? null,
      massa: norm(it.selectedMassa), recheio: norm(it.selectedRecheio), cobertura: norm(it.selectedCobertura),
      extras: Array.isArray(it.extrasBiblioteca) ? it.extrasBiblioteca.map((x: any) => x.id).sort() : [],
      foto: it.fotoReferencia ?? null,
      obs: (it.observations || '').trim(),
      preco: it.price,
    })
    let h = 0
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) | 0
    return `${it.id}#${(h >>> 0).toString(36)}`
  }
  const mesmaLinha = (i: CartItem, alvo: string) => (i.lineId ?? i.id) === alvo

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const lineId = chaveLinha(newItem)
      const existing = prev.find(i => i.lineId === lineId)

      if (existing) {
        // Mesma personalização: apenas soma a quantidade
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + newItem.quantity } : i
        )
      }

      // (19/10) Pixel do Facebook: produto na sacola
      pixelEvento('AddToCart', { content_name: newItem.name, value: Number(newItem.price) * Number(newItem.quantity || 1), content_ids: [newItem.id], content_type: 'product' })
      // Item novo: adiciona ao carrinho e dispara evento
      const updated = [...prev, { ...newItem, lineId }]
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: updated }))
      return updated
    })
  }, [])

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev => prev.map(i => mesmaLinha(i, id) ? { ...i, quantity } : i))
  }, [])

  const updateObservations = useCallback((id: string, observations: string) => {
    setItems(prev => prev.map(i => mesmaLinha(i, id) ? { ...i, observations } : i))
  }, [])

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => !mesmaLinha(i, id)))
  }, [])

  const clearCart = useCallback(() => setItems([]), [])

  const totalItems = items.reduce((acc, i) => acc + (i.saleType === 'kg' ? 1 : Math.floor(i.quantity)), 0)
  // (11/10) cada linha arredondada em centavos e depois somada: o total bate com o que a sacola mostra linha a linha
  const totalPrice = subtotalSacola(items)

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateQuantity, updateObservations, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCartContext must be used within CartProvider')
  return ctx
}
