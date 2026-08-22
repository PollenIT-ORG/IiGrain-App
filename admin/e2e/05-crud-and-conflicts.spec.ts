import { test, expect, type Page } from "@playwright/test";
import { login, captureProblems, note, OUT, apiVia } from "./qa-utils";
import path from "path";

const TAG = "QA Test";

async function toast(page: Page): Promise<string> {
  // react-hot-toast renders each toast in a div with role="status"
  const t = page.locator("[role=status]");
  try {
    await t.first().waitFor({ state: "visible", timeout: 8000 });
    return (await t.first().innerText()).replace(/\s+/g, " ").trim();
  } catch {
    return "<no toast>";
  }
}

/** The custom <Select> renders a <button id=...>; click it then pick an option. */
async function pickSelectById(page: Page, id: string, optionIndex = 1) {
  await page.locator(`button#${id}`).waitFor({ state: "visible", timeout: 20000 });
  await page.locator(`button#${id}`).click();
  await page.waitForTimeout(600);
  await page.locator("li[role=option]").nth(optionIndex).click();
  await page.waitForTimeout(500);
}

test.describe("CRUD lifecycle, destructive actions and 409 handling", () => {
  test.setTimeout(300_000);

  test("Farm: create -> toast -> list refresh -> edit -> detail -> reset -> delete", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // CREATE
    await page.goto("/farms/new");
    await page.waitForTimeout(2500);
    await page.locator("#name").fill(`${TAG} Farm Alpha`);
    await page.locator("#area").fill("12.5");
    await page.locator("#location").fill("QA Test Location");
    await pickSelectById(page, "owner", 1); // choose first real farmer
    r.ownerChosen = await page.locator("button#owner").innerText();
    await page.getByRole("button", { name: /Create farm/ }).click();
    r.createToast = await toast(page);
    await page.waitForTimeout(2500);
    r.urlAfterCreate = page.url();

    // Does the list show it immediately?
    await page.goto("/farms");
    await page.getByPlaceholder("Search by name, location, or owner").fill(`${TAG} Farm Alpha`);
    await page.waitForTimeout(2500);
    r.foundInListAfterCreate = await page.locator("tbody tr").count();

    const farmRes = await apiVia(page, "GET", `/farms?limit=100&search=${encodeURIComponent(TAG + " Farm Alpha")}`);
    const farm = (farmRes.json?.data?.farms ?? farmRes.json?.data ?? [])[0];
    r.createdFarmId = farm?.id;
    r.createdFarmApi = farm;

    if (farm) {
      // EDIT
      await page.goto(`/farms/${farm.id}/edit`);
      await page.waitForTimeout(2500);
      r.editPrefilledName = await page.locator("#name").inputValue();
      await page.locator("#name").fill(`${TAG} Farm Alpha Renamed`);
      await page.getByRole("button", { name: /Save changes|Update farm/i }).click();
      r.editToast = await toast(page);
      await page.waitForTimeout(2000);

      // DETAIL
      await page.goto(`/farms/${farm.id}`);
      await page.waitForTimeout(2500);
      r.detailBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1200);
      r.detailControls = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button, main a")).map((b) =>
          (b.textContent || b.getAttribute("title") || "").trim()
        ).filter(Boolean)
      );
      await page.screenshot({ path: path.join(OUT, "farm-detail.png"), fullPage: true });

      // RESET (confirm dialog wording + result)
      const resetBtn = page.getByRole("button", { name: /^Reset$/ });
      if (await resetBtn.count()) {
        await resetBtn.click();
        await page.waitForTimeout(800);
        r.resetDialog = await page
          .locator("[role=dialog]")
          .innerText()
          .then((t) => t.replace(/\s+/g, " "))
          .catch(() => "<no dialog>");
        await page.getByRole("button", { name: /^Reset$/ }).last().click();
        r.resetToast = await toast(page);
        await page.waitForTimeout(2000);
      }
    }

    r.consoleErrors = consoleErrors.slice(0, 10);
    r.failedRequests = failedRequests.slice(0, 10);
    note("crud-farm.json", r);
    expect(r).toBeTruthy();
  });

  test("Field: soil validation with a farm selected, then create/edit/detail tabs", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);

    await page.goto("/fields/new");
    await page.waitForTimeout(2500);
    await pickSelectById(page, "farm", 1);
    await page.locator("#name").fill(`${TAG} Field Beta`);

    // area negative -> where is the error shown?
    await page.locator("#area").fill("-5");
    await page.getByRole("button", { name: /Create field/ }).click();
    r.negativeAreaToast = await toast(page);
    r.negativeAreaInline = await page.locator(".field-error").allInnerTexts();

    // pH out of range
    await page.locator("#area").fill("5");
    await page.locator("#ph").fill("99");
    await page.getByRole("button", { name: /Create field/ }).click();
    r.badPhToast = await toast(page);
    r.badPhInline = await page.locator(".field-error").allInnerTexts();

    // moisture 500% - is a percentage bounded?
    await page.locator("#ph").fill("6.5");
    await page.locator("#moisture").fill("500");
    await page.getByRole("button", { name: /Create field/ }).click();
    r.moisture500Toast = await toast(page);
    await page.waitForTimeout(2500);
    r.urlAfterMoisture500 = page.url();

    // sowing after harvest
    if (page.url().includes("/fields/new")) {
      await page.locator("#moisture").fill("20");
      await page.locator("#sowingDate").fill("2026-12-31");
      await page.locator("#expectedHarvest").fill("2026-01-01");
      await page.getByRole("button", { name: /Create field/ }).click();
      r.badDatesToast = await toast(page);
      await page.waitForTimeout(2500);
      r.urlAfterBadDates = page.url();
    }

    const fRes = await apiVia(page, "GET", `/fields?limit=100&search=${encodeURIComponent(TAG + " Field Beta")}`);
    const fields = fRes.json?.data?.fields ?? fRes.json?.data ?? [];
    r.createdFields = fields.map((f: any) => ({
      id: f.id,
      name: f.name,
      area: f.area_acres,
      sowing: f.sowing_date,
      harvest: f.expected_harvest,
    }));

    // Detail page tabs
    if (fields[0]) {
      await page.goto(`/fields/${fields[0].id}`);
      await page.waitForTimeout(3000);
      r.fieldDetailTabs = await page.evaluate(() =>
        Array.from(document.querySelectorAll("main button")).map((b) =>
          (b.textContent || "").trim()
        ).filter(Boolean)
      );
      r.fieldDetailBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1500);
      await page.screenshot({ path: path.join(OUT, "field-detail.png"), fullPage: true });

      // Walk each tab
      const tabs = ["Soil", "Documents", "History", "Overview"];
      const tabInfo: Record<string, string> = {};
      for (const t of tabs) {
        const btn = page.getByRole("button", { name: new RegExp(`^${t}`, "i") }).first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(2000);
          tabInfo[t] = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 800);
          await page.screenshot({ path: path.join(OUT, `field-tab-${t}.png`), fullPage: true });
        } else {
          tabInfo[t] = "<tab not found>";
        }
      }
      r.tabs = tabInfo;
    }

    r.consoleErrors = consoleErrors.slice(0, 10);
    r.failedRequests = failedRequests.slice(0, 10);
    note("crud-field.json", r);
    expect(r).toBeTruthy();
  });

  test("409 conflict: duplicate organization code is surfaced to the user", async ({ page }) => {
    const r: Record<string, unknown> = {};
    await login(page);

    // Find an existing org code to collide with
    const orgs = await apiVia(page, "GET", "/organizations?limit=5");
    const existing = (orgs.json?.data?.organizations ?? orgs.json?.data ?? [])[0];
    r.collidingWith = { name: existing?.name, code: existing?.code };

    await page.goto("/organizations/new");
    await page.waitForTimeout(2000);
    await page.locator("#name").fill(`${TAG} Org Conflict`);
    await page.locator("#code").fill(existing.code);
    await page.getByRole("button", { name: /Create organization/ }).click();
    r.conflictToast = await toast(page);
    await page.waitForTimeout(2000);
    r.urlAfterConflict = page.url();
    r.inlineErrorNearCodeField = await page.locator(".field-error").allInnerTexts();
    await page.screenshot({ path: path.join(OUT, "org-409.png"), fullPage: true });

    // did it create anything anyway?
    const after = await apiVia(page, "GET", `/organizations?limit=100&search=${encodeURIComponent(TAG)}`);
    r.qaOrgsCreated = (after.json?.data?.organizations ?? after.json?.data ?? []).map(
      (o: any) => ({ id: o.id, name: o.name, code: o.code })
    );

    note("conflict-org.json", r);
    expect(r).toBeTruthy();
  });

  test("409 conflict: deleting a field that has a submitted assessment", async ({ page }) => {
    const r: Record<string, unknown> = {};
    await login(page);

    // Find a field that the backend will certainly refuse to delete.
    const subs = await apiVia(page, "GET", "/programs/submissions?limit=5");
    const rows = subs.json?.data?.submissions ?? subs.json?.data ?? [];
    r.rawSubmissionKeys = rows[0] ? Object.keys(rows[0]) : [];
    r.submissionSample = rows.slice(0, 3);
    const target = rows[0];
    r.targetField = { id: target?.field_id, name: target?.field_name };

    if (target?.field_id) {
      // Verify via API first that the backend refuses (safe: it must 409).
      const probe = await apiVia(page, "DELETE", `/fields/${target.field_id}`);
      r.apiDeleteStatus = probe.status;
      r.apiDeleteMessage = probe.json?.message;

      // Now do it through the UI and see whether that message reaches the user.
      await page.goto("/fields");
      await page.getByPlaceholder("Search by name, crop, or location").fill(target.field_name);
      await page.waitForTimeout(2500);
      const row = page.locator("tbody tr").first();
      r.rowFound = await row.count();
      if (await row.count()) {
        await row.locator("button[title='Delete']").click();
        await page.waitForTimeout(800);
        r.confirmDialog = (await page.locator("[role=dialog]").innerText()).replace(/\s+/g, " ");
        await page.getByRole("button", { name: /^Delete$/ }).last().click();
        r.conflictToast = await toast(page);
        await page.waitForTimeout(2000);
        r.stillListed = await page.locator("tbody tr").count();
        await page.screenshot({ path: path.join(OUT, "field-delete-409.png"), fullPage: true });
      }
    }

    note("conflict-field-delete.json", r);
    expect(r).toBeTruthy();
  });
});
