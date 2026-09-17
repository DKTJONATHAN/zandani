export type DeskStatus = {
  id: string;
  label: string;
  workflow: string;
  cron: string;
  cadence: string;
  lastTriggeredAt: string | null;
  lastStatus: "ok" | "failed" | "never" | "running";
  lastError?: string | null;
  nextRunAt: string | null;
};

export type SchedulerStatus = {
  nowNairobi: string;
  timezone: string;
  useAdminScheduler: boolean;
  desks: DeskStatus[];
};

export type SchedulerLogEntry = {
  id: string;
  desk: string;
  scheduledFor: string;
  dispatchedAt: string;
  status: number | null;
  ok: boolean;
  error?: string | null;
  source: "cron" | "manual";
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

export function fetchSchedulerStatus() {
  return api<SchedulerStatus>("/api/scheduler/status");
}

export function fetchSchedulerLogs(limit = 50) {
  return api<{ logs: SchedulerLogEntry[] }>(`/api/scheduler/logs?limit=${limit}`);
}

export function triggerDesk(desk: string) {
  return api<{ ok: boolean; desk: string; status: number }>(`/api/scheduler/trigger/${desk}`, {
    method: "POST",
    body: JSON.stringify({ source: "admin-ui" }),
  });
}

export function tickScheduler() {
  return api<{ ok: boolean; triggered: string[] }>("/api/scheduler/tick", { method: "POST" });
}
