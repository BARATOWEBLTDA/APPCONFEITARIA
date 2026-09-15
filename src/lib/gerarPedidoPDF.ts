// ── gerarPedidoPDF.ts ───────────────────────────────────────────────────────
// Gera um comprovante de pedido bonito estilo Doonly.
// Abre uma janela nova com o HTML e dispara window.print automaticamente.
// A confeiteira pode imprimir direto OU salvar como PDF pelo diálogo nativo
// do sistema (funciona no iPhone via Safari).
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'

// ── Tipos aceitos (aceita variações do Pedido de várias telas) ────────────
type PedidoItemPDF = {
  nome_produto?: string
  quantidade?: number
  valor_unitario?: number
  observacoes?: string | null
}

export type PedidoPDF = {
  id: string
  numero?: number | null
  cliente_nome?: string | null
  cliente_telefone?: string | null
  status?: string | null
  status_pagamento?: string | null
  tipo_entrega?: string | null
  tipo_venda?: string | null
  data_entrega?: string | null
  horario_entrega?: string | null
  endereco_rua?: string | null
  endereco_numero?: string | null
  endereco_bairro?: string | null
  endereco_cidade?: string | null
  endereco_complemento?: string | null
  valor_total?: number | null
  valor_produtos?: number | null
  valor_recebido?: number | null
  desconto?: number | null
  acrescimo?: number | null
  taxa_entrega?: number | null
  forma_pagamento?: string | null
  observacoes?: string | null
  data_prevista_pagamento?: string | null
  origem?: string | null
  created_at?: string | null
  pedido_itens?: PedidoItemPDF[]
}

// ── Utils ────────────────────────────────────────────────────────────────
const escapeHtml = (s?: string | null): string => {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

const fmtMoney = (v?: number | null): string =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const toTitleCase = (s?: string | null): string => {
  if (!s) return ''
  const minusc = new Set(['de','da','do','das','dos','e','com','para','a','o','em','na','no'])
  return s.toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && minusc.has(w)) return w
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join(' ')
}

const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
const DIAS_SEMANA = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

const fmtDataLonga = (dataStr?: string | null, horaStr?: string | null): string => {
  if (!dataStr) return '—'
  const [y, m, d] = dataStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const sem = DIAS_SEMANA[dt.getDay()]
  const dia = dt.getDate()
  const mes = MESES[dt.getMonth()]
  const ano = dt.getFullYear()
  const hora = horaStr ? ` às ${horaStr.slice(0, 5)}` : ''
  return `${sem}, ${dia} de ${mes} de ${ano}${hora}`
}

