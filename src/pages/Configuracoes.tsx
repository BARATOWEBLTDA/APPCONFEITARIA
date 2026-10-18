import { useState, useEffect, useRef, type ReactNode } from "react";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import { useNavigate } from "react-router-dom";
import { Bell, CaretRight, Crown, DownloadSimple, FileText, Gift, Lightbulb,  SignOut, SlidersHorizontal, Storefront, Bug, Truck, User, WarningCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { isStandalone } from "@/lib/installPrompt";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { supabase } from "@/lib/supabase";
import { explicarErro, erroDeConexao, SEM_INTERNET } from "@/lib/erros";
import { mascaraTelefone } from "@/lib/telefone";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Campo, Janela, TelaVazia, avisar, informar } from "@/components/base";
import { fotoDaLoja, refreshProfile, sairDaConta } from "@/hooks/useProfile";
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
// (15/10) todos os ícones no mesmo fundo rosa (antes cada um tinha uma cor)
// tom "pro": a assinatura pra quem está no grátis (vinho com a coroa dourada, como o "Seja PRO"); "neutro": o Avançado
function ItemConfig({ icone, tom, nome, apoio, onClick, destaque, children }: {
  icone: ReactNode; tom?: "pro" | "neutro" | "choco"; nome: string; apoio?: ReactNode; onClick: () => void; destaque?: boolean; children?: ReactNode;
}) {
  return (
    <button type="button" className="cf9-item" onClick={onClick}>
      <span className={`cf9-ic${tom ? ` cf9-ic--${tom}` : ""}`} aria-hidden="true">{icone}</span>
      <span className="cf9-tx"><b>{nome}</b>{apoio && <small className={destaque ? "on" : ""}>{apoio}</small>}</span>
      {children}
      <CaretRight size={18} weight="bold" className="cf9-seta" aria-hidden="true" />
    </button>
  );
}

// (11/10) máscara única do app: "+55 41 99999-0000" não vira mais "(55) 41999-9900"
const formatPhone = mascaraTelefone;

