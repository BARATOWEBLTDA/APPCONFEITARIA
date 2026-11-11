// (11/11) Acesso de suporte: a equipe Doonly pede acesso a uma loja; a confeiteira aprova no app (7 dias);
// com a aprovação, "entrar" gera um login de uso único na conta dela (sem senha). Tudo fica registrado.
//   pedir  {userId}            → admin: cria o pedido e avisa a confeiteira (notificação + celular)
//   status {userId}            → admin: o último pedido da loja (pendente, aprovado até quando, recusado…)
//   entrar {userId}            → admin: confere aprovado e no prazo; devolve o token de login (uso único)
//   cancelar {userId}          → admin: desiste de um pedido ainda pendente
//   sair   {acessoId}          → na aba do suporte (com o token dela): registra a saída
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const ADMINS = ["gestao@doonly.com.br"];
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "sem_login" }, 401);
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return json({ error: "sem_login" }, 401);
    const body = await req.json().catch(() => ({}));
    const { action, userId, acessoId, perfilId } = body as { action?: string; userId?: string; acessoId?: string; perfilId?: string };

    // ── saída: chamada pela aba do suporte, com o login da própria confeiteira
    if (action === "sair") {
      if (!acessoId) return json({ error: "dados" }, 400);
      const { data: a } = await admin.from("acessos_suporte").select("id, user_id").eq("id", acessoId).maybeSingle();
      if (!a || a.user_id !== user.id) return json({ error: "nao_encontrado" }, 404);
      await admin.from("acessos_suporte_log").insert({ acesso_id: a.id, user_id: a.user_id, evento: "saiu" });
      return json({ ok: true });
    }

    // daqui pra baixo, só a equipe Doonly
    if (!ADMINS.includes((user.email || "").toLowerCase())) return json({ error: "proibido" }, 403);
    if (!userId) return json({ error: "dados" }, 400);

    const ultimo = async () => {
      const { data } = await admin.from("acessos_suporte").select("*").eq("user_id", userId).order("pedido_em", { ascending: false }).limit(1).maybeSingle();
      return data as null | { id: string; status: string; expira_em: string | null; pedido_em: string; ultimo_acesso_em: string | null };
    };
    const valido = (a: { status: string; expira_em: string | null } | null) => !!a && a.status === "aprovado" && !!a.expira_em && new Date(a.expira_em).getTime() > Date.now();

    if (action === "status") {
      const a = await ultimo();
      if (a && a.status === "aprovado" && !valido(a)) return json({ acesso: { ...a, status: "vencido" } });
      return json({ acesso: a });
    }

    if (action === "pedir") {
      const a = await ultimo();
      if (a && (a.status === "pendente" || valido(a))) return json({ acesso: a, jaExiste: true });
      // quem pediu: o perfil do painel admin (Bruno, Anthony…), lido do banco (não confia no nome que veio do navegador)
      const { data: pa } = perfilId ? await admin.from("admin_perfis").select("nome, foto_url, cor").eq("id", perfilId).maybeSingle() : { data: null };
      const quem = pa?.nome || "Equipe Doonly";
      const { data: novo, error } = await admin.from("acessos_suporte").insert({ user_id: userId, pedido_por: user.email, pedido_por_nome: pa?.nome || null, pedido_por_foto: pa?.foto_url || null, pedido_por_cor: pa?.cor || null }).select("*").single();
      if (error) throw error;
      await admin.from("acessos_suporte_log").insert({ acesso_id: novo.id, user_id: userId, evento: "pedido" });
      await admin.from("notificacoes").insert({
        user_id: userId, tipo: "suporte", chave: `suporte_${novo.id}`,
        titulo: pa?.nome ? `${quem}, da equipe Doonly, quer te ajudar` : "A equipe Doonly quer te ajudar",
        mensagem: "Pediu acesso para deixar seu cardápio pronto para vender. Toque para ver.",
        link: `/acessos-suporte?pedido=${novo.id}`,
      });
      return json({ acesso: novo });
    }

    if (action === "cancelar") {
      const a = await ultimo();
      if (!a || a.status !== "pendente") return json({ error: "nada_pendente" }, 400);
      await admin.from("acessos_suporte").update({ status: "cancelado", respondido_em: new Date().toISOString() }).eq("id", a.id);
      return json({ ok: true });
    }

    if (action === "entrar") {
      const a = await ultimo();
      if (!valido(a)) return json({ error: "sem_acesso" }, 403);
      const { data: alvo, error: e1 } = await admin.auth.admin.getUserById(userId);
      if (e1 || !alvo?.user?.email) return json({ error: "conta" }, 400);
      const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: alvo.user.email });
      if (e2 || !link?.properties?.hashed_token) return json({ error: "link" }, 500);
      await admin.from("acessos_suporte").update({ ultimo_acesso_em: new Date().toISOString() }).eq("id", a!.id);
      await admin.from("acessos_suporte_log").insert({ acesso_id: a!.id, user_id: userId, evento: "entrou" });
      const { data: pf } = await admin.from("profiles").select("nome_loja").eq("id", userId).maybeSingle();
      return json({ tokenHash: link.properties.hashed_token, acessoId: a!.id, expira: a!.expira_em, loja: pf?.nome_loja || "Loja" });
    }

    return json({ error: "acao" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
