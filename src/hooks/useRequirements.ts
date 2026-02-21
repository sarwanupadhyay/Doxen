import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type RequirementCategory = 
  | "functional" 
  | "non_functional" 
  | "stakeholder" 
  | "assumption" 
  | "constraint" 
  | "timeline" 
  | "metric" 
  | "decision";

export interface ExtractedRequirement {
  id: string;
  project_id: string;
  source_id: string | null;
  category: RequirementCategory;
  title: string;
  description: string;
  confidence_score: number;
  source_excerpt: string | null;
  created_at: string;
  source?: {
    id: string;
    name: string;
    source_type: string;
  };
}

export const useRequirements = (projectId: string) => {
  const [requirements, setRequirements] = useState<ExtractedRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchRequirements = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("extracted_requirements")
        .select(`
          *,
          source:data_sources(id, name, source_type)
        `)
        .eq("project_id", projectId)
        .order("category")
        .order("confidence_score", { ascending: false });

      if (error) throw error;
      setRequirements(data as ExtractedRequirement[]);
    } catch (error: any) {
      console.error("Error fetching requirements:", error);
    } finally {
      setLoading(false);
    }
  };

  const processSourcesWithAI = async () => {
    setProcessing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("process-sources", {
        body: { projectId },
      });

      if (response.error) {
        throw new Error(response.error.message || "Processing failed");
      }

      const result = response.data;
      
      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "Processing complete",
        description: result.message,
      });

      // Refresh requirements
      await fetchRequirements();
    } catch (error: any) {
      console.error("Processing error:", error);
      toast({
        variant: "destructive",
        title: "Processing failed",
        description: error.message || "Failed to process sources",
      });
    } finally {
      setProcessing(false);
    }
  };

  const deleteRequirement = async (id: string) => {
    try {
      const { error } = await supabase
        .from("extracted_requirements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setRequirements((prev) => prev.filter((r) => r.id !== id));
      toast({
        title: "Requirement removed",
        description: "The requirement has been deleted.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  useEffect(() => {
    fetchRequirements();
  }, [projectId]);

  return {
    requirements,
    loading,
    processing,
    processSourcesWithAI,
    deleteRequirement,
    refetch: fetchRequirements,
  };
};
