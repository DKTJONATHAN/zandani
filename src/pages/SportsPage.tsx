import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeagueSelector } from "@/components/sports/LeagueSelector";
import { LiveScoresWidget } from "@/components/sports/LiveScoresWidget";
import { FixturesList } from "@/components/sports/FixturesList";
import { StandingsTable } from "@/components/sports/StandingsTable";
import { AIHeadlinesBanner } from "@/components/sports/AIHeadlinesBanner";
import { LiveScoreTable } from "@/components/sports/LiveScoreTable";
import { SportsNewsFeed } from "@/components/sports/SportsNewsFeed";
import AdUnit from "@/components/AdUnit";
import { KenyaSportsSection } from "@/components/sports/KenyaSportsSection";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Match, useMatchPreview, useMatchReview, usePreloadSportsData } from "@/hooks/useSportsData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Activity, Calendar, Trophy, Newspaper, Flame, TrendingUp, Radio } from "lucide-react";
import { Helmet } from "react-helmet-async";

export default function SportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialLeague = searchParams.get("league") || "KPL";
  const [selectedLeague, setSelectedLeague] = useState(initialLeague);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [aiContent, setAiContent] = useState<{ headline: string; content: string } | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const previewMutation = useMatchPreview();
  const reviewMutation = useMatchReview();

  usePreloadSportsData();

  useEffect(() => {
    setSearchParams({ league: selectedLeague }, { replace: true });
  }, [selectedLeague, setSearchParams]);

  const handleLeagueSelect = (code: string) => {
    setSelectedLeague(code);
  };

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match);
    setAiContent(null);
  };

  const generateAIContent = async () => {
    if (!selectedMatch) return;
    setIsGeneratingAI(true);
    try {
      const isFinished = selectedMatch.status === 'FINISHED';
      const result = isFinished 
        ? await reviewMutation.mutateAsync(selectedMatch)
        : await previewMutation.mutateAsync(selectedMatch);
      setAiContent(result);
    } catch (error) {
      console.error('AI generation failed:', error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const isKenyaSelected = selectedLeague === "KPL";

  return (
    <Layout>
      <Helmet>
        <title>Za Ndani Sports | Global Football, Live Scores & AI Tactical Analysis</title>
        <meta name="description" content="Elite global football coverage: Premier League, Champions League, La Liga, and Athletics. Real-time data, AI-powered match previews, and insider reporting." />
        <link rel="canonical" href="https://zandani.co.ke/sports" />
        <meta property="og:title" content="Za Ndani Sports | Global Football, Live Scores & AI Tactical Analysis" />
        <meta property="og:description" content="Elite global football coverage: Premier League, Champions League, La Liga, and Athletics. Real-time data and AI-powered match previews." />
        <meta property="og:url" content="https://zandani.co.ke/sports" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Za Ndani" />
        <meta property="og:image" content="https://zandani.co.ke/logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Za Ndani Sports | Live Scores & AI Analysis" />
        <meta name="twitter:description" content="Elite global football coverage with real-time data and AI-powered match previews." />
        <meta property="og:locale" content="en_KE" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://zandani.co.ke" },
            { "@type": "ListItem", "position": 2, "name": "Sports", "item": "https://zandani.co.ke/sports" },
          ],
        })}</script>
      </Helmet>

      {/* Live Ticker Bar */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 text-zinc-300 py-3 backdrop-blur-md sticky top-[64px] z-40">
        <div className="container max-w-7xl mx-auto px-4 flex items-center gap-6">
          <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-primary text-[10px] font-black uppercase tracking-tighter text-white">
            <Radio className="w-3 h-3 animate-pulse" />
            Live Now
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs md:text-sm font-medium animate-in fade-in slide-in-from-right duration-1000">
              Champions League nights, KPL weekends, Harambee Stars and the athletics Kenya actually watches.
            </p>
          </div>
          <Link to="/sports" className="text-xs font-bold text-primary hover:text-primary transition-colors flex items-center gap-1">
            Match Center <Activity className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <main className="py-12 md:py-20 bg-zinc-950 text-zinc-100">
        <div className="container max-w-7xl mx-auto px-4">
          
          {/* Section Header */}
          <div className="max-w-4xl mb-16">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-[0.3em] mb-6">
              <Trophy className="w-4 h-4" />
              <span>Kenya first</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-serif font-black text-white tracking-tighter mb-8 leading-[0.9]">
              The <span className="text-primary italic">Arena.</span>
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 leading-relaxed max-w-2xl font-light">
              Harambee Stars, Gor Mahia, AFC Leopards, then the European nights Kenyans stay up for.
              Live scores, standings, and a Nairobi read on the result.
            </p>
          </div>

          <div className="mb-12">
            <LeagueSelector 
              selected={selectedLeague} 
              onSelect={handleLeagueSelect} 
            />
          </div>

          <div className="grid lg:grid-cols-12 gap-10">
            {/* Main Content Area */}
            <div className="lg:col-span-8 space-y-10">
              <AIHeadlinesBanner />
              <LiveScoreTable />

              {isKenyaSelected ? (
                <KenyaSportsSection />
              ) : (
                <Tabs defaultValue="fixtures" className="w-full">
                  <TabsList className="flex gap-2 bg-transparent h-auto p-0 mb-8 border-b border-divider w-full justify-start rounded-none">
                    <TabsTrigger value="fixtures" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 font-bold text-sm">
                      Fixtures & Results
                    </TabsTrigger>
                    <TabsTrigger value="standings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 font-bold text-sm">
                      League Table
                    </TabsTrigger>
                    <TabsTrigger value="news" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4 font-bold text-sm">
                      Breaking News
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="fixtures" className="focus-visible:ring-0">
                    <FixturesList competition={selectedLeague} onMatchClick={handleMatchClick} />
                  </TabsContent>

                  <TabsContent value="standings">
                    <StandingsTable competition={selectedLeague} />
                  </TabsContent>

                  <TabsContent value="news">
                    <SportsNewsFeed />
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {/* Sidebar Widgets */}
            <aside className="lg:col-span-4 space-y-8">
              <div className="sticky top-24 space-y-8">
                
                {/* Live Scores Panel */}
                <div className="bg-zinc-900/40 rounded-[2.5rem] border border-zinc-800/50 shadow-2xl overflow-hidden backdrop-blur-sm">
                  <div className="bg-zinc-900 p-6 flex items-center justify-between border-b border-zinc-800">
                    <h2 className="text-zinc-100 font-bold tracking-tight flex items-center gap-2">
                      <Radio className="w-4 h-4 text-primary animate-pulse" />
                      Live Center
                    </h2>
                    <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-black uppercase">Active</Badge>
                  </div>
                  <div className="p-4">
                    <LiveScoreTable />
                  </div>
                </div>

                {/* AI Feature Promo */}
                <div className="relative group overflow-hidden bg-gradient-to-br from-rose-600 to-rose-800 rounded-[2.5rem] p-8 text-white shadow-2xl border border-rose-500/20">
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-2xl font-serif font-bold mb-4 leading-tight">
                      Beyond the Scoreline.
                    </h3>
                    <p className="text-rose-100/80 text-sm mb-6 leading-relaxed">
                      Instant tactical breakdowns and match previews powered by proprietary football data.
                    </p>
                    <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-white/40">
                      <TrendingUp className="w-3 h-3" />
                      Insights Engine v4.0
                    </div>
                  </div>
                  {/* Decorative element */}
                  <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                </div>

                {/* Sidebar Ad Slot */}
                <div className="flex justify-center">
                  <AdUnit type="effectivegate" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Match Detail Dialog */}
      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-[2.5rem] border-zinc-800 shadow-2xl bg-zinc-950">
          {selectedMatch && (
            <>
              <div className="bg-zinc-900 p-10 text-white text-center border-b border-zinc-800">
                <p className="text-primary text-[10px] font-black uppercase tracking-[0.4em] mb-6">
                  Match Intelligence
                </p>
                <div className="flex items-center justify-between gap-6">
                  <div className="flex-1 flex flex-col items-center gap-4">
                    {selectedMatch.homeTeam.crest && (
                      <div className="w-20 h-20 bg-white/5 rounded-2xl p-3 backdrop-blur-sm">
                        <img src={selectedMatch.homeTeam.crest} alt={`${selectedMatch.homeTeam.name} crest`} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <span className="font-bold text-lg tracking-tight text-zinc-200">{selectedMatch.homeTeam.name}</span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-6xl font-black mb-4 tracking-tighter">
                      {selectedMatch.score.fullTime?.home ?? '0'} : {selectedMatch.score.fullTime?.away ?? '0'}
                    </span>
                    <Badge variant="outline" className="text-zinc-500 border-zinc-800 bg-zinc-900">
                      {selectedMatch.status === 'FINISHED' ? 'Full Time' : 'Upcoming'}
                    </Badge>
                  </div>

                  <div className="flex-1 flex flex-col items-center gap-4">
                    {selectedMatch.awayTeam.crest && (
                      <div className="w-20 h-20 bg-white/5 rounded-2xl p-3 backdrop-blur-sm">
                        <img src={selectedMatch.awayTeam.crest} alt={`${selectedMatch.awayTeam.name} crest`} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <span className="font-bold text-lg tracking-tight text-zinc-200">{selectedMatch.awayTeam.name}</span>
                  </div>
                </div>
              </div>

              <div className="p-10 space-y-8">
                <div className="flex items-center justify-center gap-6 text-[10px] text-zinc-500 uppercase font-black tracking-widest">
                  <span>{selectedMatch.competition.name}</span>
                  <span className="w-1.5 h-1.5 bg-zinc-800 rounded-full" />
                  <span>Matchday {selectedMatch.matchday}</span>
                </div>

                {!aiContent ? (
                  <Button 
                    onClick={generateAIContent} 
                    disabled={isGeneratingAI}
                    className="w-full h-20 bg-primary hover:bg-primary/90 text-white font-black text-xl shadow-2xl shadow-black/40 transition-all active:scale-[0.98]"
                  >
                    {isGeneratingAI ? (
                      <><Loader2 className="w-6 h-6 mr-3 animate-spin" /> Deep Tactical Scan...</>
                    ) : (
                      <><Sparkles className="w-6 h-6 mr-3 text-rose-200" /> Generate Match Intelligence</>
                    )}
                  </Button>
                ) : (
                  <div className="bg-zinc-900/50 rounded-[2rem] p-10 border border-zinc-800 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        AI Tactical Report
                      </span>
                    </div>
                    <h4 className="text-3xl font-serif font-black text-white mb-6 leading-tight">{aiContent.headline}</h4>
                    <p className="text-lg text-zinc-400 leading-relaxed whitespace-pre-wrap font-light">
                      {aiContent.content}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}