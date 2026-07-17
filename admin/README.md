# Farmer App - Admin Panel

React admin console for the Farmer App, built with **React + TypeScript + Vite + Tailwind CSS**.

---

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Framework    | React 18 + TypeScript               |
| Build tool   | Vite 6                              |
| Styling      | Tailwind CSS (shared theme palette) |
| Charts       | Recharts                            |
| Routing      | React Router 6                      |
| HTTP         | Axios (with auth interceptors)      |

---

## Theme Colors (shared with the mobile app)

The palette lives in [`tailwind.config.js`](tailwind.config.js) and is the **single source
of truth** - the mobile app uses the same hex values so branding stays consistent. Never hardcode
hex in components; use the Tailwind tokens (`bg-primary`, `text-danger`, etc.).

| Token            | Hex       | Token        | Hex       |
| ---------------- | --------- | ------------ | --------- |
| `primary`        | `#136F3F` | `success`    | `#2BA745` |
| `primary-dark`   | `#0E5A31` | `warning`    | `#FFC107` |
| `secondary`      | `#22A16A` | `danger`     | `#E53935` |
| `accent`         | `#F5A623` | `gray-900`   | `#212829` |
| `info`           | `#207DD2` | `gray-700`   | `#495057` |
| `gray-500`       | `#ADB5BD` | `gray-300`   | `#DEE2E6` |
| `gray-100`       | `#F5F7F9` | `white`      | `#FFFFFF` |

---

## Structure

```
admin/
├── src/
│   ├── components/
│   │   ├── layout/         # AppLayout, Sidebar, Topbar (responsive shell)
│   │   ├── dashboard/      # StatCard
│   │   ├── icons.tsx       # Inline SVG icon set (dependency-free)
│   │   ├── Logo.tsx
│   │   ├── Loader.tsx      # Brand loader (spinning ring + center leaf logo)
│   │   └── ProtectedRoute.tsx
│   ├── config/
│   │   └── apiConfig.ts    # API base URL (single source, from VITE_API_BASE_URL)
│   ├── store/              # Redux Toolkit + RTK Query
│   │   ├── index.ts        # store + RootState/AppDispatch types
│   │   ├── hooks.ts        # typed useAppDispatch / useAppSelector
│   │   ├── useAuth.ts      # convenience hook over auth state
│   │   ├── authSlice.ts    # token/user state (replaces AuthContext)
│   │   ├── api.ts          # RTK Query base API + tags
│   │   ├── axiosBaseQuery.ts # baseQuery over the axios instance (keeps refresh)
│   │   └── endpoints/      # auth / users / profile / login-logs queries
│   ├── data/
│   │   └── dashboard.ts    # Mock analytics data (swap for API later)
│   ├── lib/
│   │   ├── api.ts          # Axios instance + interceptors + error helper
│   │   ├── auth.api.ts     # Forgot/reset password API calls
│   │   └── toast.ts        # Themed toast helpers (react-hot-toast, brand colors)
│   ├── pages/
│   │   ├── Login.tsx       # Pixel-perfect, responsive, wired to /auth/login
│   │   ├── Dashboard.tsx   # Module 6 - Dashboards & Analytics
│   │   ├── LoginLogs.tsx   # Full login-activity page (paginated)
│   │   └── Placeholder.tsx # "Coming soon" for unbuilt nav items
│   ├── types/
│   ├── App.tsx             # Routes (public + protected)
│   ├── main.tsx
│   └── index.css           # Tailwind layers + reusable classes
├── tailwind.config.js      # Shared theme palette
├── vite.config.ts          # Dev server (port 3000) - no proxy
└── .env / .env.example     # VITE_API_BASE_URL (full backend URL)
```

---

## Getting Started

### 1. Install
```bash
cd admin
npm install
```

### 2. Run (dev)
```bash
npm run dev
```
Opens at **http://localhost:3000**.

> Make sure the backend is running (`cd ../backend && npm run dev`). The admin
> calls the backend **directly** at `VITE_API_BASE_URL` - there is **no proxy**.

### 3. Build (production)
```bash
npm run build      # type-checks + bundles to dist/
npm run preview    # preview the production build
```

### API URL (no proxy, full URL from env)

