-- Step 2: queue state machine columns for batch_jobs.
-- Safe for existing deployments via IF NOT EXISTS guards.

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS queue_status TEXT DEFAULT 'queued';

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS paused_until TIMESTAMPTZ;

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

ALTER TABLE batch_jobs
ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'batch_jobs_queue_status_check'
  ) THEN
    ALTER TABLE batch_jobs
      ADD CONSTRAINT batch_jobs_queue_status_check
      CHECK (queue_status IN ('queued','running','paused','retry_wait','completed','failed','cancelled'));
  END IF;
END $$;
