import { useNavigate } from "react-router-dom";
import AppPageHeader from "@/components/AppPageHeader";
import { usePlano } from "@/hooks/usePlano";
import { abrirDooIA } from "@/components/MenuContaItens";
import { BookOpenText, Cake, CalendarCheck, ChatCircleDots, CurrencyCircleDollar, PencilSimpleLine } from "@phosphor-icons/react";

/** "Assistente virtual" — o que a Doo IA faz (aparece pra quem ainda não é PRO). 08/10 · 3.19: ícones do app no lugar dos emojis. */
const BENEFICIOS = [
  { e: Cake, t: "Cria topos de bolo", d: "Descreva o tema e a Doo monta a arte do topo pra você imprimir." },
  { e: BookOpenText, t: "Sugere receitas", d: "Massas, recheios e coberturas com as quantidades certas pro tamanho que você vende." },
  { e: CurrencyCircleDollar, t: "Ajuda a precificar", d: "Calcula custo, margem e preço de venda a partir dos seus ingredientes." },
  { e: CalendarCheck, t: "Organiza sua confeitaria", d: "Lembra das entregas, monta sua lista de compras e a produção da semana." },
  { e: PencilSimpleLine, t: "Escreve por você", d: "Legendas pro Instagram, descrições dos produtos e respostas pros clientes." },
  { e: ChatCircleDots, t: "Tira dúvidas na hora", d: "Pergunte qualquer coisa sobre confeitaria ou sobre o Doonly, a qualquer hora." },
];

export default function AssistenteVirtual() {
  const navigate = useNavigate();
  const { isPro } = usePlano();
  return (
    <div className="av-root">
      <AppPageHeader title="Assistente virtual" subtitle="Conheça a Doo IA" onBack={() => navigate(-1)} />
      <div className="av-wrap">
        <div className="av-hero">
          <img src="/Sistema/doo.png" alt="" className="av-doo" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          <h1>Sua confeitaria mais organizada, prática e lucrativa</h1>
          <p>Tenha ao seu lado a ferramenta mais completa para confeiteiras e confeiteiros que querem organizar a confeitaria e ganhar tempo no dia a dia. Veja tudo o que a Doo pode fazer por você:</p>
        </div>
        <div className="av-grid">
          {BENEFICIOS.map(b => (
            <div className="av-item" key={b.t}>
              <span className="av-e" aria-hidden="true"><b.e size={24} weight="bold" /></span>
              <div><b>{b.t}</b><p>{b.d}</p></div>
            </div>
          ))}
        </div>
        {isPro ? (
          <button type="button" className="av-cta" onClick={abrirDooIA}>Conversar com a Doo</button>
        ) : (
          <>
            <button type="button" className="av-cta" onClick={() => navigate("/assinar")}>
              <img src="/coroa.png" alt="" /> Liberar o assistente com o PRO
            </button>
            <p className="av-sub">O assistente virtual faz parte do plano PRO.</p>
          </>
        )}
      </div>
      <style>{`
        .av-root { font-family: var(--font-base); color: #2C1219; }
        .av-wrap { max-width: 720px; margin: 0 auto; padding: 16px 16px 96px; }
        .av-hero { text-align: center; background: linear-gradient(150deg, #3B1620, #6B2340); color: #fff; border-radius: 18px; padding: 24px 18px; }
        .av-doo { width: 80px; height: 80px; object-fit: cover; object-position: top center; border-radius: 24px; background: #FCE7F3; margin: 0 auto 12px; display: block; }
        .av-hero h1 { font-size: 21px; font-weight: 900; line-height: 1.25; margin: 0 0 8px; }
        .av-hero p { font-size: 14px; line-height: 1.5; color: rgba(255,255,255,.85); margin: 0; }
        .av-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 16px; }
        @media (min-width: 700px) { .av-grid { grid-template-columns: 1fr 1fr; } }
        .av-item { display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #F0EBED; border-radius: 14px; padding: 14px; }
        .av-e { width: 44px; height: 44px; border-radius: 12px; background: #FCE7F3; color: #993556; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .av-item b { display: block; font-size: 14.5px; } .av-item p { font-size: 13px; color: #6B5D64; line-height: 1.45; margin: 3px 0 0; }
        .av-cta { width: 100%; height: 52px; margin-top: 18px; border: none; border-radius: 12px; background: #E85A8C; color: #fff; font-family: inherit; font-size: 15.5px; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 #C33A6E; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .av-cta img { width: 18px; height: 18px; object-fit: contain; }
        .av-sub { text-align: center; font-size: 12.5px; color: #9A8E94; margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
