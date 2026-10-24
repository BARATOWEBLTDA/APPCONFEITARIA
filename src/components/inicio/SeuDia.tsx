import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight, Cake } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import { faltaPara, separarEntregasDeHoje, useAgora } from "./entregasDeHoje";
import "./seuDia.css";

/**
 * "Próximas entregas" (4.29, antes "Seu dia") — o resumo das entregas, logo abaixo do Acesso rápido no Início, no celular e no tablet (10/10 · 4.06, redesenho).
 * - A próxima entrega de hoje em destaque (horário grande, quanto falta, cliente e o que vai).
 * - Alertas em etiquetas pequenas, só quando existem: atrasados, pra aceitar, entregas de hoje.
 * - As próximas entregas com o dia em formato de calendário.
 * - Sem entrega hoje: faixa "Nada pra entregar hoje". Sem nada marcado: mascote e "Sua agenda está livre".
 * Pesos leves (pedido do dono): título e números 600; nomes, valores e etiquetas 500.
 */
export interface EntregaResumo {
  id: string; cliente: string; data: string; valor: number;
  hora?: string | null; produto?: string | null; tipo?: string | null;
  /** 4.29: número do pedido e foto do produto, pra lista */
  numero?: number | null; foto?: string | null;
}

interface Props {
  carregando: boolean;
  /** a busca falhou (sem internet, por exemplo) */
  erro: boolean;
  aoTentar: () => void;
  entregasHoje: number;
  atrasados: number;
  /** pedidos novos esperando a confeiteira aceitar */
  novos: number;
  proximas: EntregaResumo[];
  /** hoje, em AAAA-MM-DD */
  hoje: string;
  /** (16/10) pedidos aceitos dos próximos 7 dias (com hoje): a faixa da semana e a lista do dia tocado */
  semana?: EntregaResumo[];
}

const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const hhmm = (h?: string | null) => (h ? String(h).slice(0, 5) : "");

