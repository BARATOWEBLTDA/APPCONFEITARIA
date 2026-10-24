import { useEffect, useMemo, useRef, useState } from "react";
import { avisar } from "@/components/base";
import { Receipt, Check, WarningCircle } from "@phosphor-icons/react";
import { criarPedido, novoIdTentativa, montarPedido, procurarClientesPorNome, subtotalDe, totalDe, type RascunhoPedido, type ProdutoCat, type ClienteCat, type DadosPedido } from "@/lib/pedidosDoo";
import { explicarErro } from "@/lib/erros";
import { r2 } from "@/lib/moeda";

/**
 * Cartão de conferência do pedido (02/10): mostra o que a Doo entendeu, com os PREÇOS do cardápio.
 * "Editar" abre a Nova venda já preenchida; "Registrar pedido" salva com a mesma função da Nova venda.
 */
export default function CartaoPedidoDoo({ uid, rascunho, catalogo, estado, numero, onEditar, onFeito }: {
  uid: string;
  rascunho: RascunhoPedido;
  catalogo: { produtos: ProdutoCat[]; clientes: ClienteCat[] };
  estado: "pendente" | "salvo" | "cancelado";
  numero?: string | number;
  onEditar: (dados: DadosPedido) => void;
  onFeito: (estado: "salvo" | "cancelado", info?: { id: string; numero?: number; resumo: string }) => void;
}) {
  // (11/10) A Doo só recebe parte das clientes: quando vem um nome sem cliente escolhida e ele não está na lista,
  // procura no banco antes de tratar como "cliente nova" (antes a cliente antiga era cadastrada de novo).
  const idDito = rascunho.cliente?.id || "";
  const nomeDito = String(rascunho.cliente?.nome || "").trim();
  const [busca, setBusca] = useState<{ nome: string; achadas: ClienteCat[] } | null>(null); // a última busca que terminou
  const precisaProcurar = estado === "pendente" && !!nomeDito && !(idDito && catalogo.clientes.some(c => c.id === idDito));
  const procurando = precisaProcurar && busca?.nome !== nomeDito; // enquanto procura, o "Registrar pedido" espera
  useEffect(() => {
    if (!precisaProcurar) return;
    let cancel = false;
    // se a busca falhar, segue com o que a lista tem (a falha fica no console, em lib/pedidosDoo)
    procurarClientesPorNome(uid, nomeDito).catch(() => [] as ClienteCat[]).then(l => { if (!cancel) setBusca({ nome: nomeDito, achadas: l }); });
    // internet travada: depois de uns segundos o botão é liberado (a busca ainda vale se chegar depois)
    const espera = window.setTimeout(() => { if (!cancel) setBusca(b => (b?.nome === nomeDito ? b : { nome: nomeDito, achadas: [] })); }, 6000);
    return () => { cancel = true; window.clearTimeout(espera); };
  }, [precisaProcurar, uid, nomeDito]);
  const catalogoCompleto = useMemo(() => {
    const novas = (busca?.nome === nomeDito ? busca.achadas : []).filter(a => !catalogo.clientes.some(c => c.id === a.id));
    return novas.length ? { produtos: catalogo.produtos, clientes: [...catalogo.clientes, ...novas] } : catalogo;
  }, [catalogo, busca, nomeDito]);
  const { dados, problemas } = useMemo(() => montarPedido(rascunho, catalogoCompleto), [rascunho, catalogoCompleto]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // (11/10) cliente nova já cadastrada numa tentativa que falhou: a próxima tentativa usa a mesma (não cadastra de novo)
  const clienteCriada = useRef<string | null>(null);
  const travado = useRef(false); // dois toques seguidos não registram dois pedidos
  const idTentativa = useRef(novoIdTentativa()); // (17/10 · R07) tocar de novo depois de a internet cair não duplica
  const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const total = totalDe(dados);
  const quando = dados.tipo === "pronta_entrega" ? "Hoje (pronta entrega)"
    : dados.dataEntrega ? `${new Date(dados.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(".", "")}${dados.horarioEntrega ? ` · ${dados.horarioEntrega.slice(0, 5)}` : ""}` : "—";
  const end = [[dados.endereco.rua, dados.endereco.numero].filter(Boolean).join(", "), dados.endereco.bairro].filter(Boolean).join(" · ");
  const pag = dados.situacaoPag === "total" ? `Pago · ${dados.formaPagamento}`
    : dados.situacaoPag === "parcial" ? `Sinal de ${brl(dados.valorParcial)} · ${dados.formaPagamento}`
    : dados.situacaoPag === "na_entrega" ? `Paga na ${dados.tipoEntrega === "entrega" ? "entrega" : "retirada"} · ${dados.formaPagamento}`
    : `A receber${dados.dataPrevistaPagamento ? ` até ${new Date(dados.dataPrevistaPagamento + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}`;

  const registrar = async () => {
    if (travado.current) return;
    travado.current = true;
    setSalvando(true); setErro("");
    try {
      const res = await criarPedido(uid, { ...(dados.clienteNovo && !dados.clienteId && clienteCriada.current ? { ...dados, clienteId: clienteCriada.current } : dados), idTentativa: idTentativa.current });
      if (res.ok === false) {
        // (11/10) não gravou (ou gravou sem os produtos e foi desfeito): mostra o erro, em português, e o cartão continua aberto
        if (dados.clienteNovo && res.clienteId) clienteCriada.current = res.clienteId;
        setErro(res.erro); return;
      }
      const p: any = res.pedido;
      if (res.aviso) avisar(res.aviso, { tipo: "erro" }); // (10/10) pedido salvo, recebimento não
      onFeito("salvo", { id: p.id, numero: p.numero, resumo: `${dados.clienteNome || "venda avulsa"}, ${brl(total)}` });
    } catch (e) {
      setErro(explicarErro(e, "Não deu para registrar o pedido. Tente de novo."));
    } finally { travado.current = false; setSalvando(false); }
  };

  if (estado !== "pendente") {
    return (
      <div className={`cpd cpd--fim${estado === "cancelado" ? " cpd--cancel" : ""}`}>
        <span className="cpd-ok">{estado === "salvo" ? <Check size={16} weight="bold" /> : "×"}</span>
        <span>{estado === "salvo" ? `Pedido${numero ? ` #${numero}` : ""} registrado` : "Pedido cancelado"}</span>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div className="cpd">
      <div className="cpd-hd"><span className="cpd-ic"><Receipt size={20} /></span>
        <div><p className="cpd-k">NOVO PEDIDO · {dados.tipo === "pronta_entrega" ? "PRONTA ENTREGA" : "ENCOMENDA"}</p><b>{dados.clienteNome || "Venda avulsa"}{dados.clienteNovo && <span className="cpd-tag">cliente nova</span>}</b></div></div>

      <div className="cpd-itens">
        {dados.itens.map((it, k) => (
          <div className="cpd-it" key={k}>
            <span className="cpd-q">{it.quantidade}×</span>
            <span className="cpd-n"><b>{it.nome_produto}{it.opcaoLabel ? ` · ${it.opcaoLabel}` : ""}</b>{it.observacoes && <small>{it.observacoes}</small>}</span>
            <span className="cpd-v">{brl(r2(it.valor_unitario * it.quantidade))}</span>
          </div>
        ))}
      </div>

      <dl className="cpd-kv">
        <dt>Quando</dt><dd>{quando}</dd>
        <dt>Como</dt><dd>{dados.tipoEntrega === "entrega" ? `Entrega${end ? ` · ${end}` : ""}` : "Retirada"}</dd>
        {dados.tipoEntrega === "entrega" && dados.taxaEntrega > 0 && <><dt>Frete</dt><dd>{brl(dados.taxaEntrega)}</dd></>}
        {dados.desconto > 0 && <><dt>Desconto</dt><dd className="cpd-neg">− {brl(dados.desconto)}</dd></>}
        <dt>Pagamento</dt><dd>{pag}</dd>
        {dados.observacoes && <><dt>Obs.</dt><dd>{dados.observacoes}</dd></>}
      </dl>

      <div className="cpd-tot">
        <div><span>Total</span><b>{brl(total)}</b></div>
        {dados.situacaoPag === "parcial" && dados.valorParcial > 0 && dados.valorParcial < total && <div className="cpd-falta"><span>Falta receber</span><b>{brl(r2(total - dados.valorParcial))}</b></div>}
        {subtotalDe(dados.itens) !== total && <small>Produtos {brl(subtotalDe(dados.itens))}</small>}
      </div>

      {problemas.length > 0 && (
        <div className="cpd-prob">{problemas.map(p => <p key={p}><WarningCircle size={15} weight="fill" />{p}</p>)}</div>
      )}
      {erro && <p className="cpd-erro">{erro}</p>}
      <div className="cpd-bts">
        <button type="button" className="cpd-b2" onClick={() => onEditar(dados.clienteNovo && !dados.clienteId && clienteCriada.current ? { ...dados, clienteId: clienteCriada.current, clienteNovo: false } : dados)}>Editar</button>
        <button type="button" className="cpd-b1" onClick={registrar} disabled={salvando || procurando || problemas.length > 0}>{salvando ? "Registrando…" : "Registrar pedido"}</button>
      </div>
      <button type="button" className="cpd-x" onClick={() => onFeito("cancelado")}>Cancelar</button>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .cpd { margin-top: 10px; background: var(--ui-branco); border: 1.5px solid #F7C6D9; border-radius: var(--ui-raio-cartao); padding: 14px; font-family: var(--font-base); color: var(--ui-texto); max-width: 340px; }
  .cpd-hd { display: flex; gap: 11px; align-items: center; padding-bottom: 10px; border-bottom: 1px solid var(--ui-linha); }
  .cpd-ic { width: 40px; height: 40px; border-radius: var(--ui-raio-p); background: var(--primary-light); color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cpd-k { margin: 0; font-size: 12px; font-weight: 700; color: var(--ui-rosa); }
  .cpd-hd b { display: flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 700; margin-top: 1px; flex-wrap: wrap; }
  .cpd-tag { font-size: 12px; font-weight: 700; color: #1D4ED8; background: #DBEAFE; padding: 2px 7px; border-radius: 6px; }
  .cpd-itens { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
  .cpd-it { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
  .cpd-q { font-weight: 700; color: var(--ui-rosa-escuro); min-width: 22px; }
  .cpd-n { flex: 1; min-width: 0; } .cpd-n b { font-weight: 700; display: block; line-height: 1.3; }
  .cpd-n small { display: block; font-size: 12px; color: #888780; margin-top: 2px; }
  .cpd-v { font-weight: 700; white-space: nowrap; }
  .cpd-kv { display: grid; grid-template-columns: 86px 1fr; gap: 6px 10px; margin: 12px 0 0; padding-top: 10px; border-top: 1px solid var(--ui-linha); font-size: 13.5px; }
  .cpd-kv dt { color: #888780; font-weight: 500; } .cpd-kv dd { margin: 0; font-weight: 700; }
  .cpd-neg { color: #B91C1C; }
  .cpd-tot { margin-top: 12px; background: var(--ui-vinho-escuro); color: var(--ui-branco); border-radius: var(--ui-raio); padding: 10px 12px; }
  .cpd-tot div { display: flex; justify-content: space-between; align-items: baseline; }
  .cpd-tot span { font-size: 13px; opacity: .8; } .cpd-tot b { font-size: 18px; font-weight: 700; }
  .cpd-falta b { font-size: 14px; color: #F9A8D4; }
  .cpd-tot small { display: block; font-size: 13px; opacity: .7; margin-top: 2px; }
  .cpd-prob { margin-top: 10px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: var(--ui-raio-p); padding: 8px 10px; }
  .cpd-prob p { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 12.5px; font-weight: 700; color: #B91C1C; line-height: 1.35; }
  .cpd-prob p + p { margin-top: 4px; }
  .cpd-erro { margin: 10px 0 0; font-size: 13px; color: #B91C1C; font-weight: 700; }
  .cpd-bts { display: flex; gap: 8px; margin-top: 12px; }
  .cpd-b1, .cpd-b2 { border-radius: var(--ui-raio); padding: 12px 10px; font-family: inherit; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
  .cpd-b1 { flex: 2; border: none; background: var(--ui-rosa); color: var(--ui-branco); box-shadow: 0 3px 0 var(--ui-rosa-escuro); }
  .cpd-b1:disabled { background: #F3B6CB; box-shadow: none; cursor: default; }
  .cpd-b2 { flex: 1; border: 1.5px solid #EAE3E6; background: var(--ui-branco); color: var(--ui-texto); }
  .cpd-x { display: block; width: 100%; margin-top: 4px; padding: 8px; border: none; background: none; font-family: inherit; font-size: 13px; font-weight: 500; color: var(--ui-texto-3); cursor: pointer; }
  .cpd--fim { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-size: 13.5px; font-weight: 700; border-color: #BBF7D0; background: #F0FDF4; color: var(--ui-verde); }
  .cpd--cancel { border-color: var(--ui-borda-campo); background: #FAF7F8; color: var(--ui-texto-3); }
  .cpd-ok { width: 24px; height: 24px; border-radius: 50%; background: var(--ui-verde-fundo); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .cpd--cancel .cpd-ok { background: #F0EBED; }
`;
