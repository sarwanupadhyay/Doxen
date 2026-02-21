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

  // ── GENERATE AUTHORIZE URL ──
  if (action === "authorize") {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!GOOGLE_CLIENT_ID) {
      return new Response(JSON.stringify({ error: "GOOGLE_CLIENT_ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = url.searchParams.get("state") || "";
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-oauth?action=callback`;

    const scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    googleUrl.searchParams.set("redirect_uri", redirectUri);
    googleUrl.searchParams.set("response_type", "code");
    googleUrl.searchParams.set("scope", scopes);
    googleUrl.searchParams.set("access_type", "offline");
    googleUrl.searchParams.set("prompt", "consent");
    googleUrl.searchParams.set("state", state);

    return new Response(JSON.stringify({ url: googleUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── HANDLE OAUTH CALLBACK ──
  if (action === "callback") {
    try {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        const parsed = state ? JSON.parse(state) : {};
        const returnUrl = parsed.returnUrl || "/";
        return Response.redirect(`${returnUrl}?gmail_error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        return new Response("Missing code or state", { status: 400 });
      }

      const { userId, returnUrl } = JSON.parse(state);
      if (!userId) {
        return new Response("Missing userId in state", { status: 400 });
      }

      const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
      const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return new Response("Google OAuth credentials not configured", { status: 500 });
      }

      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gmail-oauth?action=callback`;

      // Exchange code for tokens
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResp.json();
      if (!tokenResp.ok || tokenData.error) {
        console.error("Google token exchange failed:", tokenData.error || tokenData);
        return Response.redirect(
          `${returnUrl}?gmail_error=${encodeURIComponent(tokenData.error_description || tokenData.error || "token_exchange_failed")}`,
          302
        );
      }

      // Get user email
      const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoResp.json();
      const email = userInfo.email || "unknown@gmail.com";

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      // Upsert connection (one per user+email)
      const { error: dbError } = await supabase
        .from("user_gmail_connections")
        .upsert(
          {
            user_id: userId,
            email,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            token_expires_at: expiresAt,
            scope: tokenData.scope || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,email" }
        );

      if (dbError) {
        console.error("DB upsert error:", dbError.message);
        return Response.redirect(
          `${returnUrl}?gmail_error=${encodeURIComponent("Failed to save connection")}`,
          302
        );
      }

      return Response.redirect(`${returnUrl}?gmail_connected=true`, 302);
    } catch (err) {
      console.error("Gmail OAuth callback error:", err);
      return new Response("Internal error", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
