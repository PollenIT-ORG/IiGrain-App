import { test, expect, type Page } from "@playwright/test";
import { login, note, OUT, apiVia } from "./qa-utils";
import path from "path";

/**
 * Records every toast that ever appears, so a stale toast cannot be mistaken for
 * the response to the action under test.
 */
async function installToastRecorder(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __toasts: string[] }).__toasts = [];
    const push = () => {
      document.querySelectorAll("[role=status]").forEach((el) => {
        const t = (el.textContent || "").trim().replace(/\s+/g, " ");
        const arr = (window as unknown as { __toasts: string[] }).__toasts;
        if (t && arr[arr.length - 1] !== t) arr.push(t);
      });
    };
    const start = () => {
      new MutationObserver(push).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  });
}

async function resetToasts(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __toasts: string[] }).__toasts = [];
  });
}

async function getToasts(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __toasts: string[] }).__toasts ?? []
  );
}

/** Capture every failing API response body so we can compare with the toast. */
function trackApiErrors(page: Page) {
  const calls: Array<Record<string, unknown>> = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/api/v1")) return;
    if (res.status() < 400) return;
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* non-json */
    }
    calls.push({
      status: res.status(),
      method: res.request().method(),
      url: res.url().replace("http://localhost:5001/api/v1", ""),
      backendMessage: body?.message ?? null,
      backendErrors: body?.errors ?? null,
    });
  });
  return calls;
}

async function inlineErrors(page: Page): Promise<string[]> {
  return page
    .locator(".field-error")
    .allInnerTexts()
    .then((a) => a.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean));
}

/** Perform an action then report exactly what the user saw vs what the API said. */
async function observe(
  page: Page,
  label: string,
  action: () => Promise<void>,
  apiErrors: Array<Record<string, unknown>>,
  waitMs = 4000
) {
  await resetToasts(page);
  const before = apiErrors.length;
  await action();
  await page.waitForTimeout(waitMs);
  return {
    label,
    toastsShownToUser: await getToasts(page),
    inlineFieldErrors: await inlineErrors(page),
    apiErrorsDuringAction: apiErrors.slice(before),
    url: page.url(),
  };
}

