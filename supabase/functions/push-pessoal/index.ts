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
const semEmoji = (s: string) => (s || "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").replace(/\s+([!.,])/g, "$1").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ sent: 0, motivo: "As chaves do aviso (VAPID) não estão configuradas no servidor." }, 500);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@doonly.com.br", pub, priv);

    const corpo = await req.json().catch(() => ({}));
    let userId = "";
    let aviso: { title: string; body: string; url: string; image?: string; tag: string };

    if (corpo?.teste) {
      // ── teste: só nos aparelhos de quem pediu ──
      const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
      const { data: { user } } = await db.auth.getUser(token);
      if (!user) return json({ sent: 0, motivo: "Entre na sua conta para testar." }, 401);
      userId = user.id;
      aviso = { title: "Aviso de teste", body: "Os avisos do Doonly estão chegando neste aparelho.", url: "/configuracoes/notificacoes", tag: "doonly-teste" };
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
