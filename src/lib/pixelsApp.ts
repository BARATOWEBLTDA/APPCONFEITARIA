/**
 * (04/11 · 6.21) Pixels do próprio Doonly, cadastrados no painel admin (Pixels do app).
 * Rodam nas telas do app (login, cadastro, Início, Assinar…) e NUNCA no cardápio público das
 * confeiteiras nem no painel admin. Eventos:
 *  - visita de cada tela;
 *  - CompleteRegistration: a conta foi criada;
 *  - InitiateCheckout: tocou para assinar (vai para a Hotmart);
 *  - StartTrial: o teste grátis da Hotmart começou;
 *  - Subscribe + Purchase: a primeira cobrança passou (virou assinante).
 * Teste grátis e assinatura vão uma vez só por conta (marcado no banco: vale em qualquer aparelho).
 */
import { supabase } from "@/lib/supabase";
import { PRECO_PRO } from "@/lib/beneficiosPro";
import { ligarPixel, visitaDoDono, eventoDoDono, temPixel, type EventoPixel, type Plataforma } from "@/lib/facebookPixel";

/** telas onde os pixels do app não entram */
export const foraDoApp = (caminho: string) => /^\/(c|cardapio|o|orcamento|admin)(\/|$)/.test(caminho) && caminho !== "/cardapio";

export const VALOR_PRO = Number(PRECO_PRO.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

let carregando: Promise<void> | null = null;
/** busca os pixels ligados no painel e liga todos (uma vez por aba) */
export function carregarPixelsDoApp(): Promise<void> {
  if (!carregando) {
    carregando = (async () => {
      try {
        const { data } = await supabase.from("app_pixels").select("plataforma, codigo").eq("ativo", true);
        ((data as { plataforma: Plataforma; codigo: string }[]) || []).forEach(p => ligarPixel(p.plataforma, p.codigo, "app", false)); // a visita sai em visitaDoApp
      } catch { /* sem internet: segue sem pixel */ }
    })();
  }
  return carregando;
}

/** visita de uma tela nova do app */
let ultimaTela = "";
export function visitaDoApp(caminho: string) {
  if (foraDoApp(caminho) || caminho === ultimaTela) return; // uma visita por tela (sem repetir ao redesenhar)
  ultimaTela = caminho;
  void carregarPixelsDoApp().then(() => visitaDoDono("app"));
}

/** evento do app (espera os pixels carregarem; sem pixel ligado, não faz nada) */
export async function eventoDoApp(nome: EventoPixel, dados?: Record<string, unknown>) {
  await carregarPixelsDoApp();
  eventoDoDono("app", nome, dados);
}

/** teste grátis / assinatura: manda uma vez só por conta */
export async function eventoUnicoDoApp(marca: "teste" | "assinatura") {
  await carregarPixelsDoApp();
  // marca mesmo sem pixel ligado: o que aconteceu antes de existir pixel não vira conversão atrasada depois
  const { data: novo } = await supabase.rpc("pixel_marcar", { p_evento: marca });
  if (novo !== true || !temPixel("app")) return;
  if (marca === "teste") eventoDoDono("app", "StartTrial", { value: 0, predicted_ltv: VALOR_PRO * 12 });
  else { eventoDoDono("app", "Subscribe", { value: VALOR_PRO }); eventoDoDono("app", "Purchase", { value: VALOR_PRO, content_name: "Doonly PRO" }); }
}
