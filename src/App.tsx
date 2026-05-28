import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Auth from "@/pages/Auth";

// Páginas (serão criadas nas próximas etapas)
const Dashboard = () => <div>Dashboard — em breve</div>;
const Produtos = () => <div>Produtos — em breve</div>;
const Pedidos = () => <div>Pedidos — em breve</div>;
const Clientes = () => <div>Clientes — em breve</div>;
const Financeiro = () => <div>Financeiro — em breve</div>;
const Promocoes = () => <div>Promoções — em breve</div>;
const Cardapio = () => <div>Cardápio Público — em breve</div>;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null; // carregando
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<Auth />} />
        <Route path="/cardapio/:slug" element={<Cardapio />} />

        {/* Área de gestão (privada) */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/produtos" element={<PrivateRoute><Produtos /></PrivateRoute>} />
        <Route path="/pedidos" element={<PrivateRoute><Pedidos /></PrivateRoute>} />
        <Route path="/clientes" element={<PrivateRoute><Clientes /></PrivateRoute>} />
        <Route path="/financeiro" element={<PrivateRoute><Financeiro /></PrivateRoute>} />
        <Route path="/promocoes" element={<PrivateRoute><Promocoes /></PrivateRoute>} />

        {/* Redireciona raiz para login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}