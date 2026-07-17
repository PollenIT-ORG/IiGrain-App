# Farmer App - Backend

REST API for the Farmer App, built with **Node.js + Express + PostgreSQL (Neon)**, written in **TypeScript**.

---

## Tech Stack

| Layer          | Technology                          |
| -------------- | ----------------------------------- |
| Language       | TypeScript 5 (strict mode)          |
| Runtime        | Node.js (>= 18, ES Modules)         |
| Framework      | Express 4                           |
| Database       | PostgreSQL (Neon, serverless)       |
| DB Driver      | `pg` (raw SQL via a connection pool)|
| File Storage   | Cloudinary                          |
| Security       | Helmet, CORS, rate limiting         |
| Logging        | Morgan (HTTP) + custom logger       |
| Dev runner     | `tsx` (run TS directly, hot reload) |
| Build          | `tsc` → `dist/`                     |

---

## Folder Structure

```
backend/
├── src/
│   ├── config/                 # Centralized configuration
│   │   ├── env.ts              # Loads & validates env vars (fails fast if missing)
│   │   └── cloudinary.ts       # Cloudinary SDK setup
│   │
│   ├── controllers/            # HTTP request handlers (thin)
│   │   ├── health.controller.ts
│   │   └── auth.controller.ts
│   │
│   ├── routes/                 # Route definitions (versioned under /api/v1)
│   │   ├── index.ts            # Central aggregator - register new routes here
│   │   ├── health.routes.ts
│   │   └── auth.routes.ts
│   │
│   ├── middlewares/            # Express middlewares
│   │   ├── errorHandler.ts     # Global error handler (consistent errors)
│   │   ├── notFound.ts         # 404 handler
│   │   ├── authenticate.ts     # JWT auth guard + role authorization
│   │   ├── rateLimiters.ts     # Route-specific rate limiters
│   │   └── validate.ts         # Zod validation middleware
│   │
│   ├── validators/             # Zod request schemas (per feature)
│   │   └── auth.schema.ts
│   │
│   ├── services/               # Business logic (the "how")
│   │   ├── auth.service.ts     # Register / login / OTP logic
│   │   └── mailer.service.ts   # Email + OTP (prints to terminal when SMTP off)
│   │
│   ├── models/                 # DB queries per table
│   │   ├── user.model.ts
│   │   ├── otp.model.ts
│   │   └── loginLog.model.ts
│   │
│   ├── db/
│   │   ├── pool.ts             # Shared PostgreSQL connection pool (typed query<T>)
│   │   ├── healthcheck.ts      # Standalone DB connectivity check
│   │   ├── sync.ts             # Migration runner (DB_SYNC)
│   │   ├── seed.ts             # Seed runner (DB_SEED) - roles
│   │   ├── softDelete.ts       # Soft-delete helpers (paranoid mode)
│   │   └── migrations/         # SQL migration files (schema history)
│   │
│   ├── types/
│   │   └── index.ts            # Shared TypeScript types (env, errors, models)
│   │
│   ├── utils/
│   │   ├── ApiError.ts         # Custom error class + factory methods
│   │   ├── ApiResponse.ts      # Consistent success response envelope
│   │   ├── asyncHandler.ts     # Wraps async controllers to catch errors
│   │   ├── logger.ts           # Structured logger
│   │   ├── jwt.ts              # Sign / verify JWTs
│   │   ├── otp.ts              # Generate OTP codes + expiry
│   │   └── validate.ts         # Tiny request-body validator
│   │
│   ├── app.ts                  # Express app: middlewares + routes + error handler
│   └── server.ts               # Entry point: starts server, sync/seed, shutdown
│
├── postman/
│   └── farmer-app.postman_collection.json   # Import into Postman to hit the API
├── dist/                       # Compiled JS output (gitignored, created by build)
├── .env                        # Secrets (gitignored)
├── .env.example                # Template for .env
├── tsconfig.json               # TypeScript compiler config (strict, NodeNext)
├── package.json
└── README.md
```

