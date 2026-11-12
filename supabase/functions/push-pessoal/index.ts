// ─────────────────────────────────────────────────────────────
// Edge Function: push-pessoal (23/10)
//
// Manda o aviso no celular de UMA confeiteira (todos os aparelhos dela).
//   1) Pelo banco: o gatilho da tabela notificacoes chama com { id } e o cabeçalho x-webhook-secret
//      (o segredo fica no Vault e é conferido pela função push_segredo_ok, só com a chave de serviço).
//      Ex.: pedido novo pelo cardápio → "Novo pedido" com a foto do produto, e o toque abre o pedido.
//   2) Teste: a própria confeiteira, logada, chama com { teste: true } e recebe um aviso de teste nos aparelhos dela.
//
// Devolve { sent, failed, expired, total } (e "motivo" quando não deu).
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (as mesmas do send-push).
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));
// ── (12/11) Firebase (app da Play Store): aparelhos com endereço "fcm:<token>" ──
// Secret FCM_CONTA_SERVICO = o JSON da conta de serviço do Firebase (Configurações do projeto › Contas de serviço).
type ContaFcm = { project_id: string; client_email: string; private_key: string };
let acessoFcm: { token: string; ate: number } | null = null;
const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === "string" ? new TextEncoder().encode(b) : new Uint8Array(b as ArrayBuffer);
  let s = ""; bytes.forEach(x => s += String.fromCharCode(x));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
function contaFcm(): ContaFcm | null {
  try { const c = JSON.parse(Deno.env.get("FCM_CONTA_SERVICO") || ""); return c?.project_id && c?.client_email && c?.private_key ? c : null; } catch { return null; }
}
async function tokenFcm(c: ContaFcm): Promise<string> {
  if (acessoFcm && acessoFcm.ate > Date.now() + 60000) return acessoFcm.token;
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const corpo = b64url(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600 }));
  const pem = c.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), ch => ch.charCodeAt(0));
  const chave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const ass = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", chave, new TextEncoder().encode(`${cab}.${corpo}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cab}.${corpo}.${b64url(ass)}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("Firebase recusou a conta de serviço: " + JSON.stringify(j).slice(0, 200));
  acessoFcm = { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return acessoFcm.token;
}
/** "sent" | "expired" (token não vale mais: apagar) | "failed" */
async function enviarFcm(token: string, a: { title: string; body: string; url: string; image?: string; tag?: string }): Promise<"sent" | "expired" | "failed"> {
  const c = contaFcm();
  if (!c) { console.error("FCM_CONTA_SERVICO não configurada"); return "failed"; }
  const imagem = a.image && /^https:\/\//.test(a.image) ? a.image : undefined;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${await tokenFcm(c)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token,
      notification: { title: a.title, body: a.body, ...(imagem ? { image: imagem } : {}) },
      data: { url: a.url || "/" },
      android: { priority: "HIGH", notification: { channel_id: "pedidos", sound: "default", icon: "ic_stat_doonly", color: "#E2437E", ...(a.tag ? { tag: a.tag } : {}) } },
    } }),
  });
  if (r.ok) return "sent";
  const t = await r.text();
  if (r.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(t)) { console.warn("FCM token inválido:", r.status, t.slice(0, 200)); return "expired"; }
  console.error("FCM falhou:", r.status, t.slice(0, 300));
  return "failed";
}

