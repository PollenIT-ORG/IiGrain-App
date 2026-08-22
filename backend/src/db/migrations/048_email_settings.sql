-- Where email goes out from, set by the platform team in the admin panel
-- rather than by editing a file on the server and restarting it.
--
-- One row: there is one platform, and one place mail comes from. The secrets
-- (the SMTP password, the API key) are stored encrypted, never in the clear,
-- and are never sent back to the browser.

CREATE TABLE IF NOT EXISTS email_settings (
  id                SMALLINT     PRIMARY KEY DEFAULT 1,

  -- Which one is tried first, and whether the other one covers for it.
  primary_provider  VARCHAR(10)  NOT NULL DEFAULT 'smtp',
  fallback_enabled  BOOLEAN      NOT NULL DEFAULT true,

  -- What every message is sent as.
  from_name         VARCHAR(120) NOT NULL DEFAULT 'iiGrain',
  from_email        VARCHAR(200) NOT NULL DEFAULT '',

  smtp_enabled      BOOLEAN      NOT NULL DEFAULT false,
  smtp_host         VARCHAR(200) NOT NULL DEFAULT '',
  smtp_port         INTEGER      NOT NULL DEFAULT 587,
  smtp_secure       BOOLEAN      NOT NULL DEFAULT false,
  smtp_user         VARCHAR(200) NOT NULL DEFAULT '',
  smtp_pass_enc     TEXT,

  resend_enabled    BOOLEAN      NOT NULL DEFAULT false,
  resend_key_enc    TEXT,

  updated_by        UUID         REFERENCES users(id) ON UPDATE NO ACTION,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT email_settings_single_row CHECK (id = 1),
  CONSTRAINT email_settings_provider CHECK (primary_provider IN ('smtp', 'resend'))
);

INSERT INTO email_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
