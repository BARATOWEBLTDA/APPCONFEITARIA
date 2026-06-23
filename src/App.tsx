import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "@/lib/supabase";
import { NotificationProvider } from "@/context/NotificationContext";
import { SplashScreen } from "@/components/SplashScreen";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import ResetPassword from "@/pages/ResetPassword";
import Termos from "@/pages/Termos";
import Privacidade from "@/pages/Privacidade";
import Layout from "@/components/Layout";
import Pedidos from "@/pages/Pedidos";
import PedidoForm from "@/pages/PedidoForm";
import Dashboard from "@/pages/Dashboard";
import Inicio from "@/pages/Inicio";
import Agenda from "@/pages/Agenda";
import Insumos from "@/pages/Insumos";
import Assinar from "@/pages/Assinar";
import Receitas from "@/pages/Receitas";
import Notificacoes from "@/pages/Notificacoes";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsuarios from "@/pages/admin/AdminUsuarios";
import AdminReceitas from "@/pages/admin/AdminReceitas";
import AdminReceitasDoonly from "@/pages/admin/AdminReceitasDoonly";
import AdminPDFs from "@/pages/admin/AdminPDFs";
import AdminNotificacoes from "@/pages/admin/AdminNotificacoes";
import AdminRelatorios from "@/pages/admin/AdminRelatorios";
import Configuracoes from "@/pages/Configuracoes";
import Personalizacao from "@/pages/Personalizacao";
import CardapioPrevia from "@/pages/CardapioPrevia";
import CardapioResumo from "@/pages/CardapioResumo";
import Produtos from "@/pages/Produtos";
import Categorias from "@/pages/Categorias";
import Clientes from "@/pages/Clientes";
import CardapioConfigPage from "@/pages/CardapioConfigPage";
import CardapioDesign from "@/pages/CardapioDesign";
import CheckoutConfigPage from "@/pages/CheckoutConfigPage";
import CardapioPublico from "@/pages/CardapioPublico";
import Financeiro from "@/pages/Financeiro";


const Promocoes = () => <div style={{padding:"2rem"}}><h2>🏷️ Promoções</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Estoque = () => <div style={{padding:"2rem"}}><h2>📦 Estoque</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Arquivos = () => <div style={{padding:"2rem"}}><h2>🗂️ Arquivos</h2><p style={{color:"var(--text-muted)",marginTop:"0.5rem"}}>Em breve...</p></div>;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => listener.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
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
        <Route path="/cardapio/:slug" element={<CardapioPublico />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/assinar" element={<Assinar />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/pedidos/novo" element={<PedidoForm />} />
          <Route path="/pedidos/:id" element={<PedidoForm />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/insumos" element={<Insumos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/cardapio-config" element={<CardapioConfigPage />} />
          <Route path="/cardapio-resumo" element={<CardapioResumo />} />
          <Route path="/cardapio-preview" element={<CardapioPrevia />} />
          <Route path="/cardapio-design" element={<CardapioDesign />} />
          <Route path="/checkout-config" element={<CheckoutConfigPage />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/arquivos" element={<Arquivos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
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
          <Route path="relatorios" element={<AdminRelatorios />} />
        </Route>

        <Route path="/" element={<Navigate to="/inicio" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
    </NotificationProvider>
  );
}
