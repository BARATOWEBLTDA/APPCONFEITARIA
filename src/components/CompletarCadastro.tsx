import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { refreshProfile } from "@/hooks/useProfile";
import { WhatsappLogo } from "@phosphor-icons/react";
import { Botao, Campo } from "@/components/base";

/**
 * "Complete seu cadastro" (aprovado 02/10) — aparece logo depois do PRIMEIRO login com o Google.
 * O Google só manda nome, e-mail e foto; aqui ela confirma o nome e informa o nome da confeitaria
 * e o WhatsApp (os mesmos campos do cadastro normal). Os 3 são obrigatórios.
 * 09/10 (3.57): no padrão do guia (Campo, Botao, cores --ui-*, sem degradê).
 */
const maskTel = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
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

  const doGoogle = !!(meta.full_name || meta.name) && nome === (nomeInicial || meta.full_name || meta.name);
  return (
    <div className="ccad">
      <div className="ccad-in">
        <div className="ccad-top"><span className="ccad-ok">
          <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          Conectado com o Google</span></div>
        <div className="ccad-av">{foto ? <img src={foto} alt="" referrerPolicy="no-referrer" /> : (primeiroNome || "D").charAt(0).toUpperCase()}</div>
        <h1>{primeiroNome ? `Falta pouquinho, ${primeiroNome}!` : "Falta pouquinho!"}</h1>
        <p className="ccad-sub">Conta pra gente o nome da sua confeitaria e o WhatsApp onde você quer receber os pedidos.</p>

        <div className="ccad-form">
          <Campo id="cc-nome" rotulo="Seu nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name"
            dica={doGoogle ? "Veio do Google. Pode trocar." : undefined} />
          <Campo id="cc-loja" rotulo="Nome da sua confeitaria" value={loja} onChange={e => setLoja(e.target.value)} placeholder="Ex.: Doce Encanto" autoComplete="organization"
            dica="É o nome que aparece no seu cardápio." />
          <Campo id="cc-tel" rotulo="WhatsApp que recebe os pedidos" value={tel} onChange={e => setTel(maskTel(e.target.value))} placeholder="(41) 99999-8888" inputMode="tel" autoComplete="tel"
            icone={<WhatsappLogo size={20} weight="fill" className="ccad-zap" />} />
        </div>

        {erro && <p className="ccad-erro" role="alert">{erro}</p>}
        <Botao cheio className="ccad-cta" disabled={!pronto} carregando={salvando} onClick={salvar}>Entrar no Doonly</Botao>
        {!pronto && <p className="ccad-dep">O botão libera quando os 3 campos estiverem preenchidos.</p>}
      </div>
      <style>{`
        .ccad { position: fixed; inset: 0; z-index: 4000; overflow-y: auto; background: var(--ui-fundo); font-family: var(--font-base); color: var(--ui-texto); }
        .ccad-in { max-width: 420px; margin: 0 auto; padding: calc(40px + env(safe-area-inset-top, 0px)) 20px calc(28px + env(safe-area-inset-bottom, 0px)); }
        .ccad-top { text-align: center; }
        .ccad-ok { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 99px; background: var(--ui-verde-fundo); color: var(--ui-verde); font-size: 13px; font-weight: 700; }
        .ccad-av { display: flex; align-items: center; justify-content: center; width: 80px; height: 80px; margin: 18px auto 0; overflow: hidden; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 30px; font-weight: 700; }
        .ccad-av img { width: 100%; height: 100%; object-fit: cover; }
        .ccad h1 { margin: 14px 0 0; text-align: center; font-size: 22px; font-weight: 700; line-height: 1.25; }
        .ccad-sub { max-width: 320px; margin: 6px auto 0; text-align: center; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
        .ccad-form { display: flex; flex-direction: column; gap: 16px; margin-top: 24px; }
        .ccad-zap { color: #16A34A; }
        .ccad-erro { margin: 14px 0 0; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; }
        .ccad .ccad-cta { margin-top: 24px; }
        .ccad-dep { margin: 12px 0 0; text-align: center; font-size: 13px; color: var(--ui-texto-3); }
      `}</style>
    </div>
  );
}
