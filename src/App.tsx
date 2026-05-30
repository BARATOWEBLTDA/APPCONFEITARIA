import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Auth from "@/pages/Auth";
import EsqueciSenha from "@/pages/EsqueciSenha";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Inicio from "@/pages/Inicio";
import Configuracoes from "@/pages/Configuracoes";

// Páginas rascunho
const Produtos = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>🎂 Produtos</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Pedidos = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>📋 Pedidos</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
import Clientes from "@/pages/Clientes";
const Financeiro = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>💰 Financeiro</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Promocoes = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>🏷️ Promoções</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
import CardapioConfig from "@/pages/CardapioConfig";
const Estoque = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>📦 Estoque</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
const Receitas = () => <div style={{padding:"2rem",fontFamily:"DM Sans,sans-serif"}}><h2>📄 Receitas</h2><p style={{color:"#9ca3af",marginTop:"0.5rem"}}>Em breve...</p></div>;
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
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/cardapio-config" element={<CardapioConfig />} />
          <Route path="/estoque" element={<Estoque />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/arquivos" element={<Arquivos />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
