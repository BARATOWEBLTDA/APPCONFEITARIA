import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";

/**
 * "Complete seu cadastro" (aprovado 02/10) — aparece logo depois do PRIMEIRO login com o Google.
 * O Google só manda nome, e-mail e foto; aqui ela confirma o nome e informa o nome da confeitaria
 * e o WhatsApp (os mesmos campos do cadastro normal). Os 3 são obrigatórios.
 */
const maskTel = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
};

export default function CompletarCadastro({ user, nomeInicial, onPronto }: { user: any; nomeInicial: string; onPronto: () => void }) {
  const meta = user?.user_metadata || {};
  const foto: string = meta.avatar_url || meta.picture || "";
  const [nome, setNome] = useState(nomeInicial || meta.full_name || meta.name || "");
  const [loja, setLoja] = useState("");
  const [tel, setTel] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const digitos = tel.replace(/\D/g, "");
  const pronto = nome.trim().length >= 2 && loja.trim().length >= 2 && digitos.length >= 10;
  const primeiroNome = nome.trim().split(" ")[0];

  const salvar = async () => {
    if (!pronto || salvando) return;
    setSalvando(true); setErro("");
    const dados: Record<string, unknown> = { id: user.id, nome: nome.trim(), nome_loja: loja.trim(), telefone: tel };
    const { data: atual } = await supabase.from("profiles").select("foto_url").eq("id", user.id).maybeSingle();
    if (foto && !(atual as any)?.foto_url) dados.foto_url = foto; // a foto do Google vira a foto de perfil
    const { error } = await supabase.from("profiles").upsert(dados, { onConflict: "id" });
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); setSalvando(false); return; }
    supabase.auth.updateUser({ data: { nome: nome.trim(), nome_loja: loja.trim(), telefone: tel } }).then(() => {}, () => {});
    await refreshProfile?.();
    onPronto();
  };

  return (
    <div className="ccad">
      <div className="ccad-in">
        <div className="ccad-top"><span className="ccad-ok">
          <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Conectado com o Google</span></div>
        <div className="ccad-av">{foto ? <img src={foto} alt="" referrerPolicy="no-referrer" /> : (primeiroNome || "D").charAt(0).toUpperCase()}</div>
        <h1>{primeiroNome ? `Falta pouquinho, ${primeiroNome}! 💗` : "Falta pouquinho! 💗"}</h1>
        <p className="ccad-sub">Conta pra gente o nome da sua confeitaria e o WhatsApp onde você quer receber os pedidos.</p>

        <label className="ccad-l" htmlFor="cc-nome">Seu nome</label>
        <div className="ccad-wrap"><input id="cc-nome" className="ccad-in-f" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" />
          {(meta.full_name || meta.name) && nome === (nomeInicial || meta.full_name || meta.name) && <small>do Google</small>}</div>

        <label className="ccad-l" htmlFor="cc-loja">Nome da sua confeitaria</label>
        <input id="cc-loja" className="ccad-in-f" value={loja} onChange={e => setLoja(e.target.value)} placeholder="Ex.: Doce Encanto" autoComplete="organization" />
        <p className="ccad-dica">É o nome que aparece no seu cardápio.</p>

        <label className="ccad-l" htmlFor="cc-tel">WhatsApp que recebe os pedidos</label>
        <div className="ccad-wrap ccad-wrap--tel"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="#16a34a" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.1.2.1.8-.1 1.4z" />
  </svg></span>
          <input id="cc-tel" className="ccad-in-f" value={tel} onChange={e => setTel(maskTel(e.target.value))} placeholder="(00) 9 0000-0000" inputMode="tel" autoComplete="tel" /></div>

        {erro && <p className="ccad-erro">{erro}</p>}
        <button type="button" className="ccad-cta" disabled={!pronto || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Entrar no Doonly"}</button>
        {!pronto && <p className="ccad-dep">O botão libera quando os 3 campos estiverem preenchidos</p>}
      </div>
      <style>{`
        .ccad { position: fixed; inset: 0; z-index: 4000; overflow-y: auto; background: linear-gradient(180deg, #FCE7F3 0, #FAF7F8 240px); font-family: var(--font-base); color: #2C1219; }
        .ccad-in { max-width: 420px; margin: 0 auto; padding: calc(40px + env(safe-area-inset-top, 0px)) 20px calc(28px + env(safe-area-inset-bottom, 0px)); }
        .ccad-top { text-align: center; }
        .ccad-ok { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: #15803D; background: #DCFCE7; padding: 5px 10px; border-radius: 999px; }
        .ccad-av { width: 78px; height: 78px; border-radius: 50%; margin: 18px auto 0; overflow: hidden; display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, #F9A8D4, #E85A8C); color: #fff; font-weight: 900; font-size: 30px; border: 4px solid #fff; box-shadow: 0 8px 22px rgba(232,90,140,.3); }
        .ccad-av img { width: 100%; height: 100%; object-fit: cover; }
        .ccad h1 { text-align: center; font-size: 22px; font-weight: 900; margin: 14px 0 0; letter-spacing: -.02em; }
        .ccad-sub { text-align: center; font-size: 13.5px; color: #6B5D64; margin: 6px auto 4px; line-height: 1.45; max-width: 320px; }
        .ccad-l { display: block; font-size: 13px; font-weight: 600; color: #4B3A42; margin: 16px 0 6px; }
        .ccad-in-f { width: 100%; box-sizing: border-box; min-height: 46px; border: 1.5px solid #EDE6E9; border-radius: 12px; padding: 12px 14px; font-family: inherit; font-size: 16px; background: #fff; color: #2C1219; }
        .ccad-in-f:focus { outline: none; border-color: #E85A8C; box-shadow: 0 0 0 3px rgba(232,90,140,.12); }
        .ccad-wrap { position: relative; }
        .ccad-wrap small { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 700; color: #9A8E94; pointer-events: none; }
        .ccad-wrap--tel span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); display: flex; } /* ícone do WhatsApp (o mesmo dos Dados da loja) */
        .ccad-wrap--tel .ccad-in-f { padding-left: 42px; }
        .ccad-dica { font-size: 11.5px; color: #9A8E94; margin: 5px 0 0; }
        .ccad-erro { margin: 14px 0 0; font-size: 13px; color: #B91C1C; font-weight: 700; }
        .ccad-cta { display: block; width: 100%; margin-top: 22px; border: none; border-radius: 12px; padding: 15px; font-family: inherit; font-size: 15.5px; font-weight: 800; color: #fff; background: #E85A8C; box-shadow: 0 3px 0 #C33A6E; cursor: pointer; }
        .ccad-cta:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
        .ccad-dep { text-align: center; margin: 12px 0 0; font-size: 12.5px; color: #9A8E94; }
      `}</style>
    </div>
  );
}
