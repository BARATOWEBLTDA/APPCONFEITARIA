// ─────────────────────────────────────────────────────────────
// Edge Function: send-push
//
// Envia Web Push notification para TODOS os subscribers.
// Só aceita chamadas autenticadas do admin (gestao@doonly.com.br).
// Chamada pelo AdminNotificacoes após inserir na tabela notificacoes.
//
// Payload esperado:
//   { titulo: string, mensagem?: string, url?: string, imagem_url?: string, tag?: string }
//
// Secrets necessárias:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:contato@doonly.com.br)
//
// Limpa subscriptions inválidas/expiradas automaticamente (status 410 Gone).
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Segurança: só o admin pode disparar push pra todos ──
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: callerError } = await authClient.auth.getUser(token);
    const ADMIN_EMAILS = ["gestao@doonly.com.br"];
    if (callerError || !caller || !ADMIN_EMAILS.includes(caller.email || "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@doonly.com.br";

    if (!vapidPublic || !vapidPrivate) {
      console.error("VAPID keys not configured");
      return new Response(JSON.stringify({ error: "VAPID keys not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Configura web-push com VAPID
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // Parse body
    const { titulo, mensagem, url, imagem_url, tag } = await req.json();
    if (!titulo) {
      return new Response(JSON.stringify({ error: "titulo required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca TODAS as subscriptions (usa service_role, bypassa RLS)
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: subscriptions, error: fetchError } = await adminClient
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth");

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "No subscribers" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Payload da notificação (o que o sw.js vai receber)
    const payload = JSON.stringify({
      title: titulo,
      body: mensagem || "",
      icon: "/Sistema/icon-192.png",
      badge: "/Sistema/badge.png",
      image: imagem_url || undefined,
      tag: tag || "doonly-notification",
      url: url || "/",
    });

    // Envia para todos os subscribers em paralelo
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        if (String(sub.endpoint).startsWith("fcm:")) {
          const r = await enviarFcm(String(sub.endpoint).slice(4), { title: titulo, body: mensagem || "", url: url || "/", image: imagem_url || undefined, tag: tag || "doonly-notification" }).catch(() => "failed" as const);
          if (r === "expired") { await adminClient.from("push_subscriptions").delete().eq("id", sub.id); return { id: sub.id, status: "expired_removed" }; }
          return { id: sub.id, status: r === "sent" ? "sent" : "failed" };
        }
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { id: sub.id, status: "sent" };
        } catch (err: any) {
          // 410 Gone ou 404 = subscription expirada/inválida → remove do banco
          if (err.statusCode === 410 || err.statusCode === 404) {
            await adminClient.from("push_subscriptions").delete().eq("id", sub.id);
            return { id: sub.id, status: "expired_removed" };
          }
          console.error(`Push failed for ${sub.id}:`, err.statusCode, err.body);
          return { id: sub.id, status: "failed", error: err.statusCode };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).status === "sent"
    ).length;
    const expired = results.filter(
      (r) => r.status === "fulfilled" && (r.value as any).status === "expired_removed"
    ).length;
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && (r.value as any).status === "failed")
    ).length;

    console.log(`Push results: ${sent} sent, ${expired} expired (removed), ${failed} failed`);

    return new Response(
      JSON.stringify({ ok: true, sent, expired, failed, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push fatal error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
