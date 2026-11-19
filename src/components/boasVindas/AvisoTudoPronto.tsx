import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "@phosphor-icons/react";
import IconeWhatsApp from "@/components/IconeWhatsApp";
import { WHATSAPP_EQUIPE } from "@/components/billing/EquipeMonta";
import "./avisoTudoPronto.css";

/**
 * (19/11) Aviso de quem terminou os 8 passos: "Tudo pronto!" na tela, com o fundo escurecido.
 * Diz que o app já está liberado e oferece a equipe para cadastrar a confeitaria (banners, descrições, fotos,
 * produtos e categorias), sem custo. O botão abre o WhatsApp do suporte com a mensagem pronta.
 * Abre uma vez só (quem chama guarda que já mostrou).
 */
const FAZEMOS = ["Banners para sua loja", "Descrições profissionais", "Melhorar suas fotos", "Cadastrar produtos", "Cadastrar categorias", "E muito mais"];
const CORES = ["#F5C76B", "#FFE3A6", "#FF8FB8", "#E0A93B"];

export default function AvisoTudoPronto({ nome, loja, aoFechar }: { nome?: string | null; loja?: string | null; aoFechar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", tecla); document.body.style.overflow = antes; };
  }, [aoFechar]);
  // confete: fora da faixa do título (não passa por cima do texto), sempre nos mesmos lugares
  const confete = useMemo(() => {
    let x = 5; const r = () => { x = (x * 16807) % 2147483647; return x / 2147483647; };
    const pecas = [];
    while (pecas.length < 30) {
      const left = 3 + r() * 94, top = 4 + r() * 54;
      if (left > 30 && left < 70 && top > 8) continue;
      pecas.push({ left: `${left.toFixed(1)}%`, top: `${top.toFixed(1)}%`, width: [5, 6, 8][Math.floor(r() * 3)], height: [9, 11, 13][Math.floor(r() * 3)], background: CORES[Math.floor(r() * 4)], rotate: `${Math.floor(r() * 180)}deg`, animationDelay: `-${(r() * 4).toFixed(2)}s` });
    }
    return pecas;
  }, []);
  const chamar = () => {
    const quem = [nome, loja].filter(Boolean).join(" · ");
    const msg = `Olá! Terminei de configurar o meu Doonly e quero que a equipe cadastre a minha confeitaria (banners, descrições, fotos, produtos e categorias).${quem ? `\nNome: ${quem}` : ""}`;
    window.open(`https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    aoFechar();
  };
  return createPortal(
    <div className="ui-veu ui-veu--centro atp-veu" onClick={e => { if (e.target === e.currentTarget) aoFechar(); }}>
      <div className="ui-janela ui-janela--conteudo atp" role="dialog" aria-modal="true" aria-labelledby="atp-t">
        <div className="atp-topo">
          {confete.map((c, i) => <i key={i} style={c} aria-hidden="true" />)}
          <button type="button" className="atp-x" aria-label="Fechar" onClick={aoFechar}><X size={20} weight="bold" /></button>
          <div className="atp-doo"><img src="/Sistema/doo.png" alt="" /></div>
          <h2 id="atp-t">Tudo pronto!</h2>
          <p>Seu Doonly já está liberado para usar</p>
        </div>
        <div className="atp-corpo">
          <p className="atp-ch">Nossa equipe faz para você, <b>sem custo:</b></p>
          <div className="atp-lista">
            {FAZEMOS.map(t => <div key={t}><span aria-hidden="true"><Check size={14} weight="bold" /></span>{t}</div>)}
          </div>
        </div>
        <div className="atp-pe">
          <button type="button" className="atp-wa" onClick={chamar}><IconeWhatsApp size={22} />Chamar a equipe no WhatsApp</button>
          <button type="button" className="atp-nao" onClick={aoFechar}>Agora não</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
