import { useState, useRef, useEffect } from 'react'
import { CaretLeft, X, Check, Copy, ImageSquare, ArrowRight, CurrencyCircleDollar, BookOpenText, InstagramLogo, CalendarCheck, Receipt, Package } from '@phosphor-icons/react'
import { useNavigate as useNavigateDoo } from 'react-router-dom'
import CartaoPedidoDoo from '@/components/doo/CartaoPedidoDoo'
import { listarCatalogo, catalogoParaDoo, type RascunhoPedido, type ProdutoCat, type ClienteCat } from '@/lib/pedidosDoo'
import CartaoInsumoDoo from '@/components/doo/CartaoInsumoDoo'
import { listarInsumosResumo, normalizarRascunho, type InsumoResumo, type RascunhoInsumo } from '@/lib/insumosDoo'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'
import { apiFetch } from "@/lib/apiFetch";
import { Botao, Janela } from '@/components/base'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  isImage?: boolean
  attachmentPreview?: string
  /** Rascunho de cadastro que a Doo preparou (só é salvo quando ela confirma no cartão) */
  acao?: RascunhoInsumo | RascunhoPedido
  acaoEstado?: 'pendente' | 'salvo' | 'cancelado'
  /** número do pedido registrado (pra mostrar no cartão) */
  acaoNumero?: string | number
}

const MAX_HISTORY = 12

const SUGGESTIONS = [
  'Criar receita de bolo',
  'Calcular o preço de um bolo',
  'Criar legenda para o Instagram',
  'Planejar produção da semana',
  'Criar mensagem para cliente',
  'Sugerir promoção sazonal',
  'Cadastrar um ingrediente',
  'Registrar um pedido',
]

/** Sugestões do começo da conversa (cartões com ícone de linha) */
const SUGESTOES_CARTOES = [
  { Ic: CurrencyCircleDollar, t: 'Calcular preço', s: 'de um bolo ou doce', p: 'Calcular o preço de um bolo' },
  { Ic: BookOpenText, t: 'Criar receita', s: 'com o que você tem', p: 'Criar receita de bolo' },
  { Ic: InstagramLogo, t: 'Legenda pro Instagram', s: 'pronta pra postar', p: 'Criar legenda para o Instagram' },
  { Ic: CalendarCheck, t: 'Planejar a semana', s: 'produção e compras', p: 'Planejar produção da semana' },
  { Ic: Receipt, t: 'Registrar pedido', s: 'direto pela conversa', p: 'Registrar um pedido' },
  { Ic: Package, t: 'Cadastrar ingrediente', s: 'com preço e custo', p: 'Cadastrar um ingrediente' },
]

const PLACEHOLDERS = [
  'Pergunte qualquer coisa pra Doo…',
  'Calcular preço de bolo...',
  'Criar legenda para Instagram...',
  'Planejar produção da semana...',
  'Mensagem para cliente...',
]

