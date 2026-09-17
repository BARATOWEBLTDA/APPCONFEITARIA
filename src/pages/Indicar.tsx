/**
 * Indicar — Página de indicação/afiliação.
 *
 * Estrutura:
 *  1. Hero (placeholder até ter banner)
 *  2. Card "Seu link único" + botões de compartilhar
 *  3. Card contador de conversões (destaque)
 *  4. Roadmap dos 4 prêmios (3/10/25/50)
 *  5. Lista de amigas que entraram
 *  6. Como funciona (3 passos)
 *
 * Padrão visual: rosa Doonly, fonte Geist, botões 3D.
 */

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShareNetwork, Copy, WhatsappLogo, Check, Trophy, Lock } from "@phosphor-icons/react";

interface Amiga {
  id: string;
  nome: string | null;
  status: "cadastrou" | "pro" | "premio_resgatado";
  virou_pro_em: string | null;
  created_at: string;
}

const PREMIOS = [
  { meta: 3, emoji: "👑", imagem: "/Sistema/brinde1.png", titulo: "1 mês grátis no Doonly", desc: "Uma mensalidade completa por sua conta" },
  { meta: 10, emoji: "🎁", imagem: "/Sistema/brinde2.png", titulo: "3 meses grátis + camiseta", desc: "Camiseta personalizada com a marca da sua confeitaria" },
  { meta: 25, emoji: "👕", imagem: "/Sistema/brinde3.png", titulo: "Kit Exclusivo + 6 meses grátis", desc: "Avental + faixa + Confeiteira Destaque" },
  { meta: 50, emoji: "🎂", imagem: "/Sistema/brinde4.png", titulo: "Batedeira Planetária + 1 ano grátis", desc: "O grande prêmio Doonly" },
];

