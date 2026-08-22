import { test, expect } from "@playwright/test";
import { login, captureProblems, scan, OUT } from "./qa-utils";
import fs from "fs";
import path from "path";

const ROUTES = [
  "/dashboard",
  "/login-logs",
  "/users",
  "/users/new",
  "/organizations",
  "/organizations/new",
  "/farms",
  "/farms/new",
  "/fields",
  "/fields/new",
  "/live-visits",
  "/programs",
  "/programs/new",
  "/submissions",
  "/assessments",
  "/assessments/categories/new",
  "/reports",
  "/settings",
  "/profile",
  "/profile/change-password",
];

test("smoke: crawl every route and record problems", async ({ page }) => {
  test.setTimeout(300_000);
  const report: Record<string, unknown>[] = [];
  const { consoleErrors, failedRequests } = captureProblems(page);

  await login(page);

  for (const route of ROUTES) {
    const errStart = consoleErrors.length;
    const reqStart = failedRequests.length;
    await page.goto(route);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);

    report.push({
      route,
      url: page.url(),
      ...(await scan(page)),
      newConsoleErrors: consoleErrors.slice(errStart),
      newFailedRequests: failedRequests.slice(reqStart),
    });
    await page
      .screenshot({
        path: path.join(OUT, "shot" + route.replace(/\//g, "_") + ".png"),
        fullPage: true,
      })
      .catch(() => {});
  }

  fs.writeFileSync(path.join(OUT, "smoke.json"), JSON.stringify(report, null, 2));
  expect(report.length).toBe(ROUTES.length);
});
