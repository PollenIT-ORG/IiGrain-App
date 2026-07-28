-- 031_seed_survey_questions.sql
-- A starter set of eligibility questions so the survey works as soon as the
-- feature is deployed. The program team replaces these from the admin panel
-- once the client supplies the real wording and scores.
--
-- Only runs when the table is empty, so it never overwrites edited questions.

INSERT INTO survey_questions (question_text, help_text, score_yes, score_no, sort_order)
SELECT * FROM (VALUES
  ('Do you own or lease the land you farm?',
   'Either owning or holding a registered lease counts as yes.', 15, 0, 0),
  ('Have you grown a commercial grain crop in the last two seasons?',
   NULL, 15, 0, 2),
  ('Do you keep written records of your inputs and yields?',
   'Notebooks, spreadsheets or an app all count.', 15, 0, 3),
  ('Are you willing to follow regenerative practices such as cover cropping?',
   NULL, 20, 0, 4),
  ('Do you have access to a smartphone with an internet connection?',
   NULL, 10, 0, 5),
  ('Is your land free of any ongoing ownership or boundary dispute?',
   NULL, 10, 0, 6),
  ('Are you able to attend a yearly on-farm assessment visit?',
   NULL, 10, 0, 7)
) AS v(question_text, help_text, score_yes, score_no, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM survey_questions WHERE deleted_at IS NULL);

-- One follow-up, shown only when the first question was answered Yes. Inserted
-- separately because it needs the parent's generated id.
INSERT INTO survey_questions
  (question_text, score_yes, score_no, parent_question_id, show_when_parent_answer, sort_order)
SELECT
  'Is the lease valid for at least three more years?',
  5, 0, p.id, 'yes', 1
FROM survey_questions p
WHERE p.question_text = 'Do you own or lease the land you farm?'
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM survey_questions f
    WHERE f.parent_question_id = p.id AND f.deleted_at IS NULL
  );
