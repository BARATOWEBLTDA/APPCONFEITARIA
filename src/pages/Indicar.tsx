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
  { meta: 3, emoji: "👑", titulo: "1 mês grátis no Doonly", desc: "Uma mensalidade completa por sua conta" },
  { meta: 10, emoji: "🎁", titulo: "3 meses grátis + mimo Doonly", desc: "Caneca, ecobag ou item personalizado" },
  { meta: 25, emoji: "👕", titulo: "Kit Exclusivo + 6 meses grátis", desc: "Avental + faixa + Confeiteira Destaque" },
  { meta: 50, emoji: "🎂", titulo: "Batedeira Planetária + 1 ano grátis", desc: "O grande prêmio Doonly" },
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
      {/* ── HERO — Banner 100% largura, colado no topo ── */}
      <div className="ind-banner-wrap">
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

      {/* ── CONTADOR DESTAQUE ─────────────────────────── */}
      <div className="ind-contador">
        <div className="ind-contador-label">Você já tem</div>
        <div className="ind-contador-num">{conversoes}</div>
        <div className="ind-contador-desc">
          {conversoes === 0 && "assinantes. Comece a compartilhar e ganhe prêmios!"}
          {conversoes > 0 && proximoIdx !== -1 && `assinantes. Faltam ${PREMIOS[proximoIdx].meta - conversoes} para o próximo prêmio!`}
          {conversoes > 0 && proximoIdx === -1 && "assinantes. Você conquistou todos os prêmios! 🎉"}
        </div>
      </div>

      {/* ── ROADMAP DE PRÊMIOS ────────────────────────── */}
      <div className="ind-card">
        <div className="ind-hdr">Seus prêmios</div>

        <div className="ind-roadmap">
          {PREMIOS.map((p, idx) => {
            const desbloqueado = conversoes >= p.meta;
            const eProximo = idx === proximoIdx;
            const isUltimo = idx === PREMIOS.length - 1;

            return (
              <div key={p.meta} className="ind-premio">
                <div className="ind-premio-side">
                  <div className={`ind-premio-badge ${desbloqueado ? "ind-premio-badge--won" : eProximo ? "ind-premio-badge--next" : "ind-premio-badge--lock"}`}>
                    {desbloqueado ? <Trophy size={20} weight="fill" /> : <span>{p.emoji}</span>}
                  </div>
                  {!isUltimo && <div className={`ind-premio-line ${desbloqueado ? "ind-premio-line--won" : ""}`} />}
                </div>

                <div className={`ind-premio-card ${eProximo ? "ind-premio-card--next" : ""} ${desbloqueado ? "ind-premio-card--won" : ""}`}>
                  <div className="ind-premio-top">
                    <div>
                      <div className="ind-premio-title">{p.titulo}</div>
                      <div className="ind-premio-desc">{p.desc}</div>
                    </div>
                    {eProximo && <span className="ind-premio-tag ind-premio-tag--next">PRÓXIMO</span>}
                    {desbloqueado && <span className="ind-premio-tag ind-premio-tag--won">CONQUISTADO</span>}
                  </div>

                  {eProximo && (
                    <div className="ind-premio-prog">
                      <div className="ind-premio-prog-labels">
                        <span>Progresso</span>
                        <span className="ind-premio-prog-num">{conversoes} / {p.meta}</span>
                      </div>
                      <div className="ind-premio-prog-bar">
                        <div className="ind-premio-prog-fill" style={{ width: `${Math.min(100, (conversoes / p.meta) * 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {!eProximo && !desbloqueado && (
                    <div className="ind-premio-faltam">
                      <Lock size={11} weight="bold" /> Faltam <b>{p.meta - conversoes}</b> assinantes PRO
                    </div>
                  )}

                  {desbloqueado && (
                    <a href="https://wa.me/554199999999?text=Oi! Quero resgatar meu pr%C3%AAmio de indica%C3%A7%C3%A3o do Doonly." target="_blank" rel="noopener" className="ind-premio-resgatar">
                      <WhatsappLogo size={14} weight="fill" />
                      Resgatar pelo WhatsApp
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── AMIGAS QUE ENTRARAM ───────────────────────── */}
      {amigas.length > 0 && (
        <div className="ind-card">
          <div className="ind-hdr">Quem entrou pelo seu link <span className="ind-hdr-count">({amigas.length})</span></div>
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
        </div>
      )}

      {/* ── COMO FUNCIONA ─────────────────────────────── */}
      <div className="ind-card">
        <div className="ind-hdr">Como funciona</div>
        <div className="ind-passos">
          <div className="ind-passo">
            <div className="ind-passo-num">1</div>
            <div className="ind-passo-txt">Compartilhe seu link com uma pessoa que tem confeitaria</div>
          </div>
          <div className="ind-passo">
            <div className="ind-passo-num">2</div>
            <div className="ind-passo-txt">Ela se cadastra pelo seu link e ganha 50% OFF no 1º mês PRO</div>
          </div>
          <div className="ind-passo">
            <div className="ind-passo-num">3</div>
            <div className="ind-passo-txt">Quando ela ativar o PRO, você ganha 1 conversão. A cada meta, um prêmio!</div>
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

        /* Banner — colado no topo (respeitando safe-area do notch/status bar) e nas laterais, sem cantos arredondados */
        .ind-banner-wrap {
          margin: calc(-1 * (12px + var(--pad-page-top, 1rem))) -12px 12px;
          overflow: hidden;
          line-height: 0;
        }
        .ind-banner-img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: cover;
          border-radius: 0;
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

        /* Roadmap */
        .ind-roadmap { display: flex; flex-direction: column; }
        .ind-premio { display: flex; gap: 14px; }
        .ind-premio-side { position: relative; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }
        .ind-premio-badge {
          width: 44px; height: 44px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .ind-premio-badge--lock { background: #F5F3EF; border: 3px solid #D3D1C7; filter: grayscale(0.5); opacity: 0.7; }
        .ind-premio-badge--next { background: #FCE0E9; border: 3px solid #E85A8C; }
        .ind-premio-badge--won { background: #DCFCE7; border: 3px solid #166534; color: #166534; }
        .ind-premio-line {
          flex: 1;
          width: 3px;
          min-height: 40px;
          background: #F0EBED;
          margin: 4px 0;
        }
        .ind-premio-line--won { background: linear-gradient(180deg, #166534 0%, #F0EBED 100%); }

        .ind-premio-card {
          flex: 1;
          padding: 12px 14px;
          background: #FAF8F5;
          border: 1.5px solid #F0EBED;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .ind-premio-card--next { background: #FEF3F7; border: 2px solid #E85A8C; }
        .ind-premio-card--won { background: #F0FDF4; border: 2px solid #166534; }
        .ind-premio-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .ind-premio-title { font-size: 14px; font-weight: 800; color: #2C2C2A; letter-spacing: -0.01em; line-height: 1.2; }
        .ind-premio-card--next .ind-premio-title,
        .ind-premio-card--won .ind-premio-title { color: #2C2C2A; }
        .ind-premio-card:not(.ind-premio-card--next):not(.ind-premio-card--won) .ind-premio-title { color: #5F5E5A; }
        .ind-premio-desc { font-size: 11.5px; color: #888780; margin-top: 2px; line-height: 1.35; }
        .ind-premio-tag { font-size: 9.5px; font-weight: 800; padding: 3px 7px; border-radius: 999px; letter-spacing: 0.03em; white-space: nowrap; flex-shrink: 0; }
        .ind-premio-tag--next { background: #E85A8C; color: #fff; }
        .ind-premio-tag--won { background: #166534; color: #fff; }
        .ind-premio-prog { margin-top: 10px; }
        .ind-premio-prog-labels { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10.5px; font-weight: 600; color: #888780; }
        .ind-premio-prog-num { color: #993556; font-weight: 800; }
        .ind-premio-prog-bar { height: 6px; background: #F0EBED; border-radius: 999px; overflow: hidden; }
        .ind-premio-prog-fill { height: 100%; background: linear-gradient(90deg, #E85A8C 0%, #C33A6E 100%); border-radius: 999px; transition: width 0.4s ease; }
        .ind-premio-faltam { margin-top: 8px; display: flex; align-items: center; gap: 4px; font-size: 11px; color: #888780; font-weight: 600; }
        .ind-premio-faltam b { color: #5F5E5A; }
        .ind-premio-resgatar {
          margin-top: 10px;
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px;
          background: #166534;
          color: #fff;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .ind-premio-resgatar:hover { background: #14532D; }

        /* Amigas */
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
