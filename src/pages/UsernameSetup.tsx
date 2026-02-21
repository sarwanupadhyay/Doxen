import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import doxenLogo from "@/assets/doxen-logo.png";

import { checkUsernameAvailable, createProfile } from "@/hooks/useProfile";
import type { User } from "@supabase/supabase-js";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores allowed");

const UsernameSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }

      // Check if they already have a profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile) {
        navigate("/dashboard");
        return;
      }

      setUser(session.user);

      // Don't pre-fill username — let the user choose their own
    };
    getUser();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    const result = usernameSchema.safeParse(username);
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      // Check uniqueness
      const available = await checkUsernameAvailable(username);
      if (!available) {
        setError("This username is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      if (!user) throw new Error("No user session found");

      const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
      const displayName = user.user_metadata?.full_name || user.user_metadata?.name || null;

      const { error: insertError } = await createProfile(user.id, username, displayName, avatarUrl);
      if (insertError) throw insertError;

      toast({ title: "Welcome to Doxen!", description: `Your username @${username} is all set.` });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to save username." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-6 relative">
      {/* CSS blob background — matches brand look, zero WebGL cost */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(0 100% 50% / 0.28) 0%, transparent 70%)', filter: 'blur(48px)', transform: 'translateZ(0)' }} />
        <div className="absolute -top-16 left-[35%] w-[380px] h-[360px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(152 100% 40% / 0.22) 0%, transparent 70%)', filter: 'blur(56px)', transform: 'translateZ(0)' }} />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(0 100% 50% / 0.14) 0%, transparent 70%)', filter: 'blur(60px)', transform: 'translateZ(0)' }} />
      </div>
      <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass rounded-2xl p-8 shadow-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-6">
              <img src={doxenLogo} alt="Doxen" className="h-10 object-contain" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">One last step!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a unique username for your Doxen account.
            </p>
          </div>

          {/* Google user preview */}
          {user && (
            <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-muted/30 border border-border/30">
              {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                <img
                  src={user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt="Profile"
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {(user.user_metadata?.full_name || user.email || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.user_metadata?.full_name || user.user_metadata?.name || "Google User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm text-muted-foreground">Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="yourname"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                    setError(null);
                  }}
                  className="pl-10 bg-muted/50 border-border/60 focus:border-primary/50"
                  disabled={loading}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and underscores only. Must be unique.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red"
              disabled={loading || username.length < 3}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Saving..." : "Continue to Dashboard"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UsernameSetup;
