import { test, expect } from "@playwright/test";
import { captureProblems, ADMIN_EMAIL, ADMIN_PASSWORD, OUT, note } from "./qa-utils";
import path from "path";

test.describe("Login screen", () => {
  test("BUG: super_admin is refused by the admin panel role gate", async ({ page }) => {
    const { consoleErrors, failedRequests } = captureProblems(page);
    const loginCalls: string[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/auth/login")) {
        loginCalls.push(`${r.status()} ${r.url()} :: ${(await r.text().catch(() => "")).slice(0, 200)}`);
      }
    });

    await page.goto("/login");
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    // The API call succeeds (200) but the UI refuses the role.
    await page.waitForTimeout(12000);
    const toast = await page.locator("body").innerText();
    note("login-api-calls.json", loginCalls);
    await page.screenshot({ path: path.join(OUT, "login-role-gate.png"), fullPage: true });

    const stored = await page.evaluate(() => ({
      token: localStorage.getItem("farmer_admin_token"),
      user: localStorage.getItem("farmer_admin_user"),
    }));

    note("login-role-gate.json", {
      urlAfterSignIn: page.url(),
      visibleText: toast.replace(/\s+/g, " ").slice(0, 400),
      storedToken: stored.token,
      storedUser: stored.user,
      failedRequests,
      consoleErrors: consoleErrors.slice(0, 5),
    });

    // Document the actual (buggy) behaviour: still on /login, nothing stored.
    expect(page.url()).toContain("/login");
    expect(toast).toContain("Access denied");
    expect(stored.token).toBeNull();
  });

  test("login validation: empty + invalid email + wrong password", async ({ page }) => {
    const results: Record<string, unknown> = {};
    await page.goto("/login");

    // 1. Submit completely empty
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(500);
    results.emptySubmit = await page
      .locator(".field-error")
      .allInnerTexts()
      .catch(() => []);

    // 2. Invalid email format
    await page.locator("#email").fill("not-an-email");
    await page.locator("#password").fill("something");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(500);
    results.invalidEmail = await page.locator(".field-error").allInnerTexts();

    // 3. Wrong password against a real account
    await page.locator("#email").fill(ADMIN_EMAIL);
    await page.locator("#password").fill("WrongPassword!999");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(2500);
    results.wrongPassword = (await page.locator("body").innerText())
      .replace(/\s+/g, " ")
      .slice(0, 300);

    // 4. Show/hide password toggle
    await page.locator("#password").fill("visible-check");
    const before = await page.locator("#password").getAttribute("type");
    await page.getByRole("button", { name: /show password/i }).click();
    const after = await page.locator("#password").getAttribute("type");
    results.passwordToggle = { before, after };

    // 5. Forgot password view
    await page.getByRole("button", { name: /forgot password/i }).click();
    await page.waitForTimeout(600);
    results.forgotView = (await page.locator("body").innerText())
      .replace(/\s+/g, " ")
      .slice(0, 400);
    await page.screenshot({ path: path.join(OUT, "login-forgot.png"), fullPage: true });

    note("login-validation.json", results);
    expect(results).toBeTruthy();
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/farms");
    await page.waitForTimeout(1500);
    expect(page.url()).toContain("/login");
  });
});
