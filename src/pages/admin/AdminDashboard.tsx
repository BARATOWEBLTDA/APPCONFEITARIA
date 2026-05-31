import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usuarios: 0, receitasComunidade: 0, receitasPendentes: 0, receitasAprovadas: 0, pdfs: 0, receitasDoonly: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [u, rc, rp, ra, pdfs, rd] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("receitas_comunidade").select("*", { count: "exact", head: true }),
        supabase.from("receitas_comunidade").select("*", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("receitas_comunidade").select("*", { count: "exact", head: true }).eq("status", "aprovada"),
        supabase.from("biblioteca_pdf").select("*", { count: "exact", head: true }),
        supabase.from("receitas_doonly").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        usuarios: u.count || 0,
        receitasComunidade: rc.count || 0,
        receitasPendentes: rp.count || 0,
        receitasAprovadas: ra.count || 0,
        pdfs: pdfs.count || 0,
        receitasDoonly: rd.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Usuários cadastrados", value: stats.usuarios, icon: "👥", color: "#f9007a" },
    { label: "Receitas da comunidade", value: stats.receitasComunidade, icon: "👩‍🍳", color: "#8b5cf6" },
    { label: "Receitas pendentes", value: stats.receitasPendentes, icon: "⏳", color: "#f59e0b" },
    { label: "Receitas aprovadas", value: stats.receitasAprovadas, icon: "✅", color: "#10b981" },
    { label: "PDFs cadastrados", value: stats.pdfs, icon: "📄", color: "#3b82f6" },
    { label: "Receitas Doonly", value: stats.receitasDoonly, icon: "🏅", color: "#f9007a" },
  ];

  return (
    <div>
      <h1 className="adm-page-title">📊 Dashboard</h1>
      <p className="adm-page-sub">Visão geral da plataforma Doonly</p>

      {loading ? (
        <div className="adm-loading">Carregando...</div>
      ) : (
        <div className="adm-cards-grid">
          {cards.map(card => (
            <div key={card.label} className="adm-stat-card">
              <div className="adm-stat-icon" style={{ background: `${card.color}15`, color: card.color }}>{card.icon}</div>
              <div>
                <p className="adm-stat-num" style={{ color: card.color }}>{card.value}</p>
                <p className="adm-stat-label">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .adm-page-title { font-size: 1.5rem; font-weight: 700; color: #1f2937; margin: 0 0 0.25rem; }
        .adm-page-sub { font-size: 0.88rem; color: #9ca3af; margin: 0 0 1.5rem; }
        .adm-loading { color: #9ca3af; padding: 2rem; }
        .adm-cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .adm-stat-card { background: white; border-radius: 14px; padding: 1.25rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .adm-stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
        .adm-stat-num { font-size: 1.6rem; font-weight: 800; margin: 0; }
        .adm-stat-label { font-size: 0.78rem; color: #6b7280; margin: 0; font-weight: 500; }
      `}</style>
    </div>
  );
}
