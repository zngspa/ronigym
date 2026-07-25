
-- Per-coach Google account connection (OAuth tokens for Drive/Sheets export)
CREATE TABLE public.google_accounts (
  coach_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_accounts TO authenticated;
GRANT ALL ON public.google_accounts TO service_role;
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach google_accounts all" ON public.google_accounts FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
CREATE TRIGGER trg_google_accounts_updated BEFORE UPDATE ON public.google_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
