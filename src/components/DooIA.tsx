import { pegarPedidoDoo } from '@/components/MenuContaItens'
import { useState, useRef, useEffect } from 'react'
import { CaretLeft, X, Minus, Check, Copy, ImageSquare, ArrowRight, CurrencyCircleDollar, BookOpenText, InstagramLogo, Receipt, Package, NotePencil, DownloadSimple, Cake, Sparkle, FilePdf, Storefront, WhatsappLogo, ChatCircleDots, CaretRight } from '@phosphor-icons/react'
import { card, gerarDocumento } from '@/lib/pdfDoonly'
import { useNavigate as useNavigateDoo } from 'react-router-dom'
import CartaoPedidoDoo from '@/components/doo/CartaoPedidoDoo'
import { listarCatalogo, catalogoParaDoo, type RascunhoPedido, type ProdutoCat, type ClienteCat } from '@/lib/pedidosDoo'
import CartaoInsumoDoo from '@/components/doo/CartaoInsumoDoo'
import CartaoAcaoDoo from '@/components/doo/CartaoAcaoDoo'
import { ACOES_DOO, CAMPOS_LOJA_DOO, normalizarAcaoDoo, regrasAcoesDoo, type AcaoDoo, type LojaDoo } from '@/lib/acoesDoo'
import { listarInsumosResumo, normalizarRascunho, type InsumoResumo, type RascunhoInsumo } from '@/lib/insumosDoo'
import { supabase } from '@/lib/supabase'
import { usePlano } from '@/hooks/usePlano'
import { ConvitePro } from '@/components/billing/RecursoPro'
import { apiFetch } from "@/lib/apiFetch";
import { resumoDoNegocio } from "@/lib/resumoDoo";
import { avisar, confirmar, Botao, Campo, CaixasEscolha, Janela } from '@/components/base'
import { useSobreposicao } from '@/components/base/useSobreposicao'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  isImage?: boolean
  attachmentPreview?: string
  /** Rascunho de cadastro que a Doo preparou (só é salvo quando ela confirma no cartão) */
  acao?: RascunhoInsumo | RascunhoPedido | AcaoDoo
  /** (6.86) o que o app fez com a ação ("Ana foi cadastrada") e a tela pra abrir */
  acaoFeito?: string
  acaoAbrir?: string
  /** 'editando' (11/10): ela tocou em "Editar" e o rascunho foi pra Nova venda (o cartão não registra mais por aqui) */
  acaoEstado?: 'pendente' | 'salvo' | 'cancelado' | 'editando'
  /** número do pedido registrado (pra mostrar no cartão) */
  acaoNumero?: string | number
  /** (11/10) aviso de erro do próprio app: aparece na conversa, mas NÃO vai pra IA */
  erro?: boolean
  /** (6.85) o pedido do topo de bolo (para refazer com as mudanças que ela pedir) */
  promptTopo?: string
  /** (6.89) imagem de topo de bolo: ganha o "Baixar em PDF" */
  ehTopo?: boolean
  /** (6.101) logo ou banner criado pela Doo: ganha o botão de colocar no cardápio */
  usoImagem?: 'logo' | 'banner'
  usoFeito?: boolean
  /** (11/10) o erro se resolve começando outra conversa: mostra o botão embaixo */
  oferecerNova?: boolean
  /** (11/10) a resposta bateu no limite de tamanho e veio cortada */
  cortada?: boolean
}

const MAX_HISTORY = 12

/** Sugestões do começo da conversa (cartões com ícone de linha) */
// (6.115) os 6 atalhos que mais vendem e poupam tempo (nome curto, numa linha só)
const SUGESTOES_CARTOES = [
  { Ic: CurrencyCircleDollar, t: 'Quanto cobrar', s: 'preço com lucro', p: 'Quero saber quanto cobrar por um produto' },
  { Ic: BookOpenText, t: 'Ficha técnica', s: 'custo de verdade', p: 'Quero montar a ficha técnica de um produto' },
  { Ic: Receipt, t: 'Pedido do zap', s: 'cole a conversa', p: 'Quero registrar um pedido que chegou no WhatsApp' },
  { Ic: Storefront, t: 'Loja pronta', s: 'eu configuro', p: 'Deixa minha loja pronta' },
  { Ic: InstagramLogo, t: 'Post que vende', s: 'legenda + arte', p: 'Quero um post que vende para o Instagram' },
  { Ic: Sparkle, t: 'Minha logo', s: 'e já no cardápio', p: 'Quero criar a logo da minha loja' },
]
/** (6.115) conversas guardadas no aparelho (as 10 últimas) */
type ConversaSalva = { id: string; titulo: string; quando: string; msgs: Message[] }
const tituloDaConversa = (ms: Message[]) => {
  const t = (ms.find(m => m.role === 'user' && m.content?.trim())?.content || 'Conversa').replace(/\s+/g, ' ').trim()
  return t.length > 44 ? t.slice(0, 43) + '…' : t
}
const quandoFoi = (iso: string) => {
  const d = new Date(iso), h = new Date(); const ontem = new Date(); ontem.setDate(h.getDate() - 1)
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === h.toDateString()) return `hoje, ${hora}`
  if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora}`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const PLACEHOLDERS = [
  // (6.112) curtos: cabem no campo do celular sem cortar
  'Pergunte algo à Doo…',
  'Calcular um preço…',
  'Legenda para o Instagram…',
  'Criar um topo de bolo…',
  'Cadastrar um produto…',
]

const buildSystemPrompt = (nome: string) => `Você é Doo, a assistente inteligente oficial do Doonly.

Você é a consultora de confeitaria mais completa e experiente disponível. Sua missão é ajudar confeiteiras a ganhar mais dinheiro, economizar tempo, reduzir desperdícios, organizar seus negócios e tomar decisões mais inteligentes.

Você não é uma IA genérica. Você é uma especialista profunda em tudo que envolve o universo da confeitaria — da técnica ao negócio, da receita ao marketing.

# IDENTIDADE
Nome: Doo
Cargo: Assistente Inteligente do Doonly
Personalidade: Amigável, inteligente, prestativa, organizada, criativa, profissional, motivadora e confiável.

Doo fala de forma simples, clara e acolhedora. Não use emojis. Ao listar etapas ou ingredientes, use marcadores com hífen (- item).

# JEITO DE RESPONDER (o mais importante)
- Seja honesta, objetiva e rápida. Responda em poucas linhas; resposta longa só quando ela pedir (receita completa, plano, legenda).
- Quando for fazer algo no app, pergunte só o que falta, uma coisa de cada vez, e já monte o cartão.
- Nunca invente dados, números, preços ou o que o app faz. Se não souber ou não conseguir fazer, diga isso com clareza em uma frase e diga onde ela faz no app.

