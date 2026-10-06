# Farmer App Platform: Master Architecture

This is the technical map of the backend API and the admin web panel. It covers the database, explains how the pieces fit together and how a request travels, and lists every source file with what it does, so you know which file to open before you change anything.

Read [MASTER-README.md](MASTER-README.md) first for what the platform does and how to run it. Use this file when you need to find or change code.

## How to use this file

| You want to | Go to |
|---|---|
| Understand how the parts connect | Section 1 and Section 8 |
| Understand how the backend works inside | Section 2 |
| Find a table or a migration | Section 3 |
| Find an endpoint, who may call it and which handler runs | Section 4 |
| Find a backend file | Section 5 |
| Find an admin page, component or API hook | Section 6 |
| Find what the mobile app uses from the backend | Section 7 |
| Follow a business flow across backend, admin and mobile | Section 8 |
| Know exactly which files to edit for a change | Section 9 |
| Check the meaning of a word | Section 10 |

---

## 1. System overview

```text
   Farmers and assessors           Office staff                    Producers (applicants)
   Mobile app                      Admin web panel                 Public survey pages
   uses the API                    React + Vite                    served by the admin app
          |                               |                                |
          |  REST (JSON) and Socket.IO    |  REST and Socket.IO            |  REST and Socket.IO
          |                               |                                |  (link token, no account)
          +-------------------------------+--------------------------------+
                                          |
                          Backend API  (Node, Express, TypeScript)
                          REST under /api/v1, Socket.IO on the same port
                                          |
                    +---------------+----------------+
                    |               |                |
               PostgreSQL       Cloudinary       Email provider
               Prisma and pg    photos, docs,    SMTP or API,
               56 tables        contract PDFs    set in the panel
```

### The applications

| App | Folder | Users | Technology | Role in the system |
|---|---|---|---|---|
| Backend API | `backend/` | All apps | Node 22, Express 4, TypeScript, Prisma, PostgreSQL, Zod, JWT, Socket.IO, Cloudinary, Nodemailer, pdf-lib, ExcelJS | Owns all data and rules. Every other part calls it. |
| Admin web panel | `admin/` | Super admin, admin, program administrator | React 18, TypeScript, Vite, Tailwind CSS, Redux Toolkit and RTK Query, React Router, Leaflet, Recharts, Socket.IO client, ExcelJS | Office work: users, programs, surveys, assessments, review, dashboards, live visits, help content. Also serves the public survey pages. |
| Mobile app | not in this document | Farmers and assessors | Separate project | Calls this API and Socket.IO. Its developer guides are listed in Section 7. |

### Size of the code base

| Area | Files | Lines |
|---|---:|---:|
| Backend source (`backend/src`, without SQL) | 175 | 36,932 |
| Backend SQL migrations | 67 | 2,928 |
| Admin source (`admin/src`) | 142 | 32,627 |

The backend exposes 255 endpoints in 23 route files, over 56 Prisma models. Section 4 lists every endpoint.

### What talks to what

| From | To | How | What for |
|---|---|---|---|
| Admin | Backend | Axios through RTK Query, base URL from `VITE_API_BASE_URL` | Everything the panel shows or changes |
| Admin | Backend | Socket.IO (`admins` room, visit rooms) | Live counts, live visit map, refresh when data changes |
| Public survey page (in admin) | Backend | Plain fetch (`admin/src/lib/programSurveyApi.ts`) and a Socket.IO connection with the link token | Producer survey, status, contract signing |
| Mobile app | Backend | REST with a Bearer token and token refresh | Everything the app shows or changes |
| Mobile app | Backend | Socket.IO (`user:<id>` room, visit rooms) | Live sync across devices, notifications, visit tracking |
| Backend | PostgreSQL | Prisma client and raw SQL | Storage |
| Backend | Cloudinary | Cloudinary SDK upload streams | Photos, documents, avatars, branding, signatures, contract PDFs |
| Backend | Email provider | Nodemailer (SMTP) or an API provider, chosen in Settings | OTP codes, invitations, contracts, notices |

---

## 2. Backend architecture

Entry points: `backend/src/server.ts` (process) and `backend/src/app.ts` (Express app).

### 2.1 Request lifecycle

Every HTTP request goes through this chain, in this order:

1. `trust proxy` is on, so the real client IP is read behind a proxy.
2. Helmet sets security headers.
3. CORS allows the origins listed in `CORS_ORIGIN` (comma separated, or `*` for local work).
4. JSON and URL encoded bodies are parsed, limit 1 MB. File uploads use Multer instead.
5. Responses are compressed. Requests are logged (Morgan).
6. The global rate limit runs on the API prefix (default 100 requests per 15 minutes per IP, switchable with `RATE_LIMIT_ENABLED`).
7. The router matches `/api/v1/...` (`API_PREFIX` can change the prefix). A route then runs its own chain: named rate limiter, `authenticate`, `authorize(roles)`, upload middleware, `validate(schema)`, then the controller.
8. The controller calls a service. The service applies the rules and calls models. Models talk to the database.
9. Anything thrown goes to `notFound` (unknown route) or `errorHandler`, which returns the standard error body.

### 2.2 Layers and what belongs in each

| Layer | Folder | Holds | Does not hold |
|---|---|---|---|
| Routes | `routes/` | Paths, HTTP method, middleware order | Logic |
| Controllers | `controllers/` | Read the request, call one service function, send `ApiResponse` | Rules, SQL |
| Services | `services/` | Business rules, ownership checks, orchestration across models, notifications, emails, files | HTTP objects |
| Models | `models/` | Prisma and raw SQL queries, mapping rows to public shapes | Rules that depend on who is asking |
| Validators | `validators/` | Zod schemas for body, query and params | Anything else |
| Middlewares | `middlewares/` | Authentication, role gate, validation, uploads, rate limits, errors | Business rules |
| Utils | `utils/` | Small pure helpers (errors, responses, JWT, geometry, clock) | Database access |

File naming is `<domain>.routes.ts`, `<domain>.controller.ts`, `<domain>.service.ts`, `<domain>.model.ts`, `<domain>.schema.ts`. A change to one domain touches one file in each layer, which is what makes the atlas in Section 5 easy to follow.

### 2.3 Sign in, tokens and sessions

| Topic | How it works | Files |
|---|---|---|
| Sign up (farmer) | Needs a valid Enrollment ID. The app does not send an email: the server resolves it from the ID, so it is never handed out before sign up. `POST /auth/enrollment-id/lookup` (strict limiter, same answer for a wrong or a guessed ID) returns the full name, a masked email, a masked phone and the program name, and the app shows them locked. An OTP is then emailed and must be verified. | `auth.service.ts`, `enrollmentId.model.ts`, `auth.schema.ts`, `mask.ts` |
| Accounts made by the office | Assessors and other staff are created by an administrator. A temporary password is emailed. `must_change_password` blocks the app until the person sets their own. | `user.service.ts`, `tempPassword.ts` |
| Sign in | Email and password. Refused with a code when the account is inactive (`ACCOUNT_INACTIVE`), the email is not verified (`EMAIL_NOT_VERIFIED`, the app asks for a code) or the password is a temporary one (`PASSWORD_CHANGE_REQUIRED`, the person must set their own through the reset flow). Every attempt is written to `login_logs` (method, status, IP, reason). | `auth.service.ts`, `loginLog.model.ts` |
| Access token | Signed JWT, lifetime `JWT_EXPIRES_IN`. Sent as `Authorization: Bearer`. | `utils/jwt.ts`, `middlewares/authenticate.ts` |
| Refresh token | Stored in `refresh_tokens`, lifetime `REFRESH_TOKEN_EXPIRY_DAYS`. Can be revoked on logout. | `refreshToken.model.ts` |
| Account check | `authenticate` re-reads the account on every request. A deleted account gets 401. A deactivated account gets 403 `ACCOUNT_INACTIVE`. An old token stops working at once. | `authenticate.ts`, `user.model.ts` |
| Forgot password | Code by email, verify, then reset. Strict limiter. | `auth.service.ts`, `rateLimiters.ts` |
| Public survey link | No account. A magic link token identifies the survey or the submission status page. | `programAdminSurveyPublic.*` |

### 2.4 Authorization

There are three layers, and all three apply.

1. Role gate on the route. `authorize("super_admin", "admin", ...)` refuses other roles with 403. The gates are named in each route file (`orgManagers`, `programManagers`, `templateManagers`, `assessorOnly`, `farmerOnly`, `faqAdmins`, `enquiryAdmins`, `canRecord`). Section 4 shows the result per endpoint.
2. Ownership in the service. A route marked "Any signed-in user" only needs a valid token. The service then narrows the data: a farmer sees only their own farms, fields and records, a program administrator only their own programs and the people in them, an assessor only fields of enrollments assigned to them.
3. Rank rule for people. Config in `config/rbac.ts`. A manager may only act on accounts of a strictly lower rank.

| Role | Rank | May create |
|---|---:|---|
| super_admin | 100 | admin, program_administrator, program_partner, assessor, farmer |
| admin | 80 | program_administrator, program_partner, assessor, farmer |
| program_administrator | 60 | assessor, farmer |
| program_partner | 40 | nobody |
| assessor | 20 | nobody |
| farmer | 10 | nobody (self registers with an Enrollment ID) |

Each administrative role also has a front end rule in `admin/src/lib/access.ts`, which limits which pages a program administrator can open.

### 2.5 Validation

Every body, query and params object is checked with a Zod schema in `validators/` through `validate(schema, "body" | "query" | "params")`. `validateWith` chooses the schema from the request (used by field monitoring, where each module has its own body schema). Shared building blocks are in `common.schema.ts` and `pagination.schema.ts`. A failure returns 400 `VALIDATION_ERROR` with one message per field.

The same rules are repeated on the admin side (`admin/src/lib/validation.ts` and the forms) and in the mobile app. The backend is the one that decides. The front ends repeat the rules only so a person sees the problem before sending.

### 2.6 Response and error format

Success:

```json
{ "success": true, "message": "Field fetched.", "data": { }, "meta": { "page": 1, "limit": 20, "total": 84, "totalPages": 5 } }
```

`meta` appears on paged lists only.

Error:

```json
{ "success": false, "message": "Please check the highlighted fields.", "code": "VALIDATION_ERROR", "errors": [ { "field": "email", "message": "Enter a valid email." } ] }
```

| Status | Code | When |
|---|---|---|
| 400 | `BAD_REQUEST`, `VALIDATION_ERROR` | Bad input |
| 401 | `UNAUTHORIZED` | No, bad or expired token, or account gone |
| 403 | `FORBIDDEN`, `ACCOUNT_INACTIVE`, other specific codes | Role not allowed, or account switched off |
| 404 | `NOT_FOUND` | Missing record, or a record the caller may not see |
| 409 | `CONFLICT` | Duplicate, or a state that does not allow the action (for example a submitted assessment) |
| 422 | `UNPROCESSABLE_ENTITY` | Understood but not acceptable |
| 429 | `TOO_MANY_REQUESTS` | Rate limit |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected. The message is hidden in production. |

`errorHandler.ts` also maps Postgres errors (duplicate key, foreign key) and Multer errors (size, type) to clean 4xx answers.

### 2.7 Data access, deletes and migrations

| Topic | Rule |
|---|---|
| Access | Prisma client for ordinary reads and writes. `prisma.$queryRaw` with parameters for joins, reports and anything Prisma cannot express. The `pg` pool (`db/pool.ts`) is used for the health check and startup. |
| Schema | `backend/prisma/schema.prisma` lists 56 models. The real schema changes are plain SQL files in `backend/src/db/migrations/`, numbered `001` to `067`. Prisma cannot express partial unique indexes, so those live only in SQL. |
| Applying migrations | With `DB_SYNC=true` the server runs `db/sync.ts` on start. It applies unapplied files in name order and records each in the `_migrations` table. Set it back to `false` afterwards. |
| Soft delete | Most tables have `deleted_at`. Queries always filter `deleted_at IS NULL`. Helpers in `db/softDelete.ts`. |
| Cascade delete | Deleting a program, user, survey, farm or field also deletes what belongs to it. `cascadeDelete.service.ts` builds a summary first (`/deletion-summary` endpoints) and the admin panel shows it before it deletes (`admin/src/lib/confirmDelete.tsx`). |

### 2.8 Real time (Socket.IO)

The Socket.IO server starts in `socket/index.ts` on the same HTTP server. A connection authenticates with an app token or a survey link token.

| Room | Who joins | What is sent |
|---|---|---|
| `user:<id>` | Every device of one signed-in user | `sync` (a resource of the user changed, refetch it), `notification:new`, unread count |
| `admins` | Admin panel sessions (super admin, admin, program admin) | `data:changed` with a resource name such as `enrollments`, `submissions`, `visits`, `programs`, `dashboard`, `faqs`, `contact_enquiries`, `assessments` |
| `visit:<visitId>` | Assessor, farmer and admins watching a visit | `visit:location`, `visit:status`, `visit:error` |
| `submission:<id>` | A producer on the survey status page | `application:changed` |

Everyone also receives `config:changed` when branding or timezone change. Emitting is done through `services/realtime.service.ts` (admins and users) and `socket/liveSync.ts` (`emitSync`). A failed emit never fails the request.

### 2.9 Notifications and email

1. A service calls `notifyUser`, `notifyUsers` or `notifyOrgManagers` (`notification.service.ts`) with a type, title, body and a redirect target.
2. A row is stored in `notifications`. The user gets `notification:new` and an updated unread count over the socket.
3. If the call passes an email builder, an email is sent too.

Notification types: `new_program_available`, `enrolled_in_program`, `assessor_assigned`, `assessor_visit_started`, `assessor_visit_arrived`, `assessment_submitted`, `assessment_reviewed`, `survey_submitted`, `contract_signed`, `contact_enquiry`. The redirect (`notification.model.ts`) tells the mobile app or the admin panel which screen to open.

Emails are built in `emailTemplates.ts` (21 templates: verify email, sign in code, survey OTP, reset password, welcome, password changed, new program, enrolled, assessor assigned, visit started, assessment submitted, assessment submitted notice, survey invite, survey received, survey qualified, survey not qualified, contract to sign, enrollment welcome, farm setup, returning enrollment, contact reply) and sent by `mailer.service.ts`. The provider (SMTP or an API provider, with an optional fallback) is stored in `email_settings` and edited in the admin Settings. Secrets are encrypted with `utils/secretBox.ts`. While SMTP is off, codes are printed to the server terminal and returned by the API for local work.

### 2.10 Files, PDFs and spreadsheets

| Need | How | Files |
|---|---|---|
| Upload | Multer keeps the file in memory, then `upload.service.ts` streams it to Cloudinary. Folders: `farmer_evidence`, `farmer_documents`, `farmer_avatars`, `farmer_branding`, `farmer_signatures`, `farmer_contracts`, `farmer_monitoring`. | `config/multer.ts`, `upload.service.ts` |
| Limits | Excel 5 MB. Evidence: 5 files, images 5 MB, video 50 MB. Avatar 5 MB. Documents 10 MB (pdf, images, doc, docx). Type and size are checked on the server. | `config/multer.ts` |
| Contract PDF | Built with pdf-lib. The signed copy adds signature, name, date and IP. | `contractPdf.service.ts` |
| Assessment spreadsheets | Import, export and the sample file are built and read on the server. | `assessmentImport.ts` |
| Admin exports | Built in the browser with ExcelJS. | `admin/src/lib/workbook.ts` |

### 2.11 Time

The organization picks a timezone and a 12 or 24 hour clock (`organizations.timezone`, `time_format`). `clock.service.ts` applies it everywhere, including SQL helpers such as `org_today()` used to decide whether a program has started or ended. The API sends ISO timestamps. The admin panel formats them in the organization timezone (`admin/src/lib/datetime.ts`). Changing the setting broadcasts `config:changed`.

### 2.12 Startup and background work

`server.ts` does this, in order:

1. Connect to the database, with retries.
2. If `DB_SYNC=true`, apply pending migrations.
3. If `DB_SEED=true`, seed roles, the super admin and starter FAQs.
4. Seed the global survey template and the global contract template (safe to repeat).
5. Start Express, then Socket.IO.
6. Every 15 minutes run visit housekeeping: close a visit that had no position for 4 hours and delete location history older than 90 days.
7. On SIGTERM or SIGINT close the server and the database cleanly.

### 2.13 Configuration

All configuration is read once in `config/env.ts`. Copy `backend/.env.example` to `backend/.env`.

