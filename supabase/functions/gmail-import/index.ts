import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Refresh the access token if expired */
async function getValidToken(
  connection: any,
  supabase: any
): Promise<string> {
  const now = new Date();
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at)
    : null;

  // If token is still valid (with 60s buffer), use it
  if (expiresAt && expiresAt.getTime() - 60_000 > now.getTime()) {
    return connection.access_token;
  }

  // Need to refresh
  if (!connection.refresh_token) {
    throw new Error("Gmail token expired and no refresh token available. Please reconnect Gmail.");
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials not configured");
  }

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
  }

  const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();

  // Update stored token
  await supabase
    .from("user_gmail_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: newExpiresAt,
    })
    .eq("id", connection.id);

  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase configuration missing");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Gmail connection
    const { data: gmailConn, error: connError } = await supabase
      .from("user_gmail_connections")
      .select("*")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (connError || !gmailConn) {
      return new Response(JSON.stringify({ error: "No Gmail account connected. Please connect Gmail first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getValidToken(gmailConn, supabase);
    const gmailHeaders = { Authorization: `Bearer ${accessToken}` };

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST THREADS ──
    if (action === "list_threads") {
      const query = url.searchParams.get("q") || "";
      const maxResults = url.searchParams.get("maxResults") || "20";

      const params = new URLSearchParams({ maxResults });
      if (query) params.set("q", query);

      const resp = await fetch(`${GMAIL_API}/threads?${params}`, { headers: gmailHeaders });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(`Gmail API error [${resp.status}]: ${JSON.stringify(data.error)}`);
      }

      const threads = data.threads || [];

      // Fetch snippet for each thread (batch of first 20)
      const threadDetails = await Promise.all(
        threads.slice(0, 20).map(async (t: any) => {
          try {
            const detResp = await fetch(
              `${GMAIL_API}/threads/${t.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              { headers: gmailHeaders }
            );
            const det = await detResp.json();
            const firstMsg = det.messages?.[0];
            const headers = firstMsg?.payload?.headers || [];
            const subject = headers.find((h: any) => h.name === "Subject")?.value || "(No subject)";
            const from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
            const date = headers.find((h: any) => h.name === "Date")?.value || "";
            return {
              id: t.id,
              snippet: firstMsg?.snippet || "",
              subject,
              from,
              date,
              messageCount: det.messages?.length || 0,
            };
          } catch {
            return { id: t.id, snippet: t.snippet || "", subject: "(Error loading)", from: "", date: "", messageCount: 0 };
          }
        })
      );

      return new Response(JSON.stringify({ threads: threadDetails, resultSizeEstimate: data.resultSizeEstimate || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT THREAD ──
    if (action === "import_thread") {
      const body = await req.json();
      const { projectId, threadId } = body;

      if (!projectId || !threadId) {
        return new Response(JSON.stringify({ error: "projectId and threadId are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify project ownership
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (projectError || !project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch full thread
      const threadResp = await fetch(`${GMAIL_API}/threads/${threadId}?format=full`, {
        headers: gmailHeaders,
      });
      const threadData = await threadResp.json();

      if (!threadResp.ok) {
        throw new Error(`Gmail API error [${threadResp.status}]: ${JSON.stringify(threadData.error)}`);
      }

      const messages = threadData.messages || [];
      if (messages.length === 0) {
        return new Response(JSON.stringify({ error: "Thread has no messages" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract subject from first message
      const firstHeaders = messages[0]?.payload?.headers || [];
      const subject = firstHeaders.find((h: any) => h.name === "Subject")?.value || "(No subject)";

      // Format messages
      const formattedMessages = messages.map((msg: any) => {
        const hdrs = msg.payload?.headers || [];
        const from = hdrs.find((h: any) => h.name === "From")?.value || "Unknown";
        const date = hdrs.find((h: any) => h.name === "Date")?.value || "";
        const body = extractBody(msg.payload);
        return `From: ${from}\nDate: ${date}\n\n${body}`;
      });

      const content = `Gmail Thread: ${subject}\nMessages: ${messages.length}\nAccount: ${gmailConn.email}\n\n${formattedMessages.join("\n\n---\n\n")}`;

      const { data: source, error: insertError } = await supabase
        .from("data_sources")
        .insert({
          project_id: projectId,
          source_type: "gmail",
          name: `Gmail: ${subject}`,
          content,
          metadata: {
            thread_id: threadId,
            subject,
            message_count: messages.length,
            gmail_account: gmailConn.email,
            imported_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save source: ${insertError.message}`);

      return new Response(JSON.stringify({ success: true, source, messageCount: messages.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT INDIVIDUAL EMAIL ──
    if (action === "import_email") {
      const body = await req.json();
      const { projectId, messageId } = body;

      if (!projectId || !messageId) {
        return new Response(JSON.stringify({ error: "projectId and messageId are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify project ownership
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("user_id", user.id)
        .single();

      if (!project) {
        return new Response(JSON.stringify({ error: "Project not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msgResp = await fetch(`${GMAIL_API}/messages/${messageId}?format=full`, {
        headers: gmailHeaders,
      });
      const msgData = await msgResp.json();

      if (!msgResp.ok) {
        throw new Error(`Gmail API error [${msgResp.status}]: ${JSON.stringify(msgData.error)}`);
      }

      const hdrs = msgData.payload?.headers || [];
      const subject = hdrs.find((h: any) => h.name === "Subject")?.value || "(No subject)";
      const from = hdrs.find((h: any) => h.name === "From")?.value || "Unknown";
      const date = hdrs.find((h: any) => h.name === "Date")?.value || "";
      const emailBody = extractBody(msgData.payload);

      const content = `Gmail Email: ${subject}\nFrom: ${from}\nDate: ${date}\nAccount: ${gmailConn.email}\n\n${emailBody}`;

      const { data: source, error: insertError } = await supabase
        .from("data_sources")
        .insert({
          project_id: projectId,
          source_type: "gmail",
          name: `Gmail: ${subject}`,
          content,
          metadata: {
            message_id: messageId,
            subject,
            from,
            gmail_account: gmailConn.email,
            imported_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save source: ${insertError.message}`);

      return new Response(JSON.stringify({ success: true, source }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Gmail import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Recursively extract plain text body from Gmail message payload */
function extractBody(payload: any): string {
  if (!payload) return "";

  // Direct body data
  if (payload.body?.data) {
    try {
      const decoded = atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
      return decoded;
    } catch {
      return payload.body.data;
    }
  }

  // Multipart — prefer text/plain, fallback to text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart) return extractBody(textPart);

    const htmlPart = payload.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart) {
      const html = extractBody(htmlPart);
      // Strip HTML tags for plain text
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Recurse into nested multipart
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result) return result;
    }
  }

  return "";
}