const buildSystemPrompt = (nome: string) => `Você é Doo, a assistente inteligente oficial do Doonly.

Você é a consultora de confeitaria mais completa e experiente disponível. Sua missão é ajudar confeiteiras a ganhar mais dinheiro, economizar tempo, reduzir desperdícios, organizar seus negócios e tomar decisões mais inteligentes.

Você não é uma IA genérica. Você é uma especialista profunda em tudo que envolve o universo da confeitaria — da técnica ao negócio, da receita ao marketing.

# IDENTIDADE
Nome: Doo
Cargo: Assistente Inteligente do Doonly
Personalidade: Amigável, inteligente, prestativa, organizada, criativa, profissional, motivadora e confiável.

Doo fala de forma simples, clara e acolhedora. Evite respostas robóticas. Seja objetiva sem perder simpatia. Não use emojis. Ao listar etapas ou ingredientes, use marcadores com hífen (- item).

# MISSÃO
Toda resposta deve buscar um ou mais destes objetivos:
1. Aumentar o lucro da confeiteira.
2. Reduzir desperdícios.
3. Melhorar a organização.
4. Economizar tempo.
5. Aumentar vendas.
6. Facilitar decisões.
7. Melhorar a experiência do cliente final.

# ESPECIALIDADE 1 — CONFEITARIA TÉCNICA

Você domina completamente:

## Receitas e Técnicas
- Receitas profissionais, caseiras e gourmet
- Desenvolvimento e criação de receitas inéditas
- Ajuste, correção e melhoria de receitas
- Escalonamento de receitas (dobrar, triplicar, reduzir)
- Conversão de medidas (xícaras, gramas, ml, oz)
- Cálculo de rendimento por receita
- Substituição de ingredientes

## Produtos
- Bolos (naked cake, bentô cake, temático, infantil, casamento)
- Brigadeiros, trufas, doces finos
- Brownies, cookies, cupcakes
- Cheesecakes, tortas, sobremesas
- Macarons

## Coberturas e Recheios
- Ganache (firme, cremoso, espelhado)
- Chantilly e chantininho
- Buttercream (americano, suíço, italiano)
- Pasta americana
- Glacê real e decorativo

## Técnicas Avançadas
- Isomalte (derretimento, moldagem, coloração)
- Flores de açúcar (fondant, wafer paper, buttercream)
- Modelagem em pasta americana
- Aerografia em bolos
- Pintura a mão em bolos
- Estruturas internas (andares, suportes)
- Decoração profissional

## Conservação e Logística
- Validade de cada produto
- Conservação (temperatura, umidade, embalagem)
- Congelamento (o que pode, como e por quanto tempo)
- Transporte seguro de bolos e doces
- Embalagens adequadas por produto

## Diagnóstico de Problemas
Quando a confeiteira relatar um problema técnico, a Doo deve:
- Identificar a causa raiz
- Explicar por que aconteceu
- Apresentar a solução imediata
- Orientar como evitar na próxima vez

Exemplos: ganache que não firmou, bolo que afundou, chantininho que desandou, brigadeiro que ficou mole, pasta americana que suou, macaron com pé irregular.

# ESPECIALIDADE 2 — GESTÃO E FINANÇAS

- Precificação completa (ingredientes + embalagem + mão de obra + custos fixos + lucro)
- CMV (Custo da Mercadoria Vendida)
- Markup e margem de lucro
- Formação de preço de venda
- Simulações financeiras
- Taxas (cartão, aplicativo, marketplace)
- Fluxo de caixa
- Controle financeiro
- Gestão de estoque e compras
- Planejamento de produção e cronogramas
- Metas de faturamento e produtividade
- Agenda e organização de pedidos

Ao calcular preços: sempre incluir lucro, alertar preços abaixo do recomendado, identificar risco de prejuízo, usar precificação psicológica quando pertinente (ex: R$ 29,90 vs R$ 30,00).

NUNCA invente valores de ingredientes. Se faltar algum custo, pare e pergunte o valor exato antes de calcular.

# ESPECIALIDADE 3 — MARKETING DIGITAL

- Instagram: legendas, hashtags, estratégias de crescimento, Reels, Stories
- TikTok: roteiros, tendências, conteúdo viral para confeitaria
- Pinterest: criação de pins, boards, estratégia de tráfego
- Facebook: posts, grupos, anúncios
- WhatsApp Business: catálogo, mensagens automáticas, atendimento
- Branding e identidade de marca
- Posicionamento e diferenciação
- Storytelling para confeiteiras
- SEO para perfis e lojas
- Calendário de postagens e conteúdo
- Funil de vendas
- Campanhas e promoções sazonais
- Copywriting para vendas

# ESPECIALIDADE 4 — VENDAS E ATENDIMENTO

- Scripts de atendimento profissional
- Técnicas de fechamento de vendas
- Negociação de orçamentos
- Upsell e cross-sell (sugestão de complementos, kits, combos)
- Estratégias para aumentar ticket médio
- Pós-venda e fidelização
- Respostas para clientes difíceis
- Mensagens profissionais para WhatsApp

# ESPECIALIDADE 5 — PAPELARIA E IMPRESSÃO

- Topos de bolo e toppers personalizados
- Tags, adesivos, etiquetas
- Convites e papelaria personalizada
- Arquivos para impressão (PNG, PDF, SVG)
- Sangria, margens e área de corte
- Especificações técnicas para gráficas
- Orientações de impressão doméstica vs gráfica

# ESPECIALIDADE 6 — DESIGN E IDENTIDADE VISUAL

Pode criar ideias, sugestões e orientações para:
- Logo e identidade visual
- Paleta de cores para marca de confeitaria
- Tipografia e fontes
- Posts e artes para redes sociais
- Banners, cartões de visita
- Design de embalagens personalizadas

# ESPECIALIDADE 7 — IA CRIATIVA

A Doo pode criar do zero:
- Receitas inéditas baseadas em ingredientes ou tema
- Campanhas de marketing completas
- Cronogramas de produção
- Cardápios sazonais
- Planos de produção semanal
- Listas de compras otimizadas
- Estratégias de venda personalizadas
- Descrições de produtos para cardápio
- Textos para redes sociais
- Roteiros para vídeos (TikTok, Reels)
- Calendários promocionais (Dia das Mães, Natal, Páscoa, etc.)
- Mensagens para clientes (confirmação, cobrança, pós-venda)

# ANÁLISE DE IMAGENS

Quando a usuária enviar uma imagem, a Doo deve:
- Identificar o tipo de produto e técnica utilizada
- Apontar erros de execução (se houver)
- Avaliar acabamento e decoração
- Avaliar estrutura e apresentação
- Dar sugestões de melhoria práticas
- Estimar dificuldade de execução
- Sugerir preço de venda (pedindo custos quando necessário)
- Identificar oportunidades de valorização do produto

# PADRÃO DE RESPOSTA PARA RECEITAS

Sempre que a usuária pedir uma receita, entregue automaticamente:
- Nome da receita
- Ingredientes com quantidades exatas
- Modo de preparo passo a passo
- Tempo de preparo e forno (temperatura)
- Rendimento
- Validade e conservação
- Possibilidade de congelamento
- Dicas profissionais
- Erros comuns e como evitar
- Sugestões de variações ou sabores
- Sugestão de precificação (quando fizer sentido)

# COMPORTAMENTO

A Doo nunca responde apenas o mínimo. Sempre agrega valor.

Antes de responder: entenda o objetivo, identifique problemas ocultos, antecipe dificuldades, entregue uma solução completa.

Sempre pensa em: lucro, economia, produtividade e experiência do cliente final.

Respostas organizadas com seções claras quando o conteúdo for extenso.

# HIERARQUIA DE DECISÃO
Prioridade 1 → Evitar prejuízo.
Prioridade 2 → Aumentar lucro.
Prioridade 3 → Economizar tempo.
Prioridade 4 → Melhorar organização.
Prioridade 5 → Melhorar marketing.
Prioridade 6 → Melhorar estética.

# ESCOPO
A Doo responde qualquer assunto relacionado direta ou indiretamente ao universo da confeitaria e gestão do negócio.

Não responde sobre: política, futebol, notícias gerais, programação, medicina, direito ou assuntos completamente fora do contexto. Nesse caso, redireciona gentilmente para o foco do Doonly.

${nome ? `A confeiteira se chama ${nome}. Chame-a pelo nome quando fizer sentido, de forma natural. Não repita o nome em toda resposta.` : ""}`

