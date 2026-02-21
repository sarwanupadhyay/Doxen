import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Loader2,
  Search,
  Download,
  LogOut,
  ExternalLink,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  messageCount: number;
}

interface GmailConnection {
  id: string;
  email: string;
  created_at: string;
}

interface GmailImportProps {
  projectId: string;
  onImported: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}

async function callGmailFunction(action: string, params?: Record<string, string>, body?: object) {
  const token = await getToken();
  const qp = new URLSearchParams({ action, ...params });

  if (body) {
    return fetch(`${FUNCTION_BASE}/gmail-import?${qp}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  return fetch(`${FUNCTION_BASE}/gmail-import?${qp}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

export const GmailImport = ({ projectId, onImported }: GmailImportProps) => {
  const { toast } = useToast();
  const [connection, setConnection] = useState<GmailConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(true);
  const [threads, setThreads] = useState<GmailThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<GmailThread | null>(null);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchConnection = async () => {
    setLoadingConnection(true);
    try {
      const { data, error } = await supabase
        .from("user_gmail_connections" as any)
        .select("id, email, created_at")
        .limit(1)
        .maybeSingle();
      if (!error && data) setConnection(data as any);
      else setConnection(null);
    } catch {
      setConnection(null);
    } finally {
      setLoadingConnection(false);
    }
  };

  useEffect(() => {
    fetchConnection();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail_connected") === "true") {
      toast({ title: "Gmail connected ✓", description: "Your Gmail account has been linked." });
      fetchConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
    const gmailError = params.get("gmail_error");
    if (gmailError) {
      toast({ variant: "destructive", title: "Gmail connection failed", description: gmailError });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connectGmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ variant: "destructive", title: "Not logged in" });
      return;
    }

    const returnUrl = window.location.origin + window.location.pathname;
    const state = JSON.stringify({ userId: user.id, returnUrl });

    const resp = await fetch(
      `${FUNCTION_BASE}/gmail-oauth?action=authorize&state=${encodeURIComponent(state)}`,
      { headers: { "Content-Type": "application/json" } }
    );
    const data = await resp.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      toast({ variant: "destructive", title: "Could not start Gmail OAuth", description: data.error });
    }
  };

  const disconnectGmail = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("user_gmail_connections" as any)
        .delete()
        .eq("id", connection.id);
      if (error) throw error;
      setConnection(null);
      setThreads([]);
      setThreadsLoaded(false);
      setSelectedThread(null);
      toast({ title: "Gmail disconnected" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to disconnect", description: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const loadThreads = async (query?: string) => {
    setLoadingThreads(true);
    try {
      const params: Record<string, string> = {};
      if (query) params.q = query;
      const resp = await callGmailFunction("list_threads", params);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to load threads");
      setThreads(data.threads || []);
      setThreadsLoaded(true);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not load Gmail threads", description: err.message });
    } finally {
      setLoadingThreads(false);
    }
  };

  const handleSearch = () => {
    loadThreads(search || undefined);
  };

  const importThread = async () => {
    if (!selectedThread) return;
    setImporting(true);
    try {
      const resp = await callGmailFunction("import_thread", {}, {
        projectId,
        threadId: selectedThread.id,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Import failed");
      toast({
        title: "Gmail thread imported ✓",
        description: `"${selectedThread.subject}" (${data.messageCount} messages) added as a source.`,
      });
      setSelectedThread(null);
      onImported();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    } finally {
      setImporting(false);
    }
  };

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
              <Mail className="h-4 w-4 text-primary" />
            </div>
            Gmail
          </CardTitle>
          {connection ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {connection.email}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
        <CardDescription>
          {connection
            ? "Import email threads as data sources for requirement extraction"
            : "Connect your Gmail account to import email conversations"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!connection ? (
          <Button variant="outline" className="w-full gap-2" onClick={connectGmail}>
            <ExternalLink className="h-4 w-4" />
            Connect Gmail
          </Button>
        ) : (
          <>
            {!threadsLoaded ? (
              <Button variant="outline" className="w-full" onClick={() => loadThreads()} disabled={loadingThreads}>
                {loadingThreads ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading threads…</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Browse Emails</>
                )}
              </Button>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search emails… (e.g. subject:project OR from:client)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={handleSearch} disabled={loadingThreads}>
                    {loadingThreads ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                <ScrollArea className="h-52 rounded-md border border-border/50">
                  {threads.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
                      No threads found
                    </div>
                  ) : (
                    <div className="p-1">
                      {threads.map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThread(thread)}
                          className={`w-full flex items-start gap-3 px-3 py-2 rounded-md text-left transition-colors hover:bg-muted/50 ${
                            selectedThread?.id === thread.id ? "bg-primary/10 border border-primary/30" : ""
                          }`}
                        >
                          <div className="shrink-0 mt-0.5 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{thread.subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{thread.from}</p>
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{thread.snippet}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="h-3 w-3" />
                            {thread.messageCount}
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
                  onClick={() => loadThreads(search || undefined)}
                  disabled={loadingThreads}
                >
                  <RefreshCw className={`mr-2 h-3 w-3 ${loadingThreads ? "animate-spin" : ""}`} />
                  Refresh
                </Button>

                {selectedThread && (
                  <div className="space-y-3 pt-1 border-t border-border/40">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground truncate">{selectedThread.subject}</p>
                      <p className="text-xs text-muted-foreground">{selectedThread.from} • {selectedThread.messageCount} messages</p>
                    </div>
                    <Button className="w-full gap-2" onClick={importThread} disabled={importing}>
                      {importing ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Importing…</>
                      ) : (
                        <><Download className="h-4 w-4" />Import Thread</>
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
              onClick={disconnectGmail}
              disabled={disconnecting}
            >
              <LogOut className="mr-2 h-3 w-3" />
              Disconnect {connection.email}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