const fmtDataCurta = (isoStr?: string | null): string => {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const ano = d.getFullYear()
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${dia}/${mes}/${ano} às ${hora}`
}

// Cores por status (em harmonia com a paleta do app)
const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  aguardando_pagamento: { bg: '#FEF0DF', color: '#854F0B', label: 'Aguardando Pagamento' },
  aguardando_aceite:    { bg: '#FEF0DF', color: '#854F0B', label: 'Aguardando Aceite' },
  agendado:             { bg: '#E6F1FB', color: '#185FA5', label: 'Agendado' },
  em_producao:          { bg: '#FCE0E9', color: '#993556', label: 'Em Produção' },
  finalizado:           { bg: '#E1F5EE', color: '#0F6E56', label: 'Finalizado' },
  aguardando_retirada:  { bg: '#E1F5EE', color: '#0F6E56', label: 'Pronto para Retirada' },
  em_entrega:           { bg: '#E6F1FB', color: '#185FA5', label: 'Em Entrega' },
  entregue:             { bg: '#F1EFE8', color: '#5F5E5A', label: 'Entregue' },
  cancelado:            { bg: '#FCEBEB', color: '#791F1F', label: 'Cancelado' },
}

const PAG_LABEL: Record<string, string> = {
  pago: 'Pago',
  parcial: 'Parcial',
  pendente: 'Pendente',
}
const PAG_COR: Record<string, string> = {
  pago: '#0F6E56',
  parcial: '#854F0B',
  pendente: '#791F1F',
}

// ── Perfil da confeiteira ────────────────────────────────────────────────
async function buscarPerfilDono(): Promise<{ nome_loja?: string; nome?: string; foto_url?: string | null; email?: string }> {
  try {
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes?.user) return {}
    const { data: prof } = await supabase
      .from('profiles')
      .select('nome, nome_loja, foto_url')
      .eq('id', userRes.user.id)
      .single()
    return {
      nome_loja: prof?.nome_loja || undefined,
      nome: prof?.nome || undefined,
      foto_url: prof?.foto_url || undefined,
      email: userRes.user.email || undefined,
    }
  } catch {
    return {}
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// GERAR PDF (abre janela nova, layout pronto, chama print)
// ═════════════════════════════════════════════════════════════════════════════
export async function gerarPedidoPDF(pedido: PedidoPDF): Promise<void> {
  const perfil = await buscarPerfilDono()

  const status = pedido.status || 'agendado'
  const statusStyle = STATUS_STYLE[status] || STATUS_STYLE.agendado

  const isEntrega = pedido.tipo_entrega === 'entrega'
  const tipoEntregaLabel = isEntrega ? 'Entrega' : 'Retirada'
  const origemLabel = pedido.origem === 'cardapio' ? 'Cardápio Digital' : 'Manual'

  const itens = pedido.pedido_itens || []
  const subtotal = pedido.valor_produtos ??
    itens.reduce((acc, it) => acc + (it.valor_unitario || 0) * (it.quantidade || 1), 0)
  const total = pedido.valor_total || 0
  const desconto = pedido.desconto || 0
  const acrescimo = pedido.acrescimo || 0
  const taxaEntrega = isEntrega ? (pedido.taxa_entrega || 0) : 0
  const valorRecebido = pedido.valor_recebido || 0
  const valorPendente = Math.max(0, total - valorRecebido)

  const statusPag = pedido.status_pagamento || 'pendente'
  const pagLabel = PAG_LABEL[statusPag] || 'Pendente'
  const pagCor = PAG_COR[statusPag] || '#791F1F'

  const enderecoLinhas: string[] = []
  if (isEntrega) {
    const l1 = [pedido.endereco_rua, pedido.endereco_numero].filter(Boolean).join(', ')
    if (l1) enderecoLinhas.push(l1)
    if (pedido.endereco_complemento) enderecoLinhas.push(pedido.endereco_complemento)
    const l3 = [pedido.endereco_bairro, pedido.endereco_cidade].filter(Boolean).join(' — ')
    if (l3) enderecoLinhas.push(l3)
  }

  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Pedido #${pedido.numero || '—'} — ${escapeHtml(perfil.nome_loja || 'Doonly')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  html, body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #2C2C2A;
    background: #fff;
    font-size: 11.5pt;
    line-height: 1.5;
  }
  .page { max-width: 190mm; margin: 0 auto; }

  /* ── Header rosa ── */
  .hd {
    background: linear-gradient(135deg, #E85A8C 0%, #C33A6E 100%);
    color: #fff;
    padding: 24px 28px;
    border-radius: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 22px;
  }
  .hd-brand { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
  .hd-avatar {
    width: 56px; height: 56px;
    border-radius: 14px;
    background: rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; font-weight: 800;
    letter-spacing: -0.02em;
    overflow: hidden;
    flex-shrink: 0;
  }
  .hd-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .hd-brand-info { min-width: 0; }
  .hd-loja { font-size: 18pt; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
  .hd-sub { font-size: 10pt; opacity: 0.9; margin-top: 3px; font-weight: 500; }

  .hd-num-wrap { text-align: right; flex-shrink: 0; }
  .hd-num-lb { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.82; font-weight: 600; }
  .hd-num-val { font-size: 20pt; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; }
  .hd-tag {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 12px;
    background: rgba(255,255,255,0.22);
    color: #fff;
    border-radius: 999px;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  /* ── Grid de 2 colunas ── */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-bottom: 14px;
  }
  .card {
    border: 1px solid #EFEBE6;
    border-radius: 12px;
    padding: 16px 18px;
    background: #FAF8F5;
  }
  .card-title {
    font-size: 8.5pt;
    font-weight: 800;
    color: #888780;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #EFEBE6;
  }
  .kv { display: grid; grid-template-columns: 92px 1fr; gap: 4px 10px; font-size: 10.5pt; }
  .kv dt { color: #888780; font-weight: 600; }
  .kv dd { color: #2C2C2A; font-weight: 700; }
  .kv dd.strong { font-weight: 800; letter-spacing: -0.01em; }

  .tag-status {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 9pt;
    font-weight: 700;
    background: ${statusStyle.bg};
    color: ${statusStyle.color};
  }
  .tag-pag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 8.5pt;
    font-weight: 700;
    background: #F1EFE8;
  }

  /* ── Itens tabela ── */
  .itens-card { margin-bottom: 14px; }
  table.itens {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
  }
  table.itens thead th {
    text-align: left;
    color: #888780;
    text-transform: uppercase;
    font-size: 8.5pt;
    letter-spacing: 0.1em;
    font-weight: 800;
    padding: 6px 10px;
    border-bottom: 1.5px solid #EFEBE6;
  }
  table.itens thead th.right { text-align: right; }
  table.itens tbody td {
    padding: 10px;
    border-bottom: 1px solid #F1EFE8;
    vertical-align: top;
  }
  table.itens tbody tr:last-child td { border-bottom: none; }
  table.itens td.produto { font-weight: 700; color: #2C2C2A; }
  table.itens td.qtd, table.itens td.unit, table.itens td.total {
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #5F5E5A;
    white-space: nowrap;
  }
  table.itens td.total { font-weight: 800; color: #2C2C2A; }
  .obs-item { font-size: 9pt; color: #888780; font-style: italic; margin-top: 2px; font-weight: 500; }

  /* ── Resumo financeiro ── */
  .fin-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .fin-linha {
    display: flex; justify-content: space-between;
    padding: 4px 0;
    font-size: 10.5pt;
    color: #5F5E5A;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .fin-linha.neg { color: #C33A6E; }
  .fin-linha.total {
    margin-top: 8px;
    padding-top: 10px;
    border-top: 1.5px solid #EFEBE6;
    font-size: 13pt;
    font-weight: 800;
    color: #2C2C2A;
    letter-spacing: -0.01em;
  }

  .obs-card { margin-bottom: 14px; }
  .obs-txt {
    font-size: 10.5pt;
    line-height: 1.55;
    color: #2C2C2A;
    white-space: pre-wrap;
  }

  /* ── Rodapé ── */
  .footer {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid #EFEBE6;
    display: flex; justify-content: space-between;
    font-size: 8.5pt; color: #888780;
    font-weight: 500;
  }
  .footer .brand { color: #E85A8C; font-weight: 800; }

  /* ── Botão print (só na tela, não imprime) ── */
  .print-bar {
    position: sticky; top: 0;
    background: #fff;
    padding: 10px 12px;
    border-bottom: 1px solid #EFEBE6;
    display: flex; gap: 8px; justify-content: flex-end;
    margin-bottom: 20px;
    z-index: 10;
  }
  .btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: none;
    font-weight: 700;
    font-size: 10.5pt;
    cursor: pointer;
    font-family: inherit;
  }
  .btn-primary { background: #E85A8C; color: #fff; }
  .btn-primary:hover { background: #C33A6E; }
  .btn-ghost { background: #F1EFE8; color: #2C2C2A; }
  .btn-ghost:hover { background: #E8E5DC; }
  @media print {
    .print-bar { display: none !important; }
    .page { max-width: none; margin: 0; }
  }

  /* Evita quebra ruim */
  .card, .itens-card, table.itens tr { page-break-inside: avoid; }
</style>
</head>
<body>
  <div class="print-bar">
    <button class="btn btn-ghost" onclick="window.close()">Fechar</button>
    <button class="btn btn-primary" onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>

  <div class="page">

    <!-- HEADER ROSA -->
    <div class="hd">
      <div class="hd-brand">
        <div class="hd-avatar">
          ${perfil.foto_url
            ? `<img src="${escapeHtml(perfil.foto_url)}" alt="">`
            : (perfil.nome_loja || perfil.nome || 'D').trim().charAt(0).toUpperCase()}
        </div>
        <div class="hd-brand-info">
          <div class="hd-loja">${escapeHtml(perfil.nome_loja || perfil.nome || 'Doonly')}</div>
          ${perfil.nome_loja && perfil.nome ? `<div class="hd-sub">${escapeHtml(perfil.nome)}</div>` : ''}
        </div>
      </div>
      <div class="hd-num-wrap">
        <div class="hd-num-lb">Pedido</div>
        <div class="hd-num-val">#${pedido.numero || '—'}</div>
        <div class="hd-tag">${escapeHtml(statusStyle.label)}</div>
      </div>
    </div>

    <!-- CLIENTE + DETALHES -->
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Cliente</div>
        <dl class="kv">
          <dt>Nome</dt>
          <dd class="strong">${escapeHtml(toTitleCase(pedido.cliente_nome)) || '—'}</dd>
          ${pedido.cliente_telefone ? `<dt>Telefone</dt><dd>${escapeHtml(pedido.cliente_telefone)}</dd>` : ''}
          <dt>Tipo</dt>
          <dd>${tipoEntregaLabel}</dd>
          ${enderecoLinhas.length > 0 ? `
            <dt>Endereço</dt>
            <dd>${enderecoLinhas.map(escapeHtml).join('<br>')}</dd>
          ` : ''}
        </dl>
      </div>

      <div class="card">
        <div class="card-title">Detalhes do Pedido</div>
        <dl class="kv">
          <dt>Registrado</dt>
          <dd>${escapeHtml(fmtDataCurta(pedido.created_at))}</dd>
          <dt>${isEntrega ? 'Entrega' : 'Retirada'}</dt>
          <dd class="strong">${escapeHtml(fmtDataLonga(pedido.data_entrega, pedido.horario_entrega))}</dd>
          <dt>Origem</dt>
          <dd>${origemLabel}</dd>
          <dt>Status</dt>
          <dd><span class="tag-status">${escapeHtml(statusStyle.label)}</span></dd>
        </dl>
      </div>
    </div>

    <!-- ITENS -->
    <div class="card itens-card">
      <div class="card-title">Itens do Pedido</div>
      ${itens.length === 0 ? `
        <p style="color:#888780; font-style:italic; padding: 8px 0;">Nenhum item registrado.</p>
      ` : `
        <table class="itens">
          <thead>
            <tr>
              <th>Produto</th>
              <th class="right" style="width: 60px;">Qtd</th>
              <th class="right" style="width: 90px;">Unit.</th>
              <th class="right" style="width: 90px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map(it => `
              <tr>
                <td class="produto">
                  ${escapeHtml(toTitleCase(it.nome_produto))}
                  ${it.observacoes ? `<div class="obs-item">${escapeHtml(it.observacoes)}</div>` : ''}
                </td>
                <td class="qtd">${it.quantidade || 1}</td>
                <td class="unit">${fmtMoney(it.valor_unitario)}</td>
                <td class="total">${fmtMoney((it.valor_unitario || 0) * (it.quantidade || 1))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- RESUMO FINANCEIRO -->
    <div class="fin-wrap">
      <div class="card">
        <div class="card-title">Valores</div>
        <div class="fin-linha"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
        ${taxaEntrega > 0 ? `<div class="fin-linha"><span>Taxa de entrega</span><span>+ ${fmtMoney(taxaEntrega)}</span></div>` : ''}
        ${acrescimo > 0 ? `<div class="fin-linha"><span>Acréscimo</span><span>+ ${fmtMoney(acrescimo)}</span></div>` : ''}
        ${desconto > 0 ? `<div class="fin-linha neg"><span>Desconto</span><span>− ${fmtMoney(desconto)}</span></div>` : ''}
        <div class="fin-linha total"><span>Total</span><span>${fmtMoney(total)}</span></div>
      </div>

      <div class="card">
        <div class="card-title">Pagamento</div>
        <dl class="kv">
          <dt>Forma</dt>
          <dd class="strong">${escapeHtml(pedido.forma_pagamento || 'PIX')}</dd>
          <dt>Situação</dt>
          <dd><span class="tag-pag" style="color:${pagCor}; background:${pagCor}22">${pagLabel}</span></dd>
          <dt>Recebido</dt>
          <dd class="strong" style="color:#0F6E56">${fmtMoney(valorRecebido)}</dd>
          ${valorPendente > 0 ? `
            <dt>Pendente</dt>
            <dd class="strong" style="color:#B91C1C">${fmtMoney(valorPendente)}</dd>
          ` : ''}
          ${pedido.data_prevista_pagamento ? `
            <dt>Previsto</dt>
            <dd>${escapeHtml(fmtDataLonga(pedido.data_prevista_pagamento))}</dd>
          ` : ''}
        </dl>
      </div>
    </div>

    ${pedido.observacoes ? `
      <div class="card obs-card">
        <div class="card-title">Observações</div>
        <div class="obs-txt">${escapeHtml(pedido.observacoes)}</div>
      </div>
    ` : ''}

    <!-- RODAPÉ -->
    <div class="footer">
      <div>
        <div><strong>${escapeHtml(perfil.nome_loja || perfil.nome || 'Doonly')}</strong>${perfil.email ? ` · ${escapeHtml(perfil.email)}` : ''}</div>
        <div style="margin-top: 2px;">Comprovante gerado em ${escapeHtml(geradoEm)}</div>
      </div>
      <div style="text-align:right;">
        <div class="brand">Doonly</div>
        <div style="margin-top: 2px;">Pedido #${pedido.numero || '—'} · Página 1 de 1</div>
      </div>
    </div>

  </div>

  <script>
    // Aguarda o CSS/imagens carregarem antes de imprimir
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`

  // Abre em uma janela nova e escreve o HTML
  const janela = window.open('', '_blank', 'noopener,noreferrer,width=800,height=1100')
  if (!janela) {
    alert('Não foi possível abrir a janela do PDF. Verifique se o navegador não bloqueou pop-ups.')
    return
  }
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
}