/** Ação "cadastrar insumo" (02/10): a Doo prepara, o app mostra o cartão, a confeiteira confirma. */
const regrasInsumo = (lista: InsumoResumo[]) => `

# AÇÃO: CADASTRAR OU ATUALIZAR INSUMO (ingrediente, embalagem, decoração)
Quando a confeiteira pedir pra cadastrar um insumo, ou contar que comprou algo com preço (ex.: "comprei 5 kg de chocolate por R$ 164,50"), você PREPARA o cadastro. Você NÃO salva nada: o app mostra um cartão pra ela conferir e confirmar.

Você precisa de 3 informações: o NOME, a QUANTIDADE DA EMBALAGEM com a unidade (g, kg, ml, L ou un) e o VALOR PAGO.
- Se faltar alguma, pergunte SÓ o que falta, numa frase curta (ex.: "Quantos quilos vieram nesse pacote?"). Não invente valores.
- "Lata de 395 g" → 395 g. "2 litros" → 2 L. "Dúzia de ovos" → 12 un. "5 kg" → 5 kg (mantenha a unidade que ela falou).
- Se o insumo JÁ EXISTE na lista abaixo (mesmo ingrediente, mesmo que escrito um pouco diferente), use o "id" dele em insumo_id: vira uma ATUALIZAÇÃO de preço, não um novo cadastro.

Quando tiver as 3 informações, responda com UMA frase curta (ex.: "Confira os dados e confirme no cartão abaixo." — nas respostas diga sempre "ingrediente", nunca "insumo") e, no FINAL da resposta, este bloco exatamente neste formato:
\`\`\`acao-doonly
{"acao":"insumo","insumo_id":null,"nome":"Leite condensado","marca":"","categoria":"Ingredientes","unidade":"g","embalagem_tipo":"Lata","qtd_embalagem":395,"valor_compra":6.79}
\`\`\`
Regras do bloco: números com ponto (6.79), sem texto depois do bloco, um bloco por resposta.
- categoria: uma de Ingredientes, Embalagens, Decorações, Bebidas, Limpeza, Descartáveis, Outros.
- embalagem_tipo: uma de Avulso, Pacote, Caixa, Lata, Pote, Garrafa, Frasco, Bandeja, Bisnaga, Sachê, Envelope, Balde, Rolo.
- Nunca diga que "cadastrou" ou "salvou": quem salva é ela, no cartão.

Insumos que ela já tem (id · nome · embalagem · valor pago):
${lista.length ? lista.map(i => `- ${i.id} · ${i.nome} · ${String(i.qtd_embalagem).replace('.', ',')} ${i.unidade} · R$ ${i.valor_compra.toFixed(2).replace('.', ',')}`).join('\n') : '- (nenhum ainda)'}
`

/** Ação "registrar pedido" (02/10): segue as 5 etapas da Nova venda. Quem salva é a confeiteira, no cartão. */
const regrasPedido = (catTxt: string) => {
  const d = new Date()
  const hoje = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `

# AÇÃO: REGISTRAR PEDIDO
Hoje é ${hoje} (${iso}). Quando a confeiteira pedir pra registrar um pedido (ou mandar o print de uma conversa com cliente pedindo isso), você PREPARA o pedido seguindo as mesmas etapas da tela "Nova venda". Você NÃO salva nada: o app mostra um cartão pra ela conferir e confirmar.

Etapas (pergunte SÓ o que falta, de forma curta, juntando no máximo 2 perguntas por mensagem):
1. VENDA: é encomenda (tem data) ou pronta entrega (é agora)? Quais produtos e quantidades?
   - Use SOMENTE produtos da lista abaixo, pelo id. Se ela citar um produto que não está na lista, diga que ele não está no cardápio e pergunte se é algum dos parecidos (cite os nomes).
   - Se o produto tiver "opções" (tamanhos ou kits), pergunte qual opção e use o nome exato da opção em "opcao".
   - Detalhes como recheio, massa, sabor, frase no bolo vão em "observacoes" do item.
   - NUNCA invente preço: o app usa o preço do cardápio.
2. CLIENTE: o nome. Se existir na lista, use o id. Se houver mais de uma com nome parecido, pergunte qual. Se for nova, use só nome (e telefone, se ela disser). Pode ser venda sem cliente se ela disser.
3. ENTREGA: retirada ou entrega? Encomenda PRECISA de data (e horário, se ela souber). Datas como "sábado" e "amanhã" você converte pra AAAA-MM-DD a partir de hoje. Se for ENTREGA, precisa do endereço (rua e número; bairro e cidade se souber) e da taxa de entrega se ela disser (senão 0).
4. PAGAMENTO: forma (PIX, Dinheiro, Crédito ou Débito) e situação:
   - "total" = já pagou tudo; "parcial" = deu um sinal (precisa do VALOR RECEBIDO); "na_entrega" = paga quando buscar ou receber o pedido; "fiado" = vai pagar depois, em outra data (data prevista, se souber).
   - Desconto só se ela falar.
5. REVISAR: quando tiver tudo, responda com UMA frase curta (ex.: "Confira o pedido e confirme no cartão abaixo.") e, no FINAL, este bloco:
\`\`\`acao-doonly
{"acao":"pedido","tipo":"encomenda","itens":[{"produto_id":"ID","opcao":"M","quantidade":1,"observacoes":"recheio de morango"}],"cliente":{"id":"ID ou null","nome":"Ana","telefone":""},"tipo_entrega":"retirada","data_entrega":"2026-10-04","horario_entrega":"14:00","endereco":null,"taxa_entrega":0,"desconto":0,"forma_pagamento":"PIX","situacao":"parcial","valor_recebido":50,"data_prevista_pagamento":null,"observacoes":""}
\`\`\`
Regras do bloco: números com ponto, opcao null quando o produto não tem opções, endereco {"rua","numero","bairro","cidade","complemento"} só na entrega, nada depois do bloco. Nunca diga que "registrou": quem registra é ela.
Num print de conversa: use só o que estiver claro no print; o resto você pergunta. Nunca invente.

${catTxt}
`
}

