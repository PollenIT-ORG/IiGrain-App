# Pagination + Search, and 2 behaviour changes (React Native dev)

Base URL: `http://localhost:5000/api/v1`. All routes need
`Authorization: Bearer <token>`.

---

## 1. Pagination + search added to these list endpoints

All of them now accept the SAME query params and return a top-level `meta`:

| Query param | Type | Default | Notes |
|-------------|------|---------|-------|
| `page` | number | `1` | 1-based |
| `limit` | number | `20` | max `100` |
| `search` | string | (none) | case-insensitive |

Response gains a sibling `meta` next to `data`:

```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

If you send no params you get page 1 with `limit=20`, so the list is now a
**page**, not the full set. Wire infinite-scroll / a pager off `meta`.

### Endpoints + what `search` matches

| Endpoint | `data` shape | `search` matches |
|----------|-------------|------------------|
| `GET /farms/me/farms` | `{ farms: [...] }` | farm name / location |
| `GET /dashboard/my/farms` | `{ farms: [...], defaultFarmId }` | farm name |
| `GET /assessments/my/fields` | `{ year, title, counts, fields: [...] }` | field name / crop |
| `GET /assessments/my/history` | `{ count, assessments: [...] }` | field name / crop |
| `GET /programs/my/fields` | `{ fields: [...] }` | field name / crop |

Already-paginated (unchanged): `GET /programs` (admin).

### Sorting on `GET /farms` (admin, all farms)

`GET /farms` (already paginated + searchable) now also accepts sorting:

| Query param | Values | Default |
|-------------|--------|---------|
| `sortBy` | `name`, `created_at`, `updated_at`, `area_acres` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

Combines with the existing `page`/`limit`/`search`/`status`/`ownerId`/`orgId`
filters, e.g. `GET /farms?search=farm&sortBy=area_acres&order=desc&page=1&limit=20`.

### Notes per endpoint

- **`/dashboard/my/farms`** - `defaultFarmId` is stable: it is always the
  farmer's most-recent farm, regardless of `page` or `search`. `fieldCount` per
  farm is now correct (see change #2 below).
- **`/assessments/my/fields`** - `counts { total, notStarted, inProgress,
  completed }` reflect the WHOLE (search-filtered) set, not just the current
  page. This list only holds pending work, so `completed` is always `0`.
- **`/assessments/my/history`** - `count` is now the total across all pages
  (same as `meta.total`); `assessments` is the current page. Existing `?farmId=`
  filter still works and combines with `search`.

### Examples

```bash
# farms, second page of 10
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/farms/me/farms?page=2&limit=10"

# assessment history, search a field by name
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/assessments/my/history?search=north&page=1&limit=20"

# my assessments, search + page
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/assessments/my/fields?search=wheat"
```

---

## 2. Behaviour change: dashboard `fieldCount` fixed

`GET /dashboard/my/farms` used to count only fields that were enrolled in a
program, so a farm with fields that were not enrolled showed `fieldCount: 0`.
It now counts **all** of the farm's fields (matching `GET /farms/:id/fields`).
No shape change; the number is just correct now.

---

## 3. New validation: farm size cannot be smaller than its fields

When editing a farm's `areaAcres` (both `PATCH /farms/:id` admin and
`PATCH /farms/me/farms/:id` farmer), the new size must be at least the sum of the
farm's field areas. If you try to set it lower, the API returns `400` with a
message that states the minimum and how much can still be reduced, e.g.:

```
This farm's 3 fields already cover 318 acres, so the farm size cannot be less
than 318 acres. You can reduce it by at most 202 acres (down to 318 acres). To
go lower, edit or remove some fields first.
```

So in the app: on that `400`, show the message. To reduce further, the user must
first shrink or delete fields. (Increasing the farm size is always allowed.)
