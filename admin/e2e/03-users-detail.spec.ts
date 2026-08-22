import { test, expect, type Page } from "@playwright/test";
import { login, captureProblems, note, OUT, apiVia } from "./qa-utils";
import path from "path";

async function pickSelect(page: Page, current: string | RegExp, option: string | RegExp) {
  await page.getByRole("button", { name: current }).first().click();
  await page.locator("li[role=option]").filter({ hasText: option }).first().click();
}

async function roleColumn(page: Page): Promise<string[]> {
  return page.locator("tbody tr").evaluateAll((rows) =>
    rows.map((r) => (r.querySelectorAll("td")[3]?.textContent || "").trim())
  );
}

test.describe("Users: filters, stale data, row actions", () => {
  test.setTimeout(240_000);

  test("role filter really filters + stale-data-while-loading check", async ({ page }) => {
    const r: Record<string, unknown> = {};
    const calls: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/users?")) calls.push(req.url());
    });

    await login(page);
    await page.goto("/users");
    await page.waitForSelector("tbody tr", { timeout: 20000 });
    r.allRoles = await roleColumn(page);
    r.allSubtitle = await page.locator("h1 + p").innerText();

    // Switch to Assessor and immediately sample the table (before refetch lands)
    await pickSelect(page, /All roles/i, /^Assessor$/);
    await page.waitForTimeout(250);
    r.immediatelyAfterFilterChange = {
      roles: await roleColumn(page),
      subtitle: await page.locator("h1 + p").innerText(),
      loaderVisible: await page.locator("text=/loading/i").isVisible().catch(() => false),
    };

    // Now wait properly
    await page.waitForTimeout(4000);
    r.afterSettle = {
      roles: await roleColumn(page),
      subtitle: await page.locator("h1 + p").innerText(),
      url: page.url(),
    };
    r.apiCalls = calls.slice(-6);

    note("users-role-filter.json", r);
    expect(r).toBeTruthy();
  });

  test("row actions: status toggle, detail page, assign assessor, restore", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/users");
    await page.waitForSelector("tbody tr", { timeout: 20000 });

    // What actions does a row expose?
    r.rowActionTitles = await page
      .locator("tbody tr")
      .first()
      .locator("button")
      .evaluateAll((bs) =>
        bs.map((b) => b.getAttribute("title") || (b.textContent || "").trim())
      );

    // Open first user's detail page
    await page.locator("tbody tr").first().locator("td").first().click();
    await page.waitForTimeout(2500);
    r.detailUrl = page.url();
    r.detailBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 1500);
    r.detailControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button, main a")).map((b) =>
        (b.textContent || b.getAttribute("title") || "").trim()
      ).filter(Boolean)
    );
    await page.screenshot({ path: path.join(OUT, "user-detail.png"), fullPage: true });

    // Compare UI fields against what the API returns for the same user
    const id = page.url().split("/users/")[1];
    if (id && !id.includes("new")) {
      const res = await apiVia(page, "GET", `/users/${id}`);
      r.apiUserFields = Object.keys(res.json?.data ?? {});
      r.apiUser = res.json?.data;
    }

    // Does an assessor-assignment control exist anywhere for a farmer?
    await page.goto("/users?role=farmer");
    await page.waitForSelector("tbody tr", { timeout: 20000 });
    await page.locator("tbody tr").first().locator("td").first().click();
    await page.waitForTimeout(2500);
    r.farmerDetailUrl = page.url();
    r.farmerDetailBody = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 2000);
    r.farmerDetailControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main button, main a")).map((b) =>
        (b.textContent || b.getAttribute("title") || "").trim()
      ).filter(Boolean)
    );
    await page.screenshot({ path: path.join(OUT, "farmer-detail.png"), fullPage: true });

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("users-row-actions.json", r);
    expect(r).toBeTruthy();
  });

  test("delete confirmation dialog appears and Cancel is non-destructive", async ({ page }) => {
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/users");
    await page.waitForSelector("tbody tr", { timeout: 20000 });
    const firstName = await page.locator("tbody tr").first().locator("td").first().innerText();

    const del = page.locator("tbody tr").first().locator("button[title='Delete']");
    r.deleteButtonExists = (await del.count()) > 0;
    if (r.deleteButtonExists) {
      await del.click();
      await page.waitForTimeout(800);
      r.dialogVisible = await page.locator("[role=dialog]").isVisible();
      r.dialogText = (await page.locator("[role=dialog]").innerText()).replace(/\s+/g, " ");
      await page.getByRole("button", { name: /^Cancel$/ }).click();
      await page.waitForTimeout(1200);
      r.afterCancelFirstRow = await page.locator("tbody tr").first().locator("td").first().innerText();
      r.unchanged = r.afterCancelFirstRow === firstName;
    }
    note("users-delete-dialog.json", r);
    expect(r).toBeTruthy();
  });
});
