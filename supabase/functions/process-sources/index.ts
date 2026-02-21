import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert business analyst specializing in extracting structured requirements from business communications.

Your task is to analyze the provided content and extract all business-relevant information while filtering out noise (greetings, small talk, emojis, off-topic discussions).

For each piece of relevant information found, extract and categorize it as one of:
- functional: A specific feature or capability the system must have
- non_functional: Performance, security, scalability, or quality requirements
- stakeholder: People, roles, or teams involved with their responsibilities
- assumption: Things assumed to be true for the project
- constraint: Limitations or restrictions on the project
- timeline: Dates, deadlines, milestones, or duration estimates
- metric: Success criteria, KPIs, or measurable outcomes
- decision: Key decisions that have been made

For each extracted requirement:
1. Provide a clear, concise title (max 10 words)
2. Write a detailed description explaining the requirement
3. Include the exact excerpt from the source that supports this
4. Assign a confidence score (0.0 to 1.0) based on how explicitly stated the requirement is

Focus on actionable, specific requirements. Ignore pleasantries, filler content, and off-topic discussions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { projectId } = await req.json();
    if (!projectId) {
      return new Response(JSON.stringify({ error: "Project ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all data sources for this project
    const { data: sources, error: sourcesError } = await supabase
      .from("data_sources")
      .select("*")
      .eq("project_id", projectId);

    if (sourcesError) {
      throw new Error(`Failed to fetch sources: ${sourcesError.message}`);
    }

    if (!sources || sources.length === 0) {
      return new Response(JSON.stringify({ error: "No data sources to process" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update project status to processing
    await supabase
      .from("projects")
      .update({ status: "processing" })
      .eq("id", projectId);

    // Combine all source content
    const combinedContent = sources.map((s, i) => 
      `--- SOURCE ${i + 1}: ${s.name} (${s.source_type}) ---\n${s.content || "[No content]"}`
    ).join("\n\n");

    console.log(`Processing ${sources.length} sources for project ${projectId}`);

    // Call Gemini API to extract requirements
    const userPrompt = `${SYSTEM_PROMPT}\n\nPlease analyze the following business communications and extract all requirements. Return a JSON object with a "requirements" array where each item has: category (one of: functional, non_functional, stakeholder, assumption, constraint, timeline, metric, decision), title, description, source_excerpt, confidence_score (0.0-1.0), and source_index (1-indexed).\n\n${combinedContent}`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        await supabase.from("projects").update({ status: "draft" }).eq("id", projectId);
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        await supabase.from("projects").update({ status: "draft" }).eq("id", projectId);
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add more credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI processing failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();

    // Parse the Gemini response
    let extractedRequirements: any[] = [];
    
    const rawText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawText) {
      try {
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
        const parsed = JSON.parse(jsonStr);
        extractedRequirements = parsed.requirements || [];
      } catch (e) {
        console.error("Failed to parse Gemini response:", e);
      }
    }

    console.log(`Extracted ${extractedRequirements.length} requirements`);

    // Clear existing requirements for this project
    await supabase
      .from("extracted_requirements")
      .delete()
      .eq("project_id", projectId);

    // Insert new requirements with source linking
    const requirementsToInsert = extractedRequirements.map((req: any) => {
      const sourceIndex = (req.source_index || 1) - 1;
      const sourceId = sources[sourceIndex]?.id || sources[0]?.id;
      
      return {
        project_id: projectId,
        source_id: sourceId,
        category: req.category,
        title: req.title,
        description: req.description,
        source_excerpt: req.source_excerpt,
        confidence_score: Math.min(1, Math.max(0, req.confidence_score || 0.8)),
      };
    });

    if (requirementsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("extracted_requirements")
        .insert(requirementsToInsert);

      if (insertError) {
        console.error("Failed to insert requirements:", insertError);
        throw new Error(`Failed to save requirements: ${insertError.message}`);
      }
    }

    // Update project status to completed
    await supabase
      .from("projects")
      .update({ status: "completed" })
      .eq("id", projectId);

    return new Response(JSON.stringify({
      success: true,
      requirementsCount: extractedRequirements.length,
      message: `Successfully extracted ${extractedRequirements.length} requirements from ${sources.length} sources`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Process sources error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error occurred"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
