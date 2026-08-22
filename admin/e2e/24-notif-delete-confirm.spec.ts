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

test("per-item notification delete asks for confirmation", async ({ page }) => {
  await login(page);
  await page.goto("/notifications");
  const delBtn = page
    .getByRole("button", { name: /delete notification/i })
    .first();
  await expect(
    delBtn.or(page.getByText(/no notifications yet/i))
  ).toBeVisible({ timeout: 15_000 });
  test.skip((await delBtn.count()) === 0, "no notifications to delete");

  await delBtn.click();
  // a confirmation dialog must appear before anything is deleted
  await expect(page.getByText(/delete notification\?/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^delete$/i })).toBeVisible();
  // cancel leaves the notification in place
  await page.getByRole("button", { name: /cancel/i }).click();
  await expect(page.getByText(/delete notification\?/i)).toHaveCount(0);
});
