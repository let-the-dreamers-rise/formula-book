import { expect, test } from "@playwright/test";
import { card, lastRow, openSim, resetDemo, say } from "./sim";

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