| Group | Variables |
|---|---|
| Server | `NODE_ENV`, `PORT`, `CORS_ORIGIN`, `API_PREFIX` |
| Database | `DATABASE_URL`, `DB_SYNC`, `DB_SEED` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRY_DAYS` |
| OTP | `OTP_LENGTH`, `OTP_EXPIRY_MINUTES` |
| Email | `SMTP_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL` (also editable in the panel) |
| Links in emails | `APP_URL`, `SURVEY_APP_URL`, `MOBILE_APP_URL` |
| Rate limit | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` |
| Bootstrap | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME` |
| Visit arrival | `VISIT_ARRIVAL_ENFORCE` (default false), `VISIT_ARRIVAL_BOUNDARY_TOLERANCE_M` (150), `VISIT_ARRIVAL_POINT_TOLERANCE_M` (300) |
---

## 3. Database

PostgreSQL. The schema is described in `backend/prisma/schema.prisma` (54 models) and built by the SQL files in `backend/src/db/migrations/`. Ids are UUIDs. Times are `timestamptz`. Most tables carry `created_at`, `updated_at` and `deleted_at` (soft delete).

### 3.1 Tables by area

**People, sessions and organization**

| Table | What it stores | Notes |
|---|---|---|
| `roles` | The six role names | `super_admin`, `admin`, `program_administrator`, `program_partner`, `assessor`, `farmer` |
| `users` | Every account | `role_id`, `email`, `phone`, `password_hash`, `is_active`, `is_email_verified`, `must_change_password`, `enrollment_id`, `avatar_url`, `org_id` |
| `otp_codes` | Email codes for verify, sign in, reset | Short lived, consumed once |
| `refresh_tokens` | Refresh tokens | Revoked on logout |
| `login_logs` | Every sign in attempt | `method`, `status`, `ip_address`, `reason` |
| `organizations` | The one organization the platform runs for, and its branding | `logo_url`, `favicon_url`, `timezone`, `time_format`, contact details and hours |
| `email_settings` | The one row that says where email goes out from | Provider, fallback, SMTP fields, encrypted secrets |

**Farms and fields**

| Table | What it stores | Notes |
|---|---|---|
| `farms` | A farm | `owner_id` (a farmer), `area_acres`, `business_entity`, latitude and longitude |
| `fields` | A field of a farm | `farm_id`, `area_acres`, `crop`, `season`, `irrigation`, sowing and harvest dates, point, `boundary` (GeoJSON polygon), `boundary_updated_at` |
| `field_soil` | Latest soil values of a field | pH, organic matter, N, P, K, moisture, texture, notes, tested on |
| `field_documents` | Files attached to a field | Cloudinary URL, mime type, size |

**Programs and enrollment**

| Table | What it stores | Notes |
|---|---|---|
| `programs` | A program | `name`, `code`, `type`, dates, `user_limit`, `is_active`, `show_to_farmers`, `assessment_template_id` |
| `program_enrollments` | A farmer enrolled in a program | `enrollment_id` (the IIG-YYYY-NNNNNN code), `assessor_id`, status, note |
| `program_enrollment_fields` | The fields of that enrollment | One row per enrolled field |
| `assessor_assignments` | Older assessor to farmer assignment | Still served by `/assessor-assignments`. Access to assess comes from `program_enrollments.assessor_id`. |

**Assessments**

| Table | What it stores | Notes |
|---|---|---|
| `assessment_templates` | A set of categories and questions | `owner_id`, `is_global`, `program_id` (a program's own copy), `copied_from_id`, `question_kind` (`mcq` or `input`), `locked_at`. Only one live Global template. |
| `assessment_categories` | A category inside a template | `template_id`, `sort_order` |
| `assessment_questions` | A question | `question_type` (`scored`, `mcq`, `text`, `long_text`, `number`, `date`, `boolean`, `photo`), `max_score`, `evidence_mode`, `comment_mode` (`off`, `optional`, `required`), score 0 to 3 descriptions, guidance note |
| `assessment_question_options` | Choices of an MCQ question | Each choice carries its score |
| `assessment_responses` | One answer | `field_id`, `question_id`, `program_id`, `author_role` (`farmer` or `assessor`), `score`, `option_id`, `answer_text`, `answer_number`, `answer_date`, `answer_boolean`, `evidence_urls`, `review_score`, `reviewed_by` |
| `field_assessments` | One submission per field, program and role | Totals, `percentage`, `status`, `review_status` (`in_review` or `approved`), `review_note`. Unique on field, role and program. |

**Field monitoring (practice records)**

Eleven tables, one per module. Each row belongs to a field. Each has its own columns, a `status` and `notes`.

| Module key | Table |
|---|---|
| `training` | `field_trainings` |
| `soil_samples` | `field_soil_samples` |
| `irrigation` | `field_irrigations` |
| `pesticide` | `field_pesticides` |
| `fertilizer` | `field_fertilizers` |
| `tillage` | `field_tillage_records` |
| `amendment` | `field_amendments` |
| `crop` | `field_crop_records` |
| `nutrient` | `field_nutrient_events` |
| `crop_intensification` | `field_crop_intensifications` |
| `animal_integration` | `field_animal_integrations` |
| (attachments of all) | `field_module_documents` |

**Visits**

| Table | What it stores | Notes |
|---|---|---|
| `field_visits` | An assessor's visit to a field | `status` (`en_route`, `arrived`, `completed`, `cancelled`, `expired`), destination, last position, arrival position and distance, `arrival_verified`, `location_flag` |
| `field_visit_locations` | Position history of a visit | Pruned after 90 days |

**Program survey (eligibility)**

| Table | What it stores | Notes |
|---|---|---|
| `program_admin_survey_templates` | Survey template | `owner_id`, `is_global` |
| `program_admin_survey_categories` | Categories of a survey template | Each has an icon |
| `program_admin_survey_questions` | Survey questions | Four answer labels (0 to 3) and a weight |
| `program_admin_survey_scoring_rules` | Score range for each result (Gold, Silver, Bronze) | Editable per template |
| `program_admin_surveys` | A survey attached to a program | `token` (public link), `template_id`, `contract_template_id`, `program_id`, `locked_at` |
| `program_admin_contract_templates` | Contract text (clauses) or an uploaded PDF | `is_global` |
| `program_admin_survey_submissions` | One producer's submission | Answers, `score`, `auto_category`, `final_category`, `status`, `status_token`, `enrollment_id`, `override_reason` |
| `program_admin_survey_contracts` | The contract sent for a submission | Token, expiry, signature, signer IP, signed PDF, accepted by |

**Older single survey tables (kept for existing data)**

`website_users` (producer accounts, still used by the program survey), `survey_categories`, `survey_questions`, `survey_scoring_rules` (one fixed survey), `eligibility_submissions`, `contracts`.

**Communication**

| Table | What it stores |
|---|---|
| `notifications` | In app notifications with `type`, `data` and `read_at` |
| `faqs` | Help questions shown in the mobile app |
| `contact_enquiries` | Messages sent from the Contact Us form, with read and resolved flags |
| `contact_enquiry_replies` | Replies the office sent by email |

**System**

| Table | What it stores |
|---|---|
| `_migrations` (Prisma model `migrations`) | Which SQL files have been applied |

### 3.2 Relations that matter

```text
organization 1---* users 1---* farms 1---* fields
                                             |
programs 1---* program_enrollments *---1 users (farmer)
    |               |   (assessor_id -> users)
    |               +---* program_enrollment_fields *---1 fields
    |
    +--> assessment_templates 1---* assessment_categories 1---* assessment_questions 1---* assessment_question_options

fields + programs ---> assessment_responses (by author_role) ---> field_assessments (one per field, program, role)
fields ---> the 11 monitoring tables ---> field_module_documents
fields ---> field_soil, field_documents
fields + programs ---> field_visits ---> field_visit_locations

programs 1---0..1 program_admin_surveys ---> program_admin_survey_templates (categories, questions, scoring rules)
                                   ---> program_admin_contract_templates
