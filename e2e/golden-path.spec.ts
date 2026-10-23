import { expect, test } from "@playwright/test";
import { card, lastRow, openSim, resetDemo, rows, say, tap } from "./sim";

// Golden path, spec section 3, steps 1 to 10.
// Every card assertion is made inside the MCP Apps iframe.
test.beforeEach(async ({ page }) => resetDemo(page));

test("golden path: recall, scale, save, new session, elicitation, refusal, three devices", async ({ page }) => {
  // 1. The labelled simulated surface, connected to the live server.
  await openSim(page);
  await expect(page.getByTestId("sim-banner")).toContainText("Simulated Alexa+");
  await expect(page.getByTestId("mode-badge")).toHaveText("Live server");
  await expect(page.getByTestId("chooser-badge")).toHaveText("Rule parser");
  await expect(page.getByTestId("empty-state")).toBeVisible();

  // 2. Recall, drawn by the card.
  await say(page, "Lena's last formula");
  await expect(card(page, "card-client")).toHaveText("Lena Okafor");
  await expect(card(page, "card-total")).toHaveText("100 g");
  await expect(lastRow(page)).toHaveAttribute("data-method", "tools/call");
  await expect(lastRow(page)).toContainText("get_last_formula");

  // 3. Scale, with the client taken from the conversation.
  await say(page, "Make it one and a half times");
  await expect(card(page, "card-total")).toHaveText("150 g");
  await expect(card(page, "card-scale-factor")).toHaveText("x1.5");
  await expect(page.getByTestId("spoken-reply")).toContainText("150 grams");
  await expect(lastRow(page)).toContainText("scale_formula");

  // 4. Save a new client in one sentence.
  await say(page, "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half");
  await expect(card(page, "card-client")).toHaveText("Marta");
  await expect(card(page, "card-total")).toHaveText("125 g");
  await expect(card(page, "card-developer")).toHaveText("75 g");
  await expect(card(page, "card-saved-tag")).toBeVisible();
  await expect(card(page, "demo-data-chip")).toBeVisible();

  // 5. A new MCP session still finds Marta: state lives on the server.
  const oldSession = await page.getByTestId("session-id").textContent();
  const initCount = await rows(page, "initialize").count();
  await tap(page, "new-session");
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("session-id")).not.toHaveText(oldSession ?? "");
  await expect(rows(page, "initialize")).toHaveCount(initCount + 1);
  await say(page, "Marta's last formula");
  await expect(card(page, "card-total")).toHaveText("125 g");

  // 6. Two Priyas: the server asks through MCP elicitation.
  await page.getByTestId("utterance-input").fill("Priya's last formula");
  await page.getByTestId("utterance-send").click();
  const dialog = page.getByTestId("elicit-dialog");
  await expect(dialog).toHaveAttribute("data-source", "elicitation");
  await expect(page.getByTestId("elicit-choice-0")).toBeVisible();
  await expect(page.getByTestId("elicit-choice-1")).toBeVisible();
  await dialog.getByRole("button", { name: /Shah/ }).click();
  await expect(card(page, "card-client")).toHaveText("Priya Shah");
  await expect(card(page, "card-total")).toHaveText("125 g");
  await expect(rows(page, "elicitation/create")).toHaveCount(1);

  // 7. An unknown client is a spoken refusal, not an error, and the card does not change.
  await say(page, "Rohan's last formula");
  await expect(page.getByTestId("spoken-reply")).toContainText("no formula for Rohan");
  await expect(page.getByTestId("error-banner")).toHaveCount(0);
  await expect(card(page, "card-client")).toHaveText("Priya Shah");

  // 8. Same result on the phone frame, re-adapted by host-context-changed with no new request.
  const calls = await rows(page, "tools/call").count();
  await tap(page, "device-mobile");
  await expect(page.getByTestId("device-frame")).toHaveAttribute("data-class", "mobile");
  await expect(page.getByTestId("widget-frame")).toBeVisible();
  await expect(card(page, "card-total")).toHaveText("125 g");
  await expect(page.frameLocator('[data-testid="widget-frame"]').locator("body")).toHaveAttribute("data-surface", "mobile");
  expect((await page.getByTestId("widget-frame").boundingBox())?.width).toBeLessThanOrEqual(375);
  await expect(rows(page, "tools/call")).toHaveCount(calls);

  // The speaker frame has no card: one spoken sentence carries every number.
  await tap(page, "device-speaker");
  await say(page, "Lena's last formula");
  await expect(page.getByTestId("widget-frame")).toHaveCount(0);
  const reply = page.getByTestId("spoken-reply");
  await expect(reply).toContainText("40 grams 5N");
  await expect(reply).toContainText("10 grams 6.3");
  await expect(reply).toContainText("35 minutes");
  await say(page, "Make it one and a half times");
  await expect(reply).toContainText("150 grams");
  await expect(page.getByTestId("widget-frame")).toHaveCount(0);

  // 9. The capped salon: the server refuses the 51st formula and the meter does not move.
  await tap(page, "device-echo-show-8");
  await page.getByTestId("salon-select").selectOption({ label: "Booth 12 (capped)" });
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("usage-count")).toHaveText("50 of 50");
  await expect(page.getByTestId("waitlist-store-label")).toHaveText("Local demo store");
  await expect(page.getByTestId("plan-price")).toHaveText("Hypothesis, payments not live");
  await say(page, "Colour Ines: 30 grams 6N, 20 volume, one to one");
  await expect(reply).toContainText("free plan holds 50 formulas");
  await expect(page.getByTestId("usage-count")).toHaveText("50 of 50");
  await expect(page.getByTestId("widget-frame")).toHaveCount(0);

  // 10. The waitlist, written to the local demo store only.
  await expect(page.getByTestId("waitlist-count")).toHaveText("0");
  await page.getByTestId("waitlist-email").fill("test@example.invalid");
  await tap(page, "waitlist-submit");
  await expect(page.getByTestId("waitlist-success")).toBeVisible();
  await expect(page.getByTestId("waitlist-count")).toHaveText("1");
  await expect(page.getByTestId("waitlist-store-label")).toHaveText("Local demo store");
});