### Why this structure?
- **Type-safe:** TypeScript in strict mode catches whole classes of bugs at compile time, which matters as schemas and features keep changing. Shared types live in `src/types/`.
- **Separation of concerns:** routes → controllers → services → models. Each layer has one job, so the codebase stays readable as it grows.
- **Scalable:** adding a feature means adding files in `controllers/`, `routes/`, `services/`, `models/` and registering one line in `routes/index.ts`. `app.ts` never changes.
- **Schema-change friendly:** schemas live in `db/migrations/` as ordered SQL files. Schemas *will* evolve - new changes are always new migration files, never edits to old ones.

---

## Getting Started

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Set up environment variables
Copy the template and fill in real values:
```bash
cp .env.example .env
```
> The real `.env` already contains the Neon DB URL and Cloudinary credentials for this project. **It is gitignored - never commit it.**

### 3. Verify the database connection
```bash
npm run db:check
```
Expected: `Database is reachable`

### 4. Run the server
```bash
npm run dev        # development - runs TS directly with hot reload (tsx watch)
```
For production, build first, then start the compiled output:
```bash
npm run build      # compiles src/*.ts → dist/*.js
npm start          # runs node dist/server.js
```
Server starts on `https://api.farmer.tcqitsolution.com`.

### Available scripts
| Script              | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Run in dev with hot reload (`tsx watch`), no build step |
| `npm run build`     | Type-check + compile TypeScript to `dist/`              |
| `npm start`         | Run the compiled production build (`dist/server.js`)    |
| `npm run typecheck` | Type-check only, emit nothing (`tsc --noEmit`)          |
| `npm run db:check`  | Verify the database connection                          |

---

## Environment Variables

| Variable                 | Required | Default       | Description                                  |
| ------------------------ | -------- | ------------- | -------------------------------------------- |
| `NODE_ENV`               | no       | `development` | `development` or `production`                |
| `PORT`                   | no       | `5000`        | Port the server listens on                   |
| `CORS_ORIGIN`            | no       | `*`           | Comma-separated allowed origins (`*` = all)  |
| `API_PREFIX`             | no       | `/api/v1`     | Base path all API routes mount under (re-version the API via env, no code change) |
| `DATABASE_URL`           | **yes**  | -             | PostgreSQL connection string (Neon)          |
| `DB_SYNC`                | no       | `false`       | `true` → run pending migrations on startup   |
| `DB_SEED`                | no       | `false`       | `true` → seed baseline data (roles) on startup |
| `CLOUDINARY_CLOUD_NAME`  | **yes**  | -             | Cloudinary cloud name                        |
| `CLOUDINARY_API_KEY`     | **yes**  | -             | Cloudinary API key                           |
| `CLOUDINARY_API_SECRET`  | **yes**  | -             | Cloudinary API secret                        |
| `JWT_SECRET`             | **yes**  | -             | Secret used to sign JWTs (use a long random value) |
| `JWT_EXPIRES_IN`         | no       | `7d`          | Token lifetime (e.g. `7d`, `12h`)            |
| `OTP_LENGTH`             | no       | `6`           | Number of digits in generated OTPs           |
| `OTP_EXPIRY_MINUTES`     | no       | `10`          | How long an OTP stays valid                  |
| `SMTP_ENABLED`           | no       | `false`       | `false` → OTPs printed to terminal; `true` → emailed via SMTP |
| `SMTP_HOST`              | no*      | -             | SMTP server host (*required when `SMTP_ENABLED=true`) |
| `SMTP_PORT`              | no       | `587`         | SMTP port (465 for secure, 587 for STARTTLS) |
| `SMTP_SECURE`            | no       | `false`       | `true` for port 465                          |
| `SMTP_USER`              | no*      | -             | SMTP username                                |
| `SMTP_PASS`              | no*      | -             | SMTP password                                |
| `SMTP_FROM_NAME`         | no       | `Farmer App`  | Sender display name                          |
| `SMTP_FROM_EMAIL`        | no       | `no-reply@farmerapp.com` | Sender email address              |
| `RATE_LIMIT_WINDOW_MS`   | no       | `900000`      | Rate-limit window in ms (15 min)             |
| `RATE_LIMIT_MAX`         | no       | `100`         | Max requests per window per IP               |

