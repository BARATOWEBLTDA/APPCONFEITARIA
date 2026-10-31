import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { COMO_AGENDA, TOUR_AGENDA } from "@/lib/comoTelas";
import { montarMensagem, dadosDoPedido } from "@/lib/mensagens";
import { useNavigate, useNavigationType } from "react-router-dom";
import { CalendarBlank, CaretLeft, CaretRight, Check, Copy, FilePdf, Funnel, MagnifyingGlass, Package, PencilSimple, Printer, Trash, WarningCircle, X } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { pedidoAtrasado, STATUS_AINDA_NAO_PRONTO, STATUS_PODE_FICAR_PRONTO } from "@/lib/pedidoStatus";
import { duplicarPedido as duplicarPedidoLib } from "@/lib/duplicarPedido";
import { gerarPedidoPDF } from "@/lib/gerarPedidoPDF";
import * as pdf from "@/lib/pdfDoonly";
import { usePlano } from "@/hooks/usePlano";
import { supabase } from "@/lib/supabase";
import { buscarTudo } from "@/lib/buscarTudo";
import { explicarErro } from "@/lib/erros";
import { r2, somarReais } from "@/lib/moeda";
import { pesoLivre } from "@/lib/itemPedido";
import { useAoVoltar, useDiaAtual } from "@/hooks/useAoVoltar";
import { linkWhatsApp } from "@/lib/telefone";
import { excluirPedido as excluirPedidoNoBanco } from "@/lib/pedidosDoo";
import { registrarEtapa } from "@/lib/historicoPedido";
import { avisarDesfeito, avisarMudanca } from "@/lib/avisoPedido";
import AppPageHeader from "@/components/AppPageHeader";
import CalendarioSheet from "@/components/CalendarioSheet";
import { Botao, BotaoIcone, Linha, MenuMais, TelaVazia, Titulo, avisar, confirmar, type ItemMenuMais } from "@/components/base";
import { formaDoItem, grupoDoStatus, itemComQtd, nomeDaSituacao, nomeDeGente, nomeDoItem, precisaAceitar, qtdCurta, recebidoPedido, rs, saldoPedido, situacaoDe, telefoneValido } from "@/components/pedidos/pedidoTexto";
import { NomeComQtd } from "@/components/pedidos/CartaoPedido";
import FiltroLateral, { SITUACOES_FILTRO, STATUS_PADRAO } from "@/components/pedidos/FiltroPedidos";
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

/* (21/10) Situação no calendário: as 4 cores da legenda. "Pra aceitar" é o mesmo critério da bolinha do Pedidos
   (pedido novo, ou pedido do cardápio esperando o pagamento). Em produção entra em "Na agenda". */
