"use client";

import { useEffect, useRef, useState } from "react";
import { AppBridge, PostMessageTransport, type McpUiToolResultNotification } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { HostContext } from "@/lib/devices";

const HOST_INFO = { name: "formula-book-sim", version: "0.1.0" } as const;
const MIN_HEIGHT = 260;

type ToolResult = McpUiToolResultNotification["params"];

interface Props {
  readonly html: string;
  readonly toolResult: unknown;
  readonly hostContext: HostContext;
}

/**
 * The MCP Apps host side: a sandboxed iframe (scripts only, no same-origin, no network by the card's
 * CSP) joined to an AppBridge over postMessage. The card asks ui/initialize and gets hostContext;
 * each new result goes over as ui/notifications/tool-result, each device change as host-context-changed.
 */
export function CardFrame({ html, toolResult, hostContext }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const bridge = useRef<AppBridge | undefined>(undefined);
  const ready = useRef(false);
  const latest = useRef({ toolResult, hostContext });
  latest.current = { toolResult, hostContext };
  const [height, setHeight] = useState(MIN_HEIGHT);

  useEffect(() => {
    const iframe = frame.current;
    const view = iframe?.contentWindow;
    if (!iframe || !view) return;
    let open = true;
    const host = new AppBridge(null, HOST_INFO, {}, { hostContext: latest.current.hostContext });
    host.oninitialized = () => {
      ready.current = true;
      void host.sendToolResult(latest.current.toolResult as ToolResult);
    };
    host.onsizechange = ({ height: next }) => {
      if (typeof next === "number" && next > 0) setHeight(Math.max(MIN_HEIGHT, Math.ceil(next)));
    };
    bridge.current = host;
    // Listen first, then load the card, so its ui/initialize request is never missed.
    void host.connect(new PostMessageTransport(view, view)).then(() => {
      if (open) iframe.srcdoc = html;
    });
    return () => {
      open = false;
      ready.current = false;
      bridge.current = undefined;
      void host.close();
    };
  }, [html]);

  useEffect(() => {
    if (ready.current) void bridge.current?.sendToolResult(toolResult as ToolResult);
  }, [toolResult]);

  useEffect(() => {
    bridge.current?.setHostContext(hostContext);
  }, [hostContext]);

  return (
    <iframe
      ref={frame}
      data-testid="widget-frame"
      title="Formula card"
      sandbox="allow-scripts"
      className="block w-full border-0 bg-transparent"
      style={{ height }}
    />
  );
}