The admin talks to the backend **directly** using the full URL in `VITE_API_BASE_URL`
(`src/config/apiConfig.ts` is the single source). **There is no dev proxy** - dev and
production behave the same way (a proxy only exists in dev and would break in prod, which
caused a `405` on the deployed login).

| Environment | `VITE_API_BASE_URL`                                  |
| ----------- | --------------------------------------------------- |
| Local dev   | `https://api.farmer.tcqitsolution.com/api/v1`                      |
| Production  | `https://api.farmer.tcqitsolution.com/api/v1` (full backend URL) |

Because the call is **cross-origin**, the backend must allow the admin's origin via CORS
(`CORS_ORIGIN` env on the backend). **Going live:** set `VITE_API_BASE_URL` to the deployed
backend URL and rebuild - no code change, just env.

---

## Login & password reset

- The login form calls **`POST /auth/login`** and stores the **access token + refresh token** in
  `localStorage`.
- **Admin-only:** even with valid credentials, non-`admin` roles are rejected client-side.
- The access token is attached to every request.
- **Silent refresh:** when the short-lived access token expires, the axios interceptor automatically
  calls `POST /auth/refresh-token` with the stored refresh token, gets a new access token, and
  **retries the failed request** - the user never sees a logout. If refresh also fails (revoked /
  expired), it clears everything and redirects to `/login`. Concurrent 401s share a single refresh
  call (single-flight).
- **Logout** revokes the refresh token server-side (`POST /auth/logout`) and clears local state.
- **Forgot password** (link on the login screen) runs a 3-step flow:
  email → OTP (printed to the backend terminal in dev) → new password → back to sign in.
  Calls `POST /auth/forgot-password` then `POST /auth/reset-password`.

> Admins are **not** self-registered - there's no admin signup. A super admin will provision
> admin accounts later. For now, create one in the DB with the `admin` role and
> `is_email_verified = true` (or register a user, verify, then update its role).

---

## Dashboard (Module 6 - Dashboards & Analytics)

Implements the Module 6 brief:
- **KPI cards** - acreage enrolled, farms enrolled, assessment completion, avg RHI score.
- **Acreage enrolled** - area chart (cumulative).
- **Enrollment by program** - donut.
- **Assessment completion & score trends** - multi-line chart.
- **RHI benchmarking by region** - bar chart.
- **Recent reports** - table with PDF/CSV export actions (exportable reports for partners/admins).
- **Recent login activity** - live audit table from `GET /login-logs` (admin-only): email, method, status, IP, reason, time. A **"View more"** link opens the full **`/login-logs`** page with server-side pagination.

Data currently comes from [`src/data/dashboard.ts`](src/data/dashboard.ts) (mock). When the
analytics API is ready, replace that import with API calls - the UI won't need to change.

---

## Responsiveness

Fully mobile-responsive:
- Sidebar collapses into a slide-in **drawer** with overlay on `< lg`.
- KPI grid: 1 col (mobile) → 2 (sm) → 4 (xl).
- Charts use `ResponsiveContainer` and reflow.
- Tables scroll horizontally on small screens.
- Topbar search hides on small screens; profile collapses to an avatar.

---

## Toast notifications

User feedback (login success/fail, password reset, logout) is shown via
**`react-hot-toast`**, styled with the brand palette (`src/lib/toast.ts`):

- `showSuccess(msg)` - green (`#2BA745`)
- `showError(msg)` - red (`#E53935`)
- `showInfo(msg)` - blue (`#207DD2`)

The `<Toaster>` is mounted once in `App.tsx` (top-right). Use these helpers instead of
inline error boxes for transient messages.

---

## Loader

A reusable brand loader (`src/components/Loader.tsx`) - a spinning progress ring (brand green
`#136F3F`) with the FarmerApp **leaf logo** pulsing in the center.

```tsx
<Loader variant="fullPage" message="Loading…" size="lg" />  // full screen
<Loader />                                                  // inline, medium
<Loader size="sm" message="Loading activity…" />            // small, in a card
```

