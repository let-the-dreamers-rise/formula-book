// A second, separate MCP server: the salon's appointment diary, with demo data. It exists so the
// assistant works across two services, as an Alexa+ host does across add-ons: read the diary here,
// then get or scale each client's formula on the Formula Book server.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export const DIARY_INFO = { name: "salon-diary", version: "0.1.0" } as const;

export type Day = "today" | "tomorrow";

export interface Appointment {
  readonly time: string;
  readonly client: string;
  readonly service: string;
}

// Demo data, labelled as such in every result. Rohan has no formula on file, on purpose.
export const DIARY: Readonly<Record<Day, readonly Appointment[]>> = {
  today: [
    { time: "14:00", client: "Lena Okafor", service: "Root touch-up" },
    { time: "15:00", client: "Priya Shah", service: "Full colour" },
    { time: "16:30", client: "Rohan", service: "First visit" },
  ],
  tomorrow: [{ time: "10:00", client: "Priya Kapoor", service: "Full colour" }],
};

export function diaryText(day: Day, list: readonly Appointment[]): string {
  if (list.length === 0) return `Nobody is booked ${day}.`;
  const items = list.map((a) => `${a.time} ${a.client}, ${a.service.toLowerCase()}`).join("; ");
  return `Booked ${day}: ${items}.`;
}

export function buildDiaryServer(): McpServer {
  const server = new McpServer(DIARY_INFO, { capabilities: { tools: {} } });
  server.registerTool(
    "list_appointments",
    {
      title: "List appointments",
      description:
        "The salon's booked appointments for today or tomorrow, from its booking diary (demo data). " +
        "Use it to find out who is coming in before preparing their colour formulas.",
      inputSchema: { day: z.enum(["today", "tomorrow"]).optional().describe("Which day; today if not given") },
      annotations: { readOnlyHint: true },
    },
    async ({ day }) => {
      const which: Day = day ?? "today";
      const list = DIARY[which];
      return {
        content: [{ type: "text", text: diaryText(which, list) }],
        structuredContent: { status: "info", day: which, appointments: list, demo: true },
      };
    },
  );
  return server;
}