program_admin_surveys 1---* program_admin_survey_submissions 1---1 program_admin_survey_contracts
program_admin_survey_submissions.enrollment_id == program_enrollments.enrollment_id == users.enrollment_id
```

Monitoring records belong to a field only. They have no program.

### 3.3 Migration history

Files in `backend/src/db/migrations/`. They run in name order.

| # | File | What it does |
|---|---|---|
| 001 | `create_roles_table` | Roles |
| 002 | `create_users_table` | Users |
| 003 | `create_otp_codes_table` | OTP codes |
| 004 | `create_login_logs_table` | Login logs |
| 005 | `add_soft_delete` | `deleted_at` columns |
| 006 to 008 | `refresh_tokens` (create, drop, recreate) | Refresh token table |
| 009 | `create_organizations` | Organizations |
| 010 | `create_farms` | Farms |
| 011 | `create_fields` | Fields |
| 012 | `create_assessments` | Assessment categories and questions |
| 013 | `assessment_category_unique_name` | Unique category names |
| 014 | `create_assessment_responses` | Answers |
| 015 | `add_evidence_urls` | Photo evidence on answers |
| 016 | `create_field_assessments` | Submissions |
| 017 | `roles_and_assessor_assignments` | New roles, assessor assignments |
| 018 | `field_soil_and_documents` | Soil and field documents |
| 019 | `programs_and_enrollments` | Programs, enrollments, enrolled fields |
| 020 | `assessor_dual_assessment` | Farmer and assessor assess the same field |
| 021 | `enrollment_assessor` | `assessor_id` on enrollments |
| 022 | `add_geo_coordinates` | Latitude and longitude |
| 023 | `field_visits` | Visit tracking |
| 024 | `notifications` | Notifications |
| 025 | `program_scoped_assessments` | One assessment per field and program |
| 026 | `user_avatar` | Avatar |
| 027 | `farm_business_entity` | Business entity on a farm |
| 028 | `drop_field_status` | Removes field status |
| 029 | `org_branding` | Logo and favicon |
| 030 | `eligibility_enrollment` | First eligibility survey, submissions, contracts |
| 031 | `seed_survey_questions` | Starter survey questions |
| 032 | `org_contact_hours` | Contact hours |
| 033 | `standalone_survey_channel` | Survey without an account |
| 034 | `survey_categories_scale` | 0 to 3 scale on categories |
| 035 | `survey_question_options` | Options on survey questions |
| 036 | `submission_withdrawn` | Withdrawn status |
| 037 | `field_boundary` | `boundary` on fields |
| 038 | `visit_arrival_verification` | Arrival geofence result |
| 039 | `visit_location_history` | Position history |
| 040 | `submission_override_reason` | Reason for a category override |
| 041 | `program_admin_survey` | Program survey module |
| 042 | `program_admin_contract_template` | Contract templates |
| 043 | `program_survey_link` | Survey linked to a program |
| 044 | `contract_pdf` | Signed contract PDF |
| 045 | `submission_phone` | Phone on a submission |
| 046 | `org_locale` | Timezone and clock |
| 047 | `org_time_helpers` | SQL helpers such as `org_today()` |
| 048 | `email_settings` | Email provider settings |
| 049 | `program_show_to_farmers` | Program visibility |
| 050 | `enrollment_id_on_enrollments` | Enrollment ID on enrollments |
| 051 | `field_program_modules` | Monitoring module tables |
| 052 | `field_monitoring_drop_program` | Monitoring belongs to a field only |
| 053 | `crop_intensification_animal_integration` | Two more monitoring modules |
| 054 | `documents_allow_new_modules` | Documents for the new modules |
| 055 | `faqs` | FAQs |
| 056 | `contact_enquiries_resolved` | Resolved flag |
| 057 | `users_must_change_password` | Temporary password rule |
| 058 | `contact_enquiry_replies` | Email replies |
| 059 | `assessment_templates` | Templates. The old bank becomes the Original template, Global starts as its copy. |
| 060 | `assessment_program_indexes` | Indexes by program |
| 061 | `assessment_question_types` | Question types, MCQ options, review, locks |
| 062 | `kab_assessment_template` | The KAB field monitoring worksheet as a template |
| 063 | `assessment_two_question_kinds` | `mcq` and `input` kinds, photo and note modes |
| 064 | `kab_template_is_input_based` | Marks the KAB template as input based |
| 065 | `assessment_records` | Several records per input category, form level evidence, category evidence |
| 066 | `global_template_per_kind` | One Global template for each kind (multiple choice and input) |
| 067 | `named_program_assessments` | Merges old empty named templates into the program's own assessment |

Other SQL in the repo:

| File | Purpose |
|---|---|
| `backend/prisma/sql/fix_assessment_responses_upsert_index.sql` | Partial unique index Prisma cannot express |
| `backend/prisma/sql/rollback_059_assessment_templates.sql` | Undo script for migration 059 |
| `backend/PRODUCTION-MIGRATION-019-020.sql` | One time production migration notes |
| `backend/RECOVER-dropped-tables.sql` | Recovery script |
---

## 4. API reference

All paths below are relative to the API prefix, `/api/v1` by default. The list is read from the route files, so it matches the code. There are 255 endpoints.

How to read the tables:

| Column | Meaning |
|---|---|
| Method and Path | The HTTP call. `:name` is a path parameter. |
| Who can call | The role gate on the route. `Public` needs no token (a few public routes have their own rate limiter, or need a link token). `Any signed-in user` needs a valid token; the service then narrows the data to what that person may see (a farmer sees only their own records, a program administrator only their own programs). |
| Handler | `controllerFile.function`. The controller is in `backend/src/controllers/<controllerFile>.controller.ts`. It calls the service of the same name. |

Endpoints per area:

| Area | Prefix | Count | Used by |
|---|---|---:|---|
| Health | `/health` | 2 | Mobile, uptime checks |
| Config (branding, locale, contact details) | `/config` | 1 | Admin |
| Auth | `/auth` | 12 | Mobile, admin |
| Roles (self sign up roles) | `/roles` | 1 | Not called by the apps today |
| Login activity | `/login-logs` | 1 | Admin |
| Users | `/users` | 10 | Admin |
| Profile | `/profile` | 7 | Mobile, admin |
| Organization (settings and branding) | `/organizations` | 6 | Admin |
| Email settings | `/email-settings` | 3 | Admin |
| Farms | `/farms` | 13 | Mobile, admin |
| Fields | `/fields` and `/farms/:farmId/fields` | 22 | Mobile, admin |
| Assessments | `/assessments` | 42 | Mobile (farmer), admin |
| Assessor assignments | `/assessor-assignments` | 3 | Admin |
| Assessor | `/assessor` | 11 | Mobile (assessor) |
| Programs | `/programs` | 21 | Mobile, admin |
| Dashboard | `/dashboard` | 7 | Mobile, admin |
| Visits | `/visits` | 9 | Mobile, admin |
| Field monitoring | `/field-monitoring` | 13 | Mobile. The admin panel has no monitoring screens at the moment. |
| Notifications | `/notifications` | 7 | Mobile, admin |
| FAQs | `/faqs` | 7 | Mobile, admin |
| Contact enquiries | `/contact-enquiries` | 9 | Mobile, admin |
| Program survey (admin) | `/program-admin-surveys` | 39 | Admin |
| Program survey (public) | `/program-admin-survey` | 10 | Public survey pages |

Notes:

- The routes shown under `/fields` for `/farms/:farmId/fields...` are the farmer's own field routes. They live in `mobileFieldRouter` (in `field.routes.ts`) and are mounted by `farm.routes.ts`.
- `/assessments` covers three things: the farmer flow (`/my/...`), the review of a submitted assessment (`/reviews/:id`), and the template tools for staff (`/templates/...`, `/categories/:id`, `/questions/:id`, `/import-sample`).
- `/field-monitoring` has no program in its paths. A monitoring record belongs to a field.
- `GET /fields/:id/assessment-comparison` takes an optional `programId` query. It returns both sides (percentage and submit time) and, for every question, the maximum score and each side's answer written out (for example `Score 2`, the chosen option, `Yes`, a number or a date).
- The farmer and assessor category question responses carry `questionKind` (`mcq` or `input`), the same value the summary reports, so any screen that opens a category knows which shape to draw.
- `POST /assessments/reviews/:id/approve` takes an optional `note` and one of: nothing (every answer already scored with `PATCH /assessments/reviews/:id`), `categoryScores` (one score per category), or `overallScore` (one score for the whole assessment). Each score is checked against what the category or the assessment can reach.
- Sending a farmer's request to a staff route (or the reverse) returns 403.

### `/health`

Route file: `backend/src/routes/health.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/health` | Public | `health.getHealth` |
| GET | `/health/db` | Public | `health.getDbHealth` |

### `/config`

Route file: `backend/src/routes/config.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/config` | Public | `config.getConfig` |

### `/auth`

Route file: `backend/src/routes/auth.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/auth/check-email` | Public | `auth.checkEmail` |
| POST | `/auth/enrollment-id/lookup` | Public | `auth.enrollmentIdLookup` |
| POST | `/auth/register` | Public | `auth.register` |
| POST | `/auth/login` | Public | `auth.login` |
| POST | `/auth/request-otp` | Public | `auth.requestOtp` |
| POST | `/auth/verify-otp` | Public | `auth.verifyOtp` |
| POST | `/auth/refresh-token` | Public | `auth.refreshToken` |
| POST | `/auth/logout` | Public | `auth.logout` |
| POST | `/auth/forgot-password` | Public | `auth.forgotPassword` |
| POST | `/auth/verify-reset-code` | Public | `auth.verifyResetCode` |
| POST | `/auth/reset-password` | Public | `auth.resetPassword` |
| GET | `/auth/me` | Any signed-in user | `auth.me` |

### `/roles`

Route file: `backend/src/routes/role.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/roles` | Public | `role.getRoles` |

### `/login-logs`

Route file: `backend/src/routes/loginLog.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/login-logs` | super_admin, admin | `loginLog.getLoginLogs` |

### `/users`

Route file: `backend/src/routes/user.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/users` | super_admin, admin, program_administrator | `user.createUser` |
| GET | `/users` | super_admin, admin, program_administrator | `user.listUsers` |
| GET | `/users/assessors` | super_admin, admin, program_administrator | `user.listAssessors` |
| GET | `/users/:id` | super_admin, admin, program_administrator | `user.getUser` |
| PATCH | `/users/:id` | super_admin, admin, program_administrator | `user.updateUser` |
| GET | `/users/:id/deletion-summary` | super_admin, admin, program_administrator | `user.userDeletionSummary` |
| DELETE | `/users/:id` | super_admin, admin, program_administrator | `user.deleteUser` |
| PATCH | `/users/:id/status` | super_admin, admin, program_administrator | `user.setUserStatus` |
| PUT | `/users/:id/assessor` | super_admin, admin, program_administrator | `user.assignAssessor` |
| DELETE | `/users/:id/assessor` | super_admin, admin, program_administrator | `user.unassignAssessor` |

### `/profile`

Route file: `backend/src/routes/profile.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/profile/me` | Any signed-in user | `profile.getMyProfile` |
| PATCH | `/profile/me` | Any signed-in user | `profile.updateMyProfile` |
| DELETE | `/profile/me` | Any signed-in user | `profile.deleteMyAccount` |
| POST | `/profile/me/avatar` | Any signed-in user | `profile.uploadMyAvatar` |
| DELETE | `/profile/me/avatar` | Any signed-in user | `profile.removeMyAvatar` |
| GET | `/profile/organization` | Any signed-in user | `profile.getMyOrganization` |
| POST | `/profile/change-password` | Any signed-in user | `profile.changeMyPassword` |

### `/organizations`

Route file: `backend/src/routes/organization.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/organizations/current` | super_admin, admin | `organization.getCurrentOrganization` |
| PATCH | `/organizations/:id` | super_admin, admin | `organization.updateOrganization` |
| POST | `/organizations/:id/logo` | super_admin, admin | `organization.uploadOrgLogo` |
| DELETE | `/organizations/:id/logo` | super_admin, admin | `organization.removeOrgLogo` |
| POST | `/organizations/:id/favicon` | super_admin, admin | `organization.uploadOrgFavicon` |
| DELETE | `/organizations/:id/favicon` | super_admin, admin | `organization.removeOrgFavicon` |

### `/email-settings`

Route file: `backend/src/routes/emailSettings.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/email-settings` | super_admin, admin | `emailSettings.getEmailSettings` |
| PUT | `/email-settings` | super_admin, admin | `emailSettings.updateEmailSettings` |
| POST | `/email-settings/test` | super_admin, admin | `emailSettings.sendTestEmail` |

### `/farms`

Route file: `backend/src/routes/farm.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/farms/me/farms` | Any signed-in user | `farm.myFarms` |
| POST | `/farms/me/farms` | Any signed-in user | `farm.createMyFarm` |
| GET | `/farms/me/farms/:id` | Any signed-in user | `farm.myFarm` |
| PATCH | `/farms/me/farms/:id` | Any signed-in user | `farm.updateMyFarm` |
| DELETE | `/farms/me/farms/:id` | Any signed-in user | `farm.deleteMyFarm` |
| POST | `/farms/me/farms/:id/reset` | Any signed-in user | `farm.resetMyFarm` |
| POST | `/farms` | super_admin, admin, program_administrator | `farm.createFarm` |
| GET | `/farms` | super_admin, admin, program_administrator | `farm.listFarms` |
| GET | `/farms/:id` | super_admin, admin, program_administrator | `farm.getFarm` |
| PATCH | `/farms/:id` | super_admin, admin, program_administrator | `farm.updateFarm` |
| GET | `/farms/:id/deletion-summary` | super_admin, admin, program_administrator | `farm.farmDeletionSummary` |
| DELETE | `/farms/:id` | super_admin, admin, program_administrator | `farm.deleteFarm` |
| POST | `/farms/:id/reset` | super_admin, admin, program_administrator | `farm.resetFarm` |

### `/fields`

Route file: `backend/src/routes/field.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/fields` | super_admin, admin, program_administrator | `field.createField` |
| GET | `/fields` | super_admin, admin, program_administrator | `field.listFields` |
| GET | `/fields/:id` | super_admin, admin, program_administrator | `field.getField` |
| PATCH | `/fields/:id` | super_admin, admin, program_administrator | `field.updateField` |
| GET | `/fields/:id/deletion-summary` | super_admin, admin, program_administrator | `field.fieldDeletionSummary` |
| DELETE | `/fields/:id` | super_admin, admin, program_administrator | `field.deleteField` |
| PUT | `/fields/:id/boundary` | super_admin, admin, program_administrator | `field.updateFieldBoundaryForStaff` |
| POST | `/fields/:id/reset` | super_admin, admin, program_administrator | `field.resetField` |
| GET | `/fields/:id/details` | Any signed-in user | `fieldDetails.getFieldDetails` |
| GET | `/fields/:id/soil` | Any signed-in user | `fieldDetails.getSoil` |
| PUT | `/fields/:id/soil` | Any signed-in user | `fieldDetails.saveSoil` |
| GET | `/fields/:id/documents` | Any signed-in user | `fieldDetails.listDocuments` |
| POST | `/fields/:id/documents` | Any signed-in user | `fieldDetails.uploadDocument` |
| DELETE | `/fields/:id/documents/:docId` | Any signed-in user | `fieldDetails.deleteDocument` |
| GET | `/fields/:id/assessment-comparison` | Any signed-in user | `fieldDetails.getAssessmentComparison` |
| GET | `/farms/:farmId/fields` | Any signed-in user | `field.myFarmFields` |
| GET | `/farms/:farmId/fields/:id` | Any signed-in user | `field.myFarmField` |
| POST | `/farms/:farmId/fields` | Any signed-in user | `field.createMyField` |
| PATCH | `/farms/:farmId/fields/:id` | Any signed-in user | `field.updateMyField` |
| DELETE | `/farms/:farmId/fields/:id` | Any signed-in user | `field.deleteMyField` |
| POST | `/farms/:farmId/fields/:id/reset` | Any signed-in user | `field.resetMyField` |
| PUT | `/farms/:farmId/fields/:id/boundary` | Any signed-in user | `field.updateMyFieldBoundary` |

### `/assessments`

Route file: `backend/src/routes/assessment.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/assessments/evidence` | Any signed-in user | `assessmentMobile.uploadEvidence` |
| GET | `/assessments/my/fields` | Any signed-in user | `assessmentMobile.myFieldsAssessmentList` |
| GET | `/assessments/my/history` | Any signed-in user | `assessmentMobile.myAssessmentHistory` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/summary` | Any signed-in user | `assessmentMobile.myFieldAssessmentSummary` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/regen-index` | Any signed-in user | `assessmentMobile.myFieldRegenIndex` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/list` | Any signed-in user | `assessmentMobile.myFieldCategoryQuestionList` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId` | Any signed-in user | `assessmentMobile.myFieldQuestionDetail` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/categories/:categoryId/questions` | Any signed-in user | `assessmentMobile.myFieldCategoryQuestions` |
| PUT | `/assessments/my/programs/:programId/fields/:fieldId/categories/:categoryId/answers` | Any signed-in user | `assessmentMobile.saveMyFieldCategoryAnswers` |
| PUT | `/assessments/my/programs/:programId/fields/:fieldId/questions/:questionId/answer` | Any signed-in user | `assessmentMobile.saveMyFieldAnswer` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/review` | Any signed-in user | `assessmentMobile.myFieldReview` |
| GET | `/assessments/my/programs/:programId/fields/:fieldId/history` | Any signed-in user | `assessmentMobile.myFieldAssessmentHistory` |
| POST | `/assessments/my/programs/:programId/fields/:fieldId/submit` | Any signed-in user | `assessmentMobile.submitMyFieldAssessment` |
| DELETE | `/assessments/my/programs/:programId/fields/:fieldId/discard` | Any signed-in user | `assessmentMobile.discardMyFieldAssessment` |
| GET | `/assessments/reviews/:id` | super_admin, admin, program_administrator | `assessmentReview.getReview` |
| PATCH | `/assessments/reviews/:id` | super_admin, admin, program_administrator | `assessmentReview.saveReviewScores` |
| POST | `/assessments/reviews/:id/approve` | super_admin, admin, program_administrator | `assessmentReview.approveReview` |
| GET | `/assessments/import-sample` | super_admin, admin, program_administrator | `assessment.downloadImportSample` |
| GET | `/assessments/templates` | super_admin, admin, program_administrator | `assessmentTemplate.listTemplates` |
| POST | `/assessments/templates` | super_admin, admin, program_administrator | `assessmentTemplate.createTemplate` |
| GET | `/assessments/templates/:id` | super_admin, admin, program_administrator | `assessmentTemplate.getTemplate` |
| PATCH | `/assessments/templates/:id` | super_admin, admin, program_administrator | `assessmentTemplate.updateTemplate` |
| DELETE | `/assessments/templates/:id` | super_admin, admin, program_administrator | `assessmentTemplate.deleteTemplate` |
| POST | `/assessments/templates/:id/global` | super_admin, admin, program_administrator | `assessmentTemplate.makeTemplateGlobal` |
| POST | `/assessments/templates/:id/lock` | super_admin, admin, program_administrator | `assessmentTemplate.lockTemplate` |
| DELETE | `/assessments/templates/:id/lock` | super_admin, admin, program_administrator | `assessmentTemplate.unlockTemplate` |
| GET | `/assessments/templates/:id/categories` | super_admin, admin, program_administrator | `assessment.listTemplateCategories` |
| POST | `/assessments/templates/:id/categories` | super_admin, admin, program_administrator | `assessment.createTemplateCategory` |
| PATCH | `/assessments/templates/:id/categories/reorder` | super_admin, admin, program_administrator | `assessment.reorderTemplateCategories` |
| PUT | `/assessments/templates/:id/categories/:categoryId/fields` | super_admin, admin, program_administrator | `assessment.saveTemplateCategoryFields` |
| GET | `/assessments/templates/:id/questions` | super_admin, admin, program_administrator | `assessment.listTemplateQuestions` |
| POST | `/assessments/templates/:id/questions` | super_admin, admin, program_administrator | `assessment.createTemplateQuestion` |
| PATCH | `/assessments/templates/:id/questions/reorder` | super_admin, admin, program_administrator | `assessment.reorderTemplateQuestions` |
| GET | `/assessments/templates/:id/questions/export` | super_admin, admin, program_administrator | `assessment.downloadTemplateQuestions` |
| POST | `/assessments/templates/import` | super_admin, admin, program_administrator | `assessment.importTemplateFromFile` |
| POST | `/assessments/templates/:id/questions/import` | super_admin, admin, program_administrator | `assessment.importTemplateQuestions` |
| GET | `/assessments/categories/:id` | super_admin, admin, program_administrator | `assessment.getCategory` |
| PATCH | `/assessments/categories/:id` | super_admin, admin, program_administrator | `assessment.updateCategory` |
| DELETE | `/assessments/categories/:id` | super_admin, admin, program_administrator | `assessment.deleteCategory` |
| GET | `/assessments/questions/:id` | super_admin, admin, program_administrator | `assessment.getQuestion` |
| PATCH | `/assessments/questions/:id` | super_admin, admin, program_administrator | `assessment.updateQuestion` |
| DELETE | `/assessments/questions/:id` | super_admin, admin, program_administrator | `assessment.deleteQuestion` |

### `/assessor-assignments`

Route file: `backend/src/routes/assessorAssignment.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/assessor-assignments` | super_admin, admin, program_administrator | `assessorAssignment.assignAssessor` |
| GET | `/assessor-assignments` | super_admin, admin, program_administrator | `assessorAssignment.listAssignments` |
| DELETE | `/assessor-assignments/:id` | super_admin, admin, program_administrator | `assessorAssignment.unassignAssessor` |

### `/assessor`

Route file: `backend/src/routes/assessorAssessment.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/assessor/fields` | assessor | `assessorAssessment.myAssessorFields` |
| GET | `/assessor/programs/:programId/fields/:fieldId/summary` | assessor | `assessorAssessment.assessorSummary` |
| GET | `/assessor/programs/:programId/fields/:fieldId/categories/:categoryId/questions/list` | assessor | `assessorAssessment.assessorCategoryQuestionList` |
| GET | `/assessor/programs/:programId/fields/:fieldId/categories/:categoryId/questions/:questionId` | assessor | `assessorAssessment.assessorQuestionDetail` |
| GET | `/assessor/programs/:programId/fields/:fieldId/categories/:categoryId/questions` | assessor | `assessorAssessment.assessorCategoryQuestions` |
| PUT | `/assessor/programs/:programId/fields/:fieldId/categories/:categoryId/answers` | assessor | `assessorAssessment.saveAssessorCategoryAnswers` |
| PUT | `/assessor/programs/:programId/fields/:fieldId/questions/:questionId/answer` | assessor | `assessorAssessment.saveAssessorAnswer` |
| GET | `/assessor/programs/:programId/fields/:fieldId/review` | assessor | `assessorAssessment.assessorReview` |
| POST | `/assessor/programs/:programId/fields/:fieldId/submit` | assessor | `assessorAssessment.submitAssessorAssessment` |
| GET | `/assessor/programs/:programId/fields/:fieldId/farmer-assessment` | assessor | `assessorAssessment.farmerAssessment` |
| GET | `/assessor/programs/:programId/fields/:fieldId/comparison` | assessor | `assessorAssessment.comparison` |

### `/programs`

Route file: `backend/src/routes/program.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/programs/my/available` | farmer | `program.myAvailablePrograms` |
| GET | `/programs/my/fields` | farmer | `program.myEnrollableFields` |
| POST | `/programs/:id/enroll-self` | farmer | `program.selfEnroll` |
| DELETE | `/programs/:id/fields/:fieldId/unenroll` | farmer | `program.selfUnenrollField` |
| GET | `/programs/submissions` | super_admin, admin, program_administrator | `program.listSubmissions` |
| GET | `/programs/code-suggestion` | super_admin, admin, program_administrator | `program.suggestCode` |
| POST | `/programs` | super_admin, admin, program_administrator | `program.createProgram` |
| GET | `/programs` | super_admin, admin, program_administrator | `program.listPrograms` |
| GET | `/programs/:id` | super_admin, admin, program_administrator | `program.getProgram` |
| PATCH | `/programs/:id` | super_admin, admin, program_administrator | `program.updateProgram` |
| PATCH | `/programs/:id/visibility` | super_admin, admin, program_administrator | `program.setProgramVisibility` |
| GET | `/programs/:id/deletion-summary` | super_admin, admin, program_administrator | `program.programDeletionSummary` |
| DELETE | `/programs/:id` | super_admin, admin, program_administrator | `program.deleteProgram` |
| GET | `/programs/:id/enrollments` | super_admin, admin, program_administrator | `program.listEnrollments` |
| GET | `/programs/:id/enrollments/paged` | super_admin, admin, program_administrator | `program.listEnrollmentsPaged` |
| POST | `/programs/:id/enrollments` | super_admin, admin, program_administrator | `program.enrollFarmer` |
| PATCH | `/programs/:id/enrollments/:enrollmentId` | super_admin, admin, program_administrator | `program.updateEnrollmentFields` |
| PUT | `/programs/:id/enrollments/:enrollmentId/assessor` | super_admin, admin, program_administrator | `program.setEnrollmentAssessor` |
| GET | `/programs/:id/enrollments/:enrollmentId/assessments` | super_admin, admin, program_administrator | `program.getEnrollmentAssessments` |
| GET | `/programs/:id/assessment-progress` | super_admin, admin, program_administrator | `program.getProgramProgress` |
| DELETE | `/programs/:id/enrollments/:enrollmentId` | super_admin, admin, program_administrator | `program.unenroll` |

### `/dashboard`

Route file: `backend/src/routes/dashboard.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/dashboard/admin` | super_admin, admin | `dashboard.adminDashboard` |
| GET | `/dashboard/programs` | super_admin, admin, program_administrator | `dashboard.programDashboard` |
| GET | `/dashboard/my/farms` | farmer | `dashboard.myDashboardFarms` |
| GET | `/dashboard/my/farms/:farmId` | farmer | `dashboard.farmDashboard` |
| GET | `/dashboard/my/farms/:farmId/summary` | farmer | `dashboard.farmSummary` |
| GET | `/dashboard/my/programs` | farmer | `dashboard.myDashboardPrograms` |
| GET | `/dashboard/my/programs/:programId/summary` | farmer | `dashboard.programSummary` |

### `/visits`

Route file: `backend/src/routes/visit.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/visits/active` | super_admin, admin | `visit.listActiveVisits` |
| GET | `/visits/mine/assessor` | assessor | `visit.myAssessorVisit` |
| GET | `/visits/mine/farmer` | farmer | `visit.myFarmerVisit` |
| POST | `/visits` | assessor | `visit.startVisit` |
| POST | `/visits/:id/location` | assessor | `visit.pushLocation` |
| POST | `/visits/:id/arrive` | assessor | `visit.arriveVisit` |
| POST | `/visits/:id/end` | assessor | `visit.endVisit` |
| GET | `/visits/:id/track` | Any signed-in user | `visit.getVisitTrack` |
| GET | `/visits/:id` | Any signed-in user | `visit.getVisit` |

### `/field-monitoring`

Route file: `backend/src/routes/fieldModule.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/field-monitoring/farms/:farmId/fields` | farmer, super_admin, admin, program_administrator | `fieldModule.getFarmFields` |
| GET | `/field-monitoring/farms/:farmId/modules` | farmer, super_admin, admin, program_administrator | `fieldModule.getFarmModules` |
| GET | `/field-monitoring/farms/:farmId/modules/:module` | farmer, super_admin, admin, program_administrator | `fieldModule.listFarmModuleRecords` |
| GET | `/field-monitoring/fields/:fieldId/modules` | farmer, super_admin, admin, program_administrator | `fieldModule.getModules` |
| GET | `/field-monitoring/fields/:fieldId/modules/:module` | farmer, super_admin, admin, program_administrator | `fieldModule.listModuleRecords` |
| POST | `/field-monitoring/fields/:fieldId/modules/:module` | farmer, super_admin, admin, program_administrator | `fieldModule.createModuleRecord` |
| GET | `/field-monitoring/fields/:fieldId/modules/:module/:id` | farmer, super_admin, admin, program_administrator | `fieldModule.getModuleRecord` |
| PATCH | `/field-monitoring/fields/:fieldId/modules/:module/:id` | farmer, super_admin, admin, program_administrator | `fieldModule.updateModuleRecord` |
| DELETE | `/field-monitoring/fields/:fieldId/modules/:module/:id` | farmer, super_admin, admin, program_administrator | `fieldModule.deleteModuleRecord` |
| GET | `/field-monitoring/fields/:fieldId/documents` | farmer, super_admin, admin, program_administrator | `fieldModule.listModuleDocuments` |
| POST | `/field-monitoring/fields/:fieldId/documents` | farmer, super_admin, admin, program_administrator | `fieldModule.createModuleDocument` |
| POST | `/field-monitoring/fields/:fieldId/documents/upload` | farmer, super_admin, admin, program_administrator | `fieldModule.uploadModuleDocument` |
| DELETE | `/field-monitoring/fields/:fieldId/documents/:documentId` | farmer, super_admin, admin, program_administrator | `fieldModule.deleteModuleDocument` |

### `/notifications`

Route file: `backend/src/routes/notification.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/notifications/unread-count` | Any signed-in user | `notification.unreadCount` |
| PATCH | `/notifications/read-all` | Any signed-in user | `notification.markAllRead` |
| GET | `/notifications` | Any signed-in user | `notification.listNotifications` |
| POST | `/notifications/delete` | Any signed-in user | `notification.deleteMany` |
| DELETE | `/notifications` | Any signed-in user | `notification.deleteAll` |
| PATCH | `/notifications/:id/read` | Any signed-in user | `notification.markRead` |
| DELETE | `/notifications/:id` | Any signed-in user | `notification.deleteOne` |

### `/faqs`

Route file: `backend/src/routes/faq.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/faqs` | Public | `faq.publicFaqs` |
| GET | `/faqs/manage` | super_admin, admin | `faq.listFaqs` |
| PATCH | `/faqs/reorder` | super_admin, admin | `faq.reorderFaqs` |
| POST | `/faqs` | super_admin, admin | `faq.createFaq` |
| GET | `/faqs/:id` | super_admin, admin | `faq.getFaq` |
| PATCH | `/faqs/:id` | super_admin, admin | `faq.updateFaq` |
| DELETE | `/faqs/:id` | super_admin, admin | `faq.deleteFaq` |

### `/contact-enquiries`

Route file: `backend/src/routes/contactEnquiry.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/contact-enquiries` | Public | `contactEnquiry.submitEnquiry` |
| GET | `/contact-enquiries` | super_admin, admin, program_administrator | `contactEnquiry.listEnquiries` |
| POST | `/contact-enquiries/bulk-delete` | super_admin, admin | `contactEnquiry.bulkDeleteEnquiries` |
| GET | `/contact-enquiries/:id` | super_admin, admin, program_administrator | `contactEnquiry.getEnquiry` |
| PATCH | `/contact-enquiries/:id/read` | super_admin, admin | `contactEnquiry.setEnquiryRead` |
| PATCH | `/contact-enquiries/:id/resolve` | super_admin, admin, program_administrator | `contactEnquiry.setEnquiryResolved` |
| POST | `/contact-enquiries/:id/reply` | super_admin, admin | `contactEnquiry.replyToEnquiry` |
| POST | `/contact-enquiries/:id/reply/preview` | super_admin, admin | `contactEnquiry.previewEnquiryReply` |
| DELETE | `/contact-enquiries/:id` | super_admin, admin | `contactEnquiry.deleteEnquiry` |

### `/program-admin-surveys`

Route file: `backend/src/routes/programAdminSurvey.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| GET | `/program-admin-surveys/templates` | super_admin, admin, program_administrator | `programAdminSurvey.listTemplates` |
| POST | `/program-admin-surveys/templates` | super_admin, admin, program_administrator | `programAdminSurvey.createTemplate` |
| GET | `/program-admin-surveys/templates/:id` | super_admin, admin, program_administrator | `programAdminSurvey.getTemplate` |
| PATCH | `/program-admin-surveys/templates/:id` | super_admin, admin, program_administrator | `programAdminSurvey.updateTemplate` |
| GET | `/program-admin-surveys/templates/:id/deletion-summary` | super_admin, admin, program_administrator | `programAdminSurvey.templateDeletionSummary` |
| DELETE | `/program-admin-surveys/templates/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteTemplate` |
| POST | `/program-admin-surveys/templates/:id/global` | super_admin, admin, program_administrator | `programAdminSurvey.makeTemplateGlobal` |
| POST | `/program-admin-surveys/templates/:templateId/categories` | super_admin, admin, program_administrator | `programAdminSurvey.createCategory` |
| POST | `/program-admin-surveys/templates/:templateId/questions` | super_admin, admin, program_administrator | `programAdminSurvey.createQuestion` |
| PATCH | `/program-admin-surveys/templates/:templateId/scoring-rules/:ruleId` | super_admin, admin, program_administrator | `programAdminSurvey.updateScoringRule` |
| PATCH | `/program-admin-surveys/categories/:id` | super_admin, admin, program_administrator | `programAdminSurvey.updateCategory` |
| DELETE | `/program-admin-surveys/categories/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteCategory` |
| PATCH | `/program-admin-surveys/questions/:id` | super_admin, admin, program_administrator | `programAdminSurvey.updateQuestion` |
| DELETE | `/program-admin-surveys/questions/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteQuestion` |
| GET | `/program-admin-surveys/programs` | super_admin, admin, program_administrator | `programAdminSurvey.listPrograms` |
| POST | `/program-admin-surveys/programs` | super_admin, admin, program_administrator | `programAdminSurvey.createProgram` |
| GET | `/program-admin-surveys/programs/:id` | super_admin, admin, program_administrator | `programAdminSurvey.getProgram` |
| PATCH | `/program-admin-surveys/programs/:id` | super_admin, admin, program_administrator | `programAdminSurvey.updateProgram` |
| DELETE | `/program-admin-surveys/programs/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteProgram` |
| POST | `/program-admin-surveys/programs/:id/share` | super_admin, admin, program_administrator | `programAdminSurvey.shareProgram` |
| POST | `/program-admin-surveys/programs/:id/lock` | super_admin, admin, program_administrator | `programAdminSurvey.lockProgramSurvey` |
| DELETE | `/program-admin-surveys/programs/:id/lock` | super_admin, admin, program_administrator | `programAdminSurvey.unlockProgramSurvey` |
| GET | `/program-admin-surveys/contracts` | super_admin, admin, program_administrator | `programAdminSurvey.listContractTemplates` |
| POST | `/program-admin-surveys/contracts` | super_admin, admin | `programAdminSurvey.createContractTemplate` |
| POST | `/program-admin-surveys/contracts/upload` | super_admin, admin, program_administrator | `programAdminSurvey.uploadContractTemplate` |
| GET | `/program-admin-surveys/contracts/:id` | super_admin, admin, program_administrator | `programAdminSurvey.getContractTemplate` |
| GET | `/program-admin-surveys/contracts/:id/pdf` | super_admin, admin, program_administrator | `programAdminSurvey.getContractTemplatePdf` |
| PATCH | `/program-admin-surveys/contracts/:id` | super_admin, admin | `programAdminSurvey.updateContractTemplate` |
| DELETE | `/program-admin-surveys/contracts/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteContractTemplate` |
| POST | `/program-admin-surveys/contracts/:id/global` | super_admin, admin | `programAdminSurvey.makeContractTemplateGlobal` |
| GET | `/program-admin-surveys/submissions` | super_admin, admin, program_administrator | `programAdminSurvey.listSubmissions` |
| GET | `/program-admin-surveys/submissions/stats` | super_admin, admin, program_administrator | `programAdminSurvey.submissionStats` |
| GET | `/program-admin-surveys/submissions/:id` | super_admin, admin, program_administrator | `programAdminSurvey.getSubmission` |
| GET | `/program-admin-surveys/submissions/:id/signed-pdf` | super_admin, admin, program_administrator | `programAdminSurvey.getSignedContractPdf` |
| PATCH | `/program-admin-surveys/submissions/:id/category` | super_admin, admin, program_administrator | `programAdminSurvey.setCategory` |
| POST | `/program-admin-surveys/submissions/:id/send-contract` | super_admin, admin, program_administrator | `programAdminSurvey.sendContract` |
| POST | `/program-admin-surveys/submissions/:id/accept` | super_admin, admin, program_administrator | `programAdminSurvey.acceptAndEnroll` |
| POST | `/program-admin-surveys/submissions/:id/withdraw` | super_admin, admin, program_administrator | `programAdminSurvey.withdrawSubmission` |
| DELETE | `/program-admin-surveys/submissions/:id` | super_admin, admin, program_administrator | `programAdminSurvey.deleteSubmission` |

