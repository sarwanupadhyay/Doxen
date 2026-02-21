
-- Create table for Gmail OAuth connections
CREATE TABLE public.user_gmail_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, email)
);

-- Enable RLS
ALTER TABLE public.user_gmail_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own Gmail connections"
  ON public.user_gmail_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Gmail connections"
  ON public.user_gmail_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Gmail connections"
  ON public.user_gmail_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Gmail connections"
  ON public.user_gmail_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_gmail_connections_updated_at
  BEFORE UPDATE ON public.user_gmail_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
