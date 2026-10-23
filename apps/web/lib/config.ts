export interface SalonOption {
  readonly id: string;
  readonly name: string;
  readonly token: string;
}

export const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "http://127.0.0.1:8787/mcp";

/** The second MCP server, the salon's appointment diary. Unset: the sim connects to Formula Book only. */
export const DIARY_URL = process.env.NEXT_PUBLIC_DIARY_URL || "";

/** Hosted builds with no MCP server set NEXT_PUBLIC_MODE=replay; ?replay=1 does the same per visit. */
export const REPLAY_BY_DEFAULT = process.env.NEXT_PUBLIC_MODE?.trim() === "replay";

/** NEXT_PUBLIC_MODE=in-tab (or ?intab=1) runs the real server code in the tab: the hosted live demo. */
export const IN_TAB_BY_DEFAULT = process.env.NEXT_PUBLIC_MODE?.trim() === "in-tab";

// Public demo tokens for the two demo salons; they guard demo data only and are named in the README.
export const SALONS: readonly SalonOption[] = [
  { id: "demo-salon", name: "Demo Salon", token: "demo-salon-token" },
  { id: "booth12", name: "Booth 12 (capped)", token: "booth12-token" },
];

export const SUGGESTIONS = [
  "Lena's last formula",
  "Make it one and a half times",
  "Colour Marta: 30 grams 6N and 20 grams 7.1, 20 volume, one to one and a half",
] as const;

export function healthUrl(mcpUrl: string): string {
  return new URL("/healthz", mcpUrl).toString();
}