### `/program-admin-survey`

Route file: `backend/src/routes/programAdminSurveyPublic.routes.ts`

| Method | Path | Who can call | Handler |
|---|---|---|---|
| POST | `/program-admin-survey/send-otp` | Public | `programAdminSurveyPublic.sendOtp` |
| POST | `/program-admin-survey/verify-otp` | Public | `programAdminSurveyPublic.verifyOtp` |
| GET | `/program-admin-survey/status/:token` | Public | `programAdminSurveyPublic.status` |
| GET | `/program-admin-survey/contract/:token` | Public | `programAdminSurveyPublic.getContract` |
| GET | `/program-admin-survey/contract/:token/pdf` | Public | `programAdminSurveyPublic.getContractPdf` |
| POST | `/program-admin-survey/contract/:token/sign` | Public | `programAdminSurveyPublic.signContract` |
| GET | `/program-admin-survey/:token/structure` | Public | `programAdminSurveyPublic.structure` |
| POST | `/program-admin-survey/:token/check-email` | Public | `programAdminSurveyPublic.checkEmail` |
| POST | `/program-admin-survey/:token/save-draft` | Public | `programAdminSurveyPublic.saveDraft` |
| POST | `/program-admin-survey/:token/submit` | Public | `programAdminSurveyPublic.submit` |

---

## 5. Backend file atlas

### 5.1 Folders

| Folder | Files | What is inside |
|---|---:|---|
| `backend/src/` (root) | 2 | `app.ts`, `server.ts` |
| `backend/src/config/` | 4 | Environment, Cloudinary, uploads, roles |
| `backend/src/middlewares/` | 7 | Authentication, validation, uploads, rate limits, errors |
| `backend/src/routes/` | 24 | 23 route files and the registry `index.ts` |
| `backend/src/controllers/` | 27 | One per area |
| `backend/src/services/` | 35 | Business rules |
| `backend/src/models/` | 30 | Queries |
| `backend/src/validators/` | 20 | Zod schemas |
| `backend/src/socket/` | 4 | Socket.IO |
| `backend/src/db/` | 10 (+67 SQL) | Clients, seeds, migration runner, migrations |
| `backend/src/utils/` | 11 | Helpers |
| `backend/src/types/` | 1 | Shared types |

Files outside `src/`:

| File | Purpose |
|---|---|
| `backend/package.json` | Scripts: `dev` (tsx watch), `build` (prisma generate and tsc), `start`, `typecheck`, `db:check`, `db:clock` |
| `backend/tsconfig.json` | TypeScript config (strict, ES modules) |
| `backend/Dockerfile`, `.dockerignore` | Two stage build on Node 22 Alpine. Production stage runs `node dist/server.js`. |
| `backend/.env.example` | Every environment variable, with comments |
| `backend/prisma/schema.prisma` | The 56 models |
| `backend/prisma/sql/` | SQL that Prisma cannot express, and the rollback for migration 059 |
| `backend/hoppscotch/` | The Hoppscotch master collection and environment (all endpoints), plus short README notes per feature. |
| `backend/postman/` | The Postman master collection and environment (all endpoints), the script that builds both master collections, and the README |
| `backend/email-preview.html` | Static preview of the email layout |
| `backend/PRODUCTION-MIGRATION-019-020.sql`, `RECOVER-dropped-tables.sql` | One time production scripts |
| `backend/README.md` | Older backend notes |
| `backend/SOCKETS.md` | Live updates (Socket.IO): how it works, every message, how to try it |

### 5.2 Which files serve which route file

The files involved for each route file, read from the imports. Controllers call services; services call models and other services (notifications, realtime, mailer, upload). Open the route file first, then follow the names.

