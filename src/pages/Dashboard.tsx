import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface DashboardData {
  pedidosConcluidos: number;
  pedidosPendentes: number;
  faturamento: number;
  totalEntradas: number;
  totalSaidas: number;
  estoqueBaixo: { nome: string; quantidade: number }[];
  aniversariantes: { nome: string; data_nascimento: string }[];
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
  };
  const [data, setData] = useState<DashboardData>({
    pedidosConcluidos: 0,
    pedidosPendentes: 0,
    faturamento: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    estoqueBaixo: [],
    aniversariantes: [],
  });
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Nome do usuário
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      if (profile?.nome) setNomeUsuario(profile.nome.split(" ")[0]);

      // Pedidos
      const { data: pedidos } = await supabase
        .from("pedidos")
        .select("status, valor_total")
        .eq("user_id", user.id);

      if (pedidos) {
        const concluidos = pedidos.filter(p => p.status === "concluido").length;
        const pendentes = pedidos.filter(p => ["novo", "em_preparo"].includes(p.status)).length;
        const faturamento = pedidos
          .filter(p => p.status === "concluido")
          .reduce((acc, p) => acc + (p.valor_total || 0), 0);
        setData(d => ({ ...d, pedidosConcluidos: concluidos, pedidosPendentes: pendentes, faturamento }));
      }

      // Financeiro
      const { data: financeiro } = await supabase
        .from("financeiro")
        .select("tipo, valor")
        .eq("user_id", user.id);

      if (financeiro) {
        const entradas = financeiro.filter(f => f.tipo === "entrada").reduce((acc, f) => acc + (f.valor || 0), 0);
        const saidas = financeiro.filter(f => f.tipo === "saida").reduce((acc, f) => acc + (f.valor || 0), 0);
        setData(d => ({ ...d, totalEntradas: entradas, totalSaidas: saidas }));
      }

      // Estoque baixo (menos de 5 unidades)
      const { data: estoque } = await supabase
        .from("produtos")
        .select("nome, estoque_quantidade")
        .eq("user_id", user.id)
        .lt("estoque_quantidade", 5)
        .not("estoque_quantidade", "is", null);

      if (estoque) {
        setData(d => ({ ...d, estoqueBaixo: estoque.map(e => ({ nome: e.nome, quantidade: e.estoque_quantidade })) }));
      }

      // Aniversariantes próximos (30 dias)
      const { data: clientes } = await supabase
        .from("clientes")
        .select("nome, data_nascimento")
        .eq("user_id", user.id)
        .not("data_nascimento", "is", null);

      if (clientes) {
        const hoje = new Date();
        const aniversariantes = clientes.filter(c => {
          const nasc = new Date(c.data_nascimento);
          const aniver = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
          if (aniver < hoje) aniver.setFullYear(hoje.getFullYear() + 1);
          const diff = (aniver.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
          return diff <= 30;
        }).sort((a, b) => {
          const hoje = new Date();
          const dA = new Date(a.data_nascimento);
          const dB = new Date(b.data_nascimento);
          const nextA = new Date(hoje.getFullYear(), dA.getMonth(), dA.getDate());
          const nextB = new Date(hoje.getFullYear(), dB.getMonth(), dB.getDate());
          if (nextA < hoje) nextA.setFullYear(hoje.getFullYear() + 1);
          if (nextB < hoje) nextB.setFullYear(hoje.getFullYear() + 1);
          return nextA.getTime() - nextB.getTime();
        });
        setData(d => ({ ...d, aniversariantes }));
      }

      setLoading(false);
    };
    load();
  }, []);

  const formatMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getDiasAniversario = (data_nascimento: string) => {
    const hoje = new Date();
    const nasc = new Date(data_nascimento);
    const aniver = new Date(hoje.getFullYear(), nasc.getMonth(), nasc.getDate());
    if (aniver < hoje) aniver.setFullYear(hoje.getFullYear() + 1);
    const diff = Math.ceil((aniver.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Hoje! 🎉";
    if (diff === 1) return "Amanhã";
    return `Em ${diff} dias`;
  };

  if (loading) return (
    <div className="dash-loading">
      <span className="spinner" />
    </div>
  );

  return (
    <div className="dash-root">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Olá, {nomeUsuario || "bem-vinda"} 👋</h1>
          <p className="dash-subtitle">Aqui está o resumo do seu negócio</p>
        </div>
      </div>

      {/* Banner instalar app */}
      {showInstallBanner && (
        <div className="install-banner">
          <div className="install-badge">Recomendado</div>
          <div className="install-content">
            <div className="install-icon">
              <img src="https://www.pandamenu.com.br/imagemmenu.png" alt="Panda Menu" />
            </div>
            <div className="install-text">
              <h3>INSTALE NOSSO APP</h3>
              <p>Todas as funcionalidades na palma da sua mão agora!</p>
            </div>
          </div>
          <button className="install-btn" onClick={handleInstall}>
            Instalar
          </button>
          <button className="install-close" onClick={() => setShowInstallBanner(false)}>✕</button>
        </div>
      )}

      {/* Cards principais */}
      <div className="dash-cards">
        <div className="dash-card card-pink" onClick={() => navigate("/pedidos")}>
          <div className="card-label">Pedidos Pendentes</div>
          <div className="card-value">{data.pedidosPendentes}</div>
          <div className="card-hint">aguardando ação</div>
        </div>

        <div className="dash-card card-green" onClick={() => navigate("/pedidos")}>
          <div className="card-label">Pedidos Concluídos</div>
          <div className="card-value">{data.pedidosConcluidos}</div>
          <div className="card-hint">este mês</div>
        </div>

        <div className="dash-card card-blue" onClick={() => navigate("/financeiro")}>
          <div className="card-label">Faturamento</div>
          <div className="card-value card-value-sm">{formatMoney(data.faturamento)}</div>
          <div className="card-hint">pedidos concluídos</div>
        </div>

        <div className="dash-card card-purple" onClick={() => navigate("/financeiro")}>
          <div className="card-label">Saldo</div>
          <div className={`card-value card-value-sm ${data.totalEntradas - data.totalSaidas < 0 ? "negative" : ""}`}>
            {formatMoney(data.totalEntradas - data.totalSaidas)}
          </div>
          <div className="card-hint">entradas - saídas</div>
        </div>
      </div>

      {/* Financeiro detalhado */}
      <div className="dash-row">
        <div className="dash-section">
          <div className="section-header">
            <h2>💰 Financeiro</h2>
            <button onClick={() => navigate("/financeiro")}>Ver tudo</button>
          </div>
          <div className="financeiro-row">
            <div className="financeiro-item entradas">
              <span className="fin-label">Entradas</span>
              <span className="fin-value">{formatMoney(data.totalEntradas)}</span>
            </div>
            <div className="financeiro-item saidas">
              <span className="fin-label">Saídas</span>
              <span className="fin-value">{formatMoney(data.totalSaidas)}</span>
            </div>
          </div>
        </div>

        {/* Estoque baixo */}
        <div className="dash-section">
          <div className="section-header">
            <h2>⚠️ Estoque Baixo</h2>
            <button onClick={() => navigate("/estoque")}>Ver tudo</button>
          </div>
          {data.estoqueBaixo.length === 0 ? (
            <p className="empty-msg">Nenhum produto com estoque baixo ✅</p>
          ) : (
            <div className="estoque-list">
              {data.estoqueBaixo.slice(0, 5).map((item, i) => (
                <div key={i} className="estoque-item">
                  <span className="estoque-nome">{item.nome}</span>
                  <span className="estoque-qtd">{item.quantidade} un.</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aniversariantes */}
      <div className="dash-section full">
        <div className="section-header">
          <h2>🎂 Aniversários Próximos</h2>
          <button onClick={() => navigate("/clientes")}>Ver clientes</button>
        </div>
        {data.aniversariantes.length === 0 ? (
          <p className="empty-msg">Nenhum aniversário nos próximos 30 dias</p>
        ) : (
          <div className="aniver-list">
            {data.aniversariantes.map((c, i) => (
              <div key={i} className="aniver-item">
                <div className="aniver-avatar">{c.nome.charAt(0).toUpperCase()}</div>
                <div className="aniver-info">
                  <span className="aniver-nome">{c.nome}</span>
                  <span className="aniver-data">
                    {new Date(c.data_nascimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                  </span>
                </div>
                <span className="aniver-dias">{getDiasAniversario(c.data_nascimento)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        .dash-root {
          font-family: 'Geist', sans-serif;
          max-width: 1000px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .dash-loading {
          display: flex; align-items: center; justify-content: center;
          height: 60vh;
        }

        .dash-header { margin-bottom: 0.5rem; }
        .dash-title { font-size: 1.6rem; font-weight: 600; color: #1f2937; margin-bottom: 0.2rem; }
        .dash-subtitle { font-size: 0.9rem; color: #9ca3af; }

        /* Cards */
        .dash-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .dash-card {
          background: white;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          border-top: 4px solid transparent;
        }
        .dash-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

        .card-pink { border-top-color: #f9007a; }
        .card-green { border-top-color: #10b981; }
        .card-blue { border-top-color: #3b82f6; }
        .card-purple { border-top-color: #8b5cf6; }

        .card-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; margin-bottom: 0.5rem; }
        .card-value { font-size: 2rem; font-weight: 700; color: #1f2937; line-height: 1; }
        .card-value-sm { font-size: 1.35rem; }
        .card-value.negative { color: #ef4444; }
        .card-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.35rem; }

        /* Row layout */
        .dash-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        /* Sections */
        .dash-section {
          background: white;
          border-radius: 14px;
          padding: 1.25rem 1.5rem;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        .dash-section.full { grid-column: 1 / -1; }

        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 1rem;
        }
        .section-header h2 { font-size: 0.95rem; font-weight: 600; color: #1f2937; }
        .section-header button {
          font-size: 0.8rem; color: #f9007a; background: none;
          border: none; cursor: pointer; font-family: 'Geist', sans-serif;
          font-weight: 500;
        }
        .section-header button:hover { opacity: 0.75; }

        .empty-msg { font-size: 0.85rem; color: #9ca3af; text-align: center; padding: 1rem 0; }

        /* Financeiro */
        .financeiro-row { display: flex; gap: 1rem; }
        .financeiro-item {
          flex: 1; padding: 0.85rem 1rem; border-radius: 10px;
          display: flex; flex-direction: column; gap: 0.25rem;
        }
        .entradas { background: #f0fdf4; }
        .saidas { background: #fff1f2; }
        .fin-label { font-size: 0.78rem; font-weight: 500; color: #6b7280; }
        .entradas .fin-value { color: #16a34a; font-weight: 700; font-size: 1.1rem; }
        .saidas .fin-value { color: #ef4444; font-weight: 700; font-size: 1.1rem; }

        /* Estoque */
        .estoque-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .estoque-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0.5rem 0.75rem; background: #fff7ed;
          border-radius: 8px; border-left: 3px solid #f97316;
        }
        .estoque-nome { font-size: 0.88rem; color: #1f2937; font-weight: 500; }
        .estoque-qtd { font-size: 0.82rem; color: #f97316; font-weight: 600; }

        /* Aniversariantes */
        .aniver-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .aniver-item {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.6rem 0.75rem; border-radius: 10px;
          background: #fff0f6; transition: background 0.15s;
        }
        .aniver-avatar {
          width: 36px; height: 36px; border-radius: 50%;
          background: linear-gradient(135deg, #f9007a, #d4006a);
          color: white; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 0.9rem; flex-shrink: 0;
        }
        .aniver-info { flex: 1; display: flex; flex-direction: column; }
        .aniver-nome { font-size: 0.9rem; font-weight: 600; color: #1f2937; }
        .aniver-data { font-size: 0.78rem; color: #9ca3af; }
        .aniver-dias { font-size: 0.8rem; font-weight: 600; color: #f9007a; white-space: nowrap; }

        /* Spinner */
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid #fce7f3;
          border-top-color: #f9007a; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Install Banner */
        .install-banner {
          position: relative;
          background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
          border-radius: 18px;
          padding: 1.5rem;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }

        .install-badge {
          position: absolute;
          top: 0; right: 0;
          background: linear-gradient(135deg, #f9007a, #ff6eb4);
          color: white;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.4rem 1.2rem;
          border-radius: 0 18px 0 18px;
          letter-spacing: 0.5px;
        }

        .install-content {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .install-icon {
          width: 64px; height: 64px;
          background: white;
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          padding: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .install-icon img {
          width: 100%; height: 100%;
          object-fit: contain;
        }

        .install-text h3 {
          font-size: 1.2rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: 0.5px;
          margin-bottom: 0.3rem;
        }

        .install-text p {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.7);
          line-height: 1.4;
        }

        .install-btn {
          width: 100%;
          padding: 0.9rem;
          background: linear-gradient(135deg, #f9c74f, #f8961e);
          color: #1a1a2e;
          border: none;
          border-radius: 12px;
          font-family: 'Geist', sans-serif;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          letter-spacing: 0.5px;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 16px rgba(248,150,30,0.4);
        }

        .install-btn:hover { opacity: 0.92; transform: translateY(-1px); }

        .install-close {
          position: absolute;
          top: 0.6rem; left: 0.75rem;
          background: rgba(255,255,255,0.1);
          border: none; color: white;
          width: 24px; height: 24px;
          border-radius: 50%;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .install-close:hover { background: rgba(255,255,255,0.2); }

        @media (max-width: 768px) {
          .dash-cards { grid-template-columns: repeat(2, 1fr); }
          .dash-row { grid-template-columns: 1fr; }
        }

        @media (max-width: 480px) {
          .dash-cards { grid-template-columns: repeat(2, 1fr); }
          .card-value { font-size: 1.5rem; }
          .card-value-sm { font-size: 1.1rem; }
        }
      `}</style>
    </div>
  );
}
