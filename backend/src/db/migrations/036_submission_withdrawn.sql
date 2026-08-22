-- Allow a submission to be marked 'withdrawn' (producer voluntarily left).
ALTER TABLE eligibility_submissions DROP CONSTRAINT IF EXISTS chk_submission_status;
ALTER TABLE eligibility_submissions ADD CONSTRAINT chk_submission_status CHECK (status IN (
  'draft','submitted','not_qualified','qualified','contract_sent','contract_signed','enrolled','withdrawn'
));