| Route file | Controllers | Services | Models | Validators |
|---|---|---|---|---|
| `assessment` | `assessmentMobile`, `assessmentReview`, `assessmentTemplate`, `assessment` | `assessmentImport`, `assessmentMobile`, `assessmentReview`, `assessmentTemplate`, `assessment`, `upload` | `assessmentMobile`, `assessmentReview`, `assessmentTemplate`, `assessment` | `assessment`, `pagination` |
| `assessorAssessment` | `assessorAssessment` | `assessorAssessment` | `assessmentMobile` | `assessment` |
| `assessorAssignment` | `assessorAssignment` | `assessorAssignment` | `assessorAssignment`, `user` | `assessorAssignment` |
| `auth` | `auth` | `auth`, `user` | `assessorAssignment`, `enrollmentId`, `loginLog`, `otp`, `refreshToken`, `user` | `auth` |
| `config` | `config` | - | `organization` | - |
| `contactEnquiry` | `contactEnquiry` | `contactEnquiry` | `contactEnquiry` | `common`, `contactEnquiry` |
| `dashboard` | `dashboard` | `adminDashboard`, `dashboard` | `adminDashboard`, `dashboard` | `pagination` |
| `emailSettings` | `emailSettings` | `emailSettings`, `emailTemplates`, `mailer` | `emailSettings` | `emailSettings` |
| `faq` | `faq` | `faq` | `faq` | `common`, `faq` |
| `farm` | `farm` | `farm` | `farm`, `organization`, `user` | `common`, `farm` |
| `field` | `fieldDetails`, `field` | `fieldDetails`, `field`, `upload` | `assessmentMobile`, `farm`, `fieldDetails`, `field` | `common`, `fieldDetails`, `field` |
| `fieldModule` | `fieldModule` | `fieldModule`, `upload` | `fieldModuleDocument`, `fieldModule` | `fieldModule` |
| `health` | `health` | - | - | - |
| `loginLog` | `loginLog` | - | `loginLog` | - |
| `notification` | `notification` | `notification` | `notification` | `notification` |
| `organization` | `organization` | `organization` | `organization`, `user` | `common`, `org` |
| `profile` | `profile` | `user` | `assessorAssignment`, `organization`, `refreshToken`, `user` | `user` |
| `program` | `program` | `program` | `assessmentMobile`, `assessmentTemplate`, `assessorAssignment`, `enrollmentId`, `program`, `user` | `pagination`, `program` |
| `programAdminSurvey` | `programAdminSurvey` | `contractPdf`, `programAdminContractTemplate`, `programAdminSurveyTemplate`, `programAdminSurvey`, `upload` | `enrollmentId`, `organization`, `otp`, `programAdminContractTemplate`, `programAdminSurveyTemplate`, `programAdminSurvey`, `program`, `user`, `websiteUser` | `common`, `programAdminSurvey` |
| `programAdminSurveyPublic` | `programAdminSurveyPublic` | `contractPdf`, `programAdminSurvey`, `upload` | `enrollmentId`, `organization`, `otp`, `programAdminSurveyTemplate`, `programAdminSurvey`, `program`, `user`, `websiteUser` | `programAdminSurvey`, `standalone`, `contract` |
| `role` | `role` | - | `role` | - |
| `user` | `user` | `user` | `assessorAssignment`, `refreshToken`, `user` | `common`, `user` |
| `visit` | `visit` | `visit` | `assessmentMobile`, `field`, `visit` | `visit` |

### 5.3 Every backend file

Line counts are lines in the file. All paths are under `backend/src/`.

#### `backend/src/`

| File | Lines | What it does |
|---|---:|---|
| `app.ts` | 70 | Express app: security headers, CORS, JSON body limit (1 MB), compression, request logging, global rate limit, API routes, 404 and error handlers. |
| `server.ts` | 132 | Process entry: database connection with retry, optional migrations and seed, global template seeding, HTTP server, Socket.IO, 15 minute visit housekeeping, graceful shutdown. |

#### `backend/src/config/`

| File | Lines | What it does |
|---|---:|---|
| `cloudinary.ts` | 12 | Cloudinary SDK setup from environment variables. |
| `env.ts` | 157 | Reads every environment variable once and exposes one typed config object (server, database, JWT, OTP, SMTP, public URLs, rate limit, super admin bootstrap, visit geofence). |
| `multer.ts` | 123 | Upload middleware and presets: Excel (5 MB), evidence photos and videos (up to 5 files), avatar (5 MB), documents (10 MB). |
| `rbac.ts` | 77 | The six role names, which role may create which, role ranking, and the manager and admin role lists used by route gates. |

#### `backend/src/controllers/`

| File | Lines | What it does |
|---|---:|---|
| `assessment.controller.ts` | 194 | Template categories, questions and category forms (admin). |
| `assessmentMobile.controller.ts` | 239 | Farmer assessment endpoints: list, summary, regen index, questions, save answers, review, history, submit, discard. |
| `assessmentReview.controller.ts` | 36 | Admin review of a submitted assessment: open, save scores, approve. |
| `assessmentTemplate.controller.ts` | 55 | Template CRUD, make global, lock and unlock. |
| `assessorAssessment.controller.ts` | 128 | Assessor assessment endpoints. |
| `assessorAssignment.controller.ts` | 35 | Assign, list and remove assessor assignments. |
| `auth.controller.ts` | 163 | Auth endpoints. Returns the OTP in the response only while SMTP is off. |
| `config.controller.ts` | 32 | Public branding, locale and contact config. |
| `contactEnquiry.controller.ts` | 98 | Contact enquiries. |
| `dashboard.controller.ts` | 82 | Dashboards for admin, programs and farmers. |
| `emailSettings.controller.ts` | 46 | Email settings and test send. |
| `faq.controller.ts` | 55 | FAQs. |
| `farm.controller.ts` | 117 | Farms for staff and for the signed-in farmer. |
| `field.controller.ts` | 144 | Fields for staff and for the signed-in farmer, including boundary. |
| `fieldDetails.controller.ts` | 94 | Field overview, soil, documents and assessment comparison. |
| `fieldModule.controller.ts` | 218 | Field monitoring modules, records and documents. |
| `health.controller.ts` | 32 | Health checks. |
| `loginLog.controller.ts` | 22 | Login activity. |
| `notification.controller.ts` | 73 | Notifications. |
| `organization.controller.ts` | 49 | The organization's details, logo and favicon. |
| `profile.controller.ts` | 59 | Own profile, avatar, password, account deletion. |
| `program.controller.ts` | 278 | Programs and enrollments. |
| `programAdminSurvey.controller.ts` | 452 | Admin survey module: templates, programs, contracts, submissions. |
| `programAdminSurveyPublic.controller.ts` | 155 | Public survey flow by link token. |
| `role.controller.ts` | 9 | Roles. |
| `user.controller.ts` | 102 | Users looked after by staff. |
| `visit.controller.ts` | 106 | Visits. Pushes live updates over the socket. |

#### `backend/src/db/`

| File | Lines | What it does |
|---|---:|---|
| `applyClock.ts` | 38 | Script (npm run db:clock): applies the organization timezone in the database and shows how stored data now reads. |
| `healthcheck.ts` | 16 | Script (npm run db:check): checks the database connection. |
| `pool.ts` | 67 | pg connection pool: typed query, transaction helper, connection check. |
| `prisma.ts` | 19 | Shared Prisma client. |
| `seed.ts` | 74 | Baseline seed: roles, super admin, starter FAQs. Runs when DB_SEED is true. |
| `seedContactEnquiries.ts` | 205 | Sample contact enquiries for checking the admin screen. |
| `seedFaqs.ts` | 167 | Starter help questions for the mobile Help screen. |
| `seedProgramAdminGlobal.ts` | 174 | Idempotent seed of the global survey template and global contract template. |
| `softDelete.ts` | 85 | softDelete, restore, hardDelete and the alive-rows clause for the tables that use deleted_at. |
| `sync.ts` | 62 | Migration runner: applies pending SQL files from db/migrations and records them. |

#### `backend/src/middlewares/`

| File | Lines | What it does |
|---|---:|---|
| `authenticate.ts` | 70 | authenticate checks the Bearer token and re-checks the account on every request; authorize(...roles) is the role gate. |
| `errorHandler.ts` | 209 | Turns every thrown error (ApiError, Zod, Postgres, Multer) into the standard error JSON. Hides internals in production. |
| `handleUpload.ts` | 21 | Wraps a Multer middleware so upload failures become clean 400 errors. |
| `liveChanges.ts` | 55 | After a successful write on the routes that feed the admin panel, tells the panels to reload that data. |
| `notFound.ts` | 9 | 404 handler for unknown routes. |
| `rateLimiters.ts` | 122 | Named rate limiters: login, enrollment lookup, code attempts, code requests, forgot password, email check, import, contact form, survey submit. |
| `validate.ts` | 64 | validate(schema, part) runs a Zod schema on body, query or params; validateWith picks the schema from the request (used for monitoring modules). |

#### `backend/src/models/`

| File | Lines | What it does |
|---|---:|---|
| `adminDashboard.model.ts` | 314 | Queries for admin KPIs, acreage over time, program split, assessment trends, benchmarking. |
| `assessment.model.ts` | 676 | Template categories and questions: queries and writes, options, category forms. |
| `assessmentMobile.model.ts` | 1428 | Farmer and assessor assessment queries: owned field, list, summary, category scores, questions, answers, review rows, history, submit. |
| `assessmentReview.model.ts` | 246 | Review queries: submitted assessment, save review scores, score limits, approve. |
| `assessmentTemplate.model.ts` | 341 | Templates: find, list, create, copy contents, lock, counts. |
| `assessorAssignment.model.ts` | 193 | Assessor assignment queries. |
| `contactEnquiry.model.ts` | 231 | Contact enquiry and reply queries. |
| `dashboard.model.ts` | 725 | Farmer dashboard queries: farms, category scores, program summaries. |
| `eligibility.model.ts` | 11 | Finds the submission a survey status link belongs to. |
| `emailSettings.model.ts` | 90 | The single email settings row. |
| `enrollmentId.model.ts` | 228 | Enrollment IDs: find who holds one, by email, by program, generate a new unused one. |
| `faq.model.ts` | 155 | FAQ queries. |
| `farm.model.ts` | 315 | Farm queries. |
| `field.model.ts` | 384 | Field queries, including boundary writes. |
| `fieldDetails.model.ts` | 329 | Soil and document queries, soil lock rule. |
| `fieldModule.model.ts` | 428 | Registry of the 11 monitoring modules (table per module) and generic record queries. |
| `fieldModuleDocument.model.ts` | 163 | Attachments of monitoring records and modules. |
| `loginLog.model.ts` | 59 | Login log writes and list. |
| `notification.model.ts` | 243 | Notification types, redirect targets and queries. |
| `organization.model.ts` | 179 | Organization queries, branding and locale. |
| `otp.model.ts` | 47 | OTP code create, find, consume. |
| `program.model.ts` | 988 | Program, enrollment and field enrollment queries. |
| `programAdminContractTemplate.model.ts` | 206 | Contract template queries. |
| `programAdminSurvey.model.ts` | 738 | Survey per program, submissions, contracts and statistics. |
| `programAdminSurveyTemplate.model.ts` | 620 | Survey template, categories, questions, scoring rules. |
| `refreshToken.model.ts` | 50 | Refresh tokens: create, find, revoke. |
| `role.model.ts` | 28 | Roles allowed for self sign up. |
| `user.model.ts` | 397 | User queries: by email, by id, auth status, create, update, list. |
| `visit.model.ts` | 343 | Visit queries: active, board, create, locations, arrival. |
| `websiteUser.model.ts` | 72 | Producer accounts used by the program survey: create, find by email, update details. |

#### `backend/src/routes/`

| File | Lines | What it does |
|---|---:|---|
| `assessment.routes.ts` | 237 | Assessments: farmer flow (/my/...), review, templates, categories, questions, import and export. |
| `assessorAssessment.routes.ts` | 98 | Assessor flow: fields, categories, questions, answers, review, submit, farmer view, comparison. |
| `assessorAssignment.routes.ts` | 36 | Assign an assessor to a farmer (older assignment model). |
| `auth.routes.ts` | 104 | Register, login, OTP, refresh, logout, forgot and reset password, email check, Enrollment ID lookup. |
| `config.routes.ts` | 9 | Public config: branding, locale, contact details. |
| `contactEnquiry.routes.ts` | 57 | Contact form (public) and the admin inbox: list, read, resolve, reply, delete. |
| `dashboard.routes.ts` | 91 | Admin and program dashboards, plus the farmer dashboards used by the mobile home screen. |
| `emailSettings.routes.ts` | 25 | Email provider settings and test send. |
| `faq.routes.ts` | 40 | Public FAQ list and admin FAQ management. |
| `farm.routes.ts` | 90 | Farms (staff and own farms) and mounts the mobile field router at /farms/:farmId/fields. |
| `field.routes.ts` | 178 | Fields for staff, field details, soil, documents, boundary, and the farmer field router. |
| `fieldModule.routes.ts` | 165 | Field monitoring: modules, records and documents per field or per farm. |
| `health.routes.ts` | 11 | Health and database health. |
| `index.ts` | 61 | Registers every route file under the API prefix. |
| `loginLog.routes.ts` | 10 | Login activity list. |
| `notification.routes.ts` | 41 | Notification list, unread count, read, delete. |
| `organization.routes.ts` | 41 | The organization's details, logo and favicon. |
| `profile.routes.ts` | 41 | My profile, avatar, organization, change password, delete account. |
| `program.routes.ts` | 205 | Programs, enrollments, self enrollment, assessor per enrollment, progress, visibility. |
| `programAdminSurvey.routes.ts` | 187 | Admin side of the program survey: templates, programs, contracts, submissions. |
| `programAdminSurveyPublic.routes.ts` | 81 | Public survey by link token: OTP, structure, draft, submit, status, contract signing. |
| `role.routes.ts` | 9 | Roles list for self sign up. |
| `user.routes.ts` | 50 | User CRUD, status, assessor assignment. |
| `visit.routes.ts` | 71 | Visit tracking: start, location, arrive, end, track, active list. |

#### `backend/src/services/`

| File | Lines | What it does |
|---|---:|---|
| `adminDashboard.service.ts` | 148 | Builds the admin dashboard and the program dashboard from the dashboard model. |
| `assessment.service.ts` | 580 | Template categories and questions: add, edit, remove, reorder, category forms, import and export of questions. |
| `assessmentAnswer.ts` | 189 | How an answer is stored and scored for each question type (scored, mcq, text, long text, number, date, boolean). |
| `assessmentImport.ts` | 803 | Reads and writes assessment spreadsheets: import templates and forms, export questions, downloadable sample file. |
| `assessmentMobile.service.ts` | 1171 | Farmer assessment logic: list, summary, regen health index, category questions, save answers, review, history, submit, discard, write gate. |
| `assessmentReview.service.ts` | 239 | Admin review: open a submitted assessment, score by answer, by category or as a whole, approve. Admins see all programs, program administrators their own. |
| `assessmentTemplate.service.ts` | 266 | Template rules: visibility, copy, make global, lock, who may edit what. |
| `assessorAssessment.service.ts` | 603 | Assessor logic: field list, summary, questions, answers, review, submit, farmer assessment view, comparison. |
| `assessorAssignment.service.ts` | 113 | Assign and remove assessors (farmer level). |
| `auth.service.ts` | 512 | Register with Enrollment ID, login, OTP, verify, refresh, forgot and reset password, email availability, first sign in with temporary password. |
| `cascadeDelete.service.ts` | 577 | What gets deleted with a program, user, survey, farm, field or template, with a summary before and the delete itself. |
| `clock.service.ts` | 146 | Applies the chosen timezone and clock everywhere, including database time helpers. |
| `contactEnquiry.service.ts` | 225 | Contact enquiries: submit, list, read, resolve, reply by email, delete. |
| `contractPdf.service.ts` | 1049 | Builds contract PDFs and the signed copy (signature, date, IP) with pdf-lib. |
| `dashboard.service.ts` | 443 | Farmer dashboards: farms, per farm, per program, summaries. |
| `emailSettings.service.ts` | 229 | Email provider settings (SMTP and API provider), encrypted secrets, cache, test send. |
| `emailTemplates.ts` | 905 | Every email the platform sends, as HTML and text: verify, sign in code, survey OTP, reset, welcome, program, assessment, contract, enrollment. |
| `faq.service.ts` | 107 | FAQs: public list, admin list, add, edit, remove, reorder. |
| `farm.service.ts` | 381 | Farm rules and ownership; syncs changes to the owner devices and admin lists. |
| `field.service.ts` | 415 | Field rules and ownership, boundary save, acreage from boundary. |
| `fieldDetails.service.ts` | 392 | Field overview, activity, soil (with lock rule), documents, and the farmer and assessor comparison with every answer written out. |
| `fieldModule.service.ts` | 396 | Field monitoring rules: who may touch a field, records, documents, farm wide lists. |
| `mailer.service.ts` | 354 | Sends email through the configured provider, with fallback, and prints codes to the terminal when SMTP is off. |
| `notification.service.ts` | 218 | Creates notifications for a user, several users or all org managers, and sends the matching email. |
| `organization.service.ts` | 123 | The organization's details, branding, timezone. |
| `program.service.ts` | 1227 | Programs and enrollments: create, edit, visibility, enroll, self enroll, assessor per enrollment, progress, closing rules. |
| `programAdminContractTemplate.service.ts` | 230 | Contract templates: list, add, upload PDF, edit, remove, make global. |
| `programAdminSurvey.service.ts` | 1238 | Survey per program: link, public flow, OTP, draft, submit, scoring, contract, accept and enroll, lock. |
| `programAdminSurveyTemplate.service.ts` | 472 | Survey templates: visibility, copy, make global, categories, questions, scoring rules. |
| `realtime.service.ts` | 107 | Broadcast to admins or users that a resource changed (enrollments, submissions, visits, programs and more). |
| `tenancy.service.ts` | 11 | Finds the one organization the platform runs for. |
| `upload.service.ts` | 304 | Uploads to Cloudinary: evidence, avatar, branding, signature, monitoring files, contract PDFs, documents. |
| `user.service.ts` | 401 | Users: create with temporary password, list, edit, status, assessor options, assign assessor. |
| `visit.service.ts` | 427 | Visits: start, location, arrival geofence check, finish, track, housekeeping. |