Missing a **required** variable will stop the server at startup with a clear message.

### Database sync & seed (flag-driven)

You apply schema changes and seed data by flipping env flags and **restarting** - no separate CLI command to remember:

1. In `.env`, set `DB_SYNC=true` (and/or `DB_SEED=true`).
2. Restart the server (`npm run dev`).
   - `DB_SYNC` runs any **pending** SQL migrations from `src/db/migrations/`, tracked in a `_migrations` table.
   - `DB_SEED` inserts the baseline **roles** (`farmer`, `assessor`, `program_partner`, `admin`).
3. Set both back to `false` so they don't run on every restart.

Both are **idempotent** - already-applied migrations are skipped and existing roles are left untouched, so leaving them on by accident does no harm.

---

## API Conventions

### Success Response (every endpoint)
```json
{
  "success": true,
  "message": "Human-readable success message",
  "data": { },
  "meta": { }
}
```
`meta` is optional (used for pagination, counts, etc.).

### Error Response (every error)
```json
{
  "success": false,
  "message": "Human-readable message (safe for users/admins)",
  "code": "MACHINE_READABLE_CODE",
  "errors": [ { "field": "email", "message": "Email is required" } ],
  "stack": "... (only in development, for developers)"
}
```

**Audience handling (as designed):**
- **Users & Admins** always get a clean, human-readable `message`.
- **Frontend devs** get a stable `code` to switch on, plus field-level `errors`.
- **Backend devs** get the full `stack` trace in development, and the server **logs every error** with full detail in all environments.
- In **production**, unexpected `5xx` errors never leak internal details to the client - they get a generic safe message, while the real error is logged server-side.

### Error Codes
| HTTP | `code`                   | Meaning                          |
| ---- | ------------------------ | -------------------------------- |
| 400  | `BAD_REQUEST`            | Malformed request                |
| 400  | `VALIDATION_ERROR`       | Input validation failed          |
| 401  | `UNAUTHORIZED`           | Authentication required          |
| 403  | `FORBIDDEN`              | No permission                    |
| 404  | `NOT_FOUND`              | Resource/route not found         |
| 409  | `CONFLICT`               | Duplicate / conflict             |
| 429  | `TOO_MANY_REQUESTS`      | Rate limit exceeded              |
| 500  | `INTERNAL_SERVER_ERROR`  | Unexpected server error          |

Common PostgreSQL errors (unique violation, FK violation, etc.) are automatically translated into the right HTTP status + friendly message.

---

## Health Endpoints

> The `/api/v1` prefix below comes from the `API_PREFIX` env var - if you change it, these paths change accordingly.

| Method | Endpoint              | Purpose                                   |
| ------ | --------------------- | ----------------------------------------- |
| GET    | `/`                   | Friendly "API is running" message         |
| GET    | `{API_PREFIX}/health`    | **Liveness** - is the server up? (no DB)  |
| GET    | `{API_PREFIX}/health/db` | **Readiness** - is the database reachable?|

**Example:**
```bash
curl https://api.farmer.tcqitsolution.com/api/v1/health
```
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "ok",
    "service": "farmer-app-backend",
    "environment": "development",
    "uptime": "42s",
    "timestamp": "2026-06-23T10:45:17.206Z"
  }
}
```

---

## Authentication

**Registration requires email/OTP verification.** New users register → account is created
*pending* and an OTP is sent (printed to terminal while SMTP is off) → the user verifies the
OTP to **activate** the account and receive a **JWT**. After that, they can log in with password
or OTP (either works). Password login is **blocked until the email is verified**.

```
Register ──► (pending, OTP sent) ──► Verify OTP ──► (active + JWT)
                                                        │
                Login (password or OTP) ◄───────────────┘
