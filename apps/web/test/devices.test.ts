import { describe, expect, it } from "vitest";
import { cardUri, DEVICES, deviceById, invokingText } from "../lib/devices.ts";

describe("device frames", () => {
  it("offers the screen, phone and speaker frames in that order", () => {
    expect(DEVICES.map((d) => d.testId)).toEqual(["device-echo-show-8", "device-mobile", "device-speaker"]);
  });

  it("describes the screen frame with our guessed Echo Show 8 values", () => {
    const screen = deviceById("echo-show-8");
    expect(screen.showsCard).toBe(true);
    expect(screen.hostContext).toMatchObject({ deviceClass: "echo-show-8", maxWidth: 1280, maxHeight: 800, isMobile: false });
  });

  it("describes the phone frame at 375 px wide", () => {
    const phone = deviceById("mobile");
    expect(phone.showsCard).toBe(true);
    expect(phone.frameWidth).toBe(375);
    expect(phone.hostContext).toMatchObject({ deviceClass: "mobile", maxWidth: 375, isMobile: true, platform: "mobile" });
  });

  it("gives the speaker no card", () => {
    expect(deviceById("voice").showsCard).toBe(false);
  });
});

describe("reading a tool result for the card", () => {
  it("returns the ui:// resource a formula result links to", () => {
    expect(cardUri({ _meta: { ui: { resourceUri: "ui://formula-card/abc.html" } } })).toBe("ui://formula-card/abc.html");
  });

  it("ignores a missing link or one that is not ui://", () => {
    expect(cardUri({})).toBeUndefined();
    expect(cardUri(undefined)).toBeUndefined();
    expect(cardUri({ _meta: { ui: { resourceUri: "https://example.invalid/card.html" } } })).toBeUndefined();
  });

  it("uses the tool's own loading text, with a plain fallback", () => {
    const meta = { get_last_formula: { ui: { invoking: "Looking up the formula" } } };
    expect(invokingText(meta, "get_last_formula")).toBe("Looking up the formula");
    expect(invokingText(meta, "scale_formula")).toBe("Working on it");
    expect(invokingText(undefined, "get_last_formula")).toBe("Working on it");
  });
});
