// Starts the real Formula Book and diary server code inside this tab, once, with the demo seed data.
// Loaded only in in-tab mode, so other builds do not ship the server code.
import type { InTabServers } from "@formula-book/mcp-server/in-tab";

let servers: Promise<InTabServers> | undefined;

export function inTabServers(): Promise<InTabServers> {
  servers ??= Promise.all([
    import("@formula-book/mcp-server/in-tab"),
    import("../../../seed/demo-salon.json"),
    import("../../../seed/booth12.json"),
  ]).then(([m, demo, booth]) => new m.InTabServers([demo.default, booth.default] as never));
  return servers;
}