```

| Method | Endpoint                   | Body                                          | Notes |
| ------ | -------------------------- | --------------------------------------------- | ----- |
| POST   | `{API_PREFIX}/auth/register`   | `{ fullName, email, phone, password, role? }` | Creates a **pending** account + sends OTP. `role` defaults to `farmer`. **No token** - verify the OTP next. |
| POST   | `{API_PREFIX}/auth/verify-otp` | `{ email, code }`                             | Verifies the OTP → **activates the account** and returns an access token + refresh token. |
| POST   | `{API_PREFIX}/auth/login`      | `{ email, password }`                         | Password login. Returns an **access token + refresh token**. **Blocked until email is verified.** |
| POST   | `{API_PREFIX}/auth/refresh-token` | `{ refreshToken }`                         | Exchanges a valid refresh token for a **new short-lived access token**. `401` if invalid/expired. |
| POST   | `{API_PREFIX}/auth/logout`     | `{ refreshToken }`                            | **Deletes/invalidates** the refresh token so it can't be reused. Idempotent (always `200`). |
| POST   | `{API_PREFIX}/auth/request-otp`| `{ email }`                                   | Sends an OTP to an **existing account** (OTP login or a fresh verification code). Returns **404** if the email isn't registered. **While `SMTP_ENABLED=false`, the OTP is printed to the server terminal.** |
| POST   | `{API_PREFIX}/auth/forgot-password` | `{ email }`                              | Sends a **password-reset OTP** to an existing account. Returns **404** if the email isn't registered. **Rate-limited: 3 requests / 10 min per IP.** |
| POST   | `{API_PREFIX}/auth/reset-password`  | `{ email, code, newPassword }`           | Verifies the reset OTP and sets the new password (also marks the email verified). Does **not** log in. |
| GET    | `{API_PREFIX}/auth/me`         | - (header `Authorization: Bearer <token>`)    | Returns the current user. **Protected.** |
| GET    | `{API_PREFIX}/roles`           | -                                             | Public list of **self-signup roles** (`farmer`, `assessor`, `program_partner`) - **excludes admin**. For the register screen dropdown. |
| GET    | `{API_PREFIX}/login-logs?page=&limit=` | - (header `Authorization: Bearer <token>`) | **Admin-only.** Paginated recent login attempts (email, method, status, IP, reason, time) for the dashboard audit table. |

> Re-registering an email that's still **unverified** simply re-sends the OTP (no error). Re-registering
> an **already-verified** email returns `409 Conflict`.

### Day 3 - User management (admin) & Profile

**Users - all admin-only** (`authenticate` + `authorize("admin")`):

| Method | Endpoint                              | Body / Query                                        | Notes |
| ------ | ------------------------------------- | --------------------------------------------------- | ----- |
| POST   | `{API_PREFIX}/users`                  | `{ fullName, email, phone, password, role, isActive? }` | Creates a user with a role. **Active + verified** immediately (no OTP). `409` if email exists. |
| GET    | `{API_PREFIX}/users`                  | `?page=&limit=&role=&status=&search=`               | Paginated list. `role` (farmer/assessor/program_partner/admin), `status` (active/inactive), `search` (name/email/phone). |
| GET    | `{API_PREFIX}/users/:id`              | -                                                   | Single user. `404` if not found. |
| PATCH  | `{API_PREFIX}/users/:id`              | `{ fullName?, phone?, role?, isActive? }`           | Update fields (incl. **role assignment**). |
| PATCH  | `{API_PREFIX}/users/:id/status`       | `{ isActive }`                                      | Activate / deactivate a user. |
| DELETE | `{API_PREFIX}/users/:id`              | -                                                   | **Soft delete** (sets `deleted_at`). |
| POST   | `{API_PREFIX}/users/:id/restore`      | -                                                   | Restore a soft-deleted user. |

**Profile - any logged-in user** (`authenticate`; used by the mobile app):

| Method | Endpoint                              | Body                                  | Notes |
| ------ | ------------------------------------- | ------------------------------------- | ----- |
| GET    | `{API_PREFIX}/profile/me`             | -                                     | The current user's profile. |
| PATCH  | `{API_PREFIX}/profile/me`             | `{ fullName?, phone? }`               | Update own name/phone. |
| POST   | `{API_PREFIX}/profile/change-password`| `{ currentPassword, newPassword }`    | Verifies current password; `401` if wrong. |

### Token model (access + refresh)

Login / verify-otp return **two** tokens:

- **`token`** - a short-lived JWT **access token** (`JWT_EXPIRES_IN`, default `15m`). Send it as
  `Authorization: Bearer <token>` on protected routes.
- **`refreshToken`** - a long-lived opaque token (`REFRESH_TOKEN_EXPIRY_DAYS`, default `7`), stored in
  the `refresh_tokens` DB table. Store it securely on the client.

When the access token expires, call **`POST /auth/refresh-token`** with the refresh token to get a
fresh access token (the refresh token itself is **not** rotated - it stays valid until expiry or
logout). **`POST /auth/logout`** deletes the refresh token from the DB so it can never be reused.

> **Frontend:** to keep sessions alive, add silent refresh - on a `401`, call `/auth/refresh-token`
> with the stored refresh token, retry the failed request with the new access token. Not yet wired
> in the admin/app frontends.

### Input validation (Zod schemas + middleware)

Validation uses **Zod**. Each route's schema lives in `src/validators/` and is applied via the
**`validate(schema)`** middleware (`src/middlewares/validate.ts`), which:
- parses the request part against the schema (trimming/coercing values),
- **replaces** `req.body` with the clean, typed value (controllers just read it), and
- on failure throws `ApiError.validation` → the global error handler returns a
  `400 VALIDATION_ERROR` with field-level `errors`.

```ts
// route
router.post("/register", validate(registerSchema), register);
// controller - body is already validated + typed
const { fullName, email, phone, password, role } = req.body as RegisterBody;
```

Production field rules (in `src/validators/auth.schema.ts`):

| Field      | Rule                                                                  |
| ---------- | --------------------------------------------------------------------- |
| Full name  | 2-100 chars (required on register)                                    |
| Email      | valid format, ≤ 255 chars (trimmed + lowercased)                      |
| Password   | 8-64 chars, must include **a letter and a number**                    |
| Mobile no. | **international, with country code (E.164)** - `+` then 8-15 digits, e.g. `+919876543210`. Separators auto-stripped. |
| OTP code   | exactly **6 digits** (matches `OTP_LENGTH`); accepts number or string |

> **Adding a feature:** define a Zod schema in `src/validators/<feature>.schema.ts`, then
> `router.post(..., validate(schema), controller)`. Schema-inferred types (`z.infer`) give the
> controller fully-typed `req.body` for free.

**Using the token:** every protected endpoint expects an `Authorization: Bearer <token>` header. The
`authenticate` middleware validates it and attaches `req.user` (`{ sub, email, role }`). Use
`authorize("admin")` after it to restrict a route to specific roles.

**OTP in dev:** with `SMTP_ENABLED=false`, calling `request-otp` prints a clear box to the terminal:

```
┌────────────────────────────────────────────┐
│  OTP (SMTP disabled - dev mode)          │
├────────────────────────────────────────────┤
│  Email : farmer@example.com                │
│  Code  : 075184                            │
│  Valid : 10 minutes                        │
└────────────────────────────────────────────┘
```

Copy that code into `verify-otp`. When you're ready for real email, fill the `SMTP_*` vars and set
`SMTP_ENABLED=true` - the same code path then emails the OTP instead, no code change.

> **TESTING ONLY - OTP in response:** for now, `register`, `request-otp`, and `forgot-password`
> also return the OTP in the response body as `data.code` (so it's usable on live without email/log
> access). **This is insecure and must be removed before real launch.** Every spot is marked with a
> `// TODO: REMOVE-TESTING` comment - run `grep -rn "REMOVE-TESTING" src/` to find and delete them.

