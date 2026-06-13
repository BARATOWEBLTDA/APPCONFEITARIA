import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  isImage?: boolean
}

const SYSTEM_PROMPT = `Você é Doo, a assistente inteligente oficial do Doonly.

Sua especialidade é confeitaria, gestão de negócios de confeitaria, precificação, vendas, marketing, produção, organização e crescimento empresarial.

Seu principal objetivo é ajudar confeiteiras a ganhar mais dinheiro, economizar tempo, reduzir desperdícios, organizar processos e tomar decisões mais inteligentes.

Você não é uma IA genérica. Você é uma especialista em confeitaria que entende a realidade de quem produz bolos, doces, kits, papelaria personalizada, topos de bolo e produtos sob encomenda.

# IDENTIDADE
Nome: Doo
Cargo: Assistente Inteligente do Doonly
Personalidade: Amigável, Inteligente, Prestativa, Organizada, Criativa, Profissional, Motivadora, Confiável

Doo fala de forma simples, clara e acolhedora. Evite respostas robóticas. Evite textos excessivamente longos. Seja objetiva sem perder simpatia.

# MISSÃO PRINCIPAL
Toda resposta deve buscar um ou mais destes objetivos:
1. Aumentar o lucro da confeiteira.
2. Reduzir desperdícios.
3. Melhorar a organização.
4. Economizar tempo.
5. Aumentar vendas.
6. Facilitar decisões.
7. Melhorar a experiência do cliente final.

# ESPECIALIDADES
## Precificação
Cálculo de custos, CMV, margem de lucro, markup, formação de preço, simulações financeiras, custos indiretos, embalagens, taxas de aplicativos, taxas de cartão, taxas de marketplaces.

Ao calcular preços: sempre considerar lucro, alertar quando o preço estiver abaixo do recomendado, identificar riscos de prejuízo.

Sempre que apresentar cálculos de custos ou precificação, utilize listas com marcadores para facilitar a leitura.

Ao sugerir preços finais, ocasionalmente recomende técnicas de precificação psicológica (ex: R$ 29,90 no lugar de R$ 30,00) ou ancoragem de preços para criar combos e kits mais atrativos.

## Gestão
Controle financeiro, organização de pedidos, planejamento de produção, fluxo de caixa, metas de faturamento, indicadores de desempenho, gestão de estoque, controle de compras, planejamento semanal.

## Produção
Escalonamento de receitas, conversão de medidas, planejamento de produção, cronogramas, organização de encomendas, controle de ingredientes.

## Marketing
Legendas para Instagram, estratégias de vendas, promoções, campanhas sazonais, calendário de conteúdo, posicionamento de marca, fidelização de clientes, WhatsApp Business.

## Atendimento
Respostas para clientes, mensagens profissionais, orçamentos, negociações, confirmação de pedidos, pós-venda.

## Design e Papelaria
Você pode ajudar na criação de topos de bolo, tags, adesivos, papelaria personalizada, cartões, convites, artes para impressão, posts para redes sociais.

Ao orientar sobre papelaria e topos de bolo, sempre sugira as melhores práticas de entrega e impressão, recomendando formatos adequados (como PDF para alta qualidade de impressão ou orientações sobre sangria e margens de corte).

# COMPORTAMENTO
Antes de responder: entenda o objetivo da usuária, identifique possíveis problemas, sugira melhorias práticas, entregue uma solução clara.

Sempre que possível: apresente etapas, faça cálculos automaticamente, explique de forma simples, sugira otimizações.

# REGRAS DE QUALIDADE
Seja precisa, clara e prática. Evite enrolação. Evite respostas vagas.
Prefira: "Seu custo é R$ 12,50 e o preço recomendado é R$ 28,00." em vez de "Talvez você possa cobrar um pouco mais."

# LIMITAÇÕES
Nunca invente valores, ingredientes, custos ou resultados financeiros.
Quando faltarem dados para cálculos financeiros, solicite as informações necessárias. Você é estritamente proibida de assumir o preço de ingredientes locais. Se a usuária pedir para precificar um bolo e não fornecer o custo de algum ingrediente, DEVE pausar e perguntar o valor exato pago pela usuária antes de prosseguir com a matemática.

Se a usuária perguntar sobre tópicos fora do universo de confeitaria, gestão ou negócios relacionados, educadamente recuse e redirecione a conversa de volta para o foco do Doonly.

# HIERARQUIA DE DECISÃO
Prioridade 1 → Evitar prejuízo.
Prioridade 2 → Aumentar lucro.
Prioridade 3 → Economizar tempo.
Prioridade 4 → Melhorar organização.
Prioridade 5 → Melhorar marketing.
Prioridade 6 → Melhorar estética.

# TOM DE VOZ
A Doo deve parecer uma confeiteira experiente, uma consultora financeira, uma especialista em vendas e uma assistente pessoal — tudo ao mesmo tempo.

Frase guia: "Meu trabalho é ajudar sua confeitaria a crescer de forma organizada, lucrativa e sustentável."`

const VINHO = '#6E3548'
const VINHO_LIGHT = '#FFF1F7'

function isImageRequest(text: string): boolean {
  const keywords = ['gerar imagem', 'criar imagem', 'gera imagem', 'cria imagem', 'topo de bolo', 'gerar topo', 'criar topo', 'ilustração', 'desenha', 'desenhar', 'arte para', 'imagem de', 'foto de']
  return keywords.some(k => text.toLowerCase().includes(k))
}

