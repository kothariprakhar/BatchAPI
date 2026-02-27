-- Compare Mode schema

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

CREATE TABLE IF NOT EXISTS compare_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compare_session_id UUID REFERENCES compare_sessions(id) ON DELETE CASCADE,
  row_index INT NOT NULL,
  input_variables JSONB NOT NULL,
  compiled_left_prompt TEXT NOT NULL,
  compiled_right_prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_compare_sessions_project ON compare_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_compare_cases_session ON compare_cases(compare_session_id);
CREATE INDEX IF NOT EXISTS idx_compare_results_case ON compare_results(compare_case_id);

ALTER TABLE compare_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE compare_results ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Allow all on compare_sessions'
      AND tablename = 'compare_sessions'
  ) THEN
    CREATE POLICY "Allow all on compare_sessions" ON compare_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Allow all on compare_cases'
      AND tablename = 'compare_cases'
  ) THEN
    CREATE POLICY "Allow all on compare_cases" ON compare_cases FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Allow all on compare_results'
      AND tablename = 'compare_results'
  ) THEN
    CREATE POLICY "Allow all on compare_results" ON compare_results FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
