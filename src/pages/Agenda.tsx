import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { montarMensagem, dadosDoPedido } from "@/lib/mensagens";
import { useNavigate } from "react-router-dom";
import { CalendarBlank, CaretLeft, CaretRight, Check, Copy, FilePdf, Funnel, MagnifyingGlass, Package, PencilSimple, Plus, Printer, Trash, WarningCircle, WhatsappLogo, X } from "@phosphor-icons/react";
import { pedidoAtrasado, STATUS_AINDA_NAO_PRONTO } from "@/lib/pedidoStatus";
import { duplicarPedido as duplicarPedidoLib } from "@/lib/duplicarPedido";
import { gerarPedidoPDF } from "@/lib/gerarPedidoPDF";
import * as pdf from "@/lib/pdfDoonly";
import { usePlano } from "@/hooks/usePlano";
import { supabase } from "@/lib/supabase";
import { registrarEtapa } from "@/lib/historicoPedido";
import AppPageHeader from "@/components/AppPageHeader";
import CalendarioSheet from "@/components/CalendarioSheet";
import { Botao, BotaoIcone, Janela, Linha, TelaVazia, Titulo, avisar, confirmar } from "@/components/base";
import { avisoDaMudanca, formaDoItem, itemComQtd, nomeDaSituacao, nomeDeGente, nomeDeProduto, qtdCurta, recebidoPedido, rs, saldoPedido, situacaoDe, telefoneValido } from "@/components/pedidos/pedidoTexto";
import { NomeComQtd } from "@/components/pedidos/CartaoPedido";
import "@/components/pedidos/pedidos.css";
import "./agenda.css";

/**
 * Agenda (08/10 · 3.18, no padrão do guia).
 * Calendário do mês + pedidos do dia escolhido. As regras (o que é atrasado, filtros, marcar pronto,
 * mudar a data, duplicar, excluir e o PDF do dia) são as mesmas de antes; mudou o visual:
 *   título "Agenda", mês e dia escritos certo ("Outubro de 2026", "Quinta-feira, 8 de outubro"),
 *   botões de 44px, letras de 12,5px pra cima, cores e nomes da situação iguais aos da lista de Pedidos,
 *   filtro e "mais ações" na janela padrão, avisos rápidos do app e duas colunas a partir do tablet.
 * O cartão do pedido continua o da Agenda (decisão de 08/10), só arrumado.
 */

/* ── Situações: o grupo decide a cor da bolinha no calendário ── */
type Grupo = "agendado" | "producao" | "concluido" | "cancelado";
const GRUPO_DO_STATUS: Record<string, Grupo> = {
  aguardando_pagamento: "agendado", aguardando_aceite: "agendado", novo: "agendado", agendado: "agendado", confirmado: "agendado",
  em_producao: "producao",
  finalizado: "concluido", aguardando_retirada: "concluido", em_entrega: "concluido", entregue: "concluido", pronto: "concluido", a_caminho: "concluido", concluido: "concluido",
  cancelado: "cancelado",
};
const grupoDe = (s: string): Grupo => GRUPO_DO_STATUS[s] || "agendado";

/* Filtro por situação: os mesmos nomes da lista de Pedidos ("novo" e "aguardando_aceite" são o mesmo "Novo pedido") */
const FILTROS: { nome: string; chaves: string[] }[] = [
  { nome: "Novo pedido", chaves: ["aguardando_aceite", "novo"] },
  { nome: "Aguardando pagamento", chaves: ["aguardando_pagamento"] },
  { nome: "Agendado", chaves: ["agendado"] },
  { nome: "Em produção", chaves: ["em_producao"] },
  { nome: "Pronto", chaves: ["finalizado"] },
  { nome: "Pronto pra retirar", chaves: ["aguardando_retirada"] },
  { nome: "Saiu pra entrega", chaves: ["em_entrega"] },
  { nome: "Entregue", chaves: ["entregue"] },
  { nome: "Cancelado", chaves: ["cancelado"] },
];
const STATUS_FILTRAVEIS = FILTROS.flatMap(f => f.chaves);

