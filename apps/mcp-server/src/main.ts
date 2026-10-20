import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { loadSeeds } from "./seed.ts";
import { FileStore } from "./store.ts";

const config = loadConfig();
const store = new FileStore(config.dataDir);
if (!store.getSalon("demo-salon")) store.reset(loadSeeds());

createApp(config, store).listen(config.port, "127.0.0.1", () => {
  console.log(`Formula Book MCP server on http://127.0.0.1:${config.port}${config.mcpPath} (data in ${config.dataDir})`);
});