#### `backend/src/socket/`

| File | Lines | What it does |
|---|---:|---|
| `index.ts` | 145 | Socket.IO server: authenticates app users and survey link tokens; joins rooms user:<id>, admins, submission:<id>. |
| `liveSync.ts` | 53 | emitSync: tells every device of one user that a resource changed so it refetches. |
| `notification.socket.ts` | 51 | Socket events for the notification bell: unread count, mark read, mark all read. |
| `visit.socket.ts` | 139 | Socket events for live visits: join a visit room, location updates, status changes. |

#### `backend/src/types/`

| File | Lines | What it does |
|---|---:|---|
| `index.ts` | 162 | Shared TypeScript types: env, API errors, roles, users, login logs, request user. |

#### `backend/src/utils/`

| File | Lines | What it does |
|---|---:|---|
| `ApiError.ts` | 84 | Error class with factories: badRequest, validation, unauthorized, forbidden, notFound, conflict, unprocessable, internal. |
| `ApiResponse.ts` | 44 | Success envelope: { success, message, data, meta }. |
| `asyncHandler.ts` | 16 | Wraps async controllers so a rejected promise reaches the error handler. |
| `datetime.ts` | 92 | The one platform clock: organization timezone and 12h/24h format, today in the org timezone, date formatting. |
| `geo.ts` | 146 | Geometry helpers: haversine distance, point in polygon, distance to polygon, polygon area in m2 and acres, self crossing check. |
| `jwt.ts` | 20 | Sign and verify access tokens. |
| `logger.ts` | 48 | Small structured logger. |
| `mask.ts` | 38 | Masks email and phone shown before someone has proved who they are. |
| `otp.ts` | 16 | Generates numeric OTP codes and their expiry time. |
| `secretBox.ts` | 59 | Reversible encryption for secrets the platform stores (SMTP password, provider API key). |
| `tempPassword.ts` | 31 | Generates the readable temporary password emailed to accounts the office creates. |

#### `backend/src/validators/`

| File | Lines | What it does |
|---|---:|---|
| `assessment.schema.ts` | 476 | Zod schemas for assessments: params, templates, categories, questions, category forms, answers, review, import. |
| `assessorAssignment.schema.ts` | 23 | Assessor assignment bodies and queries. |
| `auth.schema.ts` | 131 | Name, email, password, phone, OTP and Enrollment ID rules; register, login, reset schemas. |
| `common.schema.ts` | 31 | Shared UUID and date-only fields. |
| `contactEnquiry.schema.ts` | 121 | Contact form and admin inbox schemas. |
| `emailSettings.schema.ts` | 82 | Email settings and test send. |
| `faq.schema.ts` | 64 | FAQ create, update, list, reorder. |
| `farm.schema.ts` | 135 | Farm create, update, list (staff and own). |
| `field.schema.ts` | 147 | Field create, update, list, and the GeoJSON polygon and boundary schemas. |
| `fieldDetails.schema.ts` | 60 | Soil and field document schemas. |
| `fieldModule.schema.ts` | 320 | One body schema per monitoring module, plus params for farm, field, module, record. |
| `notification.schema.ts` | 26 | Notification list and delete schemas. |
| `org.schema.ts` | 66 | Organization update schema including timezone. |
| `pagination.schema.ts` | 34 | Shared page, limit and search fields. |
| `program.schema.ts` | 136 | Program, enrollment, visibility, self enroll and list schemas. |
| `programAdminSurvey.schema.ts` | 214 | Survey templates, categories, questions, scoring rules, programs, contracts, submissions. |
| `standalone.schema.ts` | 113 | Public survey schemas: email check, OTP, draft, submit, status token. |
| `user.schema.ts` | 87 | User create, update, status, list, profile, change password. |
| `visit.schema.ts` | 42 | Visit start, location, arrive, end. |
| `contract.schema.ts` | 23 | Contract signing schemas: the signature body and the link token. |

---

## 6. Admin panel architecture

Folder: `admin/`. React 18 with Vite, TypeScript, Tailwind CSS. The panel is a single page app. Every page is lazy loaded.

### 6.1 Start up and shell

1. `main.tsx` applies the cached favicon before the first paint, then mounts `App`.
2. `App.tsx` wraps everything in: Redux `Provider`, `DialogProvider` (confirm dialogs), the toast host, `BrandingApplier` (favicon and title), `BrowserRouter`, `RouteTitle` (tab title), `LocaleWatcher` (redraws when timezone or clock changes) and a `Suspense` loader.
3. Public routes are served without the shell. Everything else goes through `ProtectedRoute` (redirects to `/login` when signed out, and blocks pages the role may not open) and `AppLayout`, which is the `Sidebar`, the `Topbar` and the page outlet.
4. The panel reads the public `/config` endpoint (branding, timezone, clock), even on the login page, so the logo and every date are right from the first screen.

### 6.2 Route map

`Program admin` shows whether a program administrator can open the page (`lib/access.ts`). The API applies its own gate as well.

