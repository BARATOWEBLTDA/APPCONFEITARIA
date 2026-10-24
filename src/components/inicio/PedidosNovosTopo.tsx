import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cake, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { avisar } from "@/components/base";
import { registrarEtapa } from "@/lib/historicoPedido";
import { grupoDoStatus } from "@/components/pedidos/pedidoTexto";
import { avisarMudanca } from "@/lib/avisoPedido";
import { useAgora } from "./entregasDeHoje";

/**
 * (16/10) Topo do Início no celular: o pedido novo pra aceitar (com "Aceitar" ali mesmo) e os atrasados.
 * Antes era uma faixa pequena embaixo do Acesso rápido. Com 2 ou mais pedidos novos vira um resumo com "Ver pedidos".
 */
export type PedidoNovo = {
  id: string; numero: number | null; cliente: string; status: string;
  produto: string | null; data: string | null; valor: number; criado: string; foto: string | null;
};

const real = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function ha(criado: string, agora: Date) {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(criado).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

function diaCurto(data: string | null, agora: Date) {
  if (!data) return "";
  const d = new Date(data + "T12:00:00");
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias > 1 && dias < 7) return d.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PedidosNovosTopo({ novos, atrasados, aoAceitar }: { novos: PedidoNovo[]; atrasados: number; aoAceitar: (id: string) => boolean | void }) {
  const navigate = useNavigate();
  const agora = useAgora();
  const [aceitando, setAceitando] = useState(false);
  if (!novos.length && atrasados <= 0) return null;

  const um = novos.length === 1 ? novos[0] : null;
  const podeAceitar = !!um && grupoDoStatus(um.status) === "aguardando_aceite";
  const aceitar = async () => {
    if (!um || aceitando) return;
    setAceitando(true);
    const { error } = await supabase.from("pedidos").update({ status: "agendado" }).eq("id", um.id);
    setAceitando(false);
    if (error) { avisar("Não deu para aceitar o pedido. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    registrarEtapa(um.id, "agendado");
    // o Início mostra o destaque do "Pedidos" no 1º pedido aceito (aí o aviso curto não aparece por cima)
    if (!aoAceitar(um.id)) avisarMudanca({ numero: um.numero as any, cliente_nome: (um as any).cliente_nome || (um as any).cliente || null }, "agendado");
  };
  const maisAntigo = novos.reduce((a, p) => (!a || p.criado < a ? p.criado : a), "");

  // (22/10) um cartão só, em linhas: cor só na bolinha (laranja = pra aceitar, vermelho = atrasado)
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);
  return (
    <div className="pnt">
      {um && (
        <div className="pnt-l">
          <span className="pnt-dot pnt-dot--ace" aria-hidden="true" />
          <button type="button" className="pnt-tx pnt-abre" onClick={() => navigate(`/pedidos/${um.id}`)}>
            <b>{podeAceitar ? `Pedido novo de ${um.cliente}` : `${um.cliente} · falta pagar`}</b>
            <small>{[um.produto, diaCurto(um.data, agora), real(um.valor)].filter(Boolean).join(" · ")}</small>
          </button>
          {podeAceitar
            ? <button type="button" className="pnt-bt" onClick={aceitar} disabled={aceitando}>{aceitando ? "Aceitando…" : "Aceitar"}</button>
            : <button type="button" className="pnt-bt2" onClick={() => navigate(`/pedidos/${um.id}`)}>Ver</button>}
        </div>
      )}
      {novos.length > 1 && (
        <div className="pnt-l">
          <span className="pnt-dot pnt-dot--ace" aria-hidden="true" />
          <span className="pnt-tx"><b>{novos.length} pedidos para aceitar</b><small>O mais antigo chegou {ha(maisAntigo, agora)}</small></span>
          <button type="button" className="pnt-bt" onClick={() => navigate("/pedidos?filtro=aguardando")}>Ver</button>
        </div>
      )}
      {atrasados > 0 && (
        <div className="pnt-l">
          <span className="pnt-dot pnt-dot--atr" aria-hidden="true" />
          <span className="pnt-tx"><b>{atrasados} {plural(atrasados, "pedido atrasado", "pedidos atrasados")}</b><small>A entrega já passou</small></span>
          <button type="button" className="pnt-bt2" onClick={() => navigate("/pedidos?filtro=atrasados")}>Ver</button>
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pnt { overflow: hidden; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .pnt-l { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 10px 12px 10px 16px; }
  .pnt-l + .pnt-l { border-top: 1px solid var(--ui-linha); }
  .pnt-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; }
  .pnt-dot--ace { background: #EA8A1A; }
  .pnt-dot--atr { background: var(--ui-vermelho); }
  .pnt-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pnt-abre { margin: 0; padding: 0; border: 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
  .pnt-tx b { font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pnt-tx small { font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pnt-bt, .pnt-bt2 { flex: none; min-height: 40px; padding: 0 16px; border-radius: 10px; font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .pnt-bt { border: 0; background: var(--ui-rosa); color: var(--ui-branco); }
  .pnt-bt:disabled { opacity: .7; }
  .pnt-bt2 { border: 1px solid var(--ui-borda); background: var(--ui-branco); color: var(--ui-texto); }
`;
