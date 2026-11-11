// ── AdminDashboard.tsx ───────────────────────────────────────────────────────
// (03/11 · 6.18) Painel do admin no mesmo jeito do Início da confeiteira: "Boa noite,
// Bruno", o topo rosa com o mascote e quem está usando o app agora, os números
// com a comparação, o gráfico dos últimos 14 dias e o Acesso rápido.
// Tudo vem da função admin_painel (só o admin lê) e atualiza sozinho a cada 20 s.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  Receipt, Storefront, UserPlus, Crown, UsersThree, Lightbulb, Newspaper, Image as ImageIcon, Images, PenNib, ArrowRight, CaretRight,
} from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import { Mascote } from "@/components/marca/Mascote";
import PainelLoja from "./PainelLoja";
import { LinhaRegistro, usePerfisAdmin, CSS_REGISTRO, type Registro } from "./AdminRegistro";
import { perfilAtual, EVENTO_PERFIL, EVENTO_REGISTRO } from "@/lib/adminPerfil";

type Online = { id: string; nome: string; foto: string | null; visto: string; pro: boolean };
type Dia = { dia: string; pedidos: number; contas: number };
type Painel = {
  online_agora: number; ativas_hoje: number; ativas_7d: number; ativas_30d: number;
  contas: number; contas_hoje: number; contas_7d: number; contas_7d_ant: number; pro_ativas: number;
  pedidos_hoje: number; pedidos_ontem: number; pedidos_7d: number; pedidos_30d: number; pedidos_30d_ant: number; pedidos_cardapio_30d: number;
  por_dia: Dia[]; ideias_novas: number; online: Online[]; agora: string;
};

