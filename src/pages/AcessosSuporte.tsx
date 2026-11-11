/**
 * (11/11) Minha conta › Acessos de suporte: o pedido da equipe Doonly (Permitir / Recusar), o acesso liberado
 * (até quando, Tirar acesso) e o histórico de entradas e saídas.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { Botao, Titulo, avisar, confirmar } from "@/components/base";
import JanelaAcessoSuporte, { AvatarSuporte } from "@/components/suporte/JanelaAcessoSuporte";
import { listarAcessos, listarHistorico, revogarAcesso, acessoValido, quemPediu, type AcessoSuporte, type EventoSuporte } from "@/lib/acessoSuporte";

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
/** o histórico com o nome de quem pediu ("Pedido do Bruno", "Bruno entrou") */
const evento = (e: string, a: AcessoSuporte | undefined) => {
  const n = a?.pedido_por_nome;
  const quem = n || "A equipe Doonly";
  const M: Record<string, string> = { pedido: n ? `Pedido do ${n}` : "Pedido de acesso", aprovado: "Você liberou o acesso", recusado: "Você recusou", entrou: `${quem} entrou`, saiu: `${quem} saiu`, revogado: "Você tirou o acesso", venceu: "O acesso venceu" };
  return M[e] || e;
};

export default function AcessosSuporte() {
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState<AcessoSuporte[] | null>(null);
  const [hist, setHist] = useState<EventoSuporte[]>([]);
  const [janela, setJanela] = useState<string | null>(null);
  const carregar = useCallback(async () => {
    try { const [a, h] = await Promise.all([listarAcessos(), listarHistorico()]); setLista(a); setHist(h); } catch { setLista([]); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  // aberto pela notificação: já mostra a janela do pedido
  useEffect(() => {
    const id = params.get("pedido");
    if (id && lista?.some(a => a.id === id && a.status === "pendente")) { setJanela(id); setParams({}, { replace: true }); }
  }, [params, lista, setParams]);

  const pendente = lista?.find(a => a.status === "pendente");
  const ativo = lista?.find(acessoValido);
  const tirar = async (a: AcessoSuporte) => {
    const ok = await confirmar({ titulo: "Tirar o acesso do suporte?", texto: "A equipe Doonly sai da sua loja na hora. Se precisar, ela pede de novo.", rotulo: "Tirar acesso", perigo: true });
    if (!ok) return;
    try { await revogarAcesso(a.id); avisar("Acesso retirado", { tipo: "ok" }); void carregar(); } catch { avisar("Não deu para tirar o acesso agora", { tipo: "erro" }); }
  };

  return (
    <>
      <AppPageHeader title="Acessos de suporte" subtitle="Quem pode mexer na sua loja" voltar="/minha-conta" />
      <div className="acs">
        {lista === null ? null : (<>
          <section className="acs-card">
            <Titulo>Agora</Titulo>
            {pendente ? (
              <div className="acs-it">
                <AvatarSuporte acesso={pendente} tamanho={40} />
                <span className="acs-tx"><b>{quemPediu(pendente)}</b><small>Pediu acesso · {dia(pendente.pedido_em)}</small></span>
                <Botao tamanho="m" onClick={() => setJanela(pendente.id)}>Ver pedido</Botao>
              </div>
            ) : ativo ? (
              <div className="acs-it">
                <AvatarSuporte acesso={ativo} tamanho={40} />
                <span className="acs-tx"><b>{quemPediu(ativo)}</b><small>Liberado até {dia(ativo.expira_em!)}{ativo.ultimo_acesso_em ? ` · entrou ${quando(ativo.ultimo_acesso_em)}` : ""}</small></span>
                <Botao variante="secundario" tamanho="m" onClick={() => tirar(ativo)}>Tirar acesso</Botao>
              </div>
            ) : <p className="acs-vz">Ninguém tem acesso à sua loja agora.</p>}
          </section>
          {hist.length > 0 && (
            <section className="acs-card">
              <Titulo>Histórico</Titulo>
              <ul className="acs-hist">{hist.map(h => <li key={h.id}><span>{evento(h.evento, lista?.find(a => a.id === h.acesso_id))}</span><small>{quando(h.em)}</small></li>)}</ul>
            </section>
          )}
        </>)}
      </div>
      <JanelaAcessoSuporte id={janela} aberta={!!janela} aoFechar={(r) => { setJanela(null); if (r) void carregar(); }} />
      <style>{`
        .acs { display: flex; flex-direction: column; gap: 12px; max-width: 640px; margin: 0 auto; padding: 12px 0 100px; font-family: var(--font-base); }
        .acs-card { background: var(--ui-branco); border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); padding: 16px; }
        .acs-it { display: flex; align-items: center; gap: 12px; margin-top: 6px; }
        .acs-tx { flex: 1; min-width: 0; }
        .acs-tx b { display: block; font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acs-tx small { display: block; font-size: 13px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .acs-vz { margin: 6px 0 0; font-size: 14.5px; color: var(--ui-texto-2); }
        .acs-hist { margin: 4px 0 0; padding: 0; list-style: none; }
        .acs-hist li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-top: 1px solid var(--ui-linha); font-size: 14px; }
        .acs-hist li:first-child { border-top: 0; }
        .acs-hist small { flex: none; color: var(--ui-texto-2); font-size: 13px; }
      `}</style>
    </>
  );
}
