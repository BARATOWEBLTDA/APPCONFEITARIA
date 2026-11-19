// ─────────────────────────────────────────────────────────────
// Edge Function: send-reativacao-email (19/11)
//
// E-mails para quem criou a conta e parou:
//   A: não cadastrou nenhum produto                → a equipe cadastra para ela (WhatsApp)
//   B: tem produto, cardápio liberado e parou      → mandar o link do cardápio aos clientes
// Vale para conta grátis, que não é admin, parada há mais de 20 horas. Cada e-mail sai uma vez só por conta.
//
// POST (com o cabeçalho x-webhook-secret, o mesmo segredo dos avisos):
//   { "modo": "teste", "email": "...", "nome": "..." }   → manda os dois para esse e-mail (prova)
//   { "modo": "rodar", "dias": 3, "limite": 30 }         → manda para as contas criadas nos últimos "dias"
// GET ?sair=<id>&k=<assinatura>                            → "não quero mais receber" (link do rodapé)
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ASSUNTO_A, ASSUNTO_B, htmlA, htmlB, textoA, textoB } from "./modelo.ts";

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const pagina = (texto: string, status = 200) =>
  new Response(`<!DOCTYPE html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Doonly</title><body style="margin:0;padding:48px 24px;background:#F4EEF1;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2C1219;text-align:center;font-size:17px;line-height:1.6">${texto}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

const PARADO_MS = 20 * 60 * 60 * 1000;

async function assinar(uid: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`sair:${uid}`));
  return Array.from(new Uint8Array(s)).slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function enviar(resend: string, para: string, assunto: string, html: string, text: string): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Doonly <contato@doonly.com.br>", to: [para], subject: assunto, html, text }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resend = Deno.env.get("RESEND_API_KEY");
    if (!url || !service || !resend) return json({ motivo: "Configuração incompleta." }, 500);
    const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const linkSair = async (uid: string) => `${url}/functions/v1/send-reativacao-email?sair=${uid}&k=${await assinar(uid, service)}`;

    // ── "Não quero mais receber" ──
    if (req.method === "GET") {
      const q = new URL(req.url).searchParams;
      const uid = q.get("sair") || "";
      if (!/^[0-9a-f-]{36}$/i.test(uid) || q.get("k") !== await assinar(uid, service)) return pagina("Este link não é válido.", 400);
      await db.from("profiles").update({ email_reativacao_off: true }).eq("id", uid);
      return pagina("Pronto. Você não vai mais receber estes e-mails do Doonly.");
    }
    if (req.method !== "POST") return json({ motivo: "Use POST." }, 405);

    const { data: ok } = await db.rpc("push_segredo_ok", { s: req.headers.get("x-webhook-secret") || "" });
    if (!ok) return json({ motivo: "Proibido" }, 403);
    const corpo = await req.json().catch(() => null) as { modo?: string; email?: string; nome?: string; dias?: number; limite?: number } | null;

    // ── Prova: os dois e-mails para um endereço ──
    if (corpo?.modo === "teste") {
      const para = String(corpo.email || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return json({ motivo: "Falta o e-mail." }, 400);
      const d = { nome: corpo.nome || "", linkCardapio: "https://doonly.com.br/c/exemplo/cardapio", linkSair: "https://doonly.com.br" };
      const a = await enviar(resend, para, ASSUNTO_A, htmlA(d), textoA(d));
      const b = await enviar(resend, para, ASSUNTO_B, htmlB(d), textoB(d));
      return json({ teste: true, a, b });
    }
    if (corpo?.modo !== "rodar") return json({ motivo: "Modo desconhecido." }, 400);

    // ── Envio de verdade ──
    const dias = Math.min(60, Math.max(1, Number(corpo.dias) || 3));
    const limite = Math.min(100, Math.max(1, Number(corpo.limite) || 30));
    const agora = Date.now();
    const { data: contas, error } = await db.from("profiles")
      .select("id, nome, plano, pro_expira_em, is_admin, ultimo_acesso_em, codigo_publico, cardapio_liberado, reativacao_a_em, reativacao_b_em, email_reativacao_off")
      .gte("created_at", new Date(agora - dias * 86400000).toISOString())
      .lt("ultimo_acesso_em", new Date(agora - PARADO_MS).toISOString())
      .order("created_at", { ascending: true }).limit(500);
    if (error) return json({ motivo: error.message }, 500);

    let a = 0, b = 0, pulou = 0;
    for (const c of contas || []) {
      if (a + b >= limite) break;
      const pro = c.plano === "pro" && (!c.pro_expira_em || new Date(c.pro_expira_em).getTime() > agora);
      if (c.is_admin || pro || c.email_reativacao_off) { pulou++; continue; }
      const { count } = await db.from("produtos").select("id", { count: "exact", head: true }).eq("user_id", c.id);
      const tipo = !count ? (c.reativacao_a_em ? null : "a") : (c.cardapio_liberado && c.codigo_publico && !c.reativacao_b_em ? "b" : null);
      if (!tipo) { pulou++; continue; }
      const { data: u } = await db.auth.admin.getUserById(c.id);
      const email = u?.user?.email || "";
      if (!email || /@doonly\.com\.br$/i.test(email)) { pulou++; continue; }
      const d = { nome: c.nome || "", linkCardapio: `https://doonly.com.br/c/${c.codigo_publico}/cardapio`, linkSair: await linkSair(c.id) };
      // marca antes de enviar: se algo falhar no meio, a conta não recebe duas vezes
      await db.from("profiles").update(tipo === "a" ? { reativacao_a_em: new Date().toISOString() } : { reativacao_b_em: new Date().toISOString() }).eq("id", c.id);
      const foi = tipo === "a" ? await enviar(resend, email, ASSUNTO_A, htmlA(d), textoA(d)) : await enviar(resend, email, ASSUNTO_B, htmlB(d), textoB(d));
      if (foi) { if (tipo === "a") a++; else b++; } else pulou++;
    }
    return json({ enviados_a: a, enviados_b: b, pulou });
  } catch (e) {
    return json({ motivo: String((e as Error)?.message || e) }, 500);
  }
});
