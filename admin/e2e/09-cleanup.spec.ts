import { test, expect, type Page } from "@playwright/test";
import { login, note, OUT, apiVia } from "./qa-utils";
import path from "path";

/**
 * Removes every record created by this QA run.
 * Only touches records whose name starts with "QA Test".
 */
async function installToastRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as any).__toasts = [];
    const push = () => {
      document.querySelectorAll("[role=status]").forEach((el) => {
        const t = (el.textContent || "").trim().replace(/\s+/g, " ");
        const arr = (window as any).__toasts;
        if (t && arr[arr.length - 1] !== t) arr.push(t);
      });
    };
    const start = () =>
      new MutationObserver(push).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  });
}
async function getToasts(page: Page): Promise<string[]> {
  const all: string[] = await page.evaluate(() => (window as any).__toasts ?? []);
  return all.filter((t) => !/^loading/i.test(t) && !/draggable|droppable/i.test(t));
}

const QA = /^QA Test/;

test("cleanup: delete everything this QA run created", async ({ page }) => {
  test.setTimeout(300_000);
  await installToastRecorder(page);
  const r: Record<string, unknown> = {};
  await login(page);

  // ---- 1. Delete QA fields (API - they are children of the QA farm) -------
  const fieldsRes = await apiVia(page, "GET", "/fields?limit=200&search=QA%20Test");
  const qaFields = (fieldsRes.json?.data?.fields ?? []).filter((f: any) => QA.test(f.name));
  r.qaFieldsFound = qaFields.map((f: any) => ({ id: f.id, name: f.name }));
  const fieldResults: unknown[] = [];
  for (const f of qaFields) {
    const res = await apiVia(page, "DELETE", `/fields/${f.id}`);
    fieldResults.push({ name: f.name, status: res.status, message: res.json?.message });
  }
  r.fieldDeletes = fieldResults;

  // ---- 2. Delete the QA farm THROUGH THE UI (tests the happy path) --------
  const farmsRes = await apiVia(page, "GET", "/farms?limit=200&search=QA%20Test");
  const qaFarms = (farmsRes.json?.data?.farms ?? []).filter((f: any) => QA.test(f.name));
  r.qaFarmsFound = qaFarms.map((f: any) => ({ id: f.id, name: f.name }));

  if (qaFarms[0]) {
    await page.goto("/farms");
    await page.getByPlaceholder("Search by name, location, or owner").fill("QA Test");
    await page.waitForTimeout(3000);
    const rowsBefore = await page.locator("tbody tr").count();
    await page.evaluate(() => ((window as any).__toasts = []));
    await page.locator("tbody tr").first().locator("button[title='Delete']").click();
    await page.waitForTimeout(900);
    const dialog = await page
      .locator("[role=dialog]")
      .innerText()
      .then((t) => t.replace(/\s+/g, " "))
      .catch(() => "<none>");
    await page.getByRole("button", { name: /^Delete$/ }).last().click();
    await page.waitForTimeout(4000);
    r.farmDeleteViaUi = {
      rowsBefore,
      dialog,
      toasts: await getToasts(page),
      rowsAfter: await page.locator("tbody tr").count(),
    };
    await page.screenshot({ path: path.join(OUT, "farm-delete-happy.png"), fullPage: true });
  }

  // remaining QA farms via API
  const farms2 = await apiVia(page, "GET", "/farms?limit=200&search=QA%20Test");
  for (const f of (farms2.json?.data?.farms ?? []).filter((x: any) => QA.test(x.name))) {
    await apiVia(page, "DELETE", `/farms/${f.id}`);
  }

  // ---- 3. Delete QA programs --------------------------------------------
  const progs = await apiVia(page, "GET", "/programs?limit=200&search=QA%20Test");
  const qaProgs = (progs.json?.data?.programs ?? []).filter((p: any) => QA.test(p.name));
  r.qaProgramsFound = qaProgs.map((p: any) => ({ id: p.id, name: p.name, code: p.code }));
  const progResults: unknown[] = [];
  for (const p of qaProgs) {
    const res = await apiVia(page, "DELETE", `/programs/${p.id}`);
    progResults.push({ name: p.name, status: res.status, message: res.json?.message });
  }
  r.programDeletes = progResults;

  // ---- 4. Delete QA assessment categories --------------------------------
  const cats = await apiVia(page, "GET", "/assessments/categories");
  const qaCats = (cats.json?.data?.categories ?? cats.json?.data ?? []).filter((c: any) =>
    QA.test(c.name)
  );
  r.qaCategoriesFound = qaCats.map((c: any) => ({ id: c.id, name: c.name }));
  const catDeletes: unknown[] = [];
  for (const c of qaCats) {
    const res = await apiVia(page, "DELETE", `/assessments/categories/${c.id}`);
    catDeletes.push({ name: c.name, status: res.status, message: res.json?.message });
  }
  r.categoryDeletes = catDeletes;

  // ---- 5. Delete any QA users / orgs -------------------------------------
  const users = await apiVia(page, "GET", "/users?limit=200&search=QA%20Test");
  const qaUsers = (users.json?.data?.users ?? []).filter((u: any) => QA.test(u.full_name ?? ""));
  r.qaUsersFound = qaUsers.map((u: any) => ({ id: u.id, name: u.full_name }));
  for (const u of qaUsers) await apiVia(page, "DELETE", `/users/${u.id}`);

  const orgs = await apiVia(page, "GET", "/organizations?limit=200&search=QA%20Test");
  const qaOrgs = (orgs.json?.data?.organizations ?? []).filter((o: any) => QA.test(o.name));
  r.qaOrgsFound = qaOrgs.map((o: any) => ({ id: o.id, name: o.name }));
  for (const o of qaOrgs) await apiVia(page, "DELETE", `/organizations/${o.id}`);

  // ---- 6. Remove the avatar this run uploaded to the super admin ---------
  await page.goto("/profile");
  await page.waitForTimeout(4000);
  const removeBtn = page.getByRole("button", { name: /^Remove$/ });
  if (await removeBtn.count()) {
    await page.evaluate(() => ((window as any).__toasts = []));
    await removeBtn.click();
    await page.waitForTimeout(4000);
    r.avatarRemoved = await getToasts(page);
  }

  // ---- 7. Verify nothing named "QA Test" is left ------------------------
  const leftovers: Record<string, unknown> = {};
  for (const [name, url, key] of [
    ["farms", "/farms?limit=200&search=QA%20Test", "farms"],
    ["fields", "/fields?limit=200&search=QA%20Test", "fields"],
    ["programs", "/programs?limit=200&search=QA%20Test", "programs"],
    ["users", "/users?limit=200&search=QA%20Test", "users"],
    ["organizations", "/organizations?limit=200&search=QA%20Test", "organizations"],
  ] as const) {
    const res = await apiVia(page, "GET", url);
    const arr = res.json?.data?.[key] ?? [];
    leftovers[name] = arr
      .filter((x: any) => QA.test(x.name ?? x.full_name ?? ""))
      .map((x: any) => x.name ?? x.full_name);
  }
  const catsAfter = await apiVia(page, "GET", "/assessments/categories");
  leftovers.categories = (catsAfter.json?.data?.categories ?? [])
    .filter((c: any) => QA.test(c.name))
    .map((c: any) => c.name);
  r.leftovers = leftovers;

  note("cleanup.json", r);
  expect(r).toBeTruthy();
});
