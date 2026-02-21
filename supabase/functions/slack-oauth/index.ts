import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // ── GENERATE AUTHORIZE URL ──────────────────────────────────────────────
  if (action === "authorize") {
    const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
    if (!SLACK_CLIENT_ID) {
      return new Response(JSON.stringify({ error: "SLACK_CLIENT_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = url.searchParams.get("state") || "";
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const scopes = "channels:read,channels:history,users:read";

    const slackUrl = new URL("https://slack.com/oauth/v2/authorize");
    slackUrl.searchParams.set("client_id", SLACK_CLIENT_ID);
    slackUrl.searchParams.set("scope", scopes);
    slackUrl.searchParams.set("redirect_uri", redirectUri);
    slackUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ url: slackUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── HANDLE OAUTH CALLBACK ──────────────────────────────────────────────
  if (action === "callback") {
    try {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state"); // contains JSON {userId, returnUrl}
      const error = url.searchParams.get("error");

      if (error) {
        const parsed = state ? JSON.parse(state) : {};
        const returnUrl = parsed.returnUrl || "/";
        return Response.redirect(`${returnUrl}?slack_error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      const { userId, returnUrl } = JSON.parse(state);
      if (!userId) {
        return new Response("Missing userId in state", { status: 400 });
      }

      const SLACK_CLIENT_ID = Deno.env.get("SLACK_CLIENT_ID");
      const SLACK_CLIENT_SECRET = Deno.env.get("SLACK_CLIENT_SECRET");
      if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
        return new Response("Slack OAuth credentials not configured", { status: 500 });
      }

      // Exchange code for token
      const tokenResp = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code,
          redirect_uri: `${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-oauth?action=callback`,
        }),
      });

      const tokenData = await tokenResp.json();
      if (!tokenData.ok) {
        console.error("Slack token exchange failed:", tokenData.error);
        return Response.redirect(
          `${returnUrl}?slack_error=${encodeURIComponent(tokenData.error || "token_exchange_failed")}`,
          302
        );
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Upsert connection (one per user+team)
      const { error: dbError } = await supabase
        .from("user_slack_connections")
        .upsert(
          {
            user_id: userId,
            team_id: tokenData.team?.id,
            team_name: tokenData.team?.name || "Unknown",
            access_token: tokenData.access_token,
            bot_user_id: tokenData.bot_user_id || null,
            scope: tokenData.scope || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,team_id" }
        );

      if (dbError) {
        console.error("DB upsert error:", dbError.message);
        return Response.redirect(
          `${returnUrl}?slack_error=${encodeURIComponent("Failed to save connection")}`,
          302
        );
      }

      return Response.redirect(`${returnUrl}?slack_connected=true`, 302);
    } catch (err) {
      console.error("OAuth callback error:", err);
      return new Response("Internal error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
