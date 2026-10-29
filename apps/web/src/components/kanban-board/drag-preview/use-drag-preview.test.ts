import type { Active, Over } from "@dnd-kit/core";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { useDragPreview } from "./use-drag-preview";
import { testBoard } from "./test-board";

const active = (id: string) => ({ id }) as Active;
const over = (id: string) =>
  ({ id, data: { current: { type: "card" } } }) as Over;

describe("useDragPreview", () => {
  it("shows a cross-column card in the hovered slot and clears it", () => {
    const { result } = renderHook(() => useDragPreview(testBoard()));

    act(() => result.current.hover(active("a"), over("c"), false));

    const shown = result.current.preview as ProjectWithTasks;
    expect(
      shown.columns.map((column) => column.tasks.map((task) => task.id)),
    ).toEqual([["b"], ["a", "c", "d"], []]);

    act(() => result.current.clear());
    expect(result.current.preview).toBeNull();
  });

  it("appends when the hovered target is the column itself", () => {
    const { result } = renderHook(() => useDragPreview(testBoard()));

    act(() =>
      result.current.hover(
        active("a"),
        { id: "done", data: { current: { type: "column" } } } as Over,
        undefined,
      ),
    );

    const shown = result.current.preview as ProjectWithTasks;
    expect(shown.columns[2].tasks.map((task) => task.id)).toEqual(["a"]);
  });
});
