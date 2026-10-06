# Farmer App Platform: Master README

This repository holds the backend API and the admin web panel of the Farmer App Platform. Together they run farmer programs from start to finish: a producer answers an eligibility survey, signs a contract and gets an Enrollment ID; the farmer registers, adds farms and fields, records practices, and is assessed; staff review the results, follow visits live and report on the programs.

This file explains **what the platform does and where each feature lives**. Its companion, [MASTER-ARCHITECTURE.md](MASTER-ARCHITECTURE.md), explains **how it is built** and lists **every source file** with what it does. Read both and you know what the system does, how it fits together and which file to open before you change anything.

## Contents

1. [The platform at a glance	](#1-the-platform-at-a-glance)
2. [Users and roles		](#2-users-and-roles)
3. [What the platform does](#3-what-the-platform-does)
4. [Repository map](#4-repository-map)
5. [Quick finder: I want to change...](#5-quick-finder-i-want-to-change)
6. [Getting started](#6-getting-started)
7. [How the code is organized](#7-how-the-code-is-organized)
8. [Testing and API collections](#8-testing-and-api-collections)
9. [Documentation index](#9-documentation-index)
10. [Notes for the next developer](#10-notes-for-the-next-developer)

---

## 1. The platform at a glance

| Part            | Folder           | What it is                                                                                                                                                        |
| --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend API     | `backend/`     | Node, Express and TypeScript service over PostgreSQL. It owns all data and rules, sends email, stores files in Cloudinary and pushes live updates over Socket.IO. |
| Admin web panel | `admin/`       | React and TypeScript single page app for office staff. It also serves the public survey pages that producers open from a link.                                    |
| Mobile app      | separate project | Used by farmers and assessors. It calls the same API. Its developers work from the guides listed in section 9.                                                    |

```text
 Farmers and assessors        Office staff             Producers
 Mobile app                   Admin web panel          Public survey pages (served by the admin panel)
        \                          |                        /
         +-------- REST and Socket.IO  (/api/v1) ----------+
                              |
                    Backend API (Node, Express)
                     |          |           |
                PostgreSQL   Cloudinary   Email provider
```

### Numbers

|                           |                                |
| ------------------------- | -----------------------------: |
| API endpoints             |          255 in 23 route files |
| Database tables           | 56, built by 67 SQL migrations |
| Admin source files        |                            142 |
| Backend source files      |                            175 |
| Roles                     |                              6 |
| Monitoring modules        |                             11 |
| Emails the platform sends |                   21 templates |
| Backend lines of code     |                   about 38,000 |
| Admin lines of code       |                   about 33,000 |

---

## 2. Users and roles

| Role                      | How the account is made                                                                  | What they use         | What they can do                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `super_admin`           | Seeded from`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` on first start             | Admin panel           | Everything: all users, the organization settings, email settings, FAQs, login activity, the Global assessment template, live visits                                                                                                                       |
| `admin`                 | Created by a super admin                                                                 | Admin panel           | Same as a super admin, but cannot change a super admin or another admin                                                                                                                                                                       |
| `program_administrator` | Created by an admin or super admin                                                       | Admin panel (limited) | Runs their own programs, surveys and survey submissions, assessment templates and review, and looks after assessors and farmers. Cannot open organizations, FAQs, login activity or live visits, and sees only their own account in settings. |
| `program_partner`       | Created by an admin or super admin                                                       | Nothing special today | The role exists in the role list. No screen or route is reserved for it yet.                                                                                                                                                                  |
| `assessor`              | Created by staff. A temporary password is emailed and must be replaced at first sign in. | Mobile app            | Assesses fields independently of the farmer, visits fields, compares scores                                                                                                                                                                   |
| `farmer`                | Registers in the mobile app with an Enrollment ID                                        | Mobile app            | Own farms, fields, soil, monitoring records, assessments, program enrollment, notifications                                                                                                                                                   |

Rules: a manager can only act on accounts of a lower rank (super admin 100, admin 80, program administrator 60, program partner 40, assessor 20, farmer 10). Who may create which role is in `backend/src/config/rbac.ts`. What a program administrator can open in the panel is in `admin/src/lib/access.ts`.

---

## 3. What the platform does

Every feature below lists what it does and where the code is. `BE` is `backend/src/`, `AD` is `admin/src/`. The Architecture file shows the full path of each file and what is in it.

### 3.1 Sign in, registration and passwords

What it does:

- Farmers register with an **Enrollment ID**. The app looks the ID up and shows the person's name with a masked email; the server takes the email from the ID, so it cannot be mistyped. An OTP sent by email confirms it.
- Staff sign in to the panel with email and password. Every attempt is recorded in login activity.
- Accounts created by the office start with a temporary password that cannot open a session. The person sets their own first.
- Forgot password uses an emailed code. Access tokens are short lived; refresh tokens keep the session going and are revoked on logout.
- A deactivated or deleted account stops working at once, even with a valid token.

| Layer  | Files                                                                                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE     | `routes/auth.routes.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `models/user.model.ts`, `otp.model.ts`, `refreshToken.model.ts`, `enrollmentId.model.ts`, `loginLog.model.ts`, `middlewares/authenticate.ts`, `utils/jwt.ts`, `validators/auth.schema.ts` |
| AD     | `pages/Login.tsx`, `components/auth/ForgotPasswordForm.tsx`, `store/authSlice.ts`, `store/endpoints/authApi.ts`, `lib/api.ts`                                                                                                                                                                |
| Tables | `users`, `roles`, `otp_codes`, `refresh_tokens`, `login_logs`                                                                                                                                                                                                                                |

### 3.2 Users and roles

What it does: staff create, edit, deactivate and delete users; set the role; assign an assessor to a farmer; see a user's farms. A program administrator manages only assessors and farmers. New accounts get an email with a temporary password.

| Layer | Files                                                                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE    | `routes/user.routes.ts`, `controllers/user.controller.ts`, `services/user.service.ts`, `config/rbac.ts`, `validators/user.schema.ts`, `utils/tempPassword.ts` |
| AD    | `pages/Users.tsx`, `UserForm.tsx`, `UserDetail.tsx`, `lib/access.ts`, `store/endpoints/usersApi.ts`                                                             |

### 3.3 Organization, branding, timezone and settings

What it does: the organization has a name, logo, favicon, contact details and hours, a timezone and a 12 or 24 hour clock. Changing them re-draws the panel for everyone and changes how every date is shown. A public `/config` endpoint gives the branding and locale to any client. The platform runs for one organization, created on the first seed. Settings also holds the email provider, password change and account deletion.

| Layer  | Files                                                                                                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `routes/organization.routes.ts`, `config.routes.ts`, `services/organization.service.ts`, `clock.service.ts`, `tenancy.service.ts`, `utils/datetime.ts`                                                                             |
| AD     | `pages/Settings.tsx`, `pages/settings/EmailTab.tsx`, `components/BrandingApplier.tsx`, `LocaleWatcher.tsx`, `lib/datetime.ts`, `lib/brandingCache.ts` |
| Tables | `organizations`                                                                                                                                                                                                                              |

### 3.4 Email

What it does: 21 emails are sent (verify email, sign in code, survey code, reset password, welcome, password changed, new program, enrolled, assessor assigned, visit started, assessment submitted, survey invite, survey received, qualified, not qualified, contract to sign, enrollment welcome, farm setup, returning enrollment, contact reply). The provider (SMTP or an API provider, with a fallback) is chosen in Settings and its secrets are stored encrypted. Settings can send a test message. While SMTP is off, codes are printed in the server terminal so local work is possible.

| Layer  | Files                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `services/emailTemplates.ts`, `mailer.service.ts`, `emailSettings.service.ts`, `routes/emailSettings.routes.ts`, `utils/secretBox.ts` |
| AD     | `pages/settings/EmailTab.tsx`, `store/endpoints/emailSettingsApi.ts`                                                                        |
| Tables | `email_settings`                                                                                                                              |

### 3.5 Farms and fields

What it does:

- Farms belong to a farmer; fields belong to a farm. Staff and farmers create, edit, reset and delete them. Deleting shows what else will be removed.
- A field holds crop, season, irrigation, sowing and harvest dates, a location point and a **boundary** (a drawn polygon). The server computes the acreage from the boundary and refuses a shape that crosses itself or is too small.
- Soil values and documents (PDF, images, Word) are kept per field. Soil is locked when a field is not in an active program.
- The field page shows the field's submitted assessments (with a Compare button when the farmer and an assessor have both submitted) and its history.

| Layer  | Files                                                                                                                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE     | `routes/farm.routes.ts`, `field.routes.ts`, `controllers/farm.controller.ts`, `field.controller.ts`, `fieldDetails.controller.ts`, `services/farm.service.ts`, `field.service.ts`, `fieldDetails.service.ts`, `utils/geo.ts`, `validators/farm.schema.ts`, `field.schema.ts`, `fieldDetails.schema.ts` |
| AD     | `pages/Farms.tsx`, `FarmForm.tsx`, `FarmDetail.tsx`, `Fields.tsx`, `FieldForm.tsx`, `FieldDetail.tsx`, `components/ui/BoundaryMap.tsx`, `MapPicker.tsx`, `PlaceSearch.tsx`, `components/FieldAssessmentsCard.tsx`, `lib/geo.ts`                                                                          |
| Tables | `farms`, `fields`, `field_soil`, `field_documents`                                                                                                                                                                                                                                                                     |

### 3.6 Programs and enrollment

What it does:

- A program has a name, unique code, type, start and end date, enrollment limit, and whether farmers can see it. Its status is date aware: Scheduled, Active, Ended, or Inactive when switched off.
- Creating a program is a five step wizard: Program, Assessment, Survey, Contract, Share.
- Farmers enroll their own fields, or staff enroll them. Each enrollment can name an **assessor**. Staff see the enrolled farmers of a program, their assessments and can unenroll.
- Ended or closed programs stop accepting assessment answers.

| Layer  | Files                                                                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `routes/program.routes.ts`, `controllers/program.controller.ts`, `services/program.service.ts`, `models/program.model.ts`, `validators/program.schema.ts`    |
| AD     | `pages/Programs.tsx`, `ProgramForm.tsx`, `ProgramDetail.tsx`, `EnrolledFarmers.tsx`, `components/ProgramStatusBadge.tsx`, `store/endpoints/programsApi.ts` |
| Tables | `programs`, `program_enrollments`, `program_enrollment_fields`                                                                                                   |

### 3.7 Program survey, contract and Enrollment ID

What it does:

- Each program can have a survey. Staff build a **survey template** (categories with icons, questions on a 0 to 3 scale, scoring ranges for Gold, Silver, Bronze) or copy the Global one.
- A public link and QR code lets a producer take the survey with no account: email code, answers, draft saving, submit. The score gives Gold, Silver, Bronze or Not Qualified. Staff may override the category with a reason.
- Staff send a **contract** (written clauses or an uploaded PDF). The producer signs by typing or drawing; the signed PDF records name, time and IP.
- On accept the backend issues the **Enrollment ID** and emails it with the app link. Submissions can also be withdrawn or deleted.
- Statuses: Registered, Under Review, Qualified, Not Qualified, Contract Sent, Contract Signed, Enrolled, Withdrawn.

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE     | `routes/programAdminSurvey.routes.ts`, `programAdminSurveyPublic.routes.ts`, `controllers/programAdminSurvey*.ts`, `services/programAdminSurvey.service.ts`, `programAdminSurveyTemplate.service.ts`, `programAdminContractTemplate.service.ts`, `contractPdf.service.ts`, `models/programAdminSurvey*.ts`, `programAdminContractTemplate.model.ts`, `enrollmentId.model.ts` |
| AD     | `pages/ProgramAdminSurvey.tsx`, `ProgramTemplateEditor.tsx`, `ProgramContractEditor.tsx`, `ProgramSurveySetup.tsx`, `ProgramSubmissions.tsx`, `ProgramSubmissionDetail.tsx`, `NewSurveyProgram.tsx`, `pages/program-survey/*` (the public pages), `components/ProgramShareModal.tsx`, `store/endpoints/programAdminSurveyApi.ts`                                             |
| Tables | `program_admin_surveys`, `program_admin_survey_templates`, `_categories`, `_questions`, `_scoring_rules`, `program_admin_contract_templates`, `program_admin_survey_submissions`, `program_admin_survey_contracts`                                                                                                                                                               |

The older single survey has no endpoints any more. New work goes through the program survey.

### 3.8 Assessments

What it does:

- A field is assessed **per program**. The farmer and an assessor each answer the program's questions; their scores are kept apart and can be compared.
- Questions live in **templates**. The **Global** template is the starting point (staff at admin level edit it). A program administrator can copy any template, or start blank. **Every program answers its own copy**, so later edits never reach a running program. A template can be locked, and locks itself once a submission exists.
- Two kinds of template: **multiple choice** (question by question, every answer has its own score) and **input based** (a category is a form the farmer fills in once, and staff score it in review). The KAB field monitoring worksheet ships as an input based template.
- Question types: scored 0 to 3, multiple choice, text, long text, number, date, boolean. Each question says whether a photo and a note are off, optional or required.
- Templates can be imported from and exported to Excel, with a downloadable sample file. An import can fill the open template or start a new named template.
- After submit an assessment is `in_review`. Staff score every answer, or each category, or the whole assessment in one number, check the limits and **approve** it; the farmer is notified. Only approved scores count in dashboards. The farmer sees a **regen health index** (0 to 100) with a rating and category scores.
- When both the farmer and an assessor have submitted, staff can open a **comparison** of the two, question by question, with each answer written out, its score out of the maximum and the difference. It opens from the field page and from the enrolled farmers list.
- A program can only change template while nothing has been answered. Submitted work is final.

| Layer  | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `routes/assessment.routes.ts`, `assessorAssessment.routes.ts`, `controllers/assessment*.ts`, `services/assessment.service.ts`, `assessmentTemplate.service.ts`, `assessmentMobile.service.ts`, `assessorAssessment.service.ts`, `assessmentReview.service.ts`, `assessmentAnswer.ts`, `assessmentImport.ts`, `models/assessment*.ts`, `validators/assessment.schema.ts`                                                                                                           |
| AD     | `pages/AssessmentTemplates.tsx`, `AssessmentCategories.tsx`, `AssessmentQuestions.tsx`, `CategoryForm.tsx`, `CategoryFormBuilder.tsx`, `QuestionForm.tsx`, `Submissions.tsx`, `AssessmentReview.tsx`, `AssessmentComparison.tsx`, `components/AssessmentSourceModal.tsx`, `TemplateImportModal.tsx`, `ImportTargetModal.tsx`, `QuestionKindModal.tsx`, `AssessmentTemplateUi.tsx`, `lib/assessmentScope.ts`, `lib/questionTypes.ts`, `store/endpoints/assessmentApi.ts` |
| Tables | `assessment_templates`, `assessment_categories`, `assessment_questions`, `assessment_question_options`, `assessment_responses`, `field_assessments`                                                                                                                                                                                                                                                                                                                                           |

### 3.9 Assessors and visits

What it does:

- An assessor is named on an enrollment and can assess only fields of those enrollments, in programs that have started.
- The assessor starts a **visit** to a field. Positions stream to the office live. Arrival is checked against the field boundary (150 m) or point (300 m); by default this is recorded, and `VISIT_ARRIVAL_ENFORCE=true` makes it a rule. Odd movement (mock location, impossible speed, jumps) is flagged. A visit with no position for 4 hours closes itself.
- The farmer is told when a visit starts and when the assessor arrives. Staff watch every active visit on a live map.

| Layer  | Files                                                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `routes/visit.routes.ts`, `assessorAssessment.routes.ts`, `assessorAssignment.routes.ts`, `services/visit.service.ts`, `assessorAssessment.service.ts`, `socket/visit.socket.ts`, `utils/geo.ts` |
| AD     | `pages/LiveVisits.tsx`, `pages/EnrolledFarmers.tsx`, `lib/socket.ts`, `store/endpoints/visitsApi.ts`                                                                                                   |
| Tables | `field_visits`, `field_visit_locations`, `assessor_assignments` (older), `program_enrollments.assessor_id`                                                                                             |

### 3.10 Field monitoring (practice records)

What it does: farmers record what they do on a field in eleven modules: training, soil samples, irrigation, pesticide use, synthetic fertilizer, tillage, organic amendments, crop diversification, nutrient management, crop intensification and animal integration. A record belongs to a field (no program), has a status and notes, and can carry attachments. The API also lists a module across every field of a farm.

| Layer  | Files                                                                                                                                                                                                                                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `routes/fieldModule.routes.ts`, `controllers/fieldModule.controller.ts`, `services/fieldModule.service.ts`, `models/fieldModule.model.ts`, `fieldModuleDocument.model.ts`, `validators/fieldModule.schema.ts`                                                                                       |
| Tables | `field_trainings`, `field_soil_samples`, `field_irrigations`, `field_pesticides`, `field_fertilizers`, `field_tillage_records`, `field_amendments`, `field_crop_records`, `field_nutrient_events`, `field_crop_intensifications`, `field_animal_integrations`, `field_module_documents` |

The admin panel does not have monitoring screens at the moment; the data is reached through the API.

### 3.11 Dashboards

What it does: the admin dashboard shows programs, farmers enrolled, fields enrolled, assessment submissions, farmers with an assessor and fields assessed by both sides, acreage enrolled over time, enrollment by program, assessment and score trends, regen health index benchmarking by program, and survey submission tiles. A program administrator sees their own programs. Farmers get their own dashboard by program.

| Layer | Files                                                                                                                                                        |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE    | `routes/dashboard.routes.ts`, `services/adminDashboard.service.ts`, `dashboard.service.ts`, `models/adminDashboard.model.ts`, `dashboard.model.ts` |
| AD    | `pages/Dashboard.tsx`, `components/dashboard/*`, `store/endpoints/dashboardApi.ts`                                                                     |

### 3.12 Notifications and live updates

What it does: events create a notification (new program, enrolled, assessor assigned, visit started or arrived, assessment submitted or reviewed, survey submitted, contract signed, contact enquiry) with a screen to open. They arrive live through Socket.IO, with the unread count, and by email when the event has one. The admin panel refreshes lists and counts by itself when data changes. Nothing outside the backend is needed for this; see section 6.9 and [backend/SOCKETS.md](backend/SOCKETS.md).

| Layer  | Files                                                                                                                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE     | `services/notification.service.ts`, `realtime.service.ts`, `socket/index.ts`, `liveSync.ts`, `notification.socket.ts`, `models/notification.model.ts`, `routes/notification.routes.ts` |
| AD     | `components/layout/NotificationBell.tsx`, `pages/Notifications.tsx`, `lib/socket.ts`, `lib/liveSync.ts`, `components/LiveSync.tsx`, `store/endpoints/notificationsApi.ts`                                          |
| Tables | `notifications`                                                                                                                                                                                    |

### 3.13 Help content and contact enquiries

What it does: staff write the FAQs shown in the mobile app and switch them on or off. A person can send a message from the app, even with a deactivated account. Staff read it, mark it read or resolved, and reply by email; replies are stored.

| Layer  | Files                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BE     | `routes/faq.routes.ts`, `contactEnquiry.routes.ts`, `services/faq.service.ts`, `contactEnquiry.service.ts`, `models/faq.model.ts`, `contactEnquiry.model.ts` |
| AD     | `pages/Faqs.tsx`, `pages/ContactEnquiries.tsx`, `store/endpoints/helpApi.ts`                                                                                       |
| Tables | `faqs`, `contact_enquiries`, `contact_enquiry_replies`                                                                                                             |

### 3.14 Login activity

What it does: a list of every sign in attempt with method, result, IP and reason (admin level only).

Files: BE `routes/loginLog.routes.ts`, `models/loginLog.model.ts`. AD `pages/LoginLogs.tsx`, `components/dashboard/LoginLogsTable.tsx`. Table `login_logs`.

### 3.15 Deleting data safely

What it does: deleting a program, user, survey, farm, field or template also deletes what belongs to it. The panel first shows exactly what will go. Rows are soft deleted (`deleted_at`), so nothing is lost by accident.

Files: BE `services/cascadeDelete.service.ts`, `db/softDelete.ts`, the `/deletion-summary` endpoints. AD `lib/confirmDelete.tsx`, `components/ui/DialogProvider.tsx`.

### 3.16 Import and export

What it does: assessment templates import from and export to Excel, with a sample file. The panel builds formatted Excel files in the browser. PDFs (contracts, signed contracts) are fetched with the access token.

Files: BE `services/assessmentImport.ts`, `contractPdf.service.ts`, `config/multer.ts`. AD `lib/workbook.ts`, `lib/downloadApiFile.ts`, `lib/openPdf.ts`, `components/TemplateImportModal.tsx`, `components/PdfDocument.tsx`.

---

## 4. Repository map

```text
farmer-app/
├── backend/                     Backend API (175 source files, 67 SQL migrations)
│   ├── src/
│   │   ├── app.ts, server.ts    Express app and process start
│   │   ├── config/              Environment, Cloudinary, uploads, roles
│   │   ├── routes/              24 files: one per area, plus index.ts
│   │   ├── controllers/         27 files: HTTP in and out
│   │   ├── services/            35 files: business rules
│   │   ├── models/              30 files: database queries
│   │   ├── validators/          20 files: Zod schemas
│   │   ├── middlewares/         7 files: auth, validation, uploads, limits, errors
│   │   ├── socket/              4 files: Socket.IO
│   │   ├── db/                  Clients, seeds, migration runner, migrations/
│   │   ├── utils/               11 helpers
│   │   └── types/               Shared types
│   ├── prisma/schema.prisma     56 models
│   ├── hoppscotch/, postman/    Master API collections (every endpoint)
│   ├── Dockerfile, .env.example, package.json, tsconfig.json
│   └── README.md
├── admin/                       Admin web panel (142 source files)
│   ├── src/
│   │   ├── App.tsx, main.tsx    Routes and entry
│   │   ├── pages/               51 files, including program-survey/ (public), settings/, survey/
│   │   ├── components/          41 files: layout/, ui/, dashboard/, auth/, and domain widgets
│   │   ├── store/               Redux, RTK Query api.ts and endpoints/ (17 files)
│   │   ├── lib/                 24 helpers: API client, dates, validation, geo, exports, sockets
│   │   ├── config/, types/
│   ├── public/                  Icons and images
│   ├── Dockerfile, nginx.conf, .env.example, vite.config.ts, tailwind.config.js
│   └── README.md
├── docs/                        Product flows
├── documents/                   Client briefs, the KAB worksheet, flow diagrams
├── ReadMeFolder/                Handover and planning notes
├── MASTER-README.md             This file
├── MASTER-ARCHITECTURE.md       Architecture and the file atlas
└── *.md                         Guides and plans at the root (see section 9)
```

---

## 5. Quick finder: I want to change...

| I want to change                      | Open                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The login screen                      | `admin/src/pages/Login.tsx`                                                                                                                    |
| Password rules                        | `backend/src/validators/auth.schema.ts`, `admin/src/lib/validation.ts`                                                                       |
| Token lifetime, OTP length            | `backend/.env` (`JWT_EXPIRES_IN`, `OTP_LENGTH`, `OTP_EXPIRY_MINUTES`)                                                                    |
| Who may create which role             | `backend/src/config/rbac.ts`                                                                                                                   |
| What a program administrator can open | `admin/src/lib/access.ts`                                                                                                                      |
| A menu item                           | `admin/src/components/layout/Sidebar.tsx`                                                                                                      |
| A new page                            | `admin/src/pages/`, `admin/src/App.tsx`                                                                                                      |
| Text of an email                      | `backend/src/services/emailTemplates.ts`                                                                                                       |
| The email provider                    | Settings, Email tab (`admin/src/pages/settings/EmailTab.tsx`)                                                                                  |
| Logo, colors, timezone                | Settings (`admin/src/pages/Settings.tsx`), theme in `admin/tailwind.config.js`                                                               |
| Farm or field fields                  | `backend/src/validators/farm.schema.ts`, `field.schema.ts`, `admin/src/pages/FarmForm.tsx`, `FieldForm.tsx`                              |
| Boundary rules                        | `backend/src/utils/geo.ts`, `backend/src/services/field.service.ts`, `admin/src/lib/geo.ts`                                                |
| Program fields or rules               | `backend/src/validators/program.schema.ts`, `services/program.service.ts`, `admin/src/pages/ProgramForm.tsx`                               |
| Survey questions and scoring          | `admin/src/pages/ProgramTemplateEditor.tsx`, `backend/src/services/programAdminSurveyTemplate.service.ts`                                    |
| Contract wording or PDF layout        | `admin/src/pages/ProgramContractEditor.tsx`, `backend/src/services/contractPdf.service.ts`                                                   |
| How an Enrollment ID is made          | `backend/src/models/enrollmentId.model.ts`                                                                                                     |
| Assessment questions and types        | `admin/src/pages/QuestionForm.tsx`, `backend/src/services/assessment.service.ts`, `assessmentAnswer.ts`                                    |
| How an answer is scored               | `backend/src/services/assessmentAnswer.ts`, `assessmentMobile.model.ts`                                                                      |
| Review and approval                   | `admin/src/pages/AssessmentReview.tsx`, `backend/src/services/assessmentReview.service.ts`                                                   |
| The farmer and assessor comparison    | `admin/src/pages/AssessmentComparison.tsx`, `backend/src/services/fieldDetails.service.ts`, `backend/src/models/assessmentMobile.model.ts` |
| The regen health index rating         | `backend/src/services/assessmentMobile.service.ts` (`ratingFor`)                                                                             |
| Assessment Excel import               | `backend/src/services/assessmentImport.ts`, `admin/src/components/TemplateImportModal.tsx`                                                   |
| Who may edit a template               | `backend/src/services/assessmentTemplate.service.ts`, `admin/src/lib/assessmentScope.ts`                                                     |
| A monitoring module                   | `backend/src/models/fieldModule.model.ts`, `validators/fieldModule.schema.ts`                                                                |
| Visit rules (tolerance, expiry)       | `backend/src/services/visit.service.ts`, `backend/src/config/env.ts`                                                                         |
| A dashboard number                    | `backend/src/models/adminDashboard.model.ts`, `admin/src/pages/Dashboard.tsx`                                                                |
| A notification                        | `backend/src/models/notification.model.ts`, `services/notification.service.ts`                                                               |
| An FAQ or the contact form            | `admin/src/pages/Faqs.tsx`, `ContactEnquiries.tsx`, `backend/src/services/faq.service.ts`, `contactEnquiry.service.ts`                   |
| Rate limits                           | `backend/src/middlewares/rateLimiters.ts`, `.env` (`RATE_LIMIT_*`)                                                                         |
| Upload size and type                  | `backend/src/config/multer.ts`                                                                                                                 |
| Error messages                        | `backend/src/utils/ApiError.ts`, the service that throws                                                                                       |
| What a delete removes                 | `backend/src/services/cascadeDelete.service.ts`                                                                                                |
| A database column                     | A new file in`backend/src/db/migrations/` and `backend/prisma/schema.prisma`                                                                 |
| An Excel export from the panel        | `admin/src/lib/workbook.ts`                                                                                                                    |
| An API call from the panel            | `admin/src/store/endpoints/`                                                                                                                   |

Step by step recipes are in [MASTER-ARCHITECTURE.md](MASTER-ARCHITECTURE.md), section 9.

---

## 6. Getting started

This section takes you from an empty computer to a running backend and admin panel, then shows how to run both in Docker. For the outside accounts (database, Cloudinary, email) and how to get their keys, read [THIRD-PARTY-SERVICES.md](THIRD-PARTY-SERVICES.md) first or alongside this.

### 6.1 What you need

| Tool                           | Version                                                                        | Used for                                               |
| ------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Node.js and npm                | Node 22 (the Docker images use it;`backend/package.json` allows 18 or newer) | Running the backend and the admin panel                |
| PostgreSQL                     | 13 or newer                                                                    | The database                                           |
| Git                            | any                                                                            | Getting the code                                       |
| Docker                         | optional                                                                       | Running PostgreSQL or the whole platform in containers |
| Cloudinary account             | free plan is enough                                                            | File uploads (required)                                |
| Email account (SMTP or Resend) | optional while testing                                                         | Sign in codes and emails                               |

### 6.2 Quick start on your own computer

**Step 1. Get the code and install.**

```bash
git clone <repository-url> farmer-app
cd farmer-app/backend && npm install
cd ../admin && npm install
```

**Step 2. Start a database.** Use an existing PostgreSQL, or start one with Docker:

```bash
docker run --name farmer-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=farmer_app -p 5432:5432 -d postgres:16
```

Its connection string is `postgresql://postgres:postgres@localhost:5432/farmer_app`. The database user must be allowed to create the `pgcrypto` extension (the `postgres` user can).

**Step 3. Configure the backend.**

```bash
cd backend
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

Open `backend/.env` and set at least:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/farmer_app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
JWT_SECRET=<a long random text>
DB_SYNC=true
DB_SEED=true
```

Keep `SMTP_ENABLED=false` while you test. Sign in codes are then printed in the backend terminal instead of being emailed. The three Cloudinary values are required, the server will not start without them. Where to get each value is in [THIRD-PARTY-SERVICES.md](THIRD-PARTY-SERVICES.md).

**Step 4. Run the backend.**

```bash
npm run dev
```

The first start builds every table (`DB_SYNC=true`) and creates the roles, the organization, the super admin and the starter FAQs (`DB_SEED=true`). When it says the server is running, stop it, set both flags back to `false` in `.env` and start it again. Check it:

```text
GET http://localhost:5000/api/v1/health        server is up
GET http://localhost:5000/api/v1/health/db     database is reachable
```

**Step 5. Run the admin panel.**

```bash
cd admin
cp .env.example .env          # Windows PowerShell: copy .env.example .env
npm run dev
```

`admin/.env` already points to `http://localhost:5000/api/v1`. Open `http://localhost:3001`.

**Step 6. Sign in.** Use `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from `backend/.env`.

### 6.3 Backend commands

Run these inside `backend/`.

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`       | Starts the API with automatic reload on`http://localhost:5000` |
| `npm run typecheck` | Checks the types without building (`tsc --noEmit`)             |
| `npm run build`     | Generates the Prisma client and compiles to`dist/`             |
| `npm start`         | Runs the compiled build (`node dist/server.js`)                |
| `npm run db:check`  | Checks the database connection                                   |
| `npm run db:clock`  | Re applies the organization timezone                             |

`npm install` also runs `prisma generate` by itself. After you edit `prisma/schema.prisma`, run `npx prisma generate`.

### 6.4 Admin panel commands

Run these inside `admin/`.

| Command           | What it does                                           |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`   | Starts the panel on`http://localhost:3001`           |
| `npm run build` | Type checks and makes the production files in`dist/` |
| `npm run lint`  | Runs the linter                                        |

The panel calls the backend directly at the address in `VITE_API_BASE_URL`; there is no proxy. That address is written into the files when you build, so after you change it you must build again. The backend must allow the panel's address in `CORS_ORIGIN` (`*` is fine on your own computer).

### 6.5 Docker

Both apps have a Dockerfile. Docker is optional on your own computer and is the normal way to deploy.

|             | Backend (`backend/Dockerfile`)             | Admin panel (`admin/Dockerfile`)        |
| ----------- | -------------------------------------------- | ----------------------------------------- |
| Base        | Node 22 Alpine, two stages (build, then run) | Node 22 Alpine to build, Nginx to serve   |
| Listens on  | port`5000`                                 | port`80`                                |
| Starts with | `node dist/server.js`                      | Nginx                                     |
| Settings    | Environment variables at run time            | `VITE_API_BASE_URL` as a build argument |
| Health      | `GET /api/v1/health`                       | `GET /health`                           |

**Run the backend in Docker**

```bash
cd backend
docker build -t farmer-backend .
docker run -d --name farmer-backend -p 5000:5000 --env-file .env farmer-backend
```

`--env-file .env` hands every value from `backend/.env` to the container. Two things to change in that file when the database is on your own computer:

- Inside a container `localhost` means the container itself. Use `host.docker.internal` as the database host (Windows and Mac), for example `postgresql://postgres:postgres@host.docker.internal:5432/farmer_app`. On Linux, add `--add-host=host.docker.internal:host-gateway` to the `docker run` command.
- Keep `DB_SYNC=true` for the first start of a new database, then set it back to `false`.

**Run the admin panel in Docker**

```bash
cd admin
docker build -t farmer-admin --build-arg VITE_API_BASE_URL=http://localhost:5000/api/v1 .
docker run -d --name farmer-admin -p 3001:80 farmer-admin
```

Open `http://localhost:3001`. For a live server use the real backend address as the build argument, for example `https://api.yourdomain.com/api/v1`, and put the panel's address in the backend `CORS_ORIGIN`.

**Run everything in Docker** (database, backend, panel)

1. Start PostgreSQL with the command in step 2 of 6.2.
2. Run the backend container as above, with `DB_SYNC=true` and `DB_SEED=true` the first time.
3. Run the admin container as above.

**Useful Docker commands**

```bash
docker ps                          # what is running
docker logs -f farmer-backend      # follow the backend log
docker stop farmer-backend         # stop
docker rm farmer-backend           # remove the stopped container
```

**On a hosting platform** (for example Coolify, the Dockerfile comments assume it, or any other Docker host): create two services from the two Dockerfiles. Add the backend values from section 6.6 as environment variables of the backend service, never inside the image. Add `VITE_API_BASE_URL` as a build variable of the admin service. Do not copy `.env` into an image; the `.dockerignore` files already leave it out.

### 6.6 Environment variables (backend)

Copy `backend/.env.example` to `backend/.env`. Variables marked **required** stop the server at start with a clear message when they are empty.

| Variable                                                                                               | Default                                    | Purpose                                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------- |
| `NODE_ENV`                                                                                           | `development`                            | `production` on a live server                                                 |
| `PORT`                                                                                               | `5000`                                   | Port the API listens on                                                         |
| `CORS_ORIGIN`                                                                                        | `*`                                      | Allowed browser origins, comma separated. Use the admin address in production.  |
| `API_PREFIX`                                                                                         | `/api/v1`                                | Base path of every route                                                        |
| `DATABASE_URL` **required**                                                                    | none                                       | PostgreSQL connection string                                                    |
| `DB_SSL`                                                                                             | automatic                                  | `true` or `false` to force SSL on or off for the database                   |
| `DB_SYNC`                                                                                            | `false`                                  | `true` applies pending migrations when the server starts                      |
| `DB_SEED`                                                                                            | `false`                                  | `true` creates roles, the super admin and starter FAQs when the server starts |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` **required**        | none                                       | File storage                                                                    |
| `JWT_SECRET` **required**                                                                      | none                                       | Signs every login. Use a long random text.                                      |
| `JWT_EXPIRES_IN`                                                                                     | `15m`                                    | Life of an access token                                                         |
| `REFRESH_TOKEN_EXPIRY_DAYS`                                                                          | `7`                                      | Life of a refresh token                                                         |
| `OTP_LENGTH`, `OTP_EXPIRY_MINUTES`                                                                 | `6`, `10`                              | One time codes                                                                  |
| `SMTP_ENABLED`                                                                                       | `false`                                  | `false` prints codes in the terminal, `true` sends email                    |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`                            | none,`587`, `false`                    | SMTP server. Also editable in Settings, then Email, which takes priority.       |
| `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`                                                                | `Farmer App`, `no-reply@farmerapp.com` | Sender shown in emails                                                          |
| `APP_URL`                                                                                            | empty                                      | Admin panel address, used for links in emails                                   |
| `SURVEY_APP_URL`                                                                                     | `APP_URL`                                | Only when the survey pages are on a different address                           |
| `MOBILE_APP_URL`                                                                                     | empty                                      | Mobile app link, in the welcome email and the "Open the app" button of farmer and assessor emails |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX`                                   | `true`, `900000`, `100`              | Global rate limit per client                                                    |
| `VISIT_ARRIVAL_ENFORCE`, `VISIT_ARRIVAL_BOUNDARY_TOLERANCE_M`, `VISIT_ARRIVAL_POINT_TOLERANCE_M` | `false`, `150`, `300`                | Visit arrival rule                                                              |
| `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_NAME`                                  | see`.env.example`                        | The first super admin, created by`DB_SEED=true`                               |

Admin panel: only `VITE_API_BASE_URL`, in `admin/.env`. It is the full backend address including `/api/v1`.

### 6.7 Database changes and backups

- Migrations are numbered SQL files in `backend/src/db/migrations/`, applied in order and recorded in a `_migrations` table. A file that was applied is never run again.
- For a new database, start the backend once with `DB_SYNC=true` and `DB_SEED=true`.
- For an update that adds a migration, deploy and start once with `DB_SYNC=true`, then set it back to `false`.
- Take a backup before a deploy that adds a migration: `pg_dump "<DATABASE_URL>" -Fc -f before-update.dump`. Restore with `pg_restore -d "<DATABASE_URL>" --clean before-update.dump`.

### 6.8 When something does not work

| Problem                                   | Check                                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Missing required environment variable` | The named value is empty in`backend/.env`                                                              |
| Backend cannot reach the database         | `DATABASE_URL`, that PostgreSQL is running, and `host.docker.internal` when the backend is in Docker |
| `permission denied to create extension` | Use the`postgres` user for the first start; migration 002 needs `pgcrypto`                           |
| Port already in use                       | Another process holds 5000 or 3001. Stop it or change`PORT`.                                           |
| Panel shows a network error               | `VITE_API_BASE_URL` is wrong or the backend is not running. Rebuild the panel after changing it.       |
| Panel request blocked by the browser      | Add the panel's address to`CORS_ORIGIN`                                                                |
| No sign in code arrives                   | With`SMTP_ENABLED=false` the code is in the backend terminal                                           |
| Uploads fail                              | The Cloudinary values are wrong                                                                          |

### 6.9 Live updates (Socket.IO)

Notifications, the live visit map and the "list changed" refresh in the admin panel arrive without a page reload. This is Socket.IO, and it is part of the backend.

**You do not need to set up anything for it.** There is no outside service, no account, no API key and no extra setting. It starts with the backend and uses the same address and port as the API (path `/socket.io`).

How it works in short:

1. A screen connects once, with the same token it uses for API calls. A producer on the survey status page connects with the link token instead.
2. The server puts the connection into private rooms: one for the person (`user:<id>`), one for office staff (`admins`), one for a survey status page (`submission:<id>`).
3. When data changes, the backend sends one short message to the right room (`sync` for the mobile app, `data:changed` for the admin panel, `notification:new`, `visit:location`, `application:changed`).
4. The screen reloads the fresh data with a normal API request.

Two things matter when you deploy: a proxy in front of the backend must pass WebSocket connections on `/socket.io`, and `CORS_ORIGIN` must list the panel address. Run one backend instance. The full guide, with every message, how to try it and how to fix problems, is [backend/SOCKETS.md](backend/SOCKETS.md).

### 6.10 Try the API with Postman or Hoppscotch

Two ready made collections hold **every endpoint** (255 requests), so you can call the API without writing code. Both come with an environment file.

| Tool | Collection | Environment | Guide |
|---|---|---|---|
| Postman | `backend/postman/farmer-app.master.postman_collection.json` | `backend/postman/farmer-app.master.postman_environment.json` | [backend/postman/README.md](backend/postman/README.md) |
| Hoppscotch | `backend/hoppscotch/master-collection.json` | `backend/hoppscotch/master-environment.json` | [backend/hoppscotch/README.md](backend/hoppscotch/README.md) |

**Postman**

1. Click **Import** and drop both Postman files.
2. Choose the environment **Farmer App - Local** at the top right.
3. Edit the environment: set `baseUrl` (local: `http://localhost:5000/api/v1`), `adminEmail` and `adminPassword` (the super admin from `backend/.env`).
4. Open **Auth, Login** and click **Send**.

**Hoppscotch** (web app or desktop app)

1. **Environments**, **Import**, choose `master-environment.json`, then select **Farmer App (local)** at the top right.
2. **Collections**, **Import**, **Hoppscotch**, choose `master-collection.json`.
3. Edit the environment: set `baseUrl`, `adminEmail` and `adminPassword` as above.
4. Open **Auth, Login** and click **Send**.

After the first Login the token and the ids from responses are saved by themselves, so every other request works. If a web browser blocks calls to a backend on your own computer, use the Hoppscotch desktop app. Both guides explain roles, file uploads, a good order to try things and how to fix errors.

The collections are built from the route files. After you add, remove or rename a route, run `npx tsx postman/build-collections.ts` inside `backend/` and import the files again.

---

## 7. How the code is organized

**Backend.** Each area has the same five files: route, controller, service, model, validator. The route sets the path and the role gate. The controller is thin. The service holds the rules and the ownership checks. The model holds the queries. The validator holds the Zod schema. A change to one area touches one file in each layer.

**Admin.** Pages in `pages/` read and write through RTK Query hooks from `store/endpoints/`. Shared widgets are in `components/`. Helpers are in `lib/`. The `Sidebar`, `ProtectedRoute` and `lib/access.ts` decide what each role sees.

**Conventions every change follows**

1. Validate on the backend and on the admin form. The backend decides.
2. Check ownership in the service, not only the role on the route.
3. Filter soft deleted rows (`deleted_at IS NULL`). Delete through `cascadeDelete.service.ts`.
4. Throw `ApiError` so responses keep the standard shape: success `{ success, message, data, meta? }`, error `{ success: false, message, code, errors? }`.
5. Schema changes are numbered SQL migrations that are safe to run twice, mirrored in `schema.prisma`.
6. Comments are short, one or two lines, and technical.
7. When an endpoint the mobile app calls changes, update the architecture file and rebuild the API collections, then tell the mobile developer.

---

## 8. Testing and API collections

- The backend has no automated test suite. Use the master collections to exercise the API: `backend/postman/farmer-app.master.postman_collection.json` for Postman and `backend/hoppscotch/master-collection.json` for Hoppscotch. Each holds all 255 requests. How to import and use them is in `backend/postman/README.md` and `backend/hoppscotch/README.md`. After a route change, rebuild both with `npx tsx postman/build-collections.ts` from `backend/`.
- The admin panel is checked with `npm run build` (type check and build) and `npm run lint`.
- Health: `GET /api/v1/health` and `GET /api/v1/health/db`.

---

## 9. Documentation index

**Master files**

| File                        | What it is                                                           |
| --------------------------- | -------------------------------------------------------------------- |
| `MASTER-README.md`        | This file: features and where the code is                            |
| `MASTER-ARCHITECTURE.md`  | Architecture, database, full API reference, every source file        |
| `backend/SOCKETS.md` | How live updates work, every message, and how to try them. No outside service needed. |
| `THIRD-PARTY-SERVICES.md` | The outside services in use, how to get each key and where to put it |

**Per app**

| File                                                            | What it is                             |
| --------------------------------------------------------------- | -------------------------------------- |
| `backend/README.md`                                           | Older backend notes                    |
| `admin/README.md`                                             | Older admin notes and the theme colors |
| `backend/postman/README.md`, `backend/hoppscotch/README.md` | The master API collections and how to import and use them |

**Product flows** (`docs/`)

| File                                         | What it covers                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `eligibility-enrollment-flow-CLIENT.md`    | The eligibility, contract and enrollment flow, for review by the client             |
| `eligibility-enrollment-flow-TECHNICAL.md` | The same flow, technical plan                                                       |
| `standalone-survey-flow.md`                | The public survey by link                                                           |
| `docs/*.pdf`, `documents/*`              | Flow diagrams, briefs, the KAB field monitoring worksheet and other client material |

**`ReadMeFolder/`**: country and phone input kit, mobile release handover, program gap analysis, visit tracking requirements and production readiness, navigation notes.

---

## 10. Notes for the next developer

- The admin panel currently has no field monitoring screens. The backend endpoints exist and the mobile app uses them.
- `/reports` in the panel is a placeholder page. Reports are not built.
- `admin/src/pages/Assignments.tsx` (older assessor to farmer assignment page) is not in the route tree. Assessors are now set per enrollment. The `/assessor-assignments` endpoints and table still exist.
- The older single survey has no endpoints any more. Its tables stay in the database because the survey status link and the program survey still read from them. New work uses the program survey (`/program-admin-surveys`).
- The backend has no automated tests. Any change to a permission, a score rule or a migration deserves a manual pass with the API collections.
- Migrations are plain SQL run by `DB_SYNC`. `schema.prisma` is kept in step by hand; run `npx prisma generate` after editing it.
- Sample data helpers exist for the contact enquiries screen (`backend/src/db/seedContactEnquiries.ts`).