const SEMANA_CURTA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/* ── Datas ── */
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseISO = (iso: string) => new Date(iso + "T12:00:00");
const diffDias = (isoAlvo: string) => {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = parseISO(isoAlvo); alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86400000);
};
const relativo = (iso: string) => { const d = diffDias(iso); return d === 0 ? "Hoje" : d === 1 ? "Amanhã" : d === -1 ? "Ontem" : ""; };
/** "Quinta-feira, 8 de outubro" */
const diaPorExtenso = (iso: string) => { const d = parseISO(iso); return `${SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
/** "Hoje às 10:00", "Amanhã", "20 de outubro às 14:00" */
const quandoEntrega = (p: any) => {
  if (!p.data_entrega) return "Sem data";
  const h = p.horario_entrega ? ` às ${String(p.horario_entrega).slice(0, 5)}` : "";
  const r = relativo(p.data_entrega);
  if (r) return `${r}${h}`;
  const d = parseISO(p.data_entrega);
  return `${d.getDate()} de ${MESES[d.getMonth()]}${h}`;
};
const criadoEmTexto = (created_at: string) => {
  if (!created_at) return "";
  const d = new Date(created_at);
  return `${d.getDate()} de ${MESES[d.getMonth()]} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const primeiraFoto = (f?: string | null) => (f ? String(f).split(/,(?=\s*https?:)/)[0].trim() : "");
const normalizarTelefone = (tel: string) => (tel || "").replace(/\D/g, "");

export default function Agenda() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const [userId, setUserId] = useState("");

  const [refDate, setRefDate] = useState(new Date());
  const [diaSel, setDiaSel] = useState(isoDate(new Date()));
  const [busca, setBusca] = useState("");

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [demorou, setDemorou] = useState(false);

  // Cancelados ficam de fora por padrão (dá pra ligar no filtro), igual ao total do dia
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_FILTRAVEIS.filter(s => s !== "cancelado"));
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [menuDe, setMenuDe] = useState<any | null>(null);
  const [reagendando, setReagendando] = useState<any | null>(null);

  /* Autenticação */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    })();
  }, []);

  /* Busca de pedidos */
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("pedidos")
        .select("*, pedido_itens(nome_produto, quantidade, valor_unitario, imagem_url, personalizacoes, produtos(imagem_url, forma_venda)), clientes(foto_url)")
        .eq("user_id", userId)
        .order("data_entrega", { ascending: true, nullsFirst: false })
        .order("horario_entrega", { ascending: true, nullsFirst: false });

      // Status antigos viram os atuais (senão somem da lista do dia — igual à tela de Pedidos)
      const ANTIGOS: Record<string, string> = { confirmado: "agendado", pronto: "finalizado", a_caminho: "em_entrega", concluido: "entregue", em_preparo: "em_producao" };
      const pedidosNormalizados = (data || []).map((p: any) => ({
        ...p,
        status: ANTIGOS[p.status] || p.status,
        data_entrega: p.data_entrega || (p.created_at ? p.created_at.slice(0, 10) : null),
      }));
      setPedidos(pedidosNormalizados);
      setLoading(false);
    })();
  }, [userId]);

  // o "carregando" só aparece se passar de 300ms
  useEffect(() => {
    if (!loading) { setDemorou(false); return; }
    const t = window.setTimeout(() => setDemorou(true), 300);
    return () => window.clearTimeout(t);
  }, [loading]);

  /* Pedidos filtrados por busca (aplicado antes de qualquer outra coisa) */
  const pedidosBuscados = useMemo(() => {
    if (!busca.trim()) return pedidos;
    const q = busca.toLowerCase().trim();
    return pedidos.filter(p =>
      (p.cliente_nome || "").toLowerCase().includes(q) ||
      (p.numero != null && String(p.numero).includes(q))
    );
  }, [pedidos, busca]);

  /* Mapa por dia com contagens por grupo + atrasado */
  const dayStats = useMemo(() => {
    const m: Record<string, { total: number; agendado: number; producao: number; concluido: number; atrasado: number }> = {};
    pedidosBuscados.forEach(p => {
      if (!p.data_entrega || p.status === "cancelado") return;
      if (!m[p.data_entrega]) m[p.data_entrega] = { total: 0, agendado: 0, producao: 0, concluido: 0, atrasado: 0 };
      m[p.data_entrega].total++;
      const g = grupoDe(p.status);
      if (g === "agendado") m[p.data_entrega].agendado++;
      else if (g === "producao") m[p.data_entrega].producao++;
      else if (g === "concluido") m[p.data_entrega].concluido++;
      if (pedidoAtrasado(p)) m[p.data_entrega].atrasado++;
    });
    return m;
  }, [pedidosBuscados]);

  const pedidosDoDia = useMemo(() =>
    pedidosBuscados
      .filter(p => p.data_entrega === diaSel)
      .sort((a, b) => (a.horario_entrega || "99").localeCompare(b.horario_entrega || "99")),
    [pedidosBuscados, diaSel]
  );

  const pedidosDiaFiltrados = useMemo(
    () => pedidosDoDia.filter((p: any) => statusSelecionados.includes(p.status)),
    [pedidosDoDia, statusSelecionados]
  );

  const countStatusDia = useMemo(() => {
    const m: Record<string, number> = {};
    pedidosBuscados.filter(p => p.data_entrega === diaSel).forEach(p => { m[p.status] = (m[p.status] || 0) + 1; });
    return m;
  }, [pedidosBuscados, diaSel]);

  const irParaHoje = useCallback(() => {
    const h = new Date();
    setRefDate(h);
    setDiaSel(isoDate(h));
  }, []);

  /* ── Ações (as mesmas de antes) ── */
  const abrirEditar = (id: string) => navigate(`/pedidos/${id}/editar`);

  const marcarComoPronto = async (p: any) => {
    // o mesmo caminho da lista e da tela do pedido (10/10): retirada vai pra "Pronto pra retirar"; entrega, pra "Pronto"
    const novo = p.tipo_entrega === "entrega" ? "finalizado" : "aguardando_retirada";
    const { error } = await supabase.from("pedidos").update({ status: novo }).eq("id", p.id);
    if (error) { avisar("Não deu pra mudar a situação. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    registrarEtapa(p.id, novo);
    setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, status: novo } : x));
    avisar(avisoDaMudanca(p, novo));
  };

  const abrirWhatsApp = (p: any) => {
    const tel = [p.cliente_whatsapp, p.cliente_telefone].map(t => normalizarTelefone(t || "")).find(t => telefoneValido(t)) || "";
    if (!tel) { avisar("Esse cliente não tem telefone cadastrado.", { tipo: "erro" }); return; }
    const numero = tel.startsWith("55") ? tel : `55${tel}`;
    const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome).split(" ")[0] : "";
    const msg = encodeURIComponent(montarMensagem("sobre_pedido", dadosDoPedido(p, nome)));
    window.open(`https://wa.me/${numero}?text=${msg}`, "_blank");
  };

  const duplicarPedido = async (p: any) => {
    const r = await duplicarPedidoLib(p.id);
    if ("erro" in r) { avisar(r.erro, { tipo: "erro" }); return; }
    avisar("Pedido duplicado. Ajuste a data da cópia.");
    navigate(`/pedidos/${r.id}/editar`);
  };

  const excluirPedido = async (p: any) => {
    const ok = await confirmar({ titulo: `Excluir o pedido #${p.numero || ""}?`, texto: "Ele some da agenda, da lista de pedidos e do financeiro. Não dá pra desfazer.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", p.id);
    if (error) { avisar("Não deu pra excluir o pedido. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    setPedidos(prev => prev.filter(x => x.id !== p.id));
    avisar("Pedido excluído.");
  };

  const confirmarReagendamento = async (novaData: string) => {
    const p = reagendando;
    setReagendando(null);
    if (!p) return;
    const { error } = await supabase.from("pedidos").update({ data_entrega: novaData }).eq("id", p.id);
    if (error) { avisar("Não deu pra mudar a data. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    setPedidos(prev => prev.map(x => x.id === p.id ? { ...x, data_entrega: novaData } : x));
    avisar(`Pedido #${p.numero || ""} foi pra ${diaPorExtenso(novaData).toLowerCase()}.`);
  };

  const baixarPdf = async (p: any) => {
    const janela = pdf.abrirJanela();
    const { data } = await supabase.from("pedidos").select("*, pedido_itens(*, produtos(forma_venda))").eq("id", p.id).maybeSingle();
    await gerarPedidoPDF((data || { id: p.id }) as any, janela);
  };

  // ── Agenda do dia em PDF (modelo padrão · recurso PRO) ──
  const imprimirAgendaDoDia = () => {
    if (!isPro) { avisar("Imprimir a agenda do dia é do plano PRO.", { tipo: "info", acao: { rotulo: "Ver o PRO", aoTocar: () => navigate("/assinar") } }); return; }
    const lista = [...(pedidosDoDia as any[])].filter(p => p.status !== "cancelado")
      .sort((a, b) => String(a.horario_entrega || "99").localeCompare(String(b.horario_entrega || "99")));
    const dia = new Date(diaSel + "T12:00:00");
    const diaTxt = dia.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    const STATUS_PDF: Record<string, [string, "ok" | "am" | "rd" | "bl"]> = {
      finalizado: ["Pronto", "ok"], pronto: ["Pronto", "ok"], aguardando_retirada: ["Pronto", "ok"], entregue: ["Entregue", "ok"], concluido: ["Entregue", "ok"],
      em_producao: ["Em produção", "am"], em_preparo: ["Em produção", "am"], em_entrega: ["Saiu pra entrega", "am"], a_caminho: ["Saiu pra entrega", "am"],
      aguardando_pagamento: ["Aguardando pagamento", "rd"], aguardando_aceite: ["Novo pedido", "rd"], novo: ["Novo pedido", "rd"],
    };
    const nomeOp = (v: any) => (!v ? "" : typeof v === "string" ? v : v.nome || "");
    const produzir = new Map<string, { qtd: number; forma: string | null; extra: Map<string, number> }>();
    const linhas = lista.map(p => {
      const itens = (p.pedido_itens || []).map((it: any) => {
        const tam = nomeOp(it.personalizacoes?.tamanho);
        const chave = [it.nome_produto, tam].filter(Boolean).join(" ");
        const forma = formaDoItem(it);
        const atual = produzir.get(chave) || { qtd: 0, forma, extra: new Map() };
        atual.qtd += Number(it.quantidade) || 1;
        (it.personalizacoes?.kit?.sabores || []).forEach((x: any) => atual.extra.set(x.nome, (atual.extra.get(x.nome) || 0) + (Number(x.qtd) || 0) * (Number(it.quantidade) || 1)));
        produzir.set(chave, atual);
        return itemComQtd(chave, Number(it.quantidade) || 1, forma, true);
      }).join(" + ");
      const [stTxt, stCor] = STATUS_PDF[p.status] || ["Agendado", "bl"];
      const ent = p.tipo_entrega === "entrega";
      const end = ent ? [[p.endereco_rua, p.endereco_numero].filter(Boolean).join(", "), p.endereco_bairro].filter(Boolean).join(" · ") : "";
      return `<tr><td class="hr">${p.horario_entrega ? String(p.horario_entrega).slice(0, 5) : "—"}</td><td><b>${pdf.esc(p.cliente_nome || "Venda avulsa")}</b><small>${ent ? "Entrega" : "Retirada"}${end ? ` · ${pdf.esc(end)}` : ""}</small></td><td>${pdf.esc(itens)}</td><td>${pdf.pill(stTxt, stCor)}</td><td class="ck">☐</td></tr>`;
    }).join("");
    const prod = [...produzir.entries()].map(([nome, v]) => [nome, `${qtdCurta(v.qtd, v.forma).replace(/x$/, "")}${v.extra.size ? ` (${[...v.extra.entries()].map(([n, q]) => `${n} ${q}`).join(" · ")})` : ""}`] as [string, string]);
    const entregas = lista.filter(p => p.tipo_entrega === "entrega").length;
    pdf.gerarDocumento(() => ({
      titulo: `Agenda do dia · ${diaTxt}`,
      tipo: "Agenda do dia",
      numero: diaTxt.charAt(0).toUpperCase() + diaTxt.slice(1),
      sub: `${lista.length} pedido${lista.length !== 1 ? "s" : ""}`,
      corpo: pdf.kpis([["Pedidos", String(lista.length)], ["Entregas", String(entregas)], ["Retiradas", String(lista.length - entregas)]])
        + pdf.card("Pedidos do dia", lista.length ? `<table class="tb"><tr><th>Hora</th><th>Cliente</th><th>Itens</th><th>Situação</th><th class="c">Feito</th></tr>${linhas}</table>` : `<p class="vazio">Nenhum pedido neste dia.</p>`)
        + (prod.length ? pdf.card("Pra produzir hoje", pdf.kv(prod.map(([n, q]) => [n, pdf.esc(q)] as [string, string]))) : ""),
    }));
  };

  // "Mais ações": fecha a janela antes de fazer (assim o "voltar" do Android não se perde)
  const doMenu = (fn: (p: any) => void) => () => { const p = menuDe; setMenuDe(null); if (p) window.setTimeout(() => fn(p), 220); };

  // Cancelado escondido é o normal: o número no botão conta só as outras situações que foram escondidas
  const filtrosDesligados = FILTROS.filter(f => f.nome !== "Cancelado" && !f.chaves.some(c => statusSelecionados.includes(c))).length;
  const mostrarTodas = () => setStatusSelecionados([...STATUS_FILTRAVEIS]);
  // 4.08: a agenda não mostra o total vendido no dia (isso é do Financeiro); mostra só o que falta receber, quando existe
  const aReceberDoDia = pedidosDoDia.filter((p: any) => p.status !== "cancelado" && saldoPedido(p) > 0.009);
  const faltaDoDia = aReceberDoDia.reduce((s: number, p: any) => s + saldoPedido(p), 0);
  const stDia = dayStats[diaSel] || { total: 0 };
  const relDia = relativo(diaSel);

  /* ═══ Render ═══ */
  return (
    <>
    <AppPageHeader
      title="Agenda"
      subtitle="Seus pedidos por data de entrega"
      infoIcon="📅"
      infoContent={
        <>
          <p>Aqui ficam os seus <strong>pedidos por data de entrega</strong>. Veja o que precisa produzir hoje, amanhã e nos próximos dias.</p>
          <p>As bolinhas no calendário mostram a situação dos pedidos de cada dia. Vermelho quer dizer que tem pedido atrasado.</p>
        </>
      }
      infoTip={<>Escolha um dia no calendário pra ver os <strong>pedidos daquele dia</strong>.</>}
    />
    <div className="ag3">
      {/* Busca + filtro */}
      <div className="ag3-topo">
        <div className="ui-campo-c ag3-busca" onClick={e => { if (e.target === e.currentTarget) (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus(); }}>
          <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
          <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Buscar pedido por cliente ou número" placeholder="Buscar" value={busca} onChange={e => setBusca(e.target.value)} />
          {busca && <BotaoIcone variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBusca("")}><X size={20} weight="bold" /></BotaoIcone>}
        </div>
        <BotaoIcone className={"ag3-filtro" + (filtrosDesligados > 0 ? " on" : "")} rotulo={filtrosDesligados > 0 ? `Filtrar por situação (${filtrosDesligados} escondida${filtrosDesligados > 1 ? "s" : ""})` : "Filtrar por situação"} onClick={() => setFiltroAberto(true)}>
          <Funnel size={20} weight={filtrosDesligados > 0 ? "fill" : "bold"} />
          {filtrosDesligados > 0 && <span className="ag3-filtro-n" aria-hidden="true">{filtrosDesligados}</span>}
        </BotaoIcone>
        {/* Nova venda no topo, igual à lista de Pedidos (antes era um botão flutuante que cobria o primeiro cartão) */}
        <Botao className="ag3-novo-g" icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/vendas/novo")}>Nova venda</Botao>
      </div>

      <div className="ag3-grade">
        <Calendario refDate={refDate} setRefDate={setRefDate} diaSel={diaSel} setDiaSel={setDiaSel} dayStats={dayStats} irParaHoje={irParaHoje} />

        <div className="ag3-lado">
          {/* Resumo do dia */}
          <section className="ag3-card ag3-dia" aria-live="polite">
            <div>
              <h2>{diaPorExtenso(diaSel)}</h2>
              {/* 4.10: a contagem saiu daqui ("Pedidos do dia" logo abaixo já mostra); fica só "Hoje"/"Amanhã" e o aviso de dia vazio */}
              {(relDia || stDia.total === 0) && <p>{relDia && <b>{relDia}</b>}{relDia && stDia.total === 0 && " · "}{stDia.total === 0 && "Nenhum pedido"}</p>}
            </div>
            {faltaDoDia > 0.009 && (
              <div className="ag3-dia-v">
                <small>Falta receber</small>
                <b>{rs(faltaDoDia)}</b>
              </div>
            )}
          </section>

          {/* Pedidos do dia */}
          {loading ? (
            demorou ? <p className="ag3-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando os pedidos…</p> : null
          ) : pedidosDoDia.length === 0 ? (
            <TelaVazia icone={<CalendarBlank size={30} />} titulo="Nenhum pedido nesse dia" texto={busca.trim() ? `Nada com “${busca.trim()}” nesse dia.` : "Os pedidos com entrega nesse dia aparecem aqui."} acao={<Botao variante="suave" tamanho="m" icone={<Plus size={20} weight="bold" />} onClick={() => navigate("/vendas/novo")}>Nova venda</Botao>} />
          ) : pedidosDiaFiltrados.length === 0 ? (
            <TelaVazia icone={<Funnel size={30} />} titulo="Nenhum pedido com esse filtro" texto="Tem pedido nesse dia, mas as situações dele estão escondidas." acao={<Botao variante="suave" tamanho="m" onClick={mostrarTodas}>Mostrar todas as situações</Botao>} />
          ) : (
            <>
              <Titulo contagem={pedidosDiaFiltrados.length} className="ag3-tit" acao={
                <Botao variante="link" icone={<Printer size={16} weight="bold" />} onClick={imprimirAgendaDoDia}>Imprimir o dia{!isPro && <span className="ag3-pro">PRO</span>}</Botao>
              }>Pedidos do dia</Titulo>
              <div className="ag3-lista">
                {pedidosDiaFiltrados.map((p: any) => (
                  <CartaoAgenda key={p.id} p={p} aoAbrir={() => abrirEditar(p.id)} aoMenu={() => setMenuDe(p)} aoPronto={() => marcarComoPronto(p)} aoWhats={() => abrirWhatsApp(p)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>

    {/* Filtro por situação */}
    <Janela aberta={filtroAberto} aoFechar={() => setFiltroAberto(false)} tipo="conteudo" titulo="Ver quais situações?"
      acoes={<>
        <Botao variante="secundario" onClick={mostrarTodas}>Marcar todas</Botao>
        <Botao onClick={() => setFiltroAberto(false)}>Ver pedidos</Botao>
      </>}>
      <div className="ag3-fil">
        {FILTROS.map(f => {
          const on = f.chaves.some(c => statusSelecionados.includes(c));
          const qtd = f.chaves.reduce((s, c) => s + (countStatusDia[c] || 0), 0);
          return (
            <label key={f.nome} className={"ag3-fil-it" + (on ? " on" : "")}>
              <input type="checkbox" className="ag3-esc" checked={on} onChange={() => setStatusSelecionados(prev => on ? prev.filter(x => !f.chaves.includes(x)) : [...prev, ...f.chaves.filter(c => !prev.includes(c))])} />
              <span className="ag3-cx" aria-hidden="true"><Check size={16} weight="bold" /></span>
              <span className="ag3-fil-n">{f.nome}</span>
              {qtd > 0 && <span className="ag3-fil-q" aria-label={`${qtd} nesse dia`}>{qtd}</span>}
            </label>
          );
        })}
      </div>
    </Janela>

    {/* Mais ações do pedido */}
    <MenuAgenda p={menuDe} aoFechar={() => setMenuDe(null)}
      itens={[
        { nome: "Editar pedido", Ic: PencilSimple, fn: doMenu(p => abrirEditar(p.id)) },
        ...(menuDe && STATUS_AINDA_NAO_PRONTO.includes(menuDe.status || "agendado") ? [{ nome: "Marcar pronto", Ic: Check, fn: doMenu(marcarComoPronto) }] : []),
        { nome: "Mudar a data da entrega", Ic: CalendarBlank, fn: doMenu(p => setReagendando(p)) },
        { nome: "Duplicar pedido", Ic: Copy, fn: doMenu(duplicarPedido) },
        { nome: "Baixar PDF", Ic: FilePdf, fn: doMenu(baixarPdf) },
      ]}
      aoExcluir={doMenu(excluirPedido)}
    />

    {reagendando && (
      <CalendarioSheet valor={reagendando.data_entrega} min={isoDate(new Date())} titulo="Nova data da entrega"
        onClose={() => setReagendando(null)} onConfirmar={confirmarReagendamento} />
    )}
    </>
  );
}

/* ═══ Calendário do mês ═══ */
function Calendario({ refDate, setRefDate, diaSel, setDiaSel, dayStats, irParaHoje }: any) {
  const cells = useMemo(() => {
    const ano = refDate.getFullYear();
    const mes = refDate.getMonth();
    const primeiroDia = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    const list: Array<{ date: Date; iso: string; outroMes: boolean }> = [];
    for (let i = primeiroDia - 1; i >= 0; i--) { const d = new Date(ano, mes, -i); list.push({ date: d, iso: isoDate(d), outroMes: true }); }
    for (let d = 1; d <= totalDias; d++) { const date = new Date(ano, mes, d); list.push({ date, iso: isoDate(date), outroMes: false }); }
    let extra = 1;
    while (list.length % 7 !== 0) { const d = new Date(ano, mes + 1, extra); list.push({ date: d, iso: isoDate(d), outroMes: true }); extra++; }
    return list;
  }, [refDate]);

  const hojeISO = isoDate(new Date());
  const mesNome = MESES[refDate.getMonth()];
  const ehMesDeHoje = refDate.getMonth() === new Date().getMonth() && refDate.getFullYear() === new Date().getFullYear();

  return (
    <section className="ag3-card ag3-cal" aria-label="Calendário">
      <div className="ag3-cal-nav">
        <BotaoIcone rotulo="Mês anterior" onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}><CaretLeft size={20} weight="bold" /></BotaoIcone>
        <h2 className="ag3-cal-t">{mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} de {refDate.getFullYear()}</h2>
        <BotaoIcone rotulo="Próximo mês" onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}><CaretRight size={20} weight="bold" /></BotaoIcone>
      </div>

      <div className="ag3-sem" aria-hidden="true">{SEMANA_CURTA.map(d => <span key={d}>{d}</span>)}</div>

      <div className="ag3-dias" role="grid">
        {cells.map(c => {
          const st = dayStats[c.iso];
          const sel = c.iso === diaSel;
          const hoje = c.iso === hojeISO;
          const atr = st?.atrasado || 0;
          const qtd = st?.total || 0;
          return (
            <button
              key={c.iso + (c.outroMes ? "-o" : "")}
              type="button"
              className={"ag3-d" + (c.outroMes ? " fora" : "") + (sel ? " sel" : "") + (hoje ? " hoje" : "")}
              aria-pressed={sel}
              aria-current={hoje ? "date" : undefined}
              aria-label={`${c.date.getDate()} de ${MESES[c.date.getMonth()]}${hoje ? ", hoje" : ""}${qtd ? `, ${qtd} pedido${qtd > 1 ? "s" : ""}` : ""}${atr ? `, ${atr} atrasado${atr > 1 ? "s" : ""}` : ""}`}
              onClick={() => setDiaSel(c.iso)}
            >
              <span className="ag3-d-n">{c.date.getDate()}</span>
              <span className="ag3-d-b" aria-hidden="true">
                {atr > 0 && <i className="atr" />}
                {st?.agendado > 0 && <i className="age" />}
                {st?.producao > 0 && <i className="pro" />}
                {st?.concluido > 0 && <i className="ok" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ag3-leg" aria-hidden="true">
        <span><i className="age" />Agendado</span>
        <span><i className="pro" />Em produção</span>
        <span><i className="ok" />Pronto</span>
        <span><i className="atr" />Atrasado</span>
      </div>
    </section>
  );
}

/* ═══ Cartão do pedido na Agenda (o mesmo de antes, no padrão do guia) ═══ */
function CartaoAgenda({ p, aoAbrir, aoMenu, aoPronto, aoWhats }: any) {
  const atr = pedidoAtrasado(p);
  const sit = situacaoDe(p);
  const itens = p.pedido_itens || [];
  const total = Number(p.valor_total) || 0;
  const desconto = Number(p.desconto) || 0;
  const recebido = recebidoPedido(p);
  const falta = saldoPedido(p);
  const primeiro = itens[0];
  const foto = primeiraFoto(primeiro?.imagem_url || primeiro?.produtos?.imagem_url);
  const extras = Math.max(0, itens.length - 1);
  const podePronto = STATUS_AINDA_NAO_PRONTO.includes(p.status || "agendado");
  const temTel = telefoneValido(p.cliente_whatsapp) || telefoneValido(p.cliente_telefone);
  const cancelado = p.status === "cancelado";
  const pagamento = cancelado ? null
    : falta <= 0.009 ? { t: "Pago", tom: "verde" as const }
    : recebido > 0 ? { t: `Sinal de ${rs(recebido)}, falta ${rs(falta)}`, tom: "laranja" as const }
    : { t: `Falta receber ${rs(falta)}`, tom: "laranja" as const };
  const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome) : "Cliente não informado";
  const ref = useRef<HTMLElement>(null);

  return (
    <article ref={ref} className={"ag3-pc" + (atr ? " atr" : "")}>
      {atr && <p className="ag3-pc-atr"><WarningCircle size={16} weight="bold" aria-hidden="true" />Atrasado</p>}
      <div className="ag3-pc-topo">
        <button type="button" className="ag3-pc-abre" onClick={aoAbrir} aria-label={`Abrir o pedido #${p.numero || ""} de ${nome}`}>
          <span className="ag3-pc-ft" aria-hidden="true">
            <Package size={20} weight="bold" />
            {foto && <img src={foto} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
            {extras > 0 && <em>+{extras}</em>}
          </span>
          <span className="ag3-pc-quem">
            <b>{nome} <small>#{p.numero ?? "—"}</small></b>
            {p.created_at && <span>Feito em {criadoEmTexto(p.created_at)}</span>}
          </span>
        </button>
        <BotaoIcone rotulo={`Mais ações do pedido #${p.numero || ""}`} variante="limpo" onClick={aoMenu}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
        </BotaoIcone>
      </div>

      <div className="ag3-pc-info">
        <Linha rotulo="Situação" tom={sit.tom}>{sit.nome}</Linha>
        <Linha rotulo={p.tipo_entrega === "entrega" ? "Entrega" : "Retirada"} tom={atr ? "vermelho" : undefined}>{quandoEntrega(p)}</Linha>
        {pagamento && <Linha rotulo="Pagamento" tom={pagamento.tom}>{pagamento.t}</Linha>}
      </div>

      {itens.length > 0 && (
        <div className="ag3-pc-itens">
          {itens.map((it: any, i: number) => (
            <p key={i}><span><NomeComQtd nome={nomeDeProduto(it.nome_produto || "")} qtd={Number(it.quantidade) || 1} forma={formaDoItem(it)} /></span><span>{rs((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0))}</span></p>
          ))}
          {desconto > 0 && <p className="dim"><span>Desconto</span><span>− {rs(desconto)}</span></p>}
          <p className="tot"><span>Total</span><span>{rs(total)}</span></p>
        </div>
      )}

      {(podePronto || temTel) && (
        <div className={"ag3-pc-bts" + (podePronto && temTel ? "" : " um")}>
          {podePronto && <Botao variante="secundario" tamanho="m" onClick={aoPronto}>Marcar pronto</Botao>}
          {temTel && <Botao variante="secundario" tamanho="m" className="ag3-whats" icone={<WhatsappLogo size={20} weight="fill" />} onClick={aoWhats}>WhatsApp</Botao>}
        </div>
      )}
    </article>
  );
}

/* ═══ "Mais ações" na janela padrão (mesmo visual da lista de Pedidos) ═══ */
function MenuAgenda({ p: atual, aoFechar, itens, aoExcluir }: { p: any; aoFechar: () => void; itens: { nome: string; Ic: any; fn: () => void }[]; aoExcluir: () => void }) {
  const ultimo = useRef<any>(null);
  if (atual) ultimo.current = atual;
  const p = atual || ultimo.current;
  return (
    <Janela aberta={!!atual} aoFechar={aoFechar} tipo="conteudo" titulo={p ? `Pedido #${p.numero || ""}` : ""}>
      {p && (
        <>
          <p className="pdm-quem">{p.cliente_nome ? nomeDeGente(p.cliente_nome) : "Cliente não informado"} · {nomeDaSituacao(p.status)}</p>
          <div className="pdm">
            {itens.map(({ nome, Ic, fn }) => (
              <button key={nome} type="button" className="pdm-it" onClick={fn}>
                <span className="pdm-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><span>{nome}</span>
              </button>
            ))}
            <button type="button" className="pdm-it pdm-it--excluir" onClick={aoExcluir}>
              <span className="pdm-ic" aria-hidden="true"><Trash size={20} weight="bold" /></span><span>Excluir pedido</span>
            </button>
          </div>
        </>
      )}
    </Janela>
  );
}
