import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateTaskPositions } from "@/hooks/mutations/task/use-update-task-positions";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { boardCollisionDetection } from "./board-collision-detection";
import { useDragPreview } from "./drag-preview/use-drag-preview";
import { moveBoardTask } from "./move-task";
import { applyTaskDrop, getTaskPositionUpdates } from "@/lib/apply-task-drop";
import { buildLabelGroups } from "@/lib/group-tasks";
import { EASE_OUT_CSS } from "@/lib/motion";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import Column from "./column";
import GroupColumn from "./group-column";
import TaskCard from "./task-card";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  sortActive?: boolean;
  // Display-only label grouping: replaces the status columns with one column
  // per label and disables drag & drop.
  groupActive?: boolean;
  // Caller-driven override, e.g. while a drop is being handled elsewhere or a
  // fetch is in flight. Sorts and label grouping use their own guards.
  disableDragDrop?: boolean;
};

function KanbanBoard({
  project,
  sortActive = false,
  groupActive = false,
  disableDragDrop = false,
}: KanbanBoardProps) {
  const { t } = useTranslation();
  const { setProject } = useProjectStore();
  const setAvailableTasks = useBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const focusNext = useBulkSelectionStore((state) => state.focusNext);
  const focusPrevious = useBulkSelectionStore((state) => state.focusPrevious);
  const focusedTaskId = useBulkSelectionStore((state) => state.focusedTaskId);
  const clearFocus = useBulkSelectionStore((state) => state.clearFocus);
  const [activeIsFinal, setActiveIsFinal] = useState<boolean | undefined>();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const dragPreview = useDragPreview(project);
  const { mutate: updateTaskPositions } = useUpdateTaskPositions();
  const navigate = useNavigate();

  const groups = useMemo(
    () =>
      groupActive && project.columns ? buildLabelGroups(project.columns) : null,
    [groupActive, project.columns],
  );

  useEffect(() => {
    if (project?.columns) {
      // Keep keyboard selection in sync with what is on screen: grouped
      // columns reorder tasks by label, so the focus list follows the groups.
      const allTaskIds = groups
        ? groups.flatMap((group) => group.tasks.map((task) => task.id))
        : project.columns.flatMap((column) =>
            column.tasks.map((task) => task.id),
          );
      setAvailableTasks(allTaskIds);
    }
  }, [project, groups, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      Enter: () => {
        if (focusedTaskId && project) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              taskId: focusedTaskId,
            },
          });
        }
      },
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.8",
        },
      },
    }),
    duration: 250,
    easing: EASE_OUT_CSS,
  };

  const reduceMotion = useReducedMotion();

  const insertAfterTarget = (event: DragOverEvent | DragEndEvent) => {
    const { active, over } = event;
    if (!over || over.data.current?.type === "column") return undefined;
    const activeRect = active.rect.current.translated;
    const overRect = over.rect;
    if (!activeRect || !overRect) return undefined;
    return (
      activeRect.top + activeRect.height / 2 >
      overRect.top + overRect.height / 2
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    dragPreview.clear();
    setActiveId(event.active.id);
    const isFinal = event.active.data?.current?.isFinalColumn;
    setActiveIsFinal(typeof isFinal === "boolean" ? isFinal : undefined);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (disableDragDrop || sortActive || !over) {
      dragPreview.clear();
      return;
    }
    dragPreview.hover(active, over, insertAfterTarget(event));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const activeTaskId = active.id.toString();
    const overId = over?.id.toString();
    setActiveId(null);
    dragPreview.clear();

    if (
      disableDragDrop ||
      !overId ||
      overId === activeTaskId ||
      !project?.columns
    )
      return;

    // Recompute against the drop event itself: pointer moves can outrun the
    // last onDragOver frame, and the saved board must be the one on screen.
    const preview = sortActive
      ? null
      : moveBoardTask(
          project,
          activeTaskId,
          overId,
          false,
          insertAfterTarget(event),
        )?.project;

    const { project: updatedProject, updates } = preview
      ? {
          project: preview,
          updates: getTaskPositionUpdates(project, preview),
        }
      : applyTaskDrop({
          project,
          activeTaskId,
          overId,
          sortActive,
        });

    if (updates.length > 0) {
      setProject(updatedProject);
      updateTaskPositions({ projectId: project.id, tasks: updates });
    }
  };

  if (!project?.columns) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/25 to-background">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="flex h-full flex-1 gap-4 overflow-x-auto px-4 pb-4 md:px-5">
            {[...Array(4)].map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key -- a fixed skeleton list has no stable identity
                key={`kanban-column-skeleton-${i}`}
                className="h-full min-w-72 w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key -- a fixed skeleton list has no stable identity
                      key={`kanban-task-skeleton-${j}`}
                      className="p-4 bg-card rounded-lg border border-border/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-muted/70 rounded" />
                        <div className="w-1/2 h-3 bg-muted/70 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeTask = activeId
    ? project.columns
        .flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;
  const shownProject = dragPreview.preview ?? project;

  if (groupActive) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/20 to-background">
        <div className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {(groups ?? []).map((group) => (
              <div
                key={group.id}
                className="h-full max-w-96 min-w-72 shrink-0 flex-1"
              >
                <GroupColumn group={group} projectId={project.id} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        screenReaderInstructions: {
          draggable: t("tasks:board.keyboardInstructions"),
        },
      }}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        dragPreview.clear();
      }}
    >
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/20 to-background">
        <div className="min-h-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <div className="flex h-full min-w-max gap-4 px-4 py-4 md:px-5">
            {shownProject.columns?.map((column) => (
              <div
                key={column.id}
                className="h-full max-w-96 min-w-72 shrink-0 flex-1"
              >
                <Column column={column} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={reduceMotion ? null : dropAnimation}>
        {activeTask ? (
          <div className="rotate-1 scale-[1.03] shadow-lg transition-[rotate,scale] duration-150 ease-out starting:rotate-0 starting:scale-100 motion-reduce:transition-none">
            <div className="ring-2 ring-ring/35 rounded-lg">
              <TaskCard task={activeTask} isFinalColumn={activeIsFinal} />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
