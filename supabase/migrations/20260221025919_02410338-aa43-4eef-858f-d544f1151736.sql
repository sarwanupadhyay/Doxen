
-- Store per-user Slack OAuth connections
CREATE TABLE public.user_slack_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  access_token TEXT NOT NULL,
  scope TEXT,
  bot_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, team_id)
);

-- Enable RLS
ALTER TABLE public.user_slack_connections ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own connections
CREATE POLICY "Users can view their own Slack connections"
  ON public.user_slack_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Slack connections"
  ON public.user_slack_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Slack connections"
  ON public.user_slack_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Slack connections"
  ON public.user_slack_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_user_slack_connections_updated_at
  BEFORE UPDATE ON public.user_slack_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
