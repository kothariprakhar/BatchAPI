-- Step 5/6/9/11: resilience, pause, and observability fields.

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS error_code INT;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS error_type TEXT;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
