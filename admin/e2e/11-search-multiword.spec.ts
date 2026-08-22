import { test, expect } from "@playwright/test";
import { login, note, apiVia } from "./qa-utils";

test("multi-word search on lists", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  const r: Record<string, unknown> = {};

  // Pick a real multi-word farm name to probe with.
  const all = await apiVia(page, "GET", "/farms?limit=100");
  const names = (all.json?.data?.farms ?? []).map((f: any) => f.name);
  r.allFarmNames = names;
  const multi = names.find((n: string) => n.split(" ").length >= 3);
  r.probeName = multi;

  if (multi) {
    const parts = multi.split(" ");
    const probes = [
      parts[0],
      `${parts[0]} ${parts[1]}`,
      multi,
      multi.toLowerCase(),
      `  ${parts[0]}  `,
    ];
    const out: Record<string, unknown> = {};
    for (const q of probes) {
      const res = await apiVia(page, "GET", `/farms?limit=100&search=${encodeURIComponent(q)}`);
      out[JSON.stringify(q)] = {
        count: (res.json?.data?.farms ?? []).length,
        names: (res.json?.data?.farms ?? []).map((f: any) => f.name).slice(0, 5),
      };
    }
    r.apiProbes = out;

    // And through the real UI search box
    await page.goto("/farms");
    await page.waitForSelector("tbody tr", { timeout: 20000 });
    const box = page.getByPlaceholder("Search by name, location, or owner");
    const uiOut: Record<string, unknown> = {};
    for (const q of [parts[0], `${parts[0]} ${parts[1]}`, multi]) {
      await box.fill(q);
      await page.waitForTimeout(2500);
      uiOut[q] = {
        rows: await page.locator("tbody tr").count(),
        subtitle: await page.locator("h1 + p").innerText(),
        firstRow: await page
          .locator("tbody tr td")
          .first()
          .innerText()
          .catch(() => ""),
      };
    }
    r.uiProbes = uiOut;
  }

  note("search-multiword.json", r);
  expect(r).toBeTruthy();
});
