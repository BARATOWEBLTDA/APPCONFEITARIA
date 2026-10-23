
/** (22/10) tour da tela (driver.js): fundo escurecido, a parte explicada acesa e um balão com Pular, Voltar e Próximo */
export type PassoTour = {
  el: string; titulo: string; texto: string; redondo?: boolean;
  /** (23/10) quando a parte não existe (lista vazia), acende o aviso de vazio e explica o que vai aparecer ali, em vez de pular */
  vazio?: Vazio | Vazio[];
};
type Vazio = { el: string; texto: string; titulo?: string };
type Resolvido = { alvo: HTMLElement; titulo: string; texto: string; redondo?: boolean };

/** (23/10) o primeiro que está visível (telas com versão de celular e de computador na página, uma delas escondida) */
const achar = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0);
function resolver(passos: PassoTour[]): Resolvido[] {
  const usados = new Set<HTMLElement>();
  const out: Resolvido[] = [];
  for (const p of passos) {
    const a = achar(p.el);
    if (a && !usados.has(a)) { usados.add(a); out.push({ alvo: a, titulo: p.titulo, texto: p.texto, redondo: p.redondo }); continue; }
    if (a || !p.vazio) continue;
    // o primeiro aviso de vazio que está na tela (ex.: busca sem resultado ou nenhum cadastro ainda)
    for (const vz of Array.isArray(p.vazio) ? p.vazio : [p.vazio]) {
      const v = achar(vz.el);
      if (v && !usados.has(v)) { usados.add(v); out.push({ alvo: v, titulo: vz.titulo || p.titulo, texto: vz.texto }); break; }
    }
  }
  return out;
}
export const contarPassos = (passos: PassoTour[]) => resolver(passos).length;

export async function fazerTour(passos: PassoTour[]) {
  const ok = resolver(passos);
  if (!ok.length) return;
  // a biblioteca só é baixada quando alguém faz o tour
  const [{ driver }] = await Promise.all([import("driver.js"), import("driver.js/dist/driver.css")]);
  const d = driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo",
    prevBtnText: "Voltar",
    doneBtnText: "Entendi",
    popoverClass: "doonly-tour",
    overlayColor: "rgb(20, 10, 7)",
    overlayOpacity: 0.55,
    stagePadding: 6,
    stageRadius: 16,
    allowClose: true,
    smoothScroll: false, // (23/10) rolagem na hora: com a animação, o balão às vezes ficava por cima da parte acesa
    // (22/10) durante o tour não dá pra tocar na parte acesa (antes abria a tela e estragava o tour)
    disableActiveInteraction: true,
    onDestroyed: () => travarRolagem(false),
    // (22/10) botão redondo (o + da barra de baixo): o recorte aceso é o próprio círculo dele, com a borda escura (antes vazava o que estava atrás)
    onHighlightStarted: (el) => {
      const p = ok.find(x => x.alvo === el);
      const raio = p?.redondo ? 999 : 16;
      if (d.getConfig().stageRadius !== raio) d.setConfig({ ...d.getConfig(), stageRadius: raio, stagePadding: p?.redondo ? 4 : 6 });
    },
    onPopoverRender: (pop) => {
      const dr = d;
      if (!dr.isLastStep()) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tour-pular"; b.textContent = "Pular";
        b.addEventListener("click", () => dr.destroy());
        pop.footerButtons.prepend(b);
      }
    },
    steps: ok.map(p => ({ element: p.alvo, popover: { title: p.titulo, description: p.texto, ...(p.redondo ? { side: "top" as const, align: "center" as const, popoverClass: "doonly-tour tour-centro" } : {}) } })),
  });
  travarRolagem(true);
  d.drive();
}

// (22/10) a tela de fundo não rola durante o tour (o próprio tour leva até cada parte)
function travarRolagem(sim: boolean) {
  document.documentElement.classList.toggle("tour-ativo", sim);
  travarFundo(sim, ".driver-popover");
}

/**
 * (23/10) Trava a rolagem da tela de fundo enquanto um balão está aberto (tour e o (i) de cada tela).
 * Só bloqueia o gesto: nada muda de lugar (o topo e o balão continuam onde estão). Dentro do balão a rolagem segue normal.
 */
const dentroDe: string[] = [];
const bloquear = (e: Event) => { const t = e.target as HTMLElement | null; if (!dentroDe.some(sel => t?.closest?.(sel))) e.preventDefault(); };
const teclas = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) e.preventDefault();
};
export function travarFundo(sim: boolean, permitido: string) {
  const op = { passive: false } as AddEventListenerOptions;
  if (sim) {
    if (!dentroDe.length) {
      document.documentElement.classList.add("fundo-travado");
      window.addEventListener("wheel", bloquear, op); window.addEventListener("touchmove", bloquear, op); window.addEventListener("keydown", teclas, op);
    }
    dentroDe.push(permitido);
  } else {
    const k = dentroDe.indexOf(permitido); if (k >= 0) dentroDe.splice(k, 1);
    if (!dentroDe.length) {
      document.documentElement.classList.remove("fundo-travado");
      window.removeEventListener("wheel", bloquear, op); window.removeEventListener("touchmove", bloquear, op); window.removeEventListener("keydown", teclas, op);
    }
  }
}
