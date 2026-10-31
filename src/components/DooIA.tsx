import { pegarPedidoDoo } from '@/components/MenuContaItens'
import { useState, useRef, useEffect } from 'react'
import { CaretLeft, X, Check, Copy, ImageSquare, ArrowRight, CurrencyCircleDollar, BookOpenText, InstagramLogo, CalendarCheck, Receipt, Package, NotePencil, DownloadSimple } from '@phosphor-icons/react'
import { useNavigate as useNavigateDoo } from 'react-router-dom'
import CartaoPedidoDoo from '@/components/doo/CartaoPedidoDoo'
import { listarCatalogo, catalogoParaDoo, type RascunhoPedido, type ProdutoCat, type ClienteCat } from '@/lib/pedidosDoo'
import CartaoInsumoDoo from '@/components/doo/CartaoInsumoDoo'
import { listarInsumosResumo, normalizarRascunho, type InsumoResumo, type RascunhoInsumo } from '@/lib/insumosDoo'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'
import { apiFetch } from "@/lib/apiFetch";
import { resumoDoNegocio } from "@/lib/resumoDoo";
import { avisar, confirmar } from '@/components/base'
import { useSobreposicao } from '@/components/base/useSobreposicao'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  isImage?: boolean
  attachmentPreview?: string
  /** Rascunho de cadastro que a Doo preparou (só é salvo quando ela confirma no cartão) */
  acao?: RascunhoInsumo | RascunhoPedido
  /** 'editando' (11/10): ela tocou em "Editar" e o rascunho foi pra Nova venda (o cartão não registra mais por aqui) */
  acaoEstado?: 'pendente' | 'salvo' | 'cancelado' | 'editando'
  /** número do pedido registrado (pra mostrar no cartão) */
  acaoNumero?: string | number
  /** (11/10) aviso de erro do próprio app: aparece na conversa, mas NÃO vai pra IA */
  erro?: boolean
  /** (11/10) o erro se resolve começando outra conversa: mostra o botão embaixo */
  oferecerNova?: boolean
  /** (11/10) a resposta bateu no limite de tamanho e veio cortada */
  cortada?: boolean
}

const MAX_HISTORY = 12

/** Sugestões do começo da conversa (cartões com ícone de linha) */
const SUGESTOES_CARTOES = [
  { Ic: CurrencyCircleDollar, t: 'Calcular preço', s: 'de um bolo ou doce', p: 'Calcular o preço de um bolo' },
  { Ic: BookOpenText, t: 'Criar receita', s: 'com o que você tem', p: 'Criar receita de bolo' },
  { Ic: InstagramLogo, t: 'Legenda para o Instagram', s: 'pronta para postar', p: 'Criar legenda para o Instagram' },
  { Ic: CalendarCheck, t: 'Planejar a semana', s: 'produção e compras', p: 'Planejar produção da semana' },
  { Ic: Receipt, t: 'Registrar pedido', s: 'direto pela conversa', p: 'Registrar um pedido' },
  { Ic: Package, t: 'Cadastrar ingrediente', s: 'com preço e custo', p: 'Cadastrar um ingrediente' },
]

