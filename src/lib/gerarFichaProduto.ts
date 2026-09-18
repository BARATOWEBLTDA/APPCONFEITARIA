// ── gerarFichaProduto.ts ─────────────────────────────────────────────────
// Gera PDF de ficha técnica do produto usando jsPDF.
// Download direto — sem window.print, sem depender do navegador.
// ────────────────────────────────────────────────────────────────────────
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";

// ── Tipos aceitos (do arquivo Produtos.tsx) ──────────────────────────
type Tamanho = { label: string; preco: number; foto_url?: string };
type Produto = any; // aceita produto do Supabase (evita conflito de tipos)

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  custo_unitario: number;
};

type FichaItem = {
  insumo_id: string;
  quantidade: number;
  unidade_utilizada: string;
  insumo: Insumo;
};

// ── Cores (matching brand Doonly) ────────────────────────────────────
const COR = {
  rosa: [232, 90, 140] as [number, number, number],       // #E85A8C
  rosaEscuro: [131, 24, 67] as [number, number, number],  // #831843
  rosaFundo: [253, 243, 247] as [number, number, number], // #FDF3F7
  rosaBorda: [252, 224, 233] as [number, number, number], // #FCE0E9
  preto: [45, 31, 38] as [number, number, number],        // #2D1F26
  cinza: [107, 93, 100] as [number, number, number],      // #6B5D64
  cinzaClaro: [154, 139, 146] as [number, number, number],// #9A8B93
  bordaClara: [240, 235, 237] as [number, number, number],// #F0EBED
  bege: [250, 248, 245] as [number, number, number],      // #FAF8F5
  verde: [5, 150, 105] as [number, number, number],       // #059669
  verdeClaro: [220, 252, 231] as [number, number, number],// #DCFCE7
  verdeBorda: [187, 247, 208] as [number, number, number],// #BBF7D0
  azul: [37, 99, 235] as [number, number, number],        // #2563EB
  azulFundo: [239, 246, 255] as [number, number, number], // #EFF6FF
  azulBorda: [191, 219, 254] as [number, number, number], // #BFDBFE
  amarelo: [217, 119, 6] as [number, number, number],     // #D97706
  amareloFundo: [254, 243, 199] as [number, number, number],// #FEF3C7
  amareloBorda: [253, 230, 138] as [number, number, number],// #FDE68A
  cinzaFundo: [245, 241, 243] as [number, number, number],// #F5F1F3
};

// ── Helpers ──────────────────────────────────────────────────────────
const formatPreco = (v: number) =>
  (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatData = (d?: string) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("pt-BR");
};

// Converte URL de imagem em base64 (pra colocar no PDF)
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Fetch ficha técnica do produto (insumos + custo) ─────────────────
async function fetchFichaTecnica(produtoId: string): Promise<FichaItem[]> {
  const { data } = await supabase
    .from("produto_insumos")
    .select("insumo_id, quantidade, unidade_utilizada, insumos(id, nome, unidade, custo_unitario)")
    .eq("produto_id", produtoId);

  if (!data) return [];
  return data.map((d: any) => ({
    insumo_id: d.insumo_id,
    quantidade: Number(d.quantidade) || 0,
    unidade_utilizada: d.unidade_utilizada || "",
    insumo: d.insumos as Insumo,
  }));
}

