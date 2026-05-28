import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Auth from "@/pages/Auth";
import Layout from "@/components/Layout";

// Páginas temporárias
const Dashboard = () => <div style={{padding:"2rem"}}><h1>Dashboard</h1></div>;
const Produtos = () => <div style={{padding:"2rem"}}><h1>Produtos</h1></div>;
const Pedidos = () => <div style={{padding:"2rem"}}><h1>Pedidos</h1></div>;
const Clientes = () => <div style={{padding:"2rem"}}><h1>Clientes</h1></div>;
const Financeiro = () => <div style={{padding:"2rem"}}><h1>Financeiro</h1></div>;
const Promocoes = () => <div style={{padding:"2rem"}}><h1>Promoções</h1></div>;
const CardapioConfig = () => <div style={{padding:"2rem"}}><h1>Cardápio</h1></div>;
const Configuracoes = () => <div style={{padding:"2rem"}}><h1>Configurações</h1></div>;
const CardapioPublico = () => <div style={{padding:"2rem"}}><h1>Cardápio Público</h1></div>;

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
        {/* Pública */}
        <Route path="/login" element={<Auth />} />
        <Route path="/cardapio/:slug" element={<CardapioPublico />} />

        {/* Área privada com layout */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/promocoes" element={<Promocoes />} />
          <Route path="/cardapio-config" element={<CardapioConfig />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
