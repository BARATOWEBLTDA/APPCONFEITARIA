import { useNavigate } from "react-router-dom";
import { CaretRight, CheckCircle } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import "./seuDia.css";

/**
 * "Seu dia" — o resumo do dia no topo do Início, no celular e no tablet (10/10 · 4.06, redesenho).
 * - A próxima entrega de hoje em destaque (horário grande, quanto falta, cliente e o que vai).
 * - Alertas em etiquetas pequenas, só quando existem: atrasados, pra aceitar, entregas de hoje.
 * - As próximas entregas com o dia em formato de calendário.
 * - Sem entrega hoje: faixa "Nada pra entregar hoje". Sem nada marcado: mascote e "Sua agenda está livre".
 * Pesos leves (pedido do dono): título e números 600; nomes, valores e etiquetas 500.
 */
export interface EntregaResumo {
  id: string; cliente: string; data: string; valor: number;
  hora?: string | null; produto?: string | null; tipo?: string | null;
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
}

const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const hhmm = (h?: string | null) => (h ? String(h).slice(0, 5) : "");

/** "em 2h", "em 40 min", "agora" */
function falta(hora: string): string {
  const [h, m] = hora.split(":").map(Number);
  const alvo = new Date(); alvo.setHours(h, m || 0, 0, 0);
  const min = Math.round((alvo.getTime() - Date.now()) / 60000);
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min} min`;
  const horas = Math.floor(min / 60), resto = min % 60;
  return resto >= 30 && horas < 3 ? `em ${horas}h${String(resto).padStart(2, "0")}` : `em ${horas}h`;
}

/** dia em formato de calendário: { n: "11", s: "dom" } — hoje vira "hoje" */
function diaCal(data: string, hoje: string) {
  const d = new Date(data + "T12:00:00");
  const s = data === hoje ? "hoje" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").toLowerCase();
  return { n: String(d.getDate()), s };
}

export default function SeuDia({ carregando, erro, aoTentar, entregasHoje, atrasados, novos, proximas, hoje }: Props) {
  const navigate = useNavigate();

  // destaque: a primeira entrega de hoje (com horário primeiro; se nenhuma tiver, a primeira do dia)
  const deHoje = proximas.filter(e => e.data === hoje);
  const destaque = deHoje.find(e => e.hora) || deHoje[0] || null;
  const lista = proximas.filter(e => e !== destaque).slice(0, 3);

  const chips = [
    atrasados > 0 && { k: "atr", txt: `${atrasados} ${atrasados === 1 ? "atrasado" : "atrasados"}`, tom: "vermelho", para: "/pedidos?filtro=atrasados" },
    novos > 0 && { k: "nov", txt: `${novos} pra aceitar`, tom: "amarelo", para: "/pedidos?filtro=aguardando" },
    entregasHoje > 0 && { k: "hoj", txt: `${entregasHoje} ${entregasHoje === 1 ? "entrega hoje" : "entregas hoje"}`, tom: "", para: "/agenda" },
  ].filter(Boolean) as { k: string; txt: string; tom: string; para: string }[];

  const nadaMarcado = !destaque && lista.length === 0 && chips.length === 0;

  return (
    <div className="sd">
      <div className="sd-cab">
        <h2 className="sd-t">Seu dia</h2>
        <button type="button" className="sd-link" onClick={() => navigate("/agenda")}>
          Agenda <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      {erro ? (
        <div className="sd-erro" role="alert">
          <p>Não deu pra carregar o seu dia. Confira a internet e tente de novo.</p>
          <Botao variante="secundario" tamanho="m" onClick={aoTentar}>Tentar de novo</Botao>
        </div>
      ) : carregando ? (
        <p className="sd-x sd-carregando" aria-live="polite">Carregando…</p>
      ) : nadaMarcado ? (
        <div className="sd-vazio">
          <img src="/marca/leve/acenando.webp" alt="" width={56} height={56} />
          <div>
            <b>Sua agenda está livre</b>
            <span>Quando chegar um pedido, ele aparece aqui.</span>
          </div>
        </div>
      ) : (
        <>
          {destaque ? (
            <button type="button" className="sd-prox" onClick={() => navigate(`/pedidos/${destaque.id}`)}>
              <span className="sd-hora">
                {destaque.hora ? <><b>{hhmm(destaque.hora)}</b><small>{falta(hhmm(destaque.hora))}</small></> : <><b>Hoje</b><small>sem horário</small></>}
              </span>
              <span className="sd-prox-tx">
                <em>{destaque.tipo === "retirada" ? "Próxima retirada" : "Próxima entrega"}</em>
                <b>{destaque.cliente}</b>
                {destaque.produto && <span>{destaque.produto}</span>}
              </span>
              <span className="sd-prox-seta" aria-hidden="true"><CaretRight size={16} weight="bold" /></span>
            </button>
          ) : (
            <p className="sd-calmo"><CheckCircle size={20} weight="bold" aria-hidden="true" />Nada pra entregar hoje</p>
          )}

          {chips.length > 0 && (
            <div className="sd-chips">
              {chips.map(c => (
                <button key={c.k} type="button" className={`sd-chip${c.tom ? ` sd-chip--${c.tom}` : ""}`} onClick={() => navigate(c.para)}>
                  {c.tom && <i aria-hidden="true" />}{c.txt}
                </button>
              ))}
            </div>
          )}

          {lista.length > 0 && (
            <>
              <h3 className="sd-sub">{lista.some(e => e.data === hoje) ? "Próximas entregas" : "Próximos dias"}</h3>
              <ul className="sd-lista">
                {lista.map(e => {
                  const d = diaCal(e.data, hoje);
                  const detalhe = [e.produto, hhmm(e.hora)].filter(Boolean).join(" · ");
                  return (
                    <li key={e.id}>
                      <button type="button" className="sd-it" onClick={() => navigate(`/pedidos/${e.id}`)}>
                        <span className="sd-dia"><b>{d.n}</b><small>{d.s}</small></span>
                        <span className="sd-it-txt">
                          <b>{e.cliente}</b>
                          {detalhe && <small>{detalhe}</small>}
                        </span>
                        <span className="sd-it-v">{real(e.valor)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
