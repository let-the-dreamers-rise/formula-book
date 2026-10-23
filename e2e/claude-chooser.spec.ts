import { expect, test } from "@playwright/test";
import { card, lastRow, openSim, resetDemo, rows, say } from "./sim";

// Video row 8: a phrasing the rule parser has no pattern for. Runs only when the web server has
// ANTHROPIC_API_KEY (each run makes two small Claude calls); skipped otherwise.
test("Claude picks the tool from the server's list for a phrasing the rule parser refuses", async ({ page, request }) => {
  const status = (await (await request.get("/api/choose")).json()) as { available: boolean; label: string };
  test.skip(!status.available, "No ANTHROPIC_API_KEY on the web server");
  await resetDemo(page);
  await openSim(page);
  await say(page, "Lena's last formula");
  await expect(card(page, "card-total")).toHaveText("100 g");

  const odd = "Lena has thick hair today, go for twice the amount";
  await say(page, odd);
  await expect(page.getByTestId("chooser-badge")).toHaveText("Rule parser");
  await expect(card(page, "card-total")).toHaveText("100 g");

  await page.getByTestId("chooser-select").selectOption("claude");
  await say(page, odd);
  await expect(page.getByTestId("chooser-badge")).toHaveText(status.label);
  await expect(card(page, "card-total")).toHaveText("200 g");
  await expect(card(page, "card-scale-factor")).toHaveText("x2");
  await expect(lastRow(page)).toContainText("scale_formula");
});

// One sentence, two clients: Claude plans one call per client and the host runs them in order.
test("Claude plans one call per client from one sentence", async ({ page, request }) => {
  const status = (await (await request.get("/api/choose")).json()) as { available: boolean; label: string };
  test.skip(!status.available, "No ANTHROPIC_API_KEY on the web server");
  await resetDemo(page);
  await openSim(page);
  await page.getByTestId("chooser-select").selectOption("claude");

  const replies = page.getByTestId("turn-assistant");
  await page.getByTestId("utterance-input").fill("Lena and Priya Shah are both in at three, get both bowls ready at one and a half times");
  await page.getByTestId("utterance-send").click();
  await expect(replies).toHaveCount(2, { timeout: 30_000 });
  await expect(rows(page, "tools/call")).toHaveCount(2);
  await expect(replies.nth(0)).toContainText("times 1.5");
  await expect(replies.nth(1)).toContainText("times 1.5");
  await expect(page.getByTestId("conversation").or(page.locator("body"))).toContainText("Lena Okafor");
  await expect(page.locator("body")).toContainText("Priya Shah:");
  await expect(card(page, "card-scale-factor")).toHaveText("x1.5");
  await expect(page.getByTestId("chooser-badge")).toHaveText(status.label);
});