const PLACEHOLDERS = [
  'Pergunte qualquer coisa para a Doo…',
  'Calcular preço de bolo...',
  'Criar legenda para Instagram...',
  'Planejar produção da semana...',
  'Mensagem para o cliente...',
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
Quando a confeiteira pedir para cadastrar um insumo, ou contar que comprou algo com preço (ex.: "comprei 5 kg de chocolate por R$ 164,50"), você PREPARA o cadastro. Você NÃO salva nada: o app mostra um cartão para ela conferir e confirmar.

Você precisa de 3 informações: o NOME, a QUANTIDADE DA EMBALAGEM com a unidade (g, kg, ml, L ou un) e o VALOR PAGO.
- Se faltar alguma, pergunte SÓ o que falta, em uma frase curta (ex.: "Quantos quilos vieram nesse pacote?"). Não invente valores.
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
Hoje é ${hoje} (${iso}). Quando a confeiteira pedir para registrar um pedido (ou mandar o print de uma conversa com cliente pedindo isso), você PREPARA o pedido seguindo as mesmas etapas da tela "Nova venda". Você NÃO salva nada: o app mostra um cartão para ela conferir e confirmar.

Etapas (pergunte SÓ o que falta, de forma curta, juntando no máximo 2 perguntas por mensagem):
1. VENDA: é encomenda (tem data) ou pronta entrega (é agora)? Quais produtos e quantidades?
   - Use SOMENTE produtos da lista abaixo, pelo id. Se ela citar um produto que não está na lista, diga que ele não está no cardápio e pergunte se é algum dos parecidos (cite os nomes).
   - Se o produto tiver "opções" (tamanhos ou kits), pergunte qual opção e use o nome exato da opção em "opcao".
   - Detalhes como recheio, massa, sabor, frase no bolo vão em "observacoes" do item.
   - NUNCA invente preço: o app usa o preço do cardápio.
2. CLIENTE: o nome. Se existir na lista, use o id. Se houver mais de uma com nome parecido, pergunte qual. Se for nova, use só nome (e telefone, se ela disser). Pode ser venda sem cliente se ela disser.
3. ENTREGA: retirada ou entrega? Encomenda PRECISA de data (e horário, se ela souber). Datas como "sábado" e "amanhã" você converte para AAAA-MM-DD a partir de hoje. Se for ENTREGA, precisa do endereço (rua e número; bairro e cidade se souber) e da taxa de entrega se ela disser (senão 0).
4. PAGAMENTO: forma (PIX, Dinheiro, Crédito ou Débito) e situação:
   - "total" = já pagou tudo; "parcial" = deu um sinal (precisa do VALOR RECEBIDO); "na_entrega" = paga quando buscar ou receber o pedido; "fiado" = vai pagar depois, em outra data (data prevista, se souber).
   - Desconto só se ela falar.
5. REVISAR: quando tiver tudo, responda com UMA frase curta (ex.: "Confira o pedido e confirme no cartão abaixo.") e, no FINAL, este bloco:
\`\`\`acao-doonly
{"acao":"pedido","tipo":"encomenda","itens":[{"produto_id":"ID","opcao":"M","quantidade":1,"observacoes":"recheio de morango"}],"cliente":{"id":"ID ou null","nome":"Ana","telefone":""},"tipo_entrega":"retirada","data_entrega":"2026-10-04","horario_entrega":"14:00","endereco":null,"taxa_entrega":0,"desconto":0,"forma_pagamento":"PIX","situacao":"parcial","valor_recebido":50,"data_prevista_pagamento":null,"observacoes":""}
\`\`\`
Regras do bloco: números com ponto, opcao null quando o produto não tem opções, endereco {"rua","numero","bairro","cidade","complemento"} só na entrega, nada depois do bloco. Nunca diga que "registrou": quem registra é ela.
Em um print de conversa: use só o que estiver claro no print; o resto você pergunta. Nunca invente.

${catTxt}
`
}

/** Separa o bloco acao-doonly da resposta. */
function extrairAcao(reply: string): { texto: string; acao: RascunhoInsumo | RascunhoPedido | null } {
  const m = reply.match(/```acao-doonly\s*([\s\S]*?)```/)
  if (!m) {
    // (11/10) bloco de ação que não fechou (a resposta foi cortada no meio): o JSON cru não aparece na conversa
    const i = reply.lastIndexOf('```')
    if (i >= 0 && (reply.split('```').length - 1) % 2 === 1) {
      const resto = reply.slice(i + 3)
      const nome = resto.split(/\s/)[0]
      // (11/10) bloco ``` comum sem nome não esconde o resto; só a cerca recém-aberta (nada depois dela)
      const ehAcao = nome ? (nome.startsWith('acao-doonly') || 'acao-doonly'.startsWith(nome)) : !resto.trim()
      if (ehAcao) {
        return { texto: reply.slice(0, i).trim() || 'Não consegui terminar de montar. Peça de novo, por favor.', acao: null }
      }
    }
    return { texto: reply, acao: null }
  }
  let acao: RascunhoInsumo | RascunhoPedido | null = null
  try {
    const j = JSON.parse(m[1].trim())
    if (j?.acao === 'pedido' && Array.isArray(j.itens) && j.itens.length) acao = j as RascunhoPedido
    else acao = normalizarRascunho(j)
  } catch { acao = null }
  const texto = reply.replace(m[0], '').trim() || 'Confira e confirme no cartão abaixo.'
  return { texto, acao }
}

/** (27/10) Só pedido claro de imagem ("cria uma imagem", "gera o topo", "desenha uma arte").
 *  Antes "como desenhar com glacê?" virava imagem e gastava o limite do dia. Pergunta ("como...?") nunca é. */
