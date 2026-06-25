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

  const [data, setData] = useState<DashboardData>({
    pedidosConcluidos: 0, pedidosPendentes: 0, faturamento: 0,
    totalEntradas: 0, totalSaidas: 0, estoqueBaixo: [], aniversariantes: [],
  });
  const [loading, setLoading] = useState(true);
  const [nomeUsuario, setNomeUsuario] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase.from("profiles").select("nome").eq("id", user.id).single();
      if (profile?.nome) setNomeUsuario(profile.nome.split(" ")[0]);

      const { data: pedidos } = await supabase.from("pedidos").select("status, valor_total").eq("user_id", user.id);
      if (pedidos) {
        const concluidos = pedidos.filter(p => p.status === "concluido").length;
        const pendentes = pedidos.filter(p => ["novo", "em_preparo"].includes(p.status)).length;
        const faturamento = pedidos.filter(p => p.status === "concluido").reduce((acc, p) => acc + (p.valor_total || 0), 0);
        setData(d => ({ ...d, pedidosConcluidos: concluidos, pedidosPendentes: pendentes, faturamento }));
      }

      const { data: financeiro } = await supabase.from("financeiro").select("tipo, valor").eq("user_id", user.id);
      if (financeiro) {
        const entradas = financeiro.filter(f => f.tipo === "entrada").reduce((acc, f) => acc + (f.valor || 0), 0);
        const saidas = financeiro.filter(f => f.tipo === "saida").reduce((acc, f) => acc + (f.valor || 0), 0);
        setData(d => ({ ...d, totalEntradas: entradas, totalSaidas: saidas }));
      }

      const { data: estoque } = await supabase.from("produtos").select("nome, estoque_quantidade").eq("user_id", user.id).lt("estoque_quantidade", 5).not("estoque_quantidade", "is", null);
      if (estoque) {
        setData(d => ({ ...d, estoqueBaixo: estoque.map(e => ({ nome: e.nome, quantidade: e.estoque_quantidade })) }));
      }

      const { data: clientes } = await supabase.from("clientes").select("nome, data_nascimento").eq("user_id", user.id).not("data_nascimento", "is", null);
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
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Olá, {nomeUsuario || "bem-vinda"} 👋</h1>
          <p className="dash-subtitle">Aqui está o resumo do seu negócio</p>
        </div>
      </div>

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

        .dash-root { font-family: 'Geist', sans-serif; max-width: 1000px; display: flex; flex-direction: column; gap: 1.5rem; }
        .dash-loading { display: flex; align-items: center; justify-content: center; height: 60vh; }
        .dash-header { margin-bottom: 0.5rem; }
        .dash-title { font-size: var(--text-2xl); font-weight: var(--fw-semibold); color: var(--text-title); margin-bottom: 0.2rem; }
        .dash-subtitle { font-size: var(--font-button); color: var(--text-muted); }

        .dash-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
        .dash-card { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.05)); border-top: 4px solid transparent; }
        .dash-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.1); }

        .card-pink   { border-top-color: var(--primary); }
        .card-green  { border-top-color: var(--success); }
        .card-blue   { border-top-color: var(--info); }
        .card-purple { border-top-color: #8b5cf6; }

        .card-label { font-size: var(--font-helper); color: var(--text-secondary); font-weight: var(--fw-medium); margin-bottom: 0.5rem; }
        .card-value { font-size: var(--text-3xl); font-weight: var(--fw-bold); color: var(--text-title); line-height: 1; }
        .card-value-sm { font-size: var(--font-page-title); }
        .card-value.negative { color: var(--error); }
        .card-hint { font-size: var(--font-helper); color: var(--text-muted); margin-top: 0.35rem; }

        .dash-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .dash-section { background: var(--bg-card); border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.05)); }
        .dash-section.full { grid-column: 1 / -1; }

        .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .section-header h2 { font-size: var(--font-input); font-weight: var(--fw-semibold); color: var(--text-title); }
        .section-header button { font-size: var(--font-helper); color: var(--primary); background: none; border: none; cursor: pointer; font-family: 'Geist', sans-serif; font-weight: var(--fw-medium); }
        .section-header button:hover { opacity: 0.75; }

        .empty-msg { font-size: var(--font-button); color: var(--text-muted); text-align: center; padding: 1rem 0; }

        .financeiro-row { display: flex; gap: 1rem; }
        .financeiro-item { flex: 1; padding: 0.85rem 1rem; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 0.25rem; }
        .entradas { background: #f0fdf4; }
        .saidas { background: #fff1f2; }
        .fin-label { font-size: var(--font-helper); font-weight: var(--fw-medium); color: var(--text-secondary); }
        .entradas .fin-value { color: var(--success); font-weight: var(--fw-bold); font-size: var(--font-modal-title); }
        .saidas .fin-value { color: var(--error); font-weight: var(--fw-bold); font-size: var(--font-modal-title); }

        .estoque-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .estoque-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: #fff7ed; border-radius: var(--radius-sm); border-left: 3px solid var(--warning); }
        .estoque-nome { font-size: var(--font-button); color: var(--text-title); font-weight: var(--fw-medium); }
        .estoque-qtd { font-size: var(--font-helper); color: var(--warning); font-weight: var(--fw-semibold); }

        .aniver-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .aniver-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: var(--radius-md); background: var(--primary-light); transition: background 0.15s; }
        .aniver-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--primary-gradient); color: var(--text-inverse); display: flex; align-items: center; justify-content: center; font-weight: var(--fw-bold); font-size: var(--font-button); flex-shrink: 0; }
        .aniver-info { flex: 1; display: flex; flex-direction: column; }
        .aniver-nome { font-size: var(--font-button); font-weight: var(--fw-semibold); color: var(--text-title); }
        .aniver-data { font-size: var(--font-helper); color: var(--text-muted); }
        .aniver-dias { font-size: var(--font-helper); font-weight: var(--fw-semibold); color: var(--primary); white-space: nowrap; }

        .spinner { width: 32px; height: 32px; border: 3px solid var(--primary-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) { .dash-cards { grid-template-columns: repeat(2, 1fr); } .dash-row { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .dash-cards { grid-template-columns: repeat(2, 1fr); } .card-value { font-size: var(--text-xl); } .card-value-sm { font-size: var(--font-modal-title); } }
      `}</style>
    </div>
  );
}