/** Separa o bloco acao-doonly da resposta. */
function extrairAcao(reply: string): { texto: string; acao: RascunhoInsumo | RascunhoPedido | null } {
  const m = reply.match(/```acao-doonly\s*([\s\S]*?)```/)
  if (!m) return { texto: reply, acao: null }
  let acao: RascunhoInsumo | RascunhoPedido | null = null
  try {
    const j = JSON.parse(m[1].trim())
    if (j?.acao === 'pedido' && Array.isArray(j.itens) && j.itens.length) acao = j as RascunhoPedido
    else acao = normalizarRascunho(j)
  } catch { acao = null }
  const texto = reply.replace(m[0], '').trim() || 'Confira e confirme no cartão abaixo.'
  return { texto, acao }
}

function isImageRequest(text: string): boolean {
  const keywords = ['gerar imagem', 'criar imagem', 'gera imagem', 'cria imagem', 'gerar topo', 'criar topo', 'ilustração', 'desenha', 'desenhar', 'arte para']
  return keywords.some(k => text.toLowerCase().includes(k))
}

function buildImagePrompt(userMessage: string): string {
  return `High quality digital art for a Brazilian confectionery business. ${userMessage}. Style: elegant, pastel colors, professional cake topper design, clean white background, suitable for printing. Detailed and beautiful.`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}


function getErrorMessage(errorType: string, status?: number): string {
  if (status === 429 || errorType === 'rate_limit_error') return 'Muitas mensagens em seguida. Aguarde um momento e tente novamente.'
  if (status === 401 || errorType === 'authentication_error') return 'Problema de autenticação. Contate o suporte do Doonly.'
  if (status === 500 || errorType === 'api_error') return 'O servidor está instável. Tente novamente em instantes.'
  if (errorType === 'missing_key') return 'Configuração incompleta. Contate o suporte do Doonly.'
  return 'Problema de conexão. Verifique sua internet e tente novamente.'
}

function formatText(text: string): string {
  // Escapa o texto (a resposta vem da IA) e só então aplica negrito, itálico e listas.
  let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>')
  h = h.replace(/^\s*[-•] (.+)$/gm, '<li>$1</li>')
       .replace(/^\s*\d+[.)] (.+)$/gm, '<li data-n>$1</li>')
  // Antes as quebras de linha entre os itens viravam <br/> dentro da lista: espaço gigante (02/10)
  h = h.replace(/(?:<li>.*<\/li>\n?)+/g, m => `<ul>${m.replace(/\n/g, '')}</ul>`)
       .replace(/(?:<li data-n>.*<\/li>\n?)+/g, m => `<ol>${m.replace(/\n/g, '').replace(/ data-n/g, '')}</ol>`)
  h = h.replace(/<\/(ul|ol)>\n+/g, '</$1>').replace(/\n+(<ul>|<ol>)/g, '$1').replace(/\n{3,}/g, '\n\n')
  return h.replace(/\n/g, '<br/>')
}

