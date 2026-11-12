import type { CapacitorConfig } from "@capacitor/cli";

/**
 * (12/11) Doonly na Play Store (Capacitor).
 * O app abre o próprio doonly.com.br (toda atualização do site já chega no app, sem mandar versão nova pra loja).
 * "DoonlyApp" no user agent: o site sabe que está no app da loja (vai direto para o /inicio e esconde a venda do PRO pela Hotmart).
 * Sem internet: mostra capacitor-web/sem-internet.html.
 */
const config: CapacitorConfig = {
  appId: "br.com.doonly.app",
  appName: "Doonly",
  webDir: "capacitor-web",
  appendUserAgent: "DoonlyApp",
  backgroundColor: "#FFFFFF",
  server: {
    url: "https://doonly.com.br/inicio",
    androidScheme: "https",
    errorPath: "sem-internet.html",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