export default function Indicar() {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [conversoes, setConversoes] = useState(0);
  const [amigas, setAmigas] = useState<Amiga[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes?.user?.id) return;
      const userId = userRes.user.id;

      // Meu profile
      const { data: prof } = await supabase.from("profiles")
        .select("nome, codigo_indicacao").eq("id", userId).single();
      if (prof) {
        setNome(prof.nome || "");
        setCodigo(prof.codigo_indicacao || "");
      }

      // Minhas indicações + join com profiles das amigas
      const { data: ind } = await supabase.from("indicacoes")
        .select("id, indicada_id, status, virou_pro_em, created_at")
        .eq("indicador_id", userId)
        .order("created_at", { ascending: false });

      if (ind && ind.length) {
        const ids = ind.map(i => i.indicada_id);
        const { data: perfis } = await supabase.from("profiles")
          .select("id, nome").in("id", ids);
        const mapa = new Map((perfis || []).map(p => [p.id, p.nome]));
        setAmigas(ind.map((i: any) => ({
          id: i.indicada_id,
          nome: mapa.get(i.indicada_id) || null,
          status: i.status,
          virou_pro_em: i.virou_pro_em,
          created_at: i.created_at,
        })));
        setConversoes(ind.filter((i: any) => i.status === "pro" || i.status === "premio_resgatado").length);
      }

      setLoading(false);
    };
    load();
  }, []);

  const link = codigo ? `https://doonly.com.br/?ref=${codigo}` : "https://doonly.com.br";
  const mensagemWpp = encodeURIComponent(
    `Oi! Tô usando o Doonly pra organizar minha confeitaria — recomendo demais! 💖\n\n` +
    `Se você entrar pelo meu link ganha:\n` +
    `🎁 Kit grátis de precificação\n` +
    `💰 50% OFF no 1º mês PRO\n\n` +
    link
  );

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      alert("Não foi possível copiar. Copie manualmente: " + link);
    }
  };

  const abrirWhatsApp = () => {
    window.open(`https://wa.me/?text=${mensagemWpp}`, "_blank");
  };

  const compartilharNativo = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Doonly - Gestão pra confeiteiras",
          text: `Tô usando o Doonly! Entra pelo meu link e ganha 50% OFF no 1º mês PRO`,
          url: link,
        });
      } catch {}
    } else {
      abrirWhatsApp();
    }
  };

  // Próximo prêmio (o primeiro com meta > conversoes)
  const proximoIdx = PREMIOS.findIndex(p => p.meta > conversoes);

  return (
    <div className="ind-root">
      {/* ── HERO — Banner dentro de card ─────────────── */}
      <div className="ind-banner-card">
        <img
          src="/Sistema/bannerindica.png"
          alt="Convide para o Doonly e ganhe prêmios exclusivos"
          className="ind-banner-img"
        />
      </div>

      {/* ── SEU LINK ────────────────────────────────── */}
      <div className="ind-card">
        <div className="ind-hdr">Seu link único</div>

        {loading ? (
          <div className="ind-skeleton" />
        ) : (
          <>
            <div className="ind-link-row">
              <div className="ind-link-input">
                doonly.com.br/?ref=<b>{codigo || "..."}</b>
              </div>
              <button className="ind-copy-btn" onClick={copiarLink}>
                {copiado ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
                {copiado ? "Copiado!" : "Copiar"}
              </button>
            </div>

            <button className="ind-wpp-btn" onClick={abrirWhatsApp}>
              <WhatsappLogo size={18} weight="fill" />
              Compartilhar no WhatsApp
            </button>

            <button className="ind-share-btn" onClick={compartilharNativo}>
              <ShareNetwork size={16} weight="bold" />
              Mais opções de compartilhamento
            </button>
          </>
        )}
      </div>

      {/* ── CONTADOR DESTAQUE (dinâmico) ────────────── */}
      {conversoes === 0 ? (
        <div className="ind-contador ind-contador--zero">
          <div className="ind-contador-emoji">🎁</div>
          <div className="ind-contador-title-zero">Comece agora sua jornada!</div>
          <div className="ind-contador-desc-zero">
            Compartilhe seu link e ganhe seu 1º prêmio:<br/>
            <b>1 mês PRO grátis</b> com apenas 3 assinantes.
          </div>
        </div>
      ) : (
        <div className="ind-contador">
          <div className="ind-contador-label">Você já tem</div>
          <div className="ind-contador-num">{conversoes}</div>
          <div className="ind-contador-desc">
            {proximoIdx !== -1
              ? `assinantes. Faltam ${PREMIOS[proximoIdx].meta - conversoes} para o próximo prêmio!`
              : "assinantes. Você conquistou todos os prêmios! 🎉"}
          </div>
        </div>
      )}

      {/* ── ROADMAP DE PRÊMIOS (cards grandes com foto) ── */}
      <div className="ind-premios-hdr">Seus prêmios</div>
      <div className="ind-premios">
        {PREMIOS.map((p, idx) => {
          const desbloqueado = conversoes >= p.meta;
          const eProximo = idx === proximoIdx;

          return (
            <div key={p.meta} className={`ind-pcard ${eProximo ? "ind-pcard--next" : ""} ${desbloqueado ? "ind-pcard--won" : ""} ${!eProximo && !desbloqueado ? "ind-pcard--lock" : ""}`}>
              {/* Foto do prêmio (topo do card) */}
              <div className="ind-pcard-foto">
                {p.imagem
                  ? <img src={p.imagem} alt={p.titulo} />
                  : <span className="ind-pcard-emoji">{p.emoji}</span>}

                {/* Tags flutuantes sobre a foto */}
                {eProximo && <span className="ind-pcard-flag ind-pcard-flag--next">PRÓXIMO</span>}
                {desbloqueado && <span className="ind-pcard-flag ind-pcard-flag--won"><Trophy size={11} weight="fill" /> CONQUISTADO</span>}
                <span className={`ind-pcard-meta ${eProximo ? "ind-pcard-meta--next" : desbloqueado ? "ind-pcard-meta--won" : ""}`}>
                  {p.meta} {p.meta === 1 ? "assinante" : "assinantes"}
                </span>
              </div>

              {/* Info embaixo */}
              <div className="ind-pcard-body">
                <div className="ind-pcard-title">{p.titulo}</div>
                <div className="ind-pcard-desc">{p.desc}</div>

                {eProximo && (
                  <div className="ind-pcard-prog">
                    <div className="ind-pcard-prog-labels">
                      <span>{conversoes} / {p.meta}</span>
                      <span className="ind-pcard-prog-faltam">Faltam {p.meta - conversoes}</span>
                    </div>
                    <div className="ind-pcard-prog-bar">
                      <div className="ind-pcard-prog-fill" style={{ width: `${Math.min(100, (conversoes / p.meta) * 100)}%` }} />
                    </div>
                  </div>
                )}

                {!eProximo && !desbloqueado && (
                  <div className="ind-pcard-faltam">
                    <Lock size={11} weight="bold" /> Faltam <b>{p.meta - conversoes}</b> assinantes PRO
                  </div>
                )}

                {desbloqueado && (
                  <a href="https://wa.me/554199999999?text=Oi! Quero resgatar meu pr%C3%AAmio de indica%C3%A7%C3%A3o do Doonly." target="_blank" rel="noopener" className="ind-pcard-resgatar">
                    <WhatsappLogo size={14} weight="fill" />
                    Resgatar pelo WhatsApp
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── QUEM ENTROU PELO SEU LINK (sempre visível) ── */}
      <div className="ind-card">
        <div className="ind-hdr">
          Quem entrou pelo seu link
          {amigas.length > 0 && <span className="ind-hdr-count">({amigas.length})</span>}
        </div>

        {amigas.length === 0 ? (
          <div className="ind-empty">
            <div className="ind-empty-emoji">👥</div>
            <div className="ind-empty-title">Ninguém ainda</div>
            <div className="ind-empty-desc">Compartilhe seu link e acompanhe por aqui quem entra no Doonly através dele.</div>
          </div>
        ) : (
          <div className="ind-amigas">
            {amigas.map(a => {
              const isPro = a.status === "pro" || a.status === "premio_resgatado";
              const dias = Math.floor((Date.now() - new Date(a.created_at).getTime()) / 86400000);
              const tempoTxt = dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
              return (
                <div key={a.id} className="ind-amiga">
                  <div className="ind-amiga-avatar">{(a.nome || "?").trim().charAt(0).toUpperCase()}</div>
                  <div className="ind-amiga-info">
                    <div className="ind-amiga-nome">{a.nome || "Colega"}</div>
                    <div className="ind-amiga-tempo">{tempoTxt}</div>
                  </div>
                  {isPro
                    ? <span className="ind-amiga-badge ind-amiga-badge--pro">👑 PRO</span>
                    : <span className="ind-amiga-badge ind-amiga-badge--trial">TRIAL</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── COMO FUNCIONA ─────────────────────────────── */}
      <div className="ind-card">
        <div className="ind-hdr">Como funciona</div>
        <div className="ind-passos">
          <div className="ind-passo">
            <div className="ind-passo-num">1</div>
            <div className="ind-passo-txt">Compartilhe seu link com quem trabalha com confeitaria.</div>
          </div>
          <div className="ind-passo">
            <div className="ind-passo-num">2</div>
            <div className="ind-passo-txt">Quem se cadastrar pelo seu link ganha 50% OFF no 1º mês PRO.</div>
          </div>
          <div className="ind-passo">
            <div className="ind-passo-num">3</div>
            <div className="ind-passo-txt">Assim que a pessoa assinar o PRO, você soma 1 indicação válida. Alcance as metas e desbloqueie seus prêmios!</div>
          </div>
        </div>
      </div>

      <style>{`
        .ind-root {
          font-family: var(--font-base) !important;
          background: #F5F3EF;
          min-height: 100vh;
          padding: 12px;
          box-sizing: border-box;
          padding-top: calc(12px + env(safe-area-inset-top, 0px));
          padding-bottom: calc(12px + 6.5rem);
          margin: calc(-1 * var(--space-2, 8px));
          margin-top: calc(-1 * (var(--pad-page-top, 1rem) + env(safe-area-inset-top, 0px)));
          margin-bottom: -6.5rem;
        }
        .ind-root * { font-family: var(--font-base) !important; }

        /* Banner — dentro de card com bordas arredondadas */
        .ind-banner-card {
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 12px;
          line-height: 0;
          background: #fff;
          border: 1px solid #F0EBED;
        }
        .ind-banner-img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: cover;
        }

        /* Card genérico */
        .ind-card {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 12px;
        }
        .ind-hdr {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #888780;
          text-transform: uppercase;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .ind-hdr-count { font-weight: 700; color: #B4B2A9; letter-spacing: 0; font-size: 11px; text-transform: none; }
        .ind-skeleton { height: 40px; background: #F0EBED; border-radius: 10px; animation: indShine 1.4s ease infinite; }
        @keyframes indShine { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.4; } }

        /* Link */
        .ind-link-row { display: flex; gap: 6px; margin-bottom: 10px; }
        .ind-link-input {
          flex: 1;
          padding: 10px 12px;
          background: #FAF8F5;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 12px;
          color: #5F5E5A;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: monospace !important;
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          -webkit-touch-callout: none;
          pointer-events: none;
        }
        .ind-link-input b { color: #993556; }
        .ind-copy-btn {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; gap: 4px;
          padding: 10px 14px;
          background: #FCE0E9;
          color: #993556;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease;
        }
        .ind-copy-btn:hover { background: #F4C0D1; }

        .ind-wpp-btn {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%;
          padding: 13px;
          background: #25D366;
          color: #fff;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          margin-bottom: 8px;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.28), inset 0 -2px 0 rgba(0,0,0,0.08);
          transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        .ind-wpp-btn:hover { background: #1FBB58; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37, 211, 102, 0.35); }
        .ind-wpp-btn:active { transform: translateY(1px); box-shadow: 0 2px 6px rgba(37, 211, 102, 0.25); }

        .ind-share-btn {
          all: unset;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          padding: 11px;
          background: transparent;
          color: #5F5E5A;
          border: 1.5px solid #E8E5DC;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .ind-share-btn:hover { background: #FAF8F5; }

        /* Contador destaque */
        .ind-contador {
          background: linear-gradient(135deg, #FCE0E9 0%, #F4C0D1 100%);
          border-radius: 14px;
          padding: 18px;
          text-align: center;
          margin-bottom: 12px;
        }
        .ind-contador-label {
          font-size: 11px;
          font-weight: 700;
          color: #993556;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .ind-contador-num {
          font-size: 48px;
          font-weight: 900;
          color: #993556;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin: 2px 0;
        }
        .ind-contador-desc {
          font-size: 13px;
          font-weight: 600;
          color: #993556;
          line-height: 1.4;
        }

        /* Estado zero — motivacional, sem número gigante */
        .ind-contador--zero {
          padding: 22px 20px;
        }
        .ind-contador-emoji {
          font-size: 44px;
          line-height: 1;
          margin-bottom: 8px;
        }
        .ind-contador-title-zero {
          font-size: 19px;
          font-weight: 900;
          color: #993556;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .ind-contador-desc-zero {
          font-size: 13px;
          font-weight: 500;
          color: #993556;
          line-height: 1.5;
        }
        .ind-contador-desc-zero b {
          font-weight: 800;
        }

        /* Roadmap — Opção B (cards grandes com foto) */
        .ind-premios-hdr {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #888780;
          text-transform: uppercase;
          margin: 0 4px 10px;
        }
        .ind-premios { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }

        .ind-pcard {
          background: #fff;
          border: 1px solid #F0EBED;
          border-radius: 14px;
          overflow: hidden;
        }
        .ind-pcard--next { border: 2px solid #E85A8C; box-shadow: 0 4px 14px rgba(232, 90, 140, 0.12); }
        .ind-pcard--won { border: 2px solid #166534; }
        .ind-pcard--lock { opacity: 0.85; }

        /* Foto do prêmio (topo do card) */
        .ind-pcard-foto {
          position: relative;
          width: 100%;
          height: 160px;
          background: #FAF8F5;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .ind-pcard-foto img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .ind-pcard--lock .ind-pcard-foto img { filter: grayscale(0.3) opacity(0.8); }
        .ind-pcard-emoji { font-size: 72px; }

        /* Flags flutuantes sobre a foto */
        .ind-pcard-flag {
          position: absolute;
          top: 10px;
          left: 10px;
          font-size: 9.5px;
          font-weight: 800;
          padding: 4px 9px;
          border-radius: 999px;
          letter-spacing: 0.04em;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .ind-pcard-flag--next { background: #E85A8C; color: #fff; }
        .ind-pcard-flag--won { background: #166534; color: #fff; }

        .ind-pcard-meta {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          color: #5F5E5A;
          font-size: 10px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .ind-pcard-meta--next { color: #993556; }
        .ind-pcard-meta--won { color: #166534; }

        /* Body abaixo da foto */
        .ind-pcard-body { padding: 12px 16px 14px; }
        .ind-pcard-title {
          font-size: 15px;
          font-weight: 800;
          color: #2C2C2A;
          letter-spacing: -0.01em;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ind-pcard-desc {
          font-size: 11.5px;
          color: #888780;
          margin-top: 3px;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: calc(1.4em * 2);
        }

        /* Barra de progresso — só no PRÓXIMO */
        .ind-pcard-prog { margin-top: 10px; }
        .ind-pcard-prog-labels {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
          font-size: 11px;
          font-weight: 700;
          color: #888780;
        }
        .ind-pcard-prog-faltam { color: #993556; font-weight: 800; }
        .ind-pcard-prog-bar { height: 7px; background: #F0EBED; border-radius: 999px; overflow: hidden; }
        .ind-pcard-prog-fill { height: 100%; background: linear-gradient(90deg, #E85A8C 0%, #C33A6E 100%); border-radius: 999px; transition: width 0.4s ease; }

        /* Info faltam (bloqueado) */
        .ind-pcard-faltam {
          margin-top: 10px;
          display: flex; align-items: center; gap: 5px;
          font-size: 11px;
          color: #888780;
          font-weight: 600;
        }
        .ind-pcard-faltam b { color: #5F5E5A; }

        /* Resgatar (conquistado) */
        .ind-pcard-resgatar {
          margin-top: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 14px;
          background: #166534;
          color: #fff;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .ind-pcard-resgatar:hover { background: #14532D; }

        /* Amigas */
        .ind-empty {
          text-align: center;
          padding: 20px 12px 8px;
        }
        .ind-empty-emoji {
          font-size: 40px;
          margin-bottom: 8px;
          filter: grayscale(0.3);
          opacity: 0.85;
        }
        .ind-empty-title {
          font-size: 14px;
          font-weight: 800;
          color: #5F5E5A;
          margin-bottom: 4px;
        }
        .ind-empty-desc {
          font-size: 12px;
          color: #888780;
          line-height: 1.45;
          max-width: 260px;
          margin: 0 auto;
        }
        .ind-amigas { display: flex; flex-direction: column; gap: 8px; }
        .ind-amiga { display: flex; align-items: center; gap: 12px; padding: 4px 0; }
        .ind-amiga-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: #993556;
          color: #FCE0E9;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800;
          flex-shrink: 0;
        }
        .ind-amiga-info { flex: 1; min-width: 0; }
        .ind-amiga-nome { font-size: 13.5px; font-weight: 700; color: #2C2C2A; }
        .ind-amiga-tempo { font-size: 11.5px; color: #888780; }
        .ind-amiga-badge { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 999px; white-space: nowrap; }
        .ind-amiga-badge--pro { background: #DCFCE7; color: #166534; }
        .ind-amiga-badge--trial { background: #FEF0DF; color: #854F0B; }

        /* Passos */
        .ind-passos { display: flex; flex-direction: column; gap: 12px; }
        .ind-passo { display: flex; gap: 12px; align-items: flex-start; }
        .ind-passo-num {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #FCE0E9;
          color: #993556;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 900;
          flex-shrink: 0;
        }
        .ind-passo-txt { font-size: 12.5px; color: #5F5E5A; line-height: 1.5; }
      `}</style>
    </div>
  );
}
