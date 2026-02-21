-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create data_sources table
CREATE TABLE public.data_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('document', 'gmail', 'slack', 'transcript')),
  name TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  file_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create extracted_requirements table for AI-processed data
CREATE TABLE public.extracted_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.data_sources(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('functional', 'non_functional', 'stakeholder', 'assumption', 'constraint', 'timeline', 'metric', 'decision')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_score NUMERIC(3,2) DEFAULT 0.80,
  source_excerpt TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_brds table
CREATE TABLE public.generated_brds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_brds ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = user_id);

-- RLS Policies for data_sources (via project ownership)
CREATE POLICY "Users can view data sources of their projects" 
ON public.data_sources FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = data_sources.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create data sources for their projects" 
ON public.data_sources FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = data_sources.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete data sources from their projects" 
ON public.data_sources FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = data_sources.project_id AND projects.user_id = auth.uid()));

-- RLS Policies for extracted_requirements
CREATE POLICY "Users can view requirements of their projects" 
ON public.extracted_requirements FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_requirements.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create requirements for their projects" 
ON public.extracted_requirements FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_requirements.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update requirements of their projects" 
ON public.extracted_requirements FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_requirements.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can delete requirements from their projects" 
ON public.extracted_requirements FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = extracted_requirements.project_id AND projects.user_id = auth.uid()));

-- RLS Policies for generated_brds
CREATE POLICY "Users can view BRDs of their projects" 
ON public.generated_brds FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generated_brds.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can create BRDs for their projects" 
ON public.generated_brds FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generated_brds.project_id AND projects.user_id = auth.uid()));

CREATE POLICY "Users can update BRDs of their projects" 
ON public.generated_brds FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.projects WHERE projects.id = generated_brds.project_id AND projects.user_id = auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_generated_brds_updated_at
BEFORE UPDATE ON public.generated_brds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);