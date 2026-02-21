import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Mail, Lock, ArrowLeft, Loader2, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { z } from "zod";
import doxenLogo from "@/assets/doxen-logo.png";

import { checkUsernameAvailable, createProfile } from "@/hooks/useProfile";
import { lovable } from "@/integrations/lovable/index";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores allowed");

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    username?: string;
  }>({});

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/dashboard");
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // For OAuth logins, the redirect_uri handles routing — don't double-navigate here
        if (event === "SIGNED_IN") {
          // Check if they have a profile; if not, send to setup
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", session.user.id)
            .maybeSingle();
          navigate(profile ? "/dashboard" : "/setup-username");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const validateForm = async () => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e) { if (e instanceof z.ZodError) newErrors.email = e.errors[0].message; }
    try { passwordSchema.parse(password); } catch (e) { if (e instanceof z.ZodError) newErrors.password = e.errors[0].message; }
    if (isSignUp && password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    if (isSignUp) {
      try {
        usernameSchema.parse(username);
        const available = await checkUsernameAvailable(username);
        if (!available) newErrors.username = "This username is already taken";
      } catch (e) {
        if (e instanceof z.ZodError) newErrors.username = e.errors[0].message;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameChecking(true);
    const valid = await validateForm();
    setUsernameChecking(false);
    if (!valid) return;
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { username },
          },
        });
        if (error) {
          if (error.message.includes("already registered")) {
            toast({ variant: "destructive", title: "Account exists", description: "This email is already registered. Please sign in instead." });
          } else throw error;
        } else {
          // Create profile immediately after signup
          if (data.user) {
            await createProfile(data.user.id, username, undefined, undefined);
          }
          toast({ title: "Check your email", description: "We've sent you a confirmation link to verify your account." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({ variant: "destructive", title: "Invalid credentials", description: "The email or password you entered is incorrect." });
          } else if (error.message.includes("Email not confirmed")) {
            toast({ variant: "destructive", title: "Email not confirmed", description: "Please check your email and click the confirmation link." });
          } else throw error;
        }
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/setup-username`,
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to sign in with Google." });
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

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/[0.06] blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <div className="glass rounded-2xl p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-6">
              <img src={doxenLogo} alt="Doxen" className="h-10 object-contain" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{isSignUp ? "Create an account" : "Welcome back"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isSignUp ? "Start generating BRDs in minutes" : "Sign in to your account to continue"}
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm text-muted-foreground">Username</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="yourname"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    className="pl-10 bg-muted/50 border-border/60 focus:border-primary/50"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
                {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only. Must be unique.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} className="pl-10 bg-muted/50 border-border/60 focus:border-primary/50" disabled={loading} />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="pl-10 bg-muted/50 border-border/60 focus:border-primary/50" disabled={loading} />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 bg-muted/50 border-border/60 focus:border-primary/50" disabled={loading} />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
            )}

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red" disabled={loading || usernameChecking}>
              {(loading || usernameChecking) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="relative my-6">
            <Separator className="bg-border/50" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              or continue with
            </span>
          </div>

          <Button variant="outline" className="w-full glass border-border/40 text-foreground hover:bg-muted/30"
            onClick={handleGoogleAuth} disabled={loading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrors({}); }} className="text-primary hover:underline font-medium">
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