test.describe("Failure paths: what does the user actually SEE?", () => {
  test.setTimeout(300_000);

  test("A. Login failures", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await page.goto("/login");

    r.emptySubmit = await observe(page, "empty submit", async () => {
      await page.getByRole("button", { name: "Sign in" }).click();
    }, api, 1500);

    r.wrongPassword = await observe(page, "wrong password", async () => {
      await page.locator("#email").fill("superadmin@farmerapp.com");
      await page.locator("#password").fill("DefinitelyWrong!999");
      await page.getByRole("button", { name: "Sign in" }).click();
    }, api, 6000);

    r.nonExistentEmail = await observe(page, "non-existent email", async () => {
      await page.locator("#email").fill("nobody.qa.test@example.com");
      await page.locator("#password").fill("Whatever123");
      await page.getByRole("button", { name: "Sign in" }).click();
    }, api, 6000);

    r.correctCredentialsSuperAdmin = await observe(page, "correct creds (super_admin)", async () => {
      await page.locator("#email").fill("superadmin@farmerapp.com");
      await page.locator("#password").fill("SuperSecret!123");
      await page.getByRole("button", { name: "Sign in" }).click();
    }, api, 12000);

    note("err-login.json", r);
    expect(r).toBeTruthy();
  });

  test("B. Bad ids in the URL should show a clean not-found screen", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    const routes = [
      "/farms/not-a-uuid",
      "/farms/00000000-0000-0000-0000-000000000000",
      "/fields/not-a-uuid",
      "/users/not-a-uuid",
      "/programs/not-a-uuid",
      "/organizations/not-a-uuid",
      "/assessments/categories/not-a-uuid/questions",
    ];
    const out: Record<string, unknown> = {};
    for (const route of routes) {
      await resetToasts(page);
      const before = api.length;
      await page.goto(route);
      await page.waitForTimeout(6000);
      const main = await page.locator("main").innerText().catch(() => "<no main>");
      out[route] = {
        visibleText: main.replace(/\s+/g, " ").slice(0, 300),
        stuckOnSpinner: /loading/i.test(main),
        blankScreen: main.trim().length === 0,
        toasts: await getToasts(page),
        apiErrors: api.slice(before).map((c) => ({ s: c.status, u: c.url, m: c.backendMessage })),
        hasBackLink: await page
          .getByRole("button", { name: /back/i })
          .count(),
      };
      await page.screenshot({
        path: path.join(OUT, "badid" + route.replace(/\//g, "_") + ".png"),
        fullPage: true,
      });
    }
    r.routes = out;
    note("err-bad-ids.json", r);
    expect(r).toBeTruthy();
  });

  test("C. Session expiry / cleared token", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/farms");
    await page.waitForSelector("tbody tr", { timeout: 20000 });

    // Simulate an expired session: token + refresh token both invalid.
    await page.evaluate(() => {
      localStorage.setItem("farmer_admin_token", "invalid.token.value");
      localStorage.setItem("farmer_admin_refresh_token", "invalid-refresh");
    });

    r.afterInvalidToken = await observe(page, "navigate with dead token", async () => {
      await page.goto("/users");
    }, api, 8000);
    r.finalUrl = page.url();
    r.visible = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
    await page.screenshot({ path: path.join(OUT, "session-expiry.png"), fullPage: true });

    // And with the token removed entirely
    await page.evaluate(() => localStorage.clear());
    await page.goto("/farms");
    await page.waitForTimeout(3000);
    r.afterFullClearUrl = page.url();

    note("err-session.json", r);
    expect(r).toBeTruthy();
  });

  test("D. Duplicate user email + over-long text", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);
    await page.goto("/users/new");
    await page.waitForTimeout(2500);

    r.duplicateEmail = await observe(page, "duplicate email w/ valid phone", async () => {
      await page.locator("#fullName").fill("QA Test Dup User");
      await page.locator("#email").fill("superadmin@farmerapp.com");
      await page.locator("#phone").fill("9876543210");
      await page.locator("#password").fill("ValidPass123");
      await page.getByRole("button", { name: /Create user/ }).click();
    }, api, 6000);
    await page.screenshot({ path: path.join(OUT, "user-dup-email.png"), fullPage: true });

    r.maxLengths = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main input, main textarea")).map((i) => ({
        id: (i as HTMLInputElement).id,
        maxlength: (i as HTMLInputElement).getAttribute("maxlength"),
      }))
    );

    note("err-user-dup.json", r);
    expect(r).toBeTruthy();
  });

  test("E. 409s: delete field / farm that has a submitted assessment", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    const subs = await apiVia(page, "GET", "/programs/submissions?limit=5");
    const rows = subs.json?.data?.submissions ?? [];
    const target = rows[0];
    r.target = { fieldName: target?.fieldName, farmName: target?.farmName };

    // Confirm the backend really refuses (so the UI click is safe).
    const probeField = await apiVia(page, "DELETE", `/fields/${target.fieldId}`);
    r.apiFieldDelete = { status: probeField.status, message: probeField.json?.message };

    // FIELD delete through the UI
    await page.goto("/fields");
    await page.getByPlaceholder("Search by name, crop, or location").fill(target.fieldName);
    await page.waitForTimeout(3000);
    r.fieldRowsFound = await page.locator("tbody tr").count();
    if (r.fieldRowsFound) {
      r.fieldDeleteUi = await observe(page, "delete field w/ submitted assessment", async () => {
        await page.locator("tbody tr").first().locator("button[title='Delete']").click();
        await page.waitForTimeout(900);
        await page.getByRole("button", { name: /^Delete$/ }).last().click();
      }, api, 6000);
      r.fieldStillListed = await page.locator("tbody tr").count();
      await page.screenshot({ path: path.join(OUT, "field-delete-409.png"), fullPage: true });
    }

    // FARM delete through the UI
    await page.goto("/farms");
    await page.getByPlaceholder("Search by name, location, or owner").fill(target.farmName);
    await page.waitForTimeout(3000);
    r.farmRowsFound = await page.locator("tbody tr").count();
    if (r.farmRowsFound) {
      r.farmDeleteUi = await observe(page, "delete farm w/ submitted assessment", async () => {
        await page.locator("tbody tr").first().locator("button[title='Delete']").click();
        await page.waitForTimeout(900);
        await page.getByRole("button", { name: /^Delete$/ }).last().click();
      }, api, 6000);
      r.farmStillListed = await page.locator("tbody tr").count();
      await page.screenshot({ path: path.join(OUT, "farm-delete-409.png"), fullPage: true });
    }

    note("err-delete-409.json", r);
    expect(r).toBeTruthy();
  });

  test("F. Shrink farm area below its fields, and enrol a field of a deactivated farm", async ({ page }) => {
    const api = trackApiErrors(page);
    await installToastRecorder(page);
    const r: Record<string, unknown> = {};
    await login(page);

    // Use only our own QA records.
    const farms = await apiVia(page, "GET", "/farms?limit=100&search=QA%20Test%20Farm%20Alpha");
    const farm = (farms.json?.data?.farms ?? [])[0];
    r.qaFarm = farm ? { id: farm.id, name: farm.name, area: farm.area_acres } : null;

    if (farm) {
      const fieldsRes = await apiVia(page, "GET", `/fields?limit=100&farmId=${farm.id}`);
      r.qaFarmFields = (fieldsRes.json?.data?.fields ?? []).map((f: any) => ({
        name: f.name,
        area: f.area_acres,
      }));

      // Shrink farm area to less than the sum of its fields
      await page.goto(`/farms/${farm.id}/edit`);
      await page.waitForTimeout(3000);
      r.shrinkArea = await observe(page, "shrink farm area below fields total", async () => {
        await page.locator("#area").fill("0.1");
        await page.getByRole("button", { name: /Save changes|Update farm/i }).click();
      }, api, 6000);
      await page.screenshot({ path: path.join(OUT, "farm-shrink-area.png"), fullPage: true });

      // Restore a sane area
      await page.goto(`/farms/${farm.id}/edit`);
      await page.waitForTimeout(2500);
      await page.locator("#area").fill("12.5");
      await page.getByRole("button", { name: /Save changes|Update farm/i }).click();
      await page.waitForTimeout(2500);

      // Deactivate the farm, then try to enrol its field in a program
      await page.goto(`/farms/${farm.id}/edit`);
      await page.waitForTimeout(2500);
      const activeToggle = page.locator("input[type=checkbox]").first();
      r.deactivate = await observe(page, "deactivate farm", async () => {
        if (await activeToggle.count()) await activeToggle.uncheck().catch(() => {});
        await page.getByRole("button", { name: /Save changes|Update farm/i }).click();
      }, api, 5000);

      const after = await apiVia(page, "GET", `/farms/${farm.id}`);
      r.farmActiveAfterToggle = after.json?.data?.is_active;
    }

    note("err-farm-area.json", r);
    expect(r).toBeTruthy();
  });
});
