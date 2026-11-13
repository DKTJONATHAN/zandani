import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export interface Competition {
  code: string;
  name: string;
  isEditorial?: boolean;
}

interface Team {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface Score {
  winner?: string;
  duration?: string;
  fullTime?: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}

export interface Match {
  id: number;
  utcDate: string;
  status: string;
  matchday?: number;
  stage?: string;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  competition: {
    id: number;
    name: string;
    code: string;
    emblem?: string;
  };
}

interface Standing {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface StandingsTable {
  type: string;
  stage?: string;
  group?: string;
  table: Standing[];
}

async function fetchFootballData(endpoint: string, params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams({ endpoint, ...params });
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/football-data?${searchParams}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch football data');
  }

  return response.json();
}

async function fetchAIContent(type: string, data: Record<string, unknown>) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/sports-ai-headlines`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, ...data }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate AI content');
  }

  return response.json();
}

// Preload data for top leagues to reduce API calls
export function usePreloadSportsData() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Preload standings for top 3 leagues
    const topLeagues = ["PL", "PD", "SA"];
    topLeagues.forEach((code) => {
      queryClient.prefetchQuery({
        queryKey: ["standings", code],
        queryFn: () => fetchFootballData("standings", { competition: code }),
        staleTime: 10 * 60 * 1000, // 10 minutes
      });
    });

    // Preload today's matches
    queryClient.prefetchQuery({
      queryKey: ["todayMatches"],
      queryFn: async () => {
        const today = new Date().toISOString().split('T')[0];
        const result = await fetchFootballData('matches', { 
          competition: 'ALL',
          dateFrom: today,
          dateTo: today,
        });
        return result.data?.matches as Match[] || [];
      },
      staleTime: 60 * 1000,
    });
  }, [queryClient]);
}

export function useMatches(competition: string = 'PL') {
  return useQuery({
    queryKey: ['matches', competition],
    queryFn: async () => {
      const today = new Date();
      const dateFrom = new Date(today);
      dateFrom.setDate(dateFrom.getDate() - 3); // 3 days ago
      const dateTo = new Date(today);
      dateTo.setDate(dateTo.getDate() + 3); // 3 days ahead
      
      const result = await fetchFootballData('matches', { 
        competition,
        dateFrom: dateFrom.toISOString().split('T')[0],
        dateTo: dateTo.toISOString().split('T')[0],
      });
      return result.data?.matches as Match[] || [];
    },
    staleTime: 60 * 1000, 
    refetchInterval: 60 * 1000, 
    enabled: competition !== 'KPL',
  });
}

export function useTodayMatches() {
  return useQuery({
    queryKey: ['todayMatches'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const result = await fetchFootballData('matches', { 
        competition: 'ALL',
        dateFrom: today,
        dateTo: today,
      });
      return result.data?.matches as Match[] || [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useStandings(competition: string = 'PL') {
  return useQuery({
    queryKey: ['standings', competition],
    queryFn: async () => {
      const result = await fetchFootballData('standings', { competition });
      return result.data?.standings as StandingsTable[] || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for standings
  });
}

export function useTopScorers(competition: string = 'PL') {
  return useQuery({
    queryKey: ['scorers', competition],
    queryFn: async () => {
      const result = await fetchFootballData('scorers', { competition });
      return result.data?.scorers || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for scorers
  });
}

export function useMatchReview() {
  return useMutation({
    mutationFn: (match: Match) => fetchAIContent('review', { match }),
  });
}

export function useMatchPreview() {
  return useMutation({
    mutationFn: (match: Match) => fetchAIContent('preview', { match }),
  });
}

// Kenya first (editorial), then international leagues
export const COMPETITIONS: Competition[] = [
  { code: 'KPL', name: 'Kenya', isEditorial: true },
  { code: 'PL', name: 'Premier League' },
  { code: 'PD', name: 'La Liga' },
  { code: 'SA', name: 'Serie A' },
  { code: 'BL1', name: 'Bundesliga' },
  { code: 'FL1', name: 'Ligue 1' },
  { code: 'CL', name: 'Champions League' },
];

export function getMatchStatus(status: string): { label: string; color: string } {
  switch (status) {
    case 'IN_PLAY':
    case 'LIVE':
      return { label: 'LIVE', color: 'bg-red-500' };
    case 'PAUSED':
      return { label: 'HT', color: 'bg-yellow-500' };
    case 'FINISHED':
      return { label: 'FT', color: 'bg-muted' };
    case 'SCHEDULED':
    case 'TIMED':
      return { label: 'Upcoming', color: 'bg-primary' };
    case 'POSTPONED':
      return { label: 'Postponed', color: 'bg-orange-500' };
    case 'CANCELLED':
      return { label: 'Cancelled', color: 'bg-destructive' };
    default:
      return { label: status, color: 'bg-muted' };
  }
}
