/**
 * (23/10) No cardápio da confeiteira, a aba do navegador mostra a logo da loja (ou um bolinho, se ela não tiver logo),
 * e não o ícone do Doonly. Ao sair do cardápio (a dona abriu o próprio cardápio dentro do app), volta o ícone do app.
 */
const BOLINHO = "data:image/svg+xml," + encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
  "<rect width='64' height='64' rx='14' fill='#EC4899'/>" +
  "<path d='M17 33h30l-4.5 18h-21z' fill='#fff'/>" +
  "<path d='M25 33l2 18M32 33v18M39 33l-2 18' stroke='#F9A8C9' stroke-width='2'/>" +
  "<path d='M14 34c0-10 8-16 18-16s18 6 18 16z' fill='#FDE2EC'/>" +
  "<circle cx='32' cy='14' r='4.5' fill='#fff'/>" +
  "</svg>");

let originais: { el: HTMLLinkElement; href: string }[] | null = null;

export function trocarFaviconPelaLoja(logo?: string | null) {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon'], link[rel='shortcut icon']"));
  if (!originais) originais = links.map(el => ({ el, href: el.getAttribute("href") || "" }));
  const href = logo ? logo : BOLINHO;
  links.forEach(el => {
    el.setAttribute("href", href);
    if (href === BOLINHO) el.setAttribute("type", "image/svg+xml"); else el.removeAttribute("type");
    el.removeAttribute("sizes");
  });
}

export function voltarFaviconDoApp() {
  if (!originais) return;
  originais.forEach(({ el, href }) => { el.setAttribute("href", href); el.setAttribute("type", "image/png"); });
  originais = null;
}
