import { useCallback, useEffect, useState } from "react";
import {
  AlarmClock, Clock, Loader2, Play, RefreshCw, CheckCircle2,
  XCircle, CircleDashed, Zap,
} from "lucide-react";
import {
  fetchSchedulerStatus,
  fetchSchedulerLogs,
  triggerDesk,
  type DeskStatus,
  type SchedulerLogEntry,
  type SchedulerStatus,
} from "@/admin/utils/scheduler";
import { useToast } from "@/hooks/use-toast";

function StatusDot({ status }: { status: DeskStatus["lastStatus"] }) {
  if (status === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-400" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
  return <CircleDashed className="w-4 h-4 text-zinc-600" />;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-KE", {
      timeZone: "Africa/Nairobi",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " EAT";
  } catch {
    return iso;
  }
}

export function SchedulerPanel() {
  const { toast } = useToast();
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [logs, setLogs] = useState<SchedulerLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(0);
  const pageSize = 12;

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([fetchSchedulerStatus(), fetchSchedulerLogs(80)]);
      setStatus(s);
      setLogs(l.logs || []);
    } catch (e: any) {
      toast({ title: "Scheduler unavailable", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const onTrigger = async (deskId: string) => {
    setTriggering(deskId);
    try {
      await triggerDesk(deskId);
      toast({ title: "Dispatched", description: `${deskId} workflow triggered.` });
      await load();
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e.message, variant: "destructive" });
    } finally {
      setTriggering(null);
    }
  };

  if (loading && !status) {
    return (
      <div className="p-10 flex items-center justify-center text-zinc-500 gap-3">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading scheduler…
      </div>
    );
  }

  // Default PRIMARY when flag is missing/undefined (admin scheduler on by default)
  const isPrimary = status?.useAdminScheduler !== false;

  const pageLogs = logs.slice(logPage * pageSize, logPage * pageSize + pageSize);
  const pages = Math.max(1, Math.ceil(logs.length / pageSize));

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-[0.25em] mb-2">
              <AlarmClock className="w-3.5 h-3.5" /> Africa / Nairobi
            </div>
            <p className="text-4xl sm:text-5xl font-black text-white tabular-nums tracking-tight">
              {status?.nowNairobi || "—"}
            </p>
            <p className="text-zinc-500 text-sm mt-2">
              Autonomous desk dispatcher ·{" "}
              <span className={isPrimary ? "text-emerald-400" : "text-amber-400"}>
                {isPrimary ? "PRIMARY" : "STANDBY"}
              </span>
              {" "}(server scheduler)
            </p>
          </div>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-700 text-zinc-300 hover:border-primary hover:text-white text-xs font-black uppercase tracking-wider transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div>
        <h2 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Desks
        </h2>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {(status?.desks || []).map((d) => (
            <div
              key={d.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 transition-colors p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-white font-black leading-none">{d.label}</p>
                  <p className="text-zinc-500 text-[11px] mt-1 font-mono">{"server-managed automation"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={d.lastStatus} />
                  {d.workflowFound ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400" title={d.workflowState || "Server-managed automation"}>
                      Automation ready
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-400">Automation unavailable</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2.5 py-2">
                  <p className="text-zinc-600 uppercase tracking-wider font-bold mb-0.5">Schedule</p>
                  <p className="text-zinc-300 font-medium">{d.cadence}</p>
                </div>
                <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2.5 py-2">
                  <p className="text-zinc-600 uppercase tracking-wider font-bold mb-0.5">Next</p>
                  <p className="text-zinc-300 font-medium">{fmt(d.nextRunAt)}</p>
                </div>
                <div className="col-span-2 rounded-lg bg-zinc-950/80 border border-zinc-800 px-2.5 py-2">
                  <p className="text-zinc-600 uppercase tracking-wider font-bold mb-0.5">Last run</p>
                  <p className="text-zinc-300 font-medium">
                    {fmt(d.lastTriggeredAt)}
                    {d.lastError ? <span className="text-red-400 ml-2">· {d.lastError}</span> : null}
                    {d.workflowFound && d.lastError === "Workflow does not have 'workflow_dispatch' trigger" ? (
                      <span className="text-zinc-500 ml-2">· historical dispatch error cleared by current workflow configuration</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <button
                disabled={triggering === d.id}
                onClick={() => onTrigger(d.id)}
                className="mt-auto w-full flex items-center justify-center gap-2 py-2.5 bg-primary/90 hover:bg-primary text-white text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {triggering === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Trigger now
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-white font-black text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Dispatch log
        </h2>
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-500 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-bold">Desk</th>
                  <th className="px-4 py-3 font-bold">Scheduled</th>
                  <th className="px-4 py-3 font-bold">Dispatched</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                  <th className="px-4 py-3 font-bold">HTTP</th>
                  <th className="px-4 py-3 font-bold">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {pageLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-600">
                      No dispatches yet.
                    </td>
                  </tr>
                )}
                {pageLogs.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-white font-semibold capitalize">{row.desk}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{fmt(row.scheduledFor)}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{fmt(row.dispatchedAt)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {row.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{row.status ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.ok ? (
                        <span className="text-emerald-400 text-xs font-bold">OK</span>
                      ) : (
                        <span className="text-red-400 text-xs font-bold" title={row.error || ""}>
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 bg-zinc-900/50">
              <button
                disabled={logPage === 0}
                onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-zinc-600 text-xs">
                Page {logPage + 1} / {pages}
              </span>
              <button
                disabled={logPage >= pages - 1}
                onClick={() => setLogPage((p) => Math.min(pages - 1, p + 1))}
                className="text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
