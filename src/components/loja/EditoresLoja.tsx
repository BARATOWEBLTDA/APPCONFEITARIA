import { useState } from "react";
import { MapPin } from "@phosphor-icons/react";
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
export function DicaDescricao() {
  return (
    <div className="ppf-d-dica">
      <p>O que escrever?</p>
      <ul>
        <li><b>O que você faz:</b> bolos, doces</li>
        <li><b>Pra quando:</b> festas, dia a dia</li>
        <li><b>Seu diferencial:</b> receita da família</li>
      </ul>
    </div>
  );
}
export const EXEMPLO_DESCRICAO = "Ex.: Bolos e doces feitos em casa, com receita de família. Encomendas pra aniversários e casamentos.";

type End = { rua: string; numero: string; bairro: string; cidade: string; estado: string };
export type Mostrar = "completo" | "cidade" | "nada";

/** "O que aparece no cardápio": cada opção mostra o texto que a cliente vê */
export function OpcoesMostrar({ mostrar, onMudar, end, tituloClasse = "ppf-l" }: { mostrar: Mostrar; onMudar: (v: Mostrar) => void; end: End; tituloClasse?: string }) {
  const cidadeUf = [end.cidade.trim(), end.estado.trim()].filter(Boolean).join(", ");
  const completo = [end.rua.trim() ? `${end.rua.trim()}${end.numero.trim() ? `, ${end.numero.trim()}` : ""}` : "", end.bairro.trim()].filter(Boolean).join(" · ") || cidadeUf;
  return (
    <>
      <p className={tituloClasse} id="ed-mostrar">O que aparece no cardápio</p>
      <div className="ppf-mos" role="radiogroup" aria-labelledby="ed-mostrar">
        {([
          ["completo", "Endereço completo", completo || "Rua, número e bairro", true],
          ["cidade", "Só a cidade", cidadeUf || "Cidade e estado", true],
          ["nada", "Não mostrar", "Bom pra quem atende em casa", false],
        ] as const).map(([v, t, sub, pino]) => (
          <button type="button" role="radio" aria-checked={mostrar === v} key={v} className={mostrar === v ? "on" : ""} onClick={() => onMudar(v)}>
            <i aria-hidden="true" />
            <span><b>{t}</b><small>{pino && <MapPin size={13} weight="fill" aria-hidden="true" />}<em>{sub}</em></small></span>
          </button>
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
export function EditorHorario({ h, onMudar, tituloClasse = "ppf-l ppf-h-tit" }: { h: Horario; onMudar: (fn: (x: Horario) => Horario) => void; tituloClasse?: string }) {
  const [campo, setCampo] = useState<null | { k: keyof Horario; titulo: string }>(null);
  const ligado = (d: string) => d === "Sábado" ? h.abre_sabado : d === "Domingo" ? h.abre_domingo : h.dias.includes(d);
  const trocar = (d: string) => onMudar(x => d === "Sábado" ? { ...x, abre_sabado: !x.abre_sabado } : d === "Domingo" ? { ...x, abre_domingo: !x.abre_domingo }
    : { ...x, dias: x.dias.includes(d) ? x.dias.filter(y => y !== d) : UTEIS.filter(n => n === d || x.dias.includes(n)) });
  const temDia = h.dias.length > 0 || h.abre_sabado || h.abre_domingo;

  const todosUteis = UTEIS.every(n => h.dias.includes(n)) && h.dias.length === 5;
  const padrao: "uteis" | "sabado" | "todos" | null = !todosUteis ? null : !h.abre_sabado && !h.abre_domingo ? "uteis" : h.abre_sabado && !h.abre_domingo ? "sabado" : h.abre_sabado && h.abre_domingo ? "todos" : null;
  const [escolher, setEscolher] = useState(() => padrao === null);
  const modo = escolher || padrao === null ? "escolher" : padrao;
  const usar = (m: "uteis" | "sabado" | "todos" | "escolher") => {
    if (m === "escolher") { setEscolher(true); return; }
    setEscolher(false);
    onMudar(x => ({ ...x, dias: [...UTEIS], abre_sabado: m !== "uteis", abre_domingo: m === "todos" }));
  };

  const sit = temDia ? situacaoDaLoja(h) : null;
  const sitTxt = !sit ? "Marque os dias que você atende" : sit.aberto ? `Aberto agora · fecha às ${horaTexto(sit.fecha)}`
    : !sit.abre ? "Fechado" : `Fechado · abre ${sit.abre.dias === 0 ? "hoje" : sit.abre.dias === 1 ? "amanhã" : DIAS_CURTO[sit.abre.diaSemana].toLowerCase()} às ${horaTexto(sit.abre.minutos)}`;

  const uteis = UTEIS.filter(n => h.dias.includes(n));
  const idx = uteis.map(n => DIAS.findIndex(d => d.nome === n));
  const seguidos = idx.length > 1 && idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
  const curto = (n: string) => DIAS.find(d => d.nome === n)!.curto;
  const rotUteis = uteis.length === 1 ? uteis[0] : seguidos ? `${curto(uteis[0])} a ${curto(uteis[uteis.length - 1]).toLowerCase()}` : "Na semana";

  const linha = (titulo: string, a: keyof Horario, f: keyof Horario) => (
    <div className="ppf-h-l">
      <b>{titulo}</b>
      <span className="ppf-h-hh">
        <button type="button" onClick={() => setCampo({ k: a, titulo: `${titulo} · abre às` })} aria-label={`${titulo}: abre às ${h[a] || "sem horário"}`}>{(h[a] as string) || "--:--"}</button>
        <em>às</em>
        <button type="button" onClick={() => setCampo({ k: f, titulo: `${titulo} · fecha às` })} aria-label={`${titulo}: fecha às ${h[f] || "sem horário"}`}>{(h[f] as string) || "--:--"}</button>
      </span>
    </div>
  );

  return (
    <>
      <p className={tituloClasse} id="ed-dias">Dias que você atende</p>
      <div className="ppf-mos" role="radiogroup" aria-labelledby="ed-dias">
        {([
          ["uteis", "Segunda a sexta", "Seg, Ter, Qua, Qui, Sex"],
          ["sabado", "Segunda a sábado", "Seg a Sáb"],
          ["todos", "Todos os dias", "Seg a Dom"],
          ["escolher", "Escolher os dias", "Marque só os que você atende"],
        ] as const).map(([v, t, sub]) => (
          <button type="button" role="radio" aria-checked={modo === v} key={v} className={modo === v ? "on" : ""} onClick={() => usar(v)}>
            <i aria-hidden="true" /><span><b>{t}</b><small><em>{sub}</em></small></span>
          </button>
        ))}
      </div>
      {modo === "escolher" && (
        <div className="ppf-h-dias">{DIAS.map(d => (
          <button type="button" key={d.nome} className={ligado(d.nome) ? "on" : ""} onClick={() => trocar(d.nome)} aria-pressed={ligado(d.nome)} aria-label={d.nome}>{d.curto}</button>))}</div>
      )}
      {temDia && (<>
        <p className={tituloClasse}>Horário</p>
        <div className="ppf-h-lista">
          {h.dias.length > 0 && linha(rotUteis, "abertura", "fechamento")}
          {h.abre_sabado && linha("Sábado", "sabado_abertura", "sabado_fechamento")}
          {h.abre_domingo && linha("Domingo", "domingo_abertura", "domingo_fechamento")}
        </div>
      </>)}
      <div className="ppf-h-cv">
        <small>Assim aparece no cardápio</small>
        <span className={`ppf-h-pill${!sit ? " vazio" : sit.aberto ? "" : " off"}`}>{sit && <i />}{sitTxt}</span>
      </div>
      {campo && (
        <HorarioSheet titulo={campo.titulo} value={h[campo.k] as string} onChange={(v) => onMudar(x => ({ ...x, [campo.k]: v }))} onClose={() => setCampo(null)} />
      )}
    </>
  );
}
