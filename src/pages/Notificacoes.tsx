import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, WarningCircle } from "@phosphor-icons/react";
import AppPageHeader from "@/components/AppPageHeader";
import AbasAvisos from "@/components/AbasAvisos";
import { Botao, TelaVazia } from "@/components/base";
import { Mascote } from "@/components/marca/Mascote";
import { marcarLidas } from "@/lib/notificacoesUsuario";
import { carregarNotifConfeiteira, type NotifVista } from "@/lib/notifConfeiteira";
import { hojeISO, dataISO } from "@/lib/pedidoStatus";
import "./notificacoes.css";

/**
 * (09/11) Notificações da confeiteira (o sino abre aqui): pedido novo, Pix pra conferir, orçamento, entregas de hoje,
 * pedido atrasado, conta vencendo, PRO e resposta da equipe. Cada tipo com a sua imagem (foto do produto, Pix,
 * calendário, PDF…). Separadas por dia; tocar abre o lugar certo e marca como lida.
 */
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function grupo(iso: string): string {
  const d = dataISO(new Date(iso));
  const hoje = hojeISO();
  const ontem = (() => { const x = new Date(); x.setDate(x.getDate() - 1); return dataISO(x); })();
  const semana = (() => { const x = new Date(); x.setDate(x.getDate() - 6); return dataISO(x); })();
  return d === hoje ? "Hoje" : d === ontem ? "Ontem" : d >= semana ? "Esta semana" : "Mais antigas";
}
function hora(iso: string): string {
  const x = new Date(iso);
  const g = grupo(iso);
  if (g === "Hoje") return `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  if (g === "Ontem") return "ontem";
  if (g === "Esta semana") return DIAS[x.getDay()];
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
}

function Imagem({ n }: { n: NotifVista }) {
  switch (n.tipo) {
    case "pedido":
    case "atrasado":
      return (
        <span className={`nf-ic nf-ic--foto${n.foto ? "" : " sem"}`}>
          {n.foto ? <img src={n.foto} alt="" loading="lazy" /> : <img src="/Sistema/doo.webp" alt="" className="nf-doo" />}
          {n.tipo === "atrasado" && <i className="nf-alerta"><WarningCircle size={11} weight="bold" /></i>}
        </span>
      );
    case "pix": return <span className="nf-ic nf-ic--pix"><img src="/Sistema/pix-branco.png" alt="" onError={e => { (e.currentTarget as HTMLImageElement).src = "/pix.png"; }} /></span>;
    case "agenda": return <span className="nf-ic nf-ic--cal"><em>{n.mes}</em><b>{n.dia}</b></span>;
    case "orcamento": return (
      <span className="nf-ic nf-ic--doc" aria-hidden="true">
        <svg width="26" height="30" viewBox="0 0 26 30"><path d="M3 .5h13.6L25.5 9.4V28a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 28V2A1.5 1.5 0 0 1 3 .5z" fill="#fff" stroke="#E0D8DC" /><path d="M16.5.5V7a2 2 0 0 0 2 2h7" fill="#F3EEF0" stroke="#E0D8DC" /><rect x="0" y="16" width="19" height="9" rx="2" fill="#DC2626" /><text x="9.5" y="22.8" fontSize="6.5" fontWeight="600" fill="#fff" textAnchor="middle" fontFamily="Poppins, sans-serif">PDF</text></svg>
      </span>
    );
    case "conta": return <span className="nf-ic nf-ic--conta"><Wallet size={22} weight="regular" /></span>;
    case "pro": return <span className="nf-ic nf-ic--pro"><img src="/coroa.webp" alt="" /></span>;
    case "equipe": return <span className="nf-ic nf-ic--doo"><Mascote pose="acenando" /></span>;
  }
}

export default function Notificacoes() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<NotifVista[] | null>(null);
  const [erro, setErro] = useState(false);

  const carregar = () => { setErro(false); carregarNotifConfeiteira().then(setLista).catch(() => setErro(true)); };
  useEffect(() => {
    carregar();
    const f = () => carregarNotifConfeiteira().then(setLista).catch(() => {});
    window.addEventListener("doonly:notif-mudou", f);
    return () => window.removeEventListener("doonly:notif-mudou", f);
  }, []);

  const grupos = useMemo(() => {
    const m = new Map<string, NotifVista[]>();
    for (const n of lista || []) { const g = grupo(n.criada); m.set(g, [...(m.get(g) || []), n]); }
    return ["Hoje", "Ontem", "Esta semana", "Mais antigas"].filter(g => m.has(g)).map(g => ({ g, itens: m.get(g)! }));
  }, [lista]);
  const naoLidas = (lista || []).filter(n => !n.lida);

  const abrir = (n: NotifVista) => {
    if (!n.lida) { setLista(l => (l || []).map(x => x.id === n.id ? { ...x, lida: true } : x)); void marcarLidas([n.id]); }
    if (n.link) navigate(n.link);
  };
  const lerTodas = () => {
    const ids = naoLidas.map(n => n.id);
    if (!ids.length) return;
    setLista(l => (l || []).map(x => ({ ...x, lida: true })));
    void marcarLidas(ids);
  };

  return (
    <>
      <AppPageHeader title="Notificações" centro voltar="/inicio" subtitle="Pedidos, pagamentos e avisos da sua loja" />
      <div className="nf">
        <AbasAvisos atual="notificacoes" />
        {erro ? (
          <TelaVazia icone={<WarningCircle size={30} />} titulo="Não deu para carregar as notificações" texto="Confira a internet e tente de novo."
            acao={<Botao variante="suave" tamanho="m" onClick={carregar}>Tentar de novo</Botao>} />
        ) : lista === null ? (
          <p className="nf-carregando" role="status"><span className="ui-gira" aria-hidden="true" />Carregando…</p>
        ) : lista.length === 0 ? (
          <div className="nf-vazio">
            <Mascote pose="acenando" className="nf-vazio-doo" />
            <b>Tudo em dia por aqui</b>
            <p>Quando chegar um pedido ou um Pix, ele aparece aqui.</p>
          </div>
        ) : (
          <>
            <div className="nf-topo">
              <span>{naoLidas.length === 0 ? "Tudo lido" : naoLidas.length === 1 ? "1 não lida" : `${naoLidas.length} não lidas`}</span>
              {naoLidas.length > 0 && <button type="button" onClick={lerTodas}>Marcar todas como lidas</button>}
            </div>
            {grupos.map(({ g, itens }) => (
              <section key={g} aria-label={g}>
                <h3 className="nf-dia">{g}</h3>
                <div className="nf-card">
                  {itens.map(n => (
                    <button key={n.id} type="button" className={`nf-it${n.lida ? "" : " nova"}`} onClick={() => abrir(n)}>
                      <span className="nf-pt" aria-hidden="true" />
                      <Imagem n={n} />
                      <span className="nf-tx"><b>{n.titulo}</b>{n.detalhe && <small>{n.detalhe}</small>}</span>
                      <span className="nf-h">{hora(n.criada)}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

