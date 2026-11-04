import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { Users, Cake, Hourglass, CheckCircle, FilePdf, Medal, Play, Crown, Receipt, Storefront, UserPlus, Pulse } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import BoasVindas, { depoisDoVoltar } from "@/components/boasVindas/BoasVindas";

type Online = { id: string; nome: string; foto: string | null; visto: string; pro: boolean };
type Painel = {
  online_agora: number; ativas_hoje: number; ativas_7d: number; ativas_30d: number; contas: number; contas_7d: number; pro_ativas: number;
  pedidos_hoje: number; pedidos_7d: number; pedidos_30d: number; pedidos_cardapio_30d: number; online: Online[]; agora: string;
};
const num = (v: number | undefined) => (v ?? 0).toLocaleString("pt-BR");
const haQuanto = (iso: string, agora: string) => {
  const s = Math.max(0, (new Date(agora).getTime() - new Date(iso).getTime()) / 1000);
  return s < 60 ? "agora" : `há ${Math.round(s / 60)} min`;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ usuarios: 0, receitasComunidade: 0, receitasPendentes: 0, receitasAprovadas: 0, pdfs: 0, receitasDoonly: 0 });
  const [loading, setLoading] = useState(true);
  const [erroConteudo, setErroConteudo] = useState(false);
  // Testar as boas-vindas sem criar conta (09/10 · 3.69): abre a mesma apresentação de quem acabou de se cadastrar
  const navigate = useNavigate();
  const [boasVindas, setBoasVindas] = useState(false);
  const [nome, setNome] = useState("");
  const abrirBoasVindas = async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const md: { nome?: string; full_name?: string; name?: string } = data.user?.user_metadata || {};
      setNome(String(md.nome || md.full_name || md.name || "").trim().split(/\s+/)[0]);
    } catch { /* sem nome: a primeira tela fala só "você" */ }
    setBoasVindas(true);
  };

  // (03/11) ao vivo: quem está com o app aberto agora e os números da plataforma (atualiza sozinho a cada 20 s)
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erroPainel, setErroPainel] = useState("");
  const carregarPainel = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_painel");
    if (error) { setErroPainel("Não deu para carregar os números agora. Tentando de novo…"); return; }
    setErroPainel(""); setPainel(data as Painel);
  }, []);
  useEffect(() => {
    void carregarPainel();
    const t = setInterval(() => { if (document.visibilityState === "visible") void carregarPainel(); }, 20_000);
    const voltou = () => { if (document.visibilityState === "visible") void carregarPainel(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", voltou); };
  }, [carregarPainel]);

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
      if ([u, rc, rp, ra, pdfs, rd].some(r => r.error)) setErroConteudo(true);
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

  const n = (v: number, um: string, varios: string) => (v === 1 ? um : varios);
  const cards = [
    { label: n(stats.receitasComunidade, "Receita da comunidade", "Receitas da comunidade"), value: stats.receitasComunidade, icon: <Cake size={22} weight="bold" />, tom: "rosa" },
    { label: n(stats.receitasPendentes, "Receita pendente", "Receitas pendentes"), value: stats.receitasPendentes, icon: <Hourglass size={22} weight="bold" />, tom: "laranja" },
    { label: n(stats.receitasAprovadas, "Receita aprovada", "Receitas aprovadas"), value: stats.receitasAprovadas, icon: <CheckCircle size={22} weight="bold" />, tom: "verde" },
    { label: n(stats.pdfs, "PDF cadastrado", "PDFs cadastrados"), value: stats.pdfs, icon: <FilePdf size={22} weight="bold" />, tom: "neutro" },
    { label: n(stats.receitasDoonly, "Receita Doonly", "Receitas Doonly"), value: stats.receitasDoonly, icon: <Medal size={22} weight="bold" />, tom: "rosa" },
  ];

  return (
    <div className="ad-root">
      <h1 className="ad-h1">Painel</h1>
      <p className="ad-sub">Os números da plataforma Doonly.</p>

      <div className="ad-h2-linha">
        <h2 className="ad-h2">Agora</h2>
        <span className="ad-vivo"><i aria-hidden="true" />Atualiza sozinho</span>
      </div>
      {erroPainel && <p className="ad-erro" role="status">{erroPainel}</p>}
      <div className="ad-grid">
        <div className="ad-card ad-card--online">
          <span className="ad-ic ad-ic--verde" aria-hidden="true"><Pulse size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.online_agora) : "—"}</b><small>{painel?.online_agora === 1 ? "Usando o app agora" : "Usando o app agora"}</small></div>
        </div>
        <div className="ad-card"><span className="ad-ic ad-ic--rosa" aria-hidden="true"><Users size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.ativas_hoje) : "—"}</b><small>Entraram hoje</small></div></div>
        <div className="ad-card"><span className="ad-ic ad-ic--rosa" aria-hidden="true"><Users size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.ativas_7d) : "—"}</b><small>Entraram em 7 dias</small></div></div>
        <div className="ad-card"><span className="ad-ic ad-ic--rosa" aria-hidden="true"><Users size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.ativas_30d) : "—"}</b><small>Entraram em 30 dias</small></div></div>
      </div>

      <section className="ad-online" aria-label="Quem está usando o app agora">
        <p className="ad-online-t">Com o app aberto</p>
        {!painel ? <p className="ad-online-vazio">Carregando…</p>
          : painel.online.length === 0 ? <p className="ad-online-vazio">Ninguém com o app aberto agora.</p>
          : <ul>{painel.online.map(o => (
              <li key={o.id}>
                <span className="ad-av" aria-hidden="true">{o.foto ? <img src={o.foto} alt="" /> : o.nome.charAt(0).toUpperCase()}<i /></span>
                <b>{o.nome}</b>
                {o.pro && <span className="ad-pro"><Crown size={12} weight="fill" aria-hidden="true" /> PRO</span>}
                <small>{haQuanto(o.visto, painel.agora)}</small>
              </li>))}</ul>}
      </section>

      <h2 className="ad-h2">Negócio</h2>
      <div className="ad-grid">
        <div className="ad-card"><span className="ad-ic ad-ic--rosa" aria-hidden="true"><UserPlus size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.contas) : "—"}</b><small>Contas</small>{painel && <em>{painel.contas_7d === 1 ? "1 nova" : `${num(painel.contas_7d)} novas`} em 7 dias</em>}</div></div>
        <div className="ad-card"><span className="ad-ic ad-ic--vinho" aria-hidden="true"><Crown size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.pro_ativas) : "—"}</b><small>PRO ativas</small></div></div>
        <div className="ad-card"><span className="ad-ic ad-ic--laranja" aria-hidden="true"><Receipt size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.pedidos_hoje) : "—"}</b><small>Pedidos hoje</small>{painel && <em>{num(painel.pedidos_7d)} em 7 dias</em>}</div></div>
        <div className="ad-card"><span className="ad-ic ad-ic--verde" aria-hidden="true"><Storefront size={22} weight="bold" /></span>
          <div className="ad-tx"><b>{painel ? num(painel.pedidos_30d) : "—"}</b><small>Pedidos em 30 dias</small>{painel && <em>{num(painel.pedidos_cardapio_30d)} pelo cardápio</em>}</div></div>
      </div>

      <h2 className="ad-h2">Conteúdo</h2>
      {erroConteudo && <p className="ad-erro" role="status">Algum número abaixo não carregou e aparece como 0. Atualize a página.</p>}

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
          <small>Abre a apresentação de boas-vindas como uma conta nova vê.</small>
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
        .ad-h2 { margin: 28px 0 12px; font-size: 17px; font-weight: 600; color: var(--ui-texto); }
        .ad-h2-linha { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 24px 0 12px; }
        .ad-h2-linha .ad-h2 { margin: 0; }
        .ad-vivo { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-vivo i { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-verde); box-shadow: 0 0 0 0 rgba(22,163,74,.5); animation: adPulso 2s infinite; }
        @keyframes adPulso { 0% { box-shadow: 0 0 0 0 rgba(22,163,74,.45); } 70% { box-shadow: 0 0 0 8px rgba(22,163,74,0); } 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0); } }
        @media (prefers-reduced-motion: reduce) { .ad-vivo i { animation: none; } }
        .ad-ic--vinho { background: var(--ui-vinho); color: var(--ui-branco); }
        .ad-erro { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-laranja-fundo); color: var(--ui-laranja); font-size: 14px; font-weight: 500; }
        .ad-online { margin-top: 12px; padding: 14px 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ad-online-t { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--ui-texto); }
        .ad-online-vazio { margin: 0; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-online ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0 20px; }
        .ad-online li { display: flex; align-items: center; gap: 10px; min-height: 52px; border-top: 1px solid var(--ui-linha); min-width: 0; }
        .ad-online li b { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-online li small { flex: none; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-av { position: relative; flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-size: 14px; font-weight: 600; }
        .ad-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .ad-av i { position: absolute; right: -1px; bottom: -1px; width: 11px; height: 11px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-verde); }
        .ad-pro { flex: none; display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 6px; background: var(--ui-vinho); color: var(--ui-branco); font-size: 12px; font-weight: 600; }
        .ad-teste { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ad-teste .ad-tx { flex: 1; }
        .ad-teste .ad-teste-t { font-size: 15px; }
        .ad-teste small { line-height: 1.45; }
        @media (max-width: 599px) { .ad-teste { flex-wrap: wrap; } .ad-teste .ui-bt { width: 100%; } }
        .ad-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 1000px; }
        .ad-h1 { font-size: 22px; font-weight: 600; color: var(--ui-texto); margin: 0; }
        .ad-sub { font-size: 15px; font-weight: 500; color: var(--ui-texto-2); margin: 4px 0 20px; }
        .ad-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .ad-card { display: flex; align-items: center; gap: 14px; min-height: 84px; padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); }
        .ad-tx em { display: block; margin-top: 2px; font-size: 13px; font-style: normal; font-weight: 500; color: var(--ui-texto-3); }
        .ad-card--esq { background: var(--ui-cinza); box-shadow: none; }
        .ad-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: var(--ui-raio); }
        .ad-ic--rosa { background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .ad-ic--laranja { background: var(--ui-laranja-fundo); color: var(--ui-laranja); }
        .ad-ic--verde { background: var(--ui-verde-fundo); color: var(--ui-verde); }
        .ad-ic--neutro { background: var(--ui-cinza); color: var(--ui-cinza-texto); }
        .ad-tx { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .ad-tx b { font-size: 24px; font-weight: 600; line-height: 1.2; color: var(--ui-texto); }
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
