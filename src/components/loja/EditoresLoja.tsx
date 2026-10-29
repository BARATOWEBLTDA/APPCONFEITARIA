import { useState } from "react";
import { Clock, CalendarBlank } from "@phosphor-icons/react";
import ListaChaves from "@/components/loja/ListaChaves";
import HorarioSheet from "@/components/HorarioSheet";
import { situacaoDaLoja, horaTexto } from "@/lib/agendaCardapio";
import "./editoresLoja.css";

/**
 * (15/10) Peças da loja usadas em dois lugares: nos Primeiros passos e nas telas Dados da loja / Entrega e pagamento.
 * Assim o visual fica igual nos dois e não se separa de novo.
 */

const DIAS = [
  { nome: "Segunda", curto: "Seg" }, { nome: "Terça", curto: "Ter" }, { nome: "Quarta", curto: "Qua" },
  { nome: "Quinta", curto: "Qui" }, { nome: "Sexta", curto: "Sex" }, { nome: "Sábado", curto: "Sáb" }, { nome: "Domingo", curto: "Dom" },
];
const UTEIS = DIAS.slice(0, 5).map(d => d.nome);
const DIAS_CURTO = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]; // índice do Date.getDay()

/** Caixinha "O que escrever?" da descrição da loja */
export const EXEMPLO_DESCRICAO = "Ex.: Bolos e doces feitos em casa, com receita de família. Encomendas para aniversários e casamentos.";

type End = { rua: string; numero: string; bairro: string; cidade: string; estado: string };
export type Mostrar = "completo" | "cidade" | "nada";

/** "O que aparece no cardápio": cada opção mostra o texto que a cliente vê */
export function OpcoesMostrar({ mostrar, onMudar, tituloClasse = "ppf-l" }: { mostrar: Mostrar; onMudar: (v: Mostrar) => void; end?: End; tituloClasse?: string }) {
  return (
    <>
      <p className={tituloClasse} id="ed-mostrar">O que aparece no cardápio</p>
      <div className="edm-seg" role="radiogroup" aria-labelledby="ed-mostrar">
        {([["completo", "Completo"], ["cidade", "Só a cidade"], ["nada", "Não mostrar"]] as const).map(([v, t]) => (
          <button type="button" role="radio" aria-checked={mostrar === v} key={v} className={mostrar === v ? "on" : ""} onClick={() => onMudar(v)}>{t}</button>
        ))}
      </div>
    </>
  );
}

export type Horario = {
  dias: string[]; abertura: string; fechamento: string;
  abre_sabado: boolean; sabado_abertura: string; sabado_fechamento: string;
  abre_domingo: boolean; domingo_abertura: string; domingo_fechamento: string;
};

/**
 * Editor de horário: dias em lista (seg a sex, seg a sáb, todos os dias, escolher), os botões de cada dia só em
 * "Escolher os dias", um cartão de horário por grupo (abre a rodinha do app) e a etiqueta de como fica no cardápio.
 */
/** semCardapio: esconde a linha "No cardápio: …" (quando a tela já mostra a prévia do cardápio ao lado) */
export function EditorHorario({ h, onMudar, semCardapio = false }: { h: Horario; onMudar: (fn: (x: Horario) => Horario) => void; tituloClasse?: string; semCardapio?: boolean }) {
  // (23/10) no padrão do passo "Pagamento e entrega": Segunda a sexta, Sábado e Domingo, cada um com a chave de aberto ou fechado.
  // Ligar o Sábado = "Segunda a sábado"; ligar os três = "Todos os dias"; desmarcar um dia de Seg a Sex = "Escolher os dias".
  const [campo, setCampo] = useState<null | { k: keyof Horario; titulo: string }>(null);
  const temDia = h.dias.length > 0 || h.abre_sabado || h.abre_domingo;
  const semana = h.dias.length > 0;
  const trocarSemana = () => onMudar(x => ({ ...x, dias: x.dias.length > 0 ? [] : [...UTEIS] }));
  const trocarDia = (d: string) => onMudar(x => ({ ...x, dias: x.dias.includes(d) ? x.dias.filter(y => y !== d) : UTEIS.filter(n => n === d || x.dias.includes(n)) }));

  const sit = temDia ? situacaoDaLoja(h) : null;
  const sitTxt = !sit ? "Marque os dias que você atende" : sit.aberto ? `Aberto agora · fecha às ${horaTexto(sit.fecha)}`
    : !sit.abre ? "Fechado" : `Fechado · abre ${sit.abre.dias === 0 ? "hoje" : sit.abre.dias === 1 ? "amanhã" : DIAS_CURTO[sit.abre.diaSemana].toLowerCase()} às ${horaTexto(sit.abre.minutos)}`;
  const curto = (n: string) => DIAS.find(d => d.nome === n)!.curto;
  // (29/10 · 5.01) "Aberto" como no Sábado e no Domingo: os dias já aparecem nos botões logo embaixo
  const subSemana = semana ? "Aberto" : "Fechado";

  // "Abre" e "Fecha": dois campos do mesmo tamanho, com o relógio (abrem o relógio do app)
  const horas = (titulo: string, a: keyof Horario, f: keyof Horario) => (
    <div className="edh-hh">
      {([[a, "Abre"], [f, "Fecha"]] as const).map(([k, rot]) => (
        <button type="button" key={rot} onClick={() => setCampo({ k, titulo: `${titulo} · ${rot.toLowerCase()} às` })} aria-label={`${titulo}: ${rot.toLowerCase()} às ${(h[k] as string) || "sem horário"}`}>
          <Clock size={20} weight="bold" aria-hidden="true" /><span><small>{rot}</small><b>{(h[k] as string) || "--:--"}</b></span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <ListaChaves titulo="Quando você atende" id="ed-dias" itens={[
        { chave: "semana", Ic: CalendarBlank, rotulo: "Segunda a sexta", sub: subSemana, on: semana, aoTocar: trocarSemana, depois: <>
          <div className="edh-dias">{UTEIS.map(d => (
            <button type="button" key={d} className={h.dias.includes(d) ? "on" : ""} aria-pressed={h.dias.includes(d)} aria-label={d} onClick={() => trocarDia(d)}>{curto(d)}</button>
          ))}</div>
          {horas("Segunda a sexta", "abertura", "fechamento")}
        </> },
        { chave: "sabado", Ic: CalendarBlank, rotulo: "Sábado", sub: h.abre_sabado ? "Aberto" : "Fechado", on: h.abre_sabado, aoTocar: () => onMudar(x => ({ ...x, abre_sabado: !x.abre_sabado })), depois: horas("Sábado", "sabado_abertura", "sabado_fechamento") },
        { chave: "domingo", Ic: CalendarBlank, rotulo: "Domingo", sub: h.abre_domingo ? "Aberto" : "Fechado", on: h.abre_domingo, aoTocar: () => onMudar(x => ({ ...x, abre_domingo: !x.abre_domingo })), depois: horas("Domingo", "domingo_abertura", "domingo_fechamento") },
      ]} />
      {!semCardapio && <p className="edh-cv">No cardápio:<b className={!sit ? "vazio" : sit.aberto ? "" : "off"}>{sit && <i aria-hidden="true" />}{sitTxt}</b></p>}
      {campo && (
        <HorarioSheet titulo={campo.titulo} value={h[campo.k] as string} onChange={(v) => onMudar(x => ({ ...x, [campo.k]: v }))} onClose={() => setCampo(null)} />
      )}
    </>
  );
}
