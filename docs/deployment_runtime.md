# Batch Worker Deployment Notes

## Current Runtime Model

Gemini Bench currently executes the queue in-process in the Next.js server runtime. This is suitable for local demos and short-lived workloads.

## Production Constraints

1. Serverless instances can restart at any time.
2. In-process memory (`activeJobs`) is not shared across instances.
3. Long jobs may be interrupted by runtime limits.

## Recommended Production Topology

1. Keep `/api/batch` as an enqueue endpoint only.
2. Run a dedicated worker process that drains queued jobs from `batch_jobs`.
3. Keep job progress in Supabase only; do not rely on process memory for correctness.
4. Configure `GEMINI_API_KEY` on the worker runtime and disable client-key fallback.

## Operational Checks

1. Monitor stale `running` rows and ensure recovery logic re-queues them.
2. Track `retry_count`, `queue_status`, and `last_error` for incident triage.
3. Verify SSE endpoint delivery and dashboard polling fallback.
