import { describe, expect, it } from "vite-plus/test";
import { statusColor } from "./status-distribution";

describe("statusColor", () => {
  it("keeps status colors stable across projects and sort order", () => {
    expect(statusColor({ name: "Done", count: 1, slug: "done" }, 0)).toBe(
      "var(--color-emerald-500)",
    );
    expect(
      statusColor({ name: "In Review", count: 1, slug: "in-review" }, 1),
    ).toBe("var(--color-amber-500)");
    expect(
      statusColor({ name: "In Progress", count: 1, slug: "in-progress" }, 2),
    ).toBe("var(--color-sky-500)");
    expect(statusColor({ name: "Backlog", count: 1, slug: "planned" }, 3)).toBe(
      "var(--color-violet-500)",
    );
  });

  it("falls back to the palette for custom columns", () => {
    expect(
      statusColor(
        { name: "Client review", count: 1, slug: "client-review" },
        0,
      ),
    ).toBe("var(--color-violet-500)");
  });
});
