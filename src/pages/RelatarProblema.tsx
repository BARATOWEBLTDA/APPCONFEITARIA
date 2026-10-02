import { VERSAO_APP } from "@/lib/versao";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

/** "Relatar um problema" — tela simples, no estilo do "Enviar sugestão" (30/09) */
const PARTES = ["Pedidos", "Cardápio", "Produtos", "Ficha técnica", "Clientes", "Financeiro", "Agenda", "Outro"];

export default function RelatarProblema() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [texto, setTexto] = useState("");
  const [parte, setParte] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pode = texto.trim().length >= 5 && !enviando;
  const primeiroNome = String((profile as any)?.nome || "").trim().split(" ")[0];

  const enviar = async () => {
    if (!pode) return;
    setEnviando(true); setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sugestoes").insert({
        user_id: user?.id || null,
        nome: (profile as any)?.nome || null,
        telefone: (profile as any)?.telefone || null,
        email: (profile as any)?.email || user?.email || null,
        tipo: "problema",
        titulo: `Problema${parte ? ` em ${parte}` : ""}`,
        descricao: texto.trim(),
        area: parte,
        status: "recebida",
        tela_origem: document.referrer ? new URL(document.referrer).pathname : window.location.pathname,
        versao_app: VERSAO_APP,
      });
      if (error) throw error;
      setOk(true);
    } catch (e: any) {
      setErro("Não deu pra enviar agora. Confira a internet e tente de novo.");
      console.error(e);
    } finally { setEnviando(false); }
  };

  return (
    <div className="rp-root">
      <AppPageHeader title="Relatar um problema" subtitle="Conta pra gente o que não funcionou" onBack={() => navigate(-1)} />
      <div className="rp-wrap">
        {ok ? (
          <div className="rp-card rp-ok">
            <div className="rp-ok-ic" aria-hidden="true">✓</div>
            <h2>{primeiroNome ? `Obrigado, ${primeiroNome}! 💗` : "Obrigado! 💗"}</h2>
            <p>Recebemos seu relato. A equipe Doonly já vai analisar e corrigir o mais rápido possível, e a gente te avisa assim que estiver resolvido.</p>
            <button type="button" className="rp-bt" onClick={() => navigate(-1)}>Voltar</button>
            <button type="button" className="rp-bt2" onClick={() => { setOk(false); setTexto(""); setParte(null); }}>Relatar outro problema</button>
          </div>
        ) : (
          <div className="rp-card">
            <label className="rp-lb" htmlFor="rp-txt">O que aconteceu?</label>
            <textarea id="rp-txt" className="rp-ta" maxLength={800} value={texto} onChange={e => setTexto(e.target.value)}
              placeholder="Ex: cliquei em Salvar no produto e apareceu uma mensagem de erro…" />
            <p className="rp-cont">{texto.length}/800</p>
            <p className="rp-lb">Em que parte do app? <span>opcional</span></p>
            <div className="rp-chips">
              {PARTES.map(p => <button type="button" key={p} className={`rp-chip${parte === p ? " on" : ""}`} onClick={() => setParte(parte === p ? null : p)}>{p}</button>)}
            </div>
            {erro && <p className="rp-erro">{erro}</p>}
            <button type="button" className="rp-bt" disabled={!pode} onClick={enviar}>{enviando ? "Enviando…" : "Enviar"}</button>
            <p className="rp-dica">Quanto mais detalhes (o que você clicou, o que esperava acontecer), mais rápido a gente resolve.</p>
          </div>
        )}
      </div>
      <style>{`
        .rp-root { font-family: var(--font-base); color: #2C1219; min-height: 100%; }
        .rp-wrap { max-width: 640px; margin: 0 auto; padding: 16px 16px 40px; }
        .rp-card { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 18px; }
        .rp-lb { display: block; font-size: 14px; font-weight: 700; margin: 0 0 8px; } .rp-lb span { font-size: 11px; font-weight: 600; color: #9A8E94; background: #F5F0F2; padding: 2px 7px; border-radius: 999px; margin-left: 4px; }
        .rp-ta { width: 100%; min-height: 130px; border: 1.5px solid #EAE3E6; border-radius: 10px; padding: 12px; font-family: inherit; font-size: 15px; color: #2C1219; resize: vertical; }
        .rp-ta:focus { outline: none; border-color: #2C1219; } .rp-ta::placeholder { color: #B5AAB0; }
        .rp-cont { text-align: right; font-size: 11.5px; color: #B5AAB0; margin: 4px 0 14px; }
        .rp-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 18px; }
        .rp-chip { border: 1.5px solid #EAE3E6; background: #fff; border-radius: 999px; padding: 7px 13px; font-family: inherit; font-size: 13px; font-weight: 600; color: #4B3A42; cursor: pointer; }
        .rp-chip.on { background: #2C1219; border-color: #2C1219; color: #fff; }
        .rp-bt { width: 100%; height: 48px; border: none; border-radius: 10px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; }
        .rp-bt:disabled { background: #F6D4E1; box-shadow: 0 3px 0 #EBC3D3; cursor: default; }
        .rp-bt2 { width: 100%; margin-top: 8px; border: none; background: none; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #6B5D64; padding: 10px; cursor: pointer; }
        .rp-dica { font-size: 12.5px; color: #9A8E94; margin: 12px 0 0; line-height: 1.45; text-align: center; }
        .rp-erro { font-size: 13px; color: #B91C1C; font-weight: 600; margin: 0 0 12px; }
        .rp-ok { text-align: center; padding: 28px 20px; }
        .rp-ok-ic { width: 64px; height: 64px; border-radius: 50%; background: #DCFCE7; color: #15803D; font-size: 30px; font-weight: 900; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; box-shadow: 0 0 0 8px #F0FDF4; }
        .rp-ok h2 { font-size: 20px; font-weight: 900; margin: 0 0 6px; } .rp-ok p { font-size: 14px; color: #6B5D64; line-height: 1.5; margin: 0 0 18px; }
      `}</style>
    </div>
  );
}
