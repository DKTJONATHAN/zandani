update public.automation_model_versions
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{gateway_model}',
  '"google/gemini-3-flash-preview"'::jsonb
)
where version_label = 'zandani-gemini-v1'
  and status = 'production';