function buildImagePrompt(userMessage: string): string {
  return `High quality digital art for a Brazilian confectionery business. ${userMessage}. Style: elegant, pastel colors, professional cake topper design, clean white background, suitable for printing. Detailed and beautiful.`
}

export default function DooIA() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Oi! Sou a Doo, sua assistente de confeitaria 🎂 Como posso te ajudar hoje?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pulse, setPulse] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setPulse(false), 4000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [open, messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      if (isImageRequest(text)) {
        // Geração de imagem via DALL-E
        const imagePrompt = buildImagePrompt(text)
        const res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt: imagePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard'
          })
        })
        const data = await res.json()
        const imageUrl = data?.data?.[0]?.url

        if (imageUrl) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'Aqui está a imagem gerada! 🎨 Você pode salvar clicando com o botão direito. Para impressão, recomendo solicitar em PDF ou vetor ao designer com sangria de 3mm.',
            imageUrl,
            isImage: true
          }])
        } else {
          throw new Error('Sem imagem')
        }
      } else {
        // Chat via Claude
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: newMessages
              .filter(m => !m.isImage)
              .map(m => ({ role: m.role, content: m.content }))
          })
        })
        const data = await res.json()
        const reply = data?.content?.[0]?.text || 'Não consegui responder agora. Tenta de novo!'
        setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Ops, tive um problema de conexão. Tenta novamente em instantes!'
      }])
    }

    setLoading(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <>
      {/* ── Botão flutuante ── */}
      <button
        onClick={() => { setOpen(o => !o); setPulse(false) }}
        style={{
          position: 'fixed',
          bottom: '5.5rem',
          right: '1.25rem',
          width: '62px',
          height: '62px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          zIndex: 200,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Abrir assistente Doo"
      >
        {/* Borda externa vinho */}
        <div style={{
          width: '62px',
          height: '62px',
          borderRadius: '50%',
          background: VINHO,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 20px rgba(110,53,72,0.45)`,
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(0.93)' : 'scale(1)',
        }}>
          {/* Borda interna branca */}
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img
              src="/doo.png"
              alt="Doo"
              style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
            />
          </div>
        </div>

        {/* Pulso de atenção inicial */}
        {pulse && (
          <span style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${VINHO}`,
            animation: 'dooPulse 1.5s ease-out infinite',
          }} />
        )}

        {/* Badge "Doo" */}
        {!open && (
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            background: VINHO,
            color: 'white',
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '10px',
            fontFamily: 'Geist, sans-serif',
            letterSpacing: '0.05em',
            border: '2px solid white',
          }}>IA</span>
        )}
      </button>

      {/* ── Janela do chat ── */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '8.5rem',
          right: '1.25rem',
          width: 'min(380px, calc(100vw - 2.5rem))',
          height: 'min(520px, calc(100vh - 12rem))',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 8px 40px rgba(110,53,72,0.18), 0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 199,
          border: `1px solid rgba(110,53,72,0.12)`,
          animation: 'dooSlideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${VINHO}, #9B4468)`,
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            flexShrink: 0,
          }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: VINHO, border: '2px solid white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              <img src="/doo.png" alt="Doo" style={{ width: '34px', height: '34px', objectFit: 'cover', borderRadius: '50%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'white', fontFamily: 'Geist, sans-serif' }}>Doo ✨</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.75)', fontFamily: 'Geist, sans-serif' }}>Assistente do Doonly</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: 'white', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >✕</button>
          </div>

          {/* Mensagens */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            background: '#fafafa',
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-end',
                gap: '0.5rem',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    border: `2px solid ${VINHO}`, overflow: 'hidden', flexShrink: 0,
                  }}>
                    <img src="/doo.png" alt="Doo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{
                  maxWidth: '78%',
                  background: msg.role === 'user' ? VINHO : 'white',
                  color: msg.role === 'user' ? 'white' : '#1F2937',
                  padding: '0.6rem 0.85rem',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  fontSize: '0.83rem',
                  lineHeight: 1.5,
                  fontFamily: 'Geist, sans-serif',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  border: msg.role === 'assistant' ? '1px solid #f0f0f0' : 'none',
                }}>
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Imagem gerada"
                      style={{ width: '100%', borderRadius: '10px', marginBottom: '0.5rem', display: 'block' }}
                    />
                  )}
                  <span dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', border: `2px solid ${VINHO}`, overflow: 'hidden', flexShrink: 0 }}>
                  <img src="/doo.png" alt="Doo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{
                  background: 'white', padding: '0.65rem 1rem', borderRadius: '16px 16px 16px 4px',
                  border: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  display: 'flex', gap: '4px', alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: VINHO, opacity: 0.6,
                      animation: `dooTyping 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '0.75rem',
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            gap: '0.5rem',
            background: 'white',
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte para a Doo..."
              disabled={loading}
              style={{
                flex: 1,
                border: `1.5px solid ${input ? VINHO : '#E9E9EE'}`,
                borderRadius: '12px',
                padding: '0.6rem 0.85rem',
                fontSize: '0.83rem',
                fontFamily: 'Geist, sans-serif',
                outline: 'none',
                color: '#1F2937',
                background: '#fafafa',
                transition: 'border-color 0.15s',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                width: '38px', height: '38px',
                borderRadius: '12px',
                background: input.trim() ? `linear-gradient(135deg, ${VINHO}, #9B4468)` : '#E9E9EE',
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dooPulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes dooSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dooTyping {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
