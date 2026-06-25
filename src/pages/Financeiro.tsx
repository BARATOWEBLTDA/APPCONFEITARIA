// Financeiro V1 — resumo + entradas (pedidos pagos + avulsas) + saídas + gráfico
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import {
  CurrencyDollar, TrendUp, TrendDown, Wallet, ChartBar, Receipt, Plus,
  CaretLeft, CaretRight, X, ShoppingCartSimple, PencilSimple, Trash,
  CalendarBlank, Tag, Target, DownloadSimple, FileCsv, FilePdf, Sparkle, Package, Warning
} from "@phosphor-icons/react"

type Movimentacao = {
  id: string
  origem: "pedido" | "manual"
  tipo: "entrada" | "saida"
  data: string          // YYYY-MM-DD
  valor: number
  descricao: string
  categoria?: string
  pedido_numero?: number
  cliente_nome?: string
  cmv?: number          // custo da mercadoria vendida
  margem?: number       // % de margem
  semFicha?: boolean    // pedido tem produtos sem ficha técnica
}

const CATEGORIAS_SAIDA = [
  "Insumos", "Embalagens", "Marketing", "Aluguel/Contas",
  "Pró-labore", "Equipamentos", "Impostos/Taxas", "Outros"
]
const CATEGORIAS_ENTRADA_AVULSA = ["Venda fora do app", "Aulas/Encomenda especial", "Outros"]

