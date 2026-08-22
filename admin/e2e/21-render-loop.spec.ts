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

test("/assessments does not loop (no 'Maximum update depth' errors)", async ({
  page,
}) => {
  const loopErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Maximum update depth/i.test(m.text())) {
      loopErrors.push(m.text());
    }
  });
  await login(page);
  await page.goto("/assessments");
  await expect(
    page.getByRole("heading", { name: /assessment/i }).first()
  ).toBeVisible({ timeout: 15_000 });
  // give any runaway effect time to fire
  await page.waitForTimeout(6000);
  expect(
    loopErrors,
    `render-loop errors seen: ${loopErrors.length}`
  ).toHaveLength(0);
});
