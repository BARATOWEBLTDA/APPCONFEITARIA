import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { supabase } from "@/lib/supabase";
import { isPro as ehPro } from "@/hooks/useProfile";
import PrimeirosPassos from "@/components/PrimeirosPassos";
import { ArrowSquareOut, Camera, CaretRight, ChartBar, Crown, ImageSquare, LinkSimple, Package, TextAlignLeft, Ticket } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { Botao } from "@/components/base";

/**
 * Visão geral do Cardápio digital — COMPUTADOR (aprovada 02/10).
 * Sem as listas de atalhos (agora estão no menu lateral). Quatro blocos:
 * cartão do link (situação da loja + compartilhar + QR Code), desempenho,
 * últimos pedidos do cardápio e "Pra vender mais".
 * (08/10 · 3.21) Ícones do app no lugar dos emojis, situação com as cores da lista de Pedidos,
 * número do pedido aparecendo, botões de 44px e o PRO no cartão vinho.
 */
type Periodo = "hoje" | "7d" | "30d" | "tudo";
const DIAS_MAP: Record<string, number> = { "Segunda": 1, "Terça": 2, "Quarta": 3, "Quinta": 4, "Sexta": 5, "Sábado": 6, "Domingo": 0 };
const DIAS_LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function situacaoLoja(horario: any): { aberto: boolean; txt: string } | null {
  if (!horario) return null;
  try {
    const h = typeof horario === "string" ? JSON.parse(horario) : horario;
    const agora = new Date(); const dia = agora.getDay(); const min = agora.getHours() * 60 + agora.getMinutes();
    const toMin = (t: string) => { const [a, b] = String(t || "0:0").split(":").map(Number); return a * 60 + (b || 0); };
    const ativo = (d: number) => (d === 6 && h.abre_sabado) || (d === 0 && h.abre_domingo) || (h.dias || []).some((x: string) => DIAS_MAP[x] === d);
    const horas = (d: number) => d === 6 && h.abre_sabado ? [h.sabado_abertura || "09:00", h.sabado_fechamento || "14:00"]
      : d === 0 && h.abre_domingo ? [h.domingo_abertura || "09:00", h.domingo_fechamento || "14:00"] : [h.abertura || "08:00", h.fechamento || "18:00"];
    if (ativo(dia)) {
      const [ab, fe] = horas(dia);
      if (min >= toMin(ab) && min < toMin(fe)) return { aberto: true, txt: `Aberto agora · fecha às ${fe.slice(0, 5)}` };
      if (min < toMin(ab)) return { aberto: false, txt: `Fechado · abre hoje às ${ab.slice(0, 5)}` };
    }
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7;
      if (ativo(d)) return { aberto: false, txt: `Fechado · abre ${i === 1 ? "amanhã" : DIAS_LABEL[d]} às ${horas(d)[0].slice(0, 5)}` };
    }
    return { aberto: false, txt: "Fechado" };
  } catch { return null; }
}

function inicioPeriodo(p: Periodo): Date | null {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (p === "hoje") return d;
  if (p === "7d") { d.setDate(d.getDate() - 6); return d; }
  if (p === "30d") { d.setDate(d.getDate() - 29); return d; }
  return null;
}

const STATUS: Record<string, [string, string]> = {
  novo: ["Novo pedido", "am"], aguardando_aceite: ["Novo pedido", "am"], aguardando_pagamento: ["Aguardando pagamento", "am"],
  agendado: ["Agendado", "bl"], confirmado: ["Agendado", "bl"], em_producao: ["Em produção", "rs"], finalizado: ["Pronto", "ok"],
  aguardando_retirada: ["Pronto", "ok"], em_entrega: ["Saiu pra entrega", "bl"], entregue: ["Entregue", "ok"], concluido: ["Entregue", "ok"], cancelado: ["Cancelado", "cz"],
};

