-- Rule-based assertion fields for prompt regression checks.

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS assertion_rule JSONB;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS assertion_passed BOOLEAN;

ALTER TABLE batch_results
ADD COLUMN IF NOT EXISTS assertion_result JSONB DEFAULT '{}';
