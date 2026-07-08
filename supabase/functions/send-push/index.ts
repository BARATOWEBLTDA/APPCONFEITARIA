// ─────────────────────────────────────────────────────────────
// Edge Function: send-push
//
// Envia Web Push notification para TODOS os subscribers.
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
