import { Bank, BellRinging, Percent, PixLogo } from "@phosphor-icons/react";
import { Botao } from "@/components/base";

/**
 * (6.146) Pix pelo cardápio desligado: a apresentação no estilo da tela de Adicionais (arte rosa com o Doo e ondas),
 * com o aviso que chega no celular dela quando o cliente paga. O texto do aviso é o mesmo da notificação de verdade.
 */
export default function PixApresentacao({ onLigar }: { onLigar: () => void }) {
  return (
    <section className="pxa">
      <figure className="pxa-arte" aria-hidden="true">
        <svg className="pxa-onda" viewBox="0 0 600 260" preserveAspectRatio="none">
          <path d="M0 70 C 140 10, 260 120, 400 70 S 560 20, 600 40 L600 260 L0 260 Z" fill="#F3A3C6" opacity=".55" />
          <path d="M0 120 C 120 70, 240 150, 380 120 S 540 80, 600 100 L600 260 L0 260 Z" fill="#EF8FB9" opacity=".35" />
          <path d="M0 175 C 90 140, 220 150, 330 190 S 520 250, 600 230 L600 260 L0 260 Z" fill="#FFF5F9" />
        </svg>
        <img className="pxa-masc" src="/marca/leve/doo-pix.webp" alt="" />
        <div className="pxa-not">
          <div className="pxa-not-cab"><img src="/Sistema/icon-192.png" alt="" /><span>DOONLY</span><small>agora</small></div>
          <b>Pix para conferir</b>
          <p>Beatriz disse que pagou R$ 50,00 de sinal no Pix do pedido #152. Confira no banco.</p>
        </div>
      </figure>
      <div className="pxa-tx">
        <h2>Receba no Pix pelo cardápio</h2>
        <p>O cliente paga na hora de fazer o pedido, direto na sua chave Pix. O dinheiro cai na sua conta na hora, sem taxa e sem intermediário.</p>
        <ul className="pxa-lista">
          {([
            [Percent, "Sem taxa nenhuma", "O Doonly não fica com nada da venda"],
            [Bank, "Direto na sua conta", "Pix na sua chave, sem intermediário"],
            [BellRinging, "Aviso no seu celular", "Quando o cliente paga, você confere"],
          ] as const).map(([Ic, t, sub]) => (
            <li key={t}><span className="pxa-ic" aria-hidden="true"><Ic size={20} weight="bold" /></span><span className="pxa-li-tx"><b>{t}</b><small>{sub}</small></span></li>
          ))}
        </ul>
        <Botao cheio icone={<PixLogo size={20} weight="bold" />} onClick={onLigar}>Ligar o Pix pelo cardápio</Botao>
      </div>
      <style>{CSS}</style>
    </section>
  );
}

const CSS = `
  .pxa { overflow: hidden; border: 1px solid var(--ui-borda); border-radius: var(--ui-raio-cartao); background: var(--ui-branco); box-shadow: var(--ui-sombra-cartao); font-family: var(--font-base); color: var(--ui-texto); }
  .pxa-arte { position: relative; height: 200px; margin: 0; overflow: hidden; background: linear-gradient(135deg, #FCE3EE 0%, #F7C6DC 100%); }
  .pxa-onda { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 55%; display: block; }
  .pxa-masc { position: absolute; left: 14px; bottom: 4px; z-index: 2; width: 118px; height: auto; filter: drop-shadow(0 8px 14px rgba(120, 30, 60, .18)); }
  .pxa-not { position: absolute; z-index: 3; top: 22px; right: 14px; left: 128px; max-width: 300px; margin-left: auto; padding: 10px 12px 11px; border-radius: 16px; background: rgba(255, 255, 255, .94); box-shadow: 0 10px 26px rgba(90, 20, 45, .18); backdrop-filter: blur(6px); text-align: left; }
  .pxa-not-cab { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .pxa-not-cab img { width: 18px; height: 18px; border-radius: 5px; }
  .pxa-not-cab span { font-size: 11px; font-weight: 600; letter-spacing: .04em; color: var(--ui-texto-2); }
  .pxa-not-cab small { margin-left: auto; font-size: 11px; color: var(--ui-texto-3); }
  .pxa-not b { display: block; font-size: 13.5px; font-weight: 600; }
  .pxa-not p { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; margin: 2px 0 0; font-size: 12.5px; line-height: 1.35; color: var(--ui-texto-2); }
  .pxa-tx { display: flex; flex-direction: column; padding: 18px 18px 20px; }
  .pxa-tx h2 { margin: 0; font-size: 20px; font-weight: 600; line-height: 1.25; letter-spacing: -.01em; }
  .pxa-tx > p { margin: 6px 0 0; font-size: 14.5px; line-height: 1.5; color: var(--ui-texto-2); }
  .pxa-lista { display: flex; flex-direction: column; gap: 12px; margin: 16px 0 20px; padding: 0; list-style: none; }
  .pxa-lista li { display: flex; align-items: center; gap: 12px; }
  .pxa-ic { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; background: var(--ic-fundo, #fff); color: var(--ic-cor, var(--ui-rosa-escuro)); box-shadow: inset 0 0 0 1px var(--ic-borda, #E8E1E4); }
  .pxa-li-tx { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .pxa-li-tx b { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 14.5px; font-weight: 500; }
  .pxa-li-tx small { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; color: var(--ui-texto-2); }
  @media (max-width: 380px) { .pxa-masc { width: 104px; } .pxa-not { left: 112px; right: 10px; } .pxa-not p { font-size: 12px; } }
`;
