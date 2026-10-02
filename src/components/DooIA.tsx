import { useState, useRef, useEffect } from 'react'
import { useNavigate as useNavigateDoo } from 'react-router-dom'
import CartaoPedidoDoo from '@/components/doo/CartaoPedidoDoo'
import { listarCatalogo, catalogoParaDoo, type RascunhoPedido, type ProdutoCat, type ClienteCat } from '@/lib/pedidosDoo'
import CartaoInsumoDoo from '@/components/doo/CartaoInsumoDoo'
import { listarInsumosResumo, normalizarRascunho, type InsumoResumo, type RascunhoInsumo } from '@/lib/insumosDoo'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'
import { apiFetch } from "@/lib/apiFetch";

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

const VINHO = 'var(--primary-dark)'
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

const PLACEHOLDERS = [
  'Pergunte para a Doo...',
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

Sempre pensa em: lucro, economia, produtividade e experiência da cliente final.

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

Quando tiver as 3 informações, responda com UMA frase curta (ex.: "Confira e toque em Cadastrar insumo.") e, no FINAL da resposta, este bloco exatamente neste formato:
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
4. PAGAMENTO: forma (PIX, Dinheiro, Cartão ou Boleto) e situação:
   - "total" = já pagou tudo; "parcial" = deu um sinal (precisa do VALOR RECEBIDO); "fiado" = vai pagar depois (data prevista, se souber).
   - Desconto só se ela falar.
5. REVISAR: quando tiver tudo, responda com UMA frase curta (ex.: "Confira o pedido e toque em Registrar.") e, no FINAL, este bloco:
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
  const texto = reply.replace(m[0], '').trim() || 'Confira e toque no botão do cartão.'
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
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n)?)+/g, (match) => `<ul style="margin: 4px 0 4px 1rem; padding: 0; list-style: disc;">${match}</ul>`)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br/>')
}