**Security notes:** passwords are hashed with bcrypt; `login` never leaks which emails exist
(uniform "Invalid email or password"); the "verify your email first" message is only revealed
*after* a correct password, so it can't be used to probe accounts; OTPs are single-use and expire;
every login attempt (success or failure) is recorded in `login_logs`.

> **Note on `request-otp`:** by product decision this endpoint returns a clear `404` when the
> email isn't registered (better UX). This trades away email-enumeration resistance for that path -
> acceptable here, but if abuse becomes a concern, add rate-limiting/captcha or switch it back to a
> generic response.

---

## Database Tables

| Table        | Purpose                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `roles`      | Fixed lookup: `farmer`, `assessor`, `program_partner`, `admin` (seeded) |
| `users`      | App users; each has one `role_id`. Passwords bcrypt-hashed (nullable for OTP-only). |
| `otp_codes`  | Short-lived OTP codes per email (single-use, expiring).                 |
| `refresh_tokens` | Long-lived refresh tokens per session (deleted on logout / expiry). |
| `login_logs` | Audit trail of every login attempt (method, status, IP, user-agent, reason). |
| `_migrations`| Internal ledger of applied migrations (managed by `DB_SYNC`).           |

Schema lives in `src/db/migrations/` as ordered SQL files - see the **Database sync & seed** section above for how they're applied.

