import { useTodayMatches, getMatchStatus } from "@/hooks/useSportsData";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function LiveScoresWidget() {
  const { data: matches, isLoading, error } = useTodayMatches();

  const liveMatches = matches?.filter(m => 
    m.status === 'IN_PLAY' || m.status === 'LIVE' || m.status === 'PAUSED'
  ) || [];

  const recentMatches = matches?.filter(m => m.status === 'FINISHED').slice(0, 5) || [];
  
  const upcomingMatches = matches?.filter(m => 
    m.status === 'SCHEDULED' || m.status === 'TIMED'
  ).slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
        <Skeleton className="h-6 w-32 bg-zinc-800 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-12 w-full bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/50 rounded-2xl p-8 border border-zinc-800 text-center">
        <p className="text-zinc-500 text-sm italic">Unable to synchronize live data</p>
      </div>
    );
  }

  return (
    <div className="bg-transparent overflow-hidden">
      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <div className="p-4 bg-rose-950/20 rounded-2xl border border-rose-900/30 mb-6">
          <h3 className="text-[10px] font-black text-primary mb-4 flex items-center gap-2 uppercase tracking-[0.2em]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            Live Updates
          </h3>
          <div className="space-y-3">
            {liveMatches.map(match => (
              <LiveMatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {recentMatches.length > 0 && (
        <div className="p-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 mb-6">
          <h3 className="text-[10px] font-black text-zinc-500 mb-4 uppercase tracking-[0.2em]">
            Recent Results
          </h3>
          <div className="space-y-3">
            {recentMatches.map(match => (
              <LiveMatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Matches */}
      {liveMatches.length === 0 && recentMatches.length === 0 && upcomingMatches.length > 0 && (
        <div className="p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            Upcoming Today
          </h3>
          <div className="space-y-2">
            {upcomingMatches.map(match => (
              <LiveMatchRow key={match.id} match={match} />
            ))}
          </div>
        </div>
      )}

      {liveMatches.length === 0 && recentMatches.length === 0 && upcomingMatches.length === 0 && (
        <div className="p-6 text-center">
          <p className="text-muted-foreground text-sm">No matches today</p>
          <p className="text-xs text-muted-foreground mt-1">Check fixtures for upcoming games</p>
        </div>
      )}
    </div>
  );
}

interface LiveMatchRowProps {
  match: {
    id: number;
    homeTeam: { name: string; shortName?: string; crest?: string };
    awayTeam: { name: string; shortName?: string; crest?: string };
    score: { fullTime?: { home: number | null; away: number | null } };
    status: string;
    competition: { name: string; code: string };
    utcDate: string;
  };
}

function LiveMatchRow({ match }: LiveMatchRowProps) {
  const { label, color } = getMatchStatus(match.status);
  const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED';

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl transition-all border border-transparent",
      isLive ? "bg-primary/10 border-rose-500/20" : "bg-zinc-800/30 hover:border-zinc-700"
    )}>
      {/* Home Team */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {match.homeTeam.crest && (
          <img src={match.homeTeam.crest} alt={`${match.homeTeam.name} crest`} className="w-5 h-5 object-contain" />
        )}
        <span className="text-xs font-bold text-zinc-200 truncate">
          {match.homeTeam.shortName || match.homeTeam.name.slice(0, 15)}
        </span>
      </div>

      {/* Score */}
      <div className={cn(
        "flex items-center gap-2 font-black text-sm px-3 py-1 rounded-lg bg-zinc-950/50 border border-zinc-800/50 min-w-[70px] justify-center",
        isLive ? "text-primary" : "text-zinc-400"
      )}>
        <span>{match.score.fullTime?.home ?? '-'}</span>
        <span className="text-zinc-700">:</span>
        <span>{match.score.fullTime?.away ?? '-'}</span>
      </div>

      {/* Away Team */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className="text-xs font-bold text-zinc-200 truncate text-right">
          {match.awayTeam.shortName || match.awayTeam.name.slice(0, 15)}
        </span>
        {match.awayTeam.crest && (
          <img src={match.awayTeam.crest} alt={`${match.awayTeam.name} crest`} className="w-5 h-5 object-contain" />
        )}
      </div>

      {/* Status Badge */}
      <span className={cn(
        "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full text-white ml-2 shrink-0 shadow-sm",
        color === 'bg-primary' ? 'bg-primary' : 'bg-zinc-700'
      )}>
        {label}
      </span>
    </div>
  );
}
