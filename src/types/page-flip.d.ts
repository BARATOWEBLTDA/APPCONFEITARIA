// (19/10) StPageFlip (page-flip) não traz tipos: só o que o catálogo de Natal usa
declare module "page-flip" {
  export class PageFlip {
    constructor(el: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    flipNext(corner?: "top" | "bottom"): void;
    on(evento: "flip" | "changeState", cb: (e: { data: unknown }) => void): void;
    destroy(): void;
  }
}
