import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import CompletarCadastro from "@/components/CompletarCadastro";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "@/lib/supabase";
import { NotificationProvider } from "@/context/NotificationContext";
import { SplashScreen } from "@/components/SplashScreen";
import Onboarding from "@/components/Onboarding";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import ResetPassword from "@/pages/ResetPassword";
import VerificarEmail from "@/pages/VerificarEmail";
import Termos from "@/pages/Termos";
import Privacidade from "@/pages/Privacidade";
import Layout from "@/components/Layout";
import Pedidos from "@/pages/Pedidos";
import { useParams } from "react-router-dom";
function PedidoVerRedirect() { const { id } = useParams(); return <Navigate to={`/pedidos?ver=${id}`} replace />; }
import EditarPedido from "@/pages/EditarPedido";
import NovaVenda from "@/pages/NovaVenda";
import Dashboard from "@/pages/Dashboard";
import Inicio from "@/pages/Inicio";
import Noticias from "@/pages/Noticias";
import NoticiaDetalhe from "@/pages/NoticiaDetalhe";
import Agenda from "@/pages/Agenda";
import Insumos from "@/pages/Insumos";
import Assinar from "@/pages/Assinar";
import Receitas from "@/pages/Receitas";
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
import Indicar from "@/pages/Indicar";
import Personalizacao from "@/pages/Personalizacao";
import CardapioPrevia from "@/pages/CardapioPrevia";
import CardapioResumo from "@/pages/CardapioResumo";
import Produtos from "@/pages/Produtos";
import Categorias from "@/pages/Categorias";
import Clientes from "@/pages/Clientes";
import Complementos from "@/pages/Complementos";
import ClientePerfil from "@/pages/ClientePerfil";
import CardapioConfigPage from "@/pages/CardapioConfigPage";
import CardapioDesign from "@/pages/CardapioDesign";
import CheckoutConfigPage from "@/pages/CheckoutConfigPage";
import DadosLoja from "@/pages/DadosLoja";
import CardapioPublico from "@/pages/CardapioPublico";
import Cardapio from "@/pages/Cardapio";
import Financeiro from "@/pages/Financeiro";
import FinanceiroVisaoGeral from "@/pages/FinanceiroVisaoGeral";
import FinanceiroTransacoes from "@/pages/FinanceiroTransacoes";
import Custos from "@/pages/Custos";
import Lucratividade from "@/pages/Lucratividade";
import FichaTecnica from "@/pages/FichaTecnica";


const Promocoes = () => <div style={{padding:"2rem"}}><h2>🏷️ Promoções</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Estoque = () => <div style={{padding:"2rem"}}><h2>📦 Estoque</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Arquivos = () => <div style={{padding:"2rem"}}><h2>🗂️ Arquivos</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;

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

  // Decidido SÍNCRONO no primeiro render — evita o "app pisca antes do tutorial".
  // Se o usuário nunca viu o tutorial e nunca teve auto-abertura, mostramos o
  // Onboarding tela cheia — SÓ MOBILE. Desktop nunca abre.
  const [showFirstTutorial, setShowFirstTutorial] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches) return false;
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
      }
    })();
    return () => { cancelado = true; };
  }, [session?.user?.id]);

  if (session === undefined) return null;
  if (!session) return <NavigateWithSearch to="/login" replace />;

  if (completar) {
    return <CompletarCadastro user={session.user} nomeInicial={completar.nome} onPronto={() => setCompletar(null)} />;
  }

  if (showFirstTutorial) {
    return (
      <Onboarding
        isOpen={true}
        onClose={() => {
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
  const [showSplash, setShowSplash] = useState(() => {
    try {
      // Rotas públicas de cardápio nunca mostram splash — 
      // o visitante está indo direto pro cardápio da confeiteira, não pro app.
      const path = window.location.pathname;
      if (path.startsWith('/c/') || path.startsWith('/cardapio/')) return false;
      return !sessionStorage.getItem('doonly_splash_shown');
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showSplash) return;
    const timer = setTimeout(() => {
      setShowSplash(false);
      try { sessionStorage.setItem('doonly_splash_shown', '1'); } catch {}
    }, 3000);
    return () => clearTimeout(timer);
  }, [showSplash]);

  if (showSplash) {
    return <SplashScreen onDone={() => {
      setShowSplash(false);
      try { sessionStorage.setItem('doonly_splash_shown', '1'); } catch {}
    }} />;
  }

  return (
    <NotificationProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
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
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/noticias" element={<Noticias />} />
          <Route path="/noticias/:slug" element={<NoticiaDetalhe />} />
          <Route path="/assinar" element={<Assinar />} />
          <Route path="/receitas" element={<ReceitasV2 />} />
          <Route path="/receitas-antigas" element={<Receitas />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/solicitar-recurso" element={<SolicitarRecurso />} />
          <Route path="/relatar-problema" element={<RelatarProblema />} />
          <Route path="/assistente-virtual" element={<AssistenteVirtual />} />
          <Route path="/conquistas" element={<Conquistas />} />
          <Route path="/minha-assinatura" element={<MinhaAssinatura />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/produtos/categorias" element={<Produtos />} />
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
          <Route path="/financeiro/visao-geral" element={<FinanceiroVisaoGeral />} />
          <Route path="/financeiro/transacoes" element={<FinanceiroTransacoes />} />
          <Route path="/custos" element={<Custos />} />
          <Route path="/lucratividade" element={<Lucratividade />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/cardapio" element={<Cardapio />} />
          <Route path="/cardapio-config" element={<DadosLoja />} />
          <Route path="/cardapio-resumo" element={<CardapioResumo />} />
          <Route path="/cardapio-preview" element={<CardapioPrevia />} />
          <Route path="/cardapio-design" element={<CardapioDesign />} />
          <Route path="/checkout-config" element={<CheckoutConfigPage />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/arquivos" element={<Arquivos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/configuracoes/notificacoes" element={<NotificacoesSons />} />
          <Route path="/indicar" element={<Indicar />} />
          <Route path="/personalizacao" element={<Personalizacao />} />
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
