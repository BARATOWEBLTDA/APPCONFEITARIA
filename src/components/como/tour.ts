
/** (22/10) tour da tela (driver.js): fundo escurecido, a parte explicada acesa e um balão com Pular, Voltar e Próximo */
export type PassoTour = { el: string; titulo: string; texto: string; redondo?: boolean };

/** (23/10) o primeiro que está visível (telas com versão de celular e de computador na página, uma delas escondida) */
const achar = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)].find(e => e.getClientRects().length > 0);
const existe = (p: PassoTour) => !!achar(p.el);
export const contarPassos = (passos: PassoTour[]) => passos.filter(existe).length;

export async function fazerTour(passos: PassoTour[]) {
  const ok = passos.filter(existe);
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
    smoothScroll: true,
    // (22/10) durante o tour não dá pra tocar na parte acesa (antes abria a tela e estragava o tour)
    disableActiveInteraction: true,
    onDestroyed: () => travarRolagem(false),
    // (22/10) botão redondo (o + da barra de baixo): o recorte aceso é o próprio círculo dele, com a borda escura (antes vazava o que estava atrás)
    onHighlightStarted: (el) => {
      const p = ok.find(x => el?.matches(x.el));
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
    steps: ok.map(p => ({ element: achar(p.el) || p.el, popover: { title: p.titulo, description: p.texto, ...(p.redondo ? { side: "top" as const, align: "center" as const, popoverClass: "doonly-tour tour-centro" } : {}) } })),
  });
  travarRolagem(true);
  d.drive();
}

// (22/10) a tela de fundo não rola durante o tour (o próprio tour leva até cada parte)
const bloquear = (e: Event) => { if (!(e.target as HTMLElement)?.closest?.(".driver-popover")) e.preventDefault(); };
const teclas = (e: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) e.preventDefault(); };
function travarRolagem(sim: boolean) {
  const op = { passive: false } as AddEventListenerOptions;
  document.documentElement.classList.toggle("tour-ativo", sim);
  if (sim) { window.addEventListener("wheel", bloquear, op); window.addEventListener("touchmove", bloquear, op); window.addEventListener("keydown", teclas, op); }
  else { window.removeEventListener("wheel", bloquear, op); window.removeEventListener("touchmove", bloquear, op); window.removeEventListener("keydown", teclas, op); }
}
