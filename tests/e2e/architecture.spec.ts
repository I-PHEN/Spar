import { expect, test } from "@playwright/test";

/**
 * The architecture explorer is a static development instrument: opening it,
 * walking every learning path, and selecting its interactive content must
 * never reach Groq, OpenRouter, or Deepgram.
 */

const PROVIDER_HOSTS = /(^|\.)(groq\.com|openrouter\.ai|deepgram\.com)(:[0-9]+)?$/i;

const TABS = [
  "System map",
  "Guided tour",
  "Experiences",
  "Voice pipeline",
  "Data & memory",
  "Latency lab",
] as const;

const EXPERIENCES = [
  { label: "Defense", id: "defense" },
  { label: "Boardroom", id: "boardroom" },
  { label: "Open Spar", id: "open_spar" },
  { label: "Drill", id: "drill" },
] as const;

test("every tab, one system node, and every experience open without a provider request", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (PROVIDER_HOSTS.test(host)) providerRequests.push(request.url());
  });

  await page.goto("/architecture");
  await expect(page.getByRole("heading", { name: "Spar architecture" })).toBeVisible();

  for (const label of TABS) {
    const tab = page.getByRole("tab", { name: label });
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByRole("tabpanel", { name: label, exact: true })).toBeVisible();
  }

  // Select one system node on the System map and confirm its detail renders.
  await page.getByRole("tab", { name: "System map" }).click();
  await page.getByRole("button", { name: /Session API/ }).first().click();
  const detail = page.getByRole("tabpanel", { name: "System map", exact: true });
  await expect(detail.getByText("Important files")).toBeVisible();
  await expect(detail).toContainText("src/app/api/sessions/route.ts");

  // Select every experience and confirm each ordered flow renders its steps.
  await page.getByRole("tab", { name: "Experiences" }).click();
  const flows = page.getByRole("tabpanel", { name: "Experiences", exact: true });
  for (const experience of EXPERIENCES) {
    const option = flows.getByRole("button", { name: new RegExp(experience.label, "i") });
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    await expect(flows.getByLabel(`${experience.id} ordered steps`)).toBeVisible();
  }
  await expect(flows.getByLabel("Drill ordered steps")).toContainText("correct-or-advance");

  // Give the Latency lab's same-origin metrics read a chance to settle so the
  // provider assertion covers everything the explorer can trigger. (The dev
  // server's HMR socket stays open, so networkidle never fires here.)
  await page.getByRole("tab", { name: "Latency lab" }).click();
  const lab = page.getByRole("tabpanel", { name: "Latency lab", exact: true });
  await expect(lab).toContainText(/Measured summary|No measured turns yet|Metrics are unavailable/, { timeout: 15_000 });

  expect(providerRequests).toEqual([]);
});
