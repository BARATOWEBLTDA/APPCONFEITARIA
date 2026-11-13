import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { refreshProfile } from "@/hooks/useProfile";
import { digitosTelefone, mascaraTelefone } from "@/lib/telefone";
import { Botao, Campo } from "@/components/base";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { nomeApresentavel, pareceNomeDeLoja } from "@/lib/nomeApresentavel";

/**
 * "Complete seu cadastro" (aprovado 02/10) — aparece logo depois do PRIMEIRO login com o Google.
 * O Google só manda nome, e-mail e foto; aqui ela confirma o nome e informa o nome da confeitaria
 * e o WhatsApp (os mesmos campos do cadastro normal). Os 3 são obrigatórios.
 * 09/10 (3.57): no padrão do guia (Campo, Botao, cores --ui-*, sem degradê).
 */
// (11/10) máscara única do app (aceita colar com +55)
const maskTel = mascaraTelefone;

export default function CompletarCadastro({ user, nomeInicial, lojaInicial = "", telefoneInicial = "", onPronto }: { user: User; nomeInicial: string; lojaInicial?: string; telefoneInicial?: string; onPronto: () => void }) {
  const meta = user?.user_metadata || {};
  const [nome, setNome] = useState(nomeInicial || meta.full_name || meta.name || "");
  // (10/10) o que já está no cadastro vem preenchido (só falta um dos dois): ela não redigita nem grava por cima
  const [loja, setLoja] = useState(() => lojaInicial || (pareceNomeDeLoja(meta.full_name || meta.name) ? String(meta.full_name || meta.name).trim() : ""));
  const [tel, setTel] = useState(() => maskTel(digitosTelefone(telefoneInicial)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const digitos = tel.replace(/\D/g, "");
  const pronto = nome.trim().length >= 2 && loja.trim().length >= 2 && digitos.length >= 10;
  const primeiroNome = nomeApresentavel(nome);

  const salvar = async () => {
    if (!pronto || salvando) return;
    setSalvando(true); setErro("");
    const dados: Record<string, unknown> = { id: user.id, nome: nome.trim(), nome_loja: loja.trim(), telefone: tel };
    // (18/10) a foto do Google não vira mais foto de perfil: a foto do app é sempre a logo do cardápio
    const { error } = await supabase.from("profiles").upsert(dados, { onConflict: "id" });
    if (error) { setErro("Não foi possível salvar agora. Confira a internet e tente de novo."); setSalvando(false); return; }
    supabase.auth.updateUser({ data: { nome: nome.trim(), nome_loja: loja.trim(), telefone: tel } }).then(() => {}, () => {});
    // (13/11) cadastro pelo Google também conta como "Concluir inscrição" nos pixels do Doonly (antes só o cadastro por e-mail contava)
    if (!lojaInicial && !telefoneInicial) void import("@/lib/pixelsApp").then(m => m.eventoDoApp("CompleteRegistration", { content_name: "Cadastro Doonly", metodo: "google" })).catch(() => {});
    await refreshProfile?.();
    onPronto();
  };

  // (13/11) o nome do Google só aparece no título se parecer nome de gente ("Cardapio Web" não vira "Quase lá, Cardapio!");
  // nome com cara de loja já vem sugerido no Nome da confeitaria. Sem nome no Google, aparece o campo "Seu nome".
  const semNomeDoGoogle = !(nomeInicial || meta.full_name || meta.name);
  const email = String(user?.email || "");
  return (
    <div className="ccad" data-sem-recarregar="">{/* (11/10) a atualização automática não recarrega com esta tela aberta */}
      <div className="ccad-card">
        <img className="ccad-masc" src="/marca/leve/acenando.webp" alt="" width={112} height={131} />
        <img className="ccad-logo" src="/marca/texto.png" alt="Doonly" width={112} height={45} />
        <h1>{primeiroNome ? `Quase lá, ${primeiroNome}!` : "Quase lá!"}</h1>
        <p className="ccad-sub">Só falta isso para abrir a sua loja.</p>

        <div className="ccad-google">
          <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
          <span className="ccad-google-t"><b>Conectado com o Google</b>{email && <small>{email}</small>}</span>
          <span className="ccad-google-ok" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        </div>

        <div className="ccad-form">
          {semNomeDoGoogle && <Campo id="cc-nome" rotulo="Seu nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Juliana Souza" autoComplete="off" />}
          <Campo id="cc-loja" rotulo="Nome da confeitaria" value={loja} onChange={e => setLoja(e.target.value)} placeholder="Ex.: Doce Formiga" autoComplete="off"
            dica="É o nome que aparece no seu cardápio." />
          <Campo id="cc-tel" rotulo="WhatsApp que recebe os pedidos" value={tel} onChange={e => setTel(maskTel(e.target.value))} placeholder="(41) 99999-0000" inputMode="tel" autoComplete="off"
            icone={<IconeWhatsApp size={20} className="ccad-zap" />} />
        </div>

        {erro && <p className="ccad-erro" role="alert">{erro}</p>}
        <Botao cheio className="ccad-cta" disabled={!pronto} carregando={salvando} onClick={salvar}>Criar minha loja</Botao>
        <p className="ccad-dep">Dá para mudar tudo isso depois.</p>
      </div>
      <style>{`
        .ccad { position: fixed; inset: 0; z-index: 4000; overflow-y: auto; font-family: var(--font-base); color: var(--ui-texto);
          background: radial-gradient(circle at 50% 0, #3A2219, #22130E 70%); padding: calc(64px + env(safe-area-inset-top, 0px)) 16px 0; }
        .ccad-card { position: relative; max-width: 420px; min-height: calc(100% - 0px); margin: 0 auto; background: #fff; border-radius: 28px 28px 0 0;
          padding: 78px 24px calc(28px + env(safe-area-inset-bottom, 0px)); }
        @media (min-width: 700px) { .ccad { padding-bottom: 48px; } .ccad-card { min-height: 0; border-radius: 28px; } }
        .ccad-masc { position: absolute; top: -62px; left: 50%; transform: translateX(-50%); width: 112px; height: auto; }
        .ccad-logo { display: block; margin: 0 auto; width: 112px; height: auto; }
        .ccad h1 { margin: 10px 0 0; text-align: center; font-size: 22px; font-weight: 600; line-height: 1.25; }
        .ccad-sub { margin: 6px auto 0; text-align: center; font-size: 14px; line-height: 1.5; color: var(--ui-texto-2); }
        .ccad-google { display: flex; align-items: center; gap: 12px; margin-top: 20px; padding: 12px 14px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio); }
        .ccad-google svg { flex-shrink: 0; }
        .ccad-google-t { min-width: 0; display: flex; flex-direction: column; font-size: 14px; }
        .ccad-google-t b { font-weight: 500; }
        .ccad-google-t small { font-size: 13px; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ccad-google-ok { margin-left: auto; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .ccad-form { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; }
        .ccad-zap { color: #15803D; }
        .ccad-erro { margin: 14px 0 0; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-vermelho-fundo); color: var(--ui-vermelho-escuro); font-size: 14px; }
        .ccad .ccad-cta { margin-top: 24px; }
        .ccad-dep { margin: 12px 0 0; text-align: center; font-size: 13px; color: var(--ui-texto-3); }
      `}</style>
    </div>
  );
}
