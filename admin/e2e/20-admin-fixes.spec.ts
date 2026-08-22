import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@farmerapp.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "SuperSecret!123";

// Log in through the real UI. This also proves the super_admin login-gate fix:
// before, the panel refused super_admin even though the API accepted it.
async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test("super_admin can log into the panel (login gate fix)", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("Assessor Assignments page is reachable and renders", async ({ page }) => {
  const errors = collectErrors(page);
  await login(page);
  // sidebar link exists
  const link = page.getByRole("link", { name: /assessor assignments/i });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/assignments/);
  await expect(
    page.getByRole("heading", { name: /assessor assignments/i })
  ).toBeVisible();
  expect(errors, `console errors: ${errors.join(" | ")}`).toHaveLength(0);
});

// The topbar search was later removed (see 22-latest-changes), so no test here.

test("Export report downloads a CSV", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("button", { name: /export report/i })).toBeEnabled({
    timeout: 15_000,
  });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /export report/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/dashboard-report-.*\.csv/);
});
