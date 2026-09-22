import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchData {
  id: number;
  homeTeam: { name: string; crest?: string };
  awayTeam: { name: string; crest?: string };
  score?: { fullTime?: { home: number; away: number } };
  status: string;
  competition: { name: string; code: string };
  utcDate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS') || '{}';
    const secretKeys = JSON.parse(secretKeysRaw);
    const supabaseKey = secretKeys.default;
    if (!supabaseKey) {
      throw new Error('SUPABASE_SECRET_KEYS.default is not configured');
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, match, matches } = await req.json();

    let prompt = '';
    let matchId = '';
    let contentType = type || 'headline';

    if (type === 'review' && match) {
      // Post-match review
      matchId = String(match.id);
      const homeTeam = match.homeTeam?.name || 'Home Team';
      const awayTeam = match.awayTeam?.name || 'Away Team';
      const homeScore = match.score?.fullTime?.home ?? 0;
      const awayScore = match.score?.fullTime?.away ?? 0;
      
      prompt = `Write a brief, engaging football match review (2-3 paragraphs) for:
${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}
Competition: ${match.competition?.name || 'Football Match'}
Date: ${match.utcDate || 'Today'}

Make it informative and exciting. Include:
- Key talking points about the result
- What this means for both teams
- Forward-looking statement

Keep the tone professional but engaging like a sports journalist.`;
    } else if (type === 'preview' && match) {
      // Pre-match preview
      matchId = String(match.id);
      const homeTeam = match.homeTeam?.name || 'Home Team';
      const awayTeam = match.awayTeam?.name || 'Away Team';
      
      prompt = `Write a brief, engaging pre-match preview (2-3 paragraphs) for:
${homeTeam} vs ${awayTeam}
Competition: ${match.competition?.name || 'Football Match'}
Date: ${match.utcDate || 'Today'}

Include:
- What's at stake for both teams
- Key factors to watch
- A prediction or talking point

Keep it concise and exciting.`;
    } else if (type === 'roundup' && matches) {
      // Daily roundup
      matchId = `roundup_${new Date().toISOString().split('T')[0]}`;
      const matchSummaries = matches.slice(0, 5).map((m: MatchData) => 
        `${m.homeTeam?.name || 'Home'} ${m.score?.fullTime?.home ?? '?'}-${m.score?.fullTime?.away ?? '?'} ${m.awayTeam?.name || 'Away'} (${m.competition?.name || 'Match'})`
      ).join('\n');
      
      prompt = `Write a brief daily football roundup headline and summary (1-2 paragraphs) covering these results:
${matchSummaries}

Make it punchy and highlight the most significant result or story of the day.`;
    } else {
      // Generate engaging headline
      matchId = `headline_${Date.now()}`;
      prompt = `Generate 3 engaging football headline ideas for today's matches. Make them catchy, informative, and suitable for a sports news website. Format as a JSON array of strings.`;
    }

    // Check cache first
    const { data: cached } = await supabase
      .from('sports_ai_content')
      .select('*')
      .eq('match_id', matchId)
      .eq('content_type', contentType)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      console.log('Returning cached content for:', matchId);
      return new Response(
        JSON.stringify({ 
          headline: cached.headline,
          content: cached.content,
          cached: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating AI content for:', matchId);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional sports journalist specializing in football. Write engaging, accurate content that fans will enjoy reading. Be concise but informative.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'AI rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract headline (first line or sentence)
    const lines = content.split('\n').filter((l: string) => l.trim());
    const headline = lines[0]?.replace(/^[#*]+\s*/, '').slice(0, 200) || 'Football Update';

    // Cache the result
    if (match) {
      await supabase.from('sports_ai_content').upsert({
        match_id: matchId,
        content_type: contentType,
        headline,
        content,
        competition_code: match.competition?.code,
        home_team: match.homeTeam?.name,
        away_team: match.awayTeam?.name,
        match_date: match.utcDate,
      }, { onConflict: 'match_id,content_type' });
    }

    return new Response(
      JSON.stringify({ headline, content, cached: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sports AI error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
