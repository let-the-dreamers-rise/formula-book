import type { McpUiHostContext } from "@modelcontextprotocol/ext-apps/app-bridge";

export type DeviceId = "echo-show-8" | "mobile" | "voice";

/** The fields the Alexa+ layout guide lists, beside the MCP Apps ones. The values are our guess. */
export type HostContext = McpUiHostContext & {
  readonly deviceClass: string;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly isMobile: boolean;
};

export interface Device {
  readonly id: DeviceId;
  readonly label: string;
  readonly testId: string;
  readonly showsCard: boolean;
  /** Width the sim draws the frame's screen at, in CSS px. */
  readonly frameWidth?: number;
  readonly hostContext: HostContext;
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

export const DEVICES: readonly Device[] = [
  {
    id: "echo-show-8",
    label: "Screen",
    testId: "device-echo-show-8",
    showsCard: true,
    hostContext: {
      deviceClass: "echo-show-8",
      maxWidth: 1280,
      maxHeight: 800,
      isMobile: false,
      platform: "web",
      displayMode: "inline",
      theme: "light",
      containerDimensions: { maxWidth: 1280, maxHeight: 800 },
      deviceCapabilities: { touch: true, hover: false },
      safeAreaInsets: NO_INSETS,
    },
  },
  {
    id: "mobile",
    label: "Mobile",
    testId: "device-mobile",
    showsCard: true,
    frameWidth: 375,
    hostContext: {
      deviceClass: "mobile",
      maxWidth: 375,
      maxHeight: 812,
      isMobile: true,
      platform: "mobile",
      displayMode: "inline",
      theme: "light",
      containerDimensions: { maxWidth: 375, maxHeight: 812 },
      deviceCapabilities: { touch: true, hover: false },
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
    },
  },
  {
    id: "voice",
    label: "Speaker",
    testId: "device-speaker",
    showsCard: false,
    hostContext: { deviceClass: "voice", isMobile: false, platform: "web", theme: "light" },
  },
];

export function deviceById(id: DeviceId): Device {
  return DEVICES.find((d) => d.id === id) ?? (DEVICES[0] as Device);
}

/** The MCP Apps resource a tool result links to, if it is a ui:// one. */
export function cardUri(result: unknown): string | undefined {
  const uri = (result as { _meta?: { ui?: { resourceUri?: unknown } } } | undefined)?._meta?.ui?.resourceUri;
  return typeof uri === "string" && uri.startsWith("ui://") ? uri : undefined;
}

export type ToolMeta = Readonly<Record<string, { readonly ui?: { readonly invoking?: string } } | undefined>>;

export function invokingText(meta: ToolMeta | undefined, tool: string): string {
  return meta?.[tool]?.ui?.invoking ?? "Working on it";
}
