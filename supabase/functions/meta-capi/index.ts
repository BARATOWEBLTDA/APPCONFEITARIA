// (21/11) API de Conversões da Meta: recebe do site/app o MESMO evento que o pixel do navegador mandou (com o mesmo
// event_id, para a Meta juntar os dois e não contar em dobro) e repassa pelo servidor.
//
// Segredos (Supabase → Edge Functions → Secrets):
//   META_CAPI_TOKENS     → JSON {"<id do pixel>":"<token da API de Conversões>", ...}. Pixel sem token aqui é pulado.
//   META_CAPI_TEST_CODE  → opcional: o código de "Testar eventos" do Gerenciador (os eventos aparecem lá na hora).
// Sem META_CAPI_TOKENS a função responde ok e não envia nada.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const EVENTOS = new Set(["PageView", "ViewContent", "Lead", "CompleteRegistration", "InitiateCheckout", "StartTrial", "Subscribe", "Purchase", "Contact"]);
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const texto = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
async function sha256(v: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { erro: "use POST" });
  let tokens: Record<string, string> = {};
  try { tokens = JSON.parse(Deno.env.get("META_CAPI_TOKENS") || "{}"); } catch { tokens = {}; }
  // deno-lint-ignore no-explicit-any
  let b: any = null;
  try { b = JSON.parse(await req.text()); } catch { return json(400, { erro: "corpo inválido" }); }
  const nome = texto(b?.event_name, 40), id = texto(b?.event_id, 80);
  if (!EVENTOS.has(nome) || !id) return json(400, { erro: "evento inválido" });
  const pixels = (Array.isArray(b?.pixels) ? b.pixels : []).map((p: unknown) => texto(p, 20)).filter((p: string) => /^\d{8,20}$/.test(p) && tokens[p]).slice(0, 6);
  if (!pixels.length) return json(200, { ok: true, enviados: 0 });

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const user: Record<string, unknown> = { client_user_agent: texto(req.headers.get("user-agent"), 500) };
  if (ip) user.client_ip_address = ip;
  if (/^fb\.\d\.\d+\.\d+$/.test(texto(b?.fbp, 100))) user.fbp = texto(b.fbp, 100);
  if (/^fb\.\d\.\d+\..+$/.test(texto(b?.fbc, 500))) user.fbc = texto(b.fbc, 500);
  const em = texto(b?.em, 200).toLowerCase(), ph = texto(b?.ph, 30).replace(/\D/g, ""), ext = texto(b?.external_id, 80);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) user.em = [await sha256(em)];
  if (ph.length >= 10) user.ph = [await sha256(ph.length <= 11 ? "55" + ph : ph)];
  if (ext) user.external_id = [await sha256(ext)];

  const custom: Record<string, unknown> = {};
  const c = b?.custom_data && typeof b.custom_data === "object" ? b.custom_data : {};
  if (Number.isFinite(Number(c.value))) custom.value = Number(c.value);
  if (texto(c.currency, 3)) custom.currency = texto(c.currency, 3).toUpperCase();
  if (texto(c.content_name, 100)) custom.content_name = texto(c.content_name, 100);
  if (Number.isFinite(Number(c.predicted_ltv))) custom.predicted_ltv = Number(c.predicted_ltv);

  const evento: Record<string, unknown> = { event_name: nome, event_time: Math.floor(Date.now() / 1000), event_id: id, action_source: "website", user_data: user, custom_data: custom };
  const url = texto(b?.event_source_url, 600);
  if (/^https:\/\/([a-z0-9-]+\.)*doonly\.com\.br\//.test(url)) evento.event_source_url = url;
  const corpo: Record<string, unknown> = { data: [evento] };
  const teste = Deno.env.get("META_CAPI_TEST_CODE"); if (teste) corpo.test_event_code = teste;

  const res = await Promise.all(pixels.map(async (p: string) => {
    try {
      const r = await fetch(`https://graph.facebook.com/v21.0/${p}/events?access_token=${encodeURIComponent(tokens[p])}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(6000) });
      if (!r.ok) console.error("Meta recusou", p, r.status, (await r.text()).slice(0, 300));
      return r.ok;
    } catch (e) { console.error("Falha ao enviar para a Meta", p, String(e).slice(0, 200)); return false; }
  }));
  return json(200, { ok: true, enviados: res.filter(Boolean).length });
});
