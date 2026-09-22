-- Newsletter subscribers (moved off public GitHub JSON for privacy & integrity)
-- Access: service role only (Cloudflare functions). No public read of emails.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT 'website',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT newsletter_subscribers_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscribers_email_format
    CHECK (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' AND char_length(email) <= 254)
);

-- Fast lookup for active list (sending brief)
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active
  ON public.newsletter_subscribers (active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at
  ON public.newsletter_subscribers (subscribed_at DESC);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_newsletter_subscribers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_newsletter_subscribers_updated_at ON public.newsletter_subscribers;
CREATE TRIGGER trg_newsletter_subscribers_updated_at
  BEFORE UPDATE ON public.newsletter_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_newsletter_subscribers_updated_at();

-- RLS: deny all to anon/authenticated. Only service_role bypasses RLS.
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers FORCE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → they cannot SELECT/INSERT/UPDATE/DELETE.
-- Service role key used by Cloudflare functions bypasses RLS.

COMMENT ON TABLE public.newsletter_subscribers IS
  'Za Ndani newsletter list. Private. Written only via Cloudflare /api/subscribe and /api/unsubscribe using service role.';