function isImageRequest(text: string): boolean {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (/^(como|qual|quais|onde|porque|por que|quanto)\b/.test(t)) return false
  if (/^(desenha|desenhe|desenhar)\s+(um|uma|o|a)\s+\w+/.test(t)) return true // "desenha um bolo"
  return /\b(gera|gerar|gere|cria|criar|crie|faz|fazer|faca|desenha|desenhar|desenhe|monta|montar|monte)\s+(um|uma|o|a|meu|minha)?\s*(imagem|foto|topo|arte|ilustracao|desenho|logo|banner)\b/.test(t)
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


/**
 * (11/10) Foto do celular (3 a 8 MB) não passa pelo servidor e virava "Problema de conexão".
 * Antes de mandar, ela é reduzida no aparelho: no máximo 1600 px no lado maior, em JPEG (PNG transparente ganha fundo branco).
 */
async function reduzirFoto(file: File, ladoMaior = 1600): Promise<{ base64: string; mediaType: string }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, falhou) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => falhou(new Error('foto'))
      i.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('foto')
    const escala = Math.min(1, ladoMaior / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
    if (!base64) throw new Error('canvas')
    return { base64, mediaType: 'image/jpeg' }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Os avisos de erro antigos (gravados na conversa antes de existir a marca "erro"): também não vão pra IA. */
const ERROS_ANTIGOS = new Set([
  'Muitas mensagens em seguida. Aguarde um momento e tente novamente.',
  'Problema de autenticação. Contate o suporte do Doonly.',
  'O servidor está instável. Tente novamente em instantes.',
  'Configuração incompleta. Contate o suporte do Doonly.',
  'Problema de conexão. Verifique sua internet e tente novamente.',
  'Não consegui responder agora. Tenta de novo!',
])
const ehErroLocal = (m: Message | undefined): boolean => !!m && m.role === 'assistant' && (!!m.erro || ERROS_ANTIGOS.has(m.content))

/** A nota que o app escreve no fim da mensagem pra IA saber o que aconteceu com o cartão (não aparece na tela). */
const NOTA_DO_APP = /\n\n\[(O app confirmou|A confeiteira cancelou|A confeiteira abriu)[^\]]*\]$/

const PEDE_NOVA_CONVERSA = 'Comece uma nova conversa e tente de novo.'

/** caso: 'foto' = a mensagem levava uma foto · 'imagem' = pedido de criar imagem · 'texto' = conversa normal */
function getErrorMessage(errorType: string, status?: number, caso: 'foto' | 'imagem' | 'texto' = 'texto'): string {
  // (4.23) limite diário de uso da Doo
  // (27/10) grátis: 10 mensagens por mês
  if (errorType === 'limite_mensal') return 'Você usou as 10 mensagens do mês do plano grátis. No PRO são 150 por dia. No começo do mês que vem libera de novo.'
  if (errorType === 'limite_diario') return caso === 'imagem' ? 'Você chegou ao limite de imagens de hoje. Amanhã libera de novo.' : 'Você chegou ao limite de mensagens de hoje. Amanhã libera de novo.'
  if (status === 429 || errorType === 'rate_limit_error') return 'Muitas mensagens em seguida. Aguarde um momento e tente novamente.'
  // (11/10) só o erro de plano mostra o "Assine o PRO" (outro 403 cai no aviso genérico)
  if (errorType === 'pro_required') return 'A Doo faz parte do plano PRO. Assine o PRO para continuar.'
  if (status === 401 || errorType === 'authentication_error') return 'Problema de autenticação. Contate o suporte do Doonly.'
  if (status === 413 || errorType === 'too_large' || errorType === 'request_too_large') {
    return caso === 'foto' ? 'A foto ficou grande demais. Tente outra.' : `A conversa ficou grande demais. ${PEDE_NOVA_CONVERSA}`
  }
  if (status === 400 || errorType === 'invalid_request_error') {
    if (caso === 'foto') return 'Não consegui ler essa foto. Tente outra.'
    if (caso === 'imagem') return 'Não consegui criar essa imagem. Tente pedir de outro jeito.'
    return `Não consegui continuar essa conversa. ${PEDE_NOVA_CONVERSA}`
  }
  if (errorType === 'missing_key') return 'Configuração incompleta. Contate o suporte do Doonly.'
  if ((status && status >= 500) || errorType === 'api_error' || errorType === 'overloaded_error') return 'O servidor está instável. Tente novamente em instantes.'
  return 'Problema de conexão. Verifique sua internet e tente novamente.'
}

