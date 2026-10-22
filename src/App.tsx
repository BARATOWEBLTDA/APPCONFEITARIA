import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { INDICACAO_ATIVA } from "@/lib/recursos";
import CompletarCadastro from "@/components/CompletarCadastro";
import { useCallback, useEffect, useRef, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "@/lib/supabase";
import { erroDeConexao } from "@/lib/erros";
import { momentoSeguro } from "@/lib/autoAtualizar";
import { Botao, confirmar } from "@/components/base";
import { Mascote, NomeDoonly } from "@/components/marca/Mascote";
import { ArrowClockwise } from "@phosphor-icons/react";
import { NotificationProvider } from "@/context/NotificationContext";
import BoasVindas, { depoisDoVoltar } from "@/components/boasVindas/BoasVindas";
import { AceiteTermos } from "@/components/termos/AceiteTermos";
import { ContaAtiva } from "@/components/termos/ContaAtiva";
import { TERMOS_VERSAO } from "@/lib/termos";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import ResetPassword from "@/pages/ResetPassword";
import Termos from "@/pages/Termos";
import Privacidade from "@/pages/Privacidade";
import Layout from "@/components/Layout";
import Pedidos from "@/pages/Pedidos";
import { useParams } from "react-router-dom";
function PedidoVerRedirect() { const { id } = useParams(); return <Navigate to={`/pedidos/${id}/editar`} replace />; }
import EditarPedido from "@/pages/EditarPedido";
import NovaVenda from "@/pages/NovaVenda";
import Inicio from "@/pages/Inicio";
import Noticias from "@/pages/Noticias";
import NoticiaDetalhe from "@/pages/NoticiaDetalhe";
import Agenda from "@/pages/Agenda";
import Insumos from "@/pages/Insumos";
import Assinar from "@/pages/Assinar";
import ReceitasV2 from "@/pages/ReceitasV2";
const RECEITAS_ATIVAS = false;
import Notificacoes from "@/pages/Notificacoes";
import SolicitarRecurso from "@/pages/SolicitarRecurso";
import RelatarProblema from "@/pages/RelatarProblema";
import AssistenteVirtual from "@/pages/AssistenteVirtual";
import Conquistas from "@/pages/Conquistas";
import MinhaAssinatura from "@/pages/MinhaAssinatura";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsuarios from "@/pages/admin/AdminUsuarios";
import AdminReceitas from "@/pages/admin/AdminReceitas";
import AdminReceitasDoonly from "@/pages/admin/AdminReceitasDoonly";
import AdminPDFs from "@/pages/admin/AdminPDFs";
import AdminNotificacoes from "@/pages/admin/AdminNotificacoes";
import AdminNotifTemplates from "@/pages/admin/AdminNotifTemplates";
import AdminBanner from "@/pages/admin/AdminBanner";
import AdminBannersProntos from "@/pages/admin/AdminBannersProntos";
import AdminNoticias from "@/pages/admin/AdminNoticias";
import AdminIdeias from "@/pages/admin/AdminIdeias";
import AdminAutores from "@/pages/admin/AdminAutores";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import Configuracoes from "@/pages/Configuracoes";
import NotificacoesSons from "@/pages/NotificacoesSons";
import MensagensWhatsApp from "@/pages/MensagensWhatsApp";
import Indicar from "@/pages/Indicar";
import CardapioPrevia from "@/pages/CardapioPrevia";
import CardapioResumo from "@/pages/CardapioResumo";
import Produtos from "@/pages/Produtos";
import Categorias from "@/pages/Categorias";
import Clientes from "@/pages/Clientes";
import Cadastros from "@/pages/Cadastros";
import Complementos from "@/pages/Complementos";
import Marketing from "@/pages/Marketing";
import ClientePerfil from "@/pages/ClientePerfil";
import CardapioDesign from "@/pages/CardapioDesign";
/** (17/10) "Entrega e pagamento" agora fica dentro de Dados da loja: o link antigo abre lá, já nessa parte */
function IrParaEntrega() {
  const de = (useLocation().state as any)?.de;
  return <Navigate to="/cardapio-config" replace state={{ secao: "entrega", ...(de ? { de } : {}) }} />;
}
import DadosLoja from "@/pages/DadosLoja";
import CardapioPublico from "@/pages/CardapioPublico";
import FaixaComoCliente from "@/components/cardapio/FaixaComoCliente";
import Cardapio from "@/pages/Cardapio";
import Financeiro from "@/pages/Financeiro";
import FinanceiroTransacoes from "@/pages/FinanceiroTransacoes";
import FinanceiroAReceber from "@/pages/FinanceiroAReceber";
import FinanceiroAPagar from "@/pages/FinanceiroAPagar";
import Custos from "@/pages/Custos";
import EmBreve from "@/pages/EmBreve";
import Lucratividade from "@/pages/Lucratividade";
import FichaTecnica from "@/pages/FichaTecnica";
import NaoEncontrada from "@/pages/NaoEncontrada";
import SemInternet from "@/components/sistema/SemInternet";



/**
 * NavigateWithSearch — Wrapper de Navigate que PRESERVA a query string.
 *
 * Sem isso, `<Navigate to="/login" />` descarta `?ref=CODIGO` da URL
 * quando alguém abre um link de indicação (doonly.com.br/?ref=DOCE347).
 */
function NavigateWithSearch({ to, replace }: { to: string; replace?: boolean }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace={replace} />;
}

/** Tem sessão guardada neste aparelho? (a chave que o Supabase grava no localStorage) */
function temSessaoGuardada(): boolean {
  try { return Object.keys(localStorage).some(k => /^sb-.*-auth-token$/.test(k) && !!localStorage.getItem(k)); } catch { return false; }
}
/** A leitura da sessão falhou por falta de conexão? (o Supabase chama esse erro de AuthRetryableFetchError) */
function falhaDeRede(erro: unknown): boolean {
  return !!erro && ((erro as { name?: string }).name === "AuthRetryableFetchError" || erroDeConexao(erro));
}

/**
 * (11/10) Sessão vencida + sem internet: a renovação falha e o Supabase devolve "sem sessão", mas a conta continua
 * guardada no aparelho. Em vez de mandar pro login, fica esta tela até a internet voltar (mesmo desenho da tela de erro).
 */
function SemInternetNaEntrada({ tentando, aoTentar }: { tentando: boolean; aoTentar: () => void }) {
  return (
    <div className="ne-root">
      <div className="ne-fundo" />
      <main className="ne-cartao" role="alert">
        <Mascote pose="senha" className="ne-masc" />
        <NomeDoonly className="ne-nome" />
        {/* (11/10) o aparelho diz que tem conexão: o problema pode ser do servidor, não da internet dela */}
        <h1 className="ne-h">{navigator.onLine !== false ? "Não deu pra conectar agora" : "Você está sem internet"}</h1>
        <p className="ne-p">Sua conta continua aberta neste aparelho. Confira a conexão pra continuar.</p>
        <Botao cheio carregando={tentando} icone={<ArrowClockwise size={20} weight="bold" />} onClick={aoTentar}>Tentar de novo</Botao>
      </main>
    </div>
  );
}

/**
 * (11/10) Toque numa notificação com o app aberto: o sw.js manda { tipo: "abrir", url } e a tela troca por aqui,
 * SEM recarregar a página (antes recarregava tudo e o que estava sendo preenchido se perdia).
 * Se ela está no meio de um cadastro, pergunta antes de sair da tela.
 */
function AbrirPelaNotificacao() {
  const navegar = useNavigate();
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let perguntando = false;
    const aoReceber = async (e: MessageEvent) => {
      const dado = e.data as { tipo?: string; url?: string } | null;
      if (!dado || dado.tipo !== "abrir") return;
      try { e.ports?.[0]?.postMessage("ok"); } catch { /* o sw.js só usa pra saber que o app ouviu */ }
      let destino: URL;
      try { destino = new URL(String(dado.url || "/"), window.location.origin); } catch { return; }
      // (11/10) só abre link de site (http/https); javascript:, data: e afins são ignorados
      if (destino.protocol !== "http:" && destino.protocol !== "https:") return;
      if (destino.origin !== window.location.origin) { window.open(destino.href, "_blank", "noopener"); return; }
      const caminho = destino.pathname + destino.search + destino.hash;
      if (caminho === window.location.pathname + window.location.search + window.location.hash) return;
      if (!momentoSeguro()) {
        if (perguntando) return;
        perguntando = true;
        const ok = await confirmar({ titulo: "Abrir a notificação?", texto: "O que você está preenchendo nesta tela vai se perder.", rotulo: "Abrir", rotuloVoltar: "Ficar aqui", icone: "alerta" });
        perguntando = false;
        if (!ok) return;
      }
      navegar(caminho);
    };
    navigator.serviceWorker.addEventListener("message", aoReceber);
    return () => navigator.serviceWorker.removeEventListener("message", aoReceber);
  }, [navegar]);
  return null;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);
  // (11/10) a sessão não pôde ser renovada por falta de internet (ver SemInternetNaEntrada)
  const [semRede, setSemRede] = useState(false);
  const semRedeRef = useRef(false);
  const [tentandoRede, setTentandoRede] = useState(false);
  const [demorou, setDemorou] = useState(0); // 1 = passou de 2 s · 2 = passou de 8 s
  const navegar = useNavigate();
  const local = useLocation();

  // Decidido SÍNCRONO no primeiro render — evita o "app pisca antes do tutorial".
  // Se o usuário nunca viu as boas-vindas, elas abrem em tela cheia.
  // (07/10) Passou a abrir também no computador e no tablet deitado: a tela nova tem desenho pra tela larga.
  const [showFirstTutorial, setShowFirstTutorial] = useState<boolean>(() => {
    try {
      const visto = localStorage.getItem("doonly_tutorial_visto");
      const autoAberto = localStorage.getItem("doonly_tutorial_auto_aberto");
      return !visto && !autoAberto;
    } catch {
      return false;
    }
  });

  // (4.26) Aceite dos termos: "conferindo" até ler o banco; "pedir" mostra a tela; "ok" segue.
  // Sem a coluna no banco (SQL 4.26 não rodado) ou sem internet, não trava ninguém: segue como "ok".
  const [termos, setTermos] = useState<"conferindo" | "pedir" | "ok">("conferindo");
  // (4.26) Conta ativa: a confirmação aparece só pra quem acabou de criar a conta (antes das boas-vindas)
  const [contaAtivaPendente, setContaAtivaPendente] = useState<boolean>(() => showFirstTutorial);

  // Entrou pelo Google e ainda falta o nome da confeitaria ou o WhatsApp: tela "Complete seu cadastro" (02/10)
  const [completar, setCompletar] = useState<null | { nome: string; loja: string; telefone: string }>(null);
  // (10/10) a leitura do perfil falhou por falta de internet: tenta de novo (muda o número e o efeito roda outra vez)
  const [tentativa, setTentativa] = useState(0);
  // Login pelo Google: só mostra o app depois de conferir se falta completar o cadastro
  // (antes o Início aparecia por um instante e depois era trocado pela tela de cadastro)
  const [perfilConferido, setPerfilConferido] = useState(false);
  // (11/10) o app já estava em uso quando se descobriu que falta dado (nova tentativa, ou resposta que demorou):
  // a tela "Complete seu cadastro" espera a próxima troca de tela, pra não entrar no meio de uma venda
  const appJaAberto = useRef(false);
  const completarDepois = useRef<null | { nome: string; loja: string; telefone: string }>(null);
  useEffect(() => { if (perfilConferido) appJaAberto.current = true; }, [perfilConferido]);
  useEffect(() => {
    if (!completarDepois.current) return;
    setCompletar(completarDepois.current);
    completarDepois.current = null;
  }, [local.pathname]);

  const marcarSemRede = (v: boolean) => { semRedeRef.current = v; setSemRede(v); };
  const lendoSessao = useRef<Promise<void> | null>(null);
  const lerSessao = useCallback((): Promise<void> => {
    if (lendoSessao.current) return lendoSessao.current; // uma leitura por vez (sem internet ela demora)
    const leitura = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        // sem internet e com a conta guardada no aparelho: NÃO é "sem sessão" (não vai pro login)
        if (!data.session && falhaDeRede(error) && temSessaoGuardada()) { marcarSemRede(true); return; }
        marcarSemRede(false);
        setSession(data.session);
      } catch {
        if (temSessaoGuardada()) marcarSemRede(true);
        else { marcarSemRede(false); setSession(null); }
      }
    })().finally(() => { lendoSessao.current = null; });
    lendoSessao.current = leitura;
    return leitura;
  }, []);
  // enquanto a tela de "sem internet" estiver no ar, tenta de novo sozinho de 10 em 10 s (se o aparelho disser que tem conexão)
  useEffect(() => {
    if (!semRede) return;
    const t = window.setInterval(() => { if (navigator.onLine !== false) void lerSessao(); }, 10000);
    return () => window.clearInterval(t);
  }, [semRede, lerSessao]);

  useEffect(() => {
    void lerSessao();
    const { data: listener } = supabase.auth.onAuthStateChange((evento, session) => {
      // o "sem sessão" do começo, enquanto a falta de internet durar, não vale (a conta continua guardada)
      if (!session && evento === "INITIAL_SESSION" && (semRedeRef.current || (navigator.onLine === false && temSessaoGuardada()))) return;
      marcarSemRede(false);
      setSession(session);
    });
    // a internet voltou: lê a sessão de novo (agora a renovação passa)
    const voltou = () => { if (semRedeRef.current) void lerSessao(); };
    window.addEventListener("online", voltou);
    // sem internet o Supabase insiste por quase 1 minuto antes de responder (a tela ficava em branco esse tempo todo):
    // com o aparelho dizendo que está sem conexão, a tela de "sem internet" aparece em 2 s; senão, em 8 s
    const t1 = window.setTimeout(() => setDemorou(1), 2000);
    const t2 = window.setTimeout(() => setDemorou(2), 8000);
    return () => { listener.subscription.unsubscribe(); window.removeEventListener("online", voltou); window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [lerSessao]);

  const tentarRede = async () => {
    if (tentandoRede) return;
    setTentandoRede(true);
    // sem conexão nenhuma nem adianta chamar (o Supabase demoraria uns 25 s pra desistir): só mostra que tentou
    if (navigator.onLine === false) await new Promise(r => setTimeout(r, 700));
    else await lerSessao();
    setTentandoRede(false);
  };

  // Ao logar, sincroniza estado do tutorial com Supabase (fonte de verdade cross-device).
  // Se o banco diz "já viu", esconde o tutorial mesmo que o localStorage esteja vazio
  // (ex: usuário que trocou de device, browser anônimo, cache limpo).
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelado = false;
    // Internet muito lenta: depois de 4s abre o app mesmo assim (nunca fica numa tela vazia)
    const limite = setTimeout(() => { if (!cancelado) setPerfilConferido(true); }, 4000);
    let repetir: ReturnType<typeof setTimeout> | undefined;
    const denovo = () => { if (!cancelado) setTentativa(t => t + 1); };
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("tutorial_visto, nome, nome_loja, telefone")
          .eq("id", session.user.id)
          .maybeSingle();
        if (cancelado) return;
        // (10/10) Não deu pra ler o perfil: não conclui nada. Antes, a falha virava "Complete seu cadastro"
        // pra quem já tinha cadastro, e salvar ali gravava por cima. Abre o app e tenta de novo quando a internet voltar.
        if (error) {
          setPerfilConferido(true);
          if (erroDeConexao(error)) {
            // sem internet: espera ela voltar (antes as 5 tentativas acabavam em 75 s e ninguém mais conferia)
            window.addEventListener("online", denovo, { once: true });
            if (tentativa < 5 && navigator.onLine !== false) repetir = setTimeout(denovo, 15000);
          }
          return;
        }
        const viaGoogle = session.user?.app_metadata?.provider === "google"
          || (session.user?.identities || []).some((i: any) => i?.provider === "google");
        const faltaDado = !String((data as any)?.nome_loja || "").trim() || String((data as any)?.telefone || "").replace(/\D/g, "").length < 10;
        if (viaGoogle && faltaDado) {
          const falta = { nome: String((data as any)?.nome || ""), loja: String((data as any)?.nome_loja || ""), telefone: String((data as any)?.telefone || "") };
          if (tentativa > 0 || appJaAberto.current) completarDepois.current = falta;
          else setCompletar(falta);
        } else completarDepois.current = null;
        setPerfilConferido(true);
        if (data?.tutorial_visto) {
          // Banco diz que já viu — sincroniza localStorage e esconde
          try {
            localStorage.setItem("doonly_tutorial_visto", "1");
            localStorage.setItem("doonly_tutorial_auto_aberto", "1");
          } catch {}
          setShowFirstTutorial(false);
        }
        // Se banco diz "não viu", respeita o estado local (que já foi calculado sync no init)
      } catch {
        // Coluna pode não existir ainda ou rede caiu — segue com localStorage
        if (!cancelado) setPerfilConferido(true);
      }
    })();
    return () => { cancelado = true; clearTimeout(limite); clearTimeout(repetir); window.removeEventListener("online", denovo); };
  }, [session?.user?.id, tentativa]);

  // (4.26) confere se esta conta já aceitou a versão atual dos termos
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    try { if (localStorage.getItem(`doonly_termos_${uid}`) === TERMOS_VERSAO) { setTermos("ok"); return; } } catch { /* sem storage */ }
    let cancelado = false;
    const limite = setTimeout(() => { if (!cancelado) setTermos(t => (t === "conferindo" ? "ok" : t)); }, 5000);
    (async () => {
      try {
        const { data, error } = await supabase.from("profiles").select("termos_versao").eq("id", uid).maybeSingle();
        if (cancelado) return;
        if (error || !data) { setTermos("ok"); return; }
        if ((data as any).termos_versao === TERMOS_VERSAO) {
          try { localStorage.setItem(`doonly_termos_${uid}`, TERMOS_VERSAO); } catch { /* sem storage */ }
          setTermos("ok");
        } else setTermos("pedir");
      } catch { if (!cancelado) setTermos("ok"); }
    })();
    return () => { cancelado = true; clearTimeout(limite); };
  }, [session?.user?.id]);

  const esperandoDemais = session === undefined && (demorou === 2 || (demorou === 1 && navigator.onLine === false)) && temSessaoGuardada();
  if (!session && (semRede || esperandoDemais)) {
    return <SemInternetNaEntrada tentando={tentandoRede} aoTentar={tentarRede} />;
  }
  if (session === undefined) return null;
  if (!session) return <NavigateWithSearch to="/login" replace />;

  const entrouPeloGoogle = session.user?.app_metadata?.provider === "google"
    || (session.user?.identities || []).some((i: any) => i?.provider === "google");
  if (entrouPeloGoogle && !perfilConferido) {
    return <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #FCE7F3 0, #FAF7F8 240px)" }} aria-busy="true" />;
  }

  if (completar) {
    return <CompletarCadastro user={session.user} nomeInicial={completar.nome} lojaInicial={completar.loja} telefoneInicial={completar.telefone} onPronto={() => setCompletar(null)} />;
  }

  const primeiroNome = String(session.user?.user_metadata?.nome || session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || "").trim().split(/\s+/)[0];

  // (4.26) aceite dos termos: por cima do app (quem já usava) ou antes das boas-vindas (conta nova)
  if (termos === "pedir") {
    return <>{showFirstTutorial ? null : children}<AceiteTermos userId={session.user.id} aoAceitar={() => setTermos("ok")} /></>;
  }
  // conta nova: espera conferir os termos antes de abrir qualquer coisa (não pisca a apresentação)
  if (showFirstTutorial && termos === "conferindo") {
    return <div style={{ position: "fixed", inset: 0, background: "var(--chocolate-escuro, #22130E)" }} aria-busy="true" />;
  }
  if (showFirstTutorial && contaAtivaPendente) {
    return <>{children}<ContaAtiva nome={primeiroNome} aoContinuar={() => setContaAtivaPendente(false)} /></>;
  }

  if (showFirstTutorial) {
    return (
      <BoasVindas
        isOpen={true}
        nome={String(session.user?.user_metadata?.nome || session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || "").trim().split(/\s+/)[0]}
        onClose={(_tela, configurar) => {
          // "Configurar minha confeitaria": vai pro Início e os Primeiros passos aparecem em destaque (09/10 · 3.67)
          if (configurar) {
            try { sessionStorage.setItem("doonly_pp_destacar", "1"); } catch { /* sem storage: só não destaca */ }
            if (local.pathname !== "/inicio") depoisDoVoltar(() => navegar("/inicio"));
          }
          // Terminou ou tocou em "Pular": nos dois casos o guia não volta mais
          try {
            localStorage.setItem("doonly_tutorial_auto_aberto", "1");
            localStorage.setItem("doonly_tutorial_visto", "1");
          } catch {
            // localStorage indisponível — segue o baile
          }
          // Persiste no Supabase (cross-device). Silencioso se coluna não existir.
          if (session?.user?.id) {
            supabase
              .from("profiles")
              .update({ tutorial_visto: true })
              .eq("id", session.user.id)
              .then(() => {}, () => {});
          }
          setShowFirstTutorial(false);
        }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  // (07/10) a abertura agora é uma tela só, no index.html; quem tira ela do ar é o src/lib/abertura.ts
  return (
    <NotificationProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/cadastro" element={<Auth />} />
        <Route path="/termos" element={<Termos />} />
        <Route path="/privacidade" element={<Privacidade />} />
        {/* Rota pública do cardápio — nova estrutura: /c/[codigo]/[slug?] */}
        <Route path="/c/:codigo" element={<><FaixaComoCliente /><CardapioPublico /></>} />
        <Route path="/c/:codigo/:slug" element={<><FaixaComoCliente /><CardapioPublico /></>} />
        {/* Fallback: rota antiga /cardapio/:slug — mantida por compat, redireciona internamente */}
        <Route path="/cardapio/:slug" element={<CardapioPublico />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* outros nomes que um link antigo de e-mail pode usar (09/10 · 3.95): todos abrem a tela de criar a senha nova */}
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route path="/nova-senha" element={<ResetPassword />} />
        <Route path="/alterar-senha" element={<ResetPassword />} />
        {/* (21/10) a tela de confirmar e-mail saiu (o Doonly não pede confirmação): link antigo cai no login */}
        <Route path="/verificar-email" element={<Navigate to="/login" replace />} />

        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          {/* o "Dashboard" antigo saiu: o painel do Financeiro substitui */}
          <Route path="/dashboard" element={<Navigate to="/financeiro" replace />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:slug" element={<NoticiaDetalhe />} />
          <Route path="/assinar" element={<Assinar />} />
          {/* 13/10: Receitas escondida das confeiteiras até as fotos ficarem prontas (pra voltar: element={<ReceitasV2 />}) */}
          <Route path="/receitas" element={RECEITAS_ATIVAS ? <ReceitasV2 /> : <Navigate to="/inicio" replace />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/solicitar-recurso" element={<SolicitarRecurso />} />
          <Route path="/relatar-problema" element={<RelatarProblema />} />
          <Route path="/assistente-virtual" element={<AssistenteVirtual />} />
          <Route path="/conquistas" element={<Conquistas />} />
          <Route path="/minha-assinatura" element={<MinhaAssinatura />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/produtos/categorias" element={<Navigate to="/categorias" replace />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/pedidos/novo" element={<Navigate to="/vendas/novo" replace />} />
          <Route path="/vendas/novo" element={<NovaVenda />} />
          <Route path="/pedidos/:id/editar" element={<EditarPedido />} />
          {/* O formulário antigo (PedidoForm) usava status antigos: /pedidos/:id agora abre o detalhe na lista */}
          <Route path="/pedidos/:id" element={<PedidoVerRedirect />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/insumos" element={<Insumos />} />
          <Route path="/ficha-tecnica" element={<FichaTecnica />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cadastros" element={<Cadastros />} />
          <Route path="/complementos" element={<Complementos />} />
          <Route path="/clientes/:id" element={<ClientePerfil />} />
          <Route path="/financeiro" element={<Financeiro />} />
          {/* Passo 7: a Visão Geral virou o painel do Financeiro */}
          <Route path="/financeiro/visao-geral" element={<Navigate to="/financeiro" replace />} />
          <Route path="/financeiro/transacoes" element={<FinanceiroTransacoes />} />
          <Route path="/financeiro/a-receber" element={<FinanceiroAReceber />} />
          <Route path="/financeiro/a-pagar" element={<FinanceiroAPagar />} />
          <Route path="/custos" element={<Custos />} />
          <Route path="/lucratividade" element={<Lucratividade />} />
          <Route path="/promocoes" element={<Navigate to="/cardapio" replace />} />
          <Route path="/cardapio" element={<Cardapio />} />
          <Route path="/cardapio-config" element={<DadosLoja />} />
          <Route path="/cardapio-resumo" element={<CardapioResumo />} />
          <Route path="/cardapio-preview" element={<CardapioPrevia />} />
          <Route path="/cardapio-design" element={<CardapioDesign />} />
          <Route path="/checkout-config" element={<IrParaEntrega />} />
          <Route path="/estoque" element={<EmBreve tela="estoque" />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/arquivos" element={<Navigate to="/" replace />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/configuracoes/notificacoes" element={<NotificacoesSons />} />
          <Route path="/configuracoes/mensagens" element={<MensagensWhatsApp />} />
          <Route path="/indicar" element={INDICACAO_ATIVA ? <Indicar /> : <Navigate to="/inicio" replace />} />
          <Route path="/personalizacao" element={<Navigate to="/complementos" replace />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="usuarios" element={<AdminUsuarios />} />
          <Route path="receitas" element={<AdminReceitas />} />
          <Route path="receitas-doonly" element={<AdminReceitasDoonly />} />
          <Route path="pdfs" element={<AdminPDFs />} />
          <Route path="notificacoes" element={<AdminNotificacoes />} />
          <Route path="notif-templates" element={<AdminNotifTemplates />} />
          <Route path="banner" element={<AdminBanner />} />
          <Route path="banners-prontos" element={<AdminBannersProntos />} />
          <Route path="noticias" element={<AdminNoticias />} />
          <Route path="ideias" element={<AdminIdeias />} />
          <Route path="autores" element={<AdminAutores />} />
          <Route path="relatorios" element={<AdminRelatorios />} />
        </Route>

        <Route path="/" element={<NavigateWithSearch to="/inicio" replace />} />
        {/* (10/10) endereço que não existe: página própria (antes ia pro login, até pra quem estava logado).
            A raiz "/" com ?ref= continua na rota de cima. */}
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
      <SemInternet />
      <AbrirPelaNotificacao />
      <Analytics />
    </BrowserRouter>
    </NotificationProvider>
  );
}