# IMAGENS E TOPOS DE BOLO
Você CRIA imagens pelo app: topos de bolo para imprimir, artes, posts e banners. Nunca diga que não consegue criar imagens.
IMPORTANTE: só mande o bloco de imagem quando a ÚLTIMA mensagem dela pedir uma imagem ou responder uma pergunta sua sobre a imagem. Cumprimento ou conversa ("oi", "bom dia", "obrigada", "tudo bem?") NUNCA cria imagem: responda normal. Um pedido de topo antigo da conversa não é motivo para criar de novo.
TOPO DE BOLO: antes de criar, você PRECISA saber com certeza: o TEMA (ex.: princesas, safári, futebol), o NOME e a IDADE (ou outra frase). Pergunte também se a idade vai JUNTO do nome na faixa principal ou numa peça SEPARADA, e se ela quer cores específicas (se não, use as cores do tema). Separe bem o que é tema, nome e idade: em "topo princesas 10 anos alice", o tema é "princesas", o nome é "Alice" e a idade é "10 anos". Na dúvida, SEMPRE pergunte antes de criar: perguntar é melhor do que gerar errado. Pergunte no máximo 2 coisas por mensagem, curtas. Quando tiver tudo, responda com UMA frase curta (ex.: "Já estou criando o seu topo.") e, no FINAL, este bloco:
\`\`\`acao-doonly
{"acao":"imagem","tipo":"topo","tema":"princesas","nome":"Alice","idade":"10 anos","idade_na_faixa":false,"cores":"rosa e dourado","estilo":"fofo","descricao":"topo de princesas para a Alice, 10 anos"}
\`\`\`
"estilo": "fofo", "elegante" ou "divertido". Para LOGO, BANNER e ARTE, use "descricao" com tudo o que ela pediu, bem explicado.
Se ela pedir personagem ou marca famosa, diga em uma frase "O Doonly não cria personagens nem marcas famosas" (nunca cite OpenAI, Anthropic ou outra empresa) e já ofereça o mesmo topo com um tema próprio parecido, com o nome e as cores. Se ela mandar uma foto e pedir "uma parecida", mande o bloco descrevendo o que ela quer: o app usa a foto como referência.
"tipo": "topo" (topo de bolo), "logo" (logo da loja: pergunte o nome da loja como deve aparecer, as cores e o estilo; ela pode mandar fotos de referência), "banner" (banner do cardápio: pergunte o que divulgar, ex.: promoção, produto, data) ou "arte" (post, convite, outros). Logo e banner vêm com um botão para ela colocar direto no cardápio. Para mudar uma imagem que acabou de sair, mande o bloco de novo com a descrição completa já com a mudança.

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
- Upsell e cross-sell (sugestão de adicionais, kits, combos)
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

Responda o que ela perguntou, de forma completa mas sem enrolar. Uma dica a mais só quando for realmente útil.

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
- categoria: uma de Secos, Laticínios e ovos, Chocolates, Frutas, Carnes e frios, Embalagens, Decorações, Descartáveis, Bebidas, Outros.
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

/** (6.94) a Doo pede uma imagem pela conversa (qualquer jeito de pedir): o app cria */
type AcaoImagem = { acao: 'imagem'; topo: boolean; descricao: string; tipo?: 'topo' | 'arte' | 'logo' | 'banner'; campos?: TopoForm & { idadeNaFaixa?: boolean } }
type TipoImagem = 'topo' | 'arte' | 'logo' | 'banner'

/** (6.91) a frase da Doo depois que a ação foi salva, com o próximo passo que faz sentido */
function respostaFeito(a: AcaoDoo, feito: string): string {
  const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  switch (a.acao) {
    case 'cliente': return a.cliente_id ? `Prontinho! Atualizei o cadastro de ${a.nome}.` : `Prontinho! ${a.nome} já está nos seus clientes. Quer registrar um pedido ou montar um orçamento para ${a.nome.split(' ')[0]}?`
    case 'produto': return `Prontinho! ${a.nome} já está no seu cardápio por ${brl(a.preco)}. Para colocar a foto e os tamanhos, toque em Abrir no cartão.`
    case 'orcamento': return `Pronto! ${feito.replace(' criado', '')} está salvo como rascunho. Toque em Abrir para revisar e enviar ao cliente pelo WhatsApp.`
    case 'loja': return 'Prontinho! Os dados da loja foram atualizados e o cardápio já mostra a mudança.'
    case 'custos': return 'Prontinho! Sua mão de obra e os custos invisíveis já entram no custo de todas as fichas técnicas.'
    case 'cupom': return `Prontinho! O cupom ${a.codigo} já está valendo no cardápio. Quer que eu escreva uma mensagem para divulgar no WhatsApp?`
    case 'ficha': return `Prontinho! A ficha técnica de ${a.produto_nome} está salva. Toque em Abrir para ver o custo e o lucro.`
    // (6.115) pedido, financeiro e produto que já existe
    case 'pedido_status': return `Prontinho! Pedido ${feito}.${a.etapa === 'pronto' ? ' Quer que eu escreva a mensagem avisando a cliente?' : ''}`
    case 'lancamento': return `Prontinho! ${feito}.`
    case 'pedido_editar': return `Prontinho! ${feito}.`
    case 'mensagem': return 'Pronto! Toque em WhatsApp no cartão para mandar a mensagem.'
    case 'orcamento_enviar': return `${feito}. Toque em WhatsApp no cartão para mandar o link ao cliente. Você recebe o aviso quando ele responder.`
    case 'categoria': return `Prontinho! ${feito}.`
    case 'produto_editar': return a.disponivel === false ? `Prontinho! ${a.produto_nome} saiu do cardápio. Quando voltar a ter, é só me falar.` : `Prontinho! ${feito} e o cardápio já mostra a mudança.`
  }
}

/** Separa o bloco acao-doonly da resposta.
 *  (6.116) a Doo às vezes manda duas ações numa resposta ("registrando os dois"): a primeira vira o cartão e as outras
 *  vêm em "extras" (um cartão para cada). Nenhum bloco aparece cru na conversa. */
function extrairAcao(reply: string): { texto: string; acao: RascunhoInsumo | RascunhoPedido | AcaoDoo | AcaoImagem | null; extras: (RascunhoInsumo | RascunhoPedido | AcaoDoo)[] } {
  const todos = [...reply.matchAll(/```acao-doonly\s*([\s\S]*?)```/g)]
  if (todos.length > 1) {
    const um = todos.map(b => extrairAcao(b[0]).acao).filter(Boolean) as (RascunhoInsumo | RascunhoPedido | AcaoDoo | AcaoImagem)[]
    const semImagem = um.filter(a => a.acao !== 'imagem') as (RascunhoInsumo | RascunhoPedido | AcaoDoo)[]
    const texto = todos.reduce((t, b) => t.replace(b[0], ''), reply).trim() || 'Confira e confirme nos cartões abaixo.'
    return { texto, acao: semImagem[0] || null, extras: semImagem.slice(1) }
  }
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
        return { texto: reply.slice(0, i).trim() || 'Não consegui terminar de montar. Peça de novo, por favor.', acao: null, extras: [] }
      }
    }
    return { texto: reply, acao: null, extras: [] }
  }
  let acao: RascunhoInsumo | RascunhoPedido | AcaoDoo | AcaoImagem | null = null
  try {
    const j = JSON.parse(m[1].trim())
    if (j?.acao === 'pedido' && Array.isArray(j.itens) && j.itens.length) acao = j as RascunhoPedido
    else if ((ACOES_DOO as readonly string[]).includes(j?.acao)) acao = normalizarAcaoDoo(j)
    else if (j?.acao === 'imagem' && ((typeof j.descricao === 'string' && j.descricao.trim()) || (typeof j.tema === 'string' && j.tema.trim()))) {
      const tipoJ = ['topo', 'arte', 'logo', 'banner'].includes(j.tipo) ? j.tipo : (j.topo !== false ? 'topo' : 'arte')
      const txt = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 120) : '')
      acao = { acao: 'imagem', topo: tipoJ === 'topo', tipo: tipoJ, descricao: String(j.descricao || j.tema || '').trim().slice(0, 1200),
        ...(tipoJ === 'topo' && txt(j.tema) ? { campos: { tema: txt(j.tema), nome: txt(j.nome), texto: txt(j.idade) || txt(j.frase), cores: txt(j.cores), estilo: (['fofo', 'elegante', 'divertido'].includes(j.estilo) ? j.estilo : 'fofo') as TopoForm['estilo'], idadeNaFaixa: j.idade_na_faixa === true } } : {}) }
    }
    else acao = normalizarRascunho(j)
  } catch { acao = null }
  const texto = reply.replace(m[0], '').trim() || 'Confira e confirme no cartão abaixo.'
  return { texto, acao, extras: [] }
}

/** (27/10) Só pedido claro de imagem ("cria uma imagem", "gera o topo", "desenha uma arte").
 *  Antes "como desenhar com glacê?" virava imagem e gastava o limite do dia. Pergunta ("como...?") nunca é. */
function isImageRequest(text: string): boolean {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (/^(como|qual|quais|onde|porque|por que|quanto)\b/.test(t)) return false
  if (/^(desenha|desenhe|desenhar)\s+(um|uma|o|a)\s+\w+/.test(t)) return true // "desenha um bolo"
  // (6.85) "quero um topo de bolo da Alice", "preciso de um topper": também é pedido de imagem
  if (/\b(topo|topos|topper|toppers)\b/.test(t) && /\b(quero|queria|preciso|precisava|gera|gerar|gere|cria|criar|crie|faz|fazer|faca|desenha|desenhar|desenhe|monta|montar|monte|me da|manda)\b/.test(t)) return true
  return /\b(gera|gerar|gere|cria|criar|crie|faz|fazer|faca|desenha|desenhar|desenhe|monta|montar|monte)\s+(um|uma|o|a|meu|minha)?\s*(imagem|foto|topo|arte|ilustracao|desenho|logo|banner)\b/.test(t)
}

/** (6.85) o pedido fala de topo de bolo / topper */
const ehTopo = (text: string) => /\b(topo|topos|topper|toppers)\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

/** (6.85) o topo de bolo pronto pra imprimir: o nome escrito certinho, recortável e com fundo transparente */
type TopoForm = { tema: string; nome: string; texto: string; cores: string; estilo: 'fofo' | 'elegante' | 'divertido' }
const ESTILO_TOPO: Record<TopoForm['estilo'], string> = {
  fofo: 'cute and delicate children illustration, soft rounded shapes, kawaii details',
  elegante: 'elegant and sophisticated, fine lines, refined typography, minimal ornaments, gold accents',
  divertido: 'fun and colorful cartoon, bold playful lettering, lively elements',
}
/** (6.89) o formato de folha de topo para imprimir (o padrão do mercado): peça principal com a faixa do nome em cima,
 *  peças menores do tema embaixo, cada uma com borda branca para recortar */
const FOLHA_TOPO = 'Layout: a portrait printable sheet of cake topper pieces (Brazilian "topo de bolo para imprimir"). '
  + 'At the top, the MAIN piece: a big decorative ribbon banner with themed illustrations around and behind it. '
  + 'Below it, 4 to 8 smaller SEPARATE pieces that match the theme (for example the age number, stars, balloons, hearts and themed elements), well spaced so each one can be cut out. '
  + 'Every piece is a die-cut sticker with a thick white contour border and a thin colored outer line. '
  + 'Flat glossy vector illustration, vibrant colors, crisp clean edges, transparent background, no scenery, no cake, no table, no photo, no mockup, no website or watermark text. '
  + 'Only original generic illustrations: no known cartoon characters, mascots or brands.'

function promptTopo(f: TopoForm & { idadeNaFaixa?: boolean }): string {
  const naFaixa = !!f.idadeNaFaixa && !!f.texto.trim()
  const nome = naFaixa ? `${f.nome.trim()} ${f.texto.trim()}`.trim() : f.nome.trim(), texto = naFaixa ? '' : f.texto.trim()
  return `Printable cake topper sheet for a Brazilian confectionery. Theme: ${f.tema.trim()}. `
    + (nome ? `The main banner shows the name written exactly as "${nome}" in bold script lettering with a white outline. ` : 'The main banner shows "Parabéns" in bold script lettering with a white outline. ')
    + (texto ? `One of the smaller pieces shows, written exactly, "${texto}". ` : '')
    + 'All text in Portuguese, perfect spelling, no other words. '
    + (f.cores.trim() ? `Color palette: ${f.cores.trim()}. ` : '')
    + `Style: ${ESTILO_TOPO[f.estilo]}. ` + FOLHA_TOPO
}

/** (6.101) o banner do cardápio é 16:9: corta o meio da imagem deitada */
async function cortarBanner(blob: Blob): Promise<Blob> {
  try {
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((ok, falhou) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falhou; i.src = url })
    URL.revokeObjectURL(url)
    const w = img.naturalWidth, h = Math.round(w * 9 / 16)
    if (h >= img.naturalHeight) return blob
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const ctx = c.getContext('2d'); if (!ctx) return blob
    ctx.drawImage(img, 0, Math.round((img.naturalHeight - h) / 2), w, h, 0, 0, w, h)
    return (await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.92))) || blob
  } catch { return blob }
}

/** (6.89) marca d'água embaixo da folha: "Criado no Doonly App · doonly.com.br" (fora das peças de recortar) */
async function comMarcaDagua(blob: Blob): Promise<Blob> {
  try {
    const url = URL.createObjectURL(blob)
    const img = await new Promise<HTMLImageElement>((ok, falhou) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falhou; i.src = url })
    URL.revokeObjectURL(url)
    const faixa = Math.round(img.naturalWidth * 0.055)
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight + faixa
    const ctx = c.getContext('2d'); if (!ctx) return blob
    ctx.drawImage(img, 0, 0)
    ctx.fillStyle = '#6B5C63'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `600 ${Math.round(faixa * 0.42)}px Poppins, Arial, sans-serif`
    ctx.fillText('Criado no Doonly App · doonly.com.br', c.width / 2, img.naturalHeight + faixa / 2)
    const novo = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'))
    return novo || blob
  } catch { return blob }
}

function buildImagePrompt(userMessage: string): string {
  if (ehTopo(userMessage)) return `Printable cake topper sheet for a Brazilian confectionery, based on this request in Portuguese: "${userMessage}". Any name or text must be written exactly as asked, with perfect Portuguese spelling, in bold script lettering with a white outline. ${FOLHA_TOPO}`
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
function getErrorMessage(errorType: string, status?: number, caso: 'foto' | 'imagem' | 'texto' = 'texto', codigo?: string): string {
  // (6.94) imagem: o motivo de verdade que a OpenAI mandou
  if (caso === 'imagem' && codigo) {
    if (/billing|quota/i.test(codigo)) return 'A criação de imagens está sem crédito agora. Avise o suporte do Doonly.'
    if (/content_policy|moderation|safety/i.test(codigo)) return 'O Doonly não cria personagens nem marcas famosas. Me diga um tema próprio (ex.: jardim, safári, fazendinha, futebol) que eu faço com o nome e as cores da festa.'
    if (/verif|organization/i.test(codigo)) return 'A criação de imagens ainda está sendo liberada no Doonly. Tente de novo mais tarde.'
  }
  // (4.23) limite diário de uso da Doo
  // (27/10) grátis: 10 mensagens por mês
  if (errorType === 'limite_mensal') return 'A Doo IA é do plano PRO. Teste grátis por 7 dias.'
  if (errorType === 'limite_diario') return caso === 'imagem' ? 'Você chegou ao limite de imagens de hoje. Amanhã libera de novo.' : 'Você chegou ao limite de mensagens de hoje. Amanhã libera de novo.'
  if (status === 429 || errorType === 'rate_limit_error') return 'Muitas mensagens em seguida. Aguarde um momento e tente novamente.'
  // (11/10) só o erro de plano mostra o "Assine o PRO" (outro 403 cai no aviso genérico)
  if (errorType === 'pro_required') return 'A Doo faz parte do plano PRO. Teste o PRO grátis por 7 dias para continuar.'
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

/** O que as rotas da Doo devolvem (chat e imagem) */
type RespostaDoo = { error?: string | { type?: string } | null; codigo?: string; detalhe?: string; status?: number | string; data?: { url?: string; b64?: string; formato?: string }[]; content?: { text?: string }[]; stop_reason?: string }
/** Erro lançado por lerResposta */
type ErroDoo = { type?: string; status?: number; codigo?: string; detalhe?: string }

/** Lê a resposta das rotas da Doo. Erro vira { type, status } (o chat responde 200 e manda o erro dentro do JSON). */
async function lerResposta(res: Response): Promise<RespostaDoo> {
  let data: RespostaDoo | null = null
  try { data = await res.json() } catch { /* resposta sem JSON (ex.: o 413 da hospedagem) */ }
  if (!res.ok || !data || data.error) {
    const tipo = typeof data?.error === 'string' ? data.error : (data?.error as { type?: string } | null)?.type
    throw { type: tipo || (res.ok ? 'api_error' : ''), status: res.ok ? (Number(data?.status) || 500) : res.status, codigo: data?.codigo, detalhe: data?.detalhe }
  }
  return data
}

/** (6.114) resposta que é receita: tem ingredientes e o modo de preparo */
const ehReceita = (t: string) => /ingredientes/i.test(t) && /(modo de preparo|preparo|como fazer)/i.test(t) && t.length > 200
/** o texto da receita sem as marcas do markdown, pronto para o WhatsApp */
const receitaEmTexto = (t: string) => t.replace(NOTA_DO_APP, '').replace(/^[ \t]*#{1,4}[ \t]+(.+?)[ \t#]*$/gm, '*$1*').replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/^\s*[-•]\s+/gm, '• ').trim()
const tituloDaReceita = (t: string) => (t.match(/^[ \t]*#{1,4}[ \t]+(.+)$/m)?.[1] || t.match(/\*\*(.+?)\*\*/)?.[1] || 'Receita').replace(/[*#]/g, '').trim().slice(0, 60)
const ASSINATURA_RECEITA = 'Receita feita com a Doo, a assistente do Doonly · doonly.com.br'

function formatText(text: string): string {
  // Escapa o texto (a resposta vem da IA) e só então aplica negrito, itálico e listas.
  let h = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // (6.114) tabela em markdown ("| Ingrediente | Quantidade |") vira tabela de verdade (antes aparecia com os "|---|")
  h = h.replace(/(?:^[ \t]*\|.*\|[ \t]*(?:\n|$))+/gm, bloco => {
    const linhas = bloco.trim().split('\n').map(l => l.trim()).filter(l => l && !/^\|[\s:|-]+\|$/.test(l))
    if (!linhas.length) return bloco
    const celulas = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
    const [cab, ...corpo] = linhas
    return `<div class="dz-tbw"><table class="dz-tb"><thead><tr>${celulas(cab).map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${corpo.map(l => `<tr>${celulas(l).map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>\n`
  })
  // (6.114) "# Título" e "## Seção" viram títulos (antes os # apareciam na tela)
  h = h.replace(/^[ \t]*#{1,4}[ \t]+(.+?)[ \t#]*$/gm, (_m, t: string) => `<b class="dz-h">${t.replace(/\*\*/g, '')}</b>`)
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
       .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>')
  h = h.replace(/^\s*[-•] (.+)$/gm, '<li>$1</li>')
       .replace(/^\s*\d+[.)] (.+)$/gm, '<li data-n>$1</li>')
  // Antes as quebras de linha entre os itens viravam <br/> dentro da lista: espaço gigante (02/10)
  h = h.replace(/(?:<li>.*<\/li>\n?)+/g, m => `<ul>${m.replace(/\n/g, '')}</ul>`)
       .replace(/(?:<li data-n>.*<\/li>\n?)+/g, m => `<ol>${m.replace(/\n/g, '').replace(/ data-n/g, '')}</ol>`)
  h = h.replace(/<\/(ul|ol)>\n+/g, '</$1>').replace(/\n+(<ul>|<ol>)/g, '$1').replace(/\n{3,}/g, '\n\n')
  h = h.replace(/<\/div>\n+/g, '</div>').replace(/\n+(<div class="dz-tbw">)/g, '$1')
  return h.replace(/\n/g, '<br/>')
}

