import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SourceType = "document" | "gmail" | "slack" | "transcript";

export interface DataSource {
  id: string;
  project_id: string;
  source_type: SourceType;
  name: string;
  content: string | null;
  metadata: Record<string, any>;
  file_path: string | null;
  created_at: string;
}

export const useDataSources = (projectId: string) => {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSources = async () => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from("data_sources")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSources(data as DataSource[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading sources",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const addSource = async (
    sourceType: SourceType,
    name: string,
    content?: string,
    filePath?: string,
    metadata?: Record<string, any>
  ) => {
    try {
      const { data, error } = await supabase
        .from("data_sources")
        .insert({
          project_id: projectId,
          source_type: sourceType,
          name,
          content: content || null,
          file_path: filePath || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      
      setSources((prev) => [data as DataSource, ...prev]);
      toast({
        title: "Source added",
        description: `"${name}" has been added to your project.`,
      });
      
      return data as DataSource;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding source",
        description: error.message,
      });
      return null;
    }
  };

  const deleteSource = async (id: string) => {
    try {
      const source = sources.find((s) => s.id === id);
      
      // Delete file from storage if it exists
      if (source?.file_path) {
        await supabase.storage.from("documents").remove([source.file_path]);
      }

      const { error } = await supabase.from("data_sources").delete().eq("id", id);

      if (error) throw error;
      
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast({
        title: "Source removed",
        description: "The data source has been deleted.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error removing source",
        description: error.message,
      });
    }
  };

  const uploadDocument = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${projectId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // For now, we'll store a placeholder for content
      // Later, we'll parse the document with an edge function
      const source = await addSource(
        "document",
        file.name,
        `[Document uploaded: ${file.name}]`,
        filePath,
        {
          size: file.size,
          type: file.type,
          originalName: file.name,
        }
      );

      return source;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error uploading document",
        description: error.message,
      });
      return null;
    }
  };

  useEffect(() => {
    fetchSources();
  }, [projectId]);

  return {
    sources,
    loading,
    addSource,
    deleteSource,
    uploadDocument,
    refetch: fetchSources,
  };
};
