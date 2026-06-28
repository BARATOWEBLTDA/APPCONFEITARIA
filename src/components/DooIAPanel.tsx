import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/hooks/useProfile";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 12;

const SUGGESTIONS = [
  "Criar receita de bolo",
  "Calcular preço de venda",
  "Legenda para Instagram",
];

const buildSystemPrompt = (nome: string) => `Você é Doo, a assistente inteligente oficial do Doonly.
Você é a consultora de confeitaria mais completa e experiente disponível. Sua missão é ajudar confeiteiras a ganhar mais dinheiro, economizar tempo, reduzir desperdícios, organizar seus negócios e tomar decisões mais inteligentes.
Nome: Doo | Cargo: Assistente Inteligente do Doonly
Personalidade: Amigável, inteligente, prestativa, organizada, criativa, profissional, motivadora e confiável.
Doo fala de forma simples, clara e acolhedora. Evite respostas robóticas. Seja objetiva sem perder simpatia. Não use emojis.
${nome ? `A confeiteira se chama ${nome}. Chame-a pelo nome quando fizer sentido.` : ""}`;

function formatText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>(\n)?)+/g, (m) => `<ul style="margin:4px 0 4px 1rem;padding:0;list-style:disc;">${m}</ul>`)
    .replace(/\n/g, "<br/>");
}

