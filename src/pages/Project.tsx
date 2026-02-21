import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, LogOut, Mail, Sparkles, Loader2, Menu, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDataSources } from "@/hooks/useDataSources";
import { useRequirements } from "@/hooks/useRequirements";
import { useBRD } from "@/hooks/useBRD";
import { DocumentUpload } from "@/components/sources/DocumentUpload";
import { TranscriptInput } from "@/components/sources/TranscriptInput";
import { IntegrationCard } from "@/components/sources/IntegrationCard";
import { SlackImport } from "@/components/sources/SlackImport";
import { GmailImport } from "@/components/sources/GmailImport";
import { SourcesList } from "@/components/sources/SourcesList";
import { RequirementsList } from "@/components/requirements/RequirementsList";
import { Skeleton } from "@/components/ui/skeleton";
import doxenLogo from "@/assets/doxen-logo.png";
import GlassSurface from "@/components/GlassSurface";
import { useProfile } from "@/hooks/useProfile";
import UserAvatar from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Lazy-load heavy tab components — only fetched when the tab is first visited
const TraceabilityTable = lazy(() =>
  import("@/components/requirements/TraceabilityTable").then((m) => ({ default: m.TraceabilityTable }))
);
const BRDViewer = lazy(() =>
  import("@/components/brd/BRDViewer").then((m) => ({ default: m.BRDViewer }))
);

/** Lightweight skeleton shown while a lazy chunk is downloading */
const TabFallback = () => (
  <div className="space-y-4 pt-2">
    <Skeleton className="h-10 w-full rounded-lg" />
    <Skeleton className="h-32 w-full rounded-lg" />
    <Skeleton className="h-24 w-3/4 rounded-lg" />
  </div>
);

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