const semEmoji = (s: string) => (s || "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").replace(/\s+([!.,])/g, "$1").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (pub && priv) webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@doonly.com.br", pub, priv);

    const corpo = await req.json().catch(() => ({}));
    let userId = "";
    let aviso: { title: string; body: string; url: string; image?: string; tag: string };

    if (corpo?.teste) {
      // ── teste: só nos aparelhos de quem pediu ──
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) return json({ sent: 0, motivo: "Entre na sua conta para testar." }, 401);
      userId = user.id;
      // (09/11) com o primeiro nome dela ("Deu certo, Bruno!"); nome estranho (número, símbolo, muito curto) fica sem
      const { data: pf } = await db.from("profiles").select("nome").eq("id", user.id).maybeSingle();
      const p1 = String(pf?.nome || "").trim().split(/\s+/)[0] || "";
      const nome = /^[\p{L}][\p{L}'’-]{1,19}$/u.test(p1) ? p1.charAt(0).toLocaleUpperCase("pt-BR") + p1.slice(1).toLocaleLowerCase("pt-BR") : "";
      aviso = { title: nome ? `Deu certo, ${nome}!` : "Deu certo!", body: "Os avisos do Doonly estão chegando neste aparelho.", url: "/notificacoes", tag: "doonly-teste" };
    } else {
      // ── pelo banco: confere o segredo ──
      const segredo = req.headers.get("x-webhook-secret") || "";
      const { data: ok } = await db.rpc("push_segredo_ok", { s: segredo });
      if (!ok) return json({ motivo: "Proibido" }, 403);
      const { data: n } = await db.from("notificacoes").select("id, user_id, tipo, titulo, mensagem, link, chave, imagem_url, push_enviado_em").eq("id", corpo?.id).maybeSingle();
      if (!n || !n.user_id) return json({ sent: 0, motivo: "Aviso não encontrado." }, 404);
      if (n.push_enviado_em) return json({ sent: 0, motivo: "Já enviado." });
      userId = n.user_id;
      let link = n.link || "/";
      let imagem = n.imagem_url || undefined;
      const pedidoId = /^pedido-(.+)$/.exec(n.chave || "")?.[1];
      if (pedidoId) {
        link = `/pedidos/${pedidoId}/editar`;
        // a foto do primeiro produto (os itens podem chegar um instante depois do pedido)
        for (let i = 0; i < 4 && !imagem; i++) {
          const { data: its } = await db.from("pedido_itens").select("produtos(imagem_url)").eq("pedido_id", pedidoId).limit(5);
          const foto = (its || []).map((it: any) => String(it.produtos?.imagem_url || "").split(",")[0].trim()).find(Boolean);
          if (foto) { imagem = foto; break; }
          if ((its || []).length) break;
          await espera(1500);
        }
      }
      aviso = { title: semEmoji(n.titulo), body: semEmoji(n.mensagem || ""), url: link, image: imagem, tag: n.chave || `notif-${n.id}` };
      await db.from("notificacoes").update({ push_enviado_em: new Date().toISOString() }).eq("id", n.id);
    }

    const { data: subs, error } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
    if (error) return json({ sent: 0, motivo: "Não deu para ler os aparelhos." }, 500);
    if (!subs?.length) return json({ sent: 0, total: 0, motivo: "Nenhum aparelho com os avisos ativados nesta conta." });

    const payload = JSON.stringify({ ...aviso, icon: "/Sistema/icon-192.png", badge: "/Sistema/badge.png" });
    let sent = 0, failed = 0, expired = 0;
    await Promise.all(subs.map(async (s: any) => {
      if (String(s.endpoint).startsWith("fcm:")) {
        const r = await enviarFcm(String(s.endpoint).slice(4), aviso).catch((e) => { console.error("FCM erro:", e); return "failed" as const; });
        if (r === "sent") sent++; else if (r === "expired") { expired++; await db.from("push_subscriptions").delete().eq("id", s.id); } else failed++;
        return;
      }
      if (!pub || !priv) { failed++; return; }
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); sent++; }
      catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) { expired++; await db.from("push_subscriptions").delete().eq("id", s.id); }
        else { failed++; console.error("push-pessoal falhou:", e?.statusCode, e?.body); }
      }
    }));
    console.log(`push-pessoal: ${sent} enviados, ${expired} expirados, ${failed} falharam`);
    return json({ sent, failed, expired, total: subs.length });
  } catch (e) {
    console.error("push-pessoal erro:", e);
    return json({ sent: 0, motivo: "Erro no servidor." }, 500);
  }
});
