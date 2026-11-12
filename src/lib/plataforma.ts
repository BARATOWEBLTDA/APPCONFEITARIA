/**
 * (12/11) O Doonly instalado pela Play Store (Capacitor). Nele não aparece nenhuma venda do PRO com a Hotmart
 * (regra da Play Store: assinatura digital dentro do app só pelo pagamento do Google). Quem já assinou pelo site
 * usa o PRO normalmente. O app nativo se identifica com "DoonlyApp" no user agent (capacitor.config.ts).
 */
type ComCapacitor = Window & { Capacitor?: { isNativePlatform?: () => boolean } };
export const noAppDaLoja: boolean = typeof window !== "undefined" && (
  !!(window as ComCapacitor).Capacitor?.isNativePlatform?.() || /DoonlyApp/.test(navigator.userAgent || "")
);
