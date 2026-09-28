// ─────────────────────────────────────────────────────────────
// Edge Function: notify-sugestao
//
// Avisa a confeiteira (só ela) quando a ideia dela vira "implementada".
// Chamada AUTOMATICAMENTE pelo banco: trigger em public.sugestoes
// (ver supabase/sql/notify_sugestao_trigger.sql).
//
// Segurança: deploy com --no-verify-jwt; só aceita chamadas com o header
// x-webhook-secret igual ao secret NOTIFY_SUGESTAO_SECRET.
//
// Payload: { sugestao_id: string }
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, NOTIFY_SUGESTAO_SECRET
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Só o banco (com o segredo) pode chamar ──
  const secret = Deno.env.get("NOTIFY_SUGESTAO_SECRET");
  if (!secret || req.headers.get("x-webhook-secret") !== secret) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const { sugestao_id } = await req.json();
    if (!sugestao_id) return json({ error: "sugestao_id required" }, 400);

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contato@doonly.com.br";
    if (!vapidPublic || !vapidPrivate) return json({ error: "VAPID keys not set" }, 500);
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Confere no banco (não confia no payload): precisa estar implementada e ter dona
    const { data: sug, error: sugErr } = await admin
      .from("sugestoes")
      .select("id, user_id, titulo, descricao, status")
      .eq("id", sugestao_id)
      .maybeSingle();
    if (sugErr) return json({ error: "Failed to load sugestao" }, 500);
    if (!sug || sug.status !== "implementada" || !sug.user_id) {
      return json({ ok: true, sent: 0, message: "Nada a enviar" });
    }

    const { data: subs, error: subsErr } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", sug.user_id);
    if (subsErr) return json({ error: "Failed to load subscriptions" }, 500);
    if (!subs || subs.length === 0) return json({ ok: true, sent: 0, message: "Usuária sem notificações ativas" });

    const nomeIdeia = (sug.titulo || sug.descricao || "").trim();
    const curta = nomeIdeia.length > 60 ? nomeIdeia.slice(0, 60).trimEnd() + "..." : nomeIdeia;

    const payload = JSON.stringify({
      title: "🎉 Sua ideia virou realidade!",
      body: curta ? `"${curta}" já está no Doonly. Obrigada por ajudar!` : "Uma ideia sua já está no Doonly. Obrigada por ajudar!",
      icon: "/Sistema/icon-192.png",
      badge: "/Sistema/badge.png",
      tag: `sugestao-${sug.id}`,
      url: "/solicitar-recurso?aba=minhas",
    });

    let sent = 0, expired = 0, failed = 0;
    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          expired++;
        } else {
          console.error(`Push failed for ${s.id}:`, err.statusCode, err.body);
          failed++;
        }
      }
    }));

    console.log(`notify-sugestao ${sug.id}: ${sent} sent, ${expired} expired, ${failed} failed`);
    return json({ ok: true, sent, expired, failed });
  } catch (err) {
    console.error("notify-sugestao fatal error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
