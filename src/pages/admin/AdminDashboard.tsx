import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Users, Cake, Hourglass, CheckCircle, FilePdf, Medal, Play } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import BoasVindas, { depoisDoVoltar } from "@/components/boasVindas/BoasVindas";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usuarios: 0, receitasComunidade: 0, receitasPendentes: 0, receitasAprovadas: 0, pdfs: 0, receitasDoonly: 0 });
  const [loading, setLoading] = useState(true);
  // Testar as boas-vindas sem criar conta (09/10 · 3.69): abre a mesma apresentação de quem acabou de se cadastrar
  const navigate = useNavigate();
  const [boasVindas, setBoasVindas] = useState(false);
  const [nome, setNome] = useState("");
  const abrirBoasVindas = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const md: any = data.user?.user_metadata || {};
      setNome(String(md.nome || md.full_name || md.name || "").trim().split(/\s+/)[0]);
    } catch { /* sem nome: a primeira tela fala só "você" */ }
    setBoasVindas(true);
  };

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
    { label: "Usuários cadastrados", value: stats.usuarios, icon: <Users size={22} weight="bold" />, tom: "rosa" },
    { label: "Receitas da comunidade", value: stats.receitasComunidade, icon: <Cake size={22} weight="bold" />, tom: "rosa" },
    { label: "Receitas pendentes", value: stats.receitasPendentes, icon: <Hourglass size={22} weight="bold" />, tom: "laranja" },
    { label: "Receitas aprovadas", value: stats.receitasAprovadas, icon: <CheckCircle size={22} weight="bold" />, tom: "verde" },
    { label: "PDFs cadastrados", value: stats.pdfs, icon: <FilePdf size={22} weight="bold" />, tom: "neutro" },
    { label: "Receitas Doonly", value: stats.receitasDoonly, icon: <Medal size={22} weight="bold" />, tom: "rosa" },
  ];

  return (
    <div className="ad-root">
      <h1 className="ad-h1">Dashboard</h1>
      <p className="ad-sub">Os números da plataforma Doonly.</p>

      {loading ? (
        <div className="ad-grid" aria-busy="true">
          {cards.map(c => <div key={c.label} className="ad-card ad-card--esq" />)}
        </div>
      ) : (
        <div className="ad-grid">
          {cards.map(card => (
            <div key={card.label} className="ad-card">
              <span className={`ad-ic ad-ic--${card.tom}`} aria-hidden="true">{card.icon}</span>
              <div className="ad-tx">
                <b>{card.value.toLocaleString("pt-BR")}</b>
                <small>{card.label}</small>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="ad-h2">Testes</h2>
      <div className="ad-teste">
        <span className="ad-ic ad-ic--rosa" aria-hidden="true"><Play size={22} weight="bold" /></span>
        <div className="ad-tx">
          <b className="ad-teste-t">Boas-vindas</b>
          <small>A apresentação que aparece depois de criar a conta. No fim, "Configurar minha confeitaria" leva ao Início, como pra quem acabou de entrar.</small>
        </div>
        <Botao onClick={abrirBoasVindas}>Ver as boas-vindas</Botao>
      </div>

      <BoasVindas isOpen={boasVindas} nome={nome} onClose={(_tela, configurar) => {
        setBoasVindas(false);
        if (configurar) {
          try { sessionStorage.setItem("doonly_pp_destacar", "1"); } catch { /* sem storage: só não destaca */ }
          depoisDoVoltar(() => navigate("/inicio"));
        }
      }} />

      <style>{`
        .ad-h2 { margin: 28px 0 12px; font-size: 17px; font-weight: 700; color: var(--ui-texto); }
        .ad-teste { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ad-teste .ad-tx { flex: 1; }
        .ad-teste .ad-teste-t { font-size: 15px; }
        .ad-teste small { line-height: 1.45; }
        @media (max-width: 599px) { .ad-teste { flex-wrap: wrap; } .ad-teste .ui-bt { width: 100%; } }
        .ad-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 1000px; }
        .ad-h1 { font-size: 22px; font-weight: 700; color: var(--ui-texto); margin: 0; }
        .ad-sub { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); margin: 4px 0 20px; }
        .ad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .ad-card { display: flex; align-items: center; gap: 14px; min-height: 84px; padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ad-card--esq { background: var(--ui-cinza); box-shadow: none; }
        .ad-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: var(--ui-raio); }
        .ad-ic--rosa { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .ad-ic--laranja { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .ad-ic--verde { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .ad-ic--neutro { background: var(--ui-cinza); color: var(--ui-cinza-texto); }
        .ad-tx { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ad-tx b { font-size: 24px; font-weight: 700; line-height: 1.2; color: var(--ui-texto); }
        .ad-tx small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        @media (max-width: 599px) {
          .ad-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .ad-card { flex-direction: column; align-items: flex-start; gap: 10px; padding: 14px; }
          .ad-ic { width: 40px; height: 40px; }
          .ad-tx b { font-size: 22px; }
        }
      `}</style>
    </div>
  );
}
