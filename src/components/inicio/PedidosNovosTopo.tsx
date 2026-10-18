import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cake, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { avisar } from "@/components/base";
import { registrarEtapa } from "@/lib/historicoPedido";
import { avisoDaMudanca, grupoDoStatus } from "@/components/pedidos/pedidoTexto";
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
    if (error) { avisar("Não deu pra aceitar o pedido. Confira a internet e tente de novo.", { tipo: "erro" }); return; }
    registrarEtapa(um.id, "agendado");
    // o Início mostra o destaque do "Pedidos" no 1º pedido aceito (aí o aviso curto não aparece por cima)
    if (!aoAceitar(um.id)) avisar(avisoDaMudanca({ numero: um.numero as any }, "agendado"));
  };
  const maisAntigo = novos.reduce((a, p) => (!a || p.criado < a ? p.criado : a), "");

  return (
    <div className="pnt">
      {um && (
        <div className="pnt-novo">
          <div className="pnt-cab"><i aria-hidden="true" /><b>{podeAceitar ? "Pedido novo pra aceitar" : "Pedido novo · falta pagar"}</b><span>{ha(um.criado, agora)}</span></div>
          <div className="pnt-it">
            <span className="pnt-ft" aria-hidden="true">{um.foto ? <img src={um.foto} alt="" /> : <Cake size={24} weight="bold" />}</span>
            <span className="pnt-tx"><b>{um.cliente}</b><small>{[um.produto, diaCurto(um.data, agora)].filter(Boolean).join(" · ")}</small></span>
            <span className="pnt-vl">{real(um.valor)}</span>
          </div>
          <div className="pnt-acoes">
            <button type="button" className="pnt-ver" onClick={() => navigate(`/pedidos/${um.id}`)}>Ver pedido</button>
            {podeAceitar && <button type="button" className="pnt-ok" onClick={aceitar} disabled={aceitando}>{aceitando ? "Aceitando…" : "Aceitar"}</button>}
          </div>
        </div>
      )}
      {novos.length > 1 && (
        <div className="pnt-novo">
          <div className="pnt-cab"><i aria-hidden="true" /><b>Pedidos novos pra aceitar</b></div>
          <div className="pnt-multi">
            <span className="pnt-num">{novos.length}</span>
            <span className="pnt-tx"><b>{novos.length} esperando</b><small>Mais antigo {ha(maisAntigo, agora)}</small></span>
            <button type="button" className="pnt-bt" onClick={() => navigate("/pedidos?filtro=aguardando")}>Ver pedidos</button>
          </div>
        </div>
      )}
      {atrasados > 0 && (
        <button type="button" className="pnt-atr" onClick={() => navigate("/pedidos?filtro=atrasados")}>
          <span className="pnt-an">{atrasados}</span>
          <span className="pnt-tx"><b>{atrasados === 1 ? "Pedido atrasado" : "Pedidos atrasados"}</b><small>A entrega já passou</small></span>
          <span className="pnt-av">Ver <CaretRight size={14} weight="bold" aria-hidden="true" /></span>
        </button>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pnt { display: flex; flex-direction: column; gap: 10px; font-family: var(--font-base); text-align: left; }
  /* (18/10) faixa em degradê verde e bolinha piscando */
  .pnt-novo { background: var(--ui-branco); border: 1.5px solid #7CCB9C; border-radius: var(--ui-raio-cartao); overflow: hidden; }
  .pnt-cab { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: linear-gradient(90deg, #1F8A4C, #3FB873); color: var(--ui-branco); white-space: nowrap; }
  .pnt-cab i { flex: none; width: 8px; height: 8px; border-radius: 50%; background: #fff; animation: pntPisca 1.2s ease-in-out infinite; }
  @keyframes pntPisca { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 255, 255, .7); } 50% { opacity: .45; box-shadow: 0 0 0 5px rgba(255, 255, 255, 0); } }
  @media (prefers-reduced-motion: reduce) { .pnt-cab i { animation: none; } }
  .pnt-cab b { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 13.5px; font-weight: 700; }
  .pnt-cab span { margin-left: auto; flex: none; font-size: 12.5px; font-weight: 600; color: rgba(255, 255, 255, .88); }
  .pnt-it, .pnt-multi { display: flex; align-items: center; gap: 12px; padding: 14px; }
  .pnt-ft { flex: none; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 10px; background: var(--primary-light, #FCE0E9); color: var(--ui-rosa-escuro); overflow: hidden; }
  .pnt-ft img { width: 100%; height: 100%; object-fit: cover; }
  .pnt-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .pnt-tx b { font-size: 15px; font-weight: 700; line-height: 1.3; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pnt-tx small { font-size: 13px; line-height: 1.4; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pnt-vl { flex: none; font-size: 15px; font-weight: 700; color: var(--ui-texto); white-space: nowrap; }
  .pnt-acoes { display: flex; gap: 8px; padding: 0 14px 14px; }
  .pnt-ver, .pnt-ok { flex: 1; min-height: 46px; border: 0; border-radius: 10px; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .pnt-ver { background: #F3EEF0; color: var(--ui-texto); }
  .pnt-ok { background: #2E9E5B; color: var(--ui-branco); box-shadow: 0 3px 0 #1F7A45; }
  .pnt-ok:disabled { opacity: .7; }
  .pnt-num { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: #E7F6ED; color: #1F7A45; font-size: 22px; font-weight: 700; }
  .pnt-bt { flex: none; min-height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--chocolate); color: var(--ui-branco); font-family: inherit; font-size: 14px; font-weight: 700; white-space: nowrap; cursor: pointer; }
  .pnt-atr { display: flex; align-items: center; gap: 12px; width: 100%; margin: 0; padding: 12px 14px; border: 0; border-radius: var(--ui-raio-cartao); background: #FDECEC; font-family: inherit; text-align: left; cursor: pointer; }
  .pnt-an { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: var(--ui-branco); color: #B42318; font-size: 18px; font-weight: 700; }
  .pnt-atr .pnt-tx b { color: #7A1A12; }
  .pnt-atr .pnt-tx small { color: #9A3A32; font-size: 12.5px; }
  .pnt-av { flex: none; display: flex; align-items: center; gap: 2px; font-size: 14px; font-weight: 700; color: #B42318; }
  @media (max-width: 374px) { .pnt-vl { font-size: 14px; } .pnt-it, .pnt-multi { gap: 10px; } .pnt-bt { padding: 0 12px; } }
`;
