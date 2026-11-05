// ─────────────────────────────────────────────────────────────
// Edge Function: push-cliente (6.119)
//
// Manda o aviso no celular do CLIENTE quando o pedido dele anda (aceito, em produção, pronto, saiu, entregue, cancelado).
// Quem chama é o gatilho pedido_avisar_cliente (tabela pedidos), com { pedido_id, status } e o cabeçalho x-webhook-secret
// (o mesmo segredo do push-pessoal, conferido pela função push_segredo_ok).
// O aviso leva a logo e o nome da loja; o toque abre o cardápio da loja na aba Pedidos.
// Os aparelhos ficam em cliente_push (o cliente liga em "Avisos do pedido"). Aparelho que não existe mais é apagado.
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (as mesmas do send-push).
// ─────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const dd = (n: number) => String(n).padStart(2, "0");

function dia(data?: string | null, hora?: string | null): string {
  if (!data) return "";
  const d = new Date(`${data}T12:00:00`);
  if (isNaN(d.getTime())) return "";
  return `${DIAS[d.getDay()]}, ${dd(d.getDate())}/${dd(d.getMonth() + 1)}${hora ? `, às ${String(hora).slice(0, 5)}` : ""}`;
}

Deno.serve(async (req) => {
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: ok } = await db.rpc("push_segredo_ok", { s: req.headers.get("x-webhook-secret") || "" });
    if (!ok) return json({ motivo: "Proibido" }, 403);

    const pub = Deno.env.get("VAPID_PUBLIC_KEY"), priv = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!pub || !priv) return json({ sent: 0, motivo: "As chaves do aviso (VAPID) não estão configuradas." }, 500);
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contato@doonly.com.br", pub, priv);

    const { pedido_id } = await req.json().catch(() => ({}));
    const { data: p } = await db.from("pedidos").select("id, numero, status, tipo_entrega, user_id, data_entrega, horario_entrega").eq("id", pedido_id).maybeSingle();
    if (!p) return json({ sent: 0, motivo: "Pedido não encontrado." }, 404);
    const { data: loja } = await db.from("profiles").select("nome_loja, logo_url, codigo_publico, slug_personalizado, endereco_retirada").eq("id", p.user_id).maybeSingle();
    const { data: itens } = await db.from("pedido_itens").select("nome_produto").eq("pedido_id", p.id).limit(2);

    const nomeLoja = (loja?.nome_loja || "A loja").trim();
    const item = itens?.[0]?.nome_produto ? `o seu ${itens[0].nome_produto}` : "o seu pedido";
    const ret = p.tipo_entrega !== "entrega";
    const quando = dia(p.data_entrega, p.horario_entrega);
    let titulo = "", texto = "";
    switch (p.status) {
      case "agendado": case "confirmado":
        titulo = `Pedido #${p.numero} aceito!`; texto = `${nomeLoja} já vai fazer ${item}.${quando ? ` ${ret ? "Retirada" : "Entrega"} ${quando}.` : ""}`; break;
      case "em_producao": case "em_preparo":
        titulo = "Seu pedido está sendo feito"; texto = `${nomeLoja} começou a fazer ${item}.`; break;
      case "finalizado": case "pronto": case "aguardando_retirada":
        titulo = "Seu pedido está pronto";
        texto = ret ? `Pode vir buscar${loja?.endereco_retirada ? `: ${loja.endereco_retirada}` : ""}. Toque para ver o pedido.` : "Ele sai para entrega em breve."; break;
      case "em_entrega": case "a_caminho":
        titulo = "Seu pedido saiu para entrega"; texto = `O pedido #${p.numero} está a caminho.`; break;
      case "entregue": case "concluido":
        titulo = ret ? `Pedido #${p.numero} retirado` : `Pedido #${p.numero} entregue`; texto = `Obrigado por pedir na ${nomeLoja}!`; break;
      case "cancelado": case "recusado":
        titulo = `Pedido #${p.numero} cancelado`; texto = "Ficou com dúvida? Fale com a loja pelo WhatsApp."; break;
      default:
        return json({ sent: 0, motivo: "Situação sem aviso." });
    }

    const { data: subs } = await db.from("cliente_push").select("id, endpoint, p256dh, auth").eq("pedido_id", p.id);
    if (!subs?.length) return json({ sent: 0, total: 0 });
    const url = loja?.codigo_publico ? `/c/${loja.codigo_publico}${loja.slug_personalizado ? `/${loja.slug_personalizado}` : ""}?pedidos=1` : "/";
    const icone = String(loja?.logo_url || "").split(",")[0].trim() || "/Sistema/icon-192.png";
    const payload = JSON.stringify({ title: titulo, body: texto, url, icon: icone, badge: "/Sistema/badge.png", tag: `pedido-cliente-${p.id}` });

    let sent = 0, failed = 0, expired = 0;
    await Promise.all(subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) { expired++; await db.from("cliente_push").delete().eq("id", s.id); } else failed++;
      }
    }));
    // pedido terminou: não precisa guardar os aparelhos
    if (["entregue", "concluido", "cancelado", "recusado"].includes(p.status)) await db.from("cliente_push").delete().eq("pedido_id", p.id);
    return json({ sent, failed, expired, total: subs.length });
  } catch (e) {
    return json({ sent: 0, motivo: String((e as Error)?.message || e) }, 500);
  }
});
