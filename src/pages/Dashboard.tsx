import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Plus, LogOut, FolderOpen, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProjects, Project } from "@/hooks/useProjects";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EditProjectDialog } from "@/components/projects/EditProjectDialog";
import type { User } from "@supabase/supabase-js";
import doxenLogo from "@/assets/doxen-logo.png";

import { useProfile } from "@/hooks/useProfile";
import UserAvatar from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { projects, loading, createProject, updateProject, deleteProject } = useProjects();
  const { avatarUrl, displayName, initials } = useProfile(user);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
      setAuthLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Error signing out", description: error.message });
    } else {
      navigate("/");
    }
  };

  const handleCreateProject = async (name: string, description?: string) => {
    const project = await createProject(name, description);
    if (project) navigate(`/project/${project.id}`);
    return project;
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setEditDialogOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg">
      {/* CSS blob background — matches brand look, zero WebGL cost */}
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(0 100% 50% / 0.28) 0%, transparent 70%)', filter: 'blur(48px)', transform: 'translateZ(0)' }} />
        <div className="absolute -top-16 left-[40%] w-[380px] h-[360px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(152 100% 40% / 0.22) 0%, transparent 70%)', filter: 'blur(56px)', transform: 'translateZ(0)' }} />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, hsl(0 100% 50% / 0.14) 0%, transparent 70%)', filter: 'blur(60px)', transform: 'translateZ(0)' }} />
      </div>

      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 glass-subtle border-b border-border/30 sticky top-0">
        <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <img src={doxenLogo} alt="Doxen" className="h-8 object-contain shrink-0" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop: show name */}
            <span className="hidden sm:block text-sm text-muted-foreground truncate max-w-[180px]">
              @{displayName}
            </span>
            {/* Avatar dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                  <UserAvatar avatarUrl={avatarUrl} initials={initials} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass border-border/40">
                {/* User info bucket */}
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
      </nav>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Your Projects</h1>
            <p className="text-muted-foreground mt-1 text-sm hidden sm:block">
              Create and manage your Business Requirements Documents
            </p>
          </div>
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red shrink-0"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">New Project</span>
            <span className="xs:hidden">New</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="glass rounded-2xl border-dashed border-border/40">
            <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl mb-2 text-foreground text-center">No projects yet</CardTitle>
              <CardDescription className="text-center max-w-sm mb-6 text-muted-foreground text-sm">
                Create your first project to start generating professional BRDs from your communications.
              </CardDescription>
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground neon-glow-red" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Your First Project
              </Button>
            </CardContent>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onEdit={handleEditProject} onDelete={deleteProject} />
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onSubmit={handleCreateProject} />
      <EditProjectDialog project={editingProject} open={editDialogOpen} onOpenChange={setEditDialogOpen} onSubmit={updateProject} />
    </div>
  );
};

export default Dashboard;
