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

test("Settings has a Branding tab with logo and favicon upload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: /^branding$/i }).click();

  await expect(page.getByRole("heading", { name: /^logo$/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^favicon$/i })).toBeVisible();
  // each section has an upload control
  const uploadButtons = page.getByRole("button", { name: /upload|replace/i });
  expect(await uploadButtons.count()).toBeGreaterThanOrEqual(2);
  // size guide is shown
  await expect(page.getByText(/200 x 50 px/i)).toBeVisible();
  await expect(page.getByText(/64 x 64 px, square/i)).toBeVisible();
  // fallback notes are shown
  await expect(page.getByText(/default app logo is shown/i)).toBeVisible();
  expect(errors, errors.join(" | ")).toHaveLength(0);
});

test("default logo and favicon are used when no custom branding is set", async ({
  page,
}) => {
  await login(page);
  // default FarmerApp logo text is visible in the sidebar (no custom logo set)
  await expect(page.getByText("FarmerApp").first()).toBeVisible();
  // the favicon link falls back to the built-in default
  const href = await page
    .locator('link[rel="icon"]')
    .first()
    .getAttribute("href");
  expect(href).toMatch(/favicon\.svg$/);
});
