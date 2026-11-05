import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";

type Conta = { id: string; descricao: string | null; valor: number; vencimento: string };

/**
 * (16/10) "Quanto dos custos fixos o mês já pagou" (ideia vista no Dora): o que entrou no mês × os custos fixos
 * cadastrados, comparado com o esperado pelo dia de hoje (dia 15 de 30 = 50%). Só aparece com custos fixos cadastrados.
 */
const real = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CustosDoMes({ recebido, fixos, mostrarVazio = false, comContas = false }: { recebido: number; fixos: number; mostrarVazio?: boolean; comContas?: boolean }) {
  const navigate = useNavigate();
  // (6.120) computador: o cartão tem a altura do gráfico; embaixo entram as próximas contas a pagar (antes sobrava um vazio)
  const [contas, setContas] = useState<Conta[] | null>(null);
  useEffect(() => {
    if (!comContas) return;
    let vivo = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("contas_pagar").select("id, descricao, valor, vencimento")
        .eq("user_id", user.id).eq("status", "pendente").order("vencimento", { ascending: true }).limit(3);
      if (vivo) setContas((data as Conta[] | null) ?? []);
    })().catch(() => { if (vivo) setContas([]); });
    return () => { vivo = false; };
  }, [comContas]);
  // (21/10) no computador aparece mesmo sem custos cadastrados (no mesmo desenho, em 0%), chamando pra cadastrar
  const vazio = !(fixos > 0);
  if (vazio && !mostrarVazio) return null;
  const hoje = new Date();
  const diasMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const esperado = Math.round((hoje.getDate() / diasMes) * 100);
  const pago = vazio ? 0 : Math.min(100, Math.round((recebido / fixos) * 100));
  const falta = vazio ? 0 : Math.max(0, (fixos * esperado) / 100 - recebido);
  const tom = pago >= 100 ? "ok" : pago >= esperado ? "ok" : "atras";

  // meia-lua: 0% à esquerda, 100% à direita
  const R = 40, C = Math.PI * R;
  const ponto = (pct: number) => { const a = Math.PI * (1 - pct / 100); return { x: 50 + R * Math.cos(a), y: 50 - R * Math.sin(a) }; };
  const m = ponto(esperado);

  return (
    <div className="cdm">
      <div className="cdm-top">
        <svg className="cdm-g" viewBox="0 0 100 56" aria-hidden="true">
          <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="#F3ECEF" strokeWidth="9" strokeLinecap="round" />
          {pago > 0 && <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke={tom === "ok" ? "#2E9E5B" : "var(--ui-rosa)"} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${(C * pago) / 100} ${C}`} />}
          <circle cx={m.x} cy={m.y} r="3.2" fill="var(--ui-branco)" stroke="var(--ui-texto-2)" strokeWidth="1.6" />
        </svg>
        <div className="cdm-tx">
          <small>Custos fixos pagos no mês</small>
          <b>{pago}%</b>
          <span>esperado hoje: {esperado}%</span>
        </div>
      </div>
      <p className="cdm-p">
        {vazio
          ? <>Cadastre aluguel, luz, gás e internet para ver quanto as entradas do mês já pagaram deles.</>
          : pago >= 100
          ? <>As entradas do mês já cobrem todos os custos fixos ({real(fixos)}). Daqui para frente, é lucro.</>
          : falta > 0.009
          ? <>As entradas cobrem <b>{pago}%</b> dos custos fixos ({real(fixos)}). Para chegar no esperado de hoje, faltam <b>{real(falta)}</b>.</>
          : <>As entradas cobrem <b>{pago}%</b> dos custos fixos ({real(fixos)}). Você está em dia com o mês.</>}
      </p>
      <button type="button" className="cdm-ver" onClick={() => navigate("/custos")}>{vazio ? "Cadastrar custos" : "Ver custos"} <CaretRight size={14} weight="bold" aria-hidden="true" /></button>
      {comContas && contas && (
        <div className="cdm-ct">
          <div className="cdm-ct-t"><span>Próximas contas</span>{contas.length > 0 && <button type="button" onClick={() => navigate("/financeiro/a-pagar")}>Ver todas <CaretRight size={14} weight="bold" aria-hidden="true" /></button>}</div>
          {contas.length === 0
            ? <p className="cdm-ct-vz">Nenhuma conta a pagar por enquanto.</p>
            : contas.map(c => {
              const dias = Math.round((new Date(c.vencimento + "T12:00:00").getTime() - new Date(new Date().toDateString()).getTime() - 12 * 3600000) / 86400000);
              const quando = dias < 0 ? "Venceu" : dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence ${c.vencimento.slice(8, 10)}/${c.vencimento.slice(5, 7)}`;
              return (
                <button type="button" key={c.id} className="cdm-ct-it" onClick={() => navigate("/financeiro/a-pagar")}>
                  <span className="cdm-ct-n"><b>{c.descricao || "Conta"}</b><small className={dias <= 0 ? "cdm-ct-atr" : ""}>{quando}</small></span>
                  <span className="cdm-ct-v">{real(Number(c.valor) || 0)}</span>
                </button>
              );
            })}
        </div>
      )}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .cdm { padding: 16px; background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); text-align: left; }
  .cdm-top { display: flex; align-items: center; gap: 14px; }
  .cdm-g { flex: none; width: 104px; height: auto; }
  .cdm-tx { min-width: 0; display: flex; flex-direction: column; }
  .cdm-tx small { font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cdm-tx b { font-size: 26px; font-weight: 600; line-height: 1.15; color: var(--ui-texto); }
  .cdm-tx span { font-size: 12.5px; color: var(--ui-texto-3); white-space: nowrap; }
  .cdm-p { margin: 12px 0 0; font-size: 13.5px; line-height: 1.5; color: var(--ui-texto-2); }
  .cdm-p b { color: var(--ui-texto); }
  .cdm-ct { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--ui-linha, #F3ECEF); }
  .cdm-ct-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; font-size: 14px; font-weight: 600; color: var(--ui-texto); }
  .cdm-ct-t button { display: inline-flex; align-items: center; gap: 2px; padding: 4px 0; border: 0; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .cdm-ct-vz { margin: 6px 0 0; font-size: 13px; color: var(--ui-texto-3); }
  .cdm-ct-it { display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 0; border: 0; border-bottom: 1px solid var(--ui-linha, #F3ECEF); background: none; font-family: inherit; text-align: left; cursor: pointer; }
  .cdm-ct-it:last-child { border-bottom: 0; }
  .cdm-ct-n { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .cdm-ct-n b { font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cdm-ct-n small { font-size: 12.5px; color: var(--ui-texto-3); }
  .cdm-ct-n small.cdm-ct-atr { color: var(--ui-vermelho, #B42318); }
  .cdm-ct-v { flex: none; font-size: 14px; font-weight: 500; color: var(--ui-texto); white-space: nowrap; }
  .cdm-ver { display: inline-flex; align-items: center; gap: 2px; min-height: 40px; margin: 4px 0 -8px -8px; padding: 0 8px; border: 0; border-radius: 8px; background: none; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
`;
