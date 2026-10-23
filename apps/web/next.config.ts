import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@formula-book/core", "@formula-book/mcp-server"],
  // Tests and the recorder import the MCP server; `npm run typecheck` covers them with tsconfig.json.
  typescript: { tsconfigPath: "tsconfig.build.json" },
  poweredByHeader: false,
  // The product site is static HTML in public/site; the root sends visitors there. /sim is the demo.
  redirects: async () => [{ source: "/", destination: "/site/index.html", permanent: false }],
  agentRules: false,
};

export default config;
