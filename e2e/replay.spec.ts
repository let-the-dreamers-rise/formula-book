import { expect, test } from "@playwright/test";
import { card, rows, say, tap } from "./sim";

// Replay mode: the same host and real MCP client, answered from the server's recorded replies.
// No server calls are needed, so this is what the hosted build runs.
test("replay: labelled, recorded answers for the golden path, no guessing outside it", async ({ page }) => {
  await page.goto("/sim?replay=1");
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("mode-badge")).toHaveText("Replay");
  await expect(page.getByTestId("sim-banner")).toContainText("Recorded MCP server replies");
  await expect(rows(page, "initialize")).toHaveCount(1);

  await say(page, "Lena's last formula");
  await expect(card(page, "card-total")).toHaveText("100 g");
  await say(page, "Make it one and a half times");
  await expect(card(page, "card-total")).toHaveText("150 g");

  await say(page, "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half");
  await expect(card(page, "card-total")).toHaveText("125 g");
  await expect(page.getByTestId("usage-count")).toHaveText("4 of 50");
  await tap(page, "new-session");
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await say(page, "Marta's last formula");
  await expect(card(page, "card-total")).toHaveText("125 g");

  await page.getByTestId("utterance-input").fill("Priya's last formula");
  await page.getByTestId("utterance-send").click();
  const dialog = page.getByTestId("elicit-dialog");
  await expect(dialog).toHaveAttribute("data-source", "elicitation");
  await dialog.getByRole("button", { name: /Shah/ }).click();
  await expect(card(page, "card-client")).toHaveText("Priya Shah");

  await say(page, "Zed's last formula");
  await expect(page.getByTestId("spoken-reply")).toContainText("only has the server's recorded answers");

  await page.getByTestId("salon-select").selectOption({ label: "Booth 12 (capped)" });
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
  await expect(page.getByTestId("usage-count")).toHaveText("50 of 50");
  await say(page, "Colour Ines: 30 grams 6N, 20 volume, one to one");
  await expect(page.getByTestId("spoken-reply")).toContainText("free plan holds 50 formulas");
  await page.getByTestId("waitlist-email").fill("test@example.invalid");
  await tap(page, "waitlist-submit");
  await expect(page.getByTestId("waitlist-count")).toHaveText("1");
  await expect(page.getByTestId("waitlist-store-label")).toHaveText("Replay, kept in this tab only");
});
