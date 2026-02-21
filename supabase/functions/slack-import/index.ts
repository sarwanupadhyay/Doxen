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

    // Get user's Slack connection
    const { data: slackConn, error: connError } = await supabase
      .from("user_slack_connections")
      .select("access_token, team_name")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (connError || !slackConn) {
      return new Response(JSON.stringify({ error: "No Slack workspace connected. Please connect your Slack first." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slackToken = slackConn.access_token;
    const slackHeaders = {
      Authorization: `Bearer ${slackToken}`,
      "Content-Type": "application/json",
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // ── LIST CHANNELS ──────────────────────────────────────────────────────
    if (action === "list_channels") {
      const resp = await fetch(
        `https://slack.com/api/conversations.list?types=public_channel&limit=200&exclude_archived=true`,
        { headers: slackHeaders }
      );
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        throw new Error(`Slack API error [${resp.status}]: ${data.error || JSON.stringify(data)}`);
      }

      const channels = (data.channels || [])
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          is_private: c.is_private,
          num_members: c.num_members,
          topic: c.topic?.value || "",
          purpose: c.purpose?.value || "",
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      return new Response(JSON.stringify({ channels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── IMPORT CHANNEL MESSAGES ────────────────────────────────────────────
    if (action === "import_channel") {
      const body = await req.json();
      const { projectId, channelId, channelName, messageLimit = 200 } = body;

      if (!projectId || !channelId || !channelName) {
        return new Response(JSON.stringify({ error: "projectId, channelId, and channelName are required" }), {
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

      // Fetch messages from Slack using user's own token
      const messagesResp = await fetch(
        `https://slack.com/api/conversations.history?channel=${channelId}&limit=${Math.min(messageLimit, 1000)}`,
        { headers: slackHeaders }
      );
      const messagesData = await messagesResp.json();

      if (!messagesResp.ok || !messagesData.ok) {
        const slackError = messagesData.error;
        if (slackError === "not_in_channel") {
          throw new Error(`The bot is not in #${channelName}. Please invite it by typing /invite @YourBot in that channel, then try again.`);
        }
        throw new Error(
          `Slack messages error [${messagesResp.status}]: ${slackError || JSON.stringify(messagesData)}`
        );
      }

      const messages: any[] = messagesData.messages || [];

      // Resolve user display names
      const userIds = [...new Set(messages.map((m: any) => m.user).filter(Boolean))];
      const userNameMap: Record<string, string> = {};

      if (userIds.length > 0) {
        await Promise.all(
          userIds.map(async (uid: string) => {
            try {
              const uResp = await fetch(`https://slack.com/api/users.info?user=${uid}`, {
                headers: slackHeaders,
              });
              const uData = await uResp.json();
              if (uData.ok) {
                userNameMap[uid] =
                  uData.user?.profile?.display_name ||
                  uData.user?.profile?.real_name ||
                  uData.user?.name ||
                  uid;
              }
            } catch {
              userNameMap[uid] = uid;
            }
          })
        );
      }

      // Format messages into readable transcript
      const formattedMessages = messages
        .filter((m: any) => m.type === "message" && m.text && m.text.trim())
        .reverse()
        .map((m: any) => {
          const ts = new Date(parseFloat(m.ts) * 1000);
          const timeStr = ts.toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "2-digit", minute: "2-digit",
          });
          const sender = m.user ? (userNameMap[m.user] || m.user) : "Unknown";
          const text = m.text.replace(/<@([A-Z0-9]+)>/g, (_match: string, uid: string) =>
            userNameMap[uid] ? `@${userNameMap[uid]}` : _match
          );
          return `[${timeStr}] ${sender}: ${text}`;
        });

      if (formattedMessages.length === 0) {
        return new Response(
          JSON.stringify({ error: "No messages found in this channel (or channel is empty)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const content = `Slack Channel: #${channelName}\nMessages imported: ${formattedMessages.length}\n\n${formattedMessages.join("\n")}`;

      const { data: source, error: insertError } = await supabase
        .from("data_sources")
        .insert({
          project_id: projectId,
          source_type: "slack",
          name: `Slack: #${channelName}`,
          content,
          metadata: {
            channel_id: channelId,
            channel_name: channelName,
            message_count: formattedMessages.length,
            imported_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (insertError) throw new Error(`Failed to save source: ${insertError.message}`);

      return new Response(
        JSON.stringify({
          success: true,
          source,
          messageCount: formattedMessages.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Slack import error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