const fmtMoney = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const fmtData = (iso: string) => {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y.slice(2)}`
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const monthLabel = (d: Date) =>
  d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^./, c => c.toUpperCase())

export default function Financeiro() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(new Date()) // mês ancorado no primeiro dia
  const [tab, setTab] = useState<"entradas" | "saidas">("entradas")
  const [movsPedidos, setMovsPedidos] = useState<Movimentacao[]>([])
  const [movsManuais, setMovsManuais] = useState<Movimentacao[]>([])
  const [movsHistorico, setMovsHistorico] = useState<{ mes: string; entrada: number; saida: number }[]>([])

  // Modal de lançamento
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({
    tipo: "saida" as "entrada" | "saida",
    categoria: CATEGORIAS_SAIDA[0],
    descricao: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  // Meta mensal
  const [metaMensal, setMetaMensal] = useState<number | null>(null)
  const [showMetaForm, setShowMetaForm] = useState(false)
  const [metaInput, setMetaInput] = useState("")
  const [savingMeta, setSavingMeta] = useState(false)

  // Exportar
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data: prof } = await supabase.from("profiles").select("meta_mensal").eq("id", user.id).single()
      if (prof?.meta_mensal != null) setMetaMensal(Number(prof.meta_mensal))
    }
    init()
  }, [])

  useEffect(() => {
    if (!userId) return
    loadMonth(userId, mes)
    loadHistorico(userId)
  }, [userId, mes])

  const loadMonth = async (uid: string, m: Date) => {
    setLoading(true)
    const ini = new Date(m.getFullYear(), m.getMonth(), 1).toISOString().slice(0, 10)
    const fim = new Date(m.getFullYear(), m.getMonth() + 1, 0).toISOString().slice(0, 10)

    // 1) Pedidos PAGOS no mês (status_pagamento = 'pago' OU status = 'concluido')
    //    Buscamos junto os itens pra calcular CMV
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id, numero, cliente_nome, valor_total, data_entrega, status, status_pagamento, pedido_itens(nome_produto, quantidade, produtos(id))")
      .eq("user_id", uid)
      .gte("data_entrega", ini)
      .lte("data_entrega", fim)

    const pedidosPagosRaw = (pedidos || []).filter((p: any) =>
      (p.status_pagamento === "pago") ||
      (p.status === "concluido" && p.status_pagamento !== "estornado")
    )

    // 2) Pré-carrega ficha técnica de todos os produtos envolvidos
    const produtoIds = Array.from(new Set(
      pedidosPagosRaw.flatMap((p: any) =>
        (p.pedido_itens || []).map((it: any) => it.produtos?.id).filter(Boolean)
      )
    )) as string[]

    let fichaPorProduto: Record<string, number> = {} // produto_id -> custo unitário (CMV)
    if (produtoIds.length > 0) {
      const { data: fichas } = await supabase
        .from("produto_insumos")
        .select("produto_id, quantidade, insumos(custo_unitario)")
        .in("produto_id", produtoIds)

      ;(fichas || []).forEach((f: any) => {
        const custo = (Number(f.quantidade) || 0) * (Number(f.insumos?.custo_unitario) || 0)
        fichaPorProduto[f.produto_id] = (fichaPorProduto[f.produto_id] || 0) + custo
      })
    }

    const pedidosPagos: Movimentacao[] = pedidosPagosRaw.map((p: any) => {
      let cmv = 0
      let semFicha = false
      ;(p.pedido_itens || []).forEach((it: any) => {
        const prodId = it.produtos?.id
        if (!prodId) { semFicha = true; return }
        const custoUnit = fichaPorProduto[prodId]
        if (custoUnit == null || custoUnit === 0) { semFicha = true; return }
        cmv += custoUnit * (Number(it.quantidade) || 0)
      })
      const valor = Number(p.valor_total) || 0
      const margem = valor > 0 && cmv > 0 ? ((valor - cmv) / valor) * 100 : 0
      return {
        id: `pedido_${p.id}`,
        origem: "pedido",
        tipo: "entrada",
        data: p.data_entrega,
        valor,
        descricao: `Pedido #${p.numero} — ${p.cliente_nome || "Cliente"}`,
        pedido_numero: p.numero,
        cliente_nome: p.cliente_nome,
        cmv,
        margem,
        semFicha,
      }
    })

    // 2) Movimentações manuais no mês
    const { data: manuais } = await supabase
      .from("financeiro")
      .select("id, tipo, categoria, descricao, valor, data")
      .eq("user_id", uid)
      .gte("data", ini)
      .lte("data", fim)
      .order("data", { ascending: false })

    const manuaisMap: Movimentacao[] = (manuais || []).map((m: any) => ({
      id: m.id,
      origem: "manual",
      tipo: m.tipo,
      data: m.data,
      valor: Number(m.valor) || 0,
      descricao: m.descricao || "",
      categoria: m.categoria,
    }))

    setMovsPedidos(pedidosPagos)
    setMovsManuais(manuaisMap)
    setLoading(false)
  }

  const loadHistorico = async (uid: string) => {
    // Últimos 6 meses para o gráfico
    const hoje = new Date()
    const seisMesesAtras = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)
    const ini = seisMesesAtras.toISOString().slice(0, 10)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)

    const [{ data: pedidos }, { data: manuais }] = await Promise.all([
      supabase.from("pedidos")
        .select("valor_total, data_entrega, status, status_pagamento")
        .eq("user_id", uid)
        .gte("data_entrega", ini)
        .lte("data_entrega", fim),
      supabase.from("financeiro")
        .select("tipo, valor, data")
        .eq("user_id", uid)
        .gte("data", ini)
        .lte("data", fim),
    ])

    const buckets: Record<string, { entrada: number; saida: number }> = {}
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
      buckets[monthKey(d)] = { entrada: 0, saida: 0 }
    }

    ;(pedidos || []).forEach((p: any) => {
      if (!p.data_entrega) return
      const pago = p.status_pagamento === "pago" || (p.status === "concluido" && p.status_pagamento !== "estornado")
      if (!pago) return
      const k = p.data_entrega.slice(0, 7)
      if (buckets[k]) buckets[k].entrada += Number(p.valor_total) || 0
    })
    ;(manuais || []).forEach((m: any) => {
      const k = m.data.slice(0, 7)
      if (!buckets[k]) return
      if (m.tipo === "entrada") buckets[k].entrada += Number(m.valor) || 0
      else buckets[k].saida += Number(m.valor) || 0
    })

    setMovsHistorico(Object.entries(buckets).map(([mes, v]) => ({ mes, ...v })))
  }

  // ── Cálculos ────────────────────────────────────────────────
  const todasMovs = useMemo(() => [...movsPedidos, ...movsManuais], [movsPedidos, movsManuais])

  const entradas = useMemo(
    () => todasMovs.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0),
    [todasMovs]
  )
  const saidas = useMemo(
    () => todasMovs.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0),
    [todasMovs]
  )
  const lucro = entradas - saidas
  const cmvTotal = useMemo(
    () => movsPedidos.reduce((s, m) => s + (m.cmv || 0), 0),
    [movsPedidos]
  )
  const lucroReal = entradas - saidas - cmvTotal
  const ticketMedio = useMemo(() => {
    const ped = movsPedidos.length
    return ped > 0 ? movsPedidos.reduce((s, m) => s + m.valor, 0) / ped : 0
  }, [movsPedidos])

  const movsExibidas = useMemo(
    () => todasMovs.filter(m => m.tipo === (tab === "entradas" ? "entrada" : "saida"))
      .sort((a, b) => b.data.localeCompare(a.data)),
    [todasMovs, tab]
  )

  // ── Lançamento manual ──────────────────────────────────────
  const abrirNovo = (tipo: "entrada" | "saida") => {
    setEditando(null)
    setForm({
      tipo,
      categoria: tipo === "saida" ? CATEGORIAS_SAIDA[0] : CATEGORIAS_ENTRADA_AVULSA[0],
      descricao: "",
      valor: "",
      data: new Date().toISOString().slice(0, 10),
    })
    setShowForm(true)
  }

  const abrirEditar = (m: Movimentacao) => {
    if (m.origem !== "manual") return
    setEditando(m.id)
    setForm({
      tipo: m.tipo,
      categoria: m.categoria || (m.tipo === "saida" ? CATEGORIAS_SAIDA[0] : CATEGORIAS_ENTRADA_AVULSA[0]),
      descricao: m.descricao,
      valor: m.valor.toString(),
      data: m.data,
    })
    setShowForm(true)
  }

  const salvarForm = async () => {
    if (!userId) return
    if (!form.valor || parseFloat(form.valor.replace(",", ".")) <= 0) return alert("Informe um valor válido")
    if (!form.descricao.trim()) return alert("Informe uma descrição")
    setSaving(true)
    const payload = {
      user_id: userId,
      tipo: form.tipo,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor.replace(",", ".")),
      data: form.data,
    }
    if (editando) {
      await supabase.from("financeiro").update(payload).eq("id", editando)
    } else {
      await supabase.from("financeiro").insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    await loadMonth(userId, mes)
    await loadHistorico(userId)
  }

  const excluirMov = async (m: Movimentacao) => {
    if (m.origem !== "manual") return
    if (!confirm("Excluir este lançamento?")) return
    await supabase.from("financeiro").delete().eq("id", m.id)
    if (userId) { await loadMonth(userId, mes); await loadHistorico(userId) }
  }

  const navegarMes = (dir: -1 | 1) => {
    setMes(new Date(mes.getFullYear(), mes.getMonth() + dir, 1))
  }

  // ── Meta mensal ─────────────────────────────────────────────
  const abrirMeta = () => {
    setMetaInput(metaMensal != null ? metaMensal.toString().replace(".", ",") : "")
    setShowMetaForm(true)
  }
  const salvarMeta = async () => {
    if (!userId) return
    const v = metaInput.replace(/\./g, "").replace(",", ".")
    const valor = v.trim() === "" ? null : parseFloat(v)
    if (valor !== null && (isNaN(valor) || valor < 0)) return alert("Valor inválido")
    setSavingMeta(true)
    await supabase.from("profiles").update({ meta_mensal: valor }).eq("id", userId)
    setMetaMensal(valor)
    setSavingMeta(false)
    setShowMetaForm(false)
  }
  const removerMeta = async () => {
    if (!userId) return
    if (!confirm("Remover a meta mensal?")) return
    await supabase.from("profiles").update({ meta_mensal: null }).eq("id", userId)
    setMetaMensal(null)
    setShowMetaForm(false)
  }

  const metaProgresso = metaMensal && metaMensal > 0 ? Math.min(100, (entradas / metaMensal) * 100) : 0
  const metaFaltam = metaMensal ? Math.max(0, metaMensal - entradas) : 0
  const metaMsg = useMemo(() => {
    if (!metaMensal) return ""
    if (metaProgresso >= 100) return "🎉 Parabéns! Você bateu a meta deste mês!"
    if (metaProgresso >= 75) return "🔥 Quase lá! Você está muito perto da meta!"
    if (metaProgresso >= 50) return "💪 Você já passou da metade — continue assim!"
    if (metaProgresso >= 25) return "✨ Bom começo! Continue firme rumo à meta."
    return "🚀 Vamos juntas! Cada venda te aproxima da meta."
  }, [metaProgresso, metaMensal])

  // ── Exportar ────────────────────────────────────────────────
  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const exportarCSV = () => {
    const linhas = [
      `Relatório Financeiro — ${monthLabel(mes)}`,
      "",
      `Receita;${entradas.toFixed(2).replace(".", ",")}`,
      `Despesas;${saidas.toFixed(2).replace(".", ",")}`,
      `Lucro líquido;${lucro.toFixed(2).replace(".", ",")}`,
      `Ticket médio;${ticketMedio.toFixed(2).replace(".", ",")}`,
      ...(metaMensal ? [`Meta;${metaMensal.toFixed(2).replace(".", ",")}`, `Progresso da meta;${metaProgresso.toFixed(0)}%`] : []),
      "",
      "Data;Tipo;Categoria;Descrição;Valor;Origem",
      ...todasMovs
        .sort((a, b) => b.data.localeCompare(a.data))
        .map(m => [
          fmtData(m.data),
          m.tipo === "entrada" ? "Entrada" : "Saída",
          m.categoria || "",
          `"${m.descricao.replace(/"/g, '""')}"`,
          m.valor.toFixed(2).replace(".", ","),
          m.origem === "pedido" ? "Pedido (automático)" : "Manual",
        ].join(";")),
    ].join("\n")
    const bom = "\uFEFF" // BOM pra Excel reconhecer UTF-8
    downloadFile(bom + linhas, `financeiro_${monthKey(mes)}.csv`, "text/csv;charset=utf-8")
    setShowExport(false)
  }

  const exportarPDF = () => {
    const win = window.open("", "_blank")
    if (!win) { alert("Permita pop-ups para exportar PDF"); return }
    const linhasHTML = todasMovs
      .sort((a, b) => b.data.localeCompare(a.data))
      .map(m => `
        <tr>
          <td>${fmtData(m.data)}</td>
          <td><span class="tag tag-${m.tipo}">${m.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
          <td>${m.categoria || "—"}</td>
          <td>${m.descricao}</td>
          <td class="val ${m.tipo}">${m.tipo === "entrada" ? "+" : "−"} ${fmtMoney(m.valor)}</td>
        </tr>
      `).join("")

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Financeiro — ${monthLabel(mes)}</title>
<style>
  * { box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#1F2937; padding:32px; margin:0; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid #FF6FA9; padding-bottom:14px; margin-bottom:24px; }
  .header h1 { margin:0 0 4px; color:#FF6FA9; font-size:24px; }
  .header p { margin:0; color:#6B7280; font-size:13px; }
  .period { text-align:right; font-size:13px; color:#6B7280; }
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
  .card { border:1px solid #E5E7EB; border-radius: var(--radius-md); padding:14px; }
  .card .label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#6B7280; font-weight: var(--fw-semibold); margin:0 0 4px; }
  .card .value { font-size:18px; font-weight: var(--fw-black); margin:0; }
  .card.in .value { color:#16a34a; }
  .card.out .value { color:#dc2626; }
  .card.profit .value { color:${lucro >= 0 ? "#16a34a" : "#dc2626"}; }
  .meta-box { border:1px solid #E5E7EB; border-radius: var(--radius-md); padding:14px; margin-bottom:24px; background:#FFF1F7; }
  .meta-box .label { font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#FF6FA9; font-weight: var(--fw-bold); margin:0 0 4px; }
  .meta-bar { width:100%; height:14px; background:#fff; border-radius: var(--radius-full); overflow:hidden; margin-top:8px; }
  .meta-bar > div { height:100%; background:linear-gradient(90deg, #FF6FA9, #F85A9A); border-radius: var(--radius-full); }
  table { width:100%; border-collapse:collapse; font-size:12px; }
  thead th { text-align:left; padding:10px 8px; background:#F7F7F8; border-bottom:2px solid #E5E7EB; font-size:11px; text-transform:uppercase; color:#6B7280; letter-spacing:0.05em; }
  tbody td { padding:10px 8px; border-bottom:1px solid #F3F4F6; }
  .val { text-align:right; font-weight: var(--fw-bold); font-variant-numeric:tabular-nums; white-space:nowrap; }
  .val.entrada { color:#16a34a; }
  .val.saida { color:#dc2626; }
  .tag { padding:2px 8px; border-radius: var(--radius-full); font-size:10px; font-weight: var(--fw-bold); }
  .tag-entrada { background:#dcfce7; color:#15803d; }
  .tag-saida { background:#fee2e2; color:#b91c1c; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #E5E7EB; font-size:11px; color:#9CA3AF; text-align:center; }
  @media print {
    body { padding:18px; }
    .no-print { display:none; }
  }
  .print-btn { position:fixed; top:18px; right:18px; background:linear-gradient(135deg,#FF6FA9,#F85A9A); color:#fff; border:none; padding:10px 20px; border-radius: var(--radius-full); font-weight: var(--fw-bold); cursor:pointer; box-shadow:0 4px 14px rgba(255,111,169,0.4); font-family:inherit; }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <div class="header">
    <div>
      <h1>Relatório Financeiro</h1>
      <p>Doonly · Gestão da sua confeitaria</p>
    </div>
    <div class="period">
      <strong>${monthLabel(mes)}</strong><br>
      Gerado em ${new Date().toLocaleDateString("pt-BR")}
    </div>
  </div>

  <div class="cards">
    <div class="card in"><p class="label">Receita</p><p class="value">${fmtMoney(entradas)}</p></div>
    <div class="card out"><p class="label">Despesas</p><p class="value">${fmtMoney(saidas)}</p></div>
    <div class="card profit"><p class="label">Lucro líquido</p><p class="value">${fmtMoney(lucro)}</p></div>
    <div class="card"><p class="label">Ticket médio</p><p class="value">${fmtMoney(ticketMedio)}</p></div>
  </div>

  ${metaMensal ? `
  <div class="meta-box">
    <p class="label">Meta mensal</p>
    <strong>${fmtMoney(entradas)}</strong> de <strong>${fmtMoney(metaMensal)}</strong> · ${metaProgresso.toFixed(0)}%
    ${metaProgresso >= 100 ? " · 🎉 META BATIDA!" : ` · faltam ${fmtMoney(metaFaltam)}`}
    <div class="meta-bar"><div style="width:${metaProgresso}%"></div></div>
  </div>` : ""}

  <table>
    <thead>
      <tr>
        <th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th style="text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHTML || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#9CA3AF">Nenhuma movimentação neste mês</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    Relatório gerado por Doonly · ${todasMovs.length} movimentação(ões)
  </div>
</body>
</html>`
    win.document.write(html)
    win.document.close()
    setShowExport(false)
    // Dispara o print depois que renderiza
    setTimeout(() => { try { win.focus(); win.print(); } catch {} }, 300)
  }

  // ── Gráfico ─────────────────────────────────────────────────
  const maxBarra = Math.max(
    ...movsHistorico.flatMap(h => [h.entrada, h.saida]),
    1
  )

  return (
    <>
      <div className="fin-root">

        {/* Header */}
        <div className="fin-header">
          <div>
            <h1 className="fin-title">Financeiro</h1>
            <p className="fin-sub">Acompanhe receitas, despesas e lucro da sua confeitaria</p>
          </div>
          <div className="fin-header-actions">
            <div className="fin-export-wrap">
              <button className="fin-btn-export" onClick={() => setShowExport(v => !v)}>
                <DownloadSimple size={15} weight="bold" /> Exportar
              </button>
              {showExport && (
                <>
                  <div className="fin-export-backdrop" onClick={() => setShowExport(false)} />
                  <div className="fin-export-menu">
                    <button onClick={exportarCSV}>
                      <FileCsv size={18} weight="duotone" />
                      <div>
                        <p className="fin-export-title">Exportar CSV</p>
                        <p className="fin-export-sub">Para Excel ou Google Sheets</p>
                      </div>
                    </button>
                    <button onClick={exportarPDF}>
                      <FilePdf size={18} weight="duotone" />
                      <div>
                        <p className="fin-export-title">Exportar PDF</p>
                        <p className="fin-export-sub">Relatório completo para imprimir</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="fin-month-nav">
              <button onClick={() => navegarMes(-1)} aria-label="Mês anterior"><CaretLeft size={18} weight="bold" /></button>
              <span className="fin-month-label">{monthLabel(mes)}</span>
              <button onClick={() => navegarMes(1)} aria-label="Próximo mês"><CaretRight size={18} weight="bold" /></button>
            </div>
          </div>
        </div>

        {/* 4 cards de resumo */}
        <div className="fin-cards">
          <div className="fin-summary-card fin-card--receita">
            <div className="fin-card-icon"><TrendUp size={20} weight="bold" /></div>
            <div>
              <p className="fin-card-label">Receita</p>
              <p className="fin-card-value">{fmtMoney(entradas)}</p>
            </div>
          </div>

          <div className="fin-summary-card fin-card--despesa">
            <div className="fin-card-icon"><TrendDown size={20} weight="bold" /></div>
            <div>
              <p className="fin-card-label">Despesas</p>
              <p className="fin-card-value">{fmtMoney(saidas)}</p>
            </div>
          </div>

          <div className="fin-summary-card fin-card--cmv">
            <div className="fin-card-icon"><Package size={20} weight="bold" /></div>
            <div>
              <p className="fin-card-label">Custo (CMV)</p>
              <p className="fin-card-value">{fmtMoney(cmvTotal)}</p>
            </div>
          </div>

          <div className="fin-summary-card fin-card--lucro">
            <div className="fin-card-icon"><Wallet size={20} weight="bold" /></div>
            <div>
              <p className="fin-card-label">Lucro real</p>
              <p className="fin-card-value" style={{ color: lucroReal >= 0 ? "var(--success)" : "var(--error)" }}>
                {fmtMoney(lucroReal)}
              </p>
              {cmvTotal > 0 && (
                <p style={{ fontSize: "0.66rem", color: "var(--text-muted)", margin: "1px 0 0", fontWeight: 500 }}>
                  bruto: {fmtMoney(lucro)}
                </p>
              )}
            </div>
          </div>

          <div className="fin-summary-card fin-card--ticket">
            <div className="fin-card-icon"><CurrencyDollar size={20} weight="bold" /></div>
            <div>
              <p className="fin-card-label">Ticket médio</p>
              <p className="fin-card-value">{fmtMoney(ticketMedio)}</p>
            </div>
          </div>
        </div>

        {/* Card Meta Mensal */}
        {metaMensal ? (
          <div className="fin-meta-card">
            <div className="fin-meta-decor" />
            <div className="fin-meta-top">
              <div className="fin-meta-title">
                <div className="fin-meta-icon"><Target size={20} weight="duotone" /></div>
                <div>
                  <p className="fin-meta-label">Meta mensal</p>
                  <p className="fin-meta-msg">{metaMsg}</p>
                </div>
              </div>
              <button className="fin-meta-edit" onClick={abrirMeta}>
                <PencilSimple size={13} weight="bold" /> Editar
              </button>
            </div>

            <div className="fin-meta-values">
              <span className="fin-meta-current">{fmtMoney(entradas)}</span>
              <span className="fin-meta-sep">de</span>
              <span className="fin-meta-target">{fmtMoney(metaMensal)}</span>
              <span className="fin-meta-pct">{metaProgresso.toFixed(0)}%</span>
            </div>

            <div className="fin-thermo">
              <div className="fin-thermo-fill" style={{ width: `${metaProgresso}%` }}>
                {metaProgresso >= 100 && <Sparkle size={12} weight="fill" className="fin-thermo-spark" />}
              </div>
            </div>

            {metaProgresso < 100 && (
              <p className="fin-meta-faltam">Faltam <strong>{fmtMoney(metaFaltam)}</strong> pra bater a meta</p>
            )}
          </div>
        ) : (
          <button className="fin-meta-empty" onClick={abrirMeta}>
            <div className="fin-meta-empty-icon"><Target size={22} weight="duotone" /></div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <p className="fin-meta-empty-title">Defina sua meta mensal</p>
              <p className="fin-meta-empty-sub">Acompanhe seu progresso com um termômetro motivacional</p>
            </div>
            <span className="fin-meta-empty-cta">+ Definir meta</span>
          </button>
        )}

        {/* Gráfico de 6 meses */}
        <div className="fin-card">
          <div className="fin-section-header">
            <div className="fin-section-icon"><ChartBar size={18} weight="duotone" /></div>
            <div>
              <p className="fin-section-label">Fluxo de caixa</p>
              <p className="fin-section-sub">Últimos 6 meses</p>
            </div>
            <div className="fin-legend">
              <span><i className="fin-dot fin-dot--in" /> Receita</span>
              <span><i className="fin-dot fin-dot--out" /> Despesa</span>
            </div>
          </div>

          <div className="fin-chart">
            {movsHistorico.map(h => {
              const [y, m] = h.mes.split("-")
              const label = new Date(parseInt(y), parseInt(m) - 1, 1)
                .toLocaleDateString("pt-BR", { month: "short" })
                .replace(".", "")
              const hIn = Math.max(4, (h.entrada / maxBarra) * 100)
              const hOut = Math.max(4, (h.saida / maxBarra) * 100)
              const lucroMes = h.entrada - h.saida
              return (
                <div key={h.mes} className="fin-bar-group">
                  <div className="fin-bars" title={`${label}: receita ${fmtMoney(h.entrada)} · despesa ${fmtMoney(h.saida)}`}>
                    <div className="fin-bar fin-bar--in" style={{ height: `${hIn}%` }} />
                    <div className="fin-bar fin-bar--out" style={{ height: `${hOut}%` }} />
                  </div>
                  <p className="fin-bar-label">{label}</p>
                  <p className="fin-bar-sub" style={{ color: lucroMes >= 0 ? "var(--success)" : "var(--error)" }}>
                    {lucroMes >= 0 ? "+" : ""}{fmtMoney(lucroMes).replace("R$", "").trim()}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Lançamentos */}
        <div className="fin-card">
          <div className="fin-section-header">
            <div className="fin-section-icon"><Receipt size={18} weight="duotone" /></div>
            <div style={{ flex: 1 }}>
              <p className="fin-section-label">Lançamentos do mês</p>
              <p className="fin-section-sub">Entradas vêm automáticas dos pedidos pagos</p>
            </div>
            <button className="fin-btn-add" onClick={() => abrirNovo(tab === "entradas" ? "entrada" : "saida")}>
              <Plus size={13} weight="bold" />
              {tab === "entradas" ? "Entrada avulsa" : "Despesa"}
            </button>
          </div>

          <div className="fin-tabs">
            <button className={`fin-tab${tab === "entradas" ? " fin-tab--active" : ""}`} onClick={() => setTab("entradas")}>
              <TrendUp size={14} weight="bold" /> Entradas
              <span className="fin-tab-pill">{fmtMoney(entradas).replace("R$", "").trim()}</span>
            </button>
            <button className={`fin-tab${tab === "saidas" ? " fin-tab--active" : ""}`} onClick={() => setTab("saidas")}>
              <TrendDown size={14} weight="bold" /> Saídas
              <span className="fin-tab-pill">{fmtMoney(saidas).replace("R$", "").trim()}</span>
            </button>
          </div>

          {loading ? (
            <div className="fin-loading"><span className="fin-spinner" /></div>
          ) : movsExibidas.length === 0 ? (
            <div className="fin-empty">
              <div className="fin-empty-icon">
                {tab === "entradas" ? <TrendUp size={26} weight="duotone" /> : <TrendDown size={26} weight="duotone" />}
              </div>
              <p className="fin-empty-text">
                {tab === "entradas"
                  ? "Nenhuma entrada neste mês. Marque pedidos como pagos ou adicione uma entrada avulsa."
                  : "Nenhuma despesa neste mês. Toque em + Despesa para registrar."}
              </p>
            </div>
          ) : (
            <div className="fin-list">
              {movsExibidas.map(m => (
                <div key={m.id} className={`fin-item fin-item--${m.tipo}`}>
                  <div className="fin-item-icon">
                    {m.origem === "pedido"
                      ? <ShoppingCartSimple size={16} weight="duotone" />
                      : (m.tipo === "entrada" ? <TrendUp size={16} weight="duotone" /> : <TrendDown size={16} weight="duotone" />)}
                  </div>
                  <div className="fin-item-info">
                    <p className="fin-item-desc">{m.descricao}</p>
                    <div className="fin-item-meta">
                      <span className="fin-item-tag"><CalendarBlank size={10} weight="bold" /> {fmtData(m.data)}</span>
                      {m.categoria && <span className="fin-item-tag"><Tag size={10} weight="bold" /> {m.categoria}</span>}
                      {m.origem === "pedido" && <span className="fin-item-tag fin-item-tag--auto">automático</span>}
                      {m.origem === "pedido" && m.cmv !== undefined && m.cmv > 0 && m.margem !== undefined && (
                        <span className={`fin-item-tag fin-item-tag--margem fin-item-tag--margem-${m.margem >= 50 ? "alto" : m.margem >= 25 ? "medio" : "baixo"}`}>
                          margem {m.margem.toFixed(0)}%
                        </span>
                      )}
                      {m.origem === "pedido" && m.semFicha && (
                        <span className="fin-item-tag fin-item-tag--alerta">
                          <Warning size={10} weight="bold" /> ficha incompleta
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="fin-item-valor">{fmtMoney(m.valor)}</p>
                  {m.origem === "manual" && (
                    <div className="fin-item-actions">
                      <button onClick={() => abrirEditar(m)} aria-label="Editar"><PencilSimple size={14} weight="bold" /></button>
                      <button onClick={() => excluirMov(m)} aria-label="Excluir" className="fin-item-del"><Trash size={14} weight="bold" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal de definir/editar meta */}
      {showMetaForm && (
        <div className="fin-modal-overlay" onClick={() => setShowMetaForm(false)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="fin-modal-header">
              <h3>{metaMensal ? "Editar meta mensal" : "Definir meta mensal"}</h3>
              <button onClick={() => setShowMetaForm(false)}><X size={18} weight="bold" /></button>
            </div>

            <div className="fin-modal-body">
              <div className="fin-meta-help">
                <Target size={26} weight="duotone" />
                <p>Quanto você quer faturar todo mês? Vamos te lembrar do progresso aqui no Financeiro.</p>
              </div>

              <div className="fin-form-field">
                <label>Meta de faturamento</label>
                <div className="fin-money-row">
                  <span className="fin-prefix">R$</span>
                  <input
                    className="fin-input"
                    style={{ textAlign: "right", fontSize: "1.1rem", fontWeight: 700 }}
                    value={metaInput}
                    onChange={e => setMetaInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                    placeholder="5.000,00"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="fin-modal-footer">
              {metaMensal && (
                <button className="fin-btn-cancel" onClick={removerMeta} style={{ color: "var(--error)", borderColor: "#fee2e2" }}>
                  Remover
                </button>
              )}
              <button className="fin-btn-cancel" onClick={() => setShowMetaForm(false)}>Cancelar</button>
              <button className="fin-btn-save" onClick={salvarMeta} disabled={savingMeta}>
                {savingMeta ? "Salvando..." : "Salvar meta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de lançamento */}
      {showForm && (
        <div className="fin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="fin-modal" onClick={e => e.stopPropagation()}>
            <div className="fin-modal-header">
              <h3>{editando ? "Editar lançamento" : (form.tipo === "entrada" ? "Nova entrada avulsa" : "Nova despesa")}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} weight="bold" /></button>
            </div>

            <div className="fin-modal-body">
              <div className="fin-form-field">
                <label>Descrição *</label>
                <input
                  className="fin-input"
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder={form.tipo === "saida" ? "Ex: 2kg de farinha" : "Ex: Encomenda PIX direto"}
                  autoFocus
                />
              </div>

              <div className="fin-form-row">
                <div className="fin-form-field" style={{ flex: 1 }}>
                  <label>Categoria</label>
                  <select
                    className="fin-input"
                    value={form.categoria}
                    onChange={e => setForm({ ...form, categoria: e.target.value })}
                  >
                    {(form.tipo === "saida" ? CATEGORIAS_SAIDA : CATEGORIAS_ENTRADA_AVULSA).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="fin-form-field" style={{ flex: 1 }}>
                  <label>Valor *</label>
                  <div className="fin-money-row">
                    <span className="fin-prefix">R$</span>
                    <input
                      className="fin-input"
                      style={{ textAlign: "right" }}
                      value={form.valor}
                      onChange={e => setForm({ ...form, valor: e.target.value.replace(/[^0-9.,]/g, "") })}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              <div className="fin-form-field">
                <label>Data</label>
                <input
                  type="date"
                  className="fin-input"
                  value={form.data}
                  onChange={e => setForm({ ...form, data: e.target.value })}
                />
              </div>
            </div>

            <div className="fin-modal-footer">
              <button className="fin-btn-cancel" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="fin-btn-save" onClick={salvarForm} disabled={saving}>
                {saving ? "Salvando..." : (editando ? "Salvar alterações" : "Criar lançamento")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes finspin { to { transform:rotate(360deg); } }
        @keyframes finFadeIn { from{opacity:0; transform:translateY(-4px)} to{opacity:1; transform:translateY(0)} }

        .fin-root { font-family:'Geist', sans-serif; display:flex; flex-direction:column; gap:1.25rem; max-width:1400px; width:100%; box-sizing:border-box; }

        /* Header */
        .fin-header { display:flex; align-items:flex-end; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; }
        .fin-title { font-size: var(--font-page-title); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 0.3rem; letter-spacing:-0.02em; }
        .fin-sub { font-size: var(--font-button); color:var(--text-secondary); margin:0; }

        .fin-month-nav {
          display:flex; align-items:center; gap:0.5rem;
          background:var(--bg-card); border:1px solid var(--border);
          border-radius: var(--radius-full); padding:4px 6px;
        }
        .fin-month-nav button {
          width:32px; height:32px; border-radius:50%;
          background:transparent; border:none; cursor:pointer;
          display:flex; align-items:center; justify-content:center;
          color:var(--text-secondary); transition:all 0.15s;
        }
        .fin-month-nav button:hover { background:var(--primary-light); color:var(--primary); }
        .fin-month-label { font-size: var(--font-button); font-weight: var(--fw-bold); color:var(--text-title); padding:0 0.5rem; min-width:140px; text-align:center; }

        /* Cards de resumo */
        .fin-cards {
          display:grid; gap:0.85rem;
          grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
        }
        .fin-summary-card {
          background:var(--bg-card);
          border:1px solid var(--border);
          border-radius: var(--radius-lg); padding:1.1rem 1.25rem;
          display:flex; align-items:center; gap:0.9rem;
          position:relative; overflow:hidden;
          transition:transform 0.18s, box-shadow 0.18s, border-color 0.18s;
        }
        .fin-summary-card::before {
          content:""; position:absolute; top:-40px; right:-40px;
          width:100px; height:100px; border-radius:50%;
          opacity:0.5; pointer-events:none;
        }
        .fin-card--receita::before { background:radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%); }
        .fin-card--despesa::before { background:radial-gradient(circle, rgba(239,68,68,0.18), transparent 70%); }
        .fin-card--cmv::before     { background:radial-gradient(circle, rgba(245,158,11,0.18), transparent 70%); }
        .fin-card--lucro::before   { background:radial-gradient(circle, rgba(255,111,169,0.22), transparent 70%); }
        .fin-card--ticket::before  { background:radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%); }

        .fin-summary-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(16,24,40,0.06); }

        .fin-card-icon {
          width:42px; height:42px; flex-shrink:0; border-radius: var(--radius-md);
          display:flex; align-items:center; justify-content:center;
          color:#fff; position:relative; z-index:1;
        }
        .fin-card--receita .fin-card-icon { background:linear-gradient(135deg,#22c55e,#16a34a); box-shadow:0 4px 12px rgba(34,197,94,0.3); }
        .fin-card--despesa .fin-card-icon { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 4px 12px rgba(239,68,68,0.3); }
        .fin-card--cmv .fin-card-icon     { background:linear-gradient(135deg,#f59e0b,#d97706); box-shadow:0 4px 12px rgba(245,158,11,0.3); }
        .fin-card--lucro .fin-card-icon   { background:linear-gradient(135deg,#FF6FA9,#F85A9A); box-shadow:0 4px 12px rgba(255,111,169,0.35); }
        .fin-card--ticket .fin-card-icon  { background:linear-gradient(135deg,#6366f1,#4f46e5); box-shadow:0 4px 12px rgba(99,102,241,0.3); }

        .fin-card-label { font-size: var(--font-helper); font-weight: var(--fw-semibold); color:var(--text-secondary); margin:0 0 2px; text-transform:uppercase; letter-spacing:0.06em; }
        .fin-card-value { font-size: var(--font-modal-title); font-weight: var(--fw-black); color:var(--text-title); margin:0; letter-spacing:-0.02em; }

        /* Card base */
        .fin-card {
          background:var(--bg-card); border-radius: var(--radius-xl); padding:1.4rem;
          box-shadow:var(--shadow-card, 0 2px 12px rgba(0,0,0,0.05));
          border:1px solid var(--border);
          display:flex; flex-direction:column; gap:0.95rem;
          position:relative; overflow:hidden;
        }
        .fin-card::before {
          content:""; position:absolute; top:-60px; right:-60px;
          width:140px; height:140px;
          background:radial-gradient(circle, var(--primary-light) 0%, transparent 70%);
          pointer-events:none; opacity:0.55;
        }
        .fin-card > * { position:relative; z-index:1; }

        /* Section header */
        .fin-section-header {
          display:flex; align-items:center; gap:0.7rem; flex-wrap:wrap;
          padding-bottom:1rem; border-bottom:1px solid var(--border);
        }
        .fin-section-icon {
          width:36px; height:36px; flex-shrink:0; border-radius: var(--radius-md);
          background:var(--primary-light); color:var(--primary);
          display:flex; align-items:center; justify-content:center;
        }
        .fin-section-label { font-size: var(--font-input); font-weight: var(--fw-bold); color:var(--text-title); margin:0; letter-spacing:-0.01em; }
        .fin-section-sub { font-size: var(--font-helper); color:var(--text-muted); margin:0.1rem 0 0; line-height:1.3; }

        .fin-legend { display:flex; gap:0.85rem; margin-left:auto; font-size: var(--font-helper); color:var(--text-secondary); font-weight: var(--fw-semibold); }
        .fin-legend span { display:inline-flex; align-items:center; gap:5px; }
        .fin-dot { width:10px; height:10px; border-radius:3px; display:inline-block; }
        .fin-dot--in { background:linear-gradient(180deg,#22c55e,#16a34a); }
        .fin-dot--out { background:linear-gradient(180deg,#ef4444,#dc2626); }

        /* Gráfico */
        .fin-chart {
          display:flex; align-items:flex-end; gap:0.85rem;
          height:200px; padding:0.5rem 0.25rem 0;
        }
        .fin-bar-group { flex:1; display:flex; flex-direction:column; align-items:center; gap:0.4rem; min-width:0; }
        .fin-bars {
          display:flex; gap:4px; align-items:flex-end;
          width:100%; height:140px;
        }
        .fin-bar {
          flex:1; border-radius: var(--radius-sm) 6px 0 0; min-height:4px;
          transition:height 0.4s cubic-bezier(.32,.72,.32,1);
        }
        .fin-bar--in { background:linear-gradient(180deg,#22c55e,#16a34a); box-shadow:0 2px 6px rgba(34,197,94,0.25); }
        .fin-bar--out { background:linear-gradient(180deg,#ef4444,#dc2626); box-shadow:0 2px 6px rgba(239,68,68,0.25); }
        .fin-bar-label {
          font-size: var(--font-caption); font-weight: var(--fw-bold);
          color:var(--text-secondary); margin:0;
          text-transform:capitalize;
        }
        .fin-bar-sub { font-size: var(--font-caption); font-weight: var(--fw-bold); margin:0; }

        /* Botão + */
        .fin-btn-add {
          display:inline-flex; align-items:center; gap:5px;
          padding:0.5rem 1rem;
          background:var(--primary-gradient);
          color:#fff; border:none; border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-bold);
          cursor:pointer; white-space:nowrap;
          box-shadow:0 2px 8px rgba(255,111,169,0.3);
          transition:transform 0.15s, box-shadow 0.15s;
        }
        .fin-btn-add:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(255,111,169,0.4); }

        /* Tabs */
        .fin-tabs {
          display:flex; gap:4px; padding:4px;
          background:var(--bg-body); border-radius: var(--radius-lg);
          border:1px solid var(--border);
        }
        .fin-tab {
          flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px;
          padding:0.55rem 0.85rem; border:none; background:transparent;
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-semibold);
          color:var(--text-secondary); cursor:pointer; border-radius: var(--radius-md);
          transition:all 0.2s;
        }
        .fin-tab:hover { color:var(--primary); }
        .fin-tab--active {
          background:var(--bg-card); color:var(--primary);
          box-shadow:0 1px 4px rgba(0,0,0,0.08); font-weight: var(--fw-bold);
        }
        .fin-tab-pill {
          margin-left:auto; padding:2px 8px; border-radius: var(--radius-full);
          background:var(--bg-body); color:var(--text-secondary);
          font-size: var(--font-caption); font-weight: var(--fw-bold);
        }
        .fin-tab--active .fin-tab-pill { background:var(--primary-light); color:var(--primary); }

        /* Lista */
        .fin-list { display:flex; flex-direction:column; gap:0.5rem; }
        .fin-item {
          display:flex; align-items:center; gap:0.85rem;
          padding:0.85rem 1rem;
          background:var(--bg-card);
          border:1px solid var(--border);
          border-radius: var(--radius-lg); transition:all 0.18s;
          position:relative; overflow:hidden;
        }
        .fin-item::before {
          content:""; position:absolute; left:0; top:0; bottom:0; width:4px;
        }
        .fin-item--entrada::before { background:linear-gradient(180deg,#22c55e,#16a34a); }
        .fin-item--saida::before { background:linear-gradient(180deg,#ef4444,#dc2626); }
        .fin-item:hover { border-color:rgba(255,111,169,0.3); box-shadow:0 2px 10px rgba(16,24,40,0.04); }

        .fin-item-icon {
          width:36px; height:36px; flex-shrink:0; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          margin-left:0.35rem;
        }
        .fin-item--entrada .fin-item-icon { background:#f0fdf4; color:#16a34a; }
        .fin-item--saida .fin-item-icon { background:#fef2f2; color:#dc2626; }

        .fin-item-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:0.3rem; }
        .fin-item-desc {
          font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-title);
          margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .fin-item-meta { display:flex; flex-wrap:wrap; gap:5px; }
        .fin-item-tag {
          display:inline-flex; align-items:center; gap:3px;
          font-size: var(--font-caption); padding:2px 7px; border-radius: var(--radius-full);
          background:var(--bg-body); color:var(--text-secondary);
          border:1px solid var(--border); font-weight: var(--fw-semibold);
        }
        .fin-item-tag--auto {
          background:var(--primary-light);
          color:var(--primary-dark);
          border-color:rgba(255,111,169,0.3);
        }
        .fin-item-tag--margem { font-weight: var(--fw-bold); }
        .fin-item-tag--margem-alto { background:#dcfce7; color:#15803d; border-color:#bbf7d0; }
        .fin-item-tag--margem-medio { background:#fef3c7; color:#a16207; border-color:#fde68a; }
        .fin-item-tag--margem-baixo { background:#fee2e2; color:#b91c1c; border-color:#fecaca; }
        .fin-item-tag--alerta { background:#fef3c7; color:#92400e; border-color:#fde68a; font-weight: var(--fw-semibold); }
        .fin-item-valor {
          font-size: var(--font-input); font-weight: var(--fw-black); margin:0; white-space:nowrap;
          font-variant-numeric:tabular-nums;
        }
        .fin-item--entrada .fin-item-valor { color:#16a34a; }
        .fin-item--saida .fin-item-valor { color:#dc2626; }

        .fin-item-actions { display:flex; gap:4px; }
        .fin-item-actions button {
          width:30px; height:30px; border-radius: var(--radius-sm);
          background:var(--bg-body); border:1px solid var(--border);
          color:var(--text-secondary); cursor:pointer;
          display:flex; align-items:center; justify-content:center; transition:all 0.15s;
        }
        .fin-item-actions button:hover { background:var(--primary-light); border-color:var(--primary); color:var(--primary); }
        .fin-item-actions .fin-item-del:hover { background:#fee2e2; border-color:#fca5a5; color:var(--error); }

        /* Empty */
        .fin-empty {
          display:flex; flex-direction:column; align-items:center; gap:0.65rem;
          padding:2rem 1rem; text-align:center;
          background:var(--bg-body); border-radius: var(--radius-lg);
          border:1.5px dashed var(--border);
        }
        .fin-empty-icon {
          width:50px; height:50px; border-radius:50%;
          background:var(--primary-light); color:var(--primary);
          display:flex; align-items:center; justify-content:center;
        }
        .fin-empty-text { font-size: var(--font-helper); color:var(--text-secondary); margin:0; max-width:340px; line-height:1.45; }

        /* Loading */
        .fin-loading { display:flex; justify-content:center; padding:2rem; }
        .fin-spinner {
          width:28px; height:28px;
          border:3px solid var(--primary-light); border-top-color:var(--primary);
          border-radius:50%; animation:finspin 0.7s linear infinite;
        }

        /* ── Modal ── */
        .fin-modal-overlay {
          position:fixed; inset:0; background:rgba(15,23,42,0.5);
          display:flex; align-items:center; justify-content:center;
          z-index:9999; padding:1rem; animation:finFadeIn 0.2s ease;
        }
        .fin-modal {
          background:var(--bg-card); border-radius: var(--radius-xl);
          width:100%; max-width:480px;
          display:flex; flex-direction:column;
          box-shadow:0 20px 60px rgba(0,0,0,0.25);
          max-height:90vh;
        }
        .fin-modal-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:1.1rem 1.4rem; border-bottom:1px solid var(--border);
        }
        .fin-modal-header h3 {
          font-size: var(--font-modal-title); font-weight: var(--fw-bold); color:var(--text-title);
          margin:0; letter-spacing:-0.01em;
        }
        .fin-modal-header button {
          width:32px; height:32px; border-radius:50%;
          background:var(--bg-body); border:none; cursor:pointer;
          color:var(--text-secondary);
          display:flex; align-items:center; justify-content:center; transition:all 0.15s;
        }
        .fin-modal-header button:hover { background:var(--primary-light); color:var(--primary); }

        .fin-modal-body { padding:1.25rem 1.4rem; display:flex; flex-direction:column; gap:0.9rem; overflow-y:auto; }
        .fin-form-field { display:flex; flex-direction:column; gap:0.35rem; }
        .fin-form-field label { font-size: var(--font-helper); font-weight: var(--fw-bold); color:var(--text-primary); margin:0; }
        .fin-form-row { display:flex; gap:0.6rem; }
        @media (max-width:520px) { .fin-form-row { flex-direction:column; } }

        .fin-input {
          width:100%; padding:0.7rem 0.95rem;
          border:1.5px solid var(--border); border-radius: var(--radius-md);
          font-family:'Geist', sans-serif; font-size: var(--font-button);
          color:var(--text-title); outline:none;
          box-sizing:border-box; background:var(--bg-input);
          transition:border-color 0.15s, box-shadow 0.15s;
        }
        .fin-input:hover { border-color:var(--text-muted); }
        .fin-input:focus { border-color:var(--primary); box-shadow:0 0 0 3px rgba(255,111,169,0.12); }

        .fin-money-row { display:flex; align-items:center; gap:0.4rem; }
        .fin-prefix { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-secondary); flex-shrink:0; }

        .fin-modal-footer {
          display:flex; gap:0.5rem; padding:1rem 1.4rem;
          border-top:1px solid var(--border);
          background:var(--bg-body);
          border-radius:0 0 20px 20px;
        }
        .fin-btn-cancel {
          flex:1; padding:0.7rem 1rem;
          background:var(--bg-card);
          border:1.5px solid var(--border);
          border-radius: var(--radius-full); font-family:inherit;
          font-size: var(--font-button); font-weight: var(--fw-semibold);
          color:var(--text-secondary); cursor:pointer;
          transition:all 0.15s;
        }
        .fin-btn-cancel:hover { border-color:var(--text-muted); }
        .fin-btn-save {
          flex:2; padding:0.7rem 1rem;
          background:var(--primary-gradient);
          color:#fff; border:none; border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-button); font-weight: var(--fw-bold);
          cursor:pointer; box-shadow:0 3px 10px rgba(255,111,169,0.3);
          transition:transform 0.15s, box-shadow 0.15s;
        }
        .fin-btn-save:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 16px rgba(255,111,169,0.4); }
        .fin-btn-save:disabled { opacity:0.6; cursor:wait; }

        /* ── Header actions ── */
        .fin-header-actions { display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap; }

        /* ── Botão Exportar ── */
        .fin-export-wrap { position:relative; }
        .fin-btn-export {
          display:inline-flex; align-items:center; gap:6px;
          padding:0.55rem 1rem;
          background:var(--bg-card);
          border:1.5px solid var(--border);
          border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-helper); font-weight: var(--fw-bold);
          color:var(--text-primary); cursor:pointer;
          transition:all 0.15s;
        }
        .fin-btn-export:hover {
          border-color:var(--primary);
          color:var(--primary);
          background:var(--primary-light);
        }
        .fin-export-backdrop { position:fixed; inset:0; z-index:50; }
        .fin-export-menu {
          position:absolute; top:calc(100% + 6px); right:0; z-index:51;
          background:var(--bg-card);
          border:1px solid var(--border);
          border-radius: var(--radius-lg); padding:6px;
          min-width:240px;
          box-shadow:0 12px 32px rgba(16,24,40,0.12);
          animation:finFadeIn 0.18s ease;
          display:flex; flex-direction:column; gap:2px;
        }
        .fin-export-menu button {
          display:flex; align-items:center; gap:0.7rem;
          padding:0.7rem 0.85rem; background:transparent; border:none;
          border-radius: var(--radius-md); cursor:pointer; text-align:left;
          color:var(--text-primary); transition:background 0.15s;
          font-family:inherit;
        }
        .fin-export-menu button:hover { background:var(--primary-light); color:var(--primary); }
        .fin-export-title { font-size: var(--font-button); font-weight: var(--fw-bold); margin:0; }
        .fin-export-sub { font-size: var(--font-caption); color:var(--text-muted); margin:1px 0 0; }

        /* ── Meta card (com meta definida) ── */
        .fin-meta-card {
          background:linear-gradient(135deg, #FFE4F0 0%, #FFF1F7 100%);
          border:1px solid rgba(255,111,169,0.25);
          border-radius: var(--radius-xl); padding:1.4rem;
          position:relative; overflow:hidden;
          display:flex; flex-direction:column; gap:0.85rem;
        }
        .fin-meta-decor {
          position:absolute; top:-80px; right:-80px;
          width:240px; height:240px; border-radius:50%;
          background:radial-gradient(circle, rgba(255,111,169,0.18) 0%, transparent 70%);
          pointer-events:none;
        }
        .fin-meta-top { display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; position:relative; z-index:1; }
        .fin-meta-title { display:flex; gap:0.7rem; align-items:flex-start; flex:1; min-width:0; }
        .fin-meta-icon {
          width:42px; height:42px; flex-shrink:0; border-radius: var(--radius-md);
          background:var(--primary-gradient);
          color:#fff; display:flex; align-items:center; justify-content:center;
          box-shadow:0 4px 12px rgba(255,111,169,0.35);
        }
        .fin-meta-label {
          font-size: var(--font-caption); font-weight: var(--fw-bold); color:var(--primary-dark);
          margin:0 0 2px; text-transform:uppercase; letter-spacing:0.08em;
        }
        .fin-meta-msg { font-size: var(--font-button); font-weight: var(--fw-semibold); color:var(--text-title); margin:0; line-height:1.3; }

        .fin-meta-edit {
          display:inline-flex; align-items:center; gap:4px;
          padding:5px 12px; background:rgba(255,255,255,0.7);
          border:1px solid rgba(255,111,169,0.3); border-radius: var(--radius-full);
          font-family:inherit; font-size: var(--font-caption); font-weight: var(--fw-bold);
          color:var(--primary); cursor:pointer;
          transition:background 0.15s;
        }
        .fin-meta-edit:hover { background:#fff; }

        .fin-meta-values {
          display:flex; align-items:baseline; gap:0.5rem; flex-wrap:wrap;
          position:relative; z-index:1;
        }
        .fin-meta-current {
          font-size: var(--text-2xl); font-weight: var(--fw-black);
          color:var(--primary-dark);
          letter-spacing:-0.02em;
          font-variant-numeric:tabular-nums;
        }
        .fin-meta-sep { font-size: var(--font-button); color:var(--text-secondary); font-weight: var(--fw-medium); }
        .fin-meta-target {
          font-size: var(--font-modal-title); font-weight: var(--fw-bold);
          color:var(--text-primary);
          font-variant-numeric:tabular-nums;
        }
        .fin-meta-pct {
          margin-left:auto; padding:4px 11px;
          background:#fff; border-radius: var(--radius-full);
          font-size: var(--font-button); font-weight: var(--fw-black);
          color:var(--primary);
          box-shadow:0 2px 6px rgba(255,111,169,0.18);
        }

        /* Termômetro */
        .fin-thermo {
          position:relative; z-index:1;
          width:100%; height:16px;
          background:rgba(255,255,255,0.7);
          border-radius: var(--radius-full); overflow:hidden;
          box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);
        }
        .fin-thermo-fill {
          height:100%;
          background:var(--primary-gradient);
          border-radius: var(--radius-full);
          transition:width 0.6s cubic-bezier(.32,.72,.32,1);
          display:flex; align-items:center; justify-content:flex-end;
          padding-right:6px; color:#fff;
          box-shadow:0 2px 8px rgba(255,111,169,0.35);
          position:relative;
          background-size:200% 100%;
          animation:thermoShine 3s linear infinite;
        }
        .fin-thermo-spark { animation:sparkPulse 1.4s ease-in-out infinite; }
        @keyframes thermoShine { 0%{background-position:200% 0} 100%{background-position:0 0} }
        @keyframes sparkPulse { 0%,100%{transform:scale(1); opacity:0.85} 50%{transform:scale(1.3); opacity:1} }

        .fin-meta-faltam {
          font-size: var(--font-helper); color:var(--text-secondary);
          margin:0; position:relative; z-index:1;
        }
        .fin-meta-faltam strong { color:var(--primary-dark); font-weight: var(--fw-bold); }

        /* ── Meta empty (sem meta definida) ── */
        .fin-meta-empty {
          display:flex; align-items:center; gap:0.85rem; padding:1.1rem 1.4rem;
          background:var(--bg-card);
          border:1.5px dashed rgba(255,111,169,0.4);
          border-radius: var(--radius-xl); cursor:pointer;
          font-family:inherit; transition:all 0.18s; width:100%;
          color:inherit;
        }
        .fin-meta-empty:hover {
          background:var(--primary-light);
          border-color:var(--primary);
          transform:translateY(-1px);
        }
        .fin-meta-empty-icon {
          width:44px; height:44px; flex-shrink:0; border-radius:50%;
          background:var(--primary-light); color:var(--primary);
          display:flex; align-items:center; justify-content:center;
        }
        .fin-meta-empty-title { font-size: var(--font-input); font-weight: var(--fw-bold); color:var(--text-title); margin:0 0 2px; }
        .fin-meta-empty-sub { font-size: var(--font-helper); color:var(--text-secondary); margin:0; }
        .fin-meta-empty-cta {
          padding:0.5rem 1rem;
          background:var(--primary-gradient);
          color:#fff; border-radius: var(--radius-full);
          font-size: var(--font-helper); font-weight: var(--fw-bold); white-space:nowrap;
          box-shadow:0 2px 8px rgba(255,111,169,0.3);
        }

        /* Modal meta - bloco explicativo */
        .fin-meta-help {
          display:flex; gap:0.85rem; align-items:flex-start;
          padding:0.95rem;
          background:var(--primary-light);
          border-radius: var(--radius-lg);
          color:var(--primary-dark);
        }
        .fin-meta-help p { margin:0; font-size: var(--font-helper); line-height:1.45; color:var(--text-primary); }

        /* Mobile */
        @media (max-width:640px) {
          .fin-header { flex-direction:column; align-items:stretch; }
          .fin-header-actions { flex-direction:column-reverse; gap:0.5rem; }
          .fin-export-wrap, .fin-btn-export { width:100%; }
          .fin-btn-export { justify-content:center; }
          .fin-export-menu { width:100%; right:auto; left:0; }
          .fin-month-nav { align-self:stretch; justify-content:space-between; }
          .fin-month-label { flex:1; }
          .fin-cards { grid-template-columns:1fr 1fr; }
          .fin-card-value { font-size: var(--font-modal-title); }
          .fin-chart { gap:0.4rem; height:180px; }
          .fin-bars { height:120px; }
          .fin-bar-sub { display:none; }
          .fin-legend { width:100%; margin-left:0; justify-content:flex-start; }
          .fin-item-meta { display:none; }
          .fin-meta-current { font-size: var(--text-xl); }
          .fin-meta-pct { margin-left:0; }
          .fin-meta-empty { flex-direction:column; text-align:center; }
          .fin-meta-empty-cta { width:100%; text-align:center; padding:0.65rem; }
        }
      `}</style>
    </>
  )
}
