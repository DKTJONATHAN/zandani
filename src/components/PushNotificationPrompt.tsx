import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, X, Smartphone, Monitor, ShieldCheck, AlertCircle } from "lucide-react";

const DEFAULT_VAPID_PUBLIC =
  "BBnR6tuQ90TWFE4vz3Mwm2R3-gox9VEMVdZCC3U6u5_zpoeeEjjkAKSbc-UcTBGrDpC8XbxJus_0CP9PdNn8Jyc";

const VAPID_PUBLIC_KEY =
  (import.meta as { env?: { VITE_VAPID_PUBLIC_KEY?: string } }).env?.VITE_VAPID_PUBLIC_KEY ||
  DEFAULT_VAPID_PUBLIC;

const TIMEOUT_MS = 12000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function withTimeout<T>(promise: Promise<T>, label: string, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} timed out. Please try again.`)),
      ms,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported.");
  const registration = await withTimeout(
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }),
    "Service worker setup",
  );
  await withTimeout(navigator.serviceWorker.ready, "Service worker activation");
  return registration;
}

async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("The browser returned an incomplete push subscription.");
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: controller.signal,
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `Server returned ${res.status}.`);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The push server took too long to respond.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function PushNotificationPrompt() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const supported =
      window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    void (async () => {
      try {
        const reg = await ensureServiceWorker();
        const existing = await withTimeout(
          reg.pushManager.getSubscription(),
          "Checking notification status",
        );

        if (!mounted.current) return;

        if (existing && Notification.permission === "granted") {
          setIsSubscribed(true);
          localStorage.setItem("push_subscribed", "true");
          void saveSubscription(existing).catch((e) =>
            console.warn("[push] background subscription refresh failed", e),
          );
        }
      } catch (e) {
        console.warn("[push] initialization failed", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isSupported || isSubscribed || permission === "denied") return;

    const dismissedAt = Number(localStorage.getItem("push_prompt_dismissed_at") || "0");
    const dismissedRecently = dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    const alreadySubscribed = localStorage.getItem("push_subscribed") === "true";
    if (alreadySubscribed || dismissedRecently) return;

    const timer = window.setTimeout(() => setShowPrompt(true), 3500);
    return () => window.clearTimeout(timer);
  }, [isSupported, isSubscribed, permission]);

  const subscribe = async () => {
    if (!isSupported || loading) return;
    setLoading(true);
    setError("");

    try {
      // Permission and subscribe are intentionally triggered by the user's click.
      const result = await withTimeout(Notification.requestPermission(), "Notification permission");
      setPermission(result);

      if (result !== "granted") {
        throw new Error(
          result === "denied"
            ? "Notifications are blocked for this site. Allow them in your browser/site settings, then try again."
            : "Notification permission was not granted.",
        );
      }

      const reg = await ensureServiceWorker();

      let sub = await withTimeout(reg.pushManager.getSubscription(), "Reading notification status");
      if (!sub) {
        sub = await withTimeout(
          reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
          }),
          "Creating push subscription",
        );
      }

      await saveSubscription(sub);

      if (!mounted.current) return;
      setIsSubscribed(true);
      localStorage.setItem("push_subscribed", "true");
      localStorage.removeItem("push_prompt_dismissed_at");
      setShowPrompt(false);
    } catch (e) {
      console.error("[push] subscribe failed", e);
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Could not enable notifications. Please try again.");
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("push_prompt_dismissed_at", String(Date.now()));
    setError("");
  };

  if (!isSupported || isSubscribed || !showPrompt) return null;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:p-5 md:items-end md:justify-end md:p-6 pointer-events-none">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px] pointer-events-auto md:hidden"
        onClick={handleDismiss}
        aria-hidden="true"
      />

      <div className="relative pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl md:max-w-[390px]">
        <div className="h-1 bg-primary" />

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : (
                <BellRing className="h-6 w-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Za Ndani Alerts</p>
                  <h3 className="mt-1 text-lg font-bold text-foreground">Never miss a new story</h3>
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Close notification prompt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Get breaking stories and fresh Za Ndani posts on this device, even when the site is closed.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                  {isMobile ? <Smartphone className="h-4 w-4 text-primary" /> : <Monitor className="h-4 w-4 text-primary" />}
                  <span>{isMobile ? "Mobile alerts" : "Desktop alerts"}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>No email needed</span>
                </div>
              </div>

              {error ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleDismiss}
                  disabled={loading}
                  className="rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={subscribe}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? "Enabling notifications…" : (
                    <>
                      <Bell className="h-4 w-4" />
                      Enable notifications
                    </>
                  )}
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
                {permission === "denied"
                  ? "Notifications are blocked in your browser."
                  : "You can turn alerts off anytime in your browser settings."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