type Sit = "atr" | "ace" | "age" | "ok";
const ORDEM_SIT: Sit[] = ["atr", "ace", "age", "ok"];
const praAceitar = (p: any) => ["aguardando_aceite", "novo", "pendente"].includes(p.status) || (p.status === "aguardando_pagamento" && p.origem === "cardapio");
const sitDoPedido = (p: any, hoje?: string): Sit | null => {
  if (p.status === "cancelado") return null;
  if (pedidoAtrasado(p, hoje)) return "atr";
  if (praAceitar(p)) return "ace";
  return grupoDe(p.status) === "concluido" ? "ok" : "age";
};
/** "20h", "9h30" ou "" */
const horaCurta = (h?: string | null) => {
  const m = String(h || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${Number(m[1])}h${m[2] === "00" ? "" : m[2]}`;
};

/* Filtro por situação: os mesmos nomes da lista de Pedidos ("novo" e "aguardando_aceite" são o mesmo "Novo pedido") */
/* (23/10) filtro por situação: a mesma gaveta lateral de Meus pedidos, pelos grupos de situação (antes era uma janela
   com a lista de situações cruas, e "concluido"/"pronto"/"a_caminho" ficavam de fora do filtro) */
const TODAS_SITUACOES = [...new Set(SITUACOES_FILTRO.flatMap(s => s.grupos))];

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
const diaPorExtenso = (iso: string) => { const d = parseISO(iso); return `${SEMANA[d.getDay()].replace("-feira", "")}, ${d.getDate()} de ${MESES[d.getMonth()]}`; }; // (26/10) "Segunda, 26 de outubro": cabe ao lado do "Falta receber"
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
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} às ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const ANTIGOS: Record<string, string> = { confirmado: "agendado", pronto: "finalizado", a_caminho: "em_entrega", concluido: "entregue", em_preparo: "em_producao" };
const primeiraFoto = (f?: string | null) => (f ? String(f).split(/,(?=\s*https?:)/)[0].trim() : "");
/**
 * Forma de venda do item pra escrever a quantidade (11/10): só é "kg" quando o produto por kg é de PESO LIVRE.
 * Bolo por kg com tamanho escolhido ("M · 2 kg") ou kit conta em unidades (antes saía "1 kg" na agenda e no PDF do dia).
 */
const formaNaAgenda = (it: any): string | null => {
  const forma = formaDoItem(it);
  return forma === "kg" && !pesoLivre(it, "kg") ? null : forma;
};

/* O dia escolhido fica guardado enquanto o app está aberto (11/10), com o id da conta na chave: voltar do pedido cai no mesmo dia */
const CHAVE_DIA = "doonly_agenda_dia_";
const VALE_POR = 30 * 60 * 1000;               // saiu da agenda há menos de meia hora
const VALE_POR_AO_VOLTAR = 6 * 60 * 60 * 1000; // pelo "voltar" do aparelho ou do navegador
function lerDiaGuardado(uid: string): { dia: string; eraHoje: boolean; em: number } | null {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k && k.startsWith(CHAVE_DIA) && k !== CHAVE_DIA + uid) sessionStorage.removeItem(k); }
    const g = JSON.parse(sessionStorage.getItem(CHAVE_DIA + uid) || "null");
    return g && /^\d{4}-\d{2}-\d{2}$/.test(String(g.dia)) ? g : null;
  } catch { return null; }
}

export default function Agenda() {
  const navigate = useNavigate();
  const tipoNavegacao = useNavigationType();
  const { isPro } = usePlano();
  const [userId, setUserId] = useState("");
  const hoje = useDiaAtual(); // (11/10) muda sozinho quando vira o dia

  const [refDate, setRefDate] = useState(new Date());
  const [diaSel, setDiaSel] = useState(isoDate(new Date()));
  const [busca, setBusca] = useState("");
  const [resAberto, setResAberto] = useState(false); // (23/10) lista de resultados embaixo da busca
  const topoRef = useRef<HTMLDivElement>(null);

  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [demorou, setDemorou] = useState(false);
  // (10/10) períodos (do primeiro ao último dia que o calendário mostra) que já foram buscados
  const [faixas, setFaixas] = useState<{ ini: string; fim: string }[]>([]);
  const [erroCarregar, setErroCarregar] = useState(""); // não deu pra carregar: mostra o erro com "Tentar de novo"
  const [tentativa, setTentativa] = useState(0);
  const emBusca = useRef(new Set<string>()); // períodos sendo buscados agora
  const velhas = useRef(new Set<string>());  // períodos já buscados que precisam ser buscados de novo (11/10)
  // (11/10) pedidos com uma ação em andamento: o segundo toque não muda a situação nem a data duas vezes
  const ocupadosRef = useRef(new Set<string>());
  const [ocupados, setOcupados] = useState<ReadonlySet<string>>(() => new Set());
  // (11/10) sobe a cada mudança feita aqui na tela: a recarga por trás que começou antes não sobrescreve a agenda
  const versao = useRef(0);
  const mudarPedidos = (f: (prev: any[]) => any[]) => { versao.current++; setPedidos(f); };
  const ocupar = (id: string, ligar: boolean) => {
    versao.current++;
    if (ligar) ocupadosRef.current.add(id); else ocupadosRef.current.delete(id);
    setOcupados(new Set(ocupadosRef.current));
  };
  const naTela = useRef(true);
  useEffect(() => { naTela.current = true; return () => { naTela.current = false; }; }, []);
  // (23/10) toque fora da busca ou Esc fecha a lista de resultados (tocar no campo abre de novo)
  useEffect(() => {
    if (!resAberto) return;
    const fora = (e: PointerEvent) => { if (topoRef.current && !topoRef.current.contains(e.target as Node)) setResAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setResAberto(false); };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fora); document.removeEventListener("keydown", esc); };
  }, [resAberto]);

  // Cancelados ficam de fora por padrão (dá pra ligar no filtro), igual ao total do dia
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(STATUS_PADRAO);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [reagendando, setReagendando] = useState<any | null>(null);

  /* Autenticação — (10/10) o getSession lê a conta do próprio aparelho (o getUser vai à rede: sem internet a tela ficava carregando pra sempre) */
  useEffect(() => {
    if (userId) return;
    (async () => {
      let uid = "";
      try { uid = (await supabase.auth.getSession()).data.session?.user?.id || ""; } catch { /* trata abaixo */ }
      if (uid) {
        // (11/10) volta no dia em que ela estava (voltou do pedido, ou saiu da agenda há pouco). Se o dia guardado era "hoje", vale o hoje de agora.
        const g = lerDiaGuardado(uid);
        const faz = g ? Date.now() - (Number(g.em) || 0) : Infinity;
        if (g && (faz < VALE_POR || (tipoNavegacao === "POP" && faz < VALE_POR_AO_VOLTAR))) {
          const dia = g.eraHoje ? isoDate(new Date()) : g.dia;
          setDiaSel(dia); setRefDate(parseISO(dia));
        }
        setUserId(uid);
      }
      else { setErroCarregar("Tente de novo em instantes."); setLoading(false); }
    })();
  }, [userId, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guarda o dia escolhido (a cada troca e ao sair da tela)
  useEffect(() => {
    if (!userId) return;
    const guardar = () => { try { sessionStorage.setItem(CHAVE_DIA + userId, JSON.stringify({ dia: diaSel, eraHoje: diaSel === isoDate(new Date()), em: Date.now() })); } catch { /* segue sem guardar */ } };
    guardar();
    return guardar;
  }, [userId, diaSel]);

  // O que o calendário mostra: o mês inteiro mais os dias vizinhos que completam as semanas
  const faixa = useMemo(() => {
    const ano = refDate.getFullYear(), mes = refDate.getMonth();
    const ini = new Date(ano, mes, 1 - new Date(ano, mes, 1).getDay());
    const fim = new Date(ano, mes + 1, 6 - new Date(ano, mes + 1, 0).getDay());
    return { ini: isoDate(ini), fim: isoDate(fim) };
  }, [refDate]);
  // o dia escolhido já veio do banco? (ele pode ser de um mês que não está mais no calendário)
  const diaCarregado = faixas.some(f => diaSel >= f.ini && diaSel <= f.fim);

  /* Busca de pedidos — (10/10) só o período que o calendário mostra, de 1.000 em 1.000.
     Antes buscava todos os pedidos da conta em ordem de data: o banco corta em 1.000 linhas sem avisar,
     e numa conta grande vinham os mais antigos e sumiam os de hoje. Cada mês visitado é buscado uma vez e fica guardado. */
  useEffect(() => {
    if (!userId) return;
    const chave = `${faixa.ini}_${faixa.fim}`;
    // (11/10) mês já buscado só é buscado de novo se ficou velho (voltou pro app, virou o dia): aí é por trás, sem "carregando"
    const jaTem = faixas.some(f => f.ini === faixa.ini && f.fim === faixa.fim);
    if (emBusca.current.has(chave) || (jaTem && !velhas.current.has(chave))) return;
    emBusca.current.add(chave);
    const quieto = jaTem;
    const v = versao.current;
    if (!quieto) { setLoading(true); setErroCarregar(""); }
    (async () => {
      const CAMPOS = "*, pedido_itens(nome_produto, quantidade, valor_unitario, imagem_url, personalizacoes, produtos(imagem_url, forma_venda)), clientes(foto_url)";
      // pedido sem data de entrega aparece no dia em que foi feito (no horário daqui)
      const feitoDe = parseISO(faixa.ini); feitoDe.setHours(0, 0, 0, 0);
      const feitoAte = parseISO(faixa.fim); feitoAte.setHours(24, 0, 0, 0);
      const [comData, semData] = await Promise.all([
        buscarTudo<any>((de, ate) => supabase.from("pedidos").select(CAMPOS).eq("user_id", userId)
          .gte("data_entrega", faixa.ini).lte("data_entrega", faixa.fim)
          .order("data_entrega", { ascending: true })
          .order("horario_entrega", { ascending: true, nullsFirst: false })
          .order("id").range(de, ate)),
        buscarTudo<any>((de, ate) => supabase.from("pedidos").select(CAMPOS).eq("user_id", userId)
          .is("data_entrega", null).gte("created_at", feitoDe.toISOString()).lt("created_at", feitoAte.toISOString())
          .order("id").range(de, ate)),
      ]);
      emBusca.current.delete(chave);
      if (!naTela.current) return;
      const erro = comData.error || semData.error;
      // a atualização por trás falhou, ou uma ação (marcar pronto, mudar a data) começou no meio: fica o que está na tela e tenta na próxima
      if (quieto && (erro || ocupadosRef.current.size > 0 || v !== versao.current)) { setLoading(emBusca.current.size > 0); return; }
      if (erro) {
        setErroCarregar(explicarErro(erro, "Tente de novo em instantes."));
        setLoading(emBusca.current.size > 0);
        // o dia escolhido já está na tela: o erro é só do mês novo, avisa embaixo
        if (diaCarregado) avisar("Não deu para carregar os pedidos desse mês.", { tipo: "erro", acao: { rotulo: "Tentar de novo", aoTocar: () => setTentativa(t => t + 1) } });
        return;
      }

      // Status antigos viram os atuais (senão somem da lista do dia — igual à tela de Pedidos)
      const pedidosNormalizados = [...comData.data, ...semData.data].map((p: any) => ({
        ...p,
        status: ANTIGOS[p.status] || p.status,
        // (11/10) Em que dia o pedido aparece no calendário: o da entrega; sem data de entrega, o dia em que foi feito, no horário daqui
        // (o created_at vem no horário de Londres: depois das 21h caía no dia seguinte).
        // A data de entrega continua vazia: antes ela recebia o dia da criação, e o pedido sem data virava "Ontem" e "Atrasado".
        _diaAgenda: p.data_entrega ? String(p.data_entrega).slice(0, 10) : (p.created_at ? isoDate(new Date(p.created_at)) : null),
      }));
      // entra no lugar do que já estava guardado desse período (e de pedido que mudou de data)
      const ids = new Set(pedidosNormalizados.map((p: any) => p.id));
      setPedidos(prev => [...prev.filter(p => !ids.has(p.id) && !(p._diaAgenda >= faixa.ini && p._diaAgenda <= faixa.fim)), ...pedidosNormalizados]);
      setFaixas(prev => prev.some(f => f.ini === faixa.ini && f.fim === faixa.fim) ? prev : [...prev, faixa]);
      velhas.current.delete(chave);
      setLoading(emBusca.current.size > 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, faixa.ini, faixa.fim, tentativa]);

  // (11/10) O app instalado fica aberto por dias. Ao voltar pra ele (ou a internet voltar), o mês da tela é buscado de novo
  // por trás, e os outros meses guardados são refeitos quando ela passar por eles. Antes só buscava ao abrir a tela.
  const recarregar = () => {
    faixas.forEach(f => velhas.current.add(`${f.ini}_${f.fim}`));
    setTentativa(t => t + 1);
  };
  useAoVoltar(recarregar);
  // Virou o dia com a agenda aberta: quem estava no "hoje" passa pro hoje de agora, e os meses guardados são refeitos
  const diaAnterior = useRef(hoje);
  useEffect(() => {
    if (diaAnterior.current === hoje) return;
    const ontem = diaAnterior.current;
    diaAnterior.current = hoje;
    if (diaSel === ontem) {
      setDiaSel(hoje);
      const o = parseISO(ontem);
      if (refDate.getMonth() === o.getMonth() && refDate.getFullYear() === o.getFullYear()) setRefDate(parseISO(hoje));
    }
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje]);

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
    const m: Record<string, { total: number; atr: number; ace: number; age: number; ok: number; etq: { sit: Sit; t: string; h: string }[] }> = {};
    pedidosBuscados.forEach(p => {
      const dia = p._diaAgenda; // o dia em que o pedido aparece (o da entrega; sem data, o dia em que foi feito)
      const sit = dia ? sitDoPedido(p, hoje) : null; // atrasado é pela data de ENTREGA: pedido sem data não é atrasado
      if (!dia || !sit) return;
      if (!m[dia]) m[dia] = { total: 0, atr: 0, ace: 0, age: 0, ok: 0, etq: [] };
      m[dia].total++;
      m[dia][sit]++;
      const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome).split(" ")[0] : `#${p.numero ?? ""}`;
      m[dia].etq.push({ sit, t: [horaCurta(p.horario_entrega), nome].filter(Boolean).join(" "), h: p.horario_entrega || "99" });
    });
    // no computador, as etiquetas do dia vêm pela urgência e depois pelo horário
    Object.values(m).forEach(d => d.etq.sort((a, b) => ORDEM_SIT.indexOf(a.sit) - ORDEM_SIT.indexOf(b.sit) || a.h.localeCompare(b.h)));
    return m;
  }, [pedidosBuscados, hoje]);

  const pedidosDoDia = useMemo(() =>
    pedidosBuscados
      .filter(p => p._diaAgenda === diaSel)
      .sort((a, b) => (a.horario_entrega || "99").localeCompare(b.horario_entrega || "99")),
    [pedidosBuscados, diaSel]
  );

  const pedidosDiaFiltrados = useMemo(
    () => pedidosDoDia.filter((p: any) => statusSelecionados.includes(grupoDoStatus(p.status))),
    [pedidosDoDia, statusSelecionados]
  );

  const irParaHoje = useCallback(() => {
    const h = new Date();
    setRefDate(h);
    setDiaSel(isoDate(h));
  }, []);

  /* ── Ações (as mesmas de antes) ── */
  const abrirEditar = (id: string) => navigate(`/pedidos/${id}/editar`);

  // (24/10) aviso em cartão com "Desfazer" (volta para a situação de antes)
  const avisarComDesfazer = (p: any, novo: string) => {
    const anterior = p.status;
    avisarMudanca(p, novo, {
      desfazer: anterior && anterior !== novo ? async () => {
        const { error } = await supabase.from("pedidos").update({ status: anterior }).eq("id", p.id);
        if (error) { avisar("Não deu para desfazer. Confira a internet e mude a situação no pedido.", { tipo: "erro" }); return; }
        mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, status: anterior } : x));
        registrarEtapa(p.id, anterior, `Desfeito: voltou para "${nomeDaSituacao(anterior)}"`);
        avisarDesfeito(p, anterior);
      } : undefined,
    });
  };

  const marcarComoPronto = async (p: any) => {
    if (ocupadosRef.current.has(p.id)) return; // (11/10) toque duplo: a situação muda uma vez só
    ocupar(p.id, true);
    try {
      // o mesmo caminho da lista e da tela do pedido (10/10): retirada vai pra "Pronto pra retirar"; entrega, pra "Pronto"
      const novo = p.tipo_entrega === "entrega" ? "finalizado" : "aguardando_retirada";
      const { error } = await supabase.from("pedidos").update({ status: novo }).eq("id", p.id);
      if (error) { avisar("Não deu para mudar a situação. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
      registrarEtapa(p.id, novo);
      mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, status: novo } : x));
      avisarComDesfazer(p, novo);
    } finally { ocupar(p.id, false); }
  };

  /* (21/10) Aceitar e Produzir, nos atalhos do dia vazio (o mesmo update da lista de Pedidos) */
  const mudarSituacao = async (p: any, novo: string) => {
    if (ocupadosRef.current.has(p.id)) return;
    ocupar(p.id, true);
    try {
      const { error } = await supabase.from("pedidos").update({ status: novo }).eq("id", p.id);
      if (error) { avisar("Não deu para mudar a situação. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
      registrarEtapa(p.id, novo);
      mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, status: novo } : x));
      avisarComDesfazer(p, novo);
    } finally { ocupar(p.id, false); }
  };

  const abrirWhatsApp = (p: any) => {
    const tel = [p.cliente_whatsapp, p.cliente_telefone].find(t => telefoneValido(t)) || "";
    if (!tel) { avisar("Esse cliente não tem telefone cadastrado.", { tipo: "erro" }); return; }
    const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome).split(" ")[0] : "";
    // (10/10) pelo linkWhatsApp: o DDD 55 era confundido com o código do país e o link saía sem o 55 da frente
    const link = linkWhatsApp(tel, montarMensagem("sobre_pedido", dadosDoPedido(p, nome)));
    if (!link) { avisar("O telefone desse cliente está incompleto.", { tipo: "erro" }); return; }
    window.open(link, "_blank");
  };

  const duplicando = useRef(false); // dois toques seguidos não criam duas cópias
  const duplicarPedido = async (p: any) => {
    if (duplicando.current) return;
    duplicando.current = true;
    try {
      const r = await duplicarPedidoLib(p.id);
      if ("erro" in r) { avisar(r.erro, { tipo: "erro" }); return; } // (11/10) a frase já vem em português (lib/duplicarPedido)
      avisar(`${r.aviso} Ajuste a data da cópia.`); // diz quando a cópia veio sem os descontos do pedido original
      navigate(`/pedidos/${r.id}/editar`);
    } finally { duplicando.current = false; }
  };

  const excluirPedido = async (p: any) => {
    const ok = await confirmar({ titulo: `Excluir o pedido #${p.numero || ""}?`, texto: "Ele some da agenda, da lista de pedidos e do financeiro. Não dá para desfazer.", rotulo: "Excluir", perigo: true });
    if (!ok) return;
    // (10/10) pela função única: estorna os recebimentos antes de apagar (antes o dinheiro continuava no financeiro)
    versao.current++;
    const r = await excluirPedidoNoBanco(p.id);
    if (r.ok === false) { avisar(r.erro, { tipo: "erro" }); if (r.estornou) setTentativa(t => t + 1); return; }
    mudarPedidos(prev => prev.filter(x => x.id !== p.id));
    avisar("Pedido excluído.");
  };

  const confirmarReagendamento = async (novaData: string) => {
    const p = reagendando;
    setReagendando(null);
    if (!p || ocupadosRef.current.has(p.id)) return; // (11/10) toque duplo: muda a data uma vez só
    ocupar(p.id, true);
    try {
      // (11/10) O pagamento estava previsto pro MESMO dia da entrega (o "paga na entrega" antigo gravava assim):
      // a data prevista fica vazia e o A receber passa a acompanhar a entrega. Data combinada diferente não é mexida.
      const entregaAntiga = p.data_entrega ? String(p.data_entrega).slice(0, 10) : "";
      const pagaNaEntrega = !!entregaAntiga && !!p.data_prevista_pagamento && String(p.data_prevista_pagamento).slice(0, 10) === entregaAntiga;
      const mudanca = pagaNaEntrega ? { data_entrega: novaData, data_prevista_pagamento: null } : { data_entrega: novaData };
      const { error } = await supabase.from("pedidos").update(mudanca).eq("id", p.id);
      if (error) { avisar("Não deu para mudar a data. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
      mudarPedidos(prev => prev.map(x => x.id === p.id ? { ...x, ...mudanca, _diaAgenda: novaData } : x));
      avisar(`Pedido #${p.numero || ""} foi para ${diaPorExtenso(novaData).toLowerCase()}.`);
    } finally { ocupar(p.id, false); }
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
      em_producao: ["Em produção", "am"], em_preparo: ["Em produção", "am"], em_entrega: ["Saiu para entrega", "am"], a_caminho: ["Saiu para entrega", "am"],
      aguardando_pagamento: ["Aguardando pagamento", "rd"], aguardando_aceite: ["Novo pedido", "rd"], novo: ["Novo pedido", "rd"],
    };
    const nomeOp = (v: any) => (!v ? "" : typeof v === "string" ? v : v.nome || "");
    const produzir = new Map<string, { qtd: number; forma: string | null; extra: Map<string, number> }>();
    const linhas = lista.map(p => {
      const itens = (p.pedido_itens || []).map((it: any) => {
        const tam = nomeOp(it.personalizacoes?.tamanho);
        const chave = [it.nome_produto, tam].filter(Boolean).join(" ");
        const forma = formaNaAgenda(it); // (11/10) bolo com tamanho não é "1 kg": conta em unidades
        const atual = produzir.get(chave) || { qtd: 0, forma, extra: new Map() };
        atual.qtd += Number(it.quantidade) || 1;
        (it.personalizacoes?.kit?.sabores || []).forEach((x: any) => atual.extra.set(x.nome, (atual.extra.get(x.nome) || 0) + (Number(x.qtd) || 0) * (Number(it.quantidade) || 1)));
        produzir.set(chave, atual);
        return itemComQtd(chave, Number(it.quantidade) || 1, forma, true);
      }).join(" + ");
      const [stTxt0, stCor] = STATUS_PDF[p.status] || ["Agendado", "bl"];
      const stTxt = stTxt0 === "Entregue" && p.tipo_entrega !== "entrega" ? "Retirado" : stTxt0;
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
        + (prod.length ? pdf.card("Para produzir hoje", pdf.kv(prod.map(([n, q]) => [n, pdf.esc(q)] as [string, string]))) : ""),
    }));
  };

  // "Mais ações": fecha a janela antes de fazer (assim o "voltar" do Android não se perde)
  // (31/10 · 5.84) ⋮ do pedido no padrão MenuMais (antes abria uma janela de baixo)
  const itensDoPedido = (p: any): ItemMenuMais[] => [
    { Ic: PencilSimple, t: "Editar pedido", sub: "Itens, data e pagamento", aoTocar: () => abrirEditar(p.id) },
    ...(STATUS_PODE_FICAR_PRONTO.includes(p.status || "agendado") ? [{ Ic: Check, t: "Marcar pronto", sub: "O pedido está feito", aoTocar: () => marcarComoPronto(p) }] : []),
    { Ic: CalendarBlank, t: "Mudar a data da entrega", sub: "Escolha o novo dia", aoTocar: () => setReagendando(p) },
    { Ic: Copy, t: "Duplicar pedido", sub: "Um igual, para outra data", aoTocar: () => duplicarPedido(p) },
    { Ic: FilePdf, t: "Baixar PDF", sub: "Para imprimir ou mandar", aoTocar: () => baixarPdf(p) },
    { Ic: Trash, t: "Excluir pedido", sub: "Apaga de vez", perigo: true, aoTocar: () => excluirPedido(p) },
  ];

  // Cancelado escondido é o normal: o número no botão conta só as outras situações que foram escondidas
  const filtrosDesligados = SITUACOES_FILTRO.filter(f => f.k !== "cancelado" && !f.grupos.every(g => statusSelecionados.includes(g))).length;
  const mostrarTodas = () => setStatusSelecionados(TODAS_SITUACOES);
  // 4.08: a agenda não mostra o total vendido no dia (isso é do Financeiro); mostra só o que falta receber, quando existe
  const aReceberDoDia = pedidosDoDia.filter((p: any) => p.status !== "cancelado" && saldoPedido(p) > 0.009);
  const faltaDoDia = somarReais(aReceberDoDia.map((p: any) => saldoPedido(p))); // (11/10) soma em centavos certos
  const stDia = dayStats[diaSel] || { total: 0 };
  const relDia = relativo(diaSel);
  const diaVazio = diaCarregado && stDia.total === 0; // só diz "Nenhum pedido" depois de buscar

  /* (21/10) Dia sem pedido: em vez do quadro vazio, o que precisa de atenção (atrasados) e os próximos dias.
     Busca à parte (os atrasados podem ser de meses que o calendário não carregou). Só quando o dia está vazio e sem busca. */
  const mostrarAtencao = diaVazio && !busca.trim();
  const [atencao, setAtencao] = useState<{ atr: any[]; prox: any[] } | null>(null);
  useEffect(() => {
    if (!userId || !mostrarAtencao) return;
    let vale = true;
    (async () => {
      const C = "id, numero, status, origem, cliente_nome, data_entrega, horario_entrega, tipo_entrega, pedido_itens(imagem_url, produtos(imagem_url))";
      const [a, b] = await Promise.all([
        supabase.from("pedidos").select(C).eq("user_id", userId).lt("data_entrega", hoje).in("status", STATUS_AINDA_NAO_PRONTO)
          .order("data_entrega", { ascending: false }).limit(3),
        supabase.from("pedidos").select(C).eq("user_id", userId).gte("data_entrega", hoje).in("status", STATUS_AINDA_NAO_PRONTO)
          .order("data_entrega", { ascending: true }).order("horario_entrega", { ascending: true, nullsFirst: false }).limit(3),
      ]);
      if (!vale || !naTela.current) return;
      setAtencao({ atr: a.error ? [] : (a.data || []), prox: b.error ? [] : (b.data || []) });
    })();
    return () => { vale = false; };
  }, [userId, mostrarAtencao, hoje, pedidos]);
  const temAtencao = !!atencao && (atencao.atr.length > 0 || atencao.prox.length > 0);
  const irParaDia = (iso: string) => { setRefDate(parseISO(iso)); setDiaSel(iso); };
  const acaoAtencao = (p: any, atr: boolean) => {
    // (27/10) primeiro aceitar: "Pronto" só em pedido já aceito
    if (precisaAceitar(p)) return { t: "Aceitar", fn: () => mudarSituacao(p, "agendado"), principal: true };
    if ((atr || p.status === "em_producao") && STATUS_PODE_FICAR_PRONTO.includes(p.status || "agendado")) return { t: "Pronto", fn: () => marcarComoPronto(p) };
    if (grupoDe(p.status) === "agendado" && p.status !== "aguardando_pagamento") return { t: "Produzir", fn: () => mudarSituacao(p, "em_producao") };
    return null;
  };

  /* ═══ Render ═══ */
  return (
    <>
    <AppPageHeader
      voltar="/inicio"
      title="Agenda"
      subtitle="Seus pedidos por data de entrega"
      infoIcon="📅" infoComo={COMO_AGENDA} infoTour={TOUR_AGENDA}
      infoContent={
        <>
          <p>Aqui ficam os seus <strong>pedidos por data de entrega</strong>. Veja o que precisa produzir hoje, amanhã e nos próximos dias.</p>
          <p>As bolinhas no calendário mostram a situação dos pedidos de cada dia. Vermelho quer dizer que tem pedido atrasado.</p>
        </>
      }
      infoTip={<>Escolha um dia no calendário para ver os <strong>pedidos daquele dia</strong>.</>}
    />
    <div className="ag3">
      {/* Busca + filtro */}
      <div className="ag3-topo" ref={topoRef}>
        <div className="ui-campo-c ag3-busca" onClick={e => { if (e.target === e.currentTarget) (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus(); }}>
          <span className="ui-campo-ic" aria-hidden="true"><MagnifyingGlass size={20} weight="bold" /></span>
          <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" aria-label="Buscar pedido por cliente ou número" placeholder="Buscar cliente ou número" value={busca} onChange={e => { setBusca(e.target.value); setResAberto(true); }} onFocus={() => setResAberto(true)} />
          {busca && <BotaoIcone variante="limpo" tamanho="p" rotulo="Limpar a busca" onClick={() => setBusca("")}><X size={20} weight="bold" /></BotaoIcone>}
        </div>
        <BotaoIcone className={"ag3-filtro" + (filtrosDesligados > 0 ? " on" : "")} rotulo={filtrosDesligados > 0 ? `Filtrar por situação (${filtrosDesligados} escondida${filtrosDesligados > 1 ? "s" : ""})` : "Filtrar por situação"} onClick={() => setFiltroAberto(true)}>
          <Funnel size={20} weight={filtrosDesligados > 0 ? "fill" : "bold"} />
          {filtrosDesligados > 0 && <span className="ag3-filtro-n" aria-hidden="true">{filtrosDesligados}</span>}
        </BotaoIcone>
        {resAberto && busca.trim() && <ResultadosBusca userId={userId} busca={busca} comCancelados={statusSelecionados.includes("cancelado")} onAbrir={abrirEditar} />}
      </div>

      <div className="ag3-grade">
        <Calendario refDate={refDate} setRefDate={setRefDate} diaSel={diaSel} setDiaSel={setDiaSel} dayStats={dayStats} irParaHoje={irParaHoje} />

        <div className="ag3-lado">
          {/* Resumo do dia */}
          <section className="ag3-card ag3-dia" aria-live="polite">
            <div>
              <h2>{diaPorExtenso(diaSel)}</h2>
              {/* 4.10: a contagem saiu daqui ("Pedidos do dia" logo abaixo já mostra); fica só "Hoje"/"Amanhã" e o aviso de dia vazio */}
              {(relDia || diaVazio) && <p>{relDia && <b>{relDia}</b>}{relDia && diaVazio && " · "}{diaVazio && "Nenhum pedido"}</p>}
            </div>
            {faltaDoDia > 0.009 && (
              <div className="ag3-dia-v">
                <small>Falta receber</small>
                <b>{rs(faltaDoDia)}</b>
              </div>
            )}
          </section>

          {/* Pedidos do dia */}
          {!diaCarregado && (erroCarregar || !loading) ? (
            /* (10/10) também quando o mês do dia escolhido não carregou e outro mês carregou: antes a lista ficava em branco */
            <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar os pedidos" texto={erroCarregar || "Tente de novo em instantes."} acao={<Botao variante="suave" tamanho="m" onClick={() => { setRefDate(parseISO(diaSel)); setTentativa(t => t + 1); }}>Tentar de novo</Botao>} />
          ) : !diaCarregado ? (
            demorou ? <p className="ag3-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando os pedidos…</p> : null
          ) : pedidosDoDia.length === 0 ? (
            mostrarAtencao && !atencao ? null
            : mostrarAtencao && temAtencao ? (
              <Atencao atr={atencao!.atr} prox={atencao!.prox} hoje={hoje} ocupados={ocupados} acaoDe={acaoAtencao} aoAbrir={(p: any) => abrirEditar(p.id)} aoVerDia={irParaDia} />
            ) : (
              <TelaVazia icone={<CalendarBlank size={30} />} titulo="Nenhum pedido nesse dia" texto={busca.trim() ? `Nada com “${busca.trim()}” nesse dia.` : "Os pedidos desse dia aparecem aqui."} />
            )
          ) : pedidosDiaFiltrados.length === 0 ? (
            <TelaVazia icone={<Funnel size={30} />} titulo="Nenhum pedido com esse filtro" texto="Tem pedido nesse dia, mas as situações dele estão escondidas." acao={<Botao variante="suave" tamanho="m" onClick={mostrarTodas}>Mostrar todas as situações</Botao>} />
          ) : (
            <>
              <Titulo contagem={pedidosDiaFiltrados.length} className="ag3-tit" acao={
                <Botao variante="link" icone={<Printer size={16} weight="bold" />} onClick={imprimirAgendaDoDia}>Imprimir o dia{!isPro && <span className="ag3-pro">PRO</span>}</Botao>
              }>Pedidos do dia</Titulo>
              <div className="ag3-lista">
                {pedidosDiaFiltrados.map((p: any) => (
                  <CartaoAgenda key={p.id} p={p} ocupado={ocupados.has(p.id)} aoAbrir={() => abrirEditar(p.id)} itensMenu={itensDoPedido(p)} aoPronto={() => marcarComoPronto(p)} aoWhats={() => abrirWhatsApp(p)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

    </div>

    {/* Filtro por situação: gaveta lateral, igual à de Meus pedidos; o "Ver X pedidos" conta os do dia escolhido */}
    {filtroAberto && (
      <FiltroLateral semData statusSelecionados={statusSelecionados} setStatusSelecionados={setStatusSelecionados}
        onClose={() => setFiltroAberto(false)} pedidos={pedidosDoDia} />
    )}


    {reagendando && (
      <CalendarioSheet valor={reagendando.data_entrega || ""} min={isoDate(new Date())} titulo="Nova data da entrega"
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
  const NOME_SIT: Record<Sit, string> = { atr: "atrasado", ace: "para aceitar", age: "na agenda", ok: "concluído" };

  return (
    <section className="ag3-card ag3-cal" aria-label="Calendário">
      {/* (21/10) mês à esquerda; setas e "Hoje" juntos à direita */}
      <div className="ag3-cal-nav">
        <h2 className="ag3-cal-t">{mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} {refDate.getFullYear()}</h2>
        <BotaoIcone rotulo="Mês anterior" onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1))}><CaretLeft size={20} weight="bold" /></BotaoIcone>
        <button type="button" className={"ag3-hoje-bt" + (ehMesDeHoje && diaSel === hojeISO ? " on" : "")} onClick={irParaHoje}>Hoje</button>
        <BotaoIcone rotulo="Próximo mês" onClick={() => setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1))}><CaretRight size={20} weight="bold" /></BotaoIcone>
      </div>

      <div className="ag3-sem" aria-hidden="true">{SEMANA_CURTA.map(d => <span key={d}>{d}</span>)}</div>

      <div className="ag3-dias" role="grid">
        {cells.map(c => {
          const st = dayStats[c.iso];
          const sel = c.iso === diaSel;
          const hoje = c.iso === hojeISO;
          const qtd = st?.total || 0;
          const partes = st ? ORDEM_SIT.filter(k => st[k] > 0).map(k => `${st[k]} ${NOME_SIT[k]}`) : [];
          const etq: { sit: Sit; t: string }[] = st?.etq || [];
          const cabem = etq.length > 3 ? 2 : 3;
          return (
            <button
              key={c.iso + (c.outroMes ? "-o" : "")}
              type="button"
              className={"ag3-d" + (c.outroMes ? " fora" : "") + (sel ? " sel" : "") + (hoje ? " hoje" : "") + (qtd ? " tem" : "")}
              aria-pressed={sel}
              aria-current={hoje ? "date" : undefined}
              aria-label={`${c.date.getDate()} de ${MESES[c.date.getMonth()]}${hoje ? ", hoje" : ""}${qtd ? `, ${qtd} pedido${qtd > 1 ? "s" : ""}: ${partes.join(", ")}` : ""}`}
              onClick={() => setDiaSel(c.iso)}
            >
              <span className="ag3-d-n">{c.date.getDate()}</span>
              {/* celular: bolinhas (uma por situação) */}
              <span className="ag3-d-b" aria-hidden="true">
                {ORDEM_SIT.map(k => st?.[k] > 0 ? <i key={k} className={k} /> : null)}
              </span>
              {/* computador: uma etiqueta por pedido, na cor da situação */}
              {etq.length > 0 && (
                <span className="ag3-d-e" aria-hidden="true">
                  {etq.slice(0, cabem).map((e, i) => <em key={i} className={e.sit}>{e.t}</em>)}
                  {etq.length > cabem && <em className="mais">+{etq.length - cabem} mais</em>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="ag3-leg" aria-hidden="true">
        <span><i className="atr" />Atrasado</span>
        <span><i className="ace" />Para aceitar</span>
        <span><i className="age" />Na agenda</span>
        <span><i className="ok" />Concluído</span>
      </div>
    </section>
  );
}

/* ═══ Dia vazio: "Precisa de atenção" e "Próximos dias" (21/10) ═══ */
function Atencao({ atr, prox, hoje, ocupados, acaoDe, aoAbrir, aoVerDia }: any) {
  const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const quando = (p: any, semSemana = false) => {
    const iso = String(p.data_entrega || "").slice(0, 10);
    const rel = relativo(iso);
    const dia = rel || (semSemana ? diaMes(iso) : `${SEMANA_CURTA[parseISO(iso).getDay()]} ${diaMes(iso)}`);
    return [dia, p.horario_entrega ? String(p.horario_entrega).slice(0, 5) : ""].filter(Boolean).join(" · ");
  };
  const item = (p: any, ehAtr: boolean) => {
    const it = (p.pedido_itens || [])[0];
    const foto = primeiraFoto(it?.imagem_url || it?.produtos?.imagem_url);
    const nome = p.cliente_nome ? nomeDeGente(p.cliente_nome) : "Cliente";
    const ac = acaoDe(p, ehAtr);
    return (
      <div key={p.id} className={"ag3-at-it" + (ehAtr ? " atr" : "")}>
        <button type="button" className="ag3-at-abre" onClick={() => aoAbrir(p)} aria-label={`Abrir o pedido #${p.numero || ""} de ${nome}`}>
          <span className="ag3-pc-ft" aria-hidden="true">
            <Package size={20} weight="bold" />
            {foto && <img src={foto} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = "none"; }} />}
          </span>
          <span className="ag3-at-tx">
            <b className="nm-num"><span>{nome}</span><small>#{p.numero ?? "—"}</small></b>
            <span>{ehAtr ? `Atrasado · ${quando(p, true)}` : quando(p)}</span>
          </span>
        </button>
        {ac && <Botao variante={ac.principal ? "principal" : "vinho"} tamanho="p" carregando={ocupados.has(p.id)} onClick={ac.fn}>{ac.t}</Botao>}
      </div>
    );
  };
  const diaProx = prox[0] ? String(prox[0].data_entrega).slice(0, 10) : "";
  return (
    <>
      {atr.length > 0 && (
        <section className="ag3-at ag3-at--atr">
          <h3 className="ag3-at-t atr">Precisa de atenção</h3>
          {atr.map((p: any) => item(p, true))}
        </section>
      )}
      {prox.length > 0 && (
        <section className="ag3-at ag3-at--prox">
          <h3 className="ag3-at-t">Próximos dias</h3>
          {prox.map((p: any) => item(p, pedidoAtrasado(p, hoje)))}
          {diaProx && <Botao variante="link" className="ag3-at-ver" onClick={() => aoVerDia(diaProx)}>Ver os pedidos de {relativo(diaProx).toLowerCase() || diaMes(diaProx)}</Botao>}
        </section>
      )}
    </>
  );
}

/* ═══ Cartão do pedido na Agenda (o mesmo de antes, no padrão do guia) ═══ */
function CartaoAgenda({ p, ocupado, aoAbrir, itensMenu, aoPronto, aoWhats }: any) {
  const atr = pedidoAtrasado(p);
  const sit = situacaoDe(p);
  const itens = p.pedido_itens || [];
  const total = Number(p.valor_total) || 0;
  const desconto = Number(p.desconto) || 0;
  // (24/10) a taxa de entrega e o acréscimo também aparecem: sem eles os itens não fechavam com o total
  const taxaEntrega = p.tipo_entrega === "entrega" ? Number(p.taxa_entrega) || 0 : 0;
  const acrescimo = Number(p.acrescimo) || 0;
  const recebido = recebidoPedido(p);
  const falta = saldoPedido(p);
  const primeiro = itens[0];
  const foto = primeiraFoto(primeiro?.imagem_url || primeiro?.produtos?.imagem_url);
  const extras = Math.max(0, itens.length - 1);
  const podePronto = STATUS_PODE_FICAR_PRONTO.includes(p.status || "agendado");
  const temTel = telefoneValido(p.cliente_whatsapp) || telefoneValido(p.cliente_telefone);
  const cancelado = p.status === "cancelado";
  const pagamento = cancelado ? null
    : falta <= 0.009 ? { t: "Pago", tom: "verde" as const }
    : recebido > 0 ? { t: `Falta ${rs(falta).replace(" ", "\u00A0")} · sinal pago`, tom: "laranja" as const } // (27/10) o que falta vem primeiro: com valor de 4 dígitos o fim era cortado
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
            <b className="nm-num"><span>{nome}</span><small>#{p.numero ?? "—"}</small></b>
            {p.created_at && <span>Feito em {criadoEmTexto(p.created_at)}</span>}
          </span>
        </button>
        <MenuMais rotulo={`Mais ações do pedido #${p.numero || ""}`} itens={itensMenu} />
      </div>

      <div className="ag3-pc-info">
        <Linha rotulo="Situação" tom={sit.tom}>{sit.nome}</Linha>
        <Linha rotulo={p.tipo_entrega === "entrega" ? "Entrega" : "Retirada"} tom={atr ? "vermelho" : undefined}>{quandoEntrega(p)}</Linha>
        {pagamento && <Linha rotulo="Pagamento" tom={pagamento.tom}>{pagamento.t}</Linha>}
      </div>

      {itens.length > 0 && (
        <div className="ag3-pc-itens">
          {itens.map((it: any, i: number) => (
            <p key={i}><span><NomeComQtd nome={nomeDoItem(it)} qtd={Number(it.quantidade) || 1} forma={formaNaAgenda(it)} /></span><span>{rs(r2((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 0)))}</span></p>
          ))}
          {taxaEntrega > 0 && <p className="dim"><span>Taxa de entrega</span><span>{rs(taxaEntrega)}</span></p>}
          {acrescimo > 0 && <p className="dim"><span>Acréscimo</span><span>{rs(acrescimo)}</span></p>}
          {desconto > 0 && <p className="dim"><span>Desconto</span><span>− {rs(desconto)}</span></p>}
          <p className="tot"><span>Total</span><span>{rs(total)}</span></p>
        </div>
      )}

      {(podePronto || temTel) && (
        <div className={"ag3-pc-bts" + (podePronto && temTel ? "" : " um")}>
          {podePronto && <Botao variante="secundario" tamanho="m" carregando={!!ocupado} onClick={aoPronto}>Marcar pronto</Botao>}
          {temTel && <Botao variante="secundario" tamanho="m" className="ag3-whats" icone={<IconeWhatsApp size={20} />} onClick={aoWhats}>WhatsApp</Botao>}
        </div>
      )}
    </article>
  );
}

/* ═══ "Mais ações" na janela padrão (mesmo visual da lista de Pedidos) ═══ */

/* ── (23/10) Busca: enquanto digita, uma lista logo abaixo com os pedidos de QUALQUER dia ──
   Busca no banco (não só no mês que o calendário carregou): nome do cliente, número do pedido (#1010) e telefone (6 dígitos ou mais).
   Mostra até 5, do mais novo para o mais antigo; "Ver os N pedidos" abre até 50 na própria lista. Tocar abre o pedido. */
const fotoDoPedido = (p: any) => {
  for (const it of p.pedido_itens || []) { const f = primeiraFoto(it.imagem_url) || primeiraFoto(it.produtos?.imagem_url); if (f) return f; }
  return "";
};
/** Igual ao quandoEntrega, com o ano quando não é o ano de agora */
const quandoBusca = (p: any) => {
  const t = quandoEntrega(p);
  if (!p.data_entrega || relativo(p.data_entrega)) return t;
  const ano = parseISO(p.data_entrega).getFullYear();
  return ano === new Date().getFullYear() ? t : t.replace(/^(\d+ de \S+)/, `$1 de ${ano}`);
};
const LIMITE_INICIAL = 5, LIMITE_TUDO = 50;

function ResultadosBusca({ userId, busca, comCancelados, onAbrir }: { userId: string; busca: string; comCancelados: boolean; onAbrir: (id: string) => void }) {
  const q = busca.trim();
  const [limite, setLimite] = useState(LIMITE_INICIAL);
  const [res, setRes] = useState<{ q: string; itens: any[]; total: number } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { setLimite(LIMITE_INICIAL); }, [q]);
  useEffect(() => {
    if (!userId || !q) return;
    let vivo = true;
    // espera ela parar de digitar um instante para não buscar a cada letra
    const t = window.setTimeout(async () => {
      const semEspaco = q.replace(/\s/g, "");
      const soNumero = /^#?\d+$/.test(semEspaco);
      const digitos = semEspaco.replace(/\D/g, "");
      const nome = q.replace(/[,()*%\\.:]/g, " ").replace(/\s+/g, " ").trim();
      const conds: string[] = [];
      if (!soNumero && nome) conds.push(`cliente_nome.ilike.%${nome}%`);
      if (soNumero && digitos.length <= 9) conds.push(`numero.eq.${Number(digitos)}`);
      if (digitos.length >= 6) { const tel = `%${digitos.split("").join("%")}%`; conds.push(`cliente_telefone.ilike.${tel}`, `cliente_whatsapp.ilike.${tel}`); }
      if (!conds.length) { setRes({ q, itens: [], total: 0 }); setErro(false); return; }
      let consulta = supabase.from("pedidos")
        .select("id, numero, cliente_nome, data_entrega, horario_entrega, status, created_at, pedido_itens(imagem_url, produtos(imagem_url))", { count: "exact" })
        .eq("user_id", userId).or(conds.join(","));
      if (!comCancelados) consulta = consulta.neq("status", "cancelado");
      const { data, error, count } = await consulta
        .order("data_entrega", { ascending: false, nullsFirst: false })
        .order("horario_entrega", { ascending: false, nullsFirst: false })
        .limit(limite);
      if (!vivo) return;
      if (error) { setErro(true); return; }
      setErro(false);
      setRes({ q, itens: data || [], total: count ?? (data || []).length });
    }, 250);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [userId, q, comCancelados, limite]);

  // enquanto busca a palavra nova, continua mostrando o resultado anterior (sem piscar)
  const itens = res?.itens || [];
  const titulo = erro ? "Não deu para buscar. Confira a internet."
    : !res ? "Buscando…"
    : res.total === 0 ? `Nenhum pedido com “${res.q}”`
    : `${res.total} ${res.total === 1 ? "pedido encontrado" : "pedidos encontrados"}`;
  return (
    <div className="ag3-res" role="region" aria-label="Resultados da busca">
      <p className="ag3-res-t" aria-live="polite">{titulo}</p>
      {!erro && itens.length > 0 && (
        <ul className={"ag3-res-l" + (limite > LIMITE_INICIAL ? " rola" : "")}>
          {itens.map((p: any) => {
            const atr = pedidoAtrasado({ data_entrega: p.data_entrega, status: ANTIGOS[p.status] || p.status });
            const foto = fotoDoPedido(p);
            return (
              <li key={p.id}>
                <button type="button" className="ag3-res-i" onClick={() => onAbrir(p.id)}>
                  {foto ? <img src={foto} alt="" loading="lazy" /> : <span className="ag3-res-sem" aria-hidden="true"><Package size={20} weight="bold" /></span>}
                  <span className="ag3-res-tx">
                    <b><span>{nomeDeGente(p.cliente_nome || "") || "Sem nome"}</span>{p.numero != null && <em> #{p.numero}</em>}</b>
                    <small className={atr ? "atr" : ""}>{atr ? "Atrasado · " : ""}{quandoBusca(p)}</small>
                  </span>
                  <CaretRight size={16} weight="bold" className="ag3-res-seta" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!erro && res && res.total > itens.length && limite === LIMITE_INICIAL && (
        <button type="button" className="ag3-res-mais" onClick={() => setLimite(LIMITE_TUDO)}>Ver os {res.total} pedidos</button>
      )}
      {!erro && res && limite > LIMITE_INICIAL && res.total > itens.length && (
        <p className="ag3-res-nota">Mostrando os {itens.length} mais novos. Digite mais do nome para achar o resto.</p>
      )}
    </div>
  );
}
