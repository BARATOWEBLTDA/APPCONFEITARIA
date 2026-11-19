/**
 * (14/10) Sucesso depois de publicar um produto novo: um aviso por cima do app (19/11: cartão branco, sem o check).
 * "Próximos passos" conforme o que falta no produto (no máximo 2),
 * "Cadastrar outro produto" e "Fechar". No primeiro produto, confete por cima.
 */
interface Props {
  primeiro: boolean;
  nome: string;
  /** loja toda configurada (primeiros passos completos)? false = ainda não abriu o cardápio */
  lojaPronta?: boolean | null;
  /** salvo pelo "Salvar fora do cardápio": não diz que já está no cardápio */
  foraDoCardapio?: boolean;
  semFoto?: boolean;
  semDescricao?: boolean;
  /** ainda não vende extras (vela, topo de bolo): sugere cadastrar */
  semExtras?: boolean;
  onExtras?: () => void;
  onTerminarLoja?: () => void;
  onOutro: () => void;
  /** sem ele (modo suporte), o passo de custo não aparece */
  onCusto?: () => void;
  onFoto?: () => void;
  onDescricao?: () => void;
  onFechar: () => void;
}

import { useEffect, type ReactNode } from "react";
import { Cake, Calculator, CaretRight, Image as ImageIc, PencilSimple, Plus, Storefront } from "@phosphor-icons/react";
import { tocarSom } from "@/hooks/useSom";

const CORES_CONF = ["#FCD34D", "#86EFAC", "#93C5FD", "#F9A8D4", "#C4B5FD", "#FDBA74"];
// [left %, cor, atraso s, duração s, giro graus]
const CONFETE: [number, string, number, number, number][] = Array.from({ length: 34 }, (_, i) => [
  (i * 37) % 100, CORES_CONF[i % CORES_CONF.length], (i % 9) * 0.22, 2.6 + (i % 5) * 0.35, (i % 2 ? 1 : -1) * (360 + (i % 4) * 140),
]);

