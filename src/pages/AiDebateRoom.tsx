import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, CircleDot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Speaker = "user" | "gemini" | "chatgpt" | "system";
type Status = "awaiting_gemini" | "awaiting_chatgpt" | "awaiting_gemini_counter" | "final" | "error";

type Message = {
  id: string;
  speaker: Speaker;
  text: string;
  created_at: string;
  round?: number;
};

type Chat = {
  id: string;
  status: Status;
  round: number;
  created_at: string;
  updated_at: string;
  messages: Message[];
  final_output?: string;
  error?: string;
};

const API = "/api/ai-room";

const speakerMeta: Record<Exclude<Speaker, "system" | "user">, { label: string; icon: string }> = {
  gemini: { label: "Gemini", icon: "G" },
  chatgpt: { label: "ChatGPT", icon: "C" },
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function AiDebateRoom() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [thought, setThought] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const response = await fetch(`${API}/latest`, { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load the AI room.");
      const data = await response.json();
      setChat(data.chat ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the AI room.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const active = useMemo(() => chat && chat.status !== "final" && chat.status !== "error", [chat]);
  const canSend = !active && !sending && thought.trim().length >= 2;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${API}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought: thought.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not start the debate.");
      setThought("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the debate.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="brand-bar" />
      <header className="border-b border-divider bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Za Ndani
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-4 w-4" /> AI Debate Room
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 max-w-3xl">
          <p className="section-kicker">Two AIs. One question. One considered answer.</p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">Let Gemini and ChatGPT debate your thought.</h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            You submit once. Gemini opens the discussion, ChatGPT challenges or improves it, and Gemini counters. They continue until they reach a defensible shared conclusion.
          </p>
        </div>

        {error && <div className="mb-6 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <section className="rounded-xl border border-divider bg-surface shadow-prominent">
            <div className="flex items-center justify-between border-b border-divider px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Live conversation</p>
                <p className="text-sm text-muted-foreground">Round {chat?.round ?? 0}</p>
              </div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                {active ? <><CircleDot className="h-4 w-4 text-primary" /> AI discussion in progress</> : <><CheckCircle2 className="h-4 w-4 text-primary" /> Ready</>}
              </div>
            </div>

            <div className="max-h-[62vh] min-h-[360px] space-y-4 overflow-y-auto p-4 sm:p-6">
              {loading && !chat ? (
                <div className="flex min-h-[300px] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading conversation…</div>
              ) : !chat ? (
                <div className="flex min-h-[300px] flex-col items-center justify-center text-center text-muted-foreground">
                  <Bot className="mb-4 h-10 w-10 text-primary" />
                  <p className="font-semibold text-foreground">No debate yet.</p>
                  <p className="mt-1 max-w-sm text-sm">Put your thought, question, dilemma, idea, or argument in the box below.</p>
                </div>
              ) : (
                chat.messages.map((message) => {
                  const ai = message.speaker === "gemini" || message.speaker === "chatgpt";
                  return (
                    <article key={message.id} className={`rounded-lg border p-4 ${message.speaker === "user" ? "ml-4 border-primary/30 bg-primary/5" : "border-divider bg-background"}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
                          {ai ? <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">{speakerMeta[message.speaker].icon}</span> : <span className="grid h-6 w-6 place-items-center rounded-full border border-divider">You</span>}
                          <span>{ai ? speakerMeta[message.speaker].label : "Your thought"}</span>
                          {message.round ? <span className="text-muted-foreground">· R{message.round}</span> : null}
                        </div>
                        <time className="text-[11px] text-muted-foreground">{formatTime(message.created_at)}</time>
                      </div>
                      <p className="whitespace-pre-wrap leading-7 text-foreground">{message.text}</p>
                    </article>
                  );
                })
              )}
              {chat?.status === "final" && chat.final_output && (
                <article className="rounded-xl border-2 border-primary/40 bg-primary/5 p-5 shadow-glow">
                  <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary"><CheckCircle2 className="h-4 w-4" /> Agreed final output</div>
                  <p className="whitespace-pre-wrap leading-7">{chat.final_output}</p>
                </article>
              )}
            </div>

            <form onSubmit={submit} className="border-t border-divider p-4 sm:p-5">
              <Textarea
                value={thought}
                onChange={(event) => setThought(event.target.value)}
                disabled={Boolean(active) || sending}
                placeholder={active ? "The AIs are discussing this. You can send another thought after the final output." : "Type a thought, question, dilemma, idea, or anything you want them to discuss…"}
                className="min-h-28 resize-y bg-background"
                maxLength={12000}
              />
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">{thought.length.toLocaleString()}/12,000 · You can only submit when the previous debate is finished.</p>
                <Button type="submit" disabled={!canSend} className="gradient-primary text-primary-foreground">
                  {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Start debate
                </Button>
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-divider bg-surface p-5">
              <p className="section-kicker">How it works</p>
              <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
                <li><strong className="text-foreground">01 · You ask.</strong><br />Your thought becomes a new JSON conversation in the repository.</li>
                <li><strong className="text-foreground">02 · Gemini opens.</strong><br />The first AI analyses the issue and states its position.</li>
                <li><strong className="text-foreground">03 · ChatGPT challenges.</strong><br />It reads Gemini's latest position and improves, disputes, or qualifies it.</li>
                <li><strong className="text-foreground">04 · Gemini counters.</strong><br />The cycle continues with the complete history in context.</li>
                <li><strong className="text-foreground">05 · Agreement.</strong><br />When both sides can stand behind the conclusion, the room publishes the final answer.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">No AI keys in the browser.</p>
              <p className="mt-2">The Gemini and ChatGPT credentials are used only by GitHub Actions. The Cloudflare bridge writes the user's message to GitHub without exposing either AI key.</p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