/** Lê a resposta das rotas da Doo. Erro vira { type, status } (o chat responde 200 e manda o erro dentro do JSON). */
async function lerResposta(res: Response): Promise<any> {
  let data: any = null
  try { data = await res.json() } catch { /* resposta sem JSON (ex.: o 413 da hospedagem) */ }
  if (!res.ok || !data || data.error) {
    const tipo = typeof data?.error === 'string' ? data.error : data?.error?.type
    throw { type: tipo || (res.ok ? 'api_error' : ''), status: res.ok ? (Number(data?.status) || 500) : res.status }
  }
  return data
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
  const painelRef = useRef<HTMLDivElement>(null)
  // (11/10) imagens geradas já baixadas no aparelho (quando o endereço deixa), pro botão "Baixar imagem"
  const blobsImagem = useRef<Record<string, Blob>>({})




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
  // (27/10) a 1ª mensagem (ex.: "Registrar pedido" do Menu) espera o cardápio carregar: antes ia com a lista vazia
  // e a Doo dizia que o produto não estava no cardápio
  const catRef = useRef(catalogo); catRef.current = catalogo
  const insRef = useRef(insumos); insRef.current = insumos
  const carregandoCat = useRef<Promise<unknown> | null>(null)
  useEffect(() => {
    if (!open || !uid) return
    carregandoCat.current = Promise.all([
      listarInsumosResumo(uid).then(l => { insRef.current = l; setInsumos(l) }).catch(() => {}),
      listarCatalogo(uid).then(c => { const v = { produtos: c.produtos, clientes: c.clientes }; catRef.current = v; setCatalogo(v) }).catch(() => {}),
    ])
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

  // (11/10) Antes a Doo travava a rolagem por conta própria e brigava com a trava da <Janela> (o aviso do PRO):
  // ao fechar, a tela ficava sem rolar e deslocada. Agora usa a mesma peça das janelas do app: a tela de trás
  // não rola, o Esc e o "voltar" do Android fecham a Doo (antes o voltar trocava a tela de trás e ela ficava aberta).
  useSobreposicao(open, handleClose, painelRef)

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

  // (11/10) "Nova conversa": pergunta antes, porque a conversa de agora sai do aparelho
  const novaConversa = async () => {
    if (loading || generatingImage) return
    if (messages.length) {
      const ok = await confirmar({ titulo: 'Começar uma nova conversa?', texto: 'A conversa de agora some deste aparelho.', rotulo: 'Nova conversa', rotuloVoltar: 'Voltar', icone: 'info' })
      if (!ok) return
    }
    clearConversation()
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    let pronta: { base64: string; mediaType: string }
    try {
      pronta = await reduzirFoto(file)
    } catch {
      // o aparelho não conseguiu abrir a foto pra reduzir: se ela for pequena e de um tipo aceito, vai como está
      const aceito = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
      if (!aceito || file.size > 2.5 * 1024 * 1024) { avisar('Não deu para abrir essa foto. Tente outra.', { tipo: 'erro' }); return }
      try { pronta = { base64: await fileToBase64(file), mediaType: file.type } }
      catch { avisar('Não deu para abrir essa foto. Tente outra.', { tipo: 'erro' }); return }
    }
    const preview = URL.createObjectURL(file)
    setPendingImage({ ...pronta, preview })
  }

  // (11/10) O app bloqueia o "salvar imagem" do toque longo: o botão baixa a imagem (quando ela já está no aparelho)
  // ou abre em outra aba, onde dá pra salvar. Sem esperar nada antes, pra o navegador não bloquear a aba nova.
  const baixarImagem = (url: string) => {
    const blob = blobsImagem.current[url]
    if (!blob) { window.open(url, '_blank', 'noopener'); return }
    const endereco = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = endereco
    link.download = `imagem-doo-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(endereco), 10000)
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
    // (11/10) não vão pra IA: os avisos de erro do próprio app e a pergunta que ficou sem resposta por causa deles.
    // E o recorte precisa começar numa mensagem dela: começando numa resposta da Doo, a IA recusava e a conversa travava.
    const recorte = newMessages
      .filter((m, k) => !m.isImage && !ehErroLocal(m) && !(m.role === 'user' && ehErroLocal(newMessages[k + 1])) && !!m.content.trim())
      .slice(-MAX_HISTORY)
    const historyForApi = recorte.slice(Math.max(0, recorte.findIndex(m => m.role === 'user')))

    try {
      if (!imgPayload && isImageRequest(text) && !isPro) {
        // (27/10) no grátis a Doo conversa, mas criar imagem é do PRO (não chama a API nem gasta mensagem)
        setLoading(false)
        setMessages(prev => [...prev, { role: 'assistant', content: 'Criar imagens é do plano PRO. No grátis eu ajudo com receitas, preços, legendas e pedidos. Quer que eu escreva uma legenda para esse post?' }])
      } else if (!imgPayload && isImageRequest(text)) {
        setLoading(false)
        setGeneratingImage(true)

        const res = await apiFetch('/api/doo-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: buildImagePrompt(text) })
        })
        const data = await lerResposta(res)

        const imageUrl = data?.data?.[0]?.url
        if (imageUrl) {
          // já tenta guardar a imagem no aparelho, pro "Baixar imagem" funcionar num toque (se o endereço não deixar, o botão abre em outra aba)
          fetch(imageUrl).then(r => (r.ok ? r.blob() : null)).then(b => { if (b) blobsImagem.current[imageUrl] = b }).catch(() => {})
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Aqui está a imagem. Use "Baixar imagem" para guardar; se ela abrir em outra aba, salve por lá. Baixe logo: o endereço dela vale por pouco tempo. Para impressão, recomendo solicitar em PDF ou vetor ao designer com sangria de 3mm.',
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

        // (21/10) os números do negócio vão junto (vendas, a receber, entregas); se demorar mais de 4 s, segue sem eles
        const negocio = uid ? await Promise.race([resumoDoNegocio(uid).catch(() => ''), new Promise<string>(r => setTimeout(() => r(''), 4000))]) : ''
        if (carregandoCat.current) await Promise.race([carregandoCat.current, new Promise(r => setTimeout(r, 6000))]) // o cardápio da Doo
        const res = await apiFetch('/api/doo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system: buildSystemPrompt(nomeConfeiteira) + negocio + regrasInsumo(insRef.current) + regrasPedido(catalogoParaDoo(catRef.current)),
            messages: historyForApi.map(m => ({ role: m.role, content: buildContent(m) }))
          })
        })

        const data = await lerResposta(res)

        const reply: string = data?.content?.[0]?.text || ''
        if (!reply) {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Não consegui responder agora. Tente de novo.', erro: true }])
        } else {
          // (11/10) resposta que bateu no limite de tamanho: avisa embaixo (antes ela só parava no meio da frase)
          const cortada = data?.stop_reason === 'max_tokens'
          const { texto, acao } = extrairAcao(reply)
          setMessages(prev => [...prev, acao
            ? { role: 'assistant', content: texto, acao, acaoEstado: 'pendente' }
            : { role: 'assistant', content: texto, ...(cortada ? { cortada: true } : {}) }])
        }
      }
    } catch (err: any) {
      const frase = getErrorMessage(err?.type ?? '', err?.status, imgPayload ? 'foto' : isImageRequest(text) ? 'imagem' : 'texto')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: frase,
        erro: true,
        ...(frase.endsWith(PEDE_NOVA_CONVERSA) ? { oferecerNova: true } : {}),
      }])
    }

    setLoading(false)
    setGeneratingImage(false)
  }
  // (21/10) aberta por um atalho (tela da Doo IA): já manda o pedido escrito
  useEffect(() => {
    if (!open || loading || generatingImage) return
    const pedido = pegarPedidoDoo()
    if (pedido) void sendMessage(pedido)
  }, [open, forceOpen]) // eslint-disable-line react-hooks/exhaustive-deps


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


      {/* ── Overlay blur ── */}
      {open && (
        <div onClick={handleClose} style={{
          position: 'fixed', inset: 0,
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          background: 'rgba(45,31,38,0.45)', zIndex: 198,
          animation: 'dooFadeIn 0.2s ease',
          touchAction: 'none',
        }} />
      )}

      {/* ── Janela do chat (02/10): tela cheia no celular, painel alto do lado direito no computador ── */}
      {open && (
        <div ref={painelRef} tabIndex={-1} className="dooia-panel" role="dialog" aria-label="Doo IA">

          {/* Cabeçalho */}
          <div className="dz-hd">
            <button type="button" className="dz-hb dz-voltar" onClick={handleClose} aria-label="Fechar a Doo"><CaretLeft size={20} weight="bold" /></button>
            <div className="dz-hav"><img src="/Sistema/doo.png" alt="" /><i aria-hidden="true" /></div>
            <div className="dz-ht">
              <b>Doo IA{isPro && <> <em>PRO</em></>}</b>
              <small className={loading || generatingImage ? 'dz-esc' : ''}><i aria-hidden="true" />{loading ? 'Escrevendo…' : generatingImage ? 'Criando a imagem…' : 'Online · responde na hora'}</small>
            </div>
            {messages.length > 0 && (
              <button type="button" className="dz-hb" onClick={novaConversa} disabled={loading || generatingImage} aria-label="Nova conversa" title="Nova conversa"><NotePencil size={20} weight="bold" /></button>
            )}
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
                    <span dangerouslySetInnerHTML={{ __html: formatText(msg.content.replace(NOTA_DO_APP, '')) }} />
                  </div>
                  {msg.cortada && <p className="dz-corte">A resposta ficou longa e foi cortada. Peça para continuar.</p>}
                  {/* (11/10) "Editar" levou o rascunho pra Nova venda: o cartão fica resolvido (antes continuava pendente e,
                      ao reabrir a Doo, um toque registrava o pedido de novo) */}
                  {msg.acao && msg.acao.acao === 'pedido' && msg.acaoEstado === 'editando' && (
                    <p className="dz-res"><ArrowRight size={16} weight="bold" aria-hidden="true" />Aberto na Nova venda</p>
                  )}
                  {msg.acao && uid && msg.acao.acao === 'pedido' && msg.acaoEstado !== 'editando' && (
                    <CartaoPedidoDoo uid={uid} rascunho={msg.acao as RascunhoPedido} catalogo={catalogo} estado={msg.acaoEstado || 'pendente'} numero={msg.acaoNumero}
                      onEditar={(dados) => {
                        setMessages(prev => prev.map((m, k) => k === i ? { ...m, acaoEstado: 'editando', content: m.content + '\n\n[A confeiteira abriu esse pedido na tela Nova venda para terminar por lá.]' } : m))
                        // a Doo guarda uma entrada no histórico pro "voltar"; a Nova venda entra no lugar dela
                        const substituir = !!(window.history.state as { uiJanela?: boolean } | null)?.uiJanela
                        handleClose(); navigateDoo('/vendas/novo', { state: { rascunhoDoo: dados }, replace: substituir })
                      }}
                      onFeito={(estado, info) => {
                        const nota = estado === 'salvo' ? `\n\n[O app confirmou: pedido${info?.numero ? ' #' + info.numero : ''} registrado (${info?.resumo}).]` : '\n\n[A confeiteira cancelou esse pedido.]'
                        setMessages(prev => prev.map((m, k) => k === i ? { ...m, acaoEstado: estado, acaoNumero: info?.numero, content: m.content + nota } : m))
                        if (estado === 'salvo') listarCatalogo(uid).then(c => setCatalogo({ produtos: c.produtos, clientes: c.clientes })).catch(() => {})
                      }} />
                  )}
                  {msg.acao && uid && msg.acao.acao === 'insumo' && (
                    <CartaoInsumoDoo uid={uid} rascunho={msg.acao as RascunhoInsumo} estado={!msg.acaoEstado || msg.acaoEstado === 'editando' ? 'pendente' : msg.acaoEstado}
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
                      <button type="button" onClick={() => copyMessage(msg.content.replace(NOTA_DO_APP, ''), i)} className={copiedId === i ? 'ok' : ''}>
                        {copiedId === i ? <><Check size={16} weight="bold" />Copiado</> : <><Copy size={16} weight="bold" />Copiar</>}
                      </button>
                      {msg.oferecerNova && i === messages.length - 1 && (
                        <button type="button" onClick={novaConversa}><NotePencil size={16} weight="bold" />Nova conversa</button>
                      )}
                    </div>
                  )}
                  {msg.imageUrl && (
                    <div className="dz-acs">
                      <button type="button" onClick={() => baixarImagem(msg.imageUrl as string)}><DownloadSimple size={16} weight="bold" />Baixar imagem</button>
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
          background: #FAF7F8; font-family: var(--font-base); color: var(--ui-texto);
          animation: dooSlideUp 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        /* COMPUTADOR: painel alto do lado direito */
        @media (min-width: 768px) {
          .dooia-panel {
            top: 1rem; bottom: 1rem; right: 1rem; left: auto; width: min(440px, calc(100vw - 2rem));
            border-radius: 22px; box-shadow: 0 18px 60px rgba(44,18,25,.28); border: 1px solid rgba(110,53,72,.12);
          }
        }
        .dz-hd { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: calc(12px + env(safe-area-inset-top, 0px)) 14px 14px; background: radial-gradient(130% 160% at 0 0, #5A3626, var(--ui-vinho-escuro) 70%); color: var(--ui-branco); }
        .dz-hb { width: 44px; height: 44px; border-radius: var(--ui-raio); border: none; background: rgba(255,255,255,.12); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-hb:disabled { opacity: .35; cursor: default; }
        .dz-fechar { display: none; }
        @media (min-width: 768px) { .dz-voltar { display: none; } .dz-fechar { display: flex; } }
        .dz-hav { position: relative; width: 44px; height: 44px; border-radius: 14px; background: #FCE7F3; border: 2px solid rgba(255,255,255,.35); flex-shrink: 0; }
        .dz-hav img { width: 100%; height: 100%; object-fit: cover; object-position: top center; border-radius: var(--ui-raio); display: block; }
        .dz-hav i { position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 50%; background: #22C55E; border: 2.5px solid var(--ui-texto); }
        .dz-ht { flex: 1; min-width: 0; }
        .dz-ht b { display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 600; }
        .dz-ht em { font-style: normal; font-size: 12px; font-weight: 600; padding: 2px 7px; border-radius: 6px; background: linear-gradient(90deg, #F9A8D4, #C4B5FD); color: var(--ui-texto); }
        .dz-ht small { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #BBF7D0; margin-top: 2px; }
        .dz-ht small i { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
        .dz-ht small.dz-esc { color: #FBCFE8; } .dz-ht small.dz-esc i { background: #F472B6; box-shadow: 0 0 0 3px rgba(244,114,182,.3); animation: dooTyping 1.2s infinite; }
        .dz-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 16px 14px 8px; display: flex; flex-direction: column; gap: 12px; }
        .dz-ini { display: flex; flex-direction: column; gap: 12px; }
        .dz-hero { text-align: center; padding: 8px 6px 2px; }
        .dz-hav2 { width: 84px; height: 84px; margin: 0 auto; border-radius: 26px; background: #FCE7F3; overflow: hidden; box-shadow: 0 10px 26px rgba(232,90,140,.28); }
        .dz-hav2 img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
        .dz-hero b { display: block; font-size: 20px; font-weight: 600; margin-top: 12px; letter-spacing: -.01em; }
        .dz-hero p { font-size: 13.5px; color: var(--ui-texto-2); line-height: 1.45; margin: 6px auto 0; max-width: 320px; text-wrap: balance; }
        .dz-hero b { text-wrap: balance; }
        .dz-sl { margin: 4px 0 0; font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2, #6B5D64); }
        .dz-sg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dz-sc { min-height: 112px; text-align: left; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; padding: 11px; font-family: inherit; color: inherit; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        .dz-sc:hover { border-color: #F7C6D9; box-shadow: 0 4px 14px rgba(232,90,140,.1); }
        .dz-si { width: 36px; height: 36px; border-radius: var(--ui-raio-p); background: var(--primary-light); color: #993556; display: flex; align-items: center; justify-content: center; }
        .dz-sc b { display: block; font-size: 13.5px; font-weight: 600; margin-top: 6px; line-height: 1.2; }
        .dz-sc small { display: block; font-size: 12.5px; color: var(--ui-texto-2, #6B5D64); margin-top: 2px; line-height: 1.3; }
        .dz-dia { align-self: center; margin: 0; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-3); background: #F0EBED; padding: 3px 10px; border-radius: 99px; }
        .dz-m { display: flex; gap: 8px; align-items: flex-end; }
        .dz-m--eu { justify-content: flex-end; }
        .dz-mav { width: 28px; height: 28px; border-radius: 9px; object-fit: cover; object-position: top center; background: #FCE7F3; flex-shrink: 0; }
        .dz-mc { max-width: 84%; min-width: 0; display: flex; flex-direction: column; }
        .dz-m--eu .dz-mc { max-width: 80%; align-items: flex-end; }
        .dz-bd { padding: 10px 13px; font-size: 14.5px; line-height: 1.5; word-wrap: break-word; overflow-wrap: anywhere; }
        .dz-m--doo .dz-bd { background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 18px 18px 18px 4px; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
        .dz-m--eu .dz-bd { background: var(--ui-vinho-escuro); color: var(--ui-branco); border-radius: 18px 18px 4px 18px; }
        .dz-bd ul, .dz-bd ol { margin: 6px 0; padding-left: 20px; }
        .dz-bd ul { list-style: disc; } .dz-bd ol { list-style: decimal; }
        .dz-bd li::marker { color: var(--ui-rosa); }
        .dz-bd li { margin: 3px 0; }
        .dz-bd strong { font-weight: 600; }
        .dz-anexo { width: 100%; max-height: 180px; object-fit: cover; border-radius: var(--ui-raio); margin-bottom: 8px; display: block; }
        .dz-gerada { width: 100%; border-radius: var(--ui-raio); margin-bottom: 8px; display: block; }
        .dz-acs { display: flex; gap: 6px; margin-top: 6px; }
        .dz-acs button { position: relative; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--ui-texto-2, #6B5D64); background: none; border: none; padding: 0 8px; margin-left: -8px; border-radius: var(--ui-raio-p); cursor: pointer; }
        .dz-acs button::after { content: ""; position: absolute; inset: -4px 0; }
        @media (hover: hover) { .dz-acs button:hover { background: var(--ui-cinza); } }
        .dz-acs button.ok { color: var(--ui-verde); }
        .dz-acs button + button { margin-left: 0; }
        .dooia-panel:focus { outline: none; }
        .dz-corte { margin: 6px 0 0 2px; font-size: 12.5px; line-height: 1.4; color: var(--ui-laranja); }
        .dz-res { display: inline-flex; align-items: center; gap: 8px; align-self: flex-start; margin: 8px 0 0; padding: 8px 12px; border-radius: var(--ui-raio); background: var(--ui-cinza); font-size: 13.5px; font-weight: 500; color: var(--ui-texto-2); }
        .dz-dig { display: flex; align-items: center; gap: 6px; padding: 14px 16px; font-size: 13px; color: var(--ui-texto-2); }
        .dz-dig i { width: 7px; height: 7px; border-radius: 50%; background: #D9A5B9; animation: dooTyping 1.2s ease-in-out infinite; }
        .dz-dig i:nth-child(2) { animation-delay: .2s; } .dz-dig i:nth-child(3) { animation-delay: .4s; }
        .dz-spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--ui-rosa); border-top-color: transparent; animation: dooSpin .7s linear infinite; }
        .dz-digt { margin: 5px 0 0 2px; font-size: 12.5px; color: var(--ui-texto-3); }
        .dz-in { flex-shrink: 0; padding: 8px 12px calc(12px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(180deg, rgba(250,247,248,0), #FAF7F8 30%); }
        .dz-pend { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .dz-pend-img { position: relative; flex-shrink: 0; }
        .dz-pend-img img { width: 48px; height: 48px; border-radius: var(--ui-raio-p); object-fit: cover; border: 1.5px solid var(--ui-rosa); display: block; }
        .dz-pend-img button { position: absolute; top: -10px; right: -10px; width: 28px; height: 28px; border-radius: 50%; border: 2px solid var(--ui-branco); background: var(--ui-vinho-escuro); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        .dz-pend p { margin: 0; font-size: 12.5px; color: var(--ui-texto-2); }
        .dz-inb { display: flex; align-items: center; gap: 8px; background: var(--ui-branco); border: 1.5px solid var(--ui-borda-campo); border-radius: 999px; padding: 4px; box-shadow: 0 4px 14px rgba(44,18,25,.06); transition: border-color .15s; }
        .dz-inb:focus-within { border-color: var(--ui-rosa); box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
        .dz-ib { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--primary-light); color: #993556; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-txt { flex: 1; min-width: 0; height: 44px; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); padding: 0 2px; }
        .dz-txt::placeholder { color: #B5AAB0; }
        .dz-snd { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--ui-rosa); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(232,90,140,.35); transition: background .15s; }
        .dz-snd:disabled { background: #F3D2DE; box-shadow: none; cursor: default; }

        /* janela de quem não é PRO */
        .dz-pw { text-align: center; }
        .dz-pw-ft { display: block; width: 88px; height: 88px; margin: 0 auto 12px; border-radius: var(--ui-raio-janela); background: #FCE7F3; object-fit: cover; object-position: top center; box-shadow: 0 10px 26px rgba(232,90,140,.25); }
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
