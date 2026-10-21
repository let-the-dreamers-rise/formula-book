import { expect, type Page } from "@playwright/test";

const MCP_ORIGIN = `http://127.0.0.1:${process.env.MCP_PORT || "8787"}`;

export async function resetDemo(page: Page): Promise<void> {
  const response = await page.request.post(`${MCP_ORIGIN}/admin/reset-demo`);
  expect(response.ok()).toBe(true);
}

export async function openSim(page: Page, query = ""): Promise<void> {
  await page.goto(`/sim${query}`);
  await expect(page.getByTestId("server-status")).toHaveText("Connected", { timeout: 30_000 });
}

/** Types an utterance and waits until the assistant has answered it. */
export async function say(page: Page, utterance: string): Promise<void> {
  const replies = page.getByTestId("turn-assistant");
  const before = await replies.count();
  await page.getByTestId("utterance-input").fill(utterance);
  await page.getByTestId("utterance-send").click();
  await expect(replies).toHaveCount(before + 1);
}

/** The plain result view behind the debug toggle (M1's output). */
export function field(page: Page, name: string) {
  return page.getByTestId("result-json").locator(`[data-field="${name}"]`);
}

/**
 * Clicks a host control near the card. The card is a sandboxed iframe, which Chrome runs in its own
 * process and routes input to by compositor hit-testing; straight after a scripted scroll that data is
 * a frame old, so an immediate click can land in the card instead. Scroll, wait two frames, then click.
 */
export async function tap(page: Page, testId: string): Promise<void> {
  const target = page.getByTestId(testId);
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await target.click();
}

/** An element inside the MCP Apps card iframe. */
export function card(page: Page, testId: string) {
  return page.frameLocator('[data-testid="widget-frame"]').getByTestId(testId);
}

export async function setToolDelay(page: Page, ms: number): Promise<void> {
  const response = await page.request.post(`${MCP_ORIGIN}/admin/test-delay`, { data: { ms } });
  expect(response.ok()).toBe(true);
}

export function rows(page: Page, method: string) {
  return page.locator(`[data-testid="traffic-row"][data-method="${method}"]`);
}

export function lastRow(page: Page) {
  return page.getByTestId("traffic-row").last();
}
