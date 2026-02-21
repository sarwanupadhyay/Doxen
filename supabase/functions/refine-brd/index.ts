import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRDSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(),
});

const RefineBRDSchema = z.object({
  brdId: z.string().uuid(),
  instruction: z.string().min(1).max(1000),
  currentContent: z.object({
    title: z.string(),
    version: z.number(),
    generatedAt: z.string(),
    sections: z.array(BRDSectionSchema),
  }),
});

interface BRDContent {
  title: string;
  version: number;
  generatedAt: string;
  sections: z.infer<typeof BRDSectionSchema>[];
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

    const validation = RefineBRDSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { brdId, instruction, currentContent } = validation.data;

    // Verify BRD ownership via project join
    const { data: existingBrd, error: brdError } = await supabase
      .from("generated_brds")
      .select("version, project_id, projects!inner(user_id)")
      .eq("id", brdId)
      .single();

    if (brdError || !existingBrd) {
      return new Response(JSON.stringify({ error: "BRD not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore - projects is joined
    if (existingBrd.projects?.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "BRD not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert business analyst helping refine a Business Requirements Document (BRD).

The user will provide the current BRD content and a natural language instruction for how to modify it. Apply the requested changes while:
- Maintaining professional tone and formatting
- Preserving the overall document structure
- Keeping content consistent and coherent
- Using proper markdown formatting

Return the complete updated BRD as a JSON object with the same structure:
{
  "title": "Document title",
  "sections": [
    {
      "id": "section-id",
      "title": "Section Title", 
      "content": "Updated markdown content",
      "order": 1
    }
  ]
}

Only modify what the user specifically requests. Keep everything else intact.`;

    const userPrompt = `Current BRD:
${JSON.stringify(currentContent, null, 2)}

User instruction: "${instruction}"

Apply the requested changes and return the complete updated BRD.`;

    console.log("Refining BRD:", brdId.substring(0, 8));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
          ],
          generationConfig: { temperature: 0.5 },
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
    let updatedBrd;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      updatedBrd = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse refined BRD");
      throw new Error("Failed to parse AI response");
    }

    // Create the updated content
    const updatedContent: BRDContent = {
      title: updatedBrd.title || currentContent.title,
      version: existingBrd.version + 1,
      generatedAt: new Date().toISOString(),
      sections: updatedBrd.sections || [],
    };

    // Update the BRD in the database
    const { data: savedBrd, error: updateError } = await supabase
      .from("generated_brds")
      .update({
        content: updatedContent,
        version: updatedContent.version,
        updated_at: new Date().toISOString(),
      })
      .eq("id", brdId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update BRD");
      throw new Error("Failed to save refined BRD");
    }

    console.log("BRD refined successfully, new version:", updatedContent.version);

    return new Response(
      JSON.stringify({
        success: true,
        message: `BRD refined to v${updatedContent.version}`,
        brd: savedBrd,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("BRD refinement failed:", error instanceof Error ? error.message : "Unknown error");
    const message = error instanceof Error ? error.message : "Failed to refine BRD";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
