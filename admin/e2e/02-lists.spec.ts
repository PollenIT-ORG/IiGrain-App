import { test, expect, type Page } from "@playwright/test";
import { login, captureProblems, note, OUT } from "./qa-utils";
import path from "path";

/** Open the custom <Select> whose current label matches `current`, then pick `option`. */
async function pickSelect(page: Page, current: string | RegExp, option: string | RegExp) {
  await page.getByRole("button", { name: current }).first().click();
  await page.locator("li[role=option]").filter({ hasText: option }).first().click();
  await page.waitForTimeout(1200);
}

async function rowNames(page: Page): Promise<string[]> {
  return page.locator("tbody tr").evaluateAll((rows) =>
    rows.map((r) => (r.querySelector("td")?.textContent || "").trim().replace(/\s+/g, " "))
  );
}

async function listState(page: Page) {
  return page.evaluate(() => {
    const body = document.body.innerText;
    return {
      rows: document.querySelectorAll("tbody tr").length,
      subtitle:
        (document.querySelector("h1")?.nextElementSibling?.textContent || "").trim(),
      pageIndicator: (body.match(/Page\s+\d+\s+of\s+\d+/) || [""])[0],
      prevDisabled: !!Array.from(document.querySelectorAll("button")).find(
        (b) => /previous/i.test(b.textContent || "") && (b as HTMLButtonElement).disabled
      ),
      nextDisabled: !!Array.from(document.querySelectorAll("button")).find(
        (b) => /next/i.test(b.textContent || "") && (b as HTMLButtonElement).disabled
      ),
      emptyText: /No .*found|No .* yet|nothing/i.test(body)
        ? (body.match(/No [^\n]*/) || [""])[0]
        : "",
      clickableHeaders: Array.from(document.querySelectorAll("th")).filter(
        (th) => th.querySelector("button") || /cursor-pointer/.test(th.className)
      ).length,
      totalHeaders: document.querySelectorAll("th").length,
    };
  });
}

