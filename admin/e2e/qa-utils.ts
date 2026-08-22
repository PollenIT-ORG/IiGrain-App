import { type Page, expect } from "@playwright/test";
import fs from "fs";
import path from "path";

export const ADMIN_EMAIL = "superadmin@farmerapp.com";
export const ADMIN_PASSWORD = "SuperSecret!123";
export const API_URL = "http://localhost:5001/api/v1";

export const OUT = path.join(process.cwd(), "qa-out");
fs.mkdirSync(OUT, { recursive: true });

/**
 * Log in through the real UI.
 * NOTE 1: e2e/helpers.ts `login()` is broken - getByLabel(/password/i) matches both
 *   the password input and the "Show password" toggle button (strict mode violation).
 * NOTE 2: BUG - Login.tsx rejects every role except exactly "admin", so the seeded
 *   super_admin account can never get in through the UI. We fall back to seeding the
 *   real API token into localStorage so the rest of the panel can be tested.
 */
const CRED_CACHE = path.join(OUT, ".creds.json");

/**
 * Get a token, caching to disk so we do not trip the backend's login rate limit
 * when many specs each need a session.
 */
async function getCreds(page: Page): Promise<{
  token: string;
  refreshToken: string;
  user: unknown;
}> {
  if (fs.existsSync(CRED_CACHE)) {
    const cached = JSON.parse(fs.readFileSync(CRED_CACHE, "utf8"));
    // JWT is short lived (15 min); refresh it rather than re-logging in.
    const fresh = await page.evaluate(async (c) => {
      const r = await fetch("http://localhost:5001/api/v1/auth/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: c.refreshToken }),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, cached);
    if (fresh.status === 200 && fresh.body?.data?.token) {
      cached.token = fresh.body.data.token;
      fs.writeFileSync(CRED_CACHE, JSON.stringify(cached));
      return cached;
    }
  }

  let last = "";
  for (let i = 0; i < 6; i++) {
    const res = await page.evaluate(
      async (c) => {
        const r = await fetch("http://localhost:5001/api/v1/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: c.email, password: c.password }),
        });
        return { status: r.status, body: await r.text() };
      },
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    );
    last = `${res.status} ${res.body.slice(0, 200)}`;
    if (res.status === 200) {
      const data = JSON.parse(res.body).data;
      fs.writeFileSync(CRED_CACHE, JSON.stringify(data));
      return data;
    }
    await page.waitForTimeout(5000 * (i + 1));
  }
  throw new Error(`Could not obtain a token. Last response: ${last}`);
}

export async function login(page: Page): Promise<void> {
  // The real UI login is exercised in 01-login.spec.ts. It cannot succeed for the
  // seeded super_admin (see BUG: role gate), so every other spec seeds the session
  // the same way authSlice does, using a real token from the API.
  await page.goto("/login");
  const creds = await getCreds(page);

  await page.evaluate((d) => {
    localStorage.setItem("farmer_admin_token", d.token);
    localStorage.setItem("farmer_admin_refresh_token", d.refreshToken);
    localStorage.setItem("farmer_admin_user", JSON.stringify(d.user));
  }, creds);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
}

/** Call the backend API from inside the browser (sandbox blocks node fetch). */
export async function apiVia(
  page: Page,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  return page.evaluate(
    async ({ method, urlPath, body, base }) => {
      const token = localStorage.getItem("farmer_admin_token");
      const r = await fetch(base + urlPath, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let json: any = null;
      try {
        json = await r.json();
      } catch {
        /* empty */
      }
      return { status: r.status, json };
    },
    { method, urlPath, body, base: API_URL }
  );
}

export function captureProblems(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400)
      failedRequests.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return { consoleErrors, failedRequests };
}

export async function apiToken(): Promise<string> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const json = (await res.json()) as { data: { token: string } };
  return json.data.token;
}

export async function api(
  method: string,
  urlPath: string,
  body?: unknown,
  token?: string
) {
  const t = token ?? (await apiToken());
  const res = await fetch(`${API_URL}${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json: json as any };
}

export function note(file: string, data: unknown) {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2));
}

/** Read visible toast text (react-hot-toast). */
export async function toastText(page: Page, timeout = 6000): Promise<string> {
  const t = page.locator("[class*='toast'], [role='status'], [data-testid=toast]");
  try {
    await t.first().waitFor({ state: "visible", timeout });
    return (await t.first().innerText()).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/** Snapshot everything interesting about the current page. */
export async function scan(page: Page) {
  return page.evaluate(() => {
    const txt = (e: Element) => (e.textContent || "").trim().replace(/\s+/g, " ");
    return {
      headings: Array.from(document.querySelectorAll("h1,h2,h3")).map(txt),
      controls: Array.from(
        new Set(
          Array.from(
            document.querySelectorAll("button, a[href], [role=button]")
          )
            .map((e) => txt(e) || (e.getAttribute("aria-label") ?? ""))
            .filter(Boolean)
        )
      ),
      tableHeaders: Array.from(document.querySelectorAll("th")).map(txt),
      rowCount: document.querySelectorAll("tbody tr").length,
      inputs: Array.from(
        document.querySelectorAll("input,select,textarea")
      ).map((e) => {
        const el = e as HTMLInputElement;
        return `${el.tagName}|${el.type || ""}|name=${el.name || ""}|id=${
          el.id || ""
        }|ph=${el.placeholder || ""}`;
      }),
      hScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      body: (document.body.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 4000),
    };
  });
}
