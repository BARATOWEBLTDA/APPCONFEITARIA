import { useState, useEffect, useRef, type ReactNode } from "react";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import { useNavigate } from "react-router-dom";
import { Bell, Camera, ChatCircleText, CaretRight, Crown, FileText, Gift, Headset, Lightbulb, PencilSimple, SignOut, Bug } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Campo, Janela, avisar, informar } from "@/components/base";
import { refreshProfile } from "@/hooks/useProfile";
import { useRecorte } from "@/components/ui/useRecorte";
import TermosModal from "@/components/TermosModal";
import EditarPerfilModal from "@/components/EditarPerfilModal";
import InstalarAppCard from "@/components/InstalarAppCard";
import AtualizarAppItem from "@/components/AtualizarAppItem";
import "./configuracoes.css";

/**
 * Configurações (09/10 · 3.55, no padrão do guia). Um layout só pro celular e pro computador:
 * perfil, assinatura, instalar o app, a lista do app e da ajuda, sair e excluir a conta.
 */

/** Linha da lista (ícone, nome, apoio e a seta) */
function ItemConfig({ icone, tom = "cinza", nome, apoio, onClick, destaque, children }: {
  icone: ReactNode; tom?: "cinza" | "rosa" | "amarelo" | "vermelho" | "azul"; nome: string; apoio?: ReactNode; onClick: () => void; destaque?: boolean; children?: ReactNode;
}) {
  return (
    <button type="button" className="cf9-item" onClick={onClick}>
      <span className={`cf9-ic cf9-ic--${tom}`} aria-hidden="true">{icone}</span>
      <span className="cf9-tx"><b>{nome}</b>{apoio && <small className={destaque ? "on" : ""}>{apoio}</small>}</span>
      {children}
      <CaretRight size={18} weight="bold" className="cf9-seta" aria-hidden="true" />
    </button>
  );
}

