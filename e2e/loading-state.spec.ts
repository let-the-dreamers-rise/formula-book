import { expect, test } from "@playwright/test";
import { card, openSim, resetDemo, say, setToolDelay } from "./sim";

// Spec section 3 (c): with every tool slowed to 800 ms (E2E builds only), the skeleton shows the
// tool's own loading text before the card renders. Kept out of the 10-of-10 gate on purpose.
test.beforeEach(async ({ page }) => {
  await resetDemo(page);
  await setToolDelay(page, 800);
});
test.afterEach(async ({ page }) => setToolDelay(page, 0));

test("the skeleton card shows the tool's loading text, then the card replaces it", async ({ page }) => {
  await openSim(page);
  await page.getByTestId("utterance-input").fill("Lena's last formula");
  await page.getByTestId("utterance-send").click();

  const skeleton = page.getByTestId("skeleton-card");
  await expect(skeleton).toBeVisible();
  await expect(skeleton).toContainText("Looking up the formula");
  await expect(page.getByTestId("widget-frame")).toHaveCount(0);

  await expect(card(page, "card-total")).toHaveText("100 g");
  await expect(skeleton).toHaveCount(0);

  // A second call shows the skeleton over the existing card, which stays mounted underneath.
  await page.getByTestId("utterance-input").fill("Make it one and a half times");
  await page.getByTestId("utterance-send").click();
  await expect(skeleton).toContainText("Scaling the formula");
  await expect(page.getByTestId("widget-frame")).toHaveCount(1);
  await say(page, "Lena's last formula");
  await expect(card(page, "card-total")).toHaveText("100 g");
});
