# Farm summary: year filter, RHI trend, year-wise category scores

Dedicated endpoint for the farm summary screen (year dropdown + "Regen Health
Index Trend" chart + "Category Scores" list).

```
GET /dashboard/my/farms/:farmId/summary                      # latest year WITH data + last 5 years on the chart
GET /dashboard/my/farms/:farmId/summary?year=2024
GET /dashboard/my/farms/:farmId/summary?year=2024&trendYears=4
```
Auth: farmer token.

> This is its own endpoint. The existing farm dashboard
> (`GET /dashboard/my/farms/:farmId`) is unchanged - it still returns the
> all-time overview with `upcoming`, `recentActivity` and `recommendations`.
> Use `/summary` for the trend + category-score screen.

| Query param | Meaning | Default |
|-------------|---------|---------|
| `year` | which year the headline score + category scores are for | the most recent year that has a submitted assessment (else the current year) |
| `trendYears` | how many years the trend chart returns (1-20) | `5` |

---

## Response (the parts that matter here)

```json
{
  "farm": { "id": "...", "name": "Green Valley Farm" },
  "year": 2024,
  "availableYears": [2026, 2025, 2024, 2023, 2022, 2021],
  "regenHealthIndex": 72,
  "rating": "Good",
  "trendVsLastYear": 9,
  "trend": [
    { "year": 2021, "score": 48 },
    { "year": 2022, "score": 55 },
    { "year": 2023, "score": 63 },
    { "year": 2024, "score": 72 }
  ],
  "categories": [
    { "id": "...", "name": "Soil Health",              "score": 68, "answered": 6 },
    { "id": "...", "name": "Water Stewardship",        "score": 75, "answered": 5 },
    { "id": "...", "name": "Biodiversity & Habitat",   "score": 70, "answered": 6 },
    { "id": "...", "name": "Carbon & Nutrient Cycling","score": 72, "answered": 5 },
    { "id": "...", "name": "Livestock Integration",    "score": 74, "answered": 4 }
  ],
  "summary": { "assessmentsCompleted": 3, "averageScore": 72, "topCategory": "Water Stewardship" }
}
```

`summary` is for the selected year too. `upcoming`, `recentActivity` and
`recommendations` are NOT here - those stay on the farm dashboard endpoint.

---

## How each piece is built

- **`availableYears`** - the year dropdown. Runs from the farm's first real
  activity up to the current year, and is **never earlier than the year the
  farmer registered**. The lower bound is: the earliest of (first field
  enrollment, first submitted assessment); if there is neither, the year the farm
  was created. All of it is clamped to the farmer's registration year.
  So a farmer who registered in 2026 gets `[2026]` only - 2025 is not selectable.
- **Year validation** - asking for a year outside that range returns `400`:
  `"You can only view years between 2026 and 2026."` Render the dropdown from
  `availableYears` and this can never happen.
- **`trend`** - the chart data: one point per year that has data, limited to the
  **most recent `trendYears` years (default 5)**, oldest to newest. Years with no
  assessments simply do not appear. Pass `?trendYears=4` for a 4-point chart, or
  a bigger number for a longer history (max 20).
- **Default `year`** - the most recent year that actually has a submitted
  assessment, so the dashboard never opens on an empty year. If the farm has no
  assessments at all, it falls back to the current year. The chosen year always
  comes back in the `year` field, so highlight that one in the dropdown.
- **`regenHealthIndex`** - the selected year's point from the trend (`null` if
  that year has no submitted assessment).
- **`trendVsLastYear`** - selected year's score minus the previous year's, taken
  from the **full** history (so it is still correct when the previous year is
  outside the visible chart window). `null` when either year has no data.
- **`categories`** - **for the selected year only**. Each category's `score` is
  the **average of that category's score across every assessment submitted that
  year** (each assessment counts once). Categories with no data that year come
  back with `score: null`, so the list stays complete.

---

## Client flow

1. Call without `year` -> you get `availableYears` plus the latest year that has
   data (check the returned `year`).
2. Render the dropdown from `availableYears` (already newest-first).
3. On change, re-call `/summary` with `?year=<selected>`; chart uses `trend`, the list uses
   `categories`, the headline number uses `regenHealthIndex`.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/v1/dashboard/my/farms/$FARM_ID/summary?year=2024"
```