export default function DooIA({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const navigate = useNavigate()
  const { isPro, loading: planoLoading } = usePlano()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [pulse] = useState(false)
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


      {/* ── Botão flutuante ── */}
      <button
        onClick={() => {
          if (planoLoading) return
          if (!isPro) { setOpen(true); return }
          setOpen(o => !o)
        }}
        style={{
          position: 'fixed', bottom: 'var(--doo-btn-bottom, 7rem)', right: 'var(--doo-btn-right, 1.25rem)',
          width: '62px', height: '62px', borderRadius: '35%',
          border: 'none', background: 'transparent', cursor: 'pointer',
          zIndex: 200, padding: 0,
          display: 'none',
          alignItems: 'center', justifyContent: 'center',
        }}
        data-tour="doo"
        aria-label="Abrir assistente Doo"
      >
        <div style={{
          width: '58px', height: '58px', borderRadius: '35%', background: VINHO,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(110,53,72,0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}>
          <div style={{
            width: '51px', height: '51px', borderRadius: '35%', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}>
            <img src="/Sistema/doo.png" alt="Doo" style={{ width: '70px', height: '70px', borderRadius: '35%', objectFit: 'cover', objectPosition: 'top center' }} />
          </div>
        </div>
        {pulse && <span style={{ position: 'absolute', inset: 0, borderRadius: '35%', border: `2px solid ${VINHO}`, animation: 'dooPulse 1.5s ease-out infinite' }} />}
      </button>

      {/* ── Modal de upgrade para FREE ── */}
      {open && !isPro && (
        <>
          <div onClick={handleClose} style={{
            position: 'fixed', inset: 0,
            backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            background: 'rgba(0,0,0,0.45)', zIndex: 9998,
            animation: 'dooFadeIn 0.2s ease',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(380px, calc(100vw - 2rem))',
            background: 'white', borderRadius: '20px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            zIndex: 9999, padding: '1.75rem 1.5rem 1.5rem',
            fontFamily: 'inherit', animation: 'dooFadeIn 0.25s ease',
            textAlign: 'center',
          }}>
            <button onClick={handleClose} style={{
              position: 'absolute', top: 12, right: 12, width: 32, height: 32,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted,var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>

            <div style={{
              width: 80, height: 80, borderRadius: '28%', background: VINHO,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', boxShadow: '0 8px 24px rgba(110,53,72,0.25)',
            }}>
              <div style={{ width: 68, height: 68, borderRadius: '28%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <img src="/Sistema/doo.png" alt="Doo" style={{ width: 90, height: 90, objectFit: 'cover', objectPosition: 'top center' }} />
              </div>
            </div>

            <h3 style={{
              fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-title,var(--text-title))',
              margin: '0 0 6px', letterSpacing: '-0.02em',
            }}>
              Conheça a Doo
            </h3>

            <p style={{
              fontSize: '0.88rem', color: 'var(--text-secondary,var(--primary-dark))',
              margin: '0 0 1.25rem', lineHeight: 1.5,
            }}>
              Sua consultora de confeitaria exclusiva. Calcule preços, crie receitas, planeje produção e muito mais — disponível apenas no <strong style={{ color: VINHO }}>plano PRO</strong>.
            </p>

            <div style={{
              background: 'var(--bg-subtle,var(--bg-subtle))', borderRadius: 12, padding: '0.85rem 1rem',
              marginBottom: '1.25rem', textAlign: 'left',
            }}>
              {[
                'Receitas personalizadas e profissionais',
                'Cálculo de preço com margem ideal',
                'Legendas prontas para o Instagram',
                'Planejamento de produção semanal',
              ].map((feat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: 'var(--text-title,var(--text-title))', padding: '4px 0' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={VINHO} strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                  {feat}
                </div>
              ))}
            </div>

            <button
              onClick={() => { handleClose(); navigate('/assinar') }}
              style={{
                width: '100%', background: VINHO, color: 'white', border: 'none',
                borderRadius: 12, padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 12px rgba(110,53,72,0.25)',
                marginBottom: 8,
              }}
            >
              Conhecer o plano PRO
            </button>
            <button
              onClick={handleClose}
              style={{
                width: '100%', background: 'transparent', color: 'var(--text-muted,var(--text-muted))',
                border: 'none', padding: '0.5rem', fontSize: '0.82rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Agora não
            </button>
          </div>
        </>
      )}

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

      {/* ── Janela do chat ── */}
      {open && isPro && (
        <div className="dooia-panel" style={{
          background: 'white',
          boxShadow: '0 8px 40px rgba(110,53,72,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          zIndex: 199, border: `1px solid rgba(110,53,72,0.12)`,
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${VINHO}, var(--primary-dark))`,
            padding: '0.85rem 1rem',
            display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0,
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '35%',
              background: VINHO, border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              <img src="/Sistema/doo.png" alt="Doo" style={{ width: '48px', height: '48px', objectFit: 'cover', objectPosition: 'top center', borderRadius: '35%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'white', fontFamily: 'Geist, sans-serif' }}>
                Doo
                <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'rgba(255,220,150,0.88)', marginLeft: '0.35rem' }}>— Assistente Doonly</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              {messages.length > 0 && (
                <button
                  onClick={clearConversation}
                  title="Nova conversa"
                  style={{
                    background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '8px',
                    width: '28px', height: '28px', color: 'white', cursor: 'pointer',
                    fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.53"/>
                  </svg>
                </button>
              )}
              <button
                onClick={handleClose}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '35%',
                  width: '28px', height: '28px', color: 'white', cursor: 'pointer',
                  fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            </div>
          </div>

          {/* Mensagens */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '0.85rem',
            display: 'flex', flexDirection: 'column', gap: '0.65rem', background: '#fafafa',
          }}>

            {/* Estado vazio — boas-vindas + sugestões */}
            {showSuggestions && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.25rem 0' }}>
                <div style={{
                  background: 'white', borderRadius: '16px 16px 16px 4px',
                  padding: '0.75rem 1rem', border: '1px solid #f0f0f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  fontSize: '0.83rem', lineHeight: 1.5, color: '#1F2937',
                  fontFamily: 'Geist, sans-serif',
                }}>
                  {nomeConfeiteira ? `Oi, ${nomeConfeiteira}! Sou a Doo, sua assistente do Doonly. Como posso te ajudar hoje?` : 'Oi! Sou a Doo, sua assistente do Doonly. Como posso te ajudar hoje?'}
                </div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'Geist, sans-serif', paddingLeft: '2px' }}>
                  Sugestões
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      style={{
                        background: 'white', border: `1px solid rgba(110,53,72,0.2)`,
                        borderRadius: '20px', padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem', color: VINHO, cursor: 'pointer',
                        fontFamily: 'Geist, sans-serif', fontWeight: 500,
                        transition: 'background 0.15s, border-color 0.15s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end', gap: '0.5rem',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{ width: '26px', height: '26px', borderRadius: '35%', border: `2px solid ${VINHO}`, overflow: 'hidden', flexShrink: 0 }}>
                    <img src="/Sistema/doo.png" alt="Doo" style={{ width: '140%', height: '140%', objectFit: 'cover', objectPosition: 'top center' }} />
                  </div>
                )}
                <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{
                    background: msg.role === 'user' ? VINHO : 'white',
                    color: msg.role === 'user' ? 'white' : '#1F2937',
                    padding: '0.6rem 0.85rem',
                    borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    fontSize: '0.83rem', lineHeight: 1.5, fontFamily: 'Geist, sans-serif',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    border: msg.role === 'assistant' ? '1px solid #f0f0f0' : 'none',
                  }}>
                    {msg.attachmentPreview && (
                      <img src={msg.attachmentPreview} alt="Referência"
                        style={{ width: '100%', borderRadius: '10px', marginBottom: '0.5rem', display: 'block', maxHeight: '160px', objectFit: 'cover' }} />
                    )}
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="Imagem gerada"
                        style={{ width: '100%', borderRadius: '10px', marginBottom: '0.5rem', display: 'block' }} />
                    )}
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
                    <button
                      onClick={() => copyMessage(msg.content, i)}
                      style={{
                        alignSelf: 'flex-start', background: 'none', border: 'none',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '2px 6px', borderRadius: '6px', fontSize: '0.7rem',
                        color: copiedId === i ? '#22C55E' : '#9CA3AF',
                        fontFamily: 'Geist, sans-serif', transition: 'color 0.15s',
                      }}
                      title="Copiar resposta"
                    >
                      {copiedId === i ? (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Copiado</>
                      ) : (
                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copiar</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading text */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '35%', border: `2px solid ${VINHO}`, overflow: 'hidden', flexShrink: 0 }}>
                  <img src="/Sistema/doo.png" alt="Doo" style={{ width: '140%', height: '140%', objectFit: 'cover', objectPosition: 'top center' }} />
                </div>
                <div style={{
                  background: 'white', padding: '0.65rem 1rem', borderRadius: '16px 16px 16px 4px',
                  border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  display: 'flex', gap: '4px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: '6px', height: '6px', borderRadius: '35%',
                      background: VINHO, opacity: 0.6,
                      animation: `dooTyping 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Loading imagem — feedback diferenciado */}
            {generatingImage && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '35%', border: `2px solid ${VINHO}`, overflow: 'hidden', flexShrink: 0 }}>
                  <img src="/Sistema/doo.png" alt="Doo" style={{ width: '140%', height: '140%', objectFit: 'cover', objectPosition: 'top center' }} />
                </div>
                <div style={{
                  background: 'white', padding: '0.65rem 1rem', borderRadius: '16px 16px 16px 4px',
                  border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '35%', border: `2px solid ${VINHO}`, borderTopColor: 'transparent', animation: 'dooSpin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Geist, sans-serif' }}>Gerando sua imagem...</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Preview imagem pendente */}
          {pendingImage && (
            <div style={{
              padding: '0.5rem 0.75rem 0', background: 'white',
              borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={pendingImage.preview} alt="Anexo"
                  style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: `1.5px solid ${VINHO}` }} />
                <button onClick={removePendingImage} style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  width: '18px', height: '18px', borderRadius: '35%',
                  background: VINHO, border: '2px solid white',
                  color: 'white', fontSize: '0.6rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>✕</button>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Geist, sans-serif' }}>
                Imagem anexada. Adicione uma mensagem ou envie diretamente.
              </p>
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: '0.6rem 0.75rem', borderTop: '1px solid #f0f0f0',
            display: 'flex', gap: '0.35rem', background: 'white',
            flexShrink: 0, alignItems: 'center',
            overflow: 'hidden', minWidth: 0,
          }}>
            <button onClick={() => fileRef.current?.click()} title="Enviar imagem da galeria"
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: '#f5f5f5', border: '1px solid #E9E9EE',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={VINHO} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>


            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              disabled={loading || generatingImage}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              style={{
                flex: 1, minWidth: 0, border: `1.5px solid ${input || pendingImage ? VINHO : '#E9E9EE'}`,
                borderRadius: '12px', padding: '0.55rem 0.75rem',
                fontSize: '0.83rem', fontFamily: 'Geist, sans-serif',
                outline: 'none', color: '#1F2937', background: '#fafafa',
                transition: 'border-color 0.15s',
              }}
            />

            <button
              onClick={() => sendMessage()}
              disabled={loading || generatingImage || (!input.trim() && !pendingImage)}
              style={{
                width: '36px', height: '36px', borderRadius: '12px',
                background: (input.trim() || pendingImage) ? `linear-gradient(135deg, ${VINHO}, var(--primary-dark))` : '#E9E9EE',
                border: 'none',
                cursor: (input.trim() || pendingImage) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'background 0.15s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        :root {
          --doo-btn-bottom: 7rem;
          --doo-btn-right: 1.25rem;
        }
        @media (min-width: 768px) {
          :root {
            --doo-btn-bottom: 2rem;
            --doo-btn-right: 2.25rem;
          }
        }

        /* Painel do chat — MOBILE: centralizado, quase tela cheia */
        .dooia-panel {
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: calc(100vw - 24px);
          max-width: 420px;
          height: calc(100dvh - 32px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
          max-height: 720px;
          border-radius: 20px;
          animation: dooPanelIn 0.28s cubic-bezier(0.16,1,0.3,1);
        }

        /* DESKTOP: volta pro canto inferior direito */
        @media (min-width: 768px) {
          .dooia-panel {
            top: auto; left: auto;
            transform: none;
            bottom: 1.5rem;
            right: 1.25rem;
            width: min(380px, calc(100vw - 2.5rem));
            height: min(560px, calc(100vh - 5rem));
            max-height: none;
            animation: dooSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);
          }
        }

        @keyframes dooPanelIn {
          from { opacity: 0; transform: translate(-50%, -46%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes dooPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.7); opacity: 0; }
        }
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