const Project = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sources");

  const { sources, addSource, deleteSource, uploadDocument, refetch: refetchSources } = useDataSources(id || "");
  const { requirements, processing, processSourcesWithAI, deleteRequirement } = useRequirements(id || "");
  const { brd, generating, refining, generateBRD, refineBRD } = useBRD(id || "");
  const { avatarUrl, displayName, initials } = useProfile(user);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        toast({ variant: "destructive", title: "Project not found", description: "The project you're looking for doesn't exist." });
        navigate("/dashboard");
        return;
      }
      setProject(data);
      setLoading(false);
    };
    fetchProject();
  }, [id, navigate, toast]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };
  const handleTranscriptSubmit = async (name: string, content: string) => { await addSource("transcript", name, content); };
  // Gmail is now handled by GmailImport component
  const handleProcessSources = async () => { await processSourcesWithAI(); setActiveTab("requirements"); };
  const handleGenerateBRD = async () => { await generateBRD(project?.name || "Untitled Project", requirements); };
  const handleRefineBRD = async (instruction: string) => { await refineBRD(instruction); };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      {/* Navigation */}
      <div className="sticky top-0 z-50 px-2 sm:px-4 pt-1">
        <GlassSurface
          width="100%"
          height={72}
          borderRadius={44}
          borderWidth={0.06}
          brightness={12}
          opacity={0.55}
          blur={22}
          displace={0}
          backgroundOpacity={0.35}
          saturation={1.2}
          distortionScale={-100}
          redOffset={0}
          greenOffset={6}
          blueOffset={12}
          className="border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.18),0_2px_16px_0_rgba(31,38,135,0.10),inset_0_1px_0_0_rgba(255,255,255,0.28),inset_0_-1px_0_0_rgba(255,255,255,0.12),0_0_24px_2px_rgba(255,252,235,0.07)]"
          style={{ width: '100%', height: 'auto' }}
        >
          {/* ── MOBILE NAVBAR (< sm) ── */}
          <div className="flex sm:hidden items-center px-3 py-3 w-full">
            {/* Left: Home icon button */}
            <Link to="/dashboard" className="shrink-0">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-9 w-9">
                <Home className="h-5 w-5" />
              </Button>
            </Link>

            {/* Center: Logo only */}
            <div className="flex-1 flex justify-center">
              <img src={doxenLogo} alt="Doxen" className="h-8 w-auto rounded-lg object-contain" />
            </div>

            {/* Right: Hamburger menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 glass border-border/40 mr-2">
                {/* Username + avatar rectangular bucket */}
                <div className="mx-2 mt-2 mb-1 p-3 rounded-lg border border-border/30 bg-muted/20 flex items-center gap-3">
                  <UserAvatar avatarUrl={avatarUrl} initials={initials} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">@{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-border/40" />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-muted-foreground focus:text-foreground cursor-pointer mx-1 mb-1"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* ── DESKTOP NAVBAR (≥ sm) ── */}
          <div className="hidden sm:flex items-center px-6 py-4 w-full">
            {/* Left: Back + project name */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-base gap-2 shrink-0">
                  <ArrowLeft className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <span className="font-semibold text-foreground text-base tracking-tight truncate">{project?.name}</span>
            </div>
            {/* Center: Logo */}
            <div className="flex items-center shrink-0 px-4">
              <img src={doxenLogo} alt="Doxen" className="h-9 w-auto rounded-lg object-contain" />
            </div>
            {/* Right: Avatar dropdown */}
            <div className="flex-1 flex items-center justify-end gap-3">
              <span className="text-sm text-muted-foreground truncate max-w-[160px]">@{displayName}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full shrink-0">
                    <UserAvatar avatarUrl={avatarUrl} initials={initials} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass border-border/40">
                  <div className="px-3 py-2 flex items-center gap-3 border border-border/30 rounded-lg mx-2 mt-1 mb-1 bg-muted/20">
                    <UserAvatar avatarUrl={avatarUrl} initials={initials} size="md" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">@{displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-border/40" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="gap-2 text-muted-foreground focus:text-foreground cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </GlassSurface>
      </div>

      {/* Refining BRD floating indicator — centered below navbar */}
      {refining && (
        <div className="fixed top-[88px] left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
          <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-primary/30 bg-background/85 backdrop-blur-xl shadow-[0_0_32px_4px_hsl(var(--primary)/0.20),0_8px_32px_rgba(0,0,0,0.35)] animate-in fade-in slide-in-from-top-2 duration-300">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-sm font-medium text-foreground tracking-wide whitespace-nowrap">Refining BRD</span>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-3 sm:px-6 py-5 sm:py-8">
        {/* Header row */}
        <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">{project?.name}</h1>
            {project?.description && (
              <p className="text-muted-foreground mt-1 text-sm line-clamp-2">{project.description}</p>
            )}
          </div>
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red shrink-0 text-xs sm:text-sm"
            disabled={sources.length === 0 || processing}
            onClick={handleProcessSources}
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Processing...</span><span className="sm:hidden">...</span></>
            ) : (
              <><Sparkles className="h-4 w-4" /><span className="hidden sm:inline">Extract Requirements</span><span className="sm:hidden">Extract</span></>
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className="glass border-border/30 bg-muted/20 flex w-full overflow-x-auto scrollbar-none h-auto flex-wrap sm:flex-nowrap gap-1 p-1">
            <TabsTrigger value="sources" className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              Sources ({sources.length})
            </TabsTrigger>
            <TabsTrigger value="requirements" className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              Requirements ({requirements.length})
            </TabsTrigger>
            <TabsTrigger value="traceability" disabled={requirements.length === 0} className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              Traceability
            </TabsTrigger>
            <TabsTrigger value="brd" className="data-[state=active]:bg-primary/20 data-[state=active]:text-foreground text-xs sm:text-sm px-2 sm:px-3 shrink-0">
              BRD {brd ? `(v${brd.content.version})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-5 sm:space-y-6">
            <SourcesList sources={sources} onDelete={deleteSource} />
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Add Data Sources</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <DocumentUpload onUpload={uploadDocument} />
                <TranscriptInput onSubmit={handleTranscriptSubmit} />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Integrations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                 <GmailImport projectId={id || ""} onImported={refetchSources} />
                 <SlackImport projectId={id || ""} onImported={refetchSources} />
               </div>
            </div>
          </TabsContent>

          <TabsContent value="requirements" className="space-y-5 sm:space-y-6">
            <RequirementsList requirements={requirements} onDelete={deleteRequirement} />
          </TabsContent>

          <TabsContent value="traceability" className="space-y-5 sm:space-y-6">
            <Suspense fallback={<TabFallback />}>
              <TraceabilityTable requirements={requirements} />
            </Suspense>
          </TabsContent>

          <TabsContent value="brd" className="space-y-5 sm:space-y-6">
            <Suspense fallback={<TabFallback />}>
              <BRDViewer brd={brd} projectName={project?.name || "Untitled Project"} requirements={requirements}
                generating={generating} refining={refining} onGenerate={handleGenerateBRD} onRefine={handleRefineBRD} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Project;