export default function SucessoProdutoTela(p: Props) {
  useEffect(() => { tocarSom("sucesso"); }, []); // som de sucesso (respeita os sons desligados)

  // próximos passos: o que falta, na ordem de importância (no máximo 2)
  const passos: { k: string; ic: ReactNode; t: string; s: string; on: () => void }[] = [];
  if (p.lojaPronta === false && p.onTerminarLoja) passos.push({ k: "loja", ic: <Storefront size={18} weight="bold" />, t: "Terminar de abrir o cardápio", s: "Para os clientes verem e pedirem", on: p.onTerminarLoja });
  if (p.onCusto) passos.push({ k: "custo", ic: <Calculator size={18} weight="bold" />, t: "Definir custo e lucro", s: "Monte a ficha técnica", on: p.onCusto });
  // (16/10) quem ainda não vende extras: aumentam o valor de cada pedido · (30/10) "velas e topos" era nichado: agora adicionais em geral
  if (p.semExtras && p.onExtras) passos.push({ k: "extras", ic: <Cake size={18} weight="bold" />, t: "Vender adicionais", s: "Vela, topo, papel de arroz, balão", on: p.onExtras });
  if (p.semFoto && p.onFoto) passos.push({ k: "foto", ic: <ImageIc size={18} weight="bold" />, t: "Adicionar foto", s: "Produto com foto vende mais", on: p.onFoto });
  if (p.semDescricao && p.onDescricao) passos.push({ k: "desc", ic: <PencilSimple size={18} weight="bold" />, t: "Escrever a descrição", s: "Conte o que vem no produto", on: p.onDescricao });
  const mostrar = passos.slice(0, 2);

  return (
    <div className="spa" role="alertdialog" aria-modal="true" aria-labelledby="spa-t">
      {p.primeiro && (
        <div className="spa-confete" aria-hidden="true">
          {CONFETE.map(([l, c, d, dur, gira], i) => <i key={i} style={{ left: `${l}%`, background: c, animationDelay: `${d}s`, animationDuration: `${dur}s`, ['--gira']: `${gira}deg` } as React.CSSProperties} />)}
        </div>
      )}
      {/* (30/10 · 5.27) no PC: check ao lado do título (mais baixo e mais largo) e textos mais curtos */}
      <div className="spa-topo">
        <div>
          <h2 className="spa-t" id="spa-t">{p.primeiro ? "Primeiro produto cadastrado!" : "Produto cadastrado"}</h2>
          <p className="spa-x">
            {p.foraDoCardapio
              ? <><b>{p.nome}</b> ficou guardado só para você e não aparece no cardápio.</>
              : p.lojaPronta === false
              ? <><b>{p.nome}</b> foi salvo. Termine de abrir o cardápio para os clientes verem.</>
              : <><b>{p.nome}</b> já está no seu cardápio.</>}
          </p>
        </div>
      </div>

      {mostrar.length > 0 && (<>
        <p className="spa-pp">Próximos passos</p>
        <div className="spa-passos">
          {mostrar.map(x => (
            <button key={x.k} type="button" className="spa-ps" onClick={x.on}>
              <span className="spa-pi" aria-hidden="true">{x.ic}</span>
              <span className="spa-pt"><b>{x.t}</b><small>{x.s}</small></span>
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          ))}
        </div>
      </>)}

      <div className="spa-acoes">
        <button type="button" className="spa-fe" onClick={p.onFechar}>Fechar</button>
        <button type="button" className="spa-b1" onClick={p.onOutro}><Plus size={18} weight="bold" aria-hidden="true" />Cadastrar outro<span className="spa-pc"> produto</span></button>
      </div>

      <style>{`
        /* (19/11) cartão branco, no padrão das janelas do app (antes rosa, com um check grande em cima); Fechar e Cadastrar outro na mesma linha */
        .spa { position: relative; width: 100%; max-width: 400px; margin: 0 auto; padding: 22px 16px 16px; border-radius: 20px; background: var(--ui-branco, #fff); color: var(--ui-texto); text-align: left; font-family: var(--font-base); box-shadow: 0 20px 50px rgba(0,0,0,.3); overflow: hidden; animation: spa-pop .3s cubic-bezier(.2,1.3,.4,1) both; }
        @keyframes spa-pop { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spa-t { margin: 0 0 4px; font-size: 19px; font-weight: 500; line-height: 1.25; color: var(--ui-texto); }
        .spa-x { margin: 0 0 16px; font-size: 15px; line-height: 1.5; color: var(--ui-texto-2); text-wrap: pretty; }
        .spa-x b { color: var(--ui-texto); font-weight: 500; }
        .spa-pp { margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ui-texto-2); }
        .spa-passos { margin-bottom: 16px; border: 1px solid var(--ui-borda); border-radius: 12px; overflow: hidden; }
        .spa-ps { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 58px; margin: 0; padding: 10px 12px; border: 0; background: none; font-family: inherit; text-align: left; color: var(--ui-texto); cursor: pointer; }
        .spa-ps + .spa-ps { border-top: 1px solid var(--ui-linha); }
        .spa-ps > svg { flex: none; color: var(--ui-texto-2); }
        @media (hover: hover) { .spa-ps:hover { background: var(--ui-cinza); } }
        .spa-pi { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 1px solid var(--ui-borda); border-radius: 10px; background: var(--ui-branco, #fff); color: var(--ui-texto); }
        .spa-pt { flex: 1; min-width: 0; }
        .spa-pt b { display: block; font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spa-pt small { display: block; font-size: 12.5px; color: var(--ui-texto-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spa-acoes { display: flex; align-items: center; gap: 8px; }
        .spa-b1 { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; margin: 0; padding: 0 12px; border: 0; border-radius: var(--ui-raio-botao); background: var(--ui-rosa-botao, #CC2E66); color: #fff; font-family: inherit; font-size: 15px; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .spa-fe { flex: none; min-height: 48px; margin: 0; padding: 0 18px; border: 0; border-radius: var(--ui-raio-botao); background: var(--ui-cinza); font-family: inherit; font-size: 15px; font-weight: 500; color: var(--ui-texto); cursor: pointer; white-space: nowrap; }
        .spa-pc { display: none; }
        .spa-confete { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .spa-confete i { position: absolute; top: -20px; width: 8px; height: 13px; border-radius: 2px; opacity: 0; animation: spa-cai 3s linear forwards; }
        @keyframes spa-cai { 0% { opacity: 0; transform: translateY(0) rotate(0deg); } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(560px) rotate(var(--gira)); } }
        @media (prefers-reduced-motion: reduce) { .spa-confete { display: none; } .spa { animation: none; } }
        .spa > *:not(.spa-confete) { position: relative; }
        @media (min-width: 640px) {
          .spa { max-width: 520px; padding: 24px; }
          .spa-pc { display: inline; }
          .spa-acoes { justify-content: flex-end; }
          .spa-b1 { flex: none; min-height: 44px; padding: 0 22px; }
          .spa-fe { min-height: 44px; }
        }
      `}</style>
    </div>
  );
}
