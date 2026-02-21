import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ExtractedRequirement } from "@/hooks/useRequirements";

export interface BRDSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface BRDContent {
  title: string;
  version: number;
  generatedAt: string;
  sections: BRDSection[];
}

export interface GeneratedBRD {
  id: string;
  project_id: string;
  content: BRDContent;
  version: number;
  created_at: string;
  updated_at: string;
}

export const useBRD = (projectId: string) => {
  const [brd, setBrd] = useState<GeneratedBRD | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const { toast } = useToast();

  const fetchBRD = async () => {
    if (!projectId) return;

    try {
      const { data, error } = await supabase
        .from("generated_brds")
        .select("*")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Parse the content if it's a string
        const content = typeof data.content === 'string' 
          ? JSON.parse(data.content) 
          : data.content;
        setBrd({ ...data, content } as GeneratedBRD);
      } else {
        setBrd(null);
      }
    } catch (error: any) {
      console.error("Error fetching BRD:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateBRD = async (projectName: string, requirements: ExtractedRequirement[]) => {
    if (requirements.length === 0) {
      toast({
        variant: "destructive",
        title: "No requirements",
        description: "Extract requirements first before generating a BRD.",
      });
      return;
    }

    setGenerating(true);

    try {
      const response = await supabase.functions.invoke("generate-brd", {
        body: {
          projectId,
          projectName,
          requirements: requirements.map((r) => ({
            id: r.id,
            category: r.category,
            title: r.title,
            description: r.description,
            confidence_score: r.confidence_score,
            source_excerpt: r.source_excerpt,
          })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Generation failed");
      }

      const result = response.data;

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "BRD Generated",
        description: result.message,
      });

      await fetchBRD();
    } catch (error: any) {
      console.error("BRD generation error:", error);
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error.message || "Failed to generate BRD",
      });
    } finally {
      setGenerating(false);
    }
  };

  const refineBRD = async (instruction: string) => {
    if (!brd) {
      toast({
        variant: "destructive",
        title: "No BRD",
        description: "Generate a BRD first before refining.",
      });
      return;
    }

    setRefining(true);

    try {
      const response = await supabase.functions.invoke("refine-brd", {
        body: {
          brdId: brd.id,
          instruction,
          currentContent: brd.content,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Refinement failed");
      }

      const result = response.data;

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: "BRD Refined",
        description: result.message,
      });

      await fetchBRD();
    } catch (error: any) {
      console.error("BRD refinement error:", error);
      toast({
        variant: "destructive",
        title: "Refinement failed",
        description: error.message || "Failed to refine BRD",
      });
    } finally {
      setRefining(false);
    }
  };

  useEffect(() => {
    fetchBRD();
  }, [projectId]);

  return {
    brd,
    loading,
    generating,
    refining,
    generateBRD,
    refineBRD,
    refetch: fetchBRD,
  };
};
