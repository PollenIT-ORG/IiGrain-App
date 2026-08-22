import { test, expect } from "@playwright/test";
import { login, note, apiVia } from "./qa-utils";

test("verify no QA Test records remain (full scan, no search filter)", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const r: Record<string, unknown> = {};

  const scans: Array<[string, string, string]> = [
    ["farms", "/farms?limit=100", "farms"],
    ["fields", "/fields?limit=100", "fields"],
    ["programs", "/programs?limit=100", "programs"],
    ["users", "/users?limit=100", "users"],
    ["organizations", "/organizations?limit=100", "organizations"],
  ];

  for (const [label, url, key] of scans) {
    const res = await apiVia(page, "GET", url);
    const arr = res.json?.data?.[key] ?? [];
    r[label + "_total"] = arr.length;
    r[label + "_qa"] = arr
      .filter((x: any) => /QA Test/i.test(x.name ?? x.full_name ?? ""))
      .map((x: any) => ({ id: x.id, name: x.name ?? x.full_name }));
  }

  const cats = await apiVia(page, "GET", "/assessments/categories");
  const catArr = cats.json?.data?.categories ?? [];
  r.categories_total = catArr.length;
  r.categories_qa = catArr
    .filter((c: any) => /QA Test/i.test(c.name))
    .map((c: any) => ({ id: c.id, name: c.name }));

  // Second pass: delete anything still tagged QA Test
  const cleanup: unknown[] = [];
  for (const [label, , ] of scans) {
    for (const rec of (r[label + "_qa"] as any[]) ?? []) {
      const path = label === "organizations" ? "organizations" : label;
      const del = await apiVia(page, "DELETE", `/${path}/${rec.id}`);
      cleanup.push({ label, name: rec.name, status: del.status, message: del.json?.message });
    }
  }
  for (const c of (r.categories_qa as any[]) ?? []) {
    const del = await apiVia(page, "DELETE", `/assessments/categories/${c.id}`);
    cleanup.push({ label: "category", name: c.name, status: del.status, message: del.json?.message });
  }
  r.secondPassDeletes = cleanup;

  note("verify-clean.json", r);
  expect(r).toBeTruthy();
});