test.describe("List screens: search / filter / pagination / sorting", () => {
  test.setTimeout(240_000);

  test("Users list", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/users");
    await page.waitForTimeout(1500);
    r.initial = await listState(page);
    r.initialRows = await rowNames(page);

    // search that should match
    const search = page.getByPlaceholder("Search by name, email, or phone");
    await search.fill("Farmer");
    await page.waitForTimeout(1500);
    r.searchFarmer = await listState(page);
    r.searchFarmerRows = await rowNames(page);

    // search that should match nothing -> empty state
    await search.fill("zzzz-no-such-user-qa");
    await page.waitForTimeout(1600);
    r.searchNoMatch = await listState(page);
    await page.screenshot({ path: path.join(OUT, "users-empty-search.png"), fullPage: true });

    await search.fill("");
    await page.waitForTimeout(1500);

    // role filter
    await pickSelect(page, /All roles/i, /^Assessor$/i);
    r.roleAssessor = await listState(page);
    r.roleAssessorRows = await rowNames(page);

    // combine role filter + search
    await search.fill("a");
    await page.waitForTimeout(1600);
    r.roleAssessorPlusSearch = await listState(page);

    await search.fill("");
    await page.waitForTimeout(1400);

    // status filter combined with role
    await pickSelect(page, /All statuses/i, /^Active$/i);
    r.roleAssessorActive = await listState(page);
    r.urlAfterFilters = page.url();

    // sidebar role deep-link
    await page.goto("/users?role=farmer");
    await page.waitForTimeout(1600);
    r.deepLinkFarmer = await listState(page);
    r.deepLinkFilterShows = await page
      .getByRole("button", { name: /All roles|Farmer/i })
      .first()
      .innerText()
      .catch(() => "");

    // pagination
    await page.goto("/users");
    await page.waitForTimeout(1600);
    const before = await rowNames(page);
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.waitForTimeout(1600);
    const after = await rowNames(page);
    r.pagination = {
      page1First: before[0],
      page2First: after[0],
      changed: before[0] !== after[0],
      state: await listState(page),
    };

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("list-users.json", r);
    expect(r).toBeTruthy();
  });

  test("Farms list", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/farms");
    await page.waitForTimeout(1600);
    r.initial = await listState(page);
    r.initialRows = await rowNames(page);

    const search = page.getByPlaceholder("Search by name, location, or owner");
    await search.fill("Farm");
    await page.waitForTimeout(1600);
    r.searchFarm = await listState(page);
    r.searchFarmRows = await rowNames(page);

    await search.fill("zzzz-no-such-farm-qa");
    await page.waitForTimeout(1600);
    r.searchNoMatch = await listState(page);

    await search.fill("");
    await page.waitForTimeout(1500);

    await pickSelect(page, /All statuses/i, /^Inactive$/i);
    r.statusInactive = await listState(page);
    r.statusInactiveRows = await rowNames(page);

    await pickSelect(page, /Inactive/i, /All statuses/i);

    // pagination
    const before = await rowNames(page);
    await page.getByRole("button", { name: /^Next$/i }).click();
    await page.waitForTimeout(1600);
    const after = await rowNames(page);
    r.pagination = {
      page1First: before[0],
      page2First: after[0],
      changed: before[0] !== after[0],
      state: await listState(page),
    };

    // Is any column sortable?
    r.sortable = await page.evaluate(() =>
      Array.from(document.querySelectorAll("th")).map((th) => ({
        text: (th.textContent || "").trim(),
        hasButton: !!th.querySelector("button"),
        clickable: /cursor-pointer|select-none/.test(th.className),
      }))
    );

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("list-farms.json", r);
    expect(r).toBeTruthy();
  });

  test("Fields list", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/fields");
    await page.waitForTimeout(1600);
    r.initial = await listState(page);
    r.initialRows = await rowNames(page);

    const search = page.getByPlaceholder("Search by name, crop, or location");
    await search.fill("Field");
    await page.waitForTimeout(1600);
    r.searchField = await listState(page);

    await search.fill("zzzz-nothing-qa");
    await page.waitForTimeout(1600);
    r.searchNoMatch = await listState(page);
    await search.fill("");
    await page.waitForTimeout(1500);

    // farm filter
    await page.getByRole("button", { name: /All farms/i }).first().click();
    const farmOptions = await page.locator("li[role=option]").allInnerTexts();
    r.farmFilterOptionCount = farmOptions.length;
    r.farmFilterHasSearch = await page.getByPlaceholder("Search...").isVisible().catch(() => false);
    if (farmOptions[1]) {
      await page.locator("li[role=option]").nth(1).click();
      await page.waitForTimeout(1600);
      r.farmFiltered = { option: farmOptions[1], ...(await listState(page)) };
      r.farmFilteredRows = await rowNames(page);
    }

    // active filter
    await pickSelect(page, /Active \/ inactive/i, /Inactive/i).catch(() => {});
    r.activeInactive = await listState(page);

    r.consoleErrors = consoleErrors.slice(0, 8);
    r.failedRequests = failedRequests.slice(0, 8);
    note("list-fields.json", r);
    expect(r).toBeTruthy();
  });

  test("Organizations / Programs / Submissions / Login logs", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // Organizations
    await page.goto("/organizations");
    await page.waitForTimeout(1600);
    r.orgsInitial = await listState(page);
    await page.getByPlaceholder("Search by name or code").fill("zzz-none-qa");
    await page.waitForTimeout(1600);
    r.orgsNoMatch = await listState(page);
    await page.getByPlaceholder("Search by name or code").fill("");
    await page.waitForTimeout(1400);

    // Programs
    await page.goto("/programs");
    await page.waitForTimeout(1600);
    r.programsInitial = await listState(page);
    r.programsRows = await rowNames(page);
    await page.getByPlaceholder("Search by name or code").fill("zzz-none-qa");
    await page.waitForTimeout(1600);
    r.programsNoMatch = await listState(page);
    await page.getByPlaceholder("Search by name or code").fill("");
    await page.waitForTimeout(1400);

    // Submissions - what filters exist?
    await page.goto("/submissions");
    await page.waitForTimeout(1800);
    r.submissionsInitial = await listState(page);
    r.submissionsControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button")).map((b) =>
        (b.textContent || "").trim().replace(/\s+/g, " ")
      ).filter(Boolean)
    );
    r.submissionsHasSearchBox = await page
      .locator("input[type=text]")
      .count();
    await page.screenshot({ path: path.join(OUT, "submissions.png"), fullPage: true });

    // Login logs
    await page.goto("/login-logs");
    await page.waitForTimeout(1600);
    r.loginLogsInitial = await listState(page);
    r.loginLogsControls = await page.evaluate(() =>
      Array.from(document.querySelectorAll("button, input, select")).map(
        (b) => (b.textContent || (b as HTMLInputElement).placeholder || "").trim()
      ).filter(Boolean)
    );

    // Live visits - empty state
    await page.goto("/live-visits");
    await page.waitForTimeout(2000);
    r.liveVisits = {
      ...(await listState(page)),
      body: (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600),
    };
    await page.screenshot({ path: path.join(OUT, "live-visits.png"), fullPage: true });

    r.consoleErrors = consoleErrors.slice(0, 10);
    r.failedRequests = failedRequests.slice(0, 10);
    note("list-others.json", r);
    expect(r).toBeTruthy();
  });
});
