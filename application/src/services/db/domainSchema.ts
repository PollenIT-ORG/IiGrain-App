import type { Transaction } from './types';

const SYNC_STATE_CHECK =
  "CHECK (sync_state IN ('local', 'pending', 'synced', 'conflict', 'failed'))";
const FLAG_CHECK = (column: string): string => `CHECK (${column} IN (0, 1))`;

const OWNED_COLUMNS = `
  local_id          TEXT PRIMARY KEY,
  server_id         TEXT,
  owner_user_id     TEXT NOT NULL,
  sync_state        TEXT NOT NULL DEFAULT 'local',
  deleted_local     INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  updated_at_local  TEXT NOT NULL,
  server_updated_at TEXT,
  last_pulled_at    TEXT`;

const ownerFk = 'FOREIGN KEY (owner_user_id) REFERENCES users (local_id) ON DELETE CASCADE';

export const createDomainSchema = async (tx: Transaction): Promise<void> => {
  await tx.execute(
    `CREATE TABLE IF NOT EXISTS farms (
       ${OWNED_COLUMNS},
       name             TEXT NOT NULL,
       business_entity  TEXT,
       owner_name       TEXT,
       owner_email      TEXT,
       location         TEXT,
       address_resolved INTEGER NOT NULL DEFAULT 1,
       area_acres       REAL,
       used_acres       REAL,
       available_acres  REAL,
       field_count      INTEGER NOT NULL DEFAULT 0,
       status           TEXT NOT NULL DEFAULT 'active',
       latitude         REAL,
       longitude        REAL,
       org_id           TEXT,
       org_name         TEXT,
       ${ownerFk},
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')},
       ${FLAG_CHECK('address_resolved')}
     )`,
  );
  await tx.execute('CREATE INDEX IF NOT EXISTS idx_farms_owner ON farms (owner_user_id)');
  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_farms_owner_server ON farms (owner_user_id, server_id) WHERE server_id IS NOT NULL',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_farms_sync_state ON farms (owner_user_id, sync_state)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS fields (
       ${OWNED_COLUMNS},
       farm_local_id       TEXT NOT NULL,
       name                TEXT NOT NULL,
       area_acres          REAL,
       crop                TEXT,
       season              TEXT,
       irrigation          TEXT,
       location            TEXT,
       address_resolved    INTEGER NOT NULL DEFAULT 1,
       latitude            REAL,
       longitude           REAL,
       sowing_date         TEXT,
       expected_harvest    TEXT,
       status              TEXT NOT NULL DEFAULT 'healthy',
       weather             TEXT,
       has_boundary        INTEGER NOT NULL DEFAULT 0,
       boundary_updated_at TEXT,
       ${ownerFk},
       FOREIGN KEY (farm_local_id) REFERENCES farms (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')},
       ${FLAG_CHECK('has_boundary')},
       ${FLAG_CHECK('address_resolved')}
     )`,
  );
  await tx.execute('CREATE INDEX IF NOT EXISTS idx_fields_owner ON fields (owner_user_id)');
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_fields_farm ON fields (owner_user_id, farm_local_id)',
  );
  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_fields_owner_server ON fields (owner_user_id, server_id) WHERE server_id IS NOT NULL',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_fields_sync_state ON fields (owner_user_id, sync_state)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS field_boundaries (
       field_local_id   TEXT PRIMARY KEY,
       owner_user_id    TEXT NOT NULL,
       farm_local_id    TEXT NOT NULL,
       ring_json        TEXT NOT NULL,
       geojson          TEXT NOT NULL,
       area_sq_m        REAL NOT NULL DEFAULT 0,
       center_lat       REAL NOT NULL DEFAULT 0,
       center_lng       REAL NOT NULL DEFAULT 0,
       bbox_min_lat     REAL NOT NULL DEFAULT 0,
       bbox_min_lng     REAL NOT NULL DEFAULT 0,
       bbox_max_lat     REAL NOT NULL DEFAULT 0,
       bbox_max_lng     REAL NOT NULL DEFAULT 0,
       version          INTEGER NOT NULL DEFAULT 1,
       sync_state       TEXT NOT NULL DEFAULT 'local',
       updated_at       TEXT NOT NULL,
       updated_at_local TEXT NOT NULL,
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK}
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_boundaries_owner ON field_boundaries (owner_user_id)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_boundaries_sync_state ON field_boundaries (owner_user_id, sync_state)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS field_soil (
       field_local_id   TEXT PRIMARY KEY,
       owner_user_id    TEXT NOT NULL,
       ph               REAL,
       organic_matter   REAL,
       nitrogen         REAL,
       phosphorus       REAL,
       potassium        REAL,
       moisture         REAL,
       texture          TEXT,
       notes            TEXT,
       tested_on        TEXT,
       locked           INTEGER NOT NULL DEFAULT 0,
       sync_state       TEXT NOT NULL DEFAULT 'local',
       updated_at_local TEXT NOT NULL,
       last_pulled_at   TEXT,
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('locked')}
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_field_soil_owner ON field_soil (owner_user_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS programs (
       owner_user_id   TEXT NOT NULL,
       program_id      TEXT NOT NULL,
       name            TEXT NOT NULL,
       code            TEXT,
       description     TEXT,
       type            TEXT,
       start_date      TEXT,
       end_date        TEXT,
       user_limit      INTEGER,
       enrolled_count  INTEGER NOT NULL DEFAULT 0,
       is_full         INTEGER NOT NULL DEFAULT 0,
       already_enrolled INTEGER NOT NULL DEFAULT 0,
       can_enroll      INTEGER NOT NULL DEFAULT 0,
       survey_url      TEXT,
       survey_acres    REAL,
       last_pulled_at  TEXT,
       PRIMARY KEY (owner_user_id, program_id),
       ${ownerFk}
     )`,
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS program_fields (
       owner_user_id  TEXT NOT NULL,
       program_id     TEXT NOT NULL,
       field_local_id TEXT NOT NULL,
       enrolled       INTEGER NOT NULL DEFAULT 0,
       last_pulled_at TEXT,
       PRIMARY KEY (owner_user_id, program_id, field_local_id),
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${FLAG_CHECK('enrolled')}
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_program_fields_field ON program_fields (owner_user_id, field_local_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS assessment_categories (
       owner_user_id   TEXT NOT NULL,
       program_id      TEXT NOT NULL,
       category_id     TEXT NOT NULL,
       name            TEXT NOT NULL,
       total_questions INTEGER NOT NULL DEFAULT 0,
       display_order   INTEGER NOT NULL DEFAULT 0,
       last_pulled_at  TEXT,
       PRIMARY KEY (owner_user_id, program_id, category_id),
       ${ownerFk}
     )`,
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS assessment_questions (
       owner_user_id      TEXT NOT NULL,
       question_id        TEXT NOT NULL,
       program_id         TEXT NOT NULL,
       category_id        TEXT NOT NULL,
       question_code      TEXT,
       question_text      TEXT NOT NULL,
       guidance_note      TEXT,
       score0_description TEXT,
       score1_description TEXT,
       score2_description TEXT,
       score3_description TEXT,
       display_order      INTEGER NOT NULL DEFAULT 0,
       last_pulled_at     TEXT,
       PRIMARY KEY (owner_user_id, question_id),
       ${ownerFk}
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_questions_scope ON assessment_questions (owner_user_id, program_id, category_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS assessments (
       ${OWNED_COLUMNS},
       program_id      TEXT NOT NULL,
       field_local_id  TEXT NOT NULL,
       author_role     TEXT NOT NULL,
       title           TEXT,
       year            INTEGER,
       status          TEXT NOT NULL DEFAULT 'PENDING',
       total_questions INTEGER NOT NULL DEFAULT 0,
       answered        INTEGER NOT NULL DEFAULT 0,
       percentage      REAL NOT NULL DEFAULT 0,
       submitted_at    TEXT,
       submit_pending  INTEGER NOT NULL DEFAULT 0,
       locked          INTEGER NOT NULL DEFAULT 0,
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')},
       ${FLAG_CHECK('submit_pending')},
       ${FLAG_CHECK('locked')},
       CHECK (author_role IN ('farmer', 'assessor'))
     )`,
  );
  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_assessment_scope ON assessments (owner_user_id, program_id, field_local_id, author_role)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_assessments_owner ON assessments (owner_user_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS assessment_answers (
       ${OWNED_COLUMNS},
       assessment_local_id TEXT NOT NULL,
       question_id         TEXT NOT NULL,
       field_local_id      TEXT NOT NULL,
       program_id          TEXT NOT NULL,
       author_role         TEXT NOT NULL,
       score               INTEGER NOT NULL,
       comment             TEXT,
       evidence_urls_json  TEXT NOT NULL DEFAULT '[]',
       ${ownerFk},
       FOREIGN KEY (assessment_local_id) REFERENCES assessments (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')},
       CHECK (author_role IN ('farmer', 'assessor')),
       CHECK (score BETWEEN 0 AND 3)
     )`,
  );
  await tx.execute(
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_answer_scope ON assessment_answers (assessment_local_id, question_id)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_answers_owner ON assessment_answers (owner_user_id)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_answers_sync_state ON assessment_answers (owner_user_id, sync_state)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS monitoring_records (
       ${OWNED_COLUMNS},
       field_local_id TEXT NOT NULL,
       module         TEXT NOT NULL,
       status         TEXT NOT NULL DEFAULT 'in_progress',
       notes          TEXT,
       values_json    TEXT NOT NULL DEFAULT '{}',
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')},
       CHECK (status IN ('in_progress', 'completed'))
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_monitoring_scope ON monitoring_records (owner_user_id, field_local_id, module)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_monitoring_sync_state ON monitoring_records (owner_user_id, sync_state)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS documents (
       ${OWNED_COLUMNS},
       field_local_id  TEXT NOT NULL,
       module          TEXT,
       record_local_id TEXT,
       doc_kind        TEXT,
       name            TEXT NOT NULL,
       remote_url      TEXT,
       mime            TEXT,
       size_bytes      INTEGER,
       uploaded_at     TEXT,
       media_local_id  TEXT,
       ${ownerFk},
       FOREIGN KEY (field_local_id) REFERENCES fields (local_id) ON DELETE CASCADE,
       ${SYNC_STATE_CHECK},
       ${FLAG_CHECK('deleted_local')}
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_documents_scope ON documents (owner_user_id, field_local_id)',
  );

  await tx.execute(
    `CREATE TABLE IF NOT EXISTS media_files (
       local_id             TEXT PRIMARY KEY,
       server_id            TEXT,
       remote_url           TEXT,
       owner_user_id        TEXT NOT NULL,
       purpose              TEXT NOT NULL,
       attached_to_type     TEXT,
       attached_to_local_id TEXT,
       file_path            TEXT NOT NULL,
       file_name            TEXT NOT NULL,
       mime                 TEXT,
       size_bytes           INTEGER,
       upload_status        TEXT NOT NULL DEFAULT 'local',
       retry_count          INTEGER NOT NULL DEFAULT 0,
       last_error           TEXT,
       created_at           TEXT NOT NULL,
       updated_at           TEXT NOT NULL,
       ${ownerFk},
       CHECK (upload_status IN ('local', 'pending', 'uploaded', 'failed'))
     )`,
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_media_owner_status ON media_files (owner_user_id, upload_status)',
  );
  await tx.execute(
    'CREATE INDEX IF NOT EXISTS idx_media_attached ON media_files (owner_user_id, attached_to_type, attached_to_local_id)',
  );
};
