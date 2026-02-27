-- ============================================
-- Gemini Bench — Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Projects group related prompt tests
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt templates with versioning
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  system_prompt TEXT DEFAULT '',
  user_prompt_template TEXT NOT NULL,
  model TEXT DEFAULT 'gemini-2.5-flash',
  generation_config JSONB DEFAULT '{"temperature": 0.7, "maxOutputTokens": 1024}',
  version INT DEFAULT 1,
  parent_version_id UUID REFERENCES prompt_templates(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch jobs track execution state
CREATE TABLE IF NOT EXISTS batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  template_id UUID REFERENCES prompt_templates(id),
  name TEXT NOT NULL,
  queue_status TEXT DEFAULT 'queued'
    CHECK (queue_status IN ('queued','running','paused','retry_wait','completed','failed','cancelled')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  total_requests INT DEFAULT 0,
  completed_requests INT DEFAULT 0,
  failed_requests INT DEFAULT 0,
  model TEXT DEFAULT 'gemini-2.5-flash',
  generation_config JSONB DEFAULT '{}',
  safety_mode BOOLEAN DEFAULT false,
  estimated_savings_usd NUMERIC(10,6) DEFAULT 0,
  retry_count INT DEFAULT 0,
  last_error TEXT,
  paused_until TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  cancel_requested BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual results within a batch
CREATE TABLE IF NOT EXISTS batch_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  input_variables JSONB NOT NULL,
  compiled_prompt TEXT NOT NULL,
  output TEXT,
  token_usage JSONB DEFAULT '{}',
  latency_ms INT,
  retry_count INT DEFAULT 0,
  error_code INT,
  error_type TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  error TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compare sessions: left vs right job orchestration
CREATE TABLE IF NOT EXISTS compare_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compare_type TEXT NOT NULL
    CHECK (compare_type IN ('prompt_vs_prompt','model_vs_model')),
  status TEXT DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','partial_failed','failed','cancelled')),
  left_job_id UUID REFERENCES batch_jobs(id),
  right_job_id UUID REFERENCES batch_jobs(id),
  total_cases INT DEFAULT 0,
  completed_cases INT DEFAULT 0,
  failed_cases INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Canonical case mapping for left/right comparisons
CREATE TABLE IF NOT EXISTS compare_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_session_id UUID REFERENCES compare_sessions(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  input_variables JSONB NOT NULL,
  compiled_left_prompt TEXT NOT NULL,
  compiled_right_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materialized pair-level diff snapshot
CREATE TABLE IF NOT EXISTS compare_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_case_id UUID REFERENCES compare_cases(id) ON DELETE CASCADE,
  left_result_id UUID REFERENCES batch_results(id) ON DELETE CASCADE,
  right_result_id UUID REFERENCES batch_results(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed')),
  diff_summary JSONB DEFAULT '{}',
  flags_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (compare_case_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_results_job ON batch_results(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_project ON batch_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_project ON prompt_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_device ON projects(device_id);
CREATE INDEX IF NOT EXISTS idx_compare_sessions_project ON compare_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_compare_cases_session ON compare_cases(compare_session_id);
CREATE INDEX IF NOT EXISTS idx_compare_results_case ON compare_results(compare_case_id);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all operations for now (no auth)
-- In production, you'd scope these by auth.uid()
CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on prompt_templates" ON prompt_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on batch_jobs" ON batch_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on batch_results" ON batch_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on compare_sessions" ON compare_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on compare_cases" ON compare_cases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on compare_results" ON compare_results FOR ALL USING (true) WITH CHECK (true);
