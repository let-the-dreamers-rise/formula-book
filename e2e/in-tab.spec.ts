import { expect, test } from "@playwright/test";
import { card, rows, say, tap } from "./sim";

// In-tab mode: the real Formula Book and diary server code runs inside the page over in-memory
// transports. This is what the hosted demo runs, so it needs no server process.
test("in-tab: real server code in the page, labelled, with elicitation and the free-plan cap", async ({ page }) => {
  await page.goto("/sim?intab=1");
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("mode-badge")).toHaveText("Server in this tab");
  await expect(page.getByTestId("sim-banner")).toContainText("running in this tab");
  await expect(page.getByTestId("diary-status")).toBeVisible();
  await expect(page.getByTestId("session-id")).toContainText("in-tab-");

  await say(page, "Lena's last formula");
  await expect(card(page, "card-total")).toHaveText("100 g");
  await say(page, "Make it one and a half times");
  await expect(card(page, "card-total")).toHaveText("150 g");
  await say(page, "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half");
  await expect(page.getByTestId("usage-count")).toHaveText("4 of 50");
  await tap(page, "new-session");
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await say(page, "Marta's last formula");
  await expect(card(page, "card-total")).toHaveText("125 g");

  await page.getByTestId("utterance-input").fill("Priya's last formula");
  await page.getByTestId("utterance-send").click();
  await page.getByTestId("elicit-dialog").getByRole("button", { name: /Shah/ }).click();
  await expect(card(page, "card-client")).toHaveText("Priya Shah");
  await expect(rows(page, "elicitation/create")).toHaveCount(1);

  await page.getByTestId("salon-select").selectOption({ label: "Booth 12 (capped)" });
  await expect(page.getByTestId("usage-count")).toHaveText("50 of 50", { timeout: 30_000 });
  await say(page, "Colour Ines: 30 grams 6N, 20 volume, one to one");
  await expect(page.getByTestId("spoken-reply")).toContainText("free plan holds 50 formulas");
});

test("in-tab: Claude works across the diary and Formula Book", async ({ page, request }) => {
  const status = (await (await request.get("/api/choose")).json()) as { available: boolean; label: string };
  test.skip(!status.available, "No ANTHROPIC_API_KEY on the web server");
  await page.goto("/sim?intab=1");
  await expect(page.getByTestId("diary-status")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("chooser-select").selectOption("claude");
  await page.getByTestId("utterance-input").fill("Who's booked in today? Get their bowls ready");
  await page.getByTestId("utterance-send").click();
  await expect(page.locator('[data-testid="traffic-row"][data-method="tools/call"]', { hasText: "list_appointments" })).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText("Lena Okafor: 40 grams 5N", { timeout: 30_000 });
});
