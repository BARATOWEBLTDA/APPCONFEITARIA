
/** (22/10) tour da tela (driver.js): fundo escurecido, a parte explicada acesa e um balão com Pular, Voltar e Próximo */
export type PassoTour = { el: string; titulo: string; texto: string };

const existe = (p: PassoTour) => { const e = document.querySelector<HTMLElement>(p.el); return !!e && e.getClientRects().length > 0; };
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
    onPopoverRender: (pop) => {
      const dr = d;
      if (!dr.isLastStep()) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tour-pular"; b.textContent = "Pular";
        b.addEventListener("click", () => dr.destroy());
        pop.footerButtons.prepend(b);
      }
    },
    steps: ok.map(p => ({ element: p.el, popover: { title: p.titulo, description: p.texto } })),
  });
  d.drive();
}
