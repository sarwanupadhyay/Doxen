import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequirementSchema = z.object({
  id: z.string().uuid(),
  category: z.enum([
    "functional",
    "non_functional",
    "stakeholder",
    "assumption",
    "constraint",
    "timeline",
    "metric",
    "decision",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  confidence_score: z.number().min(0).max(1),
  source_excerpt: z.string().max(1000).nullable(),
});

const GenerateBRDSchema = z.object({
  projectId: z.string().uuid(),
  projectName: z.string().min(1).max(200).optional(),
  requirements: z.array(RequirementSchema).min(1).max(500),
});

interface BRDContent {
  title: string;
  version: number;
  generatedAt: string;
  sections: BRDSection[];
}

interface BRDSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Input validation
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = GenerateBRDSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { projectId, projectName, requirements } = validation.data;

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Project not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Group requirements by category
    const grouped = requirements.reduce((acc: Record<string, typeof requirements>, req) => {
      if (!acc[req.category]) acc[req.category] = [];
      acc[req.category].push(req);
      return acc;
    }, {});

    const systemPrompt = `You are an expert business analyst creating professional Business Requirements Documents (BRDs).

Generate a comprehensive, well-structured BRD based on the provided requirements. The document should be professional, clear, and ready for stakeholder review.

Return a JSON object with the following structure:
{
  "sections": [
    {
      "id": "unique-id",
      "title": "Section Title",
      "content": "Markdown formatted content",
      "order": 1
    }
  ]
}

Include these sections (adapt based on available requirements):
1. Executive Summary - Brief overview of the project and key objectives
2. Project Scope - What's included and excluded
3. Stakeholders - Key parties involved and their interests
4. Functional Requirements - Detailed feature specifications
5. Non-Functional Requirements - Performance, security, scalability needs
6. Assumptions & Constraints - Project limitations and dependencies
7. Success Metrics - KPIs and measurement criteria
8. Timeline & Milestones - Key dates and deliverables
9. Risks & Mitigation - Potential issues and solutions
10. Appendix - Additional details and references

Use professional language, be specific, and format content with proper markdown (headers, lists, tables where appropriate).`;

    const userPrompt = `Create a BRD for the project "${projectName || 'Untitled Project'}".

Here are the extracted requirements organized by category:

${Object.entries(grouped).map(([category, reqs]) => `
### ${category.toUpperCase().replace('_', ' ')}
${reqs.map((r, i) => `${i + 1}. **${r.title}**: ${r.description}${r.source_excerpt ? ` (Source: "${r.source_excerpt}")` : ''}`).join('\n')}
`).join('\n')}

Generate a professional BRD with all relevant sections based on these requirements.`;

    console.log("Generating BRD for project:", projectId.substring(0, 8));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content returned from AI");
    }

    // Parse the JSON response
    let brdData;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      brdData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse BRD response");
      throw new Error("Failed to parse AI response as JSON");
    }

    // Check if a BRD already exists for this project
    const { data: existingBrd } = await supabase
      .from("generated_brds")
      .select("id, version")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const newVersion = existingBrd ? existingBrd.version + 1 : 1;

    const brdContent: BRDContent = {
      title: projectName || "Business Requirements Document",
      version: newVersion,
      generatedAt: new Date().toISOString(),
      sections: brdData.sections || [],
    };

    // Insert the new BRD
    const { data: savedBrd, error: insertError } = await supabase
      .from("generated_brds")
      .insert({
        project_id: projectId,
        content: brdContent,
        version: newVersion,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to save BRD");
      throw new Error("Failed to save BRD to database");
    }

    console.log("BRD generated successfully, version:", newVersion);

    return new Response(
      JSON.stringify({
        success: true,
        message: `BRD v${newVersion} generated successfully`,
        brd: savedBrd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("BRD generation failed:", error instanceof Error ? error.message : "Unknown error");
    const message = error instanceof Error ? error.message : "Failed to generate BRD";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
