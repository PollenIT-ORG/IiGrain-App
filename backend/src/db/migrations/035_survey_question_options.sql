-- Per-question answer labels for the 0-3 scale. When a label is null the survey
-- falls back to the shared default ("Not at all", "To a small extent", ...).
ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS option_0 TEXT,
  ADD COLUMN IF NOT EXISTS option_1 TEXT,
  ADD COLUMN IF NOT EXISTS option_2 TEXT,
  ADD COLUMN IF NOT EXISTS option_3 TEXT;
