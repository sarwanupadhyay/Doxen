import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Loader2,
  RefreshCw,
  Hash,
  Lock,
  Search,
  Download,
  Users,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  num_members: number;
  topic: string;
  purpose: string;
}

interface SlackConnection {
  id: string;
  team_name: string;
  team_id: string;
  created_at: string;
}

interface SlackImportProps {
  projectId: string;
  onImported: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

async function callSlackFunction(action: string, body?: object) {
  const token = await getToken();
  if (action === "list_channels") {
    return fetch(`${FUNCTION_BASE}/slack-import?action=list_channels`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }
  return fetch(`${FUNCTION_BASE}/slack-import?action=${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const SlackImport = ({ projectId, onImported }: SlackImportProps) => {
  const { toast } = useToast();
  const [connection, setConnection] = useState<SlackConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<SlackChannel | null>(null);
  const [messageLimit, setMessageLimit] = useState(200);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Check for existing connection
  const fetchConnection = async () => {
    setLoadingConnection(true);
    try {
      const { data, error } = await supabase
        .from("user_slack_connections")
        .select("id, team_name, team_id, created_at")
        .limit(1)
        .maybeSingle();
      if (!error && data) setConnection(data);
      else setConnection(null);
    } catch {
      setConnection(null);
    } finally {
      setLoadingConnection(false);
    }
  };

  useEffect(() => {
    fetchConnection();
    // Check URL params for OAuth callback result
    const params = new URLSearchParams(window.location.search);
    if (params.get("slack_connected") === "true") {
      toast({ title: "Slack connected ✓", description: "Your Slack workspace has been linked." });
      fetchConnection();
      // Clean URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
    const slackError = params.get("slack_error");
    if (slackError) {
      toast({ variant: "destructive", title: "Slack connection failed", description: slackError });
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const connectSlack = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ variant: "destructive", title: "Not logged in" });
      return;
    }

    const returnUrl = window.location.origin + window.location.pathname;
    const callbackUri = `${FUNCTION_BASE}/slack-oauth?action=callback`;
    const state = JSON.stringify({ userId: user.id, returnUrl });

    // Get the authorize URL from the edge function
    const resp = await fetch(
      `${FUNCTION_BASE}/slack-oauth?action=authorize&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(callbackUri)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast({ variant: "destructive", title: "Could not start Slack OAuth", description: data.error });
    }
  };

  const disconnectSlack = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("user_slack_connections")
        .delete()
        .eq("id", connection.id);
      if (error) throw error;
      setConnection(null);
      setChannels([]);
      setChannelsLoaded(false);
      setSelectedChannel(null);
      toast({ title: "Slack disconnected" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to disconnect", description: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const loadChannels = async () => {
    setLoadingChannels(true);
    try {
      const resp = await callSlackFunction("list_channels");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load channels");
      setChannels(data.channels || []);
      setChannelsLoaded(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not load Slack channels", description: err.message });
    } finally {
      setLoadingChannels(false);
    }
  };

  const importChannel = async () => {
    if (!selectedChannel) return;
    setImporting(true);
    try {
      const resp = await callSlackFunction("import_channel", {
        projectId,
        channelId: selectedChannel.id,
        channelName: selectedChannel.name,
        messageLimit,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Import failed");
      toast({
        title: "Slack channel imported ✓",
        description: `${data.messageCount} messages from #${selectedChannel.name} added as a source.`,
      });
      setSelectedChannel(null);
      onImported();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    } finally {
      setImporting(false);
    }
  };

  const filtered = channels.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loadingConnection) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:border-primary/30 transition-all duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            Slack
          </CardTitle>
          {connection ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {connection.team_name}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
        <CardDescription>
          {connection
            ? "Import messages from your Slack channels as data sources"
            : "Connect your Slack workspace to import channel messages"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!connection ? (
          <Button variant="outline" className="w-full gap-2" onClick={connectSlack}>
            <ExternalLink className="h-4 w-4" />
            Connect to Slack
          </Button>
        ) : (
          <>
            {!channelsLoaded ? (
              <Button variant="outline" className="w-full" onClick={loadChannels} disabled={loadingChannels}>
                {loadingChannels ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading channels…</>
                ) : (
                  <><MessageSquare className="mr-2 h-4 w-4" />Browse Channels</>
                )}
              </Button>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search channels…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-52 rounded-md border border-border/50">
                  {filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                      No channels found
                    </div>
                  ) : (
                    <div className="p-1">
                      {filtered.map((ch) => (
                        <button
                          key={ch.id}
                          onClick={() => setSelectedChannel(ch)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-muted/50 ${
                            selectedChannel?.id === ch.id ? "bg-primary/10 border border-primary/30" : ""
                          }`}
                        >
                          <div className="shrink-0 text-muted-foreground">
                            {ch.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">#{ch.name}</p>
                            {ch.purpose && (
                              <p className="text-xs text-muted-foreground truncate">{ch.purpose}</p>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {ch.num_members}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={loadChannels}
                  disabled={loadingChannels}
                >
                  <RefreshCw className={`mr-2 h-3 w-3 ${loadingChannels ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                {selectedChannel && (
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Hash className="h-4 w-4 text-primary" />
                      <span className="font-medium">#{selectedChannel.name}</span>
                      {selectedChannel.is_private && (
                        <Badge variant="outline" className="text-xs">Private</Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="msg-limit" className="text-xs text-muted-foreground">
                        Messages to import (max 1000)
                      </Label>
                      <Input
                        id="msg-limit"
                        type="number"
                        min={10}
                        max={1000}
                        value={messageLimit}
                        onChange={(e) =>
                          setMessageLimit(Math.min(1000, Math.max(10, Number(e.target.value))))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <Button className="w-full gap-2" onClick={importChannel} disabled={importing}>
                      {importing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Importing…</>
                      ) : (
                        <><Download className="h-4 w-4" />Import #{selectedChannel.name}</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={disconnectSlack}
              disabled={disconnecting}
            >
              <LogOut className="mr-2 h-3 w-3" />
              Disconnect {connection.team_name}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
