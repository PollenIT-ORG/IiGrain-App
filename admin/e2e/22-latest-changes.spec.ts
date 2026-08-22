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

test("topbar search box is removed", async ({ page }) => {
  await login(page);
  await expect(page.getByPlaceholder(/search/i)).toHaveCount(0);
  await expect(page.locator("select[aria-label='Search in']")).toHaveCount(0);
});

test("notifications page loads from the bell 'View all' link", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.getByRole("button", { name: /notifications/i }).first().click();
  await page.getByRole("button", { name: /view all notifications/i }).click();
  await expect(page).toHaveURL(/\/notifications/);
  await expect(
    page.getByRole("heading", { name: /^notifications$/i })
  ).toBeVisible();
  expect(errors, errors.join(" | ")).toHaveLength(0);
});
