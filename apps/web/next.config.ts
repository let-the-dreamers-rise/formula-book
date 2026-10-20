import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@formula-book/core"],
  poweredByHeader: false,
  agentRules: false,
};

export default config;
