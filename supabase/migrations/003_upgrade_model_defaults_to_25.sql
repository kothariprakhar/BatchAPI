-- Upgrade model defaults from Gemini 1.5 to 2.5 and normalize existing rows.

ALTER TABLE prompt_templates
ALTER COLUMN model SET DEFAULT 'gemini-2.5-flash';

ALTER TABLE batch_jobs
ALTER COLUMN model SET DEFAULT 'gemini-2.5-flash';

UPDATE prompt_templates
SET model = 'gemini-2.5-flash'
WHERE model = 'gemini-1.5-flash';

UPDATE prompt_templates
SET model = 'gemini-2.5-pro'
WHERE model = 'gemini-1.5-pro';

UPDATE batch_jobs
SET model = 'gemini-2.5-flash'
WHERE model = 'gemini-1.5-flash';

UPDATE batch_jobs
SET model = 'gemini-2.5-pro'
WHERE model = 'gemini-1.5-pro';
