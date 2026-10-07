import { useNavigate } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { Botao } from "@/components/base";
import "./seuDia.css";

/**
 * "Seu dia" — o resumo do dia no topo do Início, pra celular e tablet (07/10 · 3.04).
 * Antes essas informações só existiam no computador. Aqui: quantas entregas tem hoje, o que está atrasado,
 * os pedidos novos esperando resposta e as próximas entregas. Cada número leva pra lista certa.
 * Feito no padrão do guia: cartão branco, rótulo + texto, toque de 44px, cores pelo themes.css.
 */
export interface EntregaResumo { id: string; cliente: string; data: string; valor: number; hora?: string | null }

interface Props {
  carregando: boolean;
  /** a busca falhou (sem internet, por exemplo) */
  erro: boolean;
  aoTentar: () => void;
  entregasHoje: number;
  atrasados: number;
  /** pedidos novos esperando a confeiteira aceitar */
  novos: number;
  proximaHoje: { cliente: string; hora: string } | null;
  proximas: EntregaResumo[];
  /** hoje, em AAAA-MM-DD */
  hoje: string;
}

const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const hhmm = (h?: string | null) => (h ? String(h).slice(0, 5) : "");
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** "Hoje às 15:30" · "Amanhã às 10:00" · "10 de outubro às 10:00 (Sábado)" */
function quando(data: string, hora: string | null | undefined, hoje: string): string {
  const d = new Date(data + "T12:00:00");
  const h = hhmm(hora);
  const base = new Date(hoje + "T12:00:00");
  const dias = Math.round((d.getTime() - base.getTime()) / 86400000);
  if (dias === 0) return h ? `Hoje às ${h}` : "Hoje";
  if (dias === 1) return h ? `Amanhã às ${h}` : "Amanhã";
  const dia = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
  const semana = maiuscula(d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", ""));
  return `${dia}${h ? ` às ${h}` : ""} (${semana})`;
}

export default function SeuDia({ carregando, erro, aoTentar, entregasHoje, atrasados, novos, proximaHoje, proximas, hoje }: Props) {
  const navigate = useNavigate();
  const temNumeros = entregasHoje > 0 || atrasados > 0 || novos > 0;
  const lista = proximas.slice(0, 3);
  const numeros = [
    { n: entregasHoje, rotulo: entregasHoje === 1 ? "Entrega hoje" : "Entregas hoje", para: "/agenda", tom: "" },
    { n: atrasados, rotulo: atrasados === 1 ? "Atrasado" : "Atrasados", para: "/pedidos?filtro=atrasados", tom: atrasados > 0 ? "vermelho" : "" },
    { n: novos, rotulo: novos === 1 ? "Novo pedido" : "Novos pedidos", para: "/pedidos?filtro=aguardando", tom: novos > 0 ? "laranja" : "" },
  ];

  return (
    <div className="sd">
      <div className="sd-cab">
        <h2 className="sd-t">Seu dia</h2>
        <button type="button" className="sd-link" onClick={() => navigate("/agenda")}>
          Ver agenda <CaretRight size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>

      {erro ? (
        <div className="sd-erro" role="alert">
          <p>Não deu pra carregar o seu dia. Confira a internet e tente de novo.</p>
          <Botao variante="secundario" tamanho="m" onClick={aoTentar}>Tentar de novo</Botao>
        </div>
      ) : carregando ? (
        <p className="sd-x sd-carregando" aria-live="polite">Carregando…</p>
      ) : (
        <>
          {temNumeros ? (
            <div className="sd-nums">
              {numeros.map(({ n, rotulo, para, tom }) => (
                <button key={para} type="button" className={`sd-num${tom ? ` sd-num--${tom}` : ""}${n === 0 ? " sd-num--zero" : ""}`} onClick={() => navigate(para)}>
                  <b>{n}</b>
                  <span>{rotulo}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="sd-x">{lista.length ? "Nenhuma entrega hoje." : "Nenhuma entrega marcada. Os próximos pedidos aparecem aqui."}</p>
          )}

          {proximaHoje && (
            <p className="sd-linha"><span>Próxima entrega:</span> {hhmm(proximaHoje.hora)} · {proximaHoje.cliente}</p>
          )}

          {lista.length > 0 && (
            <>
              <h3 className="sd-sub">Próximas entregas</h3>
              <ul className="sd-lista">
                {lista.map(e => (
                  <li key={e.id}>
                    <button type="button" className="sd-it" onClick={() => navigate(`/pedidos/${e.id}`)}>
                      <span className="sd-it-txt">
                        <b>{e.cliente}</b>
                        <small>{quando(e.data, e.hora, hoje)}</small>
                      </span>
                      <span className="sd-it-v">{real(e.valor)}</span>
                      <CaretRight size={16} weight="bold" className="sd-it-seta" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