| Path | Page | Program admin |
|---|---|---|
| `/login` | `Login` (with `ForgotPasswordForm`) | Public |
| `/program-admin-survey/:token` | `ProgramSurveyAssessment` (producer survey) | Public |
| `/program-admin-survey/status/:token` | `ProgramSurveyStatus` | Public |
| `/program-admin-survey/contract/:token` | `ProgramSurveyContract` | Public |
| `/dashboard` | `Dashboard` | Yes |
| `/users`, `/users/new`, `/users/:id`, `/users/:id/edit` | `Users`, `UserForm`, `UserDetail` | Yes, assessors and farmers only |
| `/farms`, `/farms/new`, `/farms/:id`, `/farms/:id/edit` | `Farms`, `FarmForm`, `FarmDetail` | Yes |
| `/fields`, `/fields/new`, `/fields/:id`, `/fields/:id/edit` | `Fields`, `FieldForm`, `FieldDetail` | Yes |
| `/fields/:fieldId/comparison`, `/programs/:programId/fields/:fieldId/comparison` | `AssessmentComparison` (farmer and assessor side by side) | Yes |
| `/programs`, `/programs/new`, `/programs/:id`, `/programs/:id/edit` | `Programs`, `ProgramForm` (wizard), `ProgramDetail` | Yes |
| `/programs/:id/survey` | `ProgramSurveySetup` | Yes |
| `/programs/:id/farmers` | `EnrolledFarmers` | Yes |
| `/programs/:programId/survey-submissions/:id` | `ProgramSubmissionDetail` | Yes |
| `/programs/:programId/fields/:id`, `.../edit` | `FieldDetail`, `FieldForm` inside a program | Yes |
| `/programs/:programId/assessments/categories/...` | `CategoryForm`, `AssessmentQuestions`, `QuestionForm` on the program's own template | Yes |
| `/assessments` | `AssessmentTemplates` | Yes |
| `/assessments/templates/:templateId` | `AssessmentCategories` | Yes |
| `/assessments/templates/:templateId/categories/new`, `/:id/edit` | `CategoryForm` | Yes |
| `/assessments/templates/:templateId/categories/:categoryId/questions`, `/new`, `/:id/edit` | `AssessmentQuestions`, `QuestionForm` | Yes |
| `/submissions` | `Submissions` (assessment submissions) | Yes |
| `/submissions/:id`, `/programs/:programId/submissions/:id` | `AssessmentReview` (the second keeps the program's breadcrumbs) | Yes |
| `/surveys` | `ProgramAdminSurvey` (surveys hub) | Yes |
| `/surveys/new` | `NewSurveyProgram` | Yes |
| `/surveys/templates/:id` (and old `/surveys/surveys/:id`) | `ProgramTemplateEditor` | Yes |
| `/surveys/contracts/:id` | `ProgramContractEditor` | Yes |
| `/survey-submissions`, `/survey-submissions/:id` | `ProgramSubmissions`, `ProgramSubmissionDetail` | Yes |
| `/live-visits` | `LiveVisits` | No |
| `/notifications` | `Notifications` | Yes |
| `/contact-enquiries` | `ContactEnquiries` | Yes (read and resolve) |
| `/faqs` | `Faqs` | No |
| `/login-logs` | `LoginLogs` | No |
| `/reports` | `Placeholder` (not built) | No |
| `/profile`, `/profile/change-password` | `Profile`, `ChangePassword` | Yes |
| `/settings` | `Settings` (own account only for a program administrator) | Yes |
| `/` and anything else | `Home` (redirect to the dashboard) | Yes |

Older links `/program-surveys/*` and `/program-submissions/*` redirect to `/surveys` and `/survey-submissions`. `/assessments/categories/*` redirects to `/assessments`.

### 6.3 Data layer

| Piece | File | What it does |
|---|---|---|
| HTTP client | `lib/api.ts` | Axios instance. Adds the token, and on a 401 refreshes once and replays the waiting requests. Tokens are kept in `localStorage` under `farmer_admin_token` and `farmer_admin_refresh_token`. |
| Base query | `store/axiosBaseQuery.ts` | Lets RTK Query use that client and returns field errors from the API. |
| API slice | `store/api.ts` | The single RTK Query API. Tag types drive cache refresh. `refetchOnMountOrArgChange`, `refetchOnFocus` and `refetchOnReconnect` are on. |
| Endpoint files | `store/endpoints/*.ts` | One per backend area. They inject queries and mutations into the slice and export hooks such as `useListUsersQuery`. |
| Auth state | `store/authSlice.ts`, `store/useAuth.ts` | The signed in user and logout. |
| Types | `types/index.ts` | Shape of every API object. |

Endpoint files and the backend area each one calls:

| File | Backend prefix |
|---|---|
| `authApi.ts` | `/auth` |
| `configApi.ts` | `/config` |
| `profileApi.ts` | `/profile` |
| `usersApi.ts` | `/users` |
| `organizationsApi.ts` | `/organizations` |
| `emailSettingsApi.ts` | `/email-settings` |
| `loginLogsApi.ts` | `/login-logs` |
| `farmsApi.ts` | `/farms` |
| `fieldsApi.ts` | `/fields` (details, soil, documents, boundary) |
| `programsApi.ts` | `/programs` (also `/programs/submissions`) |
| `assignmentsApi.ts` | `/assessor-assignments` |
| `assessmentApi.ts` | `/assessments` (templates, categories, questions, review, import) |
| `programAdminSurveyApi.ts` | `/program-admin-surveys` |
| `dashboardApi.ts` | `/dashboard/admin`, `/dashboard/programs` |
| `visitsApi.ts` | `/visits` |
| `notificationsApi.ts` | `/notifications` |
| `helpApi.ts` | `/faqs`, `/contact-enquiries` |

### 6.4 Roles in the panel

| Rule | Where |
|---|---|
| Super admin and admin can open every page | `lib/access.ts` (no restriction) |
| A program administrator can open only the paths in `PROGRAM_ADMIN_PATHS` and manages only assessors and farmers | `lib/access.ts`, `pages/UserForm.tsx`, `pages/Users.tsx` |
| The sidebar hides what a role cannot open. FAQs show only to admin level. | `components/layout/Sidebar.tsx` |
| Typing a forbidden address redirects | `components/ProtectedRoute.tsx` |
| Template editing: only admin and super admin change the Global template. Everyone else edits their own template or a program's own copy. A locked template is read only. A template becomes locked by hand, and permanently once a submission exists on it. The server checks the same rules. | `lib/assessmentScope.ts`, `AssessmentTemplateUi.tsx` |

### 6.5 Live updates

The panel keeps a Socket.IO connection (`lib/socket.ts`). `components/LiveSync.tsx`, mounted once in the layout, listens for the server event `data:changed` and marks the matching cached data out of date (`lib/liveSync.ts` maps each resource to its RTK Query tags), so every page and the sidebar counts update without a reload and without per page code. After a connection break it loads everything on screen again, and while the connection is down it does so every 30 seconds. A refused connection is retried with a fresh token. Forms fill once per record (`lib/useSeedOnce.ts`) so a background refresh does not overwrite what is being typed. Live visits also join a visit room for position updates. Public survey pages use `lib/surveySocket.ts` with the link token.

### 6.6 Forms, validation and errors

| Need | Where |
|---|---|
| Field validators (required, email, phone, password, number range) | `lib/validation.ts` |
| Show the API's field errors on the form | `lib/serverErrors.ts` |
| Error text from an unknown error | `lib/errMsg.ts` |
| Toasts | `lib/toast.ts` (react-hot-toast) |
| Confirm and message dialogs | `components/ui/DialogProvider.tsx` (`useDialog`) |
| Deleting with a summary of what goes too | `lib/confirmDelete.tsx` |
| Return to the page you came from | `lib/returnTo.ts` |
| Dates in the organization timezone | `lib/datetime.ts` |

### 6.7 Exports and files

`lib/workbook.ts` builds every Excel file the panel hands out (fonts, banding, totals, links). `lib/downloadApiFile.ts` and `lib/openPdf.ts` fetch files that sit behind the access token. Assessment spreadsheets (import, export and the sample) are built by the backend and downloaded with `downloadApiFile`.

### 6.8 Public survey pages

Producers open a link or QR code. There is no account.

| Step | Page | API |
|---|---|---|
| Survey: verify email by code, answer, save a draft, submit | `pages/program-survey/ProgramSurveyAssessment.tsx` | `/program-admin-survey/send-otp`, `/verify-otp`, `/:token/structure`, `/:token/check-email`, `/:token/save-draft`, `/:token/submit` |
| Status: result tier, next steps | `pages/program-survey/ProgramSurveyStatus.tsx` | `/program-admin-survey/status/:token` |
| Contract: read and sign (typed or drawn) | `pages/program-survey/ProgramSurveyContract.tsx` | `/program-admin-survey/contract/:token`, `.../pdf`, `.../sign` |

The pages use `lib/programSurveyApi.ts` (plain fetch, no RTK Query), `lib/signature.ts`, `pages/survey/*` for the layout, icons and state list, and `lib/surveySocket.ts` for live status.

### 6.9 Files outside `src/`

| File | Purpose |
|---|---|
| `admin/package.json` | Scripts: `dev`, `build` (tsc and vite), `preview`, `lint` |
| `admin/vite.config.ts` | Vite config |
| `admin/tailwind.config.js` | Theme tokens (`primary #136F3F`, `success`, `warning`, `danger`, grays). Use the tokens, not raw hex. |
| `admin/postcss.config.js`, `tsconfig.json`, `tsconfig.node.json` | Build config |
| `admin/index.html` | Page shell |
| `admin/.env.example` | `VITE_API_BASE_URL`, the full backend URL, baked in at build time |
| `admin/Dockerfile`, `nginx.conf`, `.dockerignore` | Build with Node 22, serve with Nginx. Single page fallback to `index.html`, long cache for assets, `/health`. |
| `admin/public/` | `fav.png`, `favicon.svg`, `logo.png`, `survey_img.png` |
| `admin/README.md` | Older admin notes |

### 6.10 Every admin file

Line counts are lines in the file. All paths are under `admin/src/`.

#### `admin/src/`

| File | Lines | What it does |
|---|---:|---|
| `App.tsx` | 284 | Route tree: public routes (login, public survey) and the protected shell with every admin page, all lazy loaded. |
| `index.css` | 198 | Global styles and Tailwind layers (card, button and form classes). |
| `main.tsx` | 17 | App entry. Applies the cached favicon before first paint and mounts App. |
| `vite-env.d.ts` | 10 | Vite environment typing. |

#### `admin/src/components/`

| File | Lines | What it does |
|---|---:|---|
| `AssessmentSourceModal.tsx` | 187 | Dialog asking how a program takes a template: keep it or make it its own copy. |
| `AssessmentTemplateUi.tsx` | 97 | Template badges, reason notes, and shared modals for templates. |
| `AvatarUpload.tsx` | 250 | Avatar picker and uploader. |
| `BrandingApplier.tsx` | 57 | Keeps the favicon and title in step with organization branding. |
| `ContractPdfPreview.tsx` | 56 | Contract drawn on the page as a producer will read it. |
| `EditorSheet.tsx` | 64 | Wide slide over panel that holds a whole editor. |
| `FieldAssessmentsCard.tsx` | 136 | Card on field detail: assessments submitted for the field with review status, and a Compare farmer and assessor button once both have submitted. |
| `Home.tsx` | 8 | Redirects to the first page of the panel. |
| `icons.tsx` | 241 | Inline SVG icon set. |
| `ImportTargetModal.tsx` | 78 | Dialog asking where an imported spreadsheet goes: into the open assessment or into a new template. |
| `Loader.tsx` | 88 | Brand loader. |
| `LocaleWatcher.tsx` | 26 | Redraws the panel when timezone or clock changes. |
| `Logo.tsx` | 29 | Logo from branding. |
| `PasswordForm.tsx` | 138 | Change password form, used on its own page and in settings. |
| `PdfDocument.tsx` | 167 | PDF viewer built on pdfjs. |
| `ProgramShareModal.tsx` | 364 | Share the survey link by email, up to 50 addresses, with QR code. |
| `ProgramStatusBadge.tsx` | 55 | Date aware program status badge. |
| `ProgramSubmissionCards.tsx` | 146 | Six status tiles that summarize survey submissions. |
| `ProtectedRoute.tsx` | 20 | Redirects to login when signed out and blocks pages the role may not open. |
| `QuestionKindModal.tsx` | 65 | Choose multiple choice or input based questions. |
| `RouteTitle.tsx` | 79 | Sets the browser tab title from the route. |
| `TemplateImportModal.tsx` | 144 | Import a spreadsheet as a new named template, with sample download and a result summary. |

#### `admin/src/components/auth/`

| File | Lines | What it does |
|---|---:|---|
| `ForgotPasswordForm.tsx` | 256 | Forgot password: email, code, new password. |

#### `admin/src/components/dashboard/`

| File | Lines | What it does |
|---|---:|---|
| `loginLogShared.tsx` | 74 | Shared login log formatting and table. |
| `LoginLogsTable.tsx` | 57 | Table of recent logins. |
| `StatCard.tsx` | 69 | KPI tile. |

#### `admin/src/components/layout/`

| File | Lines | What it does |
|---|---:|---|
| `AppLayout.tsx` | 24 | Shell: sidebar, top bar, page outlet. |
| `NotificationBell.tsx` | 166 | Bell with unread count and dropdown; turns a notification into an admin route. |
| `Sidebar.tsx` | 331 | Navigation, filtered by role, with live counts under Survey Submissions. |
| `Topbar.tsx` | 109 | Top bar: menu button, notification bell, user name and sign out. |

#### `admin/src/components/ui/`

| File | Lines | What it does |
|---|---:|---|
| `BoundaryMap.tsx` | 265 | Leaflet map to draw and edit a field boundary, with area and validation. |
| `Breadcrumbs.tsx` | 48 | Breadcrumb trail. |
| `DialogProvider.tsx` | 282 | Confirm and message dialogs through useDialog. |
| `DragScroll.tsx` | 154 | Horizontal strip that scrolls by dragging. |
| `MapPicker.tsx` | 174 | Leaflet point picker for a location. |
| `phone-input.css` | 121 | Styles for the phone input. |
| `PhoneInput.tsx` | 234 | Phone input with country code and validation. |
| `PlaceSearch.tsx` | 113 | Place search used by the map picker and boundary editor. |
| `Portal.tsx` | 10 | Renders children at the end of body. |
| `Select.tsx` | 296 | Searchable select. |
| `Toggle.tsx` | 78 | Switch that saves the moment it is flipped. |

#### `admin/src/config/`

| File | Lines | What it does |
|---|---:|---|
| `apiConfig.ts` | 13 | API base URL from VITE_API_BASE_URL. |

#### `admin/src/lib/`

| File | Lines | What it does |
|---|---:|---|
| `access.ts` | 61 | What a program administrator may open and which roles they manage. |
| `api.ts` | 143 | Axios instance: access token, refresh on 401, error messages. |
| `assessmentScope.ts` | 130 | Which templates a person may edit, lock or make global; the Blank choice. |
| `brandingCache.ts` | 53 | Caches branding in localStorage so a refresh paints right. |
| `confirmDelete.tsx` | 81 | Hook that shows what a delete will remove, then deletes. |
| `datetime.ts` | 151 | Date and time formatting in the organization timezone. |
| `downloadApiFile.ts` | 19 | Download a file from an authenticated API path. |
| `errMsg.ts` | 11 | Reads a message from an unknown error. |
| `geo.ts` | 178 | Boundary geometry and validation, matching the server rules. |
| `openPdf.ts` | 71 | Fetch and open a PDF that sits behind the token. |
| `programScope.ts` | 29 | Builds paths under /programs/:id and strips that prefix for role checks. |
| `programSurveyApi.ts` | 219 | Plain fetch client for the public survey endpoints. |
| `questionTypes.ts` | 63 | Labels and options for question kinds and types. |
| `returnTo.ts` | 65 | Return to where the user came from after a form. |
| `serverErrors.ts` | 39 | Maps server field errors onto form fields. |
| `signature.ts` | 72 | Trims a drawn or photographed signature. |
| `socket.ts` | 110 | Socket.IO client: fresh token on every attempt, retry after a refused connection, visit rooms. |
| `surveySocket.ts` | 24 | Socket for the public survey with a link token. |
| `toast.ts` | 56 | Toast helpers. |
| `liveSync.ts` | 90 | The resources the server announces and the cached data each one makes out of date. |
| `useSeedOnce.ts` | 22 | Fills a form from a fetched record once, so a background refresh does not replace typed text. |
| `useProgramCrumbs.ts` | 23 | Breadcrumbs for program pages. |
| `useUrlSearchSync.ts` | 14 | Syncs the URL search value into a list search box. |
| `validation.ts` | 101 | Form validators: required, email, phone, password, number ranges. |
| `workbook.ts` | 400 | Builds every Excel file the panel hands out, with links. |

#### `admin/src/pages/`

| File | Lines | What it does |
|---|---:|---|
| `AssessmentCategories.tsx` | 720 | One assessment template: its categories, Excel import (into this template or as a new template), export, lock, template actions. |
| `AssessmentComparison.tsx` | 161 | Farmer and assessor side by side for one field: both percentages and, for every question, each side's written answer, score out of the maximum, and the difference. |
| `AssessmentQuestions.tsx` | 461 | Questions of one category: list, drag to reorder, activate, edit, delete. |
| `AssessmentReview.tsx` | 449 | Review of one submitted assessment: score every answer, each category, or the whole assessment in one number, add a note, approve. Opened from a program, it keeps that program's breadcrumbs. |
| `AssessmentTemplates.tsx` | 476 | Assessments home: all templates (Global, own, program copies), create, copy, make global, lock, delete. |
| `Assignments.tsx` | 264 | Assessor to farmer assignment list. Not registered in the route tree; assessors are now set per enrollment. |
| `CategoryForm.tsx` | 200 | Create or edit an assessment category. |
| `CategoryFormBuilder.tsx` | 474 | Builder for an input based category: the fields of the form the farmer fills in. |
| `ChangePassword.tsx` | 162 | Change own password. |
| `ContactEnquiries.tsx` | 780 | Inbox for messages sent from the mobile Contact Us form: read, resolve, reply by email, delete. |
| `Dashboard.tsx` | 560 | Dashboard: program, farmer and field counts, acreage, enrollment by program, assessment and score trends, benchmarking, survey submissions. |
| `EnrolledFarmers.tsx` | 520 | Farmers enrolled in one program: assessor per enrollment, their assessments with View, Review and Compare links, unenroll. |
| `Faqs.tsx` | 447 | Manage the Help FAQs shown in the mobile app: create, edit, reorder, switch on or off. |
| `FarmDetail.tsx` | 242 | One farm: owner, details and its fields. |
| `FarmForm.tsx` | 351 | Create or edit a farm. |
| `Farms.tsx` | 348 | Farm list with search, filters, paging. |
| `FieldDetail.tsx` | 439 | One field: details, boundary map, soil, documents, assessments, history. |
| `FieldForm.tsx` | 718 | Create or edit a field, including drawing its boundary on the map. |
| `Fields.tsx` | 316 | Field list with search, filters, paging. |
| `LiveVisits.tsx` | 482 | Live map of assessor visits in progress, with position, arrival and status. |
| `Login.tsx` | 167 | Sign in and forgot password. |
| `LoginLogs.tsx` | 91 | Login activity list. |
| `NewSurveyProgram.tsx` | 154 | Start a new survey: pick the program it is for. |
| `Notifications.tsx` | 300 | Notification list with filters and bulk actions. |
| `Placeholder.tsx` | 22 | Empty page used for Reports, which is not built yet. |
| `Profile.tsx` | 132 | Own profile and avatar. |
| `ProgramAdminSurvey.tsx` | 883 | Surveys hub: program surveys, survey templates and contract templates. |
| `ProgramContractEditor.tsx` | 612 | Edit a contract template: intro and numbered clauses, or upload a PDF. |
| `ProgramDetail.tsx` | 327 | One program: details, survey and link, and the enrolled farmers with a link to the full list. |
| `ProgramForm.tsx` | 551 | Program wizard: Program, Assessment, Survey, Contract, Share. |
| `Programs.tsx` | 375 | Program list with status, search, filters. |
| `ProgramSubmissionDetail.tsx` | 1013 | One survey submission: answers, score, category override, contract, signed PDF, accept or withdraw. |
| `ProgramSubmissions.tsx` | 682 | Survey submissions list with status tiles and filters. |
| `ProgramSurveySetup.tsx` | 715 | Survey, Contract and Share steps for one program. |
| `ProgramTemplateEditor.tsx` | 958 | Edit a survey template: categories, 0 to 3 questions, scoring rules. |
| `QuestionForm.tsx` | 558 | Create or edit an assessment question: type, options, score descriptions, photo and note settings. |
| `Settings.tsx` | 604 | Settings tabs: organization, branding, email, password, danger zone. |
| `Submissions.tsx` | 250 | Assessment submissions from farmers and assessors, with review status. |
| `UserDetail.tsx` | 252 | One user: details, role and, for a farmer, their farms. |
| `UserForm.tsx` | 271 | Create or edit a user. Shows only the roles the signed-in role may create. |
| `Users.tsx` | 449 | User list by role group with search and filters. |

#### `admin/src/pages/program-survey/`

| File | Lines | What it does |
|---|---:|---|
| `ProgramSurveyAssessment.tsx` | 1272 | Public survey a producer fills in from a link: email OTP, questions, draft, submit. |
| `ProgramSurveyContract.tsx` | 337 | Public page where a producer reads and signs the contract. |
| `ProgramSurveyStatus.tsx` | 369 | Public status page a producer reaches by link: result tier and next steps. |

#### `admin/src/pages/settings/`

| File | Lines | What it does |
|---|---:|---|
| `EmailTab.tsx` | 468 | Settings tab for the email provider and a test send. |

#### `admin/src/pages/survey/`

| File | Lines | What it does |
|---|---:|---|
| `states.ts` | 24 | State list and referral sources used in the survey form. |
| `SurveyIcons.tsx` | 111 | Category icons and colors for the public survey. |
| `SurveyLayout.tsx` | 158 | Shared shell of the public survey: logo, progress, steps. |

#### `admin/src/store/`

| File | Lines | What it does |
|---|---:|---|
| `api.ts` | 64 | RTK Query base API with tags and refetch settings. |
| `authSlice.ts` | 56 | Signed-in user and tokens. |
| `axiosBaseQuery.ts` | 72 | RTK Query base query over the axios instance, with field errors. |
| `hooks.ts` | 6 | Typed dispatch and selector hooks. |
| `index.ts` | 21 | Redux store. |
| `useAuth.ts` | 22 | Hook over auth state with logout. |

#### `admin/src/store/endpoints/`

| File | Lines | What it does |
|---|---:|---|
| `assessmentApi.ts` | 321 | Assessments: templates, categories, questions, category forms, import, export, review, lock. |
| `assignmentsApi.ts` | 54 | Assessor assignments. |
| `authApi.ts` | 50 | Login, forgot and reset password, me. |
| `configApi.ts` | 29 | Public config: branding, locale. |
| `dashboardApi.ts` | 69 | Admin and program dashboards. |
| `emailSettingsApi.ts` | 78 | Email settings and test send. |
| `farmsApi.ts` | 90 | Farms. |
| `fieldsApi.ts` | 165 | Fields, soil, documents, boundary, details. |
| `helpApi.ts` | 187 | FAQs and contact enquiries. |
| `loginLogsApi.ts` | 21 | Login activity. |
| `notificationsApi.ts` | 95 | Notifications. |
| `organizationsApi.ts` | 92 | The organization's details and branding. |
| `profileApi.ts` | 62 | Own profile, avatar, password. |
| `programAdminSurveyApi.ts` | 671 | Survey module: templates, programs, contracts, submissions. |
| `programsApi.ts` | 310 | Programs, enrollments, assessment submissions, progress. |
| `usersApi.ts` | 122 | Users. |
| `visitsApi.ts` | 62 | Visits. |

#### `admin/src/types/`

| File | Lines | What it does |
|---|---:|---|
| `index.ts` | 540 | Shared TypeScript types for API data: users, farms, fields, programs, assessments, submissions, visits, notifications. |

---

## 7. The mobile app

The mobile app is a separate project. It uses the same backend API and the same Socket.IO server as the admin panel, so this document does not describe its code. Every endpoint it can call is listed in Section 4, and live updates are explained in `backend/SOCKETS.md`.

To try any endpoint without writing code, import the master collections in `backend/postman/` or `backend/hoppscotch/` (Postman and Hoppscotch). Each holds every request with an example body.

When an endpoint the app calls changes, update Section 4 and rebuild the collections with `npx tsx postman/build-collections.ts` from `backend/`, then tell the mobile developer.

## 8. Business flows across the system

Each flow lists the steps in order and the files that carry them. `BE` is `backend/src/`, `AD` is `admin/src/`.

### 8.1 From producer to enrolled farmer (survey, contract, Enrollment ID)

| Step | What happens | Where |
|---|---|---|
| 1 | A staff member creates a program and, in the wizard, attaches a survey template and a contract template. The survey gets a public link and QR code. | AD `pages/ProgramForm.tsx`, `ProgramSurveySetup.tsx`. BE `programAdminSurvey.service.ts` (`attachSurveyToProgram`), tables `program_admin_surveys`, `program_admin_survey_templates`, `program_admin_contract_templates` |
| 2 | The link is shared by email (up to 50 addresses per send) or QR code. | AD `components/ProgramShareModal.tsx`. BE `POST /program-admin-surveys/programs/:id/share`, email `surveyInviteEmail` |
| 3 | The producer opens the link, verifies their email with a code, answers and saves a draft, then submits. | AD `pages/program-survey/ProgramSurveyAssessment.tsx`. BE `programAdminSurveyPublic.controller.ts`, `POST /program-admin-survey/send-otp`, `/verify-otp`, `/:token/save-draft`, `/:token/submit` |
| 4 | The backend scores the 0 to 3 answers against the template's scoring rules and sets `auto_category` (Gold, Silver, Bronze or Not Qualified). The producer gets an email and a status page. Staff get a notification and a live update. | BE `programAdminSurvey.service.ts`, `program_admin_survey_scoring_rules`, `notification.service.ts` (`survey_submitted`), `emailTemplates.ts` (`surveyReceivedEmail`, `surveyQualifiedEmail`, `surveyNotQualifiedEmail`) |
| 5 | Staff open the submission, may change the category with a written reason, and send the contract. The producer gets a link with a token and an expiry. | AD `pages/ProgramSubmissionDetail.tsx`. BE `PATCH /program-admin-surveys/submissions/:id/category`, `POST .../send-contract`, `contractToSignEmail` |
| 6 | The producer reads the contract and signs (typed or drawn). The backend stores name, signature, time and IP, and builds the signed PDF. Staff get `contract_signed`. | AD `pages/program-survey/ProgramSurveyContract.tsx`. BE `POST /program-admin-survey/contract/:token/sign`, `contractPdf.service.ts`, `upload.service.ts` |
| 7 | Staff accept. The backend issues a unique Enrollment ID (`IIG-YYYY-NNNNNN`), marks the submission `enrolled`, and emails a first time producer the welcome message and the farm setup steps with the app link. Someone who already has an account gets a short note instead. | BE `POST /program-admin-surveys/submissions/:id/accept` (`acceptAndEnroll`), `models/enrollmentId.model.ts`, `enrollmentWelcomeEmail`, `farmSetupEmail`, `returningEnrollmentEmail` |

Statuses: `draft` (Registered), `submitted` (Under Review), `qualified`, `not_qualified`, `contract_sent`, `contract_signed`, `enrolled`, `withdrawn`. Accept is refused until the contract is signed. Staff can also withdraw or delete a submission.

### 8.2 Registration with an Enrollment ID

| Step | What happens | Where |
|---|---|---|
| 1 | The farmer types the Enrollment ID in the app. The app calls `POST /auth/enrollment-id/lookup`. It gets the full name, a masked email, a masked phone and the program name, and shows them locked. A wrong or guessed ID gets the same not found answer, and the call has its own strict rate limit. | BE `auth.service.ts` (`lookupEnrollmentId`), `enrollmentId.model.ts`, `utils/mask.ts`, `rateLimiters.ts` |
| 2 | The farmer sets a password and registers with the ID. The server resolves the email from the ID, so the address is never sent by the app. | BE `auth.service.ts` (`register`) |
| 3 | An OTP is emailed. The farmer verifies it and can sign in. | BE `otp.model.ts`, `mailer.service.ts` |
| 4 | Accounts made by the office (assessors and others) get a temporary password by email. Sign in is refused with `PASSWORD_CHANGE_REQUIRED` until the person sets their own. | BE `user.service.ts`, `auth.service.ts` |

### 8.3 Program setup and its assessment template

| Step | What happens | Where |
|---|---|---|
| 1 | In the wizard step 1 the staff member fills the program: name, code, type, dates, enrollment limit, visibility to farmers. | AD `pages/ProgramForm.tsx`. BE `program.service.ts`, `program.schema.ts` |
| 2 | In step 2 they choose the assessment: start from the Global template, copy another template, or start blank (multiple choice or input based). Every program answers its own copy of the template, so later edits to the source never reach a running program. | AD `components/AssessmentSourceModal.tsx`. BE `assessmentTemplate.service.ts`, `program.service.ts` (`resolveProgramSource`), `assessment_templates.program_id` |
| 3 | The program's assessment can be edited from `/programs/:programId/assessments/...` until a submission exists on it, and can be locked or unlocked by hand before that. The program can swap to another template only while nothing has been answered. | AD `lib/assessmentScope.ts`. BE `assessmentTemplate.service.ts`, `POST/DELETE /assessments/templates/:id/lock` |
| 4 | Farmers enroll fields (self enrollment) or staff enroll them. An assessor is set on each enrollment. | BE `program.service.ts`, `program_enrollments.assessor_id`. AD `pages/EnrolledFarmers.tsx` |

### 8.4 Assessment: from answer to approved score

| Step | What happens | Where |
|---|---|---|
| 1 | A farmer or an assessor answers the questions of the program's template for a field. Answers are stored per author role, so both sides can assess the same field. | BE `assessmentMobile.service.ts`, `assessorAssessment.service.ts`, `assessmentAnswer.ts`, `assessment_responses` |
| 2 | Writing is allowed only while the program is active and not ended, and the farm and field are active. | BE `assertAssessmentWritable` in `assessmentMobile.service.ts` |
| 3 | Submit needs at least one answer. A submitted assessment cannot be changed or discarded. It goes to `in_review`. The farmer gets a receipt notification and email, and staff see it live. | BE `submitFieldAssessmentForUser`, `field_assessments.review_status`, `notification.service.ts` (`assessment_submitted`) |
| 4 | Staff open it in Submissions (or from the field or from Enrolled farmers). They score every answer, or each category, or the whole assessment in one number, and may add a note. | AD `pages/Submissions.tsx`, `pages/AssessmentReview.tsx`, `components/FieldAssessmentsCard.tsx`. BE `assessmentReview.service.ts`, `GET/PATCH /assessments/reviews/:id` |
| 5 | Staff approve, sending `categoryScores` or `overallScore` when they did not score every answer. The backend checks the score limits of each category and of the whole assessment, then marks it `approved` and notifies the farmer (`assessment_reviewed`). Only approved scores count in dashboards. | BE `POST /assessments/reviews/:id/approve`, `assessmentReview.model.ts` |
| 6 | The farmer sees the regen health index (0 to 100, rated Excellent, Good, Fair, Needs work or Poor) and category scores. The assessor can compare the farmer's and their own scores per question. Staff can open the same comparison in the panel once both have submitted, with each answer written out. | BE `getFieldRegenIndex`, `getComparison`, `getAssessmentComparison` in `fieldDetails.service.ts`, `dashboard.service.ts`. AD `pages/AssessmentComparison.tsx` |
| Access rule for assessors | Only enrollments that name the assessor, in programs that have started. Visits are checked in the app before an assessment opens; the API itself does not check for a visit. | BE `assessorCanAccessField` in `assessmentMobile.model.ts` |

### 8.5 Visit tracking

| Step | What happens | Where |
|---|---|---|
| 1 | The assessor starts a visit to a field: status `en_route`. The farmer is notified and the office sees it on the live map. | BE `visit.service.ts`, `POST /visits`, `assessor_visit_started`. AD `pages/LiveVisits.tsx` |
| 2 | The phone pushes positions (at most one every 3 seconds). A large jump in a short time and mock locations are flagged. Everyone watching the visit room gets `visit:location`. | BE `POST /visits/:id/location`, `socket/visit.socket.ts`, `field_visit_locations` |
| 3 | The assessor marks arrival with their position. The backend measures the distance to the field boundary (150 m tolerance) or to the field point (300 m) and stores `arrival_verified`. With `VISIT_ARRIVAL_ENFORCE=true` an unverified arrival is refused. The default only records it. | BE `arriveVisit`, `utils/geo.ts`, `config/env.ts` |
| 4 | The assessor ends the visit: `completed`. A visit with no position for 4 hours is closed as `expired` by the 15 minute housekeeping job. Location history older than 90 days is deleted. | BE `visit.service.ts` (`runVisitMaintenance`), `server.ts` |

### 8.6 Field boundary and acreage

A boundary is a GeoJSON polygon: one outer ring, no holes, closed. It is stored in `fields.boundary`.

| Who | How | Where |
|---|---|---|
| Staff | Draw it in the field form, or send `boundary` in the field create or update. `PUT /fields/:id/boundary` saves or clears it alone. | AD `components/ui/BoundaryMap.tsx`, `pages/FieldForm.tsx`, `lib/geo.ts`. BE `field.service.ts`, `field.schema.ts` |
| Farmer | `PUT /farms/:farmId/fields/:id/boundary` from the app, or with the field create and update. | BE `field.routes.ts` (`mobileFieldRouter`) |

The server refuses a shape that crosses itself, that is under 10 square metres, or that is too large. The acreage of the outline is computed on the server and stored as `area_acres`. `null` clears the boundary (SQL null).

### 8.7 Field monitoring records

A record belongs to a field. Eleven modules exist (training, soil samples, irrigation, pesticide, fertilizer, tillage, organic amendments, crop diversification, nutrient management, crop intensification, animal integration).

| Step | Where |
|---|---|
| The module registry names the table and columns | BE `models/fieldModule.model.ts` (`MODULES`) |
| One Zod body schema per module, chosen from the URL | BE `validators/fieldModule.schema.ts`, `validateWith` |
| Rules: who may touch a field, farm wide lists | BE `services/fieldModule.service.ts` |
| Attachments (lab report, certificate, photos) go to Cloudinary and to `field_module_documents` | BE `fieldModuleDocument.model.ts`, `upload.service.ts` |
| Calls | `GET/POST /field-monitoring/fields/:fieldId/modules/:module`, `.../:id`, `.../documents`, and the farm wide `GET /field-monitoring/farms/:farmId/modules` |

### 8.8 Help content

Staff write the FAQs in the admin panel (`pages/Faqs.tsx`, `/faqs`). The mobile app reads the public list. A person can send a message from the app (`POST /contact-enquiries`, public on purpose so someone whose account was switched off can still write). Staff read, resolve and answer it in `pages/ContactEnquiries.tsx`. A reply is emailed and stored in `contact_enquiry_replies`.

---

## 9. Where to change what

Read the recipe, then open the files in that order.

### 9.1 Add or change an endpoint

| # | File | Change |
|---|---|---|
| 1 | `backend/src/validators/<domain>.schema.ts` | Zod schema for body, query, params. Set limits (length, range, allowed values). |
| 2 | `backend/src/models/<domain>.model.ts` | The query or write. Filter `deleted_at IS NULL`. |
| 3 | `backend/src/services/<domain>.service.ts` | Rules, ownership check, notifications. Throw `ApiError`. |
| 4 | `backend/src/controllers/<domain>.controller.ts` | `asyncHandler`, call the service, `ApiResponse.send`. |
| 5 | `backend/src/routes/<domain>.routes.ts` | Path, `authenticate`, `authorize(...)`, `validate(...)`. Put fixed paths such as `/reorder` before `/:id`. |
| 6 | `backend/src/routes/index.ts` | Only for a new route file: mount it. |
| 7 | `admin/src/store/endpoints/<area>Api.ts` | Query or mutation, with `providesTags` and `invalidatesTags`. New tag types go in `store/api.ts`. |
| 8 | `admin/src/types/index.ts` | Types of the new data. |
| 9 | Section 4 of this file and the mobile guide (Section 7) | Keep the reference and the guide true. |
| 10 | `backend/hoppscotch/` | Add a request so it can be tested. |

### 9.2 Add or change a database column or table

| # | File | Change |
|---|---|---|
| 1 | `backend/src/db/migrations/065_<name>.sql` | Next number. Write it so a second run changes nothing (`IF NOT EXISTS`). |
| 2 | `backend/prisma/schema.prisma` | Same change. Then `npx prisma generate`. |
| 3 | Model `select` lists and public shapes, and the validator | Expose and accept the column. |
| 4 | `backend/src/db/softDelete.ts` | Add the table if it uses `deleted_at`. |
| 5 | `backend/src/services/cascadeDelete.service.ts` | If a parent owns it, delete it with the parent and add it to the deletion summary. |
| 6 | `admin/src/types/index.ts` and the form | Show and edit it. |
| 7 | Start or deploy | Run once with `DB_SYNC=true`, then set it back to `false`. |

### 9.3 Add an admin page

| # | File | Change |
|---|---|---|
| 1 | `admin/src/pages/<Name>.tsx` | The page. Use `card`, heading and table classes from `index.css`. |
| 2 | `admin/src/App.tsx` | Lazy import and `<Route>` inside the protected shell. |
| 3 | `admin/src/components/layout/Sidebar.tsx` | Menu item. Flag: `adminOnly`. |
| 4 | `admin/src/lib/access.ts` | Add the path to `PROGRAM_ADMIN_PATHS` if a program administrator may open it. |
| 5 | `admin/src/components/RouteTitle.tsx` | Tab title. |
| 6 | `admin/src/store/endpoints/` | The API hooks it needs. |

### 9.4 Common changes

| Change | Files |
|---|---|
| Who may call an endpoint | Route gate in `routes/<domain>.routes.ts`; ownership in `services/<domain>.service.ts`; page access in `admin/src/lib/access.ts` |
| A new role | `config/rbac.ts`, `types/index.ts` (`RoleName`), `db/seed.ts`, `validators/user.schema.ts`, `services/user.service.ts`, admin `types/index.ts`, `pages/UserForm.tsx`, `components/layout/Sidebar.tsx`, `lib/access.ts` |
| A validation rule | Backend `validators/*.schema.ts`, admin `lib/validation.ts` and the form, and tell the mobile developer |
| A new notification type | `models/notification.model.ts` (type and redirect), call `notifyUser` in the service, admin `components/layout/NotificationBell.tsx` (route), mobile guide |
| A new email | `services/emailTemplates.ts`, send with `notifyUser` (`emailFor`) or `mailer.service.ts` |
| Email provider or sender | Admin Settings, Email tab (`pages/settings/EmailTab.tsx`), `emailSettings.service.ts` |
| A new environment variable | `.env.example`, `config/env.ts`, `types/index.ts` (`AppEnv`), the README table |
| A live update for a new resource | `services/realtime.service.ts` (`ChangedResource`), call `broadcastToAdmins`, add the rule in `middlewares/liveChanges.ts` for a route, and the cache tags in admin `lib/liveSync.ts` |
| A new question type | Migration (the `question_type` check), `validators/assessment.schema.ts`, `services/assessmentAnswer.ts`, `services/assessment.service.ts`, `services/assessmentImport.ts`, admin `pages/QuestionForm.tsx`, `lib/questionTypes.ts`, mobile guide |
| A new monitoring module | Migration for the table and for documents (see `054`), `models/fieldModule.model.ts` (`MODULES`), `models/fieldModuleDocument.model.ts`, `validators/fieldModule.schema.ts`, mobile guide |
| Survey scoring or categories | Admin `pages/ProgramTemplateEditor.tsx`; backend `programAdminSurveyTemplate.service.ts`, `program_admin_survey_scoring_rules` |
| Contract wording | Admin `pages/ProgramContractEditor.tsx`; backend `programAdminContractTemplate.service.ts`, `contractPdf.service.ts` |
| Upload size or type | `config/multer.ts`, `services/upload.service.ts` |
| A rate limit | `middlewares/rateLimiters.ts` |
| What a delete removes | `services/cascadeDelete.service.ts` |
| Timezone or clock behavior | `services/clock.service.ts`, `utils/datetime.ts`, admin `lib/datetime.ts` |
| A dashboard number | Backend `models/adminDashboard.model.ts`, `services/adminDashboard.service.ts`; admin `pages/Dashboard.tsx` |
| An Excel export | Admin `lib/workbook.ts` and the page that calls it; for assessments `services/assessmentImport.ts` |
| Branding, logo, favicon | Admin Settings; backend `organization.service.ts`, `config.controller.ts` |
| Colors and theme | `admin/tailwind.config.js` tokens |

### 9.5 Rules every change follows

1. Validate on the backend and on the admin form. The backend decides; the form repeats the rule.
2. Filter soft deleted rows. Never hard delete except through `cascadeDelete.service.ts`.
3. Check ownership in the service, not only the role on the route.
4. Return errors as `ApiError` so the response keeps the standard shape.
5. Keep comments short (one or two lines) and technical.
6. When the mobile app is affected, write or update its guide (Section 7).

---

## 10. Glossary

| Term | Meaning |
|---|---|
| Producer, farmer | The person who farms. Before enrollment a producer answers the survey; after accepting they become a farmer with an account. |
| Program | A time boxed offer (name, code, dates, enrollment limit) that farmers enroll fields in. |
| Program administrator | A staff role that runs its own programs, surveys, assessors and farmers. |
| Assessor | A person who assesses fields independently of the farmer. Assigned per enrollment. |
| Enrollment | A farmer's membership in a program, with the enrolled fields and the assessor. |
| Enrollment ID | Code `IIG-YYYY-NNNNNN`, issued when a survey submission is accepted. Needed once, to register. |
| Program survey | The eligibility survey attached to a program. Its score gives Gold, Silver, Bronze or Not Qualified. |
| Assessment | Questions answered per field and program, by the farmer and by an assessor, then reviewed. |
| Assessment template | The categories and questions of an assessment. Global is the platform's starting point. Every program answers its own copy. |
| Original template | The question bank programs used before templates existed. Kept so earlier answers still match. |
| Kind (`mcq`, `input`) | `mcq`: question by question, each answer scores itself. `input`: a category is a form, scored by staff in review. |
| KAB template | The KAB field monitoring worksheet as an input based template. |
| Review status | `in_review` after submit, `approved` after staff scoring and approval. |
| Regen health index | The field's assessment score as 0 to 100, with a rating. |
| Field monitoring | Practice records per field (eleven modules) with attachments. |
| Visit | An assessor's trip to a field: `en_route`, `arrived`, `completed`, `cancelled`, `expired`. |
| Arrival verification | The check that the assessor is within tolerance of the field boundary or point. |
| Soft delete | Marking a row with `deleted_at` instead of removing it. |
| Global template (survey or contract) | A shared template every program administrator can copy. |