---

## Soft Delete (Paranoid Mode)

**Delete APIs never physically remove a row.** Every table has a `deleted_at`
timestamp column. "Deleting" a record just sets `deleted_at = now()` - the data
stays in the database, so nothing is ever truly lost and records can be restored.

- **Alive** row → `deleted_at IS NULL`
- **Soft-deleted** row → `deleted_at` has a timestamp

### How it behaves
- **Auto-hide:** read queries filter to live rows, so a soft-deleted record
  disappears from `findByEmail`, `findById`, listings, login, etc. - exactly as if
  it were deleted.
- **Email reuse:** `users.email` is unique only among *live* rows (a partial unique
  index). So after a user is soft-deleted, that email can be registered again. If
  it weren't, restore could later collide - callers should handle that case.
- **Restore:** set `deleted_at` back to `NULL` to bring a record back.
- **Hard delete:** still possible via `hardDelete()` for a real purge (use sparingly,
  e.g. an admin "permanently delete" action).

### Helpers - `src/db/softDelete.ts`
```ts
import { softDelete, restore, hardDelete, findAliveById } from "../db/softDelete.js";

await softDelete("users", id);   // sets deleted_at = now()  → returns rows affected
await restore("users", id);      // deleted_at → NULL
await hardDelete("users", id);   // permanent removal
await findAliveById("users", id);// fetch a live row by id, or null
```
The `users` model wraps these as `softDeleteUser(id)` / `restoreUser(id)`, and its
finders already filter to live rows.

### When you add a new table
1. Include `deleted_at TIMESTAMPTZ` in the create migration.
2. Add a partial index: `CREATE INDEX ... ON tbl (id) WHERE deleted_at IS NULL;`
3. Add `"tbl"` to the `SoftDeleteTable` type in `src/db/softDelete.ts`.
4. In the model's read queries, always include `AND deleted_at IS NULL`.

---

## How to Add a New Feature (recipe)

Example: adding "farmers".

1. **Migration** - `src/db/migrations/001_create_farmers_table.sql`
2. **Types** - add the row type (e.g. `Farmer`) in `src/types/` or a feature-local file
3. **Model** - `src/models/farmer.model.ts` (SQL queries via the typed `query<Farmer>()` helper)
4. **Service** - `src/services/farmer.service.ts` (business logic)
5. **Controller** - `src/controllers/farmer.controller.ts` (uses `asyncHandler`, returns `ApiResponse`, throws `ApiError`)
6. **Routes** - `src/routes/farmer.routes.ts`
7. **Register** - add one line in `src/routes/index.ts`:
   ```ts
   router.use("/farmers", farmerRoutes);
   ```

That's it - the global error handler and response format apply automatically.

> **Import note:** with `NodeNext` module resolution, relative imports use a `.js`
> extension even though the source file is `.ts` (e.g. `import x from "./pool.js"`).
> This is the correct TypeScript-ESM convention - TS resolves it to the `.ts` file.

---

