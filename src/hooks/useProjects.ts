import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "processing" | "completed";
  created_at: string;
  updated_at: string;
  user_id: string;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setProjects(data as Project[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading projects",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (name: string, description?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name,
          description: description || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      setProjects((prev) => [data as Project, ...prev]);
      toast({
        title: "Project created",
        description: `"${name}" has been created successfully.`,
      });
      
      return data as Project;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error creating project",
        description: error.message,
      });
      return null;
    }
  };

  const updateProject = async (id: string, updates: Partial<Pick<Project, "name" | "description">>) => {
    try {
      const { error } = await supabase
        .from("projects")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
      );
      toast({
        title: "Project updated",
        description: "Your changes have been saved.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating project",
        description: error.message,
      });
    }
  };

  const deleteProject = async (id: string) => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);

      if (error) throw error;
      
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast({
        title: "Project deleted",
        description: "The project has been removed.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting project",
        description: error.message,
      });
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
  };
};
