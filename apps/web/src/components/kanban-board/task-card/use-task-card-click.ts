import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import type { DragListeners } from "./drag-listeners";

export function useTaskCardClick(task: Task, dragListeners: DragListeners) {
  const { project } = useProjectStore();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const toggleSelection = useBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectRange = useBulkSelectionStore((state) => state.selectRange);
  const setSelectionAnchor = useBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );

  const handleClick = useCallback(
    (
      e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    ) => {
      if (!project || !task || !workspace || !isOwnDomEvent(e)) return;

      if (e.shiftKey) {
        e.preventDefault();
        selectRange(task.id);
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        toggleSelection(task.id);
        return;
      }

      setSelectionAnchor(task.id);
      const currentParams = new URLSearchParams(window.location.search);
      const currentTaskId = currentParams.get("taskId");

      if (currentTaskId === task.id) {
        navigate({
          to: ".",
          search: {},
        });
      } else {
        navigate({
          to: ".",
          search: { taskId: task.id },
        });
      }
    },
    [
      navigate,
      project,
      selectRange,
      setSelectionAnchor,
      task,
      toggleSelection,
      workspace,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.target !== e.currentTarget) return;
      if (e.key === "Enter") {
        handleClick(e);
        e.preventDefault();
      } else {
        if (e.key === "Escape") {
          toggleSelection(task.id);
        }
        dragListeners?.onKeyDown?.(e);
      }
    },
    [dragListeners, handleClick, task.id, toggleSelection],
  );

  return { handleClick, handleKeyDown };
}
