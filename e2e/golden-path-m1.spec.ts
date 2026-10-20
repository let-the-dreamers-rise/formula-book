import { expect, test } from "@playwright/test";
import { field, lastRow, openSim, resetDemo, say } from "./sim";

// M1 gate: steps 1 and 3 to 7 of the golden path (spec section 3), asserted on the plain result-json
// view. Step 2 runs without the skeleton. The card, step 8 and steps 9 to 10 come in M2 and M4.
test.beforeEach(async ({ page }) => resetDemo(page));

test("golden path, M1: recall, scale, save, new session, elicitation, refusal", async ({ page }) => {
  // 1. The labelled simulated surface, connected to the live server.
  await openSim(page);
  await expect(page.getByTestId("sim-banner")).toContainText("Simulated Alexa+");
  await expect(page.getByTestId("mode-badge")).toHaveText("Live server");
  await expect(page.getByTestId("chooser-badge")).toHaveText("Rule parser");
  await expect(page.getByTestId("empty-state")).toBeVisible();

  // 2. Recall.
  await say(page, "Lena's last formula");
  await expect(field(page, "client")).toHaveText("Lena Okafor");
  await expect(field(page, "total")).toHaveText("100 g");
  await expect(lastRow(page)).toHaveAttribute("data-method", "tools/call");
  await expect(lastRow(page)).toContainText("get_last_formula");

  // 3. Scale, with the client taken from the conversation.
  await say(page, "Make it one and a half times");
  await expect(field(page, "total")).toHaveText("150 g");
  await expect(field(page, "scale-factor")).toHaveText("x1.5");
  await expect(page.getByTestId("spoken-reply")).toContainText("150 grams");
  await expect(lastRow(page)).toContainText("scale_formula");

  // 4. Save a new client in one sentence.
  await say(page, "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half");
  await expect(field(page, "client")).toHaveText("Marta");
  await expect(field(page, "total")).toHaveText("125 g");
  await expect(field(page, "developer")).toHaveText("75 g");
  await expect(field(page, "saved")).toBeVisible();
  await expect(page.getByTestId("result-json").getByTestId("demo-data-chip")).toBeVisible();

  // 5. A new MCP session still finds Marta: state lives on the server.
  const oldSession = await page.getByTestId("session-id").textContent();
  const initializes = page.locator('[data-testid="traffic-row"][data-method="initialize"]');
  const initCount = await initializes.count();
  await page.getByTestId("new-session").click();
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("session-id")).not.toHaveText(oldSession ?? "");
  await expect(initializes).toHaveCount(initCount + 1);
  await say(page, "Marta's last formula");
  await expect(field(page, "total")).toHaveText("125 g");

  // 6. Two Priyas: the server asks through MCP elicitation.
  await page.getByTestId("utterance-input").fill("Priya's last formula");
  await page.getByTestId("utterance-send").click();
  const dialog = page.getByTestId("elicit-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-source", "elicitation");
  await expect(page.getByTestId("elicit-choice-0")).toBeVisible();
  await expect(page.getByTestId("elicit-choice-1")).toBeVisible();
  await dialog.getByRole("button", { name: /Shah/ }).click();
  await expect(field(page, "client")).toHaveText("Priya Shah");
  await expect(field(page, "total")).toHaveText("125 g");
  await expect(page.locator('[data-testid="traffic-row"][data-method="elicitation/create"]')).toHaveCount(1);

  // 7. An unknown client is a spoken refusal, not an error, and the last card stays.
  await say(page, "Rohan's last formula");
  await expect(page.getByTestId("spoken-reply")).toContainText("no formula for Rohan");
  await expect(page.getByTestId("error-banner")).toHaveCount(0);
  await expect(field(page, "client")).toHaveText("Priya Shah");
});
