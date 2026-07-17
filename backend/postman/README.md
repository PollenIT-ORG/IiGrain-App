# Farmer App - Postman Collection

Complete API collection for the Farmer App backend - **76 endpoints** across all
modules, with example responses (every field) and chaining test scripts.

## Files

| File | What it is |
|------|------------|
| `farmer-app.postman_collection.json` | The collection (import into Postman → Collections) |
| `farmer-app.postman_environment.json` | The **Local** environment (import into Postman → Environments) |

## Import (one-time)

1. Postman → **Import** → drop both JSON files.
2. Top-right environment dropdown → select **Farmer App - Local**.
3. Make sure the backend is running locally: `npm run dev` (defaults to
   `http://localhost:5000`). `baseUrl` is `http://localhost:5000/api/v1`.

## How auth works

- The **collection** has Bearer auth set to `{{token}}`. Every protected request
  inherits it automatically.
- **Public** requests (health, config, register, login, OTP, roles, refresh,
  logout, forgot/reset password) override to **No Auth**.
- Run **Auth → Login** first - its test script saves `token`, `refreshToken`,
  and `userId` to the environment. After that, all protected requests just work.
  (The Login body defaults to the seeded super-admin via `{{adminEmail}}` /
  `{{adminPassword}}`.)

## Auto-saved variables (chaining)

Create/login requests save IDs so later requests can reference them:

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

> Some IDs need a real value to chain (e.g. `farmerId` for "Create farm").
> Create a farmer via **Users → Create user** (role `farmer`) - it saves
> `farmerId` - or paste a real UUID into the environment.

## Recommended run order

1. **Auth → Login** (saves token)
2. **Users → Create user** (role `farmer`) → saves `farmerId`; again with role
   `assessor` → saves `assessorId`
3. **Organizations → Get current organization** → saves `orgId`
4. **Farms → Admin → Create farm** (uses `farmerId`, `orgId`) → saves `farmId`
5. **Fields → Admin → Create field** (uses `farmId`) → saves `fieldId`
6. **Assessments → Admin → Create category** → `categoryId`, then **Create
   question** → `questionId`
7. **Assessor Assignments → Assign** (uses `assessorId`, `farmerId`)
8. **Assessments → Mobile** flow: upload evidence → summary → question list →
   save answer → review → submit

## Test scripts

Every request asserts:
- `Status code is <expected>`
- `Response success is true`

Create/login requests additionally save the relevant IDs.

## Multipart requests

- **Assessments → Admin → Import questions from Excel** - form field `file`
  (attach a `.xlsx`/`.xls`).
- **Assessments → Mobile → Upload evidence photos** - form field `files`
  (attach 1-5 images; add the `files` field multiple times for multiple photos).

Both need a file selected in Postman's **Body → form-data** before sending.

## Folder structure

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

## Notes baked into the examples

- NUMERIC fields (`area_acres`, `percentage` on submit) come back as **strings**.
- Mobile assessment percentages are **numbers** (one decimal); the submit
  snapshot `percentage` is a **string** (two decimals).
- `data` is `null` for delete/logout/reset/reorder responses.
- Pagination `meta` is `{ page, limit, total, totalPages }`; admin **List fields**
  and **List questions** also nest `meta` inside `data` (intentional, per the
  controllers).