/** (16/10) busca das Configurações (ideia vista no Dora): acha o ajuste e diz onde ele fica */
type Achado = { nome: string; onde: string; palavras: string; ir: string | "conta" | "termos" | "avancado" | "notif" | "instalar" | "suporte" };
const INDICE: Achado[] = [
  { nome: "Nome, telefone e senha", onde: "Conta › Minha conta", palavras: "foto perfil email e-mail celular trocar senha", ir: "conta" },
  { nome: "Minha assinatura", onde: "Conta", palavras: "plano pro pagamento mensalidade cancelar", ir: "assinatura" },
  { nome: "Nome e descrição da loja", onde: "Minha loja › Dados da loja", palavras: "sobre confeitaria texto", ir: "/cardapio-config" },
  { nome: "Endereço", onde: "Minha loja › Dados da loja", palavras: "cep rua mapa cidade localização", ir: "/cardapio-config" },
  { nome: "Horário de funcionamento", onde: "Minha loja › Dados da loja", palavras: "horario aberto fechado dias semana abrir fechar", ir: "/cardapio-config" },
  { nome: "Formas de pagamento", onde: "Minha loja › Dados da loja", palavras: "pix dinheiro cartão credito debito pagar", ir: "/checkout-config" },
  { nome: "Entrega e retirada", onde: "Minha loja › Dados da loja", palavras: "taxa de entrega frete retirar buscar delivery", ir: "/checkout-config" },
  { nome: "Logo, cores e banner", onde: "Minha loja › Aparência", palavras: "logotipo cor tema modelo imagem capa visual", ir: "/cardapio-design" },
  { nome: "Mensagens do WhatsApp", onde: "Cardápio", palavras: "whatsapp textos modelo resposta cliente", ir: "/configuracoes/mensagens" },
  { nome: "Custos fixos", onde: "Financeiro › Custos", palavras: "aluguel luz internet agua conta mensal", ir: "/custos" },
  { nome: "Salário e jornada", onde: "Financeiro › Custos", palavras: "mao de obra hora horas custo da hora trabalho", ir: "/custos" },
  { nome: "Taxa da maquininha", onde: "Financeiro › Custos", palavras: "cartão credito debito custos variaveis embalagem", ir: "/custos" },
  { nome: "Custos invisíveis", onde: "Financeiro › Custos", palavras: "gas forno perdas descartaveis porcentagem", ir: "/custos" },
  { nome: "Saldo do caixa", onde: "Financeiro", palavras: "dinheiro gaveta banco quanto tenho", ir: "/financeiro" },
  { nome: "Velas e topos de bolo", onde: "Cadastros › Personalização", palavras: "adicionais extras complementos escrita papel de arroz", ir: "/complementos" },
  { nome: "Categorias do cardápio", onde: "Cadastros › Categorias", palavras: "grupos ordem secoes", ir: "/categorias" },
  { nome: "Notificações e sons", onde: "App", palavras: "avisos som alerta pedido novo", ir: "notif" },
  { nome: "Instalar o app", onde: "App", palavras: "tela inicial atalho celular", ir: "instalar" },
  { nome: "Fale com o suporte", onde: "Ajuda", palavras: "whatsapp ajuda atendimento", ir: "suporte" },
  { nome: "Termos e privacidade", onde: "Ajuda", palavras: "lgpd dados contrato", ir: "termos" },
  { nome: "Excluir a conta", onde: "Outros › Avançado", palavras: "apagar deletar encerrar", ir: "avancado" },
];
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Configuracoes() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [pro, setPro] = useState(false);
  const [form, setForm] = useState({ nome: "", nome_loja: "", foto_url: "", telefone: "" });
  // (11/10) "Editar perfil" mexe numa cópia: o cartão de trás só muda depois de salvar (cancelar não deixa nome não salvo na tela)
  const [rascunho, setRascunho] = useState({ nome: "", telefone: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  const [termosOpen, setTermosOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [instalarOpen, setInstalarOpen] = useState(false); // (14/10) "Instalar o app" virou item da lista
  const [avancadoOpen, setAvancadoOpen] = useState(false); // (14/10) "Avançado" virou item da lista
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excluirConfirm, setExcluirConfirm] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);

  // (10/10) Sem internet a tela ficava carregando pra sempre (o getUser vai à rede) e, quando só a leitura do perfil
  // falhava, abria com o formulário em branco: salvar gravava vazio por cima. Agora mostra o erro com "Tentar de novo"
  // e o perfil só pode ser editado depois de lido. O getSession lê a conta do próprio aparelho.
  const carregar = async () => {
    setLoading(true); setErroCarregar("");
    let user: { id: string; email?: string } | null = null;
    try { user = (await supabase.auth.getSession()).data.session?.user ?? null; } catch { /* trata abaixo */ }
    if (!user) { setErroCarregar("Tente de novo em instantes."); setLoading(false); return; }
    setUserId(user.id);
    setUserEmail(user.email || "");
    const { data, error: erroPerfil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (erroPerfil) { setErroCarregar(explicarErro(erroPerfil, "Tente de novo em instantes.")); setLoading(false); return; }
    const proExpira = data?.pro_expira_em ? new Date(data.pro_expira_em) : null;
    setPro(data?.plano === "pro" && (!proExpira || proExpira > new Date()));
    if (data) {
      setForm({ nome: data.nome || "", nome_loja: data.nome_loja || "", foto_url: data.foto_url || "", telefone: data.telefone || "" });
      { const f = fotoDaLoja(data); if (f) setPreview(f); } // (18/10) a foto da conta é a logo do cardápio
    }
    setLoading(false);
  };
  useEffect(() => { void carregar(); }, []);

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
      // (11/10) só diz "Foto trocada" se o perfil gravou (antes avisava mesmo quando falhava)
      let erroGravar: unknown = null;
      try { erroGravar = (await supabase.from("profiles").update({ logo_url: publicUrl, foto_url: publicUrl }).eq("id", userId)).error; } catch (e) { erroGravar = e; }
      if (erroGravar) {
        avisar(explicarErro(erroGravar, "Não deu pra salvar a foto. Tente de novo."), { tipo: "erro" });
        setPreview(form.foto_url || null);
      } else {
        setForm(f => ({ ...f, foto_url: publicUrl }));
        setPreview(publicUrl);
        await refreshProfile();
        avisar("Foto trocada", { tipo: "ok" });
      }
    }
    setUploading(false);
  };
  const recorte = useRecorte(f => { void enviarFoto(f); }, { forma: "round" });

  const salvarPerfil = async () => {
    if (!userId || erroCarregar) return; // perfil não lido: não grava o formulário em branco por cima
    if (saving) return;
    const nome = rascunho.nome.trim(), telefone = rascunho.telefone;
    if (!nome) { setError("Escreva seu nome."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("profiles").upsert({ id: userId, nome, nome_loja: form.nome_loja, foto_url: form.foto_url, telefone }, { onConflict: "id" });
    if (err) setError("Não deu pra salvar. Confira a internet e tente de novo.");
    else {
      setForm(f => ({ ...f, nome, telefone })); // gravou: agora sim o cartão de trás muda
      try { await supabase.auth.updateUser({ data: { nome, telefone } }); } catch { /* opcional */ }
      await refreshProfile();
      setEditarOpen(false);
      avisar("Perfil salvo", { tipo: "ok" });
    }
    setSaving(false);
  };

  const alterarSenha = async () => {
    if (!senhaAtual) return setSenhaMsg("Escreva sua senha atual.");
    if (novaSenha.length < 8) return setSenhaMsg("A nova senha precisa ter pelo menos 8 caracteres.");
    if (novaSenha !== confirmSenha) return setSenhaMsg("As duas senhas novas não são iguais.");
    if (novaSenha === senhaAtual) return setSenhaMsg("A nova senha precisa ser diferente da atual.");
    if (!userEmail) return setSenhaMsg("Entre de novo na conta e tente outra vez.");
    setSavingSenha(true);
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: senhaAtual });
    // (11/10) queda de internet não é senha errada
    if (reauthErr) {
      setSavingSenha(false);
      if (erroDeConexao(reauthErr)) return setSenhaMsg(SEM_INTERNET);
      const st = Number((reauthErr as { status?: number }).status) || 0;
      if (st === 429 || st >= 500) return setSenhaMsg("Não deu pra conferir a senha agora. Tente de novo em instantes.");
      return setSenhaMsg("A senha atual está errada.");
    }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) { setSavingSenha(false); return setSenhaMsg(explicarErro(error, "Não deu pra trocar a senha. Tente de novo.")); }
    // sair dos outros aparelhos precisa do servidor: o signOut devolve o erro (não lança). Se falhar, avisa (10/10)
    let saiuDosOutros = false;
    try { saiuDosOutros = !(await supabase.auth.signOut({ scope: "others" })).error; } catch { /* avisa abaixo */ }
    setSavingSenha(false);
    setSenhaMsg(saiuDosOutros ? "Senha alterada. Os outros aparelhos saíram da conta." : "Senha alterada. Não deu pra sair dos outros aparelhos agora.");
    setSenhaAtual(""); setNovaSenha(""); setConfirmSenha("");
  };

  const sair = async () => {
    // (10/10) sai neste aparelho mesmo sem internet; só vai pro login quando a sessão daqui foi mesmo encerrada
    if (!(await sairDaConta())) { avisar("Não deu pra sair agora. Tente de novo.", { tipo: "erro" }); return; }
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
    if (await sairDaConta()) navigate("/login");
    else setExcluindo(false);
  };

  const inicial = (form.nome || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <AppPageHeader title="Configurações" subtitle="Sua conta e o app" />
      <div className="cf9">
        {loading ? (
          <div className="cl9-esq" aria-label="Carregando">{[0, 1, 2].map(k => <span key={k} />)}</div>
        ) : (<>
          {/* Perfil não carregou: avisa e deixa tentar de novo (o resto da tela, com o Sair, continua) */}
          {erroCarregar && (
            <TelaVazia caixa compacta icone={<WarningCircle size={30} />} titulo="Não deu pra carregar seu perfil" texto={erroCarregar}
              acao={<Botao tamanho="m" onClick={() => void carregar()}>Tentar de novo</Botao>} />
          )}
          {/* (14/10) Uma lista só, sem cards: Conta (minha conta e assinatura), App, Ajuda e Avançado. Sair embaixo. */}
          <label className="cf9-busca">
            <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
            <input type="search" placeholder="Horário, pix, senha, custos…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar nas configurações" autoComplete="off" />
          </label>
          {busca.trim() ? (() => {
            const q = semAcento(busca.trim());
            const achados = INDICE.filter(a => semAcento(`${a.nome} ${a.onde} ${a.palavras}`).includes(q));
            const ir = (a: Achado) => {
              if (a.ir === "conta") { setError(""); setSenhaMsg(""); setRascunho({ nome: form.nome, telefone: form.telefone }); setEditarOpen(true); }
              else if (a.ir === "assinatura") navigate(pro ? "/minha-assinatura" : "/assinar");
              else if (a.ir === "notif") navigate("/configuracoes/notificacoes");
              else if (a.ir === "instalar") setInstalarOpen(true);
              else if (a.ir === "termos") setTermosOpen(true);
              else if (a.ir === "avancado") setAvancadoOpen(true);
              else if (a.ir === "suporte") window.open(`https://wa.me/5511978414991?text=${encodeURIComponent("Olá! Preciso de ajuda com o Doonly.")}`, "_blank", "noopener");
              else navigate(a.ir, { state: { de: "/configuracoes" } });
            };
            return (
              <section className="cf9-card cf9-lista" aria-label="Resultados da busca">
                {achados.length ? achados.map(a => (
                  <ItemConfig key={a.nome} icone={<MagnifyingGlass size={18} weight="bold" />} nome={a.nome} apoio={`em ${a.onde}`} onClick={() => ir(a)} />
                )) : <p className="cf9-nada">Nada com "{busca.trim()}". Tente outra palavra.</p>}
              </section>
            );
          })() : (<>
          <section className="cf9-card cf9-lista" aria-label="Configurações">
            <h2 className="cf9-sec">Conta</h2>
            {/* (18/10) os 3 principais em destaque (chocolate): a loja primeiro, depois a conta e a assinatura */}
            <ItemConfig icone={<Storefront size={20} weight="bold" />} tom="choco" nome="Configurações da loja" apoio="Dados, aparência e mensagens" onClick={() => navigate("/cardapio")} />
            <ItemConfig icone={preview ? <img className="cf9-ic-foto" src={preview} alt="" /> : <User size={20} weight="bold" />} tom="choco" nome="Minha conta"
              apoio={userEmail || "Foto, nome, telefone e senha"}
              onClick={() => { setError(""); setSenhaMsg(""); setRascunho({ nome: form.nome, telefone: form.telefone }); setEditarOpen(true); }} />
            <ItemConfig icone={<Crown size={20} weight="fill" />} tom="choco" nome="Minha assinatura"
              apoio={pro ? "Plano PRO · ativo" : "Plano grátis · conheça o PRO"} destaque={!pro}
              onClick={() => navigate(pro ? "/minha-assinatura" : "/assinar")} />

            {/* (15/10) ordem pelo uso: o mais usado primeiro */}
            <h2 className="cf9-sec">App</h2>
            <ItemConfig icone={<Bell size={20} weight="bold" />} nome="Notificações e sons" apoio="Avisos e sons do app" onClick={() => navigate("/configuracoes/notificacoes")} />
            {!isStandalone() && <ItemConfig icone={<DownloadSimple size={20} weight="bold" />} nome="Instalar o app" apoio="Abra direto, como um app" onClick={() => setInstalarOpen(true)} />}
            <AtualizarAppItem />
            {/* (18/10) Minhas conquistas escondido por enquanto */}
            {INDICACAO_ATIVA && <ItemConfig icone={<Gift size={20} weight="bold" />} nome="Indique e ganhe" apoio="Ganhe prêmios indicando" onClick={() => navigate("/indicar")} />}

            <h2 className="cf9-sec">Ajuda</h2>
            <ItemConfig icone={<IconeWhatsApp size={20} />} nome="Fale com o suporte" apoio="Pelo WhatsApp" onClick={() => window.open(`https://wa.me/5511978414991?text=${encodeURIComponent("Olá! Preciso de ajuda com o Doonly.")}`, "_blank", "noopener")} />
            <ItemConfig icone={<Bug size={20} weight="bold" />} nome="Relatar um problema" apoio="Algo não funcionou?" onClick={() => navigate("/relatar-problema")} />
            <ItemConfig icone={<Lightbulb size={20} weight="bold" />} nome="Sugerir uma melhoria" apoio="Conte o que falta no app" onClick={() => navigate("/solicitar-recurso")} />
            <ItemConfig icone={<FileText size={20} weight="bold" />} nome="Termos e privacidade" apoio="Termos de uso e privacidade" onClick={() => setTermosOpen(true)} />

            <h2 className="cf9-sec">Outros</h2>
            <ItemConfig icone={<SlidersHorizontal size={20} weight="bold" />} nome="Avançado" apoio="Excluir a conta" onClick={() => setAvancadoOpen(true)} />
          </section>
          </>)}
          <Botao variante="secundario" cheio icone={<SignOut size={20} weight="bold" />} onClick={sair}>Sair da conta</Botao>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
          {recorte.janela}
        </>)}
      </div>

      <TermosModal open={termosOpen} onClose={() => setTermosOpen(false)} />

      <Janela aberta={instalarOpen} aoFechar={() => setInstalarOpen(false)} tipo="conteudo" titulo="Instalar o app">
        <InstalarAppCard />
      </Janela>

      <Janela aberta={avancadoOpen} aoFechar={() => setAvancadoOpen(false)} tipo="conteudo" titulo="Avançado">
        <div className="cf9-avanc-c">
          <p>Não quer mais usar o Doonly? A conta e todos os dados são apagados.</p>
          <Botao variante="perigo" cheio onClick={() => { setAvancadoOpen(false); setExcluirConfirm(""); setExcluirOpen(true); }}>Excluir minha conta</Botao>
        </div>
      </Janela>

      <EditarPerfilModal
        open={editarOpen}
        onClose={() => setEditarOpen(false)}
        nome={rascunho.nome}
        telefone={rascunho.telefone}
        email={userEmail}
        fotoPreview={preview}
        inicial={inicial}
        onNomeChange={v => setRascunho(r => ({ ...r, nome: v }))}
        onTelefoneChange={v => setRascunho(r => ({ ...r, telefone: formatPhone(v) }))}
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
