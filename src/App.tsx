import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Inicio from "@/pages/Inicio";
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

// Páginas rascunho
import Produtos from "@/pages/Produtos";
const Pedidos = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>📋 Pedidos</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
import Clientes from "@/pages/Clientes";
const Financeiro = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>💰 Financeiro</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Promocoes = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>🏷️ Promoções</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
import CardapioConfigPage from "@/pages/CardapioConfigPage";
import CardapioDesign from "@/pages/CardapioDesign";
const Estoque = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>📦 Estoque</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;

const Arquivos = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>🗂️ Arquivos</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
import CardapioPublico from "@/pages/CardapioPublico";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/cardapio/:slug" element={<CardapioPublico />} />
        <Route path="/esqueci-senha" element={<EsqueciSenha />} />

        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inicio" element={<Inicio />} />
          <Route path="/assinar" element={<Assinar />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/notificacoes" element={<Notificacoes />} />

          <Route path="/produtos" element={<Produtos />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/cardapio-config" element={<CardapioConfigPage />} />
          <Route path="/cardapio-preview" element={<CardapioPrevia />} />
          <Route path="/cardapio-design" element={<CardapioDesign />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/notificacoes" element={<Notificacoes />} />
          <Route path="/arquivos" element={<Arquivos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
          <Route path="/personalizacao" element={<Personalizacao />} />
        </Route>

        {/* Admin - fora do PrivateRoute */}
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
    </BrowserRouter>
  );
}
