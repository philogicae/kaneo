import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PriorityGlyph } from "./priority-glyph";

afterEach(() => {
  cleanup();
  useUserPreferencesStore.getState().setPriorityIconStyle("classic");
});

describe("PriorityGlyph", () => {
  it("defaults to the classic colored chevrons", () => {
    const { container } = render(<PriorityGlyph priority="high" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 24 24",
    );
  });

  it("can switch to the mark glyphs", () => {
    const { container, rerender } = render(<PriorityGlyph priority="high" />);
    act(() => useUserPreferencesStore.getState().setPriorityIconStyle("marks"));
    rerender(<PriorityGlyph priority="high" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 14 14",
    );
  });
});
