import { type Page, expect } from "@playwright/test";

export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "superadmin@farmerapp.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "SuperSecret!123";
export const API_URL = process.env.API_URL ?? "http://localhost:5001/api/v1";

/** Log in through the real UI and wait until the app shell is rendered. */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in|log ?in/i }).click();
  await expect(page).toHaveURL(/\/(dashboard)?$|\/dashboard/, { timeout: 20_000 });
}

/** Collect browser console errors and failed network calls for a page. */
export function captureProblems(page: Page): {
  consoleErrors: string[];
  failedRequests: string[];
} {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 400) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    }
  });

  return { consoleErrors, failedRequests };
}

/** Get an API token directly, for setup/teardown that should not go through the UI. */
export async function apiToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = (await res.json()) as { data: { token: string } };
  return json.data.token;
}
