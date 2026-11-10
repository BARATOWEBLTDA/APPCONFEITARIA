import { useState, useEffect, useRef, type ReactNode } from "react";
import { digitosTelefone } from "@/lib/telefone";
import { useLocation, useNavigate } from "react-router-dom";
import { Lifebuoy, Bell, CaretRight, Crown, DownloadSimple, DeviceMobile, ArrowsClockwise, FileText, SignOut, User, WarningCircle, MagnifyingGlass, X } from "@phosphor-icons/react";
import { isStandalone, getInstallPrompt, promptInstall } from "@/lib/installPrompt";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { supabase } from "@/lib/supabase";
import { explicarErro, erroDeConexao, SEM_INTERNET } from "@/lib/erros";
import { mascaraTelefone } from "@/lib/telefone";
import AppPageHeader from "@/components/AppPageHeader";
import { COMO_CONFIGURACOES, TOUR_CONFIGURACOES } from "@/lib/comoTelas";
import { Botao, Campo, Janela, TelaVazia, avisar, informar } from "@/components/base";
import { fotoDaLoja, refreshProfile, sairDaConta } from "@/hooks/useProfile";
import { useRecorte } from "@/components/ui/useRecorte";
import TermosModal from "@/components/TermosModal";
import EditarPerfilModal from "@/components/EditarPerfilModal";
import InstalarAppCard from "@/components/InstalarAppCard";
import { VERSAO_APP } from "@/lib/versao";
import { recarregarLimpo } from "@/lib/recarregarLimpo";
import JanelaSair from "@/components/JanelaSair";
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
    <button type="button" className="cf9-item" data-nome={nome} onClick={onClick}>
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
type Achado = { nome: string; onde: string; palavras: string; ir: string | "conta" | "termos" | "avancado" | "notif" | "instalar" | "suporte"; abrir?: string };
// (6.110) "onde" com os nomes de hoje (Minha loja, Produtos, Financeiro) e cada item abre a parte certa
const INDICE: Achado[] = [
  { nome: "Nome, telefone e senha", onde: "Conta › Minha conta", palavras: "foto perfil logo email e-mail celular trocar senha", ir: "conta" },
  { nome: "Minha assinatura", onde: "Conta", palavras: "plano pro pagamento mensalidade cancelar", ir: "assinatura" },
  { nome: "Nome e descrição da loja", onde: "Minha loja › Dados da loja", palavras: "sobre confeitaria texto whatsapp", ir: "/cardapio-config", abrir: "loja" },
  { nome: "Endereço", onde: "Minha loja › Dados da loja", palavras: "cep rua mapa cidade localização", ir: "/cardapio-config", abrir: "endereco" },
  { nome: "Horário de funcionamento", onde: "Minha loja › Dados da loja", palavras: "horario aberto fechado dias semana abrir fechar", ir: "/cardapio-config", abrir: "horario" },
  { nome: "Formas de pagamento", onde: "Minha loja › Pagamento", palavras: "dinheiro cartão credito debito pagar troco", ir: "/cardapio-config", abrir: "pag" },
  { nome: "Pix pelo cardápio", onde: "Minha loja › Pix", palavras: "pix chave sinal pagamento online", ir: "/cardapio-config", abrir: "pix" },
  { nome: "Entrega e retirada", onde: "Minha loja › Entrega", palavras: "taxa de entrega frete retirar buscar delivery bairro raio", ir: "/cardapio-config", abrir: "ent" },
  { nome: "Redes sociais", onde: "Minha loja › Dados da loja", palavras: "instagram facebook", ir: "/cardapio-config", abrir: "redes" },
  { nome: "Pausar pedidos", onde: "Minha loja", palavras: "fechar loja ferias parar pausa", ir: "/cardapio" },
  { nome: "Logo, cores e banner", onde: "Minha loja › Aparência", palavras: "logotipo cor tema modelo imagem capa visual", ir: "/cardapio-design" },
  { nome: "Mensagens do WhatsApp", onde: "Minha loja", palavras: "whatsapp textos modelo resposta cliente aniversario", ir: "/configuracoes/mensagens" },
  { nome: "Custos fixos", onde: "Menu › Custos", palavras: "aluguel luz internet agua conta mensal", ir: "/custos", abrir: "fixo" },
  { nome: "Salário e jornada", onde: "Menu › Custos", palavras: "mao de obra hora horas custo da hora trabalho", ir: "/custos", abrir: "mao" },
  { nome: "Taxa da maquininha", onde: "Menu › Custos", palavras: "cartão credito debito custos variaveis embalagem", ir: "/custos", abrir: "maquininha" },
  { nome: "Custos invisíveis", onde: "Menu › Custos", palavras: "gas forno perdas descartaveis porcentagem", ir: "/custos", abrir: "invisiveis" },
  { nome: "Saldo do caixa", onde: "Financeiro", palavras: "dinheiro gaveta banco quanto tenho", ir: "/financeiro", abrir: "saldo" },
  { nome: "Velas e topos de bolo", onde: "Minha loja › Adicionais", palavras: "adicionais extras complementos escrita papel de arroz", ir: "/complementos" },
  { nome: "Categorias do cardápio", onde: "Minha loja › Categorias", palavras: "grupos ordem secoes", ir: "/categorias" },
  { nome: "Notificações e sons", onde: "App", palavras: "notificacao notificacoes avisos som alerta pedido novo", ir: "notif" },
  { nome: "Instalar o app", onde: "App › Sobre o app", palavras: "tela inicial atalho celular", ir: "instalar" },
  { nome: "Central de Ajuda", onde: "Ajuda e suporte", palavras: "tutorial como usar artigos duvidas passo a passo", ir: "/ajuda" },
  { nome: "Fale com o suporte", onde: "Ajuda e suporte", palavras: "whatsapp ajuda atendimento", ir: "suporte" },
  { nome: "Relatar um problema", onde: "Ajuda e suporte", palavras: "erro bug travou nao funciona", ir: "/relatar-problema" },
  { nome: "Sugerir uma melhoria", onde: "Ajuda e suporte", palavras: "ideia sugestao recurso", ir: "/solicitar-recurso" },
  { nome: "Termos e privacidade", onde: "Configurações", palavras: "lgpd dados contrato", ir: "termos" },
  { nome: "Excluir a conta", onde: "Minha conta", palavras: "apagar deletar encerrar excluir minha conta", ir: "avancado" },
  { nome: "Atualizar o app", onde: "App › Sobre o app", palavras: "versao nova atualizacao recarregar", ir: "sobre" },
];
const semAcento = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// (10/11) no celular a tela se divide em duas: "Minha conta" (dados, assinatura, sair) e "Configurações" (notificações e o app).
// No computador continua uma tela só com tudo (o menu da conta do topo abre por aqui).
export default function Configuracoes({ secao = "app" }: { secao?: "conta" | "app" }) {
  const [largo] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 901px)").matches);
  const verConta = largo || secao === "conta";
  const verApp = largo || secao === "app";
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [perguntandoSair, setPerguntandoSair] = useState(false); // (09/11) pergunta antes de sair, igual ao menu da foto
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
  // (31/10 · 5.71) com o convite do Chrome pronto, o toque já abre a janela de instalar do próprio celular (sem passo no meio)
  const abrirInstalar = () => { if (getInstallPrompt()) void promptInstall(); else setInstalarOpen(true); };
  // (10/11) "Sobre o app": versão, atualizar e instalar numa janela só (Instalar e Atualizar eram 2 linhas)
  const [sobreOpen, setSobreOpen] = useState(false);
  const [temNova, setTemNova] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const instalado = isStandalone();
  useEffect(() => {
    let cancelado = false;
    fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(v => { if (!cancelado && v?.id && v.id !== __BUILD_ID__) setTemNova(true); })
      .catch(() => { /* offline ou em dev */ });
    return () => { cancelado = true; };
  }, []);
  // (10/11) "Avançado" saiu: excluir a conta fica no fim da janela Minha conta
  const pedirExclusao = () => { setEditarOpen(false); setExcluirConfirm(""); setExcluirOpen(true); };
  const [excluirOpen, setExcluirOpen] = useState(false);
  const [excluirConfirm, setExcluirConfirm] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [senhaMsg, setSenhaMsg] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  // (6.174) conta que entra só pelo Google não tem senha: cria uma (sem pedir a "senha atual")
  const [semSenha, setSemSenha] = useState(false);

  // (10/10) Sem internet a tela ficava carregando pra sempre (o getUser vai à rede) e, quando só a leitura do perfil
  // falhava, abria com o formulário em branco: salvar gravava vazio por cima. Agora mostra o erro com "Tentar de novo"
  // e o perfil só pode ser editado depois de lido. O getSession lê a conta do próprio aparelho.
  const carregar = async () => {
    setLoading(true); setErroCarregar("");
    let user: { id: string; email?: string; app_metadata?: { providers?: string[]; provider?: string } } | null = null;
    try { user = (await supabase.auth.getSession()).data.session?.user ?? null; } catch { /* trata abaixo */ }
    if (!user) { setErroCarregar("Tente de novo em instantes."); setLoading(false); return; }
    setUserId(user.id);
    setUserEmail(user.email || "");
    { const prov = user.app_metadata?.providers || (user.app_metadata?.provider ? [user.app_metadata.provider] : []); setSemSenha(prov.length > 0 && !prov.includes("email")); }
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
  // (09/11) "Minha conta" do menu da foto: abre direto a janela da conta (foto, nome, telefone e senha)
  const location = useLocation();
  const abriuConta = useRef(false);
  useEffect(() => {
    if (loading || abriuConta.current || !(location.state as { abrirConta?: boolean } | null)?.abrirConta) return;
    abriuConta.current = true;
    setError(""); setSenhaMsg(""); setRascunho({ nome: form.nome, telefone: form.telefone }); setEditarOpen(true);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviarFoto = async (file: File) => {
    if (!userId) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    const path = `avatars/${userId}.jpg`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(path, file, { upsert: true });
    if (uploadError) {
      avisar("Não deu para enviar a foto. Tente de novo.", { tipo: "erro" });
      setPreview(form.foto_url || null);
    } else {
      const { data } = supabase.storage.from("profiles").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
      // (11/10) só diz "Foto trocada" se o perfil gravou (antes avisava mesmo quando falhava)
      let erroGravar: unknown = null;
      try { erroGravar = (await supabase.from("profiles").update({ logo_url: publicUrl, foto_url: publicUrl }).eq("id", userId)).error; } catch (e) { erroGravar = e; }
      if (erroGravar) {
        avisar(explicarErro(erroGravar, "Não deu para salvar a foto. Tente de novo."), { tipo: "erro" });
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
    const nome = rascunho.nome.trim(), telefone = digitosTelefone(rascunho.telefone); // (6.118) o campo tem máscara; no banco ficam só os números, como antes
    if (!nome) { setError("Escreva seu nome."); return; }
    setSaving(true); setError("");
    const { error: err } = await supabase.from("profiles").upsert({ id: userId, nome, nome_loja: form.nome_loja, foto_url: form.foto_url, telefone }, { onConflict: "id" });
    if (err) setError("Não deu para salvar. Confira a internet e tente de novo.");
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
    if (!semSenha && !senhaAtual) return setSenhaMsg("Escreva sua senha atual.");
    if (novaSenha.length < 8) return setSenhaMsg("A nova senha precisa ter pelo menos 8 caracteres.");
    if (novaSenha !== confirmSenha) return setSenhaMsg("As duas senhas novas não são iguais.");
    if (!semSenha && novaSenha === senhaAtual) return setSenhaMsg("A nova senha precisa ser diferente da atual.");
    if (!userEmail) return setSenhaMsg("Entre de novo na conta e tente outra vez.");
    setSavingSenha(true);
    const { error: reauthErr } = semSenha ? { error: null } : await supabase.auth.signInWithPassword({ email: userEmail, password: senhaAtual });
    // (11/10) queda de internet não é senha errada
    if (reauthErr) {
      setSavingSenha(false);
      if (erroDeConexao(reauthErr)) return setSenhaMsg(SEM_INTERNET);
      const st = Number((reauthErr as { status?: number }).status) || 0;
      if (st === 429 || st >= 500) return setSenhaMsg("Não deu para conferir a senha agora. Tente de novo em instantes.");
      return setSenhaMsg("A senha atual está errada.");
    }
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) { setSavingSenha(false); return setSenhaMsg(explicarErro(error, "Não deu para trocar a senha. Tente de novo.")); }
    // sair dos outros aparelhos precisa do servidor: o signOut devolve o erro (não lança). Se falhar, avisa (10/10)
    let saiuDosOutros = false;
    try { saiuDosOutros = !(await supabase.auth.signOut({ scope: "others" })).error; } catch { /* avisa abaixo */ }
    setSavingSenha(false);
    setSenhaMsg(semSenha ? "Senha criada. Agora você entra também com o e-mail e essa senha." : saiuDosOutros ? "Senha alterada. Os outros aparelhos saíram da conta." : "Senha alterada. Não deu para sair dos outros aparelhos agora.");
    setSemSenha(false);
    setSenhaAtual(""); setNovaSenha(""); setConfirmSenha("");
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
      avisar("Não deu para registrar o pedido agora. Tente de novo ou fale com a equipe Doonly.", { tipo: "erro" });
      return;
    }
    if (await sairDaConta()) navigate("/login");
    else setExcluindo(false);
  };

  const inicial = (form.nome || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <AppPageHeader title={!largo && secao === "conta" ? "Minha conta" : "Configurações"} voltar="/inicio"
        subtitle={largo ? "Sua conta e o app" : secao === "conta" ? "Seus dados e sua assinatura" : "Notificações e o app"} infoComo={COMO_CONFIGURACOES} infoTour={TOUR_CONFIGURACOES} />
      <div className="cf9">
        {loading ? (
          <div className="cl9-esq" aria-label="Carregando">{[0, 1, 2].map(k => <span key={k} />)}</div>
        ) : (<>
          {/* Perfil não carregou: avisa e deixa tentar de novo (o resto da tela, com o Sair, continua) */}
          {erroCarregar && (
            <TelaVazia caixa compacta icone={<WarningCircle size={30} />} titulo="Não deu para carregar seu perfil" texto={erroCarregar}
              acao={<Botao tamanho="m" onClick={() => void carregar()}>Tentar de novo</Botao>} />
          )}
          {/* (14/10) Uma lista só, sem cards: Conta (minha conta e assinatura), App, Ajuda e Avançado. Sair embaixo. */}
          {largo && <label className="cf9-busca">
            <MagnifyingGlass size={20} weight="bold" aria-hidden="true" />
            <input type="search" placeholder="Horário, pix, senha, custos…" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar nas configurações" autoComplete="off" />
            {busca && <button type="button" className="ui-busca-x" aria-label="Limpar a busca" onClick={() => setBusca('')}><X size={18} weight="bold" /></button>}
          </label>}
          {busca.trim() ? (() => {
            const q = semAcento(busca.trim());
            // (6.110) cada palavra pode estar em qualquer lugar ("taxa entrega" acha "taxa de entrega")
            const achados = INDICE.filter(a => { const alvo = semAcento(`${a.nome} ${a.onde} ${a.palavras}`); return q.split(/\s+/).every(p => alvo.includes(p.replace(/oes$/, "ao").replace(/s$/, ""))); });
            const ir = (a: Achado) => {
              if (a.ir === "conta") { setError(""); setSenhaMsg(""); setRascunho({ nome: form.nome, telefone: form.telefone }); setEditarOpen(true); }
              else if (a.ir === "assinatura") navigate(pro ? "/minha-assinatura" : "/assinar");
              else if (a.ir === "notif") navigate("/configuracoes/notificacoes");
              else if (a.ir === "instalar") abrirInstalar();
              else if (a.ir === "termos") setTermosOpen(true);
              else if (a.ir === "avancado") pedirExclusao();
              else if (a.ir === "sobre") setSobreOpen(true);
              else if (a.ir === "suporte") window.open(`https://wa.me/5511978414991?text=${encodeURIComponent("Olá! Preciso de ajuda com o Doonly.")}`, "_blank", "noopener");
              else navigate(a.ir, { state: { de: "/configuracoes", ...(a.ir === "/cardapio-config" && a.abrir === "ent" ? { secao: "entrega" } : a.abrir ? { abrir: a.abrir } : {}) } });
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
            {/* (19/10) Conta de volta em lista, todos os itens iguais (sem os quadradões nem o chocolate)
                (28/10 · 4.60) cada assunto num grupo: no celular continua uma lista só; no computador vira 3 cartões lado a lado */}
            {verConta && <div className="cf9-grupo">
            {largo && <h2 className="cf9-sec">Conta</h2>}
            {/* (21/10) "Configurações da loja" saiu: dados da loja, mensagens e o cardápio digital ficam em Cadastros */}
            <ItemConfig icone={<User size={20} weight="bold" />} nome={largo ? "Minha conta" : "Meus dados"}
              apoio={userEmail || "Foto, nome, telefone e senha"}
              onClick={() => { setError(""); setSenhaMsg(""); setRascunho({ nome: form.nome, telefone: form.telefone }); setEditarOpen(true); }} />
            <ItemConfig icone={<Crown size={20} weight="fill" />} nome="Minha assinatura"
              apoio={pro ? "Plano PRO · ativo" : "Plano grátis · 7 dias de PRO grátis"} destaque={!pro}
              onClick={() => navigate(pro ? "/minha-assinatura" : "/assinar")} />

            </div>}

            {/* (15/10) ordem pelo uso: o mais usado primeiro */}
            {verApp && <div className="cf9-grupo">
            {largo && <h2 className="cf9-sec">App</h2>}
            <ItemConfig icone={<Bell size={20} weight="bold" />} nome="Notificações e sons" apoio="Avisos e sons do app" onClick={() => navigate("/configuracoes/notificacoes")} />
            {/* (10/11) saiu do Menu do celular: é uma configuração que ela ajusta uma vez */}
            {/* (10/11) Instalar e Atualizar viraram 1 linha; sem o app instalado, a frase convida a instalar */}
            <ItemConfig icone={<DeviceMobile size={20} weight="bold" />} nome={largo ? "Sobre o app" : "Atualizar o app"}
              apoio={temNova ? "Nova versão disponível" : !instalado ? "Instale na tela inicial" : `Versão ${VERSAO_APP}`}
              destaque={temNova || !instalado} onClick={() => setSobreOpen(true)}>
              {temNova && <span className="cf9-ponto" aria-hidden="true" />}
            </ItemConfig>
            {/* (10/11) Termos e privacidade: linha própria (a LGPD pede a política sempre à mão) */}
            <ItemConfig icone={<FileText size={20} weight="bold" />} nome="Termos e privacidade" apoio="Como cuidamos dos seus dados" onClick={() => setTermosOpen(true)} />
            {/* (18/10) Minhas conquistas escondido por enquanto */}

            </div>}

            {/* (10/11) no celular a Ajuda fica no fim do Menu (link pequeno); no computador continua aqui */}
            {largo && <div className="cf9-grupo">
            <h2 className="cf9-sec">Ajuda</h2>
            {/* (10/11) os 4 de ajuda viraram 1: a Central de Ajuda já tem o WhatsApp, relatar e sugerir */}
            <ItemConfig icone={<Lifebuoy size={20} weight="bold" />} nome="Ajuda e suporte" apoio="Tutoriais, WhatsApp e sugestões" onClick={() => navigate("/ajuda")} />
            </div>}
          </section>
          </>)}
          {verConta && <Botao variante="secundario" cheio className="cf9-sair" icone={<SignOut size={20} weight="bold" />} onClick={() => setPerguntandoSair(true)}>Sair da conta</Botao>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={recorte.escolher} />
          {recorte.janela}
          <JanelaSair aberta={perguntandoSair} aoFechar={() => setPerguntandoSair(false)} />
        </>)}
      </div>

      <TermosModal open={termosOpen} onClose={() => setTermosOpen(false)} />

      <Janela aberta={instalarOpen} aoFechar={() => setInstalarOpen(false)} tipo="conteudo" titulo="Instalar o app">
        <InstalarAppCard />
      </Janela>

      <Janela aberta={sobreOpen} aoFechar={() => setSobreOpen(false)} tipo="conteudo" titulo="Sobre o app">
        <div className="cf9-sobre">
          <p className={`cf9-sobre-v${temNova ? " on" : ""}`}><b>{temNova ? "Tem versão nova" : "Você está na versão mais nova"}</b>Versão {VERSAO_APP}</p>
          <Botao variante={temNova ? "principal" : "secundario"} cheio carregando={atualizando} icone={<ArrowsClockwise size={18} weight="bold" />}
            onClick={() => { setAtualizando(true); recarregarLimpo(); }}>Atualizar o app</Botao>
          {!instalado && <Botao variante="secundario" cheio icone={<DownloadSimple size={18} weight="bold" />} onClick={() => { setSobreOpen(false); abrirInstalar(); }}>Instalar na tela inicial</Botao>}
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
        semSenha={semSenha}
        saveError={error}
        onExcluirConta={pedirExclusao}
      />

      <Janela aberta={excluirOpen} aoFechar={() => !excluindo && setExcluirOpen(false)} tipo="conteudo" titulo="Excluir minha conta" travada
        acoes={<>
          <Botao variante="secundario" onClick={() => setExcluirOpen(false)} disabled={excluindo}>Voltar</Botao>
          <Botao variante="perigo" onClick={excluirConta} carregando={excluindo} disabled={excluirConfirm.trim().toUpperCase() !== "EXCLUIR"}>Pedir a exclusão</Botao>
        </>}>
        <div className="cf9-exc">
          <p>Sua conta, seu cardápio e todos os seus dados (produtos, pedidos, clientes) serão excluídos em até 7 dias. Não dá para desfazer.</p>
          <Campo rotulo='Para confirmar, escreva "EXCLUIR"' placeholder="EXCLUIR" autoComplete="off" autoCapitalize="characters" value={excluirConfirm} onChange={e => setExcluirConfirm(e.target.value)} />
        </div>
      </Janela>
    </>
  );
}
