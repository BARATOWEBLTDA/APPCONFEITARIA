/**
 * (14/10) Sucesso depois de publicar um produto novo: um AVISO rosa por cima do app (antes era uma tela inteira).
 * Texto branco, check em cima, "Próximos passos" conforme o que falta no produto (no máximo 2),
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
  onCusto: () => void;
  onFoto?: () => void;
  onDescricao?: () => void;
  onFechar: () => void;
}

import { useEffect, type ReactNode } from "react";
import { Cake, Calculator, CaretRight, Check, Image as ImageIc, PencilSimple, Plus, Storefront } from "@phosphor-icons/react";
import { tocarSom } from "@/hooks/useSom";

const CORES_CONF = ["#FCD34D", "#86EFAC", "#93C5FD", "#FFFFFF", "#C4B5FD", "#FDBA74"];
// [left %, cor, atraso s, duração s, giro graus]
const CONFETE: [number, string, number, number, number][] = Array.from({ length: 34 }, (_, i) => [
  (i * 37) % 100, CORES_CONF[i % CORES_CONF.length], (i % 9) * 0.22, 2.6 + (i % 5) * 0.35, (i % 2 ? 1 : -1) * (360 + (i % 4) * 140),
]);

export default function SucessoProdutoTela(p: Props) {
  useEffect(() => { tocarSom("sucesso"); }, []); // som de sucesso (respeita os sons desligados)

  // próximos passos: o que falta, na ordem de importância (no máximo 2)
  const passos: { k: string; ic: ReactNode; t: string; s: string; on: () => void }[] = [];
  if (p.lojaPronta === false && p.onTerminarLoja) passos.push({ k: "loja", ic: <Storefront size={18} weight="bold" />, t: "Terminar de abrir o cardápio", s: "Para os clientes verem e pedirem", on: p.onTerminarLoja });
  passos.push({ k: "custo", ic: <Calculator size={18} weight="bold" />, t: "Definir custo e lucro", s: "Monte a ficha técnica", on: p.onCusto });
  // (16/10) quem ainda não vende extras: aumentam o valor de cada pedido · (30/10) "velas e topos" era nichado: agora adicionais em geral
  if (p.semExtras && p.onExtras) passos.push({ k: "extras", ic: <Cake size={18} weight="bold" />, t: "Vender adicionais", s: "Vela, topo, papel de arroz, balão", on: p.onExtras });
  if (p.semFoto && p.onFoto) passos.push({ k: "foto", ic: <ImageIc size={18} weight="bold" />, t: "Adicionar foto", s: "Produto com foto vende mais", on: p.onFoto });
  if (p.semDescricao && p.onDescricao) passos.push({ k: "desc", ic: <PencilSimple size={18} weight="bold" />, t: "Escrever a descrição", s: "Conte o que vem no produto", on: p.onDescricao });
  const mostrar = passos.slice(0, 2);

  return (
    <div className="spa" role="alertdialog" aria-modal="true" aria-labelledby="spa-t">
      {p.primeiro && (
        <div className="spa-confete" aria-hidden="true">
          {CONFETE.map(([l, c, d, dur, gira], i) => <i key={i} style={{ left: `${l}%`, background: c, animationDelay: `${d}s`, animationDuration: `${dur}s`, ['--gira' as any]: `${gira}deg` }} />)}
        </div>
      )}
      {/* (30/10 · 5.27) no PC: check ao lado do título (mais baixo e mais largo) e textos mais curtos */}
      <div className="spa-topo">
        <div className="spa-ok" aria-hidden="true"><Check size={30} weight="bold" /></div>
        <div>
          <h2 className="spa-t" id="spa-t">{p.primeiro ? "Primeiro produto cadastrado!" : "Produto cadastrado!"}</h2>
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
        <button type="button" className="spa-b1" onClick={p.onOutro}><Plus size={18} weight="bold" aria-hidden="true" />Cadastrar outro produto</button>
        <button type="button" className="spa-fe" onClick={p.onFechar}>Fechar</button>
      </div>

      <style>{`
        .spa { position: relative; width: 100%; max-width: 400px; margin: 0 auto; padding: 26px 18px 12px; border-radius: 20px; background: var(--ui-rosa); color: #fff; text-align: center; font-family: var(--font-base); box-shadow: 0 20px 50px rgba(0,0,0,.3); overflow: hidden; animation: spa-pop .3s cubic-bezier(.2,1.3,.4,1) both; }
        @keyframes spa-pop { from { transform: scale(.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .spa-ok { display: flex; align-items: center; justify-content: center; width: 62px; height: 62px; margin: 0 auto 14px; border-radius: 50%; background: #fff; color: var(--ui-rosa-escuro); box-shadow: 0 0 0 8px rgba(255,255,255,.22); }
        .spa-t { margin: 0 0 6px; font-size: 20px; font-weight: 600; line-height: 1.25; color: #fff; }
        .spa-x { margin: 0 0 18px; font-size: 15px; line-height: 1.5; color: rgba(255,255,255,.95); text-wrap: pretty; }
        .spa-x b { color: #fff; font-weight: 600; }
        .spa-pp { margin: 0 0 8px; text-align: left; font-size: 13px; font-weight: 500; color: #fff; }
        .spa-passos { margin-bottom: 12px; border-radius: 12px; background: rgba(255,255,255,.14); overflow: hidden; text-align: left; }
        .spa-ps { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 60px; margin: 0; padding: 10px 12px; border: 0; background: none; font-family: inherit; text-align: left; color: #fff; cursor: pointer; }
        .spa-ps + .spa-ps { border-top: 1px solid rgba(255,255,255,.2); }
        @media (hover: hover) { .spa-ps:hover { background: rgba(255,255,255,.08); } }
        .spa-pi { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: #fff; color: var(--ui-rosa-escuro); }
        .spa-pt { flex: 1; min-width: 0; }
        .spa-pt b { display: block; font-size: 14.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spa-pt small { display: block; font-size: 12.5px; color: rgba(255,255,255,.88); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .spa-b1 { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; min-height: 50px; margin: 0; border: 0; border-radius: var(--ui-raio-botao); background: #fff; color: var(--ui-rosa-escuro); font-family: inherit; font-size: 15.5px; font-weight: 600; box-shadow: 0 3px 0 rgba(120,20,60,.35); cursor: pointer; white-space: nowrap; }
        .spa-b1:active { transform: translateY(2px); box-shadow: 0 1px 0 rgba(120,20,60,.35); }
        .spa-fe { display: block; width: 100%; min-height: 44px; margin: 6px 0 0; border: 0; background: none; font-family: inherit; font-size: 15px; font-weight: 500; color: rgba(255,255,255,.92); cursor: pointer; }
        .spa-confete { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
        .spa-confete i { position: absolute; top: -20px; width: 8px; height: 13px; border-radius: 2px; opacity: 0; animation: spa-cai 3s linear forwards; }
        @keyframes spa-cai { 0% { opacity: 0; transform: translateY(0) rotate(0deg); } 8% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(560px) rotate(var(--gira)); } }
        @media (prefers-reduced-motion: reduce) { .spa-confete { display: none; } .spa { animation: none; } }
        .spa > *:not(.spa-confete) { position: relative; }
        @media (max-width: 639px) { .spa { padding-left: 14px; padding-right: 14px; } .spa-ps { gap: 10px; padding: 10px; } .spa-ps > svg { margin-left: -4px; } } /* (30/10) o texto dos passos cabe numa linha no celular */
        /* (30/10 · 5.27) PC: mais larga e baixa. Check ao lado do título, passos na largura toda e os botões numa linha, no canto */
        @media (min-width: 640px) {
          .spa { max-width: 580px; padding: 24px 24px 20px; text-align: left; }
          .spa-topo { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
          .spa-ok { width: 52px; height: 52px; margin: 0 0 0 4px; flex: none; box-shadow: 0 0 0 6px rgba(255,255,255,.22); }
          .spa-ok svg { width: 26px; height: 26px; }
          .spa-t { margin: 0 0 2px; }
          .spa-x { margin: 0; }
          .spa-ps { min-height: 54px; padding: 8px 12px; }
          .spa-passos { margin-bottom: 18px; }
          .spa-acoes { display: flex; flex-direction: row-reverse; justify-content: flex-start; align-items: center; gap: 8px; }
          .spa-b1 { width: auto; min-height: 44px; padding: 0 22px; font-size: 15px; }
          .spa-fe { width: auto; min-height: 44px; margin: 0; padding: 0 18px; }
        }
      `}</style>
    </div>
  );
}