// ── Perfil (nome da confeitaria) ─────────────────────────────────────
async function fetchNomeConfeitaria(userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("nome, nome_confeitaria").eq("id", userId).single();
  return (data as any)?.nome_confeitaria || (data as any)?.nome || "";
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export async function gerarFichaProduto(produto: Produto, userId: string) {
  // Fetch dados extras em paralelo
  const [fichaTecnica, nomeConfeitaria, fotoBase64] = await Promise.all([
    produto.id ? fetchFichaTecnica(produto.id) : Promise.resolve([]),
    fetchNomeConfeitaria(userId),
    produto.imagem_url ? urlToBase64(produto.imagem_url.split(",")[0]) : Promise.resolve(null),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Calcula custo se tiver ficha técnica
  const custoTotal = fichaTecnica.reduce((acc, item) => {
    const custo = (item.quantidade * (item.insumo?.custo_unitario || 0));
    return acc + custo;
  }, 0);
  const temFicha = fichaTecnica.length > 0 && custoTotal > 0;
  const margem = temFicha && produto.preco_normal > 0
    ? ((produto.preco_normal - custoTotal) / produto.preco_normal) * 100
    : null;

  // ── HEADER ─────────────────────────────────────────────────────────
  const headerHeight = 32;

  // Foto (se tiver)
  if (fotoBase64) {
    try {
      doc.addImage(fotoBase64, "JPEG", margin, y, 26, 26, undefined, "FAST");
    } catch { /* skip se der erro */ }
  } else {
    doc.setFillColor(...COR.rosaFundo);
    doc.roundedRect(margin, y, 26, 26, 3, 3, "F");
  }
  // Borda arredondada por cima (garante que sempre aparece)
  doc.setDrawColor(...COR.bordaClara);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, 26, 26, 3, 3, "S");

  // Info do produto (à direita da foto)
  const textX = margin + 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR.rosa);
  doc.text("FICHA TÉCNICA", textX, y + 4);

  doc.setFontSize(18);
  doc.setTextColor(...COR.preto);
  doc.text(produto.nome || "", textX, y + 12);

  // Chip categoria
  let chipX = textX;
  if (produto.categoria) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    const catText = (produto.categoria || "").toUpperCase();
    const catWidth = doc.getTextWidth(catText) + 6;
    doc.setFillColor(...COR.rosaBorda);
    doc.roundedRect(chipX, y + 15, catWidth, 4, 1, 1, "F");
    doc.setTextColor(...COR.rosaEscuro);
    doc.text(catText, chipX + 3, y + 18);
    chipX += catWidth + 4;
  }
  const ativo = produto.disponivel !== false;
  // Status ativo/inativo — círculo desenhado + texto (evita bug de encoding do bullet)
  const statusColor: [number, number, number] = ativo ? [16, 185, 129] : [220, 38, 38];
  doc.setFillColor(...statusColor);
  doc.circle(chipX + 1.3, y + 17.2, 0.9, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...statusColor);
  doc.text(ativo ? "Ativo" : "Inativo", chipX + 3, y + 18);

  // Meta info
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COR.cinzaClaro);
  const dataStr = produto.updated_at ? `Atualizado em ${formatData(produto.updated_at)}` : (produto.created_at ? `Criado em ${formatData(produto.created_at)}` : "");
  const metaStr = [nomeConfeitaria, dataStr].filter(Boolean).join("  -  ");
  doc.text(metaStr, textX, y + 24);

  y += headerHeight;

  // Linha divisora
  doc.setDrawColor(...COR.rosaBorda);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ── KPIs (4 cards) ─────────────────────────────────────────────────
  const kpiHeight = 15;
  const kpiGap = 3;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4;

  const drawKpi = (x: number, label: string, valor: string, opts: {
    bg: [number, number, number]; border: [number, number, number]; corLabel: [number, number, number]; corValor: [number, number, number];
    ativo?: boolean;
  }) => {
    doc.setFillColor(...opts.bg);
    doc.setDrawColor(...opts.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, kpiWidth, kpiHeight, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...opts.corLabel);
    doc.text(label.toUpperCase(), x + 3, y + 4.5);
    doc.setFontSize(12);
    doc.setTextColor(...opts.corValor);
    doc.text(valor, x + 3, y + 11);
  };

  // Preço (sempre colorido)
  drawKpi(margin, "Preço", `R$ ${formatPreco(produto.preco_normal)}`, {
    bg: COR.rosaFundo, border: COR.rosaBorda,
    corLabel: COR.rosaEscuro, corValor: COR.rosa,
  });

  // Custo (cinza se sem ficha)
  drawKpi(margin + (kpiWidth + kpiGap), "Custo", temFicha ? `R$ ${formatPreco(custoTotal)}` : "—", {
    bg: temFicha ? COR.verdeClaro : COR.cinzaFundo,
    border: temFicha ? COR.verdeBorda : COR.bordaClara,
    corLabel: temFicha ? [22, 101, 52] : COR.cinza,
    corValor: temFicha ? COR.verde : COR.cinzaClaro,
  });

  // Margem (cinza se sem ficha)
  drawKpi(margin + (kpiWidth + kpiGap) * 2, "Margem", margem !== null ? `${margem.toFixed(1)}%` : "—", {
    bg: margem !== null ? COR.azulFundo : COR.cinzaFundo,
    border: margem !== null ? COR.azulBorda : COR.bordaClara,
    corLabel: margem !== null ? [30, 64, 175] : COR.cinza,
    corValor: margem !== null ? COR.azul : COR.cinzaClaro,
  });

  // Variações (mostra quantas — sempre visível)
  const sabores = (produto.recheios_disponiveis || []).length;
  const tamanhos = (produto.tamanhos_disponiveis || []).length;
  let varStr = "—";
  if (sabores > 0 && tamanhos > 0) varStr = `${sabores}x${tamanhos}`;
  else if (sabores > 0) varStr = `${sabores} ${sabores === 1 ? "sabor" : "sabores"}`;
  else if (tamanhos > 0) varStr = `${tamanhos} ${tamanhos === 1 ? "tamanho" : "tamanhos"}`;
  const temVar = sabores > 0 || tamanhos > 0;
  drawKpi(margin + (kpiWidth + kpiGap) * 3, "Variações", varStr, {
    bg: temVar ? COR.amareloFundo : COR.cinzaFundo,
    border: temVar ? COR.amareloBorda : COR.bordaClara,
    corLabel: temVar ? [120, 53, 15] : COR.cinza,
    corValor: temVar ? COR.amarelo : COR.cinzaClaro,
  });

  y += kpiHeight + 4;

  // Aviso sem ficha
  if (!temFicha) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COR.cinza);
    doc.text("Cadastre ingredientes na ficha técnica pra ver custo e margem real.", margin, y);
    y += 5;
  } else {
    y += 2;
  }

  // ── Helper de seção ──────────────────────────────────────────────
  const secao = (titulo: string) => {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COR.rosa);
    doc.text(titulo.toUpperCase(), margin, y);
    y += 5;
  };

  // ── DESCRIÇÃO ──────────────────────────────────────────────────────
  if (produto.descricao) {
    secao("Descrição");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...COR.preto);
    const linhas = doc.splitTextToSize(produto.descricao, contentWidth);
    doc.text(linhas, margin, y);
    y += linhas.length * 4.5 + 4;
  }

  // ── VARIAÇÕES E PREÇOS ─────────────────────────────────────────────
  const precosVar = produto.precos_variacoes || {};
  const saboresArr = produto.recheios_disponiveis || [];
  const tamanhosArr = produto.tamanhos_disponiveis || [];

  if (saboresArr.length > 0 && tamanhosArr.length > 0) {
    // Grid Sabor × Tamanho
    secao("Variações e preços");
    const head = [["Sabor", ...tamanhosArr.map((t: Tamanho) => t.label)]];
    const body = saboresArr.map((s: string) => [
      s,
      ...tamanhosArr.map((t: Tamanho) => {
        const key = `${s}|${t.label}`;
        const v = precosVar[key];
        return v > 0 ? `R$ ${formatPreco(v)}` : "—";
      })
    ]);
    autoTable(doc, {
      startY: y,
      head, body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5, font: "helvetica" },
      headStyles: { fillColor: COR.bege, textColor: COR.cinza, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { textColor: COR.preto },
      columnStyles: { 0: { fontStyle: "bold" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index > 0 && data.cell.raw !== "—") {
          data.cell.styles.textColor = COR.verde;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else if (saboresArr.length > 0) {
    secao("Sabores e preços");
    const body = saboresArr.map((s: string) => {
      const v = precosVar[`${s}|`];
      return [s, v > 0 ? `R$ ${formatPreco(v)}` : "—"];
    });
    autoTable(doc, {
      startY: y,
      head: [["Sabor", "Preço"]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COR.bege, textColor: COR.cinza, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { textColor: COR.verde, fontStyle: "bold", halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else if (tamanhosArr.length > 0) {
    secao("Tamanhos e preços");
    const body = tamanhosArr.map((t: Tamanho) => {
      const v = precosVar[`|${t.label}`] || t.preco;
      return [t.label, v > 0 ? `R$ ${formatPreco(v)}` : "—"];
    });
    autoTable(doc, {
      startY: y,
      head: [["Tamanho", "Preço"]],
      body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COR.bege, textColor: COR.cinza, fontStyle: "bold", fontSize: 8 },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { textColor: COR.verde, fontStyle: "bold", halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── INGREDIENTES (só se tiver ficha) ───────────────────────────────
  if (temFicha) {
    secao("Ingredientes");
    const body = fichaTecnica.map(item => {
      const custo = item.quantidade * (item.insumo?.custo_unitario || 0);
      return [
        item.insumo?.nome || "—",
        `${item.quantidade} ${item.unidade_utilizada}`,
        `R$ ${formatPreco(custo)}`,
      ];
    });
    autoTable(doc, {
      startY: y,
      head: [["Insumo", "Quantidade", "Custo"]],
      body,
      foot: [["Custo total", "", `R$ ${formatPreco(custoTotal)}`]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: COR.bege, textColor: COR.cinza, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { textColor: COR.preto },
      footStyles: { fillColor: COR.rosaFundo, textColor: COR.rosa, fontStyle: "bold", fontSize: 9.5 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── COMPLEMENTOS (adicionais pagos) ────────────────────────────────
  const adicionais = produto.adicionais || [];
  if (adicionais.length > 0) {
    secao("Complementos disponíveis");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR.cinza);
    let chipX = margin;
    let chipY = y;
    adicionais.forEach((adic: any) => {
      const nome = adic.nome || adic.label || "";
      const preco = adic.preco || adic.valor || 0;
      const txt = `${nome} + R$ ${formatPreco(preco)}`;
      const w = doc.getTextWidth(txt) + 6;
      if (chipX + w > pageWidth - margin) { chipX = margin; chipY += 7; }
      doc.setFillColor(...COR.bege);
      doc.roundedRect(chipX, chipY - 3.5, w, 5, 2, 2, "F");
      doc.text(txt, chipX + 3, chipY);
      chipX += w + 3;
    });
    y = chipY + 8;
  }

  // ── OBSERVAÇÕES INTERNAS ──────────────────────────────────────────
  if (produto.observacoes_internas || produto.observacoes) {
    secao("Observações internas");
    const obs = produto.observacoes_internas || produto.observacoes;
    doc.setFillColor(...COR.amareloFundo);
    doc.setDrawColor(...COR.amareloBorda);
    doc.setLineWidth(0.3);
    const linhas = doc.splitTextToSize(obs, contentWidth - 8);
    const boxH = linhas.length * 4.5 + 6;
    doc.roundedRect(margin, y - 2, contentWidth, boxH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR.cinza);
    doc.text(linhas, margin + 4, y + 3);
    y += boxH + 4;
  }

  // ── RODAPÉ (em toda página) ────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = 285;
    doc.setDrawColor(...COR.bordaClara);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COR.rosa);
    doc.text("Doonly", margin, footerY + 5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COR.cinzaClaro);
    doc.text("Confeitaria Inteligente", margin + 11, footerY + 5);
    doc.text(`Página ${i} de ${totalPages}  -  ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - margin, footerY + 5, { align: "right" });
  }

  // ── DOWNLOAD ───────────────────────────────────────────────────────
  const safeName = (produto.nome || "produto").replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`ficha-tecnica-${safeName}.pdf`);
}