export default function DooIA({ forceOpen, onClose }: { forceOpen?: boolean; onClose?: () => void }) {
  const { isPro, loading: carregandoPlano } = usePlano()
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  // (11/10) imagens geradas já baixadas no aparelho (quando o endereço deixa), pro botão "Baixar imagem"
  const blobsImagem = useRef<Record<string, Blob>>({})
  /** (6.100) a última foto que ela mandou (para "faz uma parecida") */
  const ultimaReferencia = useRef<string>('')
  // (6.85) o formulário do topo de bolo
  const [topoAberto, setTopoAberto] = useState(false)
  const [topo, setTopo] = useState<TopoForm>({ tema: '', nome: '', texto: '', cores: '', estilo: 'fofo' })




  // Sync com forceOpen externo · (6.42) e fecha junto (o balão do computador minimiza)
  useEffect(() => {
    setOpen(!!forceOpen)
  }, [forceOpen])
  // (6.107) ao abrir, a conversa de antes continua e os atalhos aparecem em cima do campo, até ela mandar algo
  const [atalhos, setAtalhos] = useState(true)
  useEffect(() => { if (open) setAtalhos(true) }, [open])
  // (6.42) computador: janelinha no canto, sem escurecer a tela e sem travar a página de trás
  const [pc, setPc] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 901px)').matches)
  useEffect(() => { const mq = window.matchMedia('(min-width: 901px)'); const f = () => setPc(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [])

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
      // (6.107) aberta já com um pedido (campo do Início, atalhos): a conversa de antes continua e o pedido entra depois dela
      if (Array.isArray(salvo) && salvo.length) setMessages(prev => [...salvo, ...prev].slice(-60))
    } catch { /* conversa salva estragada: começa do zero */ }
    setConversaCarregada(true)
  }, [uid, conversaCarregada])
  useEffect(() => {
    if (!chaveConversa || !conversaCarregada) return
    try {
      const guardar = messages.slice(-60).map(m => ({ ...m, attachmentPreview: undefined, imageUrl: m.imageUrl?.startsWith('blob:') ? undefined : m.imageUrl }))
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
  const lojaRef = useRef<LojaDoo>({})
  // (6.107) a Doo lê a loja e o cardápio inteiros (sabe o que falta configurar)
  const lerLoja = (id: string) => Promise.resolve(supabase.from('profiles').select(CAMPOS_LOJA_DOO).eq('id', id).maybeSingle()).then(({ data }) => { lojaRef.current = (data as LojaDoo | null) || {} }).catch(() => {})
  useEffect(() => {
    if (!open || !uid) return
    carregandoCat.current = Promise.all([
      listarInsumosResumo(uid).then(l => { insRef.current = l; setInsumos(l) }).catch(() => {}),
      listarCatalogo(uid).then(c => { const v = { produtos: c.produtos, clientes: c.clientes }; catRef.current = v; setCatalogo(v) }).catch(() => {}),
      // (6.86) o nome e o horário da loja (a Doo muda pela conversa)
      lerLoja(uid),
    ])
  }, [open, uid])

  // (6.95) novidade sobre a ideia que ela mandou (recebida, em análise, implementada, recado da equipe): a Doo conta ao abrir
  // (6.101) e também os avisos da equipe Doonly (avisos, novidades e do plano PRO)
  useEffect(() => {
    if (!open || !uid || !conversaCarregada) return
    let vivo = true
    const chave = `doonly_doo_avisos_visto_${uid}`
    let visto = ''
    try { visto = localStorage.getItem(chave) || '' } catch { /* sem armazenamento */ }
    let q = supabase.from('notificacoes').select('titulo, mensagem, created_at').eq('user_id', uid).in('tipo', ['sugestao', 'aviso', 'noticia', 'pro']).order('created_at', { ascending: true }).limit(5)
    if (visto) q = q.gt('created_at', visto)
    else q = q.gt('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
    void Promise.resolve(q).then(({ data }) => {
      const l = (data as { titulo: string; mensagem: string; created_at: string }[] | null) || []
      if (!vivo || !l.length) return
      try { localStorage.setItem(chave, l[l.length - 1].created_at) } catch { /* sem armazenamento */ }
      setMessages(prev => [...prev, ...l.map(n => ({ role: 'assistant' as const, content: `**${n.titulo}**\n${n.mensagem}` }))])
    })
    return () => { vivo = false }
  }, [open, uid, conversaCarregada])

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
  useSobreposicao(open && !pc, handleClose, painelRef)

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

  // (6.115) "Nova conversa" guarda a de agora nas Conversas recentes (antes apagava)
  const chaveHist = uid ? `doonly_doo_historico_${uid}` : ''
  const [historico, setHistorico] = useState<ConversaSalva[]>([])
  const zerarRef = useRef(false)
  const [verTodas, setVerTodas] = useState(false)
  useEffect(() => {
    if (!chaveHist || !open) return
    try { const h = JSON.parse(localStorage.getItem(chaveHist) || '[]'); if (Array.isArray(h)) setHistorico(h) } catch { /* guardado estragado: começa vazio */ }
  }, [chaveHist, open])
  const gravarHistorico = (l: ConversaSalva[]) => { setHistorico(l); try { if (chaveHist) localStorage.setItem(chaveHist, JSON.stringify(l)) } catch { /* sem espaço: só não guarda */ } }
  const guardarAtual = (base: ConversaSalva[]) => {
    const ms = messages.filter(m => !m.erro).slice(-60).map(m => ({ ...m, attachmentPreview: undefined, imageUrl: m.imageUrl?.startsWith('blob:') ? undefined : m.imageUrl }))
    if (!ms.some(m => m.role === 'user')) return base
    return [{ id: `c${Date.now().toString(36)}`, titulo: tituloDaConversa(ms), quando: new Date().toISOString(), msgs: ms }, ...base].slice(0, 10)
  }
  const abrirConversa = (c: ConversaSalva) => {
    if (loading || generatingImage) return
    gravarHistorico(guardarAtual(historico.filter(x => x.id !== c.id)))
    setMessages(c.msgs); setVerTodas(false)
  }
  const clearConversation = () => {
    gravarHistorico(guardarAtual(historico))
    setMessages([])
    setInput('')
    setPendingImage(null)
    
  }

  // (11/10) "Nova conversa": pergunta antes, porque a conversa de agora sai do aparelho
  const novaConversa = async () => {
    if (loading || generatingImage) return
    if (messages.length) {
      const ok = await confirmar({ titulo: 'Começar uma nova conversa?', texto: 'A conversa de agora fica guardada em Conversas recentes.', rotulo: 'Nova conversa', rotuloVoltar: 'Voltar', icone: 'info' })
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
    link.download = `${blob.type.includes('jpeg') ? 'imagem' : 'topo-de-bolo'}-doo-${Date.now()}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(endereco), 10000)
  }

  // (6.91) depois que ela confirma o cartão, a Doo responde (antes salvava e ficava calada)
  const dooResponde = (texto: string) => setMessages(prev => [...prev, { role: 'assistant', content: texto }])

  // (6.101) a logo ou o banner que a Doo criou vão direto para o cardápio
  const usarNoCardapio = async (idx: number, uso: 'logo' | 'banner', url: string) => {
    if (!uid) return
    const { error } = await supabase.from('profiles').update(uso === 'logo' ? { logo_url: url } : { banner_url: url }).eq('id', uid)
    if (error) { avisar('Não deu para colocar no cardápio. Tente de novo.', { tipo: 'erro' }); return }
    setMessages(prev => prev.map((m, k) => k === idx ? { ...m, usoFeito: true } : m))
    dooResponde(uso === 'logo' ? 'Prontinho! Essa é a logo da sua loja agora e já aparece no cardápio. Para trocar depois, é em Cardápio digital › Aparência.' : 'Prontinho! O banner já está no topo do seu cardápio. Para trocar depois, é em Cardápio digital › Aparência.')
  }

  // (6.89) o topo numa folha A4 em PDF, pronto para imprimir (no celular abre o compartilhar, pra mandar no WhatsApp ou salvar)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const baixarPdfTopo = async (url: string) => {
    if (gerandoPdf) return
    setGerandoPdf(true)
    try {
      const blob = blobsImagem.current[url] || await fetch(url).then(r => r.blob())
      const dataUrl = await new Promise<string>((ok, falhou) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = falhou; fr.readAsDataURL(blob) })
      const dim = await new Promise<{ w: number; h: number }>((ok, falhou) => { const i = new Image(); i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = falhou; i.src = dataUrl })
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const mx = 10, my = 10, lw = 210 - mx * 2, lh = 297 - my * 2
      const esc = Math.min(lw / dim.w, lh / dim.h)
      const w = dim.w * esc, h = dim.h * esc
      doc.addImage(dataUrl, 'PNG', (210 - w) / 2, my, w, h)
      const nome = `topo-de-bolo-${Date.now()}.pdf`
      const arq = new File([doc.output('blob')], nome, { type: 'application/pdf' })
      const toque = window.matchMedia('(pointer: coarse)').matches
      if (toque && navigator.canShare?.({ files: [arq] })) await navigator.share({ files: [arq], title: 'Topo de bolo' }).catch(() => {})
      else doc.save(nome)
    } catch { avisar('Não deu para gerar o PDF. Tente de novo.', { tipo: 'erro' }) }
    finally { setGerandoPdf(false) }
  }

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview)
    setPendingImage(null)
  }

  // (6.114) receita: manda no WhatsApp ou gera o PDF (com o Doonly e o site no fim)
  const enviarReceita = (t: string) => {
    const msg = `${receitaEmTexto(t)}\n\n_${ASSINATURA_RECEITA}_`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
  }
  const pdfReceita = (t: string) => {
    const titulo = tituloDaReceita(t)
    void gerarDocumento(() => ({ titulo, tipo: 'Receita', numero: titulo,
      corpo: card('', `<div class="rc">${formatText(t.replace(NOTA_DO_APP, ''))}</div>`) + `<p style="margin-top:14px;text-align:center;color:#C33A6E;font-weight:500">${ASSINATURA_RECEITA}</p>` }))
  }
  const copyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(index)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // (6.85) cria a imagem (topo de bolo ou arte). A imagem fica guardada no Doonly: o link não vence e a conversa lembra dela.
  const criarImagem = async (prompt0: string, tipoImg: boolean | TipoImagem, referencia?: string) => {
    const tipoI: TipoImagem = typeof tipoImg === 'boolean' ? (tipoImg ? 'topo' : 'arte') : tipoImg
    const ehTopoDeBolo = tipoI === 'topo'
    // (6.100) com foto de referência: a mesma composição e estilo, mas um desenho novo
    const prompt = referencia ? `Use the attached image only as a reference for the layout, composition, style, colors and finish. Create a NEW original design that follows it closely, with the changes below. Do not copy logos, watermarks or website text from the reference. ${prompt0}` : prompt0
    setGeneratingImage(true)
    try {
      const res = await apiFetch('/api/doo-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, tipo: tipoI, ...(referencia ? { referencia } : {}) }) })
      const data = await lerResposta(res)
      const d0 = data?.data?.[0]
      let imageUrl = ''
      if (d0?.b64) {
        const tipoArq = d0.formato === 'jpeg' ? 'image/jpeg' : 'image/png'
        const bin = atob(d0.b64); const bytes = new Uint8Array(bin.length)
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k)
        const bruto = new Blob([bytes], { type: tipoArq })
        const blob = ehTopoDeBolo ? await comMarcaDagua(bruto) : tipoI === 'banner' ? await cortarBanner(bruto) : bruto
        try {
          const caminho = `doo/${uid || 'sem-conta'}/${Date.now()}.${tipoArq === 'image/jpeg' ? 'jpg' : 'png'}`
          const { error } = await supabase.storage.from('products').upload(caminho, blob, { contentType: tipoArq, upsert: false })
          if (error) throw error
          imageUrl = supabase.storage.from('products').getPublicUrl(caminho).data.publicUrl
        } catch { imageUrl = URL.createObjectURL(blob) }
        blobsImagem.current[imageUrl] = blob
      } else if (d0?.url) {
        imageUrl = d0.url
        // (6.89) o topo pelo gerador antigo também ganha a marca d'água e fica guardado no Doonly (quando o endereço deixa baixar)
        const original = await fetch(d0.url).then(r => (r.ok ? r.blob() : null)).catch(() => null)
        if (original) {
          const blob = ehTopoDeBolo ? await comMarcaDagua(original) : original
          try {
            const caminho = `doo/${uid || 'sem-conta'}/${Date.now()}.png`
            const { error } = await supabase.storage.from('products').upload(caminho, blob, { contentType: blob.type || 'image/png', upsert: false })
            if (!error) imageUrl = supabase.storage.from('products').getPublicUrl(caminho).data.publicUrl
          } catch { /* fica o endereço da OpenAI */ }
          blobsImagem.current[imageUrl] = blob
        }
      }
      if (!imageUrl) throw { type: 'api_error' }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: ehTopoDeBolo
          ? 'Seu topo de bolo está pronto! Baixe em PDF para imprimir numa folha A4, ou a imagem para mandar à gráfica.\n\n**Para imprimir:** papel fotográfico ou adesivo, em boa qualidade. Recorte pela borda branca e cole num palito ou num papel firme. Quer mudar algo? É só me dizer o que trocar.'
          : tipoI === 'logo' ? 'Aqui está a sua logo! Se gostou, toque em "Usar como logo da loja" e ela já aparece no seu cardápio. Quer outra versão? É só me dizer o que mudar.'
          : tipoI === 'banner' ? 'Aqui está o seu banner! Toque em "Colocar no cardápio" e ele já aparece no topo do seu cardápio. Quer mudar algo? É só me dizer.'
          : 'Aqui está a imagem. Toque em "Baixar imagem" para guardar.',
        ...(tipoI === 'logo' || tipoI === 'banner' ? { usoImagem: tipoI } : {}),
        imageUrl,
        isImage: true,
        ...(ehTopoDeBolo ? { ehTopo: true } : {}),
        ...(ehTopoDeBolo && prompt.length < 3400 ? { promptTopo: prompt } : {}),
      }])
    } catch (err: unknown) {
      const e = err as ErroDoo
      const frase = getErrorMessage(e?.type ?? '', e?.status, 'imagem', e?.codigo)
      setMessages(prev => [...prev, { role: 'assistant', content: e?.codigo && frase.startsWith('Não consegui') ? `${frase} (código: ${e.codigo}${e.detalhe ? ` · ${e.detalhe}` : ''})` : frase, erro: true }])
    } finally {
      setGeneratingImage(false)
    }
  }

  const criarTopo = () => {
    if (!topo.tema.trim()) { avisar('Conte o tema do topo', { tipo: 'erro' }); return }
    setTopoAberto(false)
    const resumo = ['Criar topo de bolo', `tema ${topo.tema.trim()}`, topo.nome.trim() && `nome "${topo.nome.trim()}"`, topo.texto.trim() && `"${topo.texto.trim()}"`, topo.cores.trim() && `cores ${topo.cores.trim()}`].filter(Boolean).join(' · ')
    setMessages(prev => [...prev, { role: 'user', content: resumo }])
    void criarImagem(promptTopo(topo), true)
  }

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if ((!text && !pendingImage) || loading || generatingImage) return
    setAtalhos(false)

    const userMsg: Message = {
      role: 'user',
      content: text || 'Analise essa imagem.',
      attachmentPreview: pendingImage?.preview
    }

    // (6.122) acabou de abrir e a conversa de antes foi guardada: começa do zero (o estado ainda não atualizou)
    const base = zerarRef.current ? [] : messages
    zerarRef.current = false
    const newMessages = [...base, userMsg]
    setMessages(newMessages)
    setInput(''); if (inputRef.current) inputRef.current.style.height = ''
    const imgPayload = pendingImage
    if (imgPayload) ultimaReferencia.current = imgPayload.base64
    const pedeParecida = /\b(semelhante|parecid[ao]|igual|nesse estilo|neste estilo|desse jeito|como essa|como esse|baseado|inspirad[ao])\b/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
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
      // (6.104) pedido de imagem vai sempre pela conversa: a Doo entende o tema, o nome e a idade e pergunta o que faltar
      //         (antes ia direto para o gerador e o texto do pedido inteiro virava o nome no topo)
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
            system: buildSystemPrompt(nomeConfeiteira) + negocio + regrasInsumo(insRef.current) + regrasPedido(catalogoParaDoo(catRef.current)) + regrasAcoesDoo(lojaRef.current),
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
          const { texto, acao: acaoBruta, extras } = extrairAcao(reply)
          // (6.94) a Doo entendeu que é pedido de imagem: o app cria (antes ela respondia que não conseguia)
          // (6.105) trava: imagem só quando a mensagem dela (ou a pergunta da Doo logo antes) é sobre imagem.
          //         "oi" ou "obrigada" nunca criam (a Doo às vezes repetia um topo antigo da conversa)
          const anterior = [...messages].reverse().find(m => m.role === 'assistant' && !m.isImage)?.content || ''
          const cumprimento = /^\s*(oi+|ol[aá]|e a[ií]|bom dia|boa tarde|boa noite|tudo bem\??|obrigad[ao]|valeu|ok+|blz|beleza|tchau)[\s!.?,]*$/i.test(text)
          const sobreImagem = /topo|topper|imagem|foto|logo|banner|arte|post|convite|faixa|idade|anos|cor|tema|estilo|nome|desenh|cria|gera|fa[zç]|refa[zç]|troca|muda|sim|pode|isso|separad|junt/i.test(text)
            || (/\?\s*$/.test(anterior.replace(/\n\n\[[^\]]*\]$/, '')) && /topo|imagem|logo|banner|arte|faixa|idade|cor|tema|estilo/i.test(anterior))
          // (6.112) também quando ela só agradeceu e a resposta diz que "está criando" (sem criar nada)
          const falaCriando = /(estou|vou|j[aá]).{0,20}(criando|criar|gerando|gerar|fazendo)/i.test(texto || '')
          if ((acaoBruta && acaoBruta.acao === 'imagem' && (cumprimento || !sobreImagem)) || (cumprimento && falaCriando)) {
            // (6.112) a resposta da IA falava em criar a imagem ("Já estou criando o seu topo"): no lugar dela, uma resposta curta e certa
            const agradeceu = /obrigad|valeu|brigad/i.test(text)
            const falaDeImagem = /cri(ando|ar|ei)|gerando|topo|imagem|logo|banner/i.test(texto || '')
            const resposta = agradeceu ? 'De nada! Precisando de mais alguma coisa, é só chamar.'
              : (!texto || falaDeImagem) ? `Oi${nomeConfeiteira ? `, ${nomeConfeiteira}` : ''}! Em que posso ajudar?` : texto
            setMessages(prev => [...prev, { role: 'assistant', content: resposta }])
            setLoading(false)
            return
          }
          if (acaoBruta && acaoBruta.acao === 'imagem') {
            const ai = acaoBruta as AcaoImagem
            setMessages(prev => [...prev, { role: 'assistant', content: texto }])
            setLoading(false)
            const tipoAi: TipoImagem = ai.tipo || (ai.topo ? 'topo' : 'arte')
            // (6.104) a Doo fica sabendo do que foi criado (para mudar depois sem perder o tema, o nome e a idade)
            const nota = ai.campos ? `\n\n[O app confirmou: topo criado com tema "${ai.campos.tema}", nome "${ai.campos.nome}", idade/frase "${ai.campos.texto}"${ai.campos.idadeNaFaixa ? ' na faixa' : ' em peça separada'}, cores "${ai.campos.cores || 'do tema'}", estilo ${ai.campos.estilo}.]` : `\n\n[O app confirmou: imagem (${tipoAi}) criada: ${ai.descricao.slice(0, 300)}.]`
            setMessages(prev => prev.map((m, k) => k === prev.length - 1 && m.role === 'assistant' ? { ...m, content: m.content + nota } : m))
            await criarImagem(tipoAi === 'topo' && ai.campos ? promptTopo(ai.campos) : tipoAi === 'topo'
              ? `Printable cake topper sheet for a Brazilian confectionery. Request in Portuguese: "${ai.descricao}". Any name or text must be written exactly as asked, with perfect Portuguese spelling, in bold script lettering with a white outline. ${FOLHA_TOPO}`
              : tipoAi === 'logo'
                ? `Professional logo for a Brazilian confectionery (cake and sweets shop). Request in Portuguese: "${ai.descricao}". The store name must be written exactly as asked, perfect spelling, highly readable. Centered round badge composition that works inside a circle, simple shapes, flat vector style, crisp edges, solid background filling the whole square, no mockup, no extra words.`
              : tipoAi === 'banner'
                ? `Wide promotional banner for a Brazilian confectionery's online menu. Request in Portuguese: "${ai.descricao}". Landscape composition with the important content centered and safe margins on all sides, any text in Portuguese with perfect spelling and few words, appetizing sweets, vibrant and clean, high quality, no website text, no mockup.`
              : buildImagePrompt(ai.descricao), tipoAi, imgPayload?.base64 || (pedeParecida ? ultimaReferencia.current : undefined))
            return
          }
          const acao = acaoBruta as RascunhoInsumo | RascunhoPedido | AcaoDoo | null
          setMessages(prev => [...prev, acao
            ? { role: 'assistant', content: texto, acao, acaoEstado: 'pendente' }
            : { role: 'assistant', content: texto, ...(cortada ? { cortada: true } : {}) },
            // (6.116) as outras ações da mesma resposta: um cartão para cada, sem balão de texto
            ...extras.map(a => ({ role: 'assistant' as const, content: '', acao: a, acaoEstado: 'pendente' as const }))])
        }
      }
    } catch (err: unknown) {
      const frase = getErrorMessage((err as ErroDoo)?.type ?? '', (err as ErroDoo)?.status, imgPayload ? 'foto' : isImageRequest(text) ? 'imagem' : 'texto')
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
  // (6.122) toda vez que abre, a Doo começa na tela de abertura: a conversa de antes vai para "Continuar conversa anterior"
  const abriuRef = useRef(false)
  useEffect(() => {
    if (!open) { abriuRef.current = false; return }
    if (abriuRef.current || !conversaCarregada || loading || generatingImage) return
    abriuRef.current = true
    if (!messages.some(m => m.role === 'user')) return
    let salvo: ConversaSalva[] = []
    try { const h = JSON.parse(localStorage.getItem(chaveHist) || '[]'); if (Array.isArray(h)) salvo = h } catch { /* guardado estragado */ }
    gravarHistorico(guardarAtual(salvo))
    zerarRef.current = true
    setMessages([]); setVerTodas(false)
  }, [open, conversaCarregada]) // eslint-disable-line react-hooks/exhaustive-deps
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

  // (6.81) a Doo IA é só do PRO: no grátis, abrir mostra o convite do PRO
  if (open && !isPro && !carregandoPlano) return <ConvitePro recurso="doo" onClose={handleClose} />

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }} />


      {/* ── Overlay blur ── */}
      {open && !pc && (
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
            <div className="dz-hav"><img src="/Sistema/doo.webp" alt="" /><i aria-hidden="true" /></div>
            <div className="dz-ht">
              <b>Doo IA{isPro && <> <em>PRO</em></>}</b>
              <small className={loading || generatingImage ? 'dz-esc' : ''}><i aria-hidden="true" />{loading ? 'Escrevendo…' : generatingImage ? 'Criando a imagem…' : <>Online<span className="dz-on-x"> · responde na hora</span></>}</small>
            </div>
            {messages.length > 0 && (
              <button type="button" className="dz-hb" onClick={novaConversa} disabled={loading || generatingImage} aria-label="Nova conversa" title="Nova conversa"><NotePencil size={20} weight="bold" /></button>
            )}
            <button type="button" className="dz-hb dz-fechar" onClick={handleClose} aria-label={pc ? "Minimizar" : "Fechar"} title={pc ? "Minimizar" : "Fechar"}>{pc ? <Minus size={20} weight="bold" /> : <X size={20} weight="bold" />}</button>
          </div>

          {/* Mensagens */}
          <div className="dz-body">
            {showSuggestions && (
              <div className="dz-ini">
                {/* (6.115) abertura nova: oi curto, o topo de bolo em destaque, 6 atalhos e as conversas recentes */}
                {/* (6.122) sem o "Oi, fulana!": repetia o que os atalhos já mostram */}
                {isPro && <button type="button" className="dz-dest" onClick={() => setTopoAberto(true)}>
                  <span className="dz-dest-ic"><Cake size={22} weight="bold" /></span>
                  <span className="dz-dest-tx"><b>Topo de bolo com IA</b><small>Nome e tema · PDF pronto</small></span>
                  <span className="dz-dest-bt">Criar</span>
                </button>}
                <div className="dz-sg2">
                  {SUGESTOES_CARTOES.map(({ Ic, t, s, p }) => (
                    <button type="button" key={t} className="dz-sc2" onClick={() => sendMessage(p)}>
                      <span className="dz-sc2-ic"><Ic size={18} weight="bold" /></span><span className="dz-sc2-tx"><b>{t}</b><small>{s}</small></span>
                    </button>
                  ))}
                </div>
                {historico.length > 0 && (
                  <section className="dz-rec" aria-label="Conversas recentes">
                    {/* (6.122) a última conversa em destaque, para continuar de onde parou */}
                    <button type="button" className="dz-cont" onClick={() => abrirConversa(historico[0])}>
                      <span className="dz-cont-ic" aria-hidden="true"><ChatCircleDots size={22} weight="bold" /></span>
                      <span className="dz-cont-tx"><em>Continuar conversa anterior</em><b>{historico[0].titulo}</b><small>{quandoFoi(historico[0].quando)}</small></span>
                      <CaretRight size={18} weight="bold" className="dz-cont-seta" aria-hidden="true" />
                    </button>
                    {historico.length > 1 && <>
                      <p className="dz-rec-t"><span>Conversas recentes</span>{historico.length > 4 && <button type="button" onClick={() => setVerTodas(v => !v)}>{verTodas ? 'Ver menos' : 'Ver todas'}</button>}</p>
                      {(verTodas ? historico.slice(1) : historico.slice(1, 4)).map(c => (
                        <button type="button" key={c.id} className="dz-rec-i" onClick={() => abrirConversa(c)}>
                          <span className="dz-rec-ic" aria-hidden="true"><ChatCircleDots size={16} weight="bold" /></span>
                          <span className="dz-rec-tx"><b>{c.titulo}</b><small>{quandoFoi(c.quando)}</small></span>
                        </button>
                      ))}
                    </>}
                  </section>
                )}
              </div>
            )}

            {messages.length > 0 && <p className="dz-dia">Hoje</p>}

            {messages.map((msg, i) => (
              <div key={i} className={`dz-m ${msg.role === 'user' ? 'dz-m--eu' : 'dz-m--doo'}`}>
                {msg.role === 'assistant' && <img src="/Sistema/doo.webp" alt="" className="dz-mav" />}
                <div className="dz-mc">
                  {(msg.content.replace(NOTA_DO_APP, '').trim() || msg.attachmentPreview || msg.imageUrl) && <div className="dz-bd">
                    {msg.attachmentPreview && <img src={msg.attachmentPreview} alt="Referência" className="dz-anexo" />}
                    {msg.imageUrl && <img src={msg.imageUrl} alt="Imagem gerada" className="dz-gerada" />}
                    <span dangerouslySetInnerHTML={{ __html: formatText(msg.content.replace(NOTA_DO_APP, '')) }} />
                  </div>}
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
                        if (estado === 'salvo') dooResponde(`Prontinho! O pedido${info?.numero ? ` #${info.numero}` : ''} já está na sua agenda. Quer que eu escreva a mensagem de confirmação para o cliente?`)
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
                        if (estado === 'salvo') dooResponde(`Prontinho! ${final?.nome || 'O ingrediente'} já está ${(msg.acao as RascunhoInsumo).insumo_id ? 'com o preço novo' : 'nos seus ingredientes'}. As fichas técnicas que usam ele já recalculam o custo.`)
                        if (estado === 'salvo') listarInsumosResumo(uid).then(setInsumos).catch(() => {})
                      }} />
                  )}
                  {msg.acao && uid && (ACOES_DOO as readonly string[]).includes(msg.acao.acao) && (
                    <CartaoAcaoDoo uid={uid} acao={msg.acao as AcaoDoo} estado={!msg.acaoEstado || msg.acaoEstado === 'editando' ? 'pendente' : msg.acaoEstado}
                      feito={msg.acaoFeito} abrir={msg.acaoAbrir} aoAbrir={handleClose}
                      onFeito={(estado, info) => {
                        const nota = estado === 'salvo' ? `\n\n[O app confirmou: ${info?.feito}.]` : '\n\n[A confeiteira cancelou.]'
                        setMessages(prev => prev.map((m, k) => k === i ? { ...m, acaoEstado: estado, acaoFeito: info?.feito, acaoAbrir: info?.abrir, content: m.content + nota } : m))
                        if (estado === 'salvo') dooResponde(respostaFeito(msg.acao as AcaoDoo, info?.feito || ''))
                        if (estado === 'salvo') {
                          listarCatalogo(uid).then(c => { const v = { produtos: c.produtos, clientes: c.clientes }; catRef.current = v; setCatalogo(v) }).catch(() => {})
                          if ((msg.acao as AcaoDoo).acao === 'ficha') listarInsumosResumo(uid).then(l => { insRef.current = l; setInsumos(l) }).catch(() => {}) // (6.114) os ingredientes novos da ficha
                          if ((msg.acao as AcaoDoo).acao === 'loja') void lerLoja(uid)
                        }
                      }} />
                  )}
                  {msg.role === 'assistant' && !msg.isImage && !!msg.content.replace(NOTA_DO_APP, '').trim() && (
                    <div className="dz-acs">
                      <button type="button" onClick={() => copyMessage(msg.content.replace(NOTA_DO_APP, ''), i)} className={copiedId === i ? 'ok' : ''}>
                        {copiedId === i ? <><Check size={16} weight="bold" />Copiado</> : <><Copy size={16} weight="bold" />Copiar</>}
                      </button>
                      {ehReceita(msg.content) && <>
                        <button type="button" onClick={() => enviarReceita(msg.content)}><WhatsappLogo size={16} weight="bold" />Enviar</button>
                        <button type="button" onClick={() => pdfReceita(msg.content)}><FilePdf size={16} weight="bold" />PDF</button>
                      </>}
                      {msg.oferecerNova && i === messages.length - 1 && (
                        <button type="button" onClick={novaConversa}><NotePencil size={16} weight="bold" />Nova conversa</button>
                      )}
                    </div>
                  )}
                  {msg.imageUrl && (
                    <div className="dz-acs">
                      <button type="button" onClick={() => baixarImagem(msg.imageUrl as string)}><DownloadSimple size={16} weight="bold" />Baixar imagem</button>
                      {msg.ehTopo && <button type="button" disabled={gerandoPdf} onClick={() => void baixarPdfTopo(msg.imageUrl as string)}><FilePdf size={16} weight="bold" />{gerandoPdf ? 'Gerando…' : 'Baixar em PDF'}</button>}
                      {msg.usoImagem && !msg.usoFeito && /^https?:/.test(msg.imageUrl || '') && <button type="button" onClick={() => void usarNoCardapio(i, msg.usoImagem!, msg.imageUrl as string)}><Storefront size={16} weight="bold" />{msg.usoImagem === 'logo' ? 'Usar como logo da loja' : 'Colocar no cardápio'}</button>}
                      {msg.usoFeito && <span className="dz-uso-ok"><Check size={14} weight="bold" />{msg.usoImagem === 'logo' ? 'É a logo da loja' : 'Está no cardápio'}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(loading || generatingImage) && (
              <div className="dz-m dz-m--doo">
                <img src="/Sistema/doo.webp" alt="" className="dz-mav" />
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
            {atalhos && messages.length > 0 && !loading && !generatingImage && !pendingImage && (
              <div className="dz-atl" aria-label="Atalhos">
                {isPro && <button type="button" onClick={() => { setAtalhos(false); setTopoAberto(true) }}><Cake size={16} />Criar topo de bolo</button>}
                {SUGESTOES_CARTOES.map(({ Ic, t, p }) => (
                  <button type="button" key={t} onClick={() => void sendMessage(p)}><Ic size={16} />{t}</button>
                ))}
              </div>
            )}
            <div className="dz-inb">
              <button type="button" className="dz-ib" onClick={() => fileRef.current?.click()} aria-label="Enviar uma foto" title="Enviar uma foto"><ImageSquare size={20} weight="bold" /></button>
              {/* (6.93) campo de texto de várias linhas (textarea): o navegador nunca oferece "senhas salvas" nele, como fazia no <input> */}
              <textarea
                ref={inputRef}
                rows={1}
                name="mensagem-doo"
                value={input}
                onChange={e => { setInput(e.target.value); const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 104)}px` }}
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

      <Janela aberta={topoAberto} aoFechar={() => setTopoAberto(false)} tipo="conteudo" titulo="Topo de bolo" umaAcao
        acoes={<Botao cheio icone={<Sparkle size={18} weight="fill" />} onClick={criarTopo}>Criar o topo</Botao>}>
        <div className="dz-topo-f">
          <Campo rotulo="Tema" value={topo.tema} autoFocus maxLength={120} placeholder="Ex.: Jardim encantado com borboletas" onChange={e => setTopo(t => ({ ...t, tema: e.target.value }))} />
          <Campo rotulo="Nome" value={topo.nome} maxLength={40} placeholder="Ex.: Alice" onChange={e => setTopo(t => ({ ...t, nome: e.target.value }))} />
          <Campo rotulo="Idade ou frase" value={topo.texto} maxLength={40} placeholder="Ex.: 5 anos" onChange={e => setTopo(t => ({ ...t, texto: e.target.value }))} />
          <Campo rotulo="Cores" value={topo.cores} maxLength={80} placeholder="Ex.: rosa claro e lilás" onChange={e => setTopo(t => ({ ...t, cores: e.target.value }))} />
          <CaixasEscolha rotulo="Estilo" valor={topo.estilo} opcoes={[
            { v: 'fofo', t: 'Fofo', sub: 'Desenho delicado, para festa infantil' },
            { v: 'elegante', t: 'Elegante', sub: 'Traço fino e detalhes dourados' },
            { v: 'divertido', t: 'Divertido', sub: 'Colorido, com letras animadas' },
          ]} onMudar={v => setTopo(t => ({ ...t, estilo: v }))} />
        </div>
      </Janela>

      <style>{`
        /* (6.86) cartão das ações (cliente, produto, orçamento, loja, cupom) */
.dz-uso-ok { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--ui-verde); }
        .dz-ac { margin-top: 8px; padding: 12px 14px; border: 1px solid var(--ui-borda); border-radius: 16px; background: var(--ui-branco); }
        .dz-ac-t { margin: 0 0 8px; font-size: 14.5px; font-weight: 600; color: var(--ui-texto); }
        .dz-ac-l { display: flex; flex-direction: column; gap: 6px; margin: 0; }
        .dz-ac-l > div { display: flex; flex-direction: column; gap: 1px; }
        .dz-ac-l dt { font-size: 12px; color: var(--ui-texto-2); }
        .dz-ac-l dd { margin: 0; font-size: 14px; font-weight: 500; color: var(--ui-texto); overflow-wrap: anywhere; }
        .dz-ac-bts { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; margin-top: 12px; }
        .dz-ac-bts button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 42px; border: 0; border-radius: 12px; font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
        .dz-ac-nao { background: var(--ui-cinza); color: var(--ui-texto); }
        .dz-ac-sim { background: var(--ui-rosa-botao, #CC2E66); color: #fff; }
        .dz-ac-bts button:disabled { opacity: .6; cursor: default; }
        .dz-ac-erro { margin: 10px 0 0; font-size: 13px; font-weight: 600; color: #B91C1C; }
        .dz-ac-ok { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--ui-linha); }
        .dz-ac-ok > span { display: flex; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 600; color: var(--ui-verde); }
        .dz-ac-zap { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 12px; border-radius: 10px; background: #15803D; font-size: 13.5px; font-weight: 600; color: #fff; text-decoration: none; }
        .dz-ac-ok button { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--ui-cinza); font-family: inherit; font-size: 13.5px; font-weight: 600; color: var(--ui-texto); cursor: pointer; }
        .dz-ac-can { margin: 10px 0 0; font-size: 13px; color: var(--ui-texto-3); }
        .dz-ac--cancelado { opacity: .7; }
        /* (6.85) topo de bolo */
        .dz-topo { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0 0 10px; padding: 12px 14px; border: 1px solid #F3C6D8; border-radius: 16px; background: #FFF5F9; font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
        .dz-topo .dz-si { flex: none; }
        .dz-topo-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .dz-topo-tx b { font-size: 14.5px; font-weight: 600; }
        .dz-topo-tx small { font-size: 12.5px; line-height: 1.35; color: var(--ui-texto-2); }
        .dz-topo-br { flex: none; color: var(--ui-rosa); }
        .dz-topo-f { display: flex; flex-direction: column; gap: 14px; }
        .dz-gerada { background: repeating-conic-gradient(#F3EEF0 0% 25%, #fff 0% 50%) 50% / 16px 16px; }
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
        /* (04/11 · 6.42) COMPUTADOR: janelinha de chat no canto direito, em cima do balão (estilo atendimento de site) */
        @media (min-width: 901px) {
          .dooia-panel { top: auto; left: auto; right: 24px; bottom: 100px; width: 420px; height: min(700px, calc(100dvh - 124px)); border-radius: 20px; animation: dooPop .2s cubic-bezier(.16,1,.3,1); transform-origin: bottom right; }
        }
        @keyframes dooPop { from { opacity: 0; transform: translateY(12px) scale(.96); } }
        .dz-hd { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: calc(12px + env(safe-area-inset-top, 0px)) 14px 14px; background: radial-gradient(130% 160% at 0 0, #5A3626, var(--ui-vinho-escuro) 70%); color: var(--ui-branco); }
        .dz-hb { width: 44px; height: 44px; border-radius: var(--ui-raio); border: none; background: rgba(255,255,255,.12); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-hb:disabled { opacity: .35; cursor: default; }
        .dz-fechar { display: none; }
        @media (min-width: 768px) { .dz-voltar { display: none; } .dz-fechar { display: flex; } }
        .dz-hav { position: relative; width: 44px; height: 44px; border-radius: 14px; background: #FCE7F3; border: 2px solid rgba(255,255,255,.35); flex-shrink: 0; }
        .dz-hav img { width: 100%; height: 100%; object-fit: cover; object-position: top center; border-radius: var(--ui-raio); display: block; }
        .dz-hav i { position: absolute; right: -3px; bottom: -3px; width: 14px; height: 14px; border-radius: 50%; background: #22C55E; border: 2.5px solid var(--ui-texto); }
        .dz-ht { flex: 1; min-width: 0; }
        .dz-h { display: block; margin: 6px 0 2px; font-size: 15.5px; font-weight: 600; color: var(--ui-texto); }
        /* (6.114) tabela nas respostas da Doo */
        .dz-tbw { overflow-x: auto; margin: 8px 0; }
        .dz-tb { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .dz-tb th { text-align: left; font-weight: 600; color: var(--ui-texto-2); font-size: 12.5px; padding: 6px 8px; border-bottom: 1px solid var(--ui-borda); white-space: nowrap; }
        .dz-tb td { padding: 6px 8px; border-bottom: 1px solid var(--ui-linha); vertical-align: top; }
        .dz-tb td:not(:first-child), .dz-tb th:not(:first-child) { text-align: right; white-space: nowrap; }
        .dz-ht b { display: flex; align-items: center; gap: 7px; font-size: 17px; font-weight: 600; }
        .dz-ht em { font-style: normal; font-size: 12px; font-weight: 600; padding: 2px 7px; border-radius: 6px; background: linear-gradient(90deg, #F9A8D4, #C4B5FD); color: var(--ui-texto); }
        .dz-ht small { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #BBF7D0; margin-top: 2px; white-space: nowrap; }
        .dz-ht small i { flex: none; }
        /* (6.108) celular estreito: só "Online" (o "responde na hora" quebrava em 2 linhas) */
        @media (max-width: 380px) { .dz-ht small .dz-on-x { display: none; } }
        .dz-ht small i { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 3px rgba(34,197,94,.25); }
        .dz-ht small.dz-esc { color: #FBCFE8; } .dz-ht small.dz-esc i { background: #F472B6; box-shadow: 0 0 0 3px rgba(244,114,182,.3); animation: dooTyping 1.2s infinite; }
        .dz-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 16px 14px 8px; display: flex; flex-direction: column; gap: 12px; }
        .dz-ini { display: flex; flex-direction: column; gap: 12px; }
        .dz-hero2 { display: flex; align-items: center; gap: 12px; padding: 2px 2px 0; }
        .dz-hero2 img { flex: none; width: 60px; height: 60px; object-fit: contain; }
        .dz-hero2 b { display: block; font-size: 18px; font-weight: 600; }
        .dz-hero2 small { display: block; font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); }
        .dz-dest { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px; border: 0; border-radius: 16px; font-family: inherit; text-align: left; color: #fff; cursor: pointer;
          background: radial-gradient(120% 120% at 100% 0%, rgba(232,90,140,.55), rgba(232,90,140,0) 60%), linear-gradient(140deg, #4A2B1F, #22130E); }
        .dz-dest-ic { flex: none; width: 40px; height: 40px; border-radius: 12px; background: rgba(255,255,255,.14); display: flex; align-items: center; justify-content: center; color: #FF9DC4; }
        .dz-dest-tx { flex: 1; min-width: 0; } .dz-dest-tx b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dz-dest-tx small { display: block; font-size: 12px; color: rgba(255,255,255,.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dz-dest-bt { flex: none; padding: 7px 12px; border-radius: 10px; background: #fff; color: var(--ui-rosa-escuro); font-size: 13px; font-weight: 600; }
        .dz-sg2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .dz-sc2 { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 10px; border: 1px solid #F0EBED; border-radius: 14px; background: var(--ui-branco); font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
        .dz-sc2:hover { border-color: #F7C6D9; }
        .dz-sc2-ic { flex: none; width: 34px; height: 34px; border-radius: 10px; background: var(--ic-fundo, #fff); box-shadow: inset 0 0 0 1px var(--ic-borda, #E8E1E4); color: var(--ic-cor, #E85A8C); display: flex; align-items: center; justify-content: center; }
        .dz-sc2-tx { min-width: 0; } .dz-sc2-tx b { display: block; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dz-sc2-tx small { display: block; font-size: 11.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 380px) {
          .dz-sc2 { gap: 7px; padding: 9px 8px; } .dz-sc2-ic { width: 30px; height: 30px; }
          .dz-sc2-tx b { font-size: 12.5px; } .dz-sc2-tx small { font-size: 11px; }
          .dz-dest { gap: 10px; padding: 11px 10px; } .dz-dest-bt { padding: 7px 10px; }
        }
        .dz-rec { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
        .dz-cont { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 76px; margin-bottom: 6px; padding: 14px; border: 1px solid #F3C9D9; border-radius: 16px; background: linear-gradient(135deg, #FFF5F9, var(--ui-branco)); font-family: inherit; text-align: left; color: inherit; cursor: pointer; transition: border-color .15s; }
        .dz-cont:hover { border-color: var(--ui-rosa, #E85A8C); }
        .dz-cont-ic { flex: none; width: 44px; height: 44px; border-radius: 12px; background: var(--ui-branco); box-shadow: inset 0 0 0 1px #F3C9D9; color: var(--ui-rosa-escuro, #C33A6E); display: flex; align-items: center; justify-content: center; }
        .dz-cont-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
        .dz-cont-tx em { font-style: normal; font-size: 12px; font-weight: 600; color: var(--ui-rosa-escuro, #C33A6E); }
        .dz-cont-tx b { font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dz-cont-tx small { font-size: 12px; color: var(--ui-texto-3); }
        .dz-cont-seta { flex: none; color: var(--ui-texto-3); }
        .dz-rec-t { display: flex; justify-content: space-between; align-items: center; margin: 0; font-size: 12.5px; font-weight: 500; color: var(--ui-texto-2); }
        .dz-rec-t button { border: 0; background: none; padding: 4px 0; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
        .dz-rec-i { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border: 1px solid #F0EBED; border-radius: 12px; background: var(--ui-branco); font-family: inherit; text-align: left; color: inherit; cursor: pointer; }
        .dz-rec-ic { flex: none; width: 28px; height: 28px; border-radius: 8px; background: var(--ic-fundo, #fff); box-shadow: inset 0 0 0 1px var(--ic-borda, #E8E1E4); color: var(--ic-cor, #E85A8C); display: flex; align-items: center; justify-content: center; }
        .dz-rec-tx { min-width: 0; } .dz-rec-tx b { display: block; font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .dz-rec-tx small { font-size: 11.5px; color: var(--ui-texto-3); }
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
        /* (6.107) atalhos com a conversa aberta: uma fileira que rola para o lado, sem quebrar linha */
        .dz-atl { display: flex; gap: 8px; overflow-x: auto; margin: 0 -12px 8px; padding: 2px 12px; scrollbar-width: none; }
        .dz-atl::-webkit-scrollbar { display: none; }
        .dz-atl button { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid #F0EBED; border-radius: 999px; background: var(--ui-branco); font: 500 13px/1 inherit; font-family: inherit; color: var(--ui-texto); white-space: nowrap; cursor: pointer; }
        .dz-atl button svg { color: var(--ic-cor, #993556); }
        .dz-atl button:hover { border-color: #F7C6D9; }
        .dz-inb { display: flex; align-items: center; gap: 8px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: 999px; padding: 4px; box-shadow: 0 4px 14px rgba(44,18,25,.06); transition: border-color .15s; }
        .dz-inb:focus-within { border-color: #F3B3CA; } /* (6.91) borda fina, sem o anel grosso */
        .dz-ib { width: 44px; height: 44px; border-radius: 50%; border: none; background: #F2EFF0; color: var(--ui-texto-2); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .dz-txt { flex: 1; min-width: 0; height: 44px; max-height: 104px; border: none; outline: none; background: none; font-family: inherit; font-size: 16px; line-height: 22px; color: var(--ui-texto); padding: 11px 2px; box-sizing: border-box; resize: none; overflow-y: auto; scrollbar-width: none; }
        .dz-txt::-webkit-scrollbar { display: none; }
        .dz-txt::placeholder { color: #B5AAB0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dz-snd { width: 44px; height: 44px; border-radius: 50%; border: none; background: var(--ui-rosa-botao, #CC2E66); color: var(--ui-branco); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; box-shadow: 0 4px 12px rgba(232,90,140,.35); transition: background .15s; }
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