## Security Built In
- **Helmet** - secure HTTP headers
- **CORS** - restricts origins (configurable)
- **Rate limiting** - throttles abusive clients
- **Body size limits** - 1 MB cap on JSON/form bodies
- **No secret leakage** - internal errors hidden from clients in production
- **Parameterized queries** - SQL injection protection (always use `$1, $2` placeholders)
- **Graceful shutdown** - closes DB pool cleanly on SIGTERM/SIGINT
- **Password hashing** - bcrypt; passwords never stored or returned in plain text
- **JWT auth** - stateless tokens; protected routes via the `authenticate` middleware
- **Login auditing** - every attempt logged to `login_logs`

---

## Postman

Import `postman/farmer-app.postman_collection.json` into Postman. It includes all
health + auth requests with collection variables:

- `baseUrl` (default `https://api.farmer.tcqitsolution.com`) and `apiPrefix` (default `/api/v1`)
- `token` - auto-saved by the test scripts on Register / Login / Verify OTP, then
  used automatically by **Get Me**.

Typical flow: **Register** (or **Login**) → token is saved → hit **Get Me**. For OTP:
**Request OTP** → copy the code from the server terminal → **Verify OTP**.

---

## Changelog (update as we build)

| Date       | Change                                                            |
| ---------- | ----------------------------------------------------------------- |
| 2026-06-23 | Initial backend setup: folder structure, global error middleware, consistent API responses, Cloudinary + Neon config, health endpoints. |
| 2026-06-23 | Migrated the whole backend from JavaScript to **TypeScript** (strict mode, NodeNext). Added `tsconfig.json`, shared `src/types/`, `tsx` dev runner, and `build`/`typecheck` scripts. |
| 2026-06-23 | Centralized the API base path into the `API_PREFIX` env var (default `/api/v1`). Re-versioning the API is now an env edit - no code change. |
| 2026-06-23 | Added flag-driven DB sync/seed (`DB_SYNC`, `DB_SEED`) with a migration runner + ledger. Created `roles`, `users`, `otp_codes`, `login_logs` tables; seeded roles (farmer, assessor, program_partner, admin). |
| 2026-06-23 | Added auth: register, password login, OTP request/verify (OTP printed to terminal while `SMTP_ENABLED=false`), JWT issuance, `authenticate`/`authorize` middleware, `/auth/me`. Scaffolded SMTP mailer behind `SMTP_ENABLED`. Added Postman + cURL request files. |
| 2026-06-23 | Added **soft delete (paranoid mode)** to all tables via `deleted_at` (migration 005). Deletes set `deleted_at` instead of removing rows; reads auto-hide deleted rows; `users.email` unique only among live rows so emails free up after deletion. Helpers in `db/softDelete.ts`. |
| 2026-06-23 | **Registration now requires OTP verification.** Register creates a *pending* account + sends an OTP (terminal while SMTP off) and returns no token; verify-otp activates the account + issues the JWT. Password login is blocked until the email is verified. Updated Postman + cURL files. |
| 2026-06-23 | `request-otp` now checks the email exists - returns **404** if no account is registered (works for both verified users and unverified re-verification). Clearer UX over the previous generic message. |
| 2026-06-24 | Added **forgot/reset password** (OTP-based): `forgot-password` sends a reset OTP, `reset-password` verifies it + sets the new password (auto-verifies email). Added public **`GET /roles`** (excludes admin) for the register dropdown. Hardened validation to production rules: name 2-100, password 8-64 with letter+number, mobile exactly 10 digits (no country code, 6-9 lead), OTP exactly 6 digits. |
| 2026-06-24 | Rate-limited `forgot-password` to **3 requests / 10 min** per IP (admin safety). Added **admin-only `GET /login-logs`** (paginated) for the dashboard's login-activity audit table. |
| 2026-06-24 | Added **access + refresh token** auth (migration 006 `refresh_tokens`). Access token shortened to **15m**; login/verify-otp now also return a 7-day refresh token. New **`POST /auth/refresh-token`** (new access token) and **`POST /auth/logout`** (deletes the refresh token so it can't be reused). |
| 2026-06-24 | Phone validation changed from India-only (10 digits) to **international E.164** - `+` then 8-15 digits, any country code accepted (e.g. `+12025550143`). Separators are auto-stripped and the number is stored as `+<digits>`. |
| 2026-06-24 | Reverted access-token lifetime **15m → 7d** for now (no frontend silent refresh yet, so the short window caused 15-min logouts). Refresh tokens are still issued and the refresh/logout endpoints remain - shorten back to 15m once silent refresh is added. |
| 2026-06-24 | **Removed the refresh-token flow entirely** - dropped `/auth/refresh-token` + `/auth/logout`, the model, env vars, and the `refresh_tokens` table (migration 007). Login now returns a single 7-day JWT; logout is client-side. Migrations 006/007 remain as history. |
| 2026-06-24 | **Re-added the refresh-token flow** (client request) - migration 008 re-creates `refresh_tokens`. Access token back to **15m**; login/verify-otp return access + refresh tokens. Restored **`POST /auth/refresh-token`** and **`POST /auth/logout`** (deletes the refresh token). |
| 2026-06-24 | Hardened CORS: `credentials` is only enabled when specific origins are listed (browsers reject `*` + credentials). Admin now calls the API cross-origin directly, so set `CORS_ORIGIN` to the admin's domain in production. |
| 2026-06-24 | Logger now writes to `process.stdout`/`stderr` directly (instead of `console.*`) so logs flush immediately and show up in production containers (Coolify/Docker) - fixes "no logs on live". |
| 2026-06-24 | **TESTING ONLY:** `register` / `request-otp` / `forgot-password` now return the OTP in `data.code` so it's usable on live without email/logs. Marked `// TODO: REMOVE-TESTING` - **delete before launch.** |
| 2026-06-24 | Migrated request validation to **Zod** - added a `validate(schema)` middleware + `src/validators/auth.schema.ts` (schema-inferred types). Routes now run `validate(schema)` before the controller; removed the old custom `utils/validate.ts`. Same field rules + `400 VALIDATION_ERROR` response shape. |
| 2026-06-25 | **Day 3 - User management & Profile.** Admin-only User CRUD (`/users`): create (with role, active+verified), paginated list with role/status filters + search, get, update (incl. role assignment), soft-delete + restore, status toggle, email-unique check. Self-service Profile (`/profile`): view/update, change-password. Added `user.schema.ts`, `user.service.ts`, `user`/`profile` controllers + routes. All 18 test scenarios pass; errors are human-readable. |
| 2026-06-25 | **Clearer auth error messages.** Login on an **inactive** account now says "Your account is inactive. Please contact an administrator to reactivate it." (shown only after a correct password, so account existence isn't leaked) - previously it returned the generic "Invalid email or password". Same clear message for OTP login, request-otp, forgot/reset password. Refresh-token on a dead account → "Your session is no longer valid. Please sign in again." Invalid-role messages list the allowed roles. |
| 2026-06-26 | **Sprint 1 - Organizations & Farms.** New `organizations` table + nullable `users.org_id` (a user belongs to one org) and a `farms` table (owner = a farmer, optional org) - migrations 009/010. Admin-only **Organization CRUD** (`/organizations`): create/list (filter+search+paginate)/get-with-members/update/soft-delete (unlinks members), plus **userorg mapping** (`POST /organizations/:id/users`, `DELETE /organizations/:id/users/:userId`). Admin **Farm CRUD** (`/farms`): create/list (filter by owner/org/status + search)/get/update/soft-delete; owner is validated to be a **farmer**, org existence is validated. **Mobile endpoints** for app users: `GET /farms/me/farms`, `GET /farms/me/farms/:id` (own-farm-only, 404 otherwise), `GET /profile/organization` (the user's org or null). Added `organization`/`farm` models, schemas, services, controllers, routes. All **39 test scenarios pass** (CRUD, access control, validation, mapping, ownership, soft-delete); errors are human-readable. Admin panel wired: **Organizations** (list/create/edit/detail + member assign/remove) and **Farms** (list/create/edit) modules via RTK Query. |

> **Convention:** whenever a feature/endpoint is added or changed, add a row here and update the relevant section above.
