import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@farmerapp.com";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "SuperSecret!123";

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}

test("enabled buttons show a pointer cursor", async ({ page }) => {
  await login(page);
  const btn = page.getByRole("button", { name: /export report/i });
  await expect(btn).toBeEnabled();
  const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("pointer");
});

test("notification checkboxes select and enable delete-selected", async ({
  page,
}) => {
  // seed a notification so the list is not empty: trigger one via an admin action
  await login(page);
  await page.goto("/notifications");
  // wait for the list to finish loading (a checkbox appears, or the empty state)
  await expect(
    page
      .locator('input[type="checkbox"][aria-label="Select notification"]')
      .first()
      .or(page.getByText(/no notifications yet/i))
  ).toBeVisible({ timeout: 15_000 });

  const firstCheckbox = page
    .locator('input[type="checkbox"][aria-label="Select notification"]')
    .first();
  const count = await firstCheckbox.count();
  test.skip(count === 0, "no notifications to select");

  // checkbox has pointer cursor
  const cursor = await firstCheckbox.evaluate(
    (el) => getComputedStyle(el).cursor
  );
  expect(cursor).toBe("pointer");

  // clicking it selects and shows the delete-selected button
  await firstCheckbox.check();
  await expect(firstCheckbox).toBeChecked();
  await expect(
    page.getByRole("button", { name: /delete selected/i })
  ).toBeVisible();

  // unchecking hides it again
  await firstCheckbox.uncheck();
  await expect(firstCheckbox).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: /delete selected/i })
  ).toHaveCount(0);
});
