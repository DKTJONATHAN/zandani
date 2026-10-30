import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  action: "newsletter_subscribe" | "admin_login" | "contact_submit";
  onToken: (token: string) => void;
  resetKey?: number;
}

const SITE_KEY = "0x4AAAAAAFtIBQZiyrjMlnId";
const SCRIPT_ID = "cloudflare-turnstile-api";

export function TurnstileWidget({ action, onToken, resetKey = 0 }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);
  callbackRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        action,
        callback: (token: string) => callbackRef.current(token),
        "expired-callback": () => callbackRef.current(""),
        "error-callback": () => callbackRef.current(""),
        theme: "auto",
      });
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) {
      renderWidget();
    } else if (existing) {
      const timer = window.setInterval(() => {
        attempts += 1;
        if (window.turnstile) {
          window.clearInterval(timer);
          renderWidget();
        } else if (attempts > 100) {
          window.clearInterval(timer);
        }
      }, 100);
      return () => { cancelled = true; window.clearInterval(timer); };
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [action, resetKey]);

  return <div ref={containerRef} className="min-h-[65px]" aria-label="Security verification" />;
}
