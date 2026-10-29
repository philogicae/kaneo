import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesStore } from "@/store/user-preferences";
import { PriorityGlyph } from "./priority-glyph";

afterEach(() => {
  cleanup();
  useUserPreferencesStore.getState().setPriorityIconStyle("marks");
});

describe("PriorityGlyph", () => {
  it("switches between the mark glyph and the classic icons", () => {
    const { container, rerender } = render(<PriorityGlyph priority="high" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 14 14",
    );

    act(() =>
      useUserPreferencesStore.getState().setPriorityIconStyle("classic"),
    );
    rerender(<PriorityGlyph priority="high" />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "viewBox",
      "0 0 24 24",
    );
  });
});
