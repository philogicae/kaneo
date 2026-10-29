import type { Active, Over } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import { moveBoardTask } from "../move-task";
import type { DragHover } from "./drag-hover";

export function useDragPreview(project: ProjectWithTasks) {
  const [hover, setHover] = useState<DragHover | null>(null);

  const preview = useMemo(
    () =>
      hover
        ? (moveBoardTask(
            project,
            hover.activeId,
            hover.overId,
            false,
            hover.insertAfterTarget,
          )?.project ?? null)
        : null,
    [project, hover],
  );

  return {
    preview,
    hover: (active: Active, over: Over, insertAfterTarget?: boolean) => {
      const next = {
        activeId: active.id.toString(),
        overId: over.id.toString(),
        insertAfterTarget,
      };
      setHover((current) =>
        current?.activeId === next.activeId &&
        current.overId === next.overId &&
        current.insertAfterTarget === next.insertAfterTarget
          ? current
          : next,
      );
    },
    clear: () => setHover(null),
  };
}
