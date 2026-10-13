import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import Folha from "@/components/financeiro/Folha";
import { ReceberSheet } from "@/pages/FinanceiroAReceber";
import { carregarAReceber, type ItemReceber } from "@/lib/contasReceber";
import { supabase } from "@/lib/supabase";

/**
 * "Receber pedido" (4.29): escolhe o pedido e cai direto na janela de receber, com o que falta já preenchido.
 * Com um pedido só, já abre a janela de receber. A busca procura pelo nome do cliente ou pelo número.
 */
const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const semAcento = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const quando = (d: number | null) => d === null ? "" : d < 0 ? (d === -1 ? "atrasado 1 dia" : `atrasado ${-d} dias`) : d === 0 ? "hoje" : d === 1 ? "amanhã" : "";

export default function ReceberPedidoSheet({ itens: dados, inicial, onClose, onFeito }: {
  /** lista já carregada (sem ela, busca agora) */
  itens?: ItemReceber[] | null;
  /** abre direto neste pedido */
  inicial?: ItemReceber | null;
  onClose: () => void;
  onFeito: (msg: string) => void;
}) {
  const [itens, setItens] = useState<ItemReceber[] | null>(dados || null);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState<ItemReceber | null>(inicial || null);
  useEffect(() => {
    if (dados) return;
    let cancel = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancel) setErro(true); return; }
      const r = await carregarAReceber(user.id);
      if (cancel) return;
      setItens(r.itens); setErro(r.erro);
      if (!r.erro && r.itens.length === 1 && !inicial) setEscolhido(r.itens[0]);
    })();
    return () => { cancel = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (dados && dados.length === 1 && !inicial) setEscolhido(dados[0]); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = useMemo(() => {
    const q = semAcento(busca.trim()).replace(/^#/, "");
    if (!itens) return [];
    return itens.filter(i => !q || semAcento(String(i.cliente_nome || "")).includes(q) || String(i.numero ?? "") === q);
  }, [itens, busca]);

  if (escolhido) return <ReceberSheet item={escolhido} onClose={onClose} onFeito={onFeito} />;

  return (
    <Folha titulo="Receber pedido" onClose={onClose}>
      <div className="rp-busca"><MagnifyingGlass size={18} aria-hidden="true" />
        <input autoComplete="off" placeholder="Buscar cliente ou nº do pedido" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar pedido" /></div>
      {!itens && !erro && <p className="rp-msg">Carregando…</p>}
      {erro && <p className="rp-msg">Não deu pra carregar. Confira a internet e tente de novo.</p>}
      {itens && !erro && itens.length === 0 && <p className="rp-msg">Nenhum pedido com valor a receber.</p>}
      {itens && itens.length > 0 && lista.length === 0 && <p className="rp-msg">Nenhum pedido com esse nome ou número.</p>}
      <ul className="rp-lista">
        {lista.map(i => {
          const q = quando(i.dias);
          return (
            <li key={i.id}>
              <button type="button" onClick={() => setEscolhido(i)}>
                <span className="rp-tx">
                  <b>{i.cliente_nome || "Cliente sem nome"}</b>
                  <small>{[i.numero != null ? `#${i.numero}` : "", i.dataRef ? `entrega ${dm(i.dataRef)}` : "sem data"].filter(Boolean).join(" · ")}
                    {q && <em className={i.dias !== null && i.dias < 0 ? "atr" : ""}>{q}</em>}</small>
                </span>
                <span className="rp-vl"><b>{brl(i.falta)}</b><small>{i.recebido > 0 ? `de ${brl(i.total)}` : "falta tudo"}</small></span>
              </button>
            </li>
          );
        })}
      </ul>
      <style>{CSS}</style>
    </Folha>
  );
}

const CSS = `
  .rp-busca { display: flex; align-items: center; gap: 8px; min-height: 46px; padding: 0 12px; border-radius: var(--ui-raio); background: var(--ui-cinza); color: var(--ui-texto-3); }
  .rp-busca input { flex: 1; min-width: 0; height: 44px; border: 0; outline: 0; background: none; font-family: inherit; font-size: 16px; color: var(--ui-texto); }
  .rp-msg { margin: 16px 0 4px; font-size: 14px; color: var(--ui-texto-2); }
  .rp-lista { list-style: none; margin: 8px 0 0; padding: 0; }
  .rp-lista li + li { border-top: 1px solid #F3ECEF; }
  .rp-lista button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 62px; margin: 0; padding: 10px 2px; border: 0; background: none; font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
  .rp-lista button:hover { background: #FCFAFB; }
  .rp-tx { flex: 1; min-width: 0; }
  .rp-tx b, .rp-tx small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rp-tx b { font-size: 15px; font-weight: 600; }
  .rp-tx small { margin-top: 2px; font-size: 13px; color: var(--ui-texto-2); }
  .rp-tx em { margin-left: 6px; font-style: normal; font-size: 12px; font-weight: 500; color: #B45309; }
  .rp-tx em.atr { color: var(--ui-vermelho); }
  .rp-vl { flex: none; text-align: right; }
  .rp-vl b { display: block; font-size: 15px; font-weight: 600; color: #B45309; white-space: nowrap; }
  .rp-vl small { display: block; font-size: 12px; color: var(--ui-texto-3); white-space: nowrap; }
`;