export default function SeuDia({ carregando, erro, aoTentar, proximas, hoje, semana, novos = 0, atrasados = 0 }: Props) {
  const navigate = useNavigate();
  const [diaSel, setDiaSel] = useState<string | null>(null);
  // (22/10) faixa de dias como a da Dora: 7 dias pra trás (cinza) e 13 pra frente; abre no "Hoje"
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const dias7 = Array.from({ length: 21 }, (_, k) => {
    const i = k - 7;
    const d = new Date(hoje + "T12:00:00"); d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { iso, passado: i < 0, n: (semana || []).filter(e => e.data === iso).length, mes: MESES[d.getMonth()], sem: i === 0 ? "Hoje" : ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()], dia: d.getDate() };
  });
  const faixaRef = useRef<HTMLDivElement>(null);
  const mostraFaixa = !!semana && !erro && !carregando;
  useLayoutEffect(() => {
    const f = faixaRef.current; if (!f) return;
    const h = f.querySelector<HTMLElement>(".sd-sd--hoje");
    if (h) f.scrollLeft = h.offsetLeft - f.offsetLeft - 16;
  }, [mostraFaixa, hoje]);

  // 11/10: destaque = a primeira entrega de hoje com hora de AGORA em diante (sem nenhuma, a primeira sem horário).
  // As de hora já passada que ainda não foram entregues viram o aviso "N passaram do horário" e saem da lista.
  // Antes o destaque era sempre a mais cedo do dia: às 20h40 ainda mostrava "15:30 · agora".
  const agora = useAgora();
  const { destaque, passaram, restantes } = separarEntregasDeHoje(proximas, hoje, agora);
  // 4.29: uma lista só, um pedido por linha (a próxima de hoje primeiro, depois as outras), até 5
  // (15/10) as de hoje com o horário já passado (e ainda não entregues) voltam pra lista, no topo, marcadas
  // "atrasado" — antes sumiam sem aviso (e o computador mostrava): agora os dois mostram igual
  const listaPadrao = [...passaram, ...(destaque ? [destaque] : []), ...restantes].slice(0, 5);
  const doDia = diaSel ? (semana || []).filter(e => e.data === diaSel).sort((a, b) => String(a.hora || "99").localeCompare(String(b.hora || "99"))) : null;
  const lista = doDia ?? listaPadrao;
  const quantoFalta = destaque?.hora ? faltaPara(hhmm(destaque.hora), agora) : "";
  const amanha = (() => { const d = new Date(hoje + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const tituloDia = (iso: string) => {
    if (iso === hoje) return "Hoje";
    if (iso === amanha) return "Amanhã";
    const d = new Date(iso + "T12:00:00");
    return `${["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()]}, ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
  };
  const linhaHora = (e: EntregaResumo) => {
    const h = hhmm(e.hora);
    if (passaram.includes(e)) return [h, "atrasado"].filter(Boolean).join(" · ");
    return [h, e === destaque ? quantoFalta : "", e.tipo === "entrega" ? "Entrega" : "Retirada"].filter(Boolean).join(" · ");
  };


  // o total do dia vem da faixa (a lista mostra até 5)
  const grupos: { data: string; titulo: string; itens: EntregaResumo[]; total: number }[] = [];
  for (const e of lista) {
    const g = grupos.find(x => x.data === e.data);
    if (g) g.itens.push(e); else grupos.push({ data: e.data, titulo: tituloDia(e.data), itens: [e], total: 0 });
  }

  grupos.forEach(g => { g.total = Math.max(g.itens.length, (semana || []).filter(e => e.data === g.data).length); });

  // 4.29: sem etiquetas (pedido do dono): só o título, o link da Agenda e os pedidos
  const nadaMarcado = !doDia && lista.length === 0;

  return (
    <div className="sd">
      <div className="sd-cab">
        <h2 className="sd-t">Próximas entregas</h2>
        <button type="button" className="sd-link" onClick={() => navigate("/agenda")}>
          Agenda <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      {mostraFaixa && (
        <div className="sd-sem" ref={faixaRef} role="group" aria-label="Pedidos por dia">
          {dias7.map(d => (
            <button type="button" key={d.iso} className={`sd-sd${diaSel === d.iso ? " on" : ""}${d.n ? " tem" : ""}${d.passado ? " sd-sd--passado" : ""}${d.iso === hoje ? " sd-sd--hoje" : ""}`} aria-pressed={diaSel === d.iso}
              onClick={() => setDiaSel(x => x === d.iso ? null : d.iso)} aria-label={`${d.sem} ${d.dia}: ${d.n} ${d.n === 1 ? "pedido" : "pedidos"}${d.iso === hoje && (atrasados > 0 || passaram.length > 0) ? ", com atraso" : ""}`}>
              {/* (22/10) como na Dora: mês em cima, número grande, dia da semana por extenso embaixo */}
              <span className="sd-sd-mes">{d.mes}</span>
              <b>{d.dia}</b>
              <small>{d.sem}</small>
            </button>
          ))}
        </div>
      )}
      {erro ? (
        <div className="sd-erro" role="alert">
          <p>Não deu para carregar o seu dia. Confira a internet e tente de novo.</p>
          <Botao variante="secundario" tamanho="m" onClick={aoTentar}>Tentar de novo</Botao>
        </div>
      ) : carregando ? (
        <p className="sd-x sd-carregando" aria-live="polite">Carregando…</p>
      ) : nadaMarcado ? (
        <div className="sd-vazio">
          <img src="/marca/leve/acenando.webp" alt="" width={56} height={56} />
          <div>
            {/* (21/10) com pedido esperando, a frase diz o que fazer (antes "Sua agenda está livre" com 3 pedidos lá em cima) */}
            <b>Nada marcado nos próximos dias</b>
            <span>{novos > 0 ? `Aceite ${novos === 1 ? "o pedido" : `os ${novos} pedidos`} para ${novos === 1 ? "ele entrar" : "eles entrarem"} aqui` : "Os pedidos aceitos aparecem aqui"}</span>
          </div>
        </div>
      ) : (
        <>
          {/* (16/10) dia vazio com a altura de uma entrega: o cartão não encolhe (antes o de baixo subia e parecia abrir) */}
          {doDia && lista.length === 0 && (
            <div className="sd-dvazio">
              <span>{diaSel! < hoje ? "Nada entregue no dia" : "Nada marcado para o dia"} {Number(diaSel!.slice(8, 10))}</span>
              <button type="button" onClick={() => setDiaSel(null)}>Ver todas</button>
            </div>
          )}
          {/* (22/10) agrupada por dia: a data vira título do grupo ("Hoje · 2 entregas") e a linha de baixo fica só com hora e tipo (antes cortava "Retir…") */}
          {grupos.map(g => (
            <div key={g.data} className="sd-pg">
              <p className="sd-pg-t">{g.titulo} · {g.total} {g.total === 1 ? "entrega" : "entregas"}</p>
              <ul className="sd-pl">
                {g.itens.map(e => (
                  <li key={e.id}>
                    <button type="button" className={`sd-pi${e === destaque ? " sd-pi--agora" : ""}${passaram.includes(e) ? " sd-pi--passou" : ""}`} onClick={() => navigate(`/pedidos/${e.id}`)}>
                      <span className="sd-pi-foto">{e.foto ? <img src={e.foto} alt="" loading="lazy" /> : <Cake size={22} aria-hidden="true" />}</span>
                      <span className="sd-pi-tx">
                        <span className="sd-pi-l1"><b>{e.cliente}</b>{e.numero ? <em>#{e.numero}</em> : null}</span>
                        {e.produto && <small className="sd-pi-pr">{e.produto}</small>}
                        <small className="sd-pi-q">{linhaHora(e)}</small>
                      </span>
                      <span className="sd-pi-v">{real(e.valor)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
