import { describe, expect, it } from "vite-plus/test";
import { getPriorityHoverClass } from "./priority";

describe("getPriorityHoverClass", () => {
  it.each([
    ["urgent", "hover:border-destructive"],
    ["high", "hover:border-warning"],
    ["medium", "hover:border-warning/80"],
    ["low", "hover:border-info"],
  ])("keeps the %s priority hue on hover", (priority, expected) => {
    const className = getPriorityHoverClass(priority);

    expect(className).toContain(expected);
    expect(className).toContain("hover:ring-2");
    expect(className).toContain("hover:shadow-");
    expect(className).not.toContain("ring-ring");
  });

  it("falls back to a neutral border when no priority is set", () => {
    const className = getPriorityHoverClass("no-priority");

    expect(className).toContain("hover:border-foreground/25");
    expect(className).not.toContain("ring-ring");
  });
});
