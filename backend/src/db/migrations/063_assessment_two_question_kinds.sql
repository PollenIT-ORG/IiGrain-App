-- ===========================================================================
-- A template now says which kind of questions it holds: multiple choice, which
-- score themselves, or input based, where a category is one form the farmer
-- fills in and an admin scores the answers during review.
--
-- Each question also says whether a photo and a description come with the
-- answer, which replaces the separate photo question type.
-- ===========================================================================

ALTER TABLE assessment_questions
  -- 'off', 'optional' or 'required' for the photo and the note that come with an answer.
  ADD COLUMN IF NOT EXISTS evidence_mode VARCHAR(10) NOT NULL DEFAULT 'optional',
  ADD COLUMN IF NOT EXISTS comment_mode  VARCHAR(10) NOT NULL DEFAULT 'optional';

ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS chk_assessment_questions_evidence_mode;
ALTER TABLE assessment_questions
  ADD CONSTRAINT chk_assessment_questions_evidence_mode
  CHECK (evidence_mode IN ('off', 'optional', 'required'));

ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS chk_assessment_questions_comment_mode;
ALTER TABLE assessment_questions
  ADD CONSTRAINT chk_assessment_questions_comment_mode
  CHECK (comment_mode IN ('off', 'optional', 'required'));

-- A question that used to be a photo is an input that must carry one.
UPDATE assessment_questions
   SET evidence_mode = 'required',
       question_type = 'text'
 WHERE question_type = 'photo';

ALTER TABLE assessment_questions DROP CONSTRAINT IF EXISTS chk_assessment_questions_type;
ALTER TABLE assessment_questions
  ADD CONSTRAINT chk_assessment_questions_type
  CHECK (question_type IN ('scored', 'mcq', 'text', 'long_text', 'number', 'date', 'boolean'));

-- What a template holds, chosen when it starts blank; null reads from its questions.
ALTER TABLE assessment_templates
  ADD COLUMN IF NOT EXISTS question_kind VARCHAR(10);

ALTER TABLE assessment_templates DROP CONSTRAINT IF EXISTS chk_assessment_templates_question_kind;
ALTER TABLE assessment_templates
  ADD CONSTRAINT chk_assessment_templates_question_kind
  CHECK (question_kind IS NULL OR question_kind IN ('mcq', 'input'));