export default function VisaoGeralDesktop({ profile, linkCardapio, publicado, onShare }: { profile: any; linkCardapio: string; publicado: boolean; onShare: () => void }) {
  const navigate = useNavigate();
  const pro = ehPro(profile);
  const [completo, setCompleto] = useState<boolean | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [dados, setDados] = useState<{ visitas: string[]; pedidos: any[]; produtos: any[]; temCupom: boolean } | null>(null);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);
  const situacao = useMemo(() => situacaoLoja(profile?.horario), [profile?.horario]);

  // Busca 60 dias de visitas/pedidos (dá pra comparar até "30 dias" com o período anterior)
  useEffect(() => {
    if (!profile?.id) return;
    const desde = new Date(); desde.setDate(desde.getDate() - 60);
    Promise.all([
      supabase.from("cardapio_visitas").select("created_at").eq("user_id", profile.id).gte("created_at", desde.toISOString()),
      supabase.from("pedidos").select("id, numero, cliente_nome, valor_total, status, created_at, pedido_itens(nome_produto, quantidade)")
        .eq("user_id", profile.id).eq("origem", "cardapio").order("created_at", { ascending: false }).limit(500),
      supabase.from("produtos").select("id, imagem_url, descricao, disponivel").eq("user_id", profile.id),
      supabase.from("loja_cupons").select("cupons").eq("user_id", profile.id).maybeSingle(),
    ]).then(([v, p, pr, c]) => setDados({
      visitas: ((v.data as any[]) || []).map(x => x.created_at),
      pedidos: (p.data as any[]) || [],
      produtos: ((pr.data as any[]) || []).filter(x => x.disponivel !== false),
      temCupom: Array.isArray((c.data as any)?.cupons) && (c.data as any).cupons.some((x: any) => x?.ativo),
    }));
  }, [profile?.id]);

  useEffect(() => {
    if (!linkCardapio) return;
    QRCode.toDataURL(linkCardapio, { width: 480, margin: 1, color: { dark: "#2C1219", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(""));
  }, [linkCardapio]);

  const metr = useMemo(() => {
    if (!dados) return null;
    const ini = inicioPeriodo(periodo);
    const dentro = (iso: string, a: Date | null, b?: Date) => { const t = new Date(iso).getTime(); return (!a || t >= a.getTime()) && (!b || t < b.getTime()); };
    const ativos = dados.pedidos.filter(p => p.status !== "cancelado");
    const vis = dados.visitas.filter(x => dentro(x, ini)).length;
    const ped = ativos.filter(p => dentro(p.created_at, ini));
    const rec = ped.reduce((s, p) => s + (Number(p.valor_total) || 0), 0);
    let ant: { vis: number; ped: number; rec: number } | null = null;
    if (ini) {
      const dur = Date.now() - ini.getTime(); const a0 = new Date(ini.getTime() - dur);
      const pa = ativos.filter(p => dentro(p.created_at, a0, ini));
      ant = { vis: dados.visitas.filter(x => dentro(x, a0, ini)).length, ped: pa.length, rec: pa.reduce((s, p) => s + (Number(p.valor_total) || 0), 0) };
    }
    // Visitas por dia (últimos 7 dias, ou 30)
    const nDias = periodo === "30d" ? 30 : 7;
    const dias = Array.from({ length: nDias }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (nDias - 1 - i)); return d; });
    const porDia = dias.map(d => { const f = new Date(d); f.setDate(f.getDate() + 1); return { d, n: dados.visitas.filter(x => dentro(x, d, f)).length }; });
    return { vis, ped: ped.length, rec, conv: vis > 0 ? (ped.length / vis) * 100 : 0, ant, porDia };
  }, [dados, periodo]);

  const variacao = (atual: number, antes?: number) => {
    if (antes == null || periodo === "tudo") return null;
    if (antes === 0) return atual > 0 ? { txt: "▲ novo no período", up: true } : null;
    const pct = Math.round(((atual - antes) / antes) * 100);
    return { txt: `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}% vs período anterior`, up: pct >= 0 };
  };

  const dicas = useMemo(() => {
    if (!dados) return [];
    const semFoto = dados.produtos.filter(p => !String(p.imagem_url || "").trim()).length;
    const semDesc = dados.produtos.filter(p => !String(p.descricao || "").trim()).length;
    const temBanner = !!(profile?.banner_url || profile?.banner1_url);
    const l: { e: Icon; t: string; s: string; cta: string; go: string }[] = [];
    if (semFoto) l.push({ e: Camera, t: `${semFoto} produto${semFoto > 1 ? "s" : ""} sem foto`, s: "Produto com foto vende muito mais.", cta: "Adicionar fotos", go: "/produtos" });
    if (semDesc) l.push({ e: TextAlignLeft, t: `${semDesc} produto${semDesc > 1 ? "s" : ""} sem descrição`, s: "Conte o sabor, o tamanho e quantas pessoas serve.", cta: "Escrever", go: "/produtos" });
    if (!temBanner) l.push({ e: ImageSquare, t: "Nenhum banner de promoção", s: "Anuncie a promoção da semana antes dos produtos.", cta: "Criar banner", go: "/cardapio-design" });
    if (pro && !dados.temCupom) l.push({ e: Ticket, t: "Crie um cupom de boas-vindas", s: "Ex.: 10% de desconto no primeiro pedido.", cta: "Criar cupom", go: "/checkout-config" });
    if (!dados.produtos.length) l.unshift({ e: Package, t: "Nenhum produto no cardápio", s: "Cadastre o primeiro pra começar a vender.", cta: "Cadastrar", go: "/produtos" });
    return l;
  }, [dados, profile, pro]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(linkCardapio); setCopiado(true); setTimeout(() => setCopiado(false), 1800); } catch {}
  };
  const baixarQr = () => {
    if (!qr) return;
    const a = document.createElement("a"); a.href = qr; a.download = `qrcode-cardapio-${profile?.codigo_publico || "doonly"}.png`; a.click();
  };
  const maxDia = Math.max(1, ...(metr?.porDia || []).map(d => d.n));
  const ultimos = (dados?.pedidos || []).slice(0, 5);

  return (
    <div className="vgd">
      {/* Enquanto não está pronto: passo a passo no lugar do cartão do link */}
      <PrimeirosPassos local="cardapio" onEstado={setCompleto} />

      {completo && (
        <div className="vgd-hero">
          <div>
            {situacao && <span className={`vgd-st${situacao.aberto ? "" : " off"}`}><i />{situacao.txt}</span>}
            <h2>Seu cardápio está no ar</h2>
            <div className="vgd-lk"><LinkSimple size={20} weight="bold" aria-hidden="true" /><span>{linkCardapio.replace(/^https?:\/\//, "")}</span></div>
            <div className="vgd-btns">
              <button type="button" className="vgd-b vgd-bw" onClick={onShare}>Enviar no WhatsApp</button>
              <button type="button" className="vgd-b vgd-bl" onClick={copiar}>{copiado ? "Link copiado" : "Copiar link"}</button>
              <a className="vgd-b vgd-bg" href={linkCardapio} target="_blank" rel="noopener noreferrer">Ver como cliente<ArrowSquareOut size={16} weight="bold" aria-hidden="true" /></a>
            </div>
          </div>
          {qr && (
            <div className="vgd-qr">
              <img src={qr} alt="QR Code do cardápio" />
              <button type="button" onClick={baixarQr}>QR Code pra imprimir · <u>Baixar</u></button>
            </div>
          )}
        </div>
      )}

      <div className="vgd-card">
        <div className="vgd-rowh">
          <div><p className="vgd-ct">Desempenho do cardápio</p><p className="vgd-cs">Quem visitou e quem comprou</p></div>
          {pro && (
            <div className="vgd-tabs" role="tablist">
              {([["hoje", "Hoje"], ["7d", "7 dias"], ["30d", "30 dias"], ["tudo", "Tudo"]] as [Periodo, string][]).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={periodo === v} className={periodo === v ? "on" : ""} onClick={() => setPeriodo(v)}>{l}</button>
              ))}
            </div>
          )}
        </div>
        {!pro ? (
          <div className="vgd-lock">
            <span className="vgd-lock-ic" aria-hidden="true"><ChartBar size={24} weight="bold" /></span>
            <div><b>Veja quem visita e quem compra</b><small>Visitas, pedidos pelo link, receita e conversão ficam liberados no PRO.</small></div>
            <Botao icone={<Crown size={20} weight="fill" />} onClick={() => navigate("/assinar")}>Conhecer o PRO</Botao>
          </div>
        ) : metr && (
          <>
            <div className="vgd-kp">
              {[["Visitas", String(metr.vis), variacao(metr.vis, metr.ant?.vis)],
                ["Pedidos online", String(metr.ped), variacao(metr.ped, metr.ant?.ped)],
                ["Receita online", brl(metr.rec), variacao(metr.rec, metr.ant?.rec)],
                ["Conversão", `${metr.conv.toFixed(1).replace(".", ",")}%`, metr.vis ? { txt: `de cada 100 visitas, ${Math.round(metr.conv)} compram`, up: true, neutro: true } : null],
              ].map(([l, v, d]: any) => (
                <div className="vgd-k" key={l}><small>{l}</small><b>{v}</b>{d && <em className={d.neutro ? "n" : d.up ? "" : "down"}>{d.txt}</em>}</div>
              ))}
            </div>
            <div className={`vgd-bars${metr.porDia.length > 7 ? " vgd-bars--30" : ""}`}>
              {metr.porDia.map(({ d, n }, i) => (
                <div className="vgd-bar" key={i} title={`${d.toLocaleDateString("pt-BR")}: ${n} visita${n !== 1 ? "s" : ""}`}>
                  {metr.porDia.length <= 7 && <em>{n}</em>}
                  <i style={{ height: `${Math.max(3, Math.round((n / maxDia) * 100))}%` }} />
                  <span>{metr.porDia.length <= 7 ? d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "") : (i % 5 === 0 ? d.getDate() : "")}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="vgd-g2">
        <div className="vgd-card">
          <div className="vgd-rowh">
            <div><p className="vgd-ct">Últimos pedidos do cardápio</p><p className="vgd-cs">Os que chegaram pelo seu link</p></div>
            {ultimos.length > 0 && <Botao variante="link" iconeDepois={<CaretRight size={16} weight="bold" />} onClick={() => navigate("/pedidos")}>Ver todos</Botao>}
          </div>
          {!dados ? <p className="vgd-vazio">Carregando…</p> : ultimos.length === 0 ? (
            <p className="vgd-vazio">Nenhum pedido pelo cardápio ainda. Compartilhe o link pra receber o primeiro.</p>
          ) : ultimos.map(p => {
            const [st, cor] = STATUS[p.status] || ["Agendado", "bl"];
            const itens = (p.pedido_itens || []).map((i: any) => `${i.nome_produto}${Number(i.quantidade) > 1 ? ` × ${i.quantidade}` : ""}`).join(" + ");
            const quando = new Date(p.created_at); const hoje = new Date();
            const q = quando.toDateString() === hoje.toDateString() ? `hoje ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            return (
              <button type="button" className="vgd-pe" key={p.id} onClick={() => navigate(`/pedidos/${p.id}/editar`)}>
                <span className="vgd-pa">{String(p.cliente_nome || "C").trim().charAt(0).toUpperCase()}</span>
                <span className="vgd-pt"><b>{p.cliente_nome || "Cliente"}</b><small>{[p.numero ? `#${p.numero}` : "", itens].filter(Boolean).join(" · ") || "Pedido"} · {q}</small></span>
                <span className="vgd-pv"><b>{brl(Number(p.valor_total) || 0)}</b><small className={`vgd-sit ${cor}`}>{st}</small></span>
              </button>
            );
          })}
        </div>

        <div className="vgd-card">
          <div><p className="vgd-ct">Pra vender mais</p><p className="vgd-cs">O que ainda dá pra melhorar no seu cardápio</p></div>
          {!dados ? <p className="vgd-vazio">Carregando…</p> : dicas.length === 0 ? (
            <p className="vgd-vazio">Seu cardápio está caprichado. Todos os produtos têm foto e descrição.</p>
          ) : dicas.map(d => (
            <button type="button" className="vgd-di" key={d.t} onClick={() => navigate(d.go)}>
              <span className="vgd-de" aria-hidden="true"><d.e size={20} weight="bold" /></span>
              <span className="vgd-dt"><b>{d.t}</b><small>{d.s}</small></span>
              <span className="vgd-db">{d.cta}<CaretRight size={14} weight="bold" aria-hidden="true" /></span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .vgd { display: flex; flex-direction: column; gap: 16px; font-family: var(--font-base); color: #2C1219; margin-top: 20px; }
        .vgd-card { background: #fff; border: 1px solid #F0EBED; border-radius: 16px; padding: 18px 20px; }
        .vgd-ct { margin: 0; font-size: 15.5px; font-weight: 700; } .vgd-cs { margin: 2px 0 0; font-size: 12.5px; color: #9A8E94; }
        .vgd-rowh { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .vgd-hero { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; border-radius: 16px; padding: 20px 22px; color: #fff; background: linear-gradient(135deg, #2C1219, #6B2340); }
        .vgd-st { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #86EFAC; background: rgba(134,239,172,.12); padding: 4px 10px; border-radius: 999px; }
        .vgd-st i { width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; }
        .vgd-st.off { color: #FCD34D; background: rgba(252,211,77,.12); } .vgd-st.off i { background: #FBBF24; }
        .vgd-hero h2 { margin: 8px 0 0; font-size: 20px; font-weight: 700; color: #fff; }
        .vgd-lk { display: flex; align-items: center; gap: 8px; margin-top: 12px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14); border-radius: 12px; padding: 10px 12px; font-size: 13.5px; }
        .vgd-lk span { flex: 1; opacity: .9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vgd-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .vgd-b { border: none; border-radius: var(--ui-raio-botao); gap: 6px; min-height: 44px; padding: 0 16px; font: 700 14px var(--font-base); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
        .vgd-bw { background: #25D366; color: #fff; } .vgd-bl { background: #fff; color: #2C1219; } .vgd-bg { background: rgba(255,255,255,.12); color: #fff; }
        .vgd-qr { text-align: center; }
        .vgd-qr img { width: 124px; height: 124px; border-radius: 14px; background: #fff; padding: 8px; display: block; margin: 0 auto; }
        .vgd-qr button { margin-top: 8px; border: none; background: none; color: rgba(255,255,255,.85); font: 600 11.5px var(--font-base); cursor: pointer; }
        .vgd-tabs { display: flex; gap: 4px; background: #F5F0F2; border-radius: 10px; padding: 3px; }
        .vgd-tabs button { border: none; background: none; padding: 6px 12px; border-radius: 8px; font: 700 12.5px var(--font-base); color: #6B5D64; cursor: pointer; }
        .vgd-tabs button.on { background: #fff; color: #2C1219; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
        .vgd-kp { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 14px; }
        .vgd-k { border: 1px solid #F0EBED; border-radius: 14px; padding: 12px 14px; }
        .vgd-k small { display: block; font-size: 12px; font-weight: 700; color: #9A8E94; }
        .vgd-k b { display: block; font-size: 22px; font-weight: 700; margin-top: 2px; }
        .vgd-k em { font-style: normal; font-size: 13px; font-weight: 700; color: #15803D; } .vgd-k em.down { color: #B91C1C; } .vgd-k em.n { color: #9A8E94; font-weight: 500; }
        .vgd-bars { display: flex; align-items: flex-end; gap: 12px; height: 120px; margin-top: 16px; }
        .vgd-bars--30 { gap: 3px; }
        .vgd-bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 5px; min-width: 0; }
        .vgd-bar i { width: 100%; border-radius: 7px 7px 3px 3px; background: linear-gradient(180deg, #F472B6, #C33A6E); }
        .vgd-bars--30 .vgd-bar i { border-radius: 3px 3px 1px 1px; }
        .vgd-bar span { font-size: 12px; color: #9A8E94; height: 14px; } .vgd-bar em { font-style: normal; font-size: 12px; font-weight: 700; color: #6B5D64; }
        .vgd-lock { display: flex; align-items: center; gap: 14px; margin-top: 14px; padding: 16px; border-radius: 14px; background: #FFF6F9; border: 1px dashed #F3C9DA; }
        .vgd-lock img { width: 34px; height: 34px; object-fit: contain; }
        .vgd-lock div { flex: 1; } .vgd-lock b { display: block; font-size: 14.5px; } .vgd-lock small { font-size: 12.5px; color: #6B5D64; }
        .vgd-g2 { display: grid; grid-template-columns: 1.25fr 1fr; gap: 16px; align-items: start; }
        .vgd-pe, .vgd-di { display: flex; align-items: center; gap: 12px; width: 100%; padding: 11px 0; border: none; border-top: 1px solid #F5F0F2; background: none; font-family: inherit; text-align: left; cursor: pointer; color: inherit; }
        .vgd-card > .vgd-pe:first-of-type, .vgd-card > .vgd-di:first-of-type { margin-top: 8px; }
        .vgd-pa { width: 36px; height: 36px; border-radius: 50%; background: #FCE7F3; color: #C33A6E; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
        .vgd-pt, .vgd-dt { flex: 1; min-width: 0; }
        .vgd-pt b, .vgd-dt b { display: block; font-size: 13.5px; }
        .vgd-pt small, .vgd-dt small { display: block; font-size: 12px; color: #9A8E94; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .vgd-dt small { white-space: normal; }
        .vgd-pv { text-align: right; flex-shrink: 0; } .vgd-pv b { display: block; font-size: 13.5px; } .vgd-pv small { font-size: 13px; color: #9A8E94; }
        .vgd-pill { font-size: 12px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
        .vgd-pill.ok { background: #DCFCE7; color: #15803D; } .vgd-pill.rd { background: #FEE2E2; color: #B91C1C; } .vgd-pill.bl { background: #DBEAFE; color: #1D4ED8; }
        .vgd-pill.am { background: #FEF3C7; color: #B45309; } .vgd-pill.cz { background: #F3F4F6; color: #6B7280; }
        .vgd-vt { border: none; background: none; font: 700 14px var(--font-base); min-height: 44px; color: #C33A6E; cursor: pointer; }
        .vgd-de { width: 36px; height: 36px; border-radius: 10px; background: #FFF6F9; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
        .vgd-db { font-size: 12.5px; font-weight: 700; color: #C33A6E; white-space: nowrap; }
        .vgd-vazio { margin: 14px 0 4px; font-size: 13px; color: #9A8E94; }
        .vgd-pe:hover b, .vgd-di:hover .vgd-db { color: #C33A6E; }
        /* 08/10 · 3.21: no padrão do guia */
        .vgd-card { border-color: var(--ui-borda); box-shadow: var(--ui-sombra-cartao); padding: 16px 20px; }
        .vgd-ct { font-size: 16px; } .vgd-cs { font-size: 13px; color: var(--ui-texto-2); }
        .vgd-lk svg { flex: none; }
        .vgd-b { min-height: 44px; gap: 6px; font-size: 13.5px; }
        .vgd-qr button { min-height: 36px; font-size: 13px; }
        .vgd-tabs button { min-height: 40px; font-size: 13.5px; }
        .vgd-k small { font-size: 12.5px; letter-spacing: 0; text-transform: none; color: var(--ui-texto-2); }
        .vgd-k em { font-size: 12.5px; }
        .vgd-bar span, .vgd-bar em { font-size: 12px; }
        .vgd-lock { border: 0; background: linear-gradient(150deg, #3B1620, #6B2340); color: #fff; }
        .vgd-lock-ic { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; border-radius: var(--ui-raio); background: rgba(255,255,255,.14); }
        .vgd-lock b { color: #fff; font-size: 16px; } .vgd-lock small { display: block; margin-top: 2px; font-size: 13.5px; color: rgba(255,255,255,.82); }
        .vgd-pe, .vgd-di { min-height: 56px; padding: 8px 0; }
        .vgd-pa { width: 40px; height: 40px; }
        .vgd-pt b, .vgd-dt b { font-size: 15px; }
        .vgd-pt small, .vgd-dt small { font-size: 13px; color: var(--ui-texto-2); }
        .vgd-pv b { font-size: 15px; } .vgd-pv small { font-size: 13px; font-weight: 700; }
        .vgd-sit.ok { color: var(--ui-verde); } .vgd-sit.am { color: var(--ui-laranja); } .vgd-sit.bl { color: var(--ui-azul); } .vgd-sit.rs { color: var(--ui-rosa-escuro); } .vgd-sit.cz { color: var(--ui-texto-3); } .vgd-sit.rd { color: var(--ui-vermelho); }
        .vgd-de { width: 40px; height: 40px; border-radius: var(--ui-raio); background: var(--ui-rosa-claro); color: var(--ui-rosa-escuro); }
        .vgd-db { display: inline-flex; align-items: center; gap: 2px; font-size: 13.5px; color: var(--ui-rosa-escuro); }
        .vgd-vazio { font-size: 13.5px; color: var(--ui-texto-2); }
      `}</style>
    </div>
  );
}
