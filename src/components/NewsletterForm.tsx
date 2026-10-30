import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Mail, ArrowRight } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";

interface NewsletterFormProps {
  className?: string;
  tone?: "default" | "onAccent";
  /** Compact layout for tight spaces */
  compact?: boolean;
}

export function NewsletterForm({
  className = "",
  tone = "default",
  compact = false,
}: NewsletterFormProps) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [widgetResetKey, setWidgetResetKey] = useState(0);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!turnstileToken) {
      toast({ title: "Complete the security check", description: "Please verify that you are human before subscribing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim(), turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to subscribe");
      }
      setIsSuccess(true);
      setEmail("");
      setTurnstileToken("");
      toast({
        title: data.already ? "You're already in" : "You're in",
        description:
          data.message ||
          "Stories from Za Ndani will land in your inbox. Welcome aboard.",
      });
    } catch (error) {
      console.error("Newsletter subscription error:", error);
      toast({
        title: "Could not subscribe",
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTurnstileToken("");
      setWidgetResetKey((value) => value + 1);
    }
  };

  if (isSuccess) {
    return (
      <div
        className={`flex items-center justify-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 ${className}`}
        role="status"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium leading-snug">
          You're on the list. Fresh stories are on the way.
        </span>
      </div>
    );
  }

  const isOnAccent = tone === "onAccent";

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full ${className}`}
      noValidate
    >
      <div
        className={
          compact
            ? "flex flex-col gap-2 sm:flex-row sm:items-stretch"
            : "flex flex-col gap-2.5 sm:flex-row sm:items-stretch"
        }
      >
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <div className="relative min-w-0 flex-1">
          <Mail
            className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
              isOnAccent ? "text-background/50" : "text-muted-foreground"
            }`}
            aria-hidden
          />
          <input
            id={inputId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            inputMode="email"
            required
            disabled={isLoading}
            className={
              isOnAccent
                ? "h-12 w-full rounded-xl border-0 bg-background/95 pl-10 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-background/80 disabled:opacity-60"
                : "h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
            }
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className={
            isOnAccent
              ? "h-12 shrink-0 rounded-xl bg-background px-6 text-sm font-semibold text-foreground shadow-sm hover:bg-background/90"
              : "h-12 shrink-0 rounded-xl px-6 text-sm font-semibold gradient-primary text-primary-foreground"
          }
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Joining…
            </>
          ) : (
            <>
              Join free
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 flex justify-center"><TurnstileWidget action="newsletter_subscribe" onToken={setTurnstileToken} resetKey={widgetResetKey} /></div>
      {!compact && (
        <p
          className={`mt-2.5 text-center text-[11px] leading-relaxed ${
            isOnAccent ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          Free · No spam · Unsubscribe anytime
        </p>
      )}
    </form>
  );
}
