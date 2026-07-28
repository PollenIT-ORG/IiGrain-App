# Hoppscotch Collection

Hoppscotch can't import Postman collections cleanly, so these files are in
**Hoppscotch's own native format**. One collection, all **76 endpoints**,
organised into folders.

## Import (one-time)

1. **Environment** - Hoppscotch → **Environments** (left) → **Import** →
   **Hoppscotch Environment** → pick `environment.json`. Then select it as the
   active environment (top-right dropdown).
2. **Collection** - Hoppscotch → **Collections** → **Import / Export** →
   **Import** → **Hoppscotch** → pick `full-collection.json`.

Make sure the backend is running locally (`npm run dev`, port 5000). `baseUrl`
is `http://localhost:5000/api/v1`.

## How auth works

- Protected requests carry `Authorization: Bearer <<token>>`.
- Public requests (health, config, auth, roles) use **No Auth**.
- Run **Auth → Login (password)** first - its test script saves `token`,
  `refreshToken`, and `userId` to the environment. After that, everything else
  just works. (Login defaults to the seeded super admin via `<<adminEmail>>` /
  `<<adminPassword>>`.)

## Auto-saved variables (chaining)

Create/login requests save IDs via `pw.env.set(...)`:

| Request | Saves |
|---------|-------|
| Auth → Login / Verify OTP | `token`, `refreshToken`, `userId` |
| Auth → Refresh token | `token` |
| Users → Create user | `userId` (+ `farmerId`/`assessorId` by role) |
| Organizations → Create / Get current | `orgId` |
| Farms → Create (admin/mobile) | `farmId` |
| Fields → Create (admin/mobile) | `fieldId` |
| Assessments → Create category | `categoryId` |
| Assessments → Create question | `questionId` |
| Assessor Assignments → Assign | `assignmentId` |
| Assessments (mobile) → Upload evidence | `evidenceUrl` |

> For requests that need a real `farmerId`/`assessorId`, create those users
> first via **Users → Create user** (role `farmer` / `assessor`) - they save the
> id automatically - or paste a real UUID into the environment.

## Recommended run order

1. **Auth → Login** (saves token)
2. **Users → Create user** (role `farmer`) → `farmerId`; again (role `assessor`)
   → `assessorId`
3. **Organizations → Get current organization** → `orgId`
4. **Farms → Admin → Create farm** → `farmId`
5. **Fields → Admin → Create field** → `fieldId`
6. **Assessments → Admin → Create category** → `categoryId`; **Create question**
   → `questionId`
7. **Assessor Assignments → Assign**
8. **Assessments → Mobile**: upload evidence → summary → question list → save
   answer → review → submit

## Test scripts

Every request asserts `Status is <expected>` and `success is true` (via
`pw.test`). Create/login requests also save the relevant IDs.

## Multipart requests

- **Assessments → Admin → Import questions from Excel** - file field `file`.
- **Assessments → Mobile → Upload evidence photos** - file field `files`
  (1-5 images).

Attach a file in the request's **Body** before sending.

## Folder structure (`full-collection.json`)

```
Farmer App - Complete API
├── Health (2)
├── Config (1)
├── Auth (9)
├── Roles (1)
├── Login Logs (admin) (1)
├── Users (admin) (7)
├── Profile (mobile) (4)
├── Organizations (admin) (8)
├── Farms
│   ├── Admin (5)
│   └── Mobile (my farms) (4)
├── Fields
│   ├── Admin (5)
│   └── Mobile (my farm fields) (5)
├── Assessor Assignments (3)
└── Assessments
    ├── Admin - Categories (6)
    ├── Admin - Questions (7)
    └── Mobile (my field assessment) (8)
```

## Environment variables

| Variable | Set by | Used by |
|----------|--------|---------|
| `baseUrl` | pre-filled (`http://localhost:5000/api/v1`) | all requests |
| `token` | Login / Verify OTP / Refresh | all protected requests |
| `refreshToken` | Login / Verify OTP | Refresh, Logout |
| `userId` | Create user / Login | user routes, assign to org |
| `farmerId` | Create user (role=farmer) | Create farm (ownerId), assignments |
| `assessorId` | Create user (role=assessor) | assessor assignments |
| `orgId` | Create org / Get current org / Get my org | org routes, create farm |
| `farmId` | Create farm / My farms | farm + field routes |
| `fieldId` | Create field | field + mobile assessment routes |
| `categoryId` | Create category / Field summary | question + mobile routes |
| `questionId` | Create question / Question list | question + answer routes |
| `assignmentId` | Assign assessor | Unassign |
| `evidenceUrl` | Upload evidence | Save answer (evidenceUrls) |
| `otpCode` | you (default `123456`) | Verify OTP, Reset password |
| `testEmail` / `testPassword` | you | Register, OTP flows |
| `adminEmail` / `adminPassword` | you (seeded super admin) | Login |

> The older per-module files (`auth.json`, `assessments.json`, `sprint-1-*`,
> `day-3-*`, etc.) are kept for reference but are superseded by
> `full-collection.json`, which covers everything.

## Notes for the app developer

Each folder holds a short guide for one change. Read the folder, not the code.

| Folder | What it covers | Status |
|--------|----------------|--------|
| `sockets/` | Socket.IO setup and every event the server emits | live |
| `live-sync/` | The `sync` event for multi-device and cross-actor updates | live |
| `mobile-api-changes/` | API changes already shipped that the app must pick up | live |
| `notification-redirect/` | Where each notification type should navigate to | live |
| `answer-save-contract/` | The save-answer request and response shape | live |
| `program-scoped-assessments/` | Assessments filtered by the enrolled program | live |
| `field-farm-soil-updates/` | Soil fields unlocking after enrolment | live |
| `farm-dashboard-year/` | Year filter on the farm dashboard | live |
| `pagination-and-changes/` | Pagination envelope used across list endpoints | live |
| `profile-picture/` | Avatar upload | live |
| `enrollment-id-registration/` | Enrollment ID on first-time registration | **planned, do not build yet** |