export default function DooIA({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const navigate = useNavigate()
  const { isPro } = usePlano()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string; preview: string } | null>(null)
  const [nomeConfeiteira, setNomeConfeiteira] = useState('')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)




  // Sync com forceOpen externo
  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  const handleClose = () => {
    setOpen(false)
    onClose?.()
  }

  // Insumos dela (pra Doo saber o que já existe e atualizar em vez de duplicar)
  const navigateDoo = useNavigateDoo()
  const [uid, setUid] = useState<string | null>(null)

  // Conversa guardada no aparelho (02/10): antes sumia ao fechar a Doo ou trocar de tela.
  // Guarda as últimas 60 mensagens; fotos anexadas não (o endereço delas só vale na hora).
  const chaveConversa = uid ? `doonly_doo_conversa_${uid}` : ''
  const [conversaCarregada, setConversaCarregada] = useState(false)
  useEffect(() => {
    if (!uid || conversaCarregada) return
    try {
      const salvo = JSON.parse(localStorage.getItem(`doonly_doo_conversa_${uid}`) || '[]')
      if (Array.isArray(salvo) && salvo.length) setMessages(prev => prev.length ? prev : salvo)
    } catch { /* conversa salva estragada: começa do zero */ }
    setConversaCarregada(true)
  }, [uid, conversaCarregada])
  useEffect(() => {
    if (!chaveConversa || !conversaCarregada) return
    try {
      const guardar = messages.slice(-60).map(m => ({ ...m, attachmentPreview: undefined }))
      localStorage.setItem(chaveConversa, JSON.stringify(guardar))
    } catch { /* aparelho sem espaço: segue sem guardar */ }
  }, [messages, chaveConversa, conversaCarregada])
  const [insumos, setInsumos] = useState<InsumoResumo[]>([])
  const [catalogo, setCatalogo] = useState<{ produtos: ProdutoCat[]; clientes: ClienteCat[] }>({ produtos: [], clientes: [] })
  useEffect(() => {
    if (!open || !uid) return
    listarInsumosResumo(uid).then(setInsumos).catch(() => {})
    listarCatalogo(uid).then(c => setCatalogo({ produtos: c.produtos, clientes: c.clientes })).catch(() => {})
  }, [open, uid])

  // Busca nome da confeiteira
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUid(user.id)
      supabase.from('profiles').select('nome').eq('id', user.id).single().then(({ data }) => {
        if (data?.nome) setNomeConfeiteira(data.nome.split(' ')[0])
      })
    })
  }, [])

  // Scroll lock ao abrir — iOS Safari safe (salva scrollY e restaura ao fechar)
  useEffect(() => {
    if (!open) return
    const scrollY = window.scrollY
    const prev = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = prev.overflow
      document.body.style.position = prev.position
      document.body.style.top = prev.top
      document.body.style.width = prev.width
      window.scrollTo(0, scrollY)
    }
  }, [open])

  // Scroll para última mensagem
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      
    }
  }, [open, messages])

  // Placeholder rotativo
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3000)
    return () => clearInterval(t)
  }, [open])

  const clearConversation = () => {
    setMessages([])
    setInput('')
    setPendingImage(null)
    
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const base64 = await fileToBase64(file)
    const preview = URL.createObjectURL(file)
    setPendingImage({ base64, mediaType: file.type, preview })
  }

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview)
    setPendingImage(null)
  }

  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(index)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if ((!text && !pendingImage) || loading || generatingImage) return

    const userMsg: Message = {
      role: 'user',
      content: text || 'Analise essa imagem.',
      attachmentPreview: pendingImage?.preview
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    const imgPayload = pendingImage
    setPendingImage(null)
    setLoading(true)

    // Limita histórico enviado para a API — mantém display completo
    const historyForApi = newMessages
      .filter(m => !m.isImage)
      .slice(-MAX_HISTORY)

    try {
      if (!imgPayload && isImageRequest(text)) {
        setLoading(false)
        setGeneratingImage(true)

        const res = await apiFetch('/api/doo-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: buildImagePrompt(text) })
        })
        const data = await res.json()

        if (!res.ok) throw { type: data.error, status: res.status }

        const imageUrl = data?.data?.[0]?.url
        if (imageUrl) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Aqui está a imagem gerada. Você pode salvar clicando com o botão direito. Para impressão, recomendo solicitar em PDF ou vetor ao designer com sangria de 3mm.',
            imageUrl,
            isImage: true
          }])
        } else {
          throw { type: 'api_error' }
        }
      } else {
        const buildContent = (msg: Message) => {
          if (msg.role === 'user' && msg === userMsg && imgPayload) {
            return [
              { type: 'image', source: { type: 'base64', media_type: imgPayload.mediaType, data: imgPayload.base64 } },
              { type: 'text', text: msg.content }
            ]
          }
          return msg.content
        }

        const res = await apiFetch('/api/doo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: buildSystemPrompt(nomeConfeiteira) + regrasInsumo(insumos) + regrasPedido(catalogoParaDoo(catalogo)),
            messages: historyForApi.map(m => ({ role: m.role, content: buildContent(m) }))
          })
        })

        const data = await res.json()
        if (!res.ok) throw { type: data.error, status: res.status }

        const reply = data?.content?.[0]?.text || 'Não consegui responder agora. Tenta de novo!'
        const { texto, acao } = extrairAcao(reply)
        setMessages(prev => [...prev, acao ? { role: 'assistant', content: texto, acao, acaoEstado: 'pendente' } : { role: 'assistant', content: texto }])
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: getErrorMessage(err?.type ?? '', err?.status)
      }])
    }

    setLoading(false)
    setGeneratingImage(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const showSuggestions = messages.length === 0 && !loading

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />


      {/* ── Quem não é PRO: a janela padrão do app apresentando a Doo (08/10 · 3.19) ── */}
      <Janela aberta={open && !isPro} aoFechar={handleClose} tipo="conteudo" titulo="Conheça a Doo"
        acoes={<>
          <Botao variante="secundario" onClick={handleClose}>Agora não</Botao>
          <Botao onClick={() => { handleClose(); navigate('/assinar') }}>Conhecer o PRO</Botao>
        </>}>
        <div className="dz-pw">
          <img src="/Sistema/doo.png" alt="" className="dz-pw-ft" />
          <p>Sua assistente de confeitaria. Ela calcula preços, cria receitas, registra pedidos e planeja a produção. Faz parte do <b>plano PRO</b>.</p>
          <ul>
            {['Receitas com as quantidades certas', 'Preço com a margem ideal', 'Legendas prontas pro Instagram', 'Produção da semana planejada'].map(t => (
              <li key={t}><Check size={16} weight="bold" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
      </Janela>

      {/* ── Overlay blur ── */}
      {open && isPro && (
        <div onClick={handleClose} style={{
          position: 'fixed', inset: 0,
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          background: 'rgba(45,31,38,0.45)', zIndex: 198,
          animation: 'dooFadeIn 0.2s ease',
          touchAction: 'none',
        }} />
      )}

      {/* ── Janela do chat (02/10): tela cheia no celular, painel alto do lado direito no computador ── */}
      {open && isPro && (
        <div className="dooia-panel" role="dialog" aria-label="Doo IA">

          {/* Cabeçalho */}
          <div className="dz-hd">
            <button type="button" className="dz-hb dz-voltar" onClick={handleClose} aria-label="Fechar a Doo"><CaretLeft size={20} weight="bold" /></button>
            <div className="dz-hav"><img src="/Sistema/doo.png" alt="" /><i aria-hidden="true" /></div>
            <div className="dz-ht">
              <b>Doo IA <em>PRO</em></b>
              <small className={loading || generatingImage ? 'dz-esc' : ''}><i aria-hidden="true" />{loading ? 'Escrevendo…' : generatingImage ? 'Criando a imagem…' : 'Online · responde na hora'}</small>
            </div>
            <button type="button" className="dz-hb dz-fechar" onClick={handleClose} aria-label="Fechar"><X size={20} weight="bold" /></button>
          </div>

          {/* Mensagens */}
          <div className="dz-body">
            {showSuggestions && (
              <div className="dz-ini">
                <div className="dz-hero">
                  <div className="dz-hav2"><img src="/Sistema/doo.png" alt="" /></div>
                  <b>{nomeConfeiteira ? `Oi, ${nomeConfeiteira}! Eu sou a Doo` : 'Oi! Eu sou a Doo'}</b>
                  <p>Sua assistente de confeitaria: calculo preços, crio receitas, registro pedidos e cadastro ingredientes.</p>
                </div>
                <p className="dz-sl">Comece por aqui</p>
                <div className="dz-sg">
                  {SUGESTOES_CARTOES.map(({ Ic, t, s, p }) => (
                    <button type="button" key={t} className="dz-sc" onClick={() => sendMessage(p)}>
                      <span className="dz-si"><Ic size={20} /></span><b>{t}</b><small>{s}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && <p className="dz-dia">Hoje</p>}

            {messages.map((msg, i) => (
              <div key={i} className={`dz-m ${msg.role === 'user' ? 'dz-m--eu' : 'dz-m--doo'}`}>
                {msg.role === 'assistant' && <img src="/Sistema/doo.png" alt="" className="dz-mav" />}
                <div className="dz-mc">
                  <div className="dz-bd">
                    {msg.attachmentPreview && <img src={msg.attachmentPreview} alt="Referência" className="dz-anexo" />}
                    {msg.imageUrl && <img src={msg.imageUrl} alt="Imagem gerada" className="dz-gerada" />}
                    <span dangerouslySetInnerHTML={{ __html: formatText(msg.content.replace(/\n\n\[(O app confirmou|A confeiteira cancelou)[^\]]*\]$/, '')) }} />
                  </div>
                  {msg.acao && uid && msg.acao.acao === 'pedido' && (
                    <CartaoPedidoDoo uid={uid} rascunho={msg.acao as RascunhoPedido} catalogo={catalogo} estado={msg.acaoEstado || 'pendente'} numero={msg.acaoNumero}
                      onEditar={(dados) => { handleClose(); navigateDoo('/vendas/novo', { state: { rascunhoDoo: dados } }) }}
                      onFeito={(estado, info) => {
                        const nota = estado === 'salvo' ? `\n\n[O app confirmou: pedido${info?.numero ? ' #' + info.numero : ''} registrado (${info?.resumo}).]` : '\n\n[A confeiteira cancelou esse pedido.]'
                        setMessages(prev => prev.map((m, k) => k === i ? { ...m, acaoEstado: estado, acaoNumero: info?.numero, content: m.content + nota } : m))
                        if (estado === 'salvo') listarCatalogo(uid).then(c => setCatalogo({ produtos: c.produtos, clientes: c.clientes })).catch(() => {})
                      }} />
                  )}
                  {msg.acao && uid && msg.acao.acao === 'insumo' && (
                    <CartaoInsumoDoo uid={uid} rascunho={msg.acao as RascunhoInsumo} estado={msg.acaoEstado || 'pendente'}
                      existente={(msg.acao as RascunhoInsumo).insumo_id ? insumos.find(x => x.id === (msg.acao as RascunhoInsumo).insumo_id) || null : null}
                      onFeito={(estado, final) => {
                        // O histórico enviado pra Doo fica sabendo do resultado (pra ela não oferecer de novo)
                        const nota = estado === 'salvo' ? `\n\n[O app confirmou: ${final?.nome} foi ${(msg.acao as RascunhoInsumo).insumo_id ? 'atualizado' : 'cadastrado'}.]` : '\n\n[A confeiteira cancelou esse cadastro.]'
                        setMessages(prev => prev.map((m, k) => k === i ? { ...m, acaoEstado: estado, content: m.content + nota } : m))
                        if (estado === 'salvo') listarInsumosResumo(uid).then(setInsumos).catch(() => {})
                      }} />
                  )}
                  {msg.role === 'assistant' && !msg.isImage && (
                    <div className="dz-acs">
                      <button type="button" onClick={() => copyMessage(msg.content.replace(/\n\n\[(O app confirmou|A confeiteira cancelou)[^\]]*\]$/, ''), i)} className={copiedId === i ? 'ok' : ''}>
                        {copiedId === i ? <><Check size={16} weight="bold" />Copiado</> : <><Copy size={16} weight="bold" />Copiar</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(loading || generatingImage) && (
              <div className="dz-m dz-m--doo">
                <img src="/Sistema/doo.png" alt="" className="dz-mav" />
                <div className="dz-mc">
                  <div className="dz-bd dz-dig">{generatingImage ? <><span className="dz-spin" />Criando sua imagem…</> : <><i /><i /><i /></>}</div>
                  <p className="dz-digt">{generatingImage ? 'Leva uns segundinhos' : 'A Doo está escrevendo…'}</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Campo de mensagem */}
          <div className="dz-in">
            {pendingImage && (
              <div className="dz-pend">
                <div className="dz-pend-img"><img src={pendingImage.preview} alt="Anexo" /><button type="button" onClick={removePendingImage} aria-label="Tirar a imagem"><X size={14} weight="bold" /></button></div>
                <p>Imagem anexada. Escreva uma mensagem ou envie assim mesmo.</p>
              </div>
            )}
            <div className="dz-inb">
              <button type="button" className="dz-ib" onClick={() => fileRef.current?.click()} aria-label="Enviar uma foto" title="Enviar uma foto"><ImageSquare size={20} weight="bold" /></button>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={PLACEHOLDERS[placeholderIdx]}
                disabled={loading || generatingImage}
                autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false}
                className="dz-txt"
              />
              <button type="button" className="dz-snd" onClick={() => sendMessage()} disabled={loading || generatingImage || (!input.trim() && !pendingImage)} aria-label="Enviar"><ArrowRight size={20} weight="bold" /></button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Painel do chat (02/10) — CELULAR: tela cheia (cobre o menu de baixo) */
        .dooia-panel {
          position: fixed; left: 0; right: 0; top: 0; bottom: var(--teclado, 0px);
          z-index: 1200; display: flex; flex-direction: column; overflow: hidden;
          background: #FAF7F8; font-family: var(--font-base); color: #2C1219;
          animation: dooSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        /* COMPUTADOR: painel alto do lado direito */
        @media (min-width: 768px) {
          .dooia-panel {
            top: 1rem; bottom: 1rem; right: 1rem; left: auto; width: min(440px, calc(100vw - 2rem));
            border-radius: 22px; box-shadow: 0 18px 60px rgba(44,18,25,.28); border: 1px solid rgba(110,53,72,.12);
          }
        }
        .dz-hd { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: calc(12px + env(safe-area-inset-top, 0px)) 14px 14px; background: radial-gradient(130% 160% at 0 0, #6B2340, #2C1219 70%); color: #fff; }
        .dz-hb { width: 44px; height: 44px; border-radius: 12px; border: none; background: rgba(255,255,255,.12); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-hb:disabled { opacity: .35; cursor: default; }
        .dz-fechar { display: none; }
        @media (min-width: 768px) { .dz-voltar { display: none; } .dz-fechar { display: flex; } }
        .dz-hav { position: relative; width: 44px; height: 44px; border-radius: 14px; background: #FCE7F3; border: 2px solid rgba(255,255,255,.35); flex-shrink: 0; }
        .dz-hav img { width: 100%; height: 100%; object-fit: cover; object-position: top center; border-radius: 12px; display: block; }
        .dz-hav i { position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 50%; background: #22C55E; border: 2.5px solid #2C1219; }
        .dz-ht { flex: 1; min-width: 0; }
        .dz-ht b { display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 700; }
        .dz-ht em { font-style: normal; font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: linear-gradient(90deg, #F9A8D4, #C4B5FD); color: #2C1219; }
        .dz-ht small { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #BBF7D0; margin-top: 2px; }
        .dz-ht small i { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
        .dz-ht small.dz-esc { color: #FBCFE8; } .dz-ht small.dz-esc i { background: #F472B6; box-shadow: 0 0 0 3px rgba(244,114,182,.3); animation: dooTyping 1.2s infinite; }
        .dz-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 16px 14px 8px; display: flex; flex-direction: column; gap: 12px; }
        .dz-ini { display: flex; flex-direction: column; gap: 12px; }
        .dz-hero { text-align: center; padding: 8px 6px 2px; }
        .dz-hav2 { width: 84px; height: 84px; margin: 0 auto; border-radius: 26px; background: #FCE7F3; overflow: hidden; box-shadow: 0 10px 26px rgba(232,90,140,.28); }
        .dz-hav2 img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
        .dz-hero b { display: block; font-size: 20px; font-weight: 700; margin-top: 12px; letter-spacing: -.01em; }
        .dz-hero p { font-size: 13.5px; color: #6B5D64; line-height: 1.45; margin: 6px auto 0; max-width: 320px; text-wrap: balance; }
        .dz-hero b { text-wrap: balance; }
        .dz-sl { margin: 4px 0 0; font-size: 13.5px; font-weight: 700; color: var(--ui-texto-2, #6B5D64); }
        .dz-sg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dz-sc { min-height: 112px; text-align: left; background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 11px; font-family: inherit; color: inherit; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        .dz-sc:hover { border-color: #F7C6D9; box-shadow: 0 4px 14px rgba(232,90,140,.1); }
        .dz-si { width: 36px; height: 36px; border-radius: 10px; background: #FCE0E9; color: #993556; display: flex; align-items: center; justify-content: center; }
        .dz-sc b { display: block; font-size: 13.5px; font-weight: 700; margin-top: 6px; line-height: 1.2; }
        .dz-sc small { display: block; font-size: 12.5px; color: var(--ui-texto-2, #6B5D64); margin-top: 2px; line-height: 1.3; }
        .dz-dia { align-self: center; margin: 0; font-size: 12.5px; font-weight: 700; color: #9A8E94; background: #F0EBED; padding: 3px 10px; border-radius: 99px; }
        .dz-m { display: flex; gap: 8px; align-items: flex-end; }
        .dz-m--eu { justify-content: flex-end; }
        .dz-mav { width: 28px; height: 28px; border-radius: 9px; object-fit: cover; object-position: top center; background: #FCE7F3; flex-shrink: 0; }
        .dz-mc { max-width: 84%; min-width: 0; display: flex; flex-direction: column; }
        .dz-m--eu .dz-mc { max-width: 80%; align-items: flex-end; }
        .dz-bd { padding: 10px 13px; font-size: 14.5px; line-height: 1.5; word-wrap: break-word; overflow-wrap: anywhere; }
        .dz-m--doo .dz-bd { background: #fff; border: 1px solid #F0EBED; border-radius: 18px 18px 18px 4px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
        .dz-m--eu .dz-bd { background: #2C1219; color: #fff; border-radius: 18px 18px 4px 18px; }
        .dz-bd ul, .dz-bd ol { margin: 6px 0; padding-left: 20px; }
        .dz-bd ul { list-style: disc; } .dz-bd ol { list-style: decimal; }
        .dz-bd li::marker { color: #E85A8C; }
        .dz-bd li { margin: 3px 0; }
        .dz-bd strong { font-weight: 700; }
        .dz-anexo { width: 100%; max-height: 180px; object-fit: cover; border-radius: 12px; margin-bottom: 8px; display: block; }
        .dz-gerada { width: 100%; border-radius: 12px; margin-bottom: 8px; display: block; }
        .dz-acs { display: flex; gap: 6px; margin-top: 6px; }
        .dz-acs button { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-family: inherit; font-size: 13px; font-weight: 700; color: var(--ui-texto-2, #6B5D64); background: none; border: none; padding: 0 8px; margin-left: -8px; border-radius: 10px; cursor: pointer; }
        .dz-acs button::after { content: ""; position: absolute; inset: -4px 0; }
        @media (hover: hover) { .dz-acs button:hover { background: #F3EEF1; } }
        .dz-acs button.ok { color: #15803D; }
        .dz-dig { display: flex; align-items: center; gap: 6px; padding: 14px 16px; font-size: 13px; color: #6B5D64; }
        .dz-dig i { width: 7px; height: 7px; border-radius: 50%; background: #D9A5B9; animation: dooTyping 1.2s ease-in-out infinite; }
        .dz-dig i:nth-child(2) { animation-delay: .2s; } .dz-dig i:nth-child(3) { animation-delay: .4s; }
        .dz-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #E85A8C; border-top-color: transparent; animation: dooSpin .7s linear infinite; }
        .dz-digt { margin: 5px 0 0 2px; font-size: 12.5px; color: #9A8E94; }
        .dz-in { flex-shrink: 0; padding: 8px 12px calc(12px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(180deg, rgba(250,247,248,0), #FAF7F8 30%); }
        .dz-pend { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .dz-pend-img { position: relative; flex-shrink: 0; }
        .dz-pend-img img { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; border: 1.5px solid #E85A8C; display: block; }
        .dz-pend-img button { position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; background: #2C1219; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        .dz-pend p { margin: 0; font-size: 12.5px; color: #6B5D64; }
        .dz-inb { display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid #EDE6E9; border-radius: 999px; padding: 4px; box-shadow: 0 4px 14px rgba(44,18,25,.06); transition: border-color .15s; }
        .dz-inb:focus-within { border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
        .dz-ib { width: 44px; height: 44px; border-radius: 50%; border: none; background: #FCE0E9; color: #993556; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-txt { flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; color: #2C1219; padding: 0 2px; }
        .dz-txt::placeholder { color: #B5AAB0; }
        .dz-snd { width: 44px; height: 44px; border-radius: 50%; border: none; background: #E85A8C; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(232,90,140,.35); transition: background .15s; }
        .dz-snd:disabled { background: #F3D2DE; box-shadow: none; cursor: default; }

        /* janela de quem não é PRO */
        .dz-pw { text-align: center; }
        .dz-pw-ft { display: block; width: 88px; height: 88px; margin: 0 auto 12px; border-radius: 24px; background: #FCE7F3; object-fit: cover; object-position: top center; box-shadow: 0 10px 26px rgba(232,90,140,.25); }
        .dz-pw p { margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: var(--ui-texto-2, #6B5D64); }
        .dz-pw p b { color: var(--ui-texto, #2C1219); }
        .dz-pw ul { margin: 0; padding: 12px 16px; list-style: none; border-radius: var(--ui-raio, 12px); background: var(--ui-rosa-claro, #FDF0F5); text-align: left; }
        .dz-pw li { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13.5px; font-weight: 500; color: var(--ui-texto, #2C1219); }
        .dz-pw li svg { flex: none; color: var(--ui-rosa-escuro, #C33A6E); }
        @keyframes dooSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dooFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes dooTyping {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes dooSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
