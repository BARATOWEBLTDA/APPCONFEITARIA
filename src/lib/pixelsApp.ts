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
import { ligarPixel, visitaDoDono, eventoDoDono, temPixel, pixelsLigados, type EventoPixel, type Plataforma } from "@/lib/facebookPixel";

/** telas onde os pixels do app não entram */
export const foraDoApp = (caminho: string) => /^\/(c|cardapio|o|orcamento|admin)(\/|$)/.test(caminho) && caminho !== "/cardapio";

export const VALOR_PRO = Number(PRECO_PRO.replace(/[^\d,]/g, "").replace(",", ".")) || 0;

/** (21/11) quem está logada: e-mail, telefone e o id da conta, para a Meta casar o evento com a pessoa (correspondência avançada) */
let pessoa: { em?: string; ph?: string; external_id?: string } = {};
async function lerPessoa(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const u = session?.user; if (!u) return {};
    const tel = String((u.user_metadata as { telefone?: string; whatsapp?: string } | undefined)?.telefone || (u.user_metadata as { whatsapp?: string } | undefined)?.whatsapp || u.phone || "").replace(/\D/g, "");
    pessoa = { ...(u.email ? { em: u.email.trim().toLowerCase() } : {}), ...(tel.length >= 10 ? { ph: tel.length <= 11 ? "55" + tel : tel } : {}), external_id: u.id };
  } catch { pessoa = {}; }
  return pessoa as Record<string, string>;
}
const CAPI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-capi`;
const cookie = (n: string) => { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : ""; };
/** (21/11) o mesmo evento pelo pixel do navegador e pelo servidor (API de Conversões), com o mesmo código para a Meta juntar os dois */
function eventoNosDois(nome: EventoPixel, dados?: Record<string, unknown>, idFixo?: string) {
  const id = idFixo || `${nome.toLowerCase()}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
  eventoDoDono("app", nome, dados, id);
  const pixels = pixelsLigados("app"); if (!pixels.length) return;
  if (!pessoa.external_id) void lerPessoa().then(() => mandarServidor(nome, id, dados, pixels)); else mandarServidor(nome, id, dados, pixels);
}
function mandarServidor(nome: string, id: string, dados: Record<string, unknown> | undefined, pixels: string[]) {
  try {
    const corpo = JSON.stringify({ event_name: nome, event_id: id, event_source_url: location.href.split("#")[0], fbp: cookie("_fbp"), fbc: cookie("_fbc"), custom_data: { currency: "BRL", ...(dados || {}) }, pixels, ...pessoa });
    void fetch(CAPI, { method: "POST", headers: { "Content-Type": "text/plain" }, body: corpo, keepalive: true }).catch(() => {});
  } catch { /* sem rede: segue só com o pixel */ }
}

let carregando: Promise<void> | null = null;
/** busca os pixels ligados no painel e liga todos (uma vez por aba) */
export function carregarPixelsDoApp(): Promise<void> {
  if (!carregando) {
    carregando = (async () => {
      try {
        const [{ data }, quem] = await Promise.all([supabase.from("app_pixels").select("plataforma, codigo").eq("ativo", true), lerPessoa()]);
        ((data as { plataforma: Plataforma; codigo: string }[]) || []).forEach(p => ligarPixel(p.plataforma, p.codigo, "app", false, quem)); // a visita sai em visitaDoApp
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
  eventoNosDois(nome, dados);
}

/** teste grátis / assinatura: manda uma vez só por conta */
export async function eventoUnicoDoApp(marca: "teste" | "assinatura") {
  await carregarPixelsDoApp();
  // marca mesmo sem pixel ligado: o que aconteceu antes de existir pixel não vira conversão atrasada depois
  const { data: novo } = await supabase.rpc("pixel_marcar", { p_evento: marca });
  if (novo !== true || !temPixel("app")) return;
  if (marca === "teste") eventoNosDois("StartTrial", { value: 0, predicted_ltv: VALOR_PRO * 12 });
  else { eventoNosDois("Subscribe", { value: VALOR_PRO }); eventoNosDois("Purchase", { value: VALOR_PRO, content_name: "Doonly PRO" }); }
}
