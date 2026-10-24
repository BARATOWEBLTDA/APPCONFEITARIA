import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { usePlano } from "@/hooks/usePlano";
import { abrirDooIA } from "@/components/MenuContaItens";
import { voltarOuIr } from "@/lib/voltar"; // 11/10: seta de voltar que funciona com a tela aberta direto
import { BookOpenText, Cake, CalendarCheck, ChatCircleDots, Crown, CurrencyCircleDollar, Package, PencilSimpleLine, Receipt } from "@phosphor-icons/react";

/** "Doo IA" (21/10, antes "Assistente virtual"): o que dá pra pedir pra Doo. Aparece pra quem ainda não é PRO;
 *  quem é PRO toca num exemplo e a conversa abre já com o pedido escrito. */
const EXEMPLOS = [
  { e: CurrencyCircleDollar, t: "Calcular preço", d: "De um bolo ou doce", p: "Calcular o preço de um bolo" },
  { e: Receipt, t: "Registrar pedido", d: "Direto pela conversa", p: "Registrar um pedido", novo: true },
  { e: BookOpenText, t: "Criar receita", d: "Com as quantidades", p: "Criar receita de bolo" },
  { e: Package, t: "Ingrediente", d: "Cadastre com preço", p: "Cadastrar um ingrediente" },
  { e: PencilSimpleLine, t: "Legenda", d: "Pronta pro Instagram", p: "Criar legenda para o Instagram" },
  { e: ChatCircleDots, t: "Responder", d: "Para o seu cliente", p: "Escrever uma mensagem para um cliente" },
  { e: Cake, t: "Topo de bolo", d: "A arte para imprimir", p: "Criar um topo de bolo" },
  { e: CalendarCheck, t: "Minha semana", d: "Produção e compras", p: "Planejar produção da semana" },
];

export default function AssistenteVirtual() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  const [computador, setComputador] = useState(() => window.matchMedia("(min-width: 901px)").matches);
  useEffect(() => { const mq = window.matchMedia("(min-width: 901px)"); const f = () => setComputador(mq.matches); mq.addEventListener("change", f); return () => mq.removeEventListener("change", f); }, []);
  return (
    <div className="av-root">
      <AppPageHeader title="Doo IA" subtitle="Sua assistente de confeitaria" onBack={computador ? undefined : () => voltarOuIr(navigate)} />
      <div className="av-wrap">
        <div className="av-hero">
          <img src="/Sistema/doo.png" alt="" className="av-doo" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <h1>Sua assistente de confeitaria</h1>
          <p>Calcula preços, cria receitas, registra pedidos e escreve por você.</p>
        </div>
        <p className="av-lbl">O que você pode pedir para a Doo</p>
        <div className="av-grid">
          {EXEMPLOS.map(b => {
            const conteudo = (<>
              {b.novo && <em className="av-novo">Novo</em>}
              <span className="av-e" aria-hidden="true"><b.e size={22} weight="bold" /></span>
              <b>{b.t}</b><small>{b.d}</small>
            </>);
            return isPro
              ? <button type="button" className="av-item av-item--bt" key={b.t} onClick={() => abrirDooIA(b.p)}>{conteudo}</button>
              : <div className="av-item" key={b.t}>{conteudo}</div>;
          })}
        </div>
        {isPro ? (
          <button type="button" className="av-cta" onClick={() => abrirDooIA()}>Conversar com a Doo IA</button>
        ) : (
          <>
            <button type="button" className="av-cta" onClick={() => navigate("/assinar")}>
              <Crown size={20} weight="fill" aria-hidden="true" /> Liberar a Doo IA com o PRO
            </button>
            <p className="av-sub">A Doo IA faz parte do plano PRO.</p>
          </>
        )}
        <p className="av-aviso">A Doo pode errar: confira os valores.</p>
      </div>
      <style>{`
        .av-root { font-family: var(--font-base); color: var(--ui-texto); }
        .av-wrap { max-width: 720px; margin: 0 auto; padding: 16px 16px 96px; }
        .av-hero { text-align: center; background: linear-gradient(150deg, #3B1620, #6B2340); color: var(--ui-branco); border-radius: 18px; padding: 24px 18px; }
        .av-doo { width: 80px; height: 80px; object-fit: cover; object-position: top center; border-radius: var(--ui-raio-janela); background: #FCE7F3; margin: 0 auto 12px; display: block; }
        .av-hero h1 { font-size: 21px; font-weight: 700; line-height: 1.25; margin: 0 0 8px; }
        .av-hero p { font-size: 14px; line-height: 1.5; color: rgba(255,255,255,.85); margin: 0; }
        .av-lbl { margin: 18px 2px 0; font-size: 13px; font-weight: 700; color: var(--ui-texto-2); }
        .av-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
        @media (min-width: 901px) { .av-wrap { max-width: 1066px !important; padding-top: 24px !important; } .av-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .av-item { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; margin: 0; padding: 14px; background: var(--ui-branco); border: 1px solid #F0EBED; border-radius: 14px; font-family: inherit; text-align: left; color: var(--ui-texto); }
        .av-item--bt { cursor: pointer; } @media (hover: hover) { .av-item--bt:hover { border-color: #EBB8CD; } }
        .av-e { width: 40px; height: 40px; border-radius: var(--ui-raio); background: #FCE7F3; color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 2px; }
        .av-item b, .av-item small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .av-item b { font-size: 14.5px; } .av-item small { font-size: 12.5px; color: var(--ui-texto-2); }
        .av-novo { position: absolute; top: 10px; right: 10px; padding: 2px 8px; border-radius: 999px; background: var(--ui-rosa); color: var(--ui-branco); font-style: normal; font-size: 11.5px; font-weight: 700; }
        .av-aviso { margin: 14px 0 0; text-align: center; font-size: 12.5px; color: var(--ui-texto-3); }
        .av-cta { width: 100%; height: 52px; margin-top: 18px; border: none; border-radius: var(--ui-raio); background: var(--ui-rosa); color: var(--ui-branco); font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; box-shadow: 0 3px 0 var(--ui-rosa-escuro); display: flex; align-items: center; justify-content: center; gap: 8px; }
        .av-sub { text-align: center; font-size: 12.5px; color: var(--ui-texto-3); margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
