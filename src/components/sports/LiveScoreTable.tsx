import { useMatches, getMatchStatus, Match } from "@/hooks/useSportsData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Radio, Trophy, Activity, ArrowRight } from "lucide-react";

export function LiveScoreTable() {
  const { data: matches, isLoading, error } = useMatches('ALL');

  const liveMatches = matches?.filter(m => 
    m.status === 'IN_PLAY' || m.status === 'LIVE' || m.status === 'PAUSED'
  ) || [];

  const upcomingMatches = matches?.filter(m => 
    m.status === 'SCHEDULED' || m.status === 'TIMED'
  ) || [];

  const finishedMatches = matches?.filter(m => m.status === 'FINISHED') || [];

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 rounded-[2.5rem] p-10 border border-zinc-800 animate-pulse">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-16 w-full bg-zinc-800/50 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/20 backdrop-blur-md rounded-[2.5rem] p-16 border border-zinc-800/50 text-center">
        <Activity className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
        <p className="text-zinc-500 font-serif italic">The global feed is currently resting. Check back in a moment.</p>
      </div>
    );
  }

  const allRelevantMatches = [...liveMatches, ...upcomingMatches, ...finishedMatches].slice(0, 20);

  if (allRelevantMatches.length === 0) {
    return (
      <div className="bg-zinc-900/20 backdrop-blur-md rounded-[2.5rem] p-16 border border-zinc-800/50 text-center">
        <Trophy className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
        <p className="text-zinc-500 font-serif font-black uppercase tracking-widest text-xs">No Matches Scheduled Today</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl rounded-[2.5rem] border border-zinc-800/50 overflow-hidden shadow-2xl">
      <div className="p-8 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Radio className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-black text-white tracking-tight">Match <span className="text-primary">Center</span></h2>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">All Global Competitions</p>
          </div>
        </div>
        <Badge variant="outline" className="border-rose-500/30 text-primary text-[10px] font-black uppercase tracking-widest px-4 py-1">
          {liveMatches.length} Live Now
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-zinc-950/20">
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-32 text-[10px] font-black uppercase tracking-widest text-zinc-500 pl-8">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Matchup</TableHead>
              <TableHead className="text-center w-32 text-[10px] font-black uppercase tracking-widest text-zinc-500">Score</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-zinc-500">League</TableHead>
              <TableHead className="w-12 pr-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allRelevantMatches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </TableBody>
        </Table>
      </div>
      
      <div className="p-6 bg-zinc-950/30 text-center">
        <button className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-white transition-colors flex items-center gap-2 mx-auto translate-y-1">
          View Full Fixture List <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const { label, color } = getMatchStatus(match.status);
  const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED';

  return (
    <TableRow className={cn(
      "border-zinc-800/50 transition-colors group",
      isLive ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-zinc-800/30"
    )}>
      <TableCell className="pl-8">
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-[9px] font-black px-2 py-1 rounded-md uppercase tracking-tighter shadow-sm",
            isLive ? "bg-primary text-white" : "bg-zinc-800 text-zinc-400"
          )}>
            {label}
          </span>
          {isLive && (
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
        </div>
      </TableCell>
      
      <TableCell>
        <div className="flex flex-col gap-2 py-2">
          <div className="flex items-center gap-3">
            {match.homeTeam.crest && (
              <img src={match.homeTeam.crest} alt={`${match.homeTeam.name} crest`} className="w-4 h-4 object-contain" />
            )}
            <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">
              {match.homeTeam.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {match.awayTeam.crest && (
              <img src={match.awayTeam.crest} alt={`${match.awayTeam.name} crest`} className="w-4 h-4 object-contain" />
            )}
            <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">
              {match.awayTeam.name}
            </span>
          </div>
        </div>
      </TableCell>

      <TableCell className="text-center">
        <div className="inline-flex flex-col gap-1 bg-zinc-950/50 rounded-xl px-4 py-2 border border-zinc-800/50 min-w-[60px]">
          <span className={cn(
            "text-lg font-black tracking-tighter",
            isLive ? "text-primary" : "text-zinc-400"
          )}>
            {match.score.fullTime?.home ?? '-'}
          </span>
          <div className="h-px bg-zinc-800 w-full" />
          <span className={cn(
            "text-lg font-black tracking-tighter",
            isLive ? "text-primary" : "text-zinc-400"
          )}>
            {match.score.fullTime?.away ?? '-'}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-zinc-800 text-[8px] font-black text-zinc-500 uppercase tracking-widest bg-zinc-900/50">
            {match.competition.code}
          </Badge>
          <span className="text-[10px] text-zinc-600 font-medium truncate max-w-[100px] hidden sm:inline">
            {match.competition.name}
          </span>
        </div>
      </TableCell>

      <TableCell className="pr-8 text-right">
        <button className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-primary hover:border-rose-500">
          <Activity className="w-3 h-3 text-white" />
        </button>
      </TableCell>
    </TableRow>
  );
}
