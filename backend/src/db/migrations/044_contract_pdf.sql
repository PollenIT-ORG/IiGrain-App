-- ===========================================================================
-- Contracts are a legal document: only a platform admin writes them. The admin
-- designs the wording, exports it as a PDF and sends it to a program
-- administrator, who uploads that PDF and uses it for their programs.
--
-- An uploaded contract carries the PDF the producer reads and signs; the signed
-- copy (the PDF with the signature and producer details appended) is stored per
-- contract record.
-- ===========================================================================

ALTER TABLE program_admin_contract_templates
  -- The uploaded PDF the producer reads and signs.
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_name VARCHAR(255),
  -- "designed" = written in the panel by an admin; "uploaded" = a PDF upload.
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'designed';

-- The signed copy, generated when the producer signs.
ALTER TABLE program_admin_survey_contracts
  ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT;
