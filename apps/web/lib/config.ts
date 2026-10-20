export interface SalonOption {
  readonly id: string;
  readonly name: string;
  readonly token: string;
}

export const MCP_URL = process.env.NEXT_PUBLIC_MCP_URL || "http://127.0.0.1:8787/mcp";

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
