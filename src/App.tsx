import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import CompletarCadastro from "@/components/CompletarCadastro";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "@/lib/supabase";
import { NotificationProvider } from "@/context/NotificationContext";
import BoasVindas, { depoisDoVoltar } from "@/components/boasVindas/BoasVindas";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import ResetPassword from "@/pages/ResetPassword";
import VerificarEmail from "@/pages/VerificarEmail";
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
import Complementos from "@/pages/Complementos";
import ClientePerfil from "@/pages/ClientePerfil";
import CardapioDesign from "@/pages/CardapioDesign";
import CheckoutConfigPage from "@/pages/CheckoutConfigPage";
import DadosLoja from "@/pages/DadosLoja";
import CardapioPublico from "@/pages/CardapioPublico";
import Cardapio from "@/pages/Cardapio";
import Financeiro from "@/pages/Financeiro";
import FinanceiroTransacoes from "@/pages/FinanceiroTransacoes";
import FinanceiroAReceber from "@/pages/FinanceiroAReceber";
import FinanceiroAPagar from "@/pages/FinanceiroAPagar";
import Custos from "@/pages/Custos";
import EmBreve from "@/pages/EmBreve";
import Lucratividade from "@/pages/Lucratividade";
import FichaTecnica from "@/pages/FichaTecnica";



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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);
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

  // Entrou pelo Google e ainda falta o nome da confeitaria ou o WhatsApp: tela "Complete seu cadastro" (02/10)
  const [completar, setCompletar] = useState<null | { nome: string }>(null);
  // Login pelo Google: só mostra o app depois de conferir se falta completar o cadastro
  // (antes o Início aparecia por um instante e depois era trocado pela tela de cadastro)
  const [perfilConferido, setPerfilConferido] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Ao logar, sincroniza estado do tutorial com Supabase (fonte de verdade cross-device).
  // Se o banco diz "já viu", esconde o tutorial mesmo que o localStorage esteja vazio
  // (ex: usuário que trocou de device, browser anônimo, cache limpo).
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelado = false;
    // Internet muito lenta: depois de 4s abre o app mesmo assim (nunca fica numa tela vazia)
    const limite = setTimeout(() => { if (!cancelado) setPerfilConferido(true); }, 4000);
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("tutorial_visto, nome, nome_loja, telefone")
          .eq("id", session.user.id)
          .single();
        if (cancelado) return;
        const viaGoogle = session.user?.app_metadata?.provider === "google"
          || (session.user?.identities || []).some((i: any) => i?.provider === "google");
        const faltaDado = !String((data as any)?.nome_loja || "").trim() || String((data as any)?.telefone || "").replace(/\D/g, "").length < 10;
        if (viaGoogle && faltaDado) setCompletar({ nome: String((data as any)?.nome || "") });
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
    return () => { cancelado = true; clearTimeout(limite); };
  }, [session?.user?.id]);

  if (session === undefined) return null;
  if (!session) return <NavigateWithSearch to="/login" replace />;

  const entrouPeloGoogle = session.user?.app_metadata?.provider === "google"
    || (session.user?.identities || []).some((i: any) => i?.provider === "google");
  if (entrouPeloGoogle && !perfilConferido) {
    return <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #FCE7F3 0, #FAF7F8 240px)" }} aria-busy="true" />;
  }

  if (completar) {
    return <CompletarCadastro user={session.user} nomeInicial={completar.nome} onPronto={() => setCompletar(null)} />;
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
        <Route path="/c/:codigo" element={<CardapioPublico />} />
        <Route path="/c/:codigo/:slug" element={<CardapioPublico />} />
        {/* Fallback: rota antiga /cardapio/:slug — mantida por compat, redireciona internamente */}
        <Route path="/cardapio/:slug" element={<CardapioPublico />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verificar-email" element={<VerificarEmail />} />

        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          {/* o "Dashboard" antigo saiu: o painel do Financeiro substitui */}
          <Route path="/dashboard" element={<Navigate to="/financeiro" replace />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:slug" element={<NoticiaDetalhe />} />
          <Route path="/assinar" element={<Assinar />} />
          <Route path="/receitas" element={<ReceitasV2 />} />
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
          <Route path="/checkout-config" element={<CheckoutConfigPage />} />
          <Route path="/estoque" element={<EmBreve tela="estoque" />} />
          <Route path="/arquivos" element={<Navigate to="/" replace />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/configuracoes/notificacoes" element={<NotificacoesSons />} />
          <Route path="/configuracoes/mensagens" element={<MensagensWhatsApp />} />
          <Route path="/indicar" element={<Indicar />} />
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
          <Route path="noticias" element={<AdminNoticias />} />
          <Route path="ideias" element={<AdminIdeias />} />
          <Route path="autores" element={<AdminAutores />} />
          <Route path="relatorios" element={<AdminRelatorios />} />
        </Route>

        <Route path="/" element={<NavigateWithSearch to="/inicio" replace />} />
        <Route path="*" element={<NavigateWithSearch to="/login" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
    </NotificationProvider>
  );
}
