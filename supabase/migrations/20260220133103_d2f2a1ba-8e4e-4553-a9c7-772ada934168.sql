CREATE POLICY "Users can update data sources of their projects" 
ON public.data_sources FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.projects 
  WHERE projects.id = data_sources.project_id 
    AND projects.user_id = auth.uid()
));