const formatPhone = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export default function Configuracoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [pro, setPro] = useState(false);
  const [form, setForm] = useState({ nome: "", nome_loja: "", foto_url: "", telefone: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const [termosOpen, setTermosOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excluirConfirm, setExcluirConfirm] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserEmail(user.email || "");
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const proExpira = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
      setPro(data?.plano === "pro" && (!proExpira || proExpira > new Date()));
      if (data) {
        setForm({ nome: data.nome || "", nome_loja: data.nome_loja || "", foto_url: data.foto_url || "", telefone: data.telefone || "" });
        if (data.foto_url) setPreview(data.foto_url);
      }
      setLoading(false);
    })();
  }, []);

  const enviarFoto = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    const path = `avatars/${userId}.jpg`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (uploadError) {
      avisar("Não deu pra enviar a foto. Tente de novo.", { tipo: "erro" });
      setPreview(form.foto_url || null);
    } else {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      setForm(f => ({ ...f, foto_url: publicUrl }));
      setPreview(publicUrl);
      await supabase.from("profiles").update({ foto_url: publicUrl }).eq("id", userId);
      await refreshProfile();
      avisar("Foto trocada", { tipo: "ok" });
    }
    setUploading(false);
  };
  const recorte = useRecorte(f => { void enviarFoto(f); }, { forma: "round" });

  const salvarPerfil = async () => {
    if (!userId) return;
    if (!form.nome.trim()) { setError("Escreva seu nome."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("profiles").upsert({ id: userId, nome: form.nome.trim(), nome_loja: form.nome_loja, foto_url: form.foto_url, telefone: form.telefone }, { onConflict: "id" });
    if (err) setError("Não deu pra salvar. Confira a internet e tente de novo.");
    else {
      try { await supabase.auth.updateUser({ data: { nome: form.nome.trim(), telefone: form.telefone } }); } catch { /* opcional */ }
      await refreshProfile();
      setEditarOpen(false);
      avisar("Perfil salvo", { tipo: "ok" });
    }
    setSaving(false);
  };

  const alterarSenha = async () => {
    if (!senhaAtual) return setSenhaMsg("Escreva sua senha atual.");
    if (novaSenha.length < 6) return setSenhaMsg("A nova senha precisa ter pelo menos 6 letras ou números.");
    if (novaSenha !== confirmSenha) return setSenhaMsg("As duas senhas novas não são iguais.");
    if (novaSenha === senhaAtual) return setSenhaMsg("A nova senha precisa ser diferente da atual.");
    if (!userEmail) return setSenhaMsg("Entre de novo na conta e tente outra vez.");
    setSavingSenha(true);
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: senhaAtual });
    if (reauthErr) { setSavingSenha(false); return setSenhaMsg("A senha atual está errada."); }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) { setSavingSenha(false); return setSenhaMsg("Não deu pra trocar a senha. Tente de novo."); }
    try { await supabase.auth.signOut({ scope: "others" }); } catch { /* opcional */ }
    setSavingSenha(false);
    setSenhaMsg("Senha alterada. Os outros aparelhos saíram da conta.");
    setSenhaAtual(""); setNovaSenha(""); setConfirmSenha("");
  };

  const sair = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem("doonly_profile_cache_v1"); } catch { /* ok */ }
    navigate("/login");
  };

  // Registra o pedido de exclusão pra equipe processar (apagar a conta exige permissão de servidor)
  const excluirConta = async () => {
    if (excluirConfirm.trim().toUpperCase() !== "EXCLUIR") return;
    setExcluindo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sugestoes").insert({
        user_id: user?.id || null, email: user?.email || userEmail || null, nome: form.nome || null,
        tipo: "exclusao_conta", titulo: "Pedido de exclusão de conta",
        descricao: `Excluir a conta e todos os dados de ${user?.email || userEmail || "(sem e-mail)"}.`,
        status: "recebida", tela_origem: "/configuracoes",
      });
      if (error) throw error;
      setExcluirOpen(false);
      await informar({ titulo: "Pedido recebido", texto: "Sua conta e todos os seus dados serão excluídos em até 7 dias. Se mudar de ideia, é só falar com a equipe Doonly.", icone: "ok" });
    } catch {
      setExcluindo(false);
      avisar("Não deu pra registrar o pedido agora. Tente de novo ou fale com a equipe Doonly.", { tipo: "erro" });
      return;
    }
    await supabase.auth.signOut();
    navigate("/login");
  };

  const inicial = (form.nome || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <AppPageHeader title="Configurações" subtitle="Sua conta e o app" />
      <div className="cf9">
        {loading ? (
          <div className="cl9-esq" aria-label="Carregando">{[0, 1, 2].map(k => <span key={k} />)}</div>
        ) : (<>
          {/* Perfil */}
          <section className="cf9-card cf9-perfil">
            <button type="button" className="cf9-av" onClick={() => !uploading && fileRef.current?.click()} aria-label={preview ? "Trocar a foto" : "Colocar uma foto"}>
              <span>{preview ? <img src={preview} alt="" /> : <b>{inicial}</b>}</span>
              <i aria-hidden="true">{uploading ? <span className="ui-gira" /> : <Camera size={14} weight="bold" />}</i>
            </button>
            <div className="cf9-perfil-tx">
              <b>{form.nome || "Seu nome"}</b>
              <small>{userEmail}</small>
            </div>
            <Botao variante="secundario" tamanho="m" icone={<PencilSimple size={18} weight="bold" />} onClick={() => { setError(""); setSenhaMsg(""); setEditarOpen(true); }}>
              <span className="cf9-g">Editar perfil</span><span className="cf9-c">Editar</span>
            </Botao>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
            {recorte.janela}
          </section>

          {/* Assinatura */}
          <section className={`cf9-card cf9-plano${pro ? " pro" : ""}`}>
            <div className="cf9-plano-cab">
              <span className="cf9-plano-ic" aria-hidden="true"><Crown size={24} weight="fill" /></span>
              <div>
                <small>Sua assinatura</small>
                <b>{pro ? "Plano PRO" : "Plano grátis"}{pro && <em>Ativo</em>}</b>
              </div>
            </div>
            <p>{pro
              ? "Você tem acesso a tudo do Doonly. Obrigada por apoiar o app!"
              : "Você já tem o essencial pra organizar sua confeitaria. No PRO, ganha a ficha técnica completa, relatórios de lucro, o Doo IA e muito mais."}</p>
            {pro
              ? <Botao variante="secundario" cheio onClick={() => navigate("/minha-assinatura")}>Ver minha assinatura</Botao>
              : <Botao variante="vinho" cheio icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>}
          </section>

          <InstalarAppCard />

          {/* App e ajuda */}
          <section className="cf9-card cf9-lista" aria-label="App e ajuda">
            <h2 className="cf9-sec">App</h2>
            <ItemConfig icone={<Bell size={20} weight="bold" />} nome="Notificações e sons" apoio="Avisos e sons do app" onClick={() => navigate("/configuracoes/notificacoes")} />
            <ItemConfig icone={<ChatCircleText size={20} weight="bold" />} tom="rosa" nome="Mensagens do WhatsApp" apoio="Troque o texto das mensagens prontas" onClick={() => navigate("/configuracoes/mensagens")} />
            <AtualizarAppItem />
            {INDICACAO_ATIVA && <ItemConfig icone={<Gift size={20} weight="bold" />} tom="rosa" nome="Indique e ganhe" apoio="Ganhe prêmios por cada assinante que você indicar" onClick={() => navigate("/indicar")} />}
            <h2 className="cf9-sec">Ajuda</h2>
            <ItemConfig icone={<Lightbulb size={20} weight="bold" />} tom="amarelo" nome="Sugerir uma melhoria" apoio="Conte o que falta ou o que melhoraria" onClick={() => navigate("/solicitar-recurso")} />
            <ItemConfig icone={<Bug size={20} weight="bold" />} tom="vermelho" nome="Relatar um problema" apoio="Algo não funcionou? Conte pra equipe" onClick={() => navigate("/relatar-problema")} />
            <ItemConfig icone={<Headset size={20} weight="bold" />} tom="azul" nome="Fale com o suporte" apoio="Converse com a equipe pelo WhatsApp" onClick={() => window.open(`https://wa.me/5511978414991?text=${encodeURIComponent("Olá! Preciso de ajuda com o Doonly.")}`, "_blank", "noopener")} />
            <ItemConfig icone={<FileText size={20} weight="bold" />} nome="Termos e privacidade" apoio="Termos de uso e política de privacidade" onClick={() => setTermosOpen(true)} />
          </section>

          <Botao variante="secundario" cheio icone={<SignOut size={20} weight="bold" />} onClick={sair}>Sair da conta</Botao>
          <p className="cf9-excluir">Não quer mais usar? <Botao variante="link" tamanho="p" onClick={() => { setExcluirConfirm(""); setExcluirOpen(true); }}>Excluir minha conta</Botao></p>
        </>)}
      </div>

      <TermosModal open={termosOpen} onClose={() => setTermosOpen(false)} />

      <EditarPerfilModal
        open={editarOpen}
        onClose={() => setEditarOpen(false)}
        nome={form.nome}
        telefone={form.telefone}
        email={userEmail}
        fotoPreview={preview}
        inicial={inicial}
        onNomeChange={v => setForm(f => ({ ...f, nome: v }))}
        onTelefoneChange={v => setForm(f => ({ ...f, telefone: formatPhone(v) }))}
        onFotoClick={() => fileRef.current?.click()}
        onSave={salvarPerfil}
        saving={saving}
        uploading={uploading}
        senhaAtual={senhaAtual}
        novaSenha={novaSenha}
        confirmSenha={confirmSenha}
        senhaMsg={senhaMsg}
        savingSenha={savingSenha}
        onSenhaAtualChange={setSenhaAtual}
        onNovaSenhaChange={setNovaSenha}
        onConfirmSenhaChange={setConfirmSenha}
        onAlterarSenha={alterarSenha}
        saveError={error}
      />

      <Janela aberta={excluirOpen} aoFechar={() => !excluindo && setExcluirOpen(false)} tipo="conteudo" titulo="Excluir minha conta" travada
        acoes={<>
          <Botao variante="secundario" onClick={() => setExcluirOpen(false)} disabled={excluindo}>Voltar</Botao>
          <Botao variante="perigo" onClick={excluirConta} carregando={excluindo} disabled={excluirConfirm.trim().toUpperCase() !== "EXCLUIR"}>Pedir a exclusão</Botao>
        </>}>
        <div className="cf9-exc">
          <p>Sua conta, seu cardápio e todos os seus dados (produtos, pedidos, clientes) serão excluídos em até 7 dias. Não dá pra desfazer.</p>
          <Campo rotulo='Pra confirmar, escreva "EXCLUIR"' placeholder="EXCLUIR" autoComplete="off" autoCapitalize="characters" value={excluirConfirm} onChange={e => setExcluirConfirm(e.target.value)} />
        </div>
      </Janela>
    </>
  );
}
