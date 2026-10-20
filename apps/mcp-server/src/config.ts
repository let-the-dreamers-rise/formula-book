export interface TokenGrant {
  readonly salonId: string;
  readonly expiresAt?: number;
}

export interface Config {
  readonly port: number;
  /** "/mcp" by convention. Some security software rewrites local responses on paths containing "mcp". */
  readonly mcpPath: string;
  readonly dataDir: string;
  readonly tokens: ReadonlyMap<string, TokenGrant>;
  readonly cap: number;
  readonly demoAdmin: boolean;
  readonly allowedOrigins: readonly string[];
  readonly e2e: boolean;
  readonly toolDelayMs: number;
}

// Public demo tokens for the two demo salons. They guard demo data only and are named in the README.
const DEMO_TOKENS = "demo-salon-token=demo-salon,booth12-token=booth12";
const DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000";

/** "token=salon" or "token=salon@2026-12-31T00:00:00Z", comma separated. */
export function parseTokens(value: string): ReadonlyMap<string, TokenGrant> {
  const entries = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): [string, TokenGrant] => {
      const [token = "", grant = ""] = part.split("=");
      const [salonId = "", expiry] = grant.split("@");
      if (!token || !salonId) throw new Error(`SALON_TOKENS entry "${part}" must look like token=salon`);
      return [token, expiry ? { salonId, expiresAt: Date.parse(expiry) } : { salonId }];
    });
  return new Map(entries);
}

function positiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a whole number, got "${value}"`);
  return parsed;
}

function endpointPath(value: string | undefined): string {
  const path = value || "/mcp";
  if (!/^\/[A-Za-z0-9/_-]*$/.test(path)) {
    throw new Error(`MCP_PATH must be a URL path such as /mcp, got "${path}" (Git Bash rewrites /paths; set MSYS_NO_PATHCONV=1)`);
  }
  return path;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return {
    port: positiveInt(env.MCP_PORT, 8787, "MCP_PORT"),
    mcpPath: endpointPath(env.MCP_PATH),
    dataDir: env.DATA_DIR || ".data",
    tokens: parseTokens(env.SALON_TOKENS || DEMO_TOKENS),
    cap: positiveInt(env.FREE_FORMULA_CAP, 50, "FREE_FORMULA_CAP"),
    demoAdmin: env.DEMO_ADMIN === "1",
    allowedOrigins: (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(",").map((o) => o.trim()),
    e2e: env.E2E === "1",
    toolDelayMs: positiveInt(env.TEST_TOOL_DELAY_MS, 0, "TEST_TOOL_DELAY_MS"),
  };
}
