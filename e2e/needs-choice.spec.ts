import { expect, test } from "@playwright/test";
import { field, openSim, resetDemo } from "./sim";

test.beforeEach(async ({ page }) => resetDemo(page));

test("a 2025-03-26 client gets needs_choice instead of elicitation", async ({ page }) => {
  await openSim(page, "?protocol=2025-03-26");
  await page.getByTestId("utterance-input").fill("Priya's last formula");
  await page.getByTestId("utterance-send").click();
  const dialog = page.getByTestId("elicit-dialog");
  await expect(dialog).toHaveAttribute("data-source", "needs_choice");
  await expect(page.locator('[data-testid="traffic-row"][data-method="elicitation/create"]')).toHaveCount(0);
  await dialog.getByRole("button", { name: /Shah/ }).click();
  await expect(field(page, "client")).toHaveText("Priya Shah");
});