export default function DooIAPanel() {
  const { profile } = useProfile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const historyForApi = newMessages.slice(-MAX_HISTORY);

    try {
      const res = await fetch("/api/doo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildSystemPrompt(profile?.nome || ""),
          messages: historyForApi.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error("API error");
      const reply = data?.content?.[0]?.text || "Não consegui responder agora. Tenta de novo!";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Problema de conexão. Verifique sua internet e tente novamente." }]);
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="doo-panel">
      {/* Header */}
      <div className="doo-panel-header">
        <div className="doo-panel-avatar">
          <img src="/Sistema/doo.png" alt="Doo" />
        </div>
        <div>
          <p className="doo-panel-name">Doo IA</p>
          <p className="doo-panel-sub">Sua assistente de confeitaria</p>
        </div>
        {messages.length > 0 && (
          <button className="doo-panel-clear" onClick={() => setMessages([])} title="Nova conversa">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="doo-panel-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <>
            <div className="doo-panel-bubble doo-panel-bubble--ai">
              <div className="doo-panel-bubble-avatar">
                <img src="/Sistema/doo.png" alt="" />
              </div>
              <div className="doo-panel-bubble-content">
                Olá{profile?.nome ? `, ${profile.nome.split(" ")[0]}` : ""}! Sou a Doo, sua assistente de confeitaria. Como posso te ajudar?
              </div>
            </div>
            <div className="doo-panel-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="doo-panel-chip" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`doo-panel-bubble doo-panel-bubble--${m.role === "user" ? "user" : "ai"}`}>
            {m.role === "assistant" && (
              <div className="doo-panel-bubble-avatar"><img src="/Sistema/doo.png" alt="" /></div>
            )}
            <div
              className="doo-panel-bubble-content"
              dangerouslySetInnerHTML={m.role === "assistant" ? { __html: formatText(m.content) } : undefined}
            >
              {m.role === "user" ? m.content : undefined}
            </div>
          </div>
        ))}

        {loading && (
          <div className="doo-panel-bubble doo-panel-bubble--ai">
            <div className="doo-panel-bubble-avatar"><img src="/Sistema/doo.png" alt="" /></div>
            <div className="doo-panel-bubble-content doo-panel-typing">
              <span /><span /><span />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="doo-panel-input-wrap">
        <input
          className="doo-panel-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Pergunte para a Doo..."
          disabled={loading}
        />
        <button className="doo-panel-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
        </button>
      </div>

      <style>{`
        .doo-panel {
          display: flex;
          flex-direction: column;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          overflow: hidden;
          height: auto;
          max-height: calc(100vh - 3rem);
        }
        .doo-panel-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: linear-gradient(160deg, var(--primary-dark), #431524);
          flex-shrink: 0;
        }
        .doo-panel-avatar {
          width: 36px; height: 36px;
          border-radius: 35%;
          background: var(--primary-dark);
          border: 2px solid rgba(255,255,255,0.5);
          overflow: hidden;
          flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .doo-panel-avatar img {
          width: 44px; height: 44px;
          object-fit: cover; object-position: top center;
          border-radius: 35%;
        }
        .doo-panel-name {
          margin: 0;
          font-size: var(--font-body);
          font-weight: var(--fw-bold);
          color: var(--text-inverse);
        }
        .doo-panel-sub {
          margin: 0;
          font-size: var(--font-caption);
          color: rgba(255,255,255,0.55);
        }
        .doo-panel-clear {
          margin-left: auto;
          background: rgba(255,255,255,0.12);
          border: none;
          border-radius: var(--radius-sm);
          width: 28px; height: 28px;
          color: rgba(255,255,255,0.7);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background var(--dur-fast);
        }
        .doo-panel-clear:hover { background: rgba(255,255,255,0.2); }

        .doo-panel-messages {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-3);
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
          min-height: 440px;
        }

        .doo-panel-bubble {
          display: flex;
          gap: var(--space-2);
          align-items: flex-start;
        }
        .doo-panel-bubble--user {
          justify-content: flex-end;
        }
        .doo-panel-bubble-avatar {
          width: 26px; height: 26px;
          border-radius: var(--radius-md);
          overflow: hidden;
          flex-shrink: 0;
          background: var(--bg-subtle);
        }
        .doo-panel-bubble-avatar img {
          width: 32px; height: 32px;
          object-fit: cover; object-position: top center;
        }
        .doo-panel-bubble-content {
          font-size: var(--font-caption);
          line-height: 1.55;
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-lg);
          max-width: 88%;
          word-break: break-word;
        }
        .doo-panel-bubble--ai .doo-panel-bubble-content {
          background: var(--bg-body);
          color: var(--text-title);
          border-top-left-radius: var(--space-1);
        }
        .doo-panel-bubble--user .doo-panel-bubble-content {
          background: var(--primary-dark);
          color: var(--text-inverse);
          border-top-right-radius: var(--space-1);
        }

        .doo-panel-typing {
          display: flex; gap: 4px; padding: var(--space-3);
        }
        .doo-panel-typing span {
          width: 6px; height: 6px;
          border-radius: var(--radius-full);
          background: var(--text-muted);
          animation: dooTyping 1.2s infinite;
        }
        .doo-panel-typing span:nth-child(2) { animation-delay: 0.2s; }
        .doo-panel-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dooTyping {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }

        .doo-panel-suggestions {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding-left: 34px;
        }
        .doo-panel-chip {
          font-size: var(--font-caption);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--bg-card);
          color: var(--text-secondary);
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all var(--dur-fast);
          width: fit-content;
        }
        .doo-panel-chip:hover {
          border-color: var(--primary);
          color: var(--primary-dark);
          background: var(--bg-subtle);
        }

        .doo-panel-input-wrap {
          display: flex;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-top: 1px solid var(--border);
          flex-shrink: 0;
          align-items: center;
        }
        .doo-panel-input {
          flex: 1;
          font-size: var(--font-caption);
          padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-full);
          border: 1px solid var(--border);
          background: var(--bg-body);
          color: var(--text-title);
          font-family: inherit;
          outline: none;
          transition: border-color var(--dur-fast);
        }
        .doo-panel-input:focus { border-color: var(--primary); }
        .doo-panel-input::placeholder { color: var(--text-muted); }
        .doo-panel-send {
          width: 36px; height: 36px;
          border-radius: var(--radius-full);
          background: linear-gradient(160deg, var(--primary-dark), #431524);
          border: none;
          color: var(--text-inverse);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: opacity var(--dur-fast);
        }
        .doo-panel-send:disabled { opacity: 0.4; cursor: default; }
        .doo-panel-send:not(:disabled):hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
