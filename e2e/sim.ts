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

export function field(page: Page, name: string) {
  return page.getByTestId("result-json").locator(`[data-field="${name}"]`);
}

export function lastRow(page: Page) {
  return page.getByTestId("traffic-row").last();
}
