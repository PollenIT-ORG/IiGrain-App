import { test, expect } from "@playwright/test";
import { login, note, OUT, apiVia } from "./qa-utils";
import path from "path";

test.describe("Remaining screens + final clean check", () => {
  test.setTimeout(300_000);

  test("Organization detail, Live visits empty state, Submissions row actions", async ({ page }) => {
    const r: Record<string, unknown> = {};
    await login(page);

    // Organization detail
    const orgs = await apiVia(page, "GET", "/organizations?limit=100");
    const org = (orgs.json?.data?.organizations ?? [])[0];
    if (org) {
      await page.goto(`/organizations/${org.id}`);
      await page.waitForTimeout(6000);
      r.orgDetail = {
        body: (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1200),
        controls: await page.evaluate(() =>
          Array.from(document.querySelectorAll("main button, main a")).map((b) =>
            (b.textContent || b.getAttribute("title") || "").trim()
          ).filter(Boolean)
        ),
      };
      await page.screenshot({ path: path.join(OUT, "org-detail.png"), fullPage: true });
    }

    // Live visits (empty state)
    await page.goto("/live-visits");
    await page.waitForTimeout(8000);
    r.liveVisits = {
      body: (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 900),
      controls: await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button")).map((b) => (b.textContent || "").trim()).filter(Boolean)
      ),
    };
    await page.screenshot({ path: path.join(OUT, "live-visits.png"), fullPage: true });

    // Submissions - can you act on a row?
    await page.goto("/submissions");
    await page.waitForTimeout(6000);
    r.submissions = {
      body: (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 900),
      rows: await page.locator("tbody tr").count(),
      rowButtons: await page
        .locator("tbody tr")
        .first()
        .locator("button, a")
        .evaluateAll((bs) => bs.map((b) => (b.textContent || b.getAttribute("title") || "").trim())),
      hasSearchBox: await page.locator("main input").count(),
      filters: await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button[aria-haspopup=listbox]")).map((b) =>
          (b.textContent || "").trim()
        )
      ),
    };
    // Click a submission row - does anything open?
    const view = page.locator("tbody tr").first().locator("button, a").first();
    if (await view.count()) {
      const before = page.url();
      await view.click();
      await page.waitForTimeout(4000);
      r.submissionRowClick = { before, after: page.url(), navigated: page.url() !== before };
      await page.screenshot({ path: path.join(OUT, "submission-view.png"), fullPage: true });
    }

    note("final-screens.json", r);
    expect(r).toBeTruthy();
  });

  test("Quantify the /assessments render loop", async ({ page }) => {
    const r: Record<string, unknown> = {};
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text().slice(0, 120));
    });
    await login(page);

    await page.goto("/farms");
    await page.waitForTimeout(4000);
    r.errorsOnFarms = errors.length;

    const before = errors.length;
    await page.goto("/assessments");
    await page.waitForTimeout(8000);
    r.errorsOnAssessments = errors.length - before;
    r.sample = errors.slice(before, before + 2);
    r.maxUpdateDepthCount = errors
      .slice(before)
      .filter((e) => /Maximum update depth exceeded/.test(e)).length;

    note("assessments-loop.json", r);
    expect(r).toBeTruthy();
  });

  test("FINAL: no QA Test records remain", async ({ page }) => {
    await login(page);
    const r: Record<string, unknown> = {};
    const scans: Array<[string, string]> = [
      ["farms", "farms"],
      ["fields", "fields"],
      ["programs", "programs"],
      ["users", "users"],
      ["organizations", "organizations"],
    ];
    for (const [label, key] of scans) {
      const res = await apiVia(page, "GET", `/${label}?limit=100`);
      const arr = res.json?.data?.[key] ?? [];
      r[label] = {
        total: arr.length,
        qaLeftover: arr
          .filter((x: any) => /QA Test/i.test(x.name ?? x.full_name ?? ""))
          .map((x: any) => x.name ?? x.full_name),
      };
    }
    const cats = await apiVia(page, "GET", "/assessments/categories");
    const arr = cats.json?.data?.categories ?? [];
    r.categories = {
      total: arr.length,
      qaLeftover: arr.filter((c: any) => /QA Test/i.test(c.name)).map((c: any) => c.name),
    };
    note("final-clean.json", r);

    for (const k of Object.keys(r)) {
      expect((r as any)[k].qaLeftover).toEqual([]);
    }
  });
});
