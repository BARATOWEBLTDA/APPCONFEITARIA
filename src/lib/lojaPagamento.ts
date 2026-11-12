/**
 * (12/11) Assinatura do PRO pelo pagamento do Google (e depois da Apple) no app da loja, via RevenueCat.
 * A compra abre a tela nativa do Google (cartão, Pix e o que o Google oferecer). Quem confirma o PRO no Doonly é o
 * webhook (supabase/functions/loja-webhook), igual à Hotmart; aqui o app só mostra o resultado na hora.
 * Enquanto a chave do RevenueCat não estiver aqui, o app da loja mostra que a assinatura não está disponível.
 */
import { noAppDaLoja } from "@/lib/plataforma";

/** Chave pública do RevenueCat para Android (começa com "goog_"). Não é segredo: pode ficar no código. */
export const CHAVE_REVENUECAT_ANDROID = "";
/** O "direito" configurado no RevenueCat que liga o PRO */
const DIREITO_PRO = "pro";

export const lojaPagamentoPronto = noAppDaLoja && !!CHAVE_REVENUECAT_ANDROID;

let configurado: Promise<void> | null = null;
const plugin = async () => (await import("@revenuecat/purchases-capacitor")).Purchases;

/** Liga o RevenueCat com o id da conta do Doonly (assim o webhook sabe de quem é a compra) */
export function iniciarLoja(userId: string) {
  if (!lojaPagamentoPronto || !userId) return Promise.resolve();
  if (!configurado) configurado = plugin().then(P => P.configure({ apiKey: CHAVE_REVENUECAT_ANDROID, appUserID: userId })).catch(e => { configurado = null; throw e; });
  return configurado;
}

export type OfertaLoja = { preco: string; teste: string | null };

/** Preço e teste grátis como o Google mostra (na moeda e no formato da pessoa) */
export async function ofertaPro(): Promise<OfertaLoja | null> {
  if (!lojaPagamentoPronto || !configurado) return null;
  await configurado;
  const P = await plugin();
  const { current } = await P.getOfferings();
  const pac = current?.monthly || current?.availablePackages?.[0];
  if (!pac) return null;
  const opc = (pac.product as unknown as { defaultOption?: { freePhase?: { billingPeriod?: { value?: number; unit?: string } } } }).defaultOption;
  const fp = opc?.freePhase?.billingPeriod;
  const teste = fp?.value ? `${fp.value} ${fp.unit === "WEEK" ? (fp.value > 1 ? "semanas" : "semana") : fp.unit === "MONTH" ? (fp.value > 1 ? "meses" : "mês") : (fp.value > 1 ? "dias" : "dia")} grátis` : null;
  return { preco: pac.product.priceString, teste };
}

/** Abre a tela de assinatura do Google. true = o PRO já está ativo nesta conta. */
export async function assinarPelaLoja(): Promise<boolean> {
  if (!configurado) throw new Error("loja_nao_iniciada");
  await configurado;
  const P = await plugin();
  const { current } = await P.getOfferings();
  const pac = current?.monthly || current?.availablePackages?.[0];
  if (!pac) throw new Error("sem_oferta");
  const { customerInfo } = await P.purchasePackage({ aPackage: pac });
  return !!customerInfo.entitlements.active[DIREITO_PRO];
}

/** "Restaurar compra": quem trocou de celular ou reinstalou o app */
export async function restaurarCompra(): Promise<boolean> {
  if (!configurado) return false;
  await configurado;
  const P = await plugin();
  const { customerInfo } = await P.restorePurchases();
  return !!customerInfo.entitlements.active[DIREITO_PRO];
}

/** Compra cancelada pela própria pessoa (fechou a tela do Google): não é erro */
export const cancelouCompra = (e: unknown) => !!(e as { userCancelled?: boolean })?.userCancelled || /cancel/i.test(String((e as { code?: string })?.code || ""));

/** Onde ela gerencia ou cancela a assinatura do Google */
export const LINK_ASSINATURAS_GOOGLE = "https://play.google.com/store/account/subscriptions?package=br.com.doonly.app";