const num = (v: number | undefined) => (v ?? 0).toLocaleString("pt-BR");
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
const SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "▲ 12% vs ontem" · "▼ 8%" · "Igual a …" · sem base: "Sem dados para comparar" */
function Compara({ agora, antes, rotulo }: { agora: number; antes: number; rotulo: string }) {
  if (!antes) return <span className="ad-cmp">Sem comparação ainda</span>;
  const d = Math.round(((agora - antes) / antes) * 100);
  if (d === 0) return <span className="ad-cmp">Igual {rotulo.replace(/^vs /, "a ")}</span>;
  return <span className={`ad-cmp ${d > 0 ? "ad-cmp--sobe" : "ad-cmp--desce"}`}><b>{d > 0 ? "▲" : "▼"} {Math.abs(d)}%</b> {rotulo}</span>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [lojaAberta, setLojaAberta] = useState<string | null>(null);
  const [serie, setSerie] = useState<"pedidos" | "contas">("pedidos");

  // (04/11) a saudação é de quem escolheu o perfil ao entrar (Anthony, Bruno ou Marcos)
  const [meuNome, setMeuNome] = useState(() => perfilAtual()?.nome || "");
  useEffect(() => {
    const mudou = () => setMeuNome(perfilAtual()?.nome || "");
    window.addEventListener(EVENTO_PERFIL, mudou);
    return () => window.removeEventListener(EVENTO_PERFIL, mudou);
  }, []);

  // últimas atividades dos admins (o Registro completo fica em /admin/registro)
  const { perfis } = usePerfisAdmin();
  const [ultimos, setUltimos] = useState<Registro[] | null>(null);
  const carregarUltimos = useCallback(async () => {
    const { data } = await supabase.from("admin_log").select("id, perfil_id, perfil_nome, acao, tipo, created_at").order("created_at", { ascending: false }).limit(5);
    setUltimos((data as Registro[]) || []);
  }, []);
  useEffect(() => {
    void carregarUltimos();
    window.addEventListener(EVENTO_REGISTRO, carregarUltimos);
    return () => window.removeEventListener(EVENTO_REGISTRO, carregarUltimos);
  }, [carregarUltimos]);

  // ao vivo: atualiza sozinho a cada 20 s e quando volta pra aba
  const [painel, setPainel] = useState<Painel | null>(null);
  const [erroPainel, setErroPainel] = useState("");
  const carregarPainel = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_painel");
    if (error) { setErroPainel("Não deu para carregar os números agora. Tentando de novo…"); return; }
    setErroPainel(""); setPainel(data as Painel);
  }, []);
  useEffect(() => {
    void carregarPainel();
    const t = setInterval(() => { if (document.visibilityState === "visible") { void carregarPainel(); void carregarUltimos(); } }, 20_000);
    const voltou = () => { if (document.visibilityState === "visible") void carregarPainel(); };
    document.addEventListener("visibilitychange", voltou);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", voltou); };
  }, [carregarPainel, carregarUltimos]);

  const p = painel;
  const agora = p ? new Date(p.agora) : new Date();
  const h = agora.getHours();
  const saudacao = `${h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"}${meuNome ? `, ${meuNome}` : ""}`;
  const dataHoje = `${SEMANA[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()]}`;

  const dias = p?.por_dia || [];
  const valores = dias.map(d => (serie === "pedidos" ? d.pedidos : d.contas));
  const maxDia = Math.max(1, ...valores);
  const totalDias = valores.reduce((a, b) => a + b, 0);
  const extras = p ? Math.max(0, p.online_agora - p.online.length) : 0;


  return (
    <div className="ad-root">
      <header className="ad-cab">
        <h1 className="ad-h1">{saudacao}</h1>
        <p className="ad-sub">{dataHoje}<i className="ad-so-pc" aria-hidden="true">·</i><span className="ad-vivo ad-so-pc"><b aria-hidden="true" />{p ? `${num(p.online_agora)} ${p.online_agora === 1 ? "confeiteira usando" : "confeiteiras usando"} agora` : "Ao vivo"}</span></p>
      </header>
      {erroPainel && <p className="ad-erro" role="status">{erroPainel}</p>}

      {/* ── Topo rosa: quem está no app agora ── */}
      <section className="ad-hero" aria-label="Quem está usando o app agora">
        <div className="ad-hero-tx">
          <span className="ad-chip"><b aria-hidden="true" />Ao vivo</span>
          <p className="ad-hero-n">{p ? num(p.online_agora) : "—"}</p>
          <p className="ad-hero-t">{p?.online_agora === 1 ? "confeiteira com o Doonly aberto agora" : "confeiteiras com o Doonly aberto agora"}</p>
          {p && p.online.length > 0 ? (
            <div className="ad-pilha">
              {p.online.map(o => (
                <button key={o.id} type="button" className="ad-pilha-av" title={`${o.nome}${o.pro ? " · PRO" : ""}`} aria-label={`Ver ${o.nome}`} onClick={() => setLojaAberta(o.id)}>
                  {o.foto ? <img src={o.foto} alt="" /> : <span>{o.nome.charAt(0).toUpperCase()}</span>}
                  {o.pro && <i aria-hidden="true"><Crown size={10} weight="fill" /></i>}
                </button>
              ))}
              {extras > 0 && <span className="ad-pilha-mais">+{num(extras)}</span>}
            </div>
          ) : p ? <p className="ad-hero-vazio">Ninguém com o app aberto neste minuto.</p> : null}
          {p && p.online_agora > 0 && (
            <Botao icone={<ArrowRight size={18} weight="bold" />} onClick={() => navigate("/admin/usuarios?ver=online")}>Ver quem está online</Botao>
          )}
        </div>
        <Mascote pose="acenando" className="ad-hero-masc" />
        <div className="ad-hero-pe">
          <div><b>{p ? num(p.ativas_hoje) : "—"}</b><small>entraram hoje</small></div>
          <div><b>{p ? num(p.ativas_7d) : "—"}</b><small>em 7 dias</small></div>
          <div><b>{p ? num(p.ativas_30d) : "—"}</b><small>em 30 dias</small></div>
        </div>
      </section>

      {/* ── Números, no mesmo formato do Início ── */}
      <div className="ad-nums">
        <div className="ad-num">
          <span className="ad-num-t"><i className="ad-ic ad-ic--rosa" aria-hidden="true"><Receipt size={18} weight="bold" /></i>Pedidos hoje</span>
          <b>{p ? num(p.pedidos_hoje) : "—"}</b>
          <small>{p ? `${num(p.pedidos_7d)} nos últimos 7 dias` : " "}</small>
          {p && <Compara agora={p.pedidos_hoje} antes={p.pedidos_ontem} rotulo="vs ontem até agora" />}
        </div>
        <div className="ad-num">
          <span className="ad-num-t"><i className="ad-ic ad-ic--rosa" aria-hidden="true"><Storefront size={18} weight="bold" /></i><span>Pedidos<span className="ad-so-pc"> em</span> 30 dias</span></span>
          <b>{p ? num(p.pedidos_30d) : "—"}</b>
          <small>{p ? `${pct(p.pedidos_cardapio_30d, p.pedidos_30d)}% pelo cardápio` : " "}</small>
          {p && <Compara agora={p.pedidos_30d} antes={p.pedidos_30d_ant} rotulo="vs 30 dias antes" />}
        </div>
        <div className="ad-num">
          <span className="ad-num-t"><i className="ad-ic ad-ic--rosa" aria-hidden="true"><UserPlus size={18} weight="bold" /></i>Contas novas</span>
          <b>{p ? num(p.contas_7d) : "—"}</b>
          <small>{p ? `em 7 dias · ${num(p.contas_hoje)} hoje` : " "}</small>
          {p && <Compara agora={p.contas_7d} antes={p.contas_7d_ant} rotulo="vs 7 dias antes" />}
        </div>
        <div className="ad-num">
          <span className="ad-num-t"><i className="ad-ic ad-ic--vinho" aria-hidden="true"><Crown size={18} weight="fill" /></i>PRO ativas</span>
          <b>{p ? num(p.pro_ativas) : "—"}</b>
          <small>{p ? `de ${num(p.contas)} contas` : " "}</small>
          {p && <span className="ad-cmp"><b className="ad-cmp-pro">{pct(p.pro_ativas, p.contas)}%</b> das contas são PRO</span>}
        </div>
      </div>

      <div className="ad-dupla">
        {/* ── Gráfico dos últimos 14 dias ── */}
        <section className="ad-box ad-graf" aria-label="Últimos 14 dias">
          <div className="ad-box-cab">
            <div>
              <h2 className="ad-h2">Últimos 14 dias</h2>
              <small className="ad-box-sub">{num(totalDias)} {serie === "pedidos" ? (totalDias === 1 ? "pedido" : "pedidos") : (totalDias === 1 ? "conta nova" : "contas novas")} no período</small>
            </div>
            <div className="ad-tabs" role="tablist" aria-label="O que mostrar">
              <button type="button" role="tab" aria-selected={serie === "pedidos"} className={serie === "pedidos" ? "on" : ""} onClick={() => setSerie("pedidos")}>Pedidos</button>
              <button type="button" role="tab" aria-selected={serie === "contas"} className={serie === "contas" ? "on" : ""} onClick={() => setSerie("contas")}>Contas novas</button>
            </div>
          </div>
          <div className="ad-barras" role="img" aria-label={dias.map((d, i) => `${d.dia.slice(8)}/${d.dia.slice(5, 7)}: ${valores[i]}`).join(", ")}>
            {dias.map((d, i) => {
              const hoje = i === dias.length - 1;
              return (
                <div key={d.dia} className={`ad-barra${hoje ? " ad-barra--hoje" : ""}`} title={`${d.dia.slice(8)}/${d.dia.slice(5, 7)}${hoje ? " (hoje, até agora)" : ""}: ${valores[i]}`}>
                  <em>{valores[i] ? num(valores[i]) : ""}</em>
                  <span><i style={{ height: `${valores[i] ? Math.max(4, Math.round((valores[i] / maxDia) * 100)) : 0}%` }} /></span>
                  <small>{hoje ? "hoje" : Number(d.dia.slice(8))}</small>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* ── Últimas atividades dos admins ── */}
      <section className="ad-box ad-reg" aria-label="Últimas atividades">
        <div className="ad-box-cab">
          <h2 className="ad-h2">Últimas atividades</h2>
          <button type="button" className="ad-link" onClick={() => navigate("/admin/registro")}>Ver o registro <CaretRight size={14} weight="bold" aria-hidden="true" /></button>
        </div>
        {!ultimos ? <p className="ad-reg-vazio">Carregando…</p>
          : ultimos.length === 0 ? <p className="ad-reg-vazio">Nada registrado ainda. Quando alguém der PRO, mexer em banner, novidade ou conta, aparece aqui.</p>
          : <ul className="rg-lista">{ultimos.map(r => <LinhaRegistro key={r.id} r={r} perfis={perfis} />)}</ul>}
      </section>

      <PainelLoja id={lojaAberta} aoFechar={() => setLojaAberta(null)} />

      <style>{`
        .ad-root { font-family: var(--font-base); color: var(--ui-texto); max-width: 1080px; }
        .ad-cab { margin-bottom: 18px; }
        .ad-h1 { margin: 0; font-size: 24px; font-weight: 600; color: var(--ui-texto); }
        .ad-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; margin: 4px 0 0; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-sub > i { font-style: normal; color: var(--ui-texto-3); }
        .ad-vivo { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
        .ad-vivo b, .ad-chip b { width: 8px; height: 8px; border-radius: 50%; background: var(--ui-verde); } /* (10/11) sem piscar sem fim */
                .ad-erro { margin: 0 0 12px; padding: 10px 12px; border-radius: var(--ui-raio); background: var(--ui-laranja-fundo); color: var(--ui-laranja); font-size: 14px; font-weight: 500; }

        /* topo rosa (o mesmo clima do "Primeiros passos" do Início) */
        .ad-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px 24px; padding: 24px 28px 0; overflow: hidden;
          border: 1px solid var(--ui-linha); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); } /* (10/11) cartão branco liso (antes degradê rosa) */
        .ad-hero-tx { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
        .ad-chip { display: inline-flex; align-items: center; gap: 6px; color: var(--ui-texto-2); font-size: 12px; font-weight: 500; } /* (10/11) texto com a bolinha, sem pílula */
        .ad-hero-n { margin: 10px 0 0; font-size: 48px; font-weight: 600; line-height: 1; color: var(--ui-rosa-escuro); letter-spacing: -.02em; }
        .ad-hero-t { margin: 6px 0 0; font-size: 17px; font-weight: 500; color: var(--ui-texto); }
        .ad-hero-vazio { margin: 12px 0 0; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-pilha { display: flex; align-items: center; margin: 16px 0 18px; padding-left: 8px; }
        .ad-pilha-av { position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -8px; padding: 0; border: 3px solid var(--ui-branco); border-radius: 50%; background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); font-family: inherit; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform .15s; }
        .ad-pilha-av:hover, .ad-pilha-av:focus-visible { z-index: 2; transform: translateY(-3px); }
        .ad-pilha-av img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .ad-pilha-av i { position: absolute; right: -4px; bottom: -3px; display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; border: 2px solid var(--ui-branco); border-radius: 50%; background: var(--ui-vinho); color: #FFD27A; }
        .ad-pilha-mais { display: flex; align-items: center; justify-content: center; min-width: 44px; height: 44px; margin-left: -8px; padding: 0 8px; border: 3px solid var(--ui-branco); border-radius: 99px; background: var(--ui-rosa); color: var(--ui-branco); font-size: 14px; font-weight: 600; }
        .ad-hero-masc { position: relative; z-index: 1; width: 170px; height: auto; align-self: end; margin-bottom: -6px; filter: drop-shadow(0 10px 18px rgba(153,53,86,.18)); }
        .ad-hero-pe { grid-column: 1 / -1; position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0 -28px; border-top: 1px solid var(--ui-linha); background: rgba(255,255,255,.7); }
        .ad-hero-pe div { display: flex; align-items: baseline; justify-content: center; gap: 6px; padding: 12px 8px; min-width: 0; white-space: nowrap; }
        .ad-hero-pe div + div { border-left: 1px solid var(--ui-linha); }
        .ad-hero-pe b { font-size: 18px; font-weight: 600; color: var(--ui-texto); }
        .ad-hero-pe small { font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }

        /* números (igual aos cards do Início) */
        .ad-nums { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
        .ad-num { display: flex; flex-direction: column; min-width: 0; padding: 16px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .ad-num-t { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; }
        .ad-num > b { margin-top: 12px; font-size: 28px; font-weight: 600; line-height: 1.1; color: var(--ui-texto); }
        .ad-num > small { margin-top: 4px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-ic { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 8px; }
        .ad-ic--rosa { border: 1px solid var(--ui-linha); background: var(--ui-branco); color: var(--ui-rosa-escuro); } /* (10/11) caixinha branca (antes rosa lavado) */
        .ad-ic--vinho { border: 1px solid var(--ui-linha); background: var(--ui-branco); color: #D4A017; }
        .ad-cmp { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--ui-linha); font-size: 12px; font-weight: 500; color: var(--ui-texto-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-cmp b { font-weight: 600; }
        .ad-cmp--sobe b { color: var(--ui-verde); }
        .ad-cmp--desce b { color: var(--ui-vermelho); }
        .ad-cmp-pro { color: var(--ui-rosa-escuro); }

        /* gráfico + acesso rápido */
        .ad-dupla { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; margin-top: 16px; } /* (10/11) sem o Acesso rápido (repetia o menu), o gráfico ocupa a linha */
        .ad-box { min-width: 0; padding: 18px; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); }
        .ad-h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--ui-texto); }
        .ad-box-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .ad-box-sub { display: block; margin-top: 2px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-tabs { flex: none; display: flex; padding: 3px; border-radius: 99px; background: var(--ui-cinza); }
        .ad-tabs button { height: 32px; padding: 0 12px; border: 0; border-radius: 99px; background: none; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); cursor: pointer; white-space: nowrap; }
        .ad-tabs button.on { background: var(--ui-branco); color: var(--ui-rosa-escuro); font-weight: 600; box-shadow: 0 1px 3px rgba(44,18,25,.1); }
        .ad-barras { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; height: 196px; margin-top: 18px; }
        .ad-barra { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
        .ad-barra em { min-height: 15px; font-size: 11px; font-style: normal; font-weight: 600; color: var(--ui-texto-2); }
        .ad-barra span { flex: 1; display: flex; align-items: flex-end; width: 100%; max-width: 30px; border-radius: 6px 6px 0 0; background: linear-gradient(to top, var(--ui-cinza), transparent); }
        .ad-barra span i { display: block; width: 100%; border-radius: 6px 6px 0 0; background: linear-gradient(to top, var(--ui-rosa-escuro), var(--ui-rosa)); transition: height .3s; }
        .ad-barra--hoje span i { background: var(--ui-rosa); opacity: .5; }
        .ad-barra small { font-size: 12px; font-weight: 500; color: var(--ui-texto-3); }
        .ad-barra--hoje small { color: var(--ui-rosa-escuro); font-weight: 600; }

        .ad-reg { margin-top: 16px; }
        .ad-reg .rg-lista { margin-top: 8px; }
        .ad-reg .ad-box-cab { flex-direction: row !important; align-items: center; }
        .ad-reg-vazio { margin: 10px 0 0; font-size: 14px; font-weight: 500; color: var(--ui-texto-2); }
        .ad-link { flex: none; display: inline-flex; align-items: center; gap: 4px; min-height: 32px; padding: 0; border: 0; background: none; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ui-rosa-escuro); cursor: pointer; }
        .ad-link:hover { text-decoration: underline; }
        ${CSS_REGISTRO}
        @media (max-width: 1100px) { .ad-nums { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 900px) { .ad-dupla { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 599px) {
          .ad-h1 { font-size: 22px; }
          .ad-hero { grid-template-columns: minmax(0, 1fr); padding: 18px 16px 0; }
          .ad-hero-masc { position: absolute; right: 6px; top: 14px; width: 104px; margin: 0; }
          .ad-hero-n { font-size: 42px; }
          .ad-hero-t { max-width: 200px; font-size: 15px; }
          .ad-hero-tx .ui-bt { width: 100%; }
          .ad-pilha { margin: 14px 0 16px; }
          .ad-pilha-av, .ad-pilha-mais { width: 40px; height: 40px; min-width: 40px; }
          .ad-hero-pe { margin: 16px -16px 0; }
          .ad-hero-pe div { flex-direction: column; align-items: center; gap: 0; padding: 10px 4px; }
          .ad-hero-pe b { font-size: 17px; }
          .ad-hero-pe small { font-size: 12px; }
          .ad-nums { gap: 8px; margin-top: 12px; }
          .ad-num { padding: 14px 12px; }
          .ad-num-t { gap: 6px; font-size: 13px; letter-spacing: -.01em; }
          .ad-num-t .ad-ic { width: 26px; height: 26px; }
          .ad-num-t .ad-ic svg { width: 16px; height: 16px; }
          .ad-so-pc { display: none !important; }
          .ad-num > b { font-size: 24px; }
          .ad-num > small { font-size: 12px; }
          .ad-cmp { font-size: 11px; }
          .ad-dupla { margin-top: 12px; }
          .ad-box { padding: 16px 14px; }
          .ad-box-cab { flex-direction: column; gap: 10px; }
          .ad-barras { gap: 3px; height: 170px; }
          .ad-barra em { display: none; }
          .ad-barra:nth-child(even):not(.ad-barra--hoje) small { visibility: hidden; }
        }
      `}</style>
    </div>
  );
}
