import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IndexJumpRequest {
  urls: string[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("INDEXJUMP_API_KEY");
    
    if (!apiKey) {
      console.error("INDEXJUMP_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "IndexJump API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { urls }: IndexJumpRequest = await req.json();

    if (!urls || urls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No URLs provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Submitting ${urls.length} URLs to IndexJump:`, urls);

    const results: { url: string; success: boolean; error?: string }[] = [];

    for (const url of urls) {
      const fullUrl = url.startsWith('http') ? url : `https://zandani.co.ke${url}`;
      
      try {
        const indexUrl = `https://api.indexjump.com/index?url=${encodeURIComponent(fullUrl)}&token=${apiKey}`;
        const response = await fetch(indexUrl);

        if (response.ok) {
          console.log(`✅ Indexed: ${fullUrl}`);
          results.push({ url: fullUrl, success: true });
        } else {
          const errorText = await response.text();
          console.log(`❌ Failed: ${fullUrl} - ${errorText}`);
          results.push({ url: fullUrl, success: false, error: errorText });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.log(`❌ Error: ${fullUrl} - ${errorMessage}`);
        results.push({ url: fullUrl, success: false, error: errorMessage });
      }
    }

    const successful = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Submitted ${successful}/${urls.length} URL(s) to IndexJump`,
        results
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in index-now function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
