import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client with service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller using their token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ADMIN_EMAILS = ["gestao@doonly.com.br"];
    if (!ADMIN_EMAILS.includes(user.email || "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userId, email, password, nome, telefone } = body;

    if (action === "create") {
      const { data, error } = await adminClient.auth.admin.createUser({
        email, password,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (error) throw error;
      if (data.user) {
        await adminClient.from("profiles").upsert({
          id: data.user.id, nome, telefone: telefone || null,
        }, { onConflict: "id" });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      await adminClient.from("profiles").delete().eq("id", userId);
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "block") {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "876600h" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unblock") {
      const { error } = await adminClient.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // (6.167) trocar o e-mail de login: a conta é a mesma; o e-mail antigo fica guardado
    // pra Hotmart continuar achando a conta (renovação, cancelamento e reembolso chegam com o e-mail da compra)
    if (action === "change_email") {
      const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const novo = String(email || "").trim().toLowerCase();
      if (!userId || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(novo)) return json(400, { error: "E-mail inválido" });
      const { data: alvo, error: eAlvo } = await adminClient.auth.admin.getUserById(userId);
      if (eAlvo || !alvo?.user) return json(404, { error: "Conta não encontrada" });
      const antigo = String(alvo.user.email || "").trim().toLowerCase();
      if (antigo === novo) return json(400, { error: "Esse já é o e-mail da conta" });
      const { data: dono } = await adminClient.rpc("hotmart_usuario_por_email", { p_email: novo });
      if (dono && dono !== userId) return json(409, { error: "Esse e-mail já é de outra conta" });
      const { error: eTroca } = await adminClient.auth.admin.updateUserById(userId, { email: novo, email_confirm: true });
      if (eTroca) return json(400, { error: eTroca.message });
      const { data: perfil } = await adminClient.from("profiles").select("emails_anteriores").eq("id", userId).maybeSingle();
      const lista = [...new Set([...(((perfil as any)?.emails_anteriores as string[]) || []), antigo].filter(e => e && e !== novo))];
      const { error: eLista } = await adminClient.from("profiles").update({ emails_anteriores: lista }).eq("id", userId);
      if (eLista) console.error("Trocou o e-mail, mas não guardou o antigo:", eLista.message);
      return json(200, { success: true, email: novo, antigo, guardou_antigo: !eLista });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