- `variant`: `fullPage` (centered on the viewport) | `inline` (centered in its parent).
- `size`: `sm` | `md` | `lg`.
- Used as the **Suspense fallback** for lazy-loaded routes (so it shows on app boot / route
  change) and inside data sections (e.g. the dashboard's login-activity table).

> Routes are **lazy-loaded** (`React.lazy` + `Suspense`), so each page is its own chunk and the
> initial bundle stays small - the heavy charts (Recharts) only load on the dashboard.

---

## Changelog

| Date       | Change                                                              |
| ---------- | ------------------------------------------------------------------- |
| 2026-06-24 | Initial admin panel: Vite + React + TS + Tailwind. Shared theme palette, login (wired to backend, admin-only), responsive app shell, and Module 6 dashboard with Recharts. |
| 2026-06-24 | Dev server port → **3000**. Added live **login-activity** table on the dashboard (`/login-logs`). Topbar layout fixed (actions pinned right). |
| 2026-06-24 | **Env-driven proxy** (`VITE_DEV_PROXY_TARGET`) - no hardcoded backend URL; prod uses `VITE_API_BASE_URL`. Added **forgot-password flow** on the login screen (email → OTP → new password). Highlighted the admin name on the dashboard greeting. |
| 2026-06-24 | Added **`react-hot-toast`** notifications themed with the brand palette (success/error/info). Replaced inline error boxes on login & forgot-password with toasts; added success toasts (login, reset, logout). |
| 2026-06-24 | Added a reusable **brand Loader** (spinning ring + center leaf logo). **Lazy-loaded routes** with `Suspense` using the full-page loader; replaced the dashboard table skeleton with the inline loader. Initial bundle dropped from ~672 kB → ~240 kB (charts now code-split). |
| 2026-06-24 | Added **silent refresh**: store the refresh token on login; the axios interceptor auto-refreshes the access token on a `401` and retries the request (single-flight), redirecting to `/login` only if refresh fails. Logout now revokes the refresh token via `POST /auth/logout`. No more 15-minute auto-logouts. |
| 2026-06-24 | **Fixed:** backend error messages weren't shown (toast said "Request failed with status code 401"). Two causes: (1) the silent-refresh interceptor was hijacking auth-flow 401s - now `/auth/*` endpoints bypass it; (2) Login used `err.message` (the generic axios string) instead of `getApiErrorMessage`, which now also handles plain Errors. Real messages like "Invalid email or password" now appear. |
| 2026-06-24 | Added a **"View more"** link on the dashboard login-activity widget → new full **`/login-logs`** page with server-side pagination (Prev/Next, page X of Y, total count). Extracted the shared table markup so the widget and page render identically. |
| 2026-06-24 | **Removed the Vite dev proxy** - it didn't exist in production, so deployed login hit the frontend host (`405`). Added `src/config/apiConfig.ts`: the app now calls the backend **directly** at the full `VITE_API_BASE_URL` in every environment. Backend CORS hardened (no `*`+credentials clash). |
| 2026-06-25 | **Day 3 - User Management UI.** Global **DialogProvider** (`useDialog().confirm()` / `.prompt()`, themed - no native `confirm`/`prompt`/`alert`). Sidebar **Users** dropdown by role (farmer/assessor/program_partner). **Users** list page (search, role + status filters, pagination, status toggle, delete-with-confirm). **Create/Edit user** form. **Profile** + **Change password** screens (+ Topbar "My profile" link). Added `.btn-secondary`/`.btn-danger`, `users.api.ts`, `profile.api.ts`. All wired to the backend (verified end-to-end). |
| 2026-06-25 | Custom themed **`Select`** dropdown (auto-flips up when no room below). Added **input `maxLength` limits** on all forms (name 100, email 255, phone 16, password 64). Added a professional **`PhoneInput`** (`react-phone-number-input`) - country flag + dial-code picker, defaults to India, outputs E.164; replaces the plain phone field in user create/edit + profile. |
| 2026-06-25 | **State management migrated to Redux Toolkit + RTK Query.** Added `src/store/` (store, typed hooks, `authSlice`, RTK Query base + injected endpoints for auth/users/profile/login-logs). The RTK Query `baseQuery` wraps the existing axios `api` instance, so the **silent-refresh interceptor is preserved**. Replaced `AuthContext` with `authSlice` + `useAuth` hook; all pages (Login, Users, UserForm, Profile, ChangePassword, dashboard login-logs) now use RTK Query (auto caching + tag-based refetch). Removed the old `AuthContext` + manual `*.api.ts` files. |
