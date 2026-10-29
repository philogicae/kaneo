import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { produce } from "immer";
import { Archive, ChevronRight, Flag, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useUpdateTaskPositions } from "@/hooks/mutations/task/use-update-task-positions";
import { useCollapsedSections } from "@/hooks/use-collapsed-sections";
import { useStoredState } from "@/hooks/use-stored-state";
import useGetProjectRelations from "@/hooks/queries/task-relation/use-get-project-relations";
import { buildSubtaskChildren, flattenSubtaskRows } from "@/lib/subtask-tree";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { applyTaskDrop } from "@/lib/apply-task-drop";
import { cn } from "@/lib/cn";
import { getColumnIcon } from "@/lib/column";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import { ArchiveTasksModal } from "../shared/modals/archive-tasks-modal";
import CreateTaskModal from "../shared/modals/create-task-modal";
import TaskRow from "./task-row";

function parseExpandedRows(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, true] => {
      return entry[1] === true;
    }),
  );
}

type ListViewProps = {
  project: ProjectWithTasks;
  sortActive?: boolean;
  // Caller-driven overrides, e.g. while a drop is handled elsewhere or a bulk
  // action is in flight. Sorting uses its own guard.
  disableDragDrop?: boolean;
  disableCollectionActions?: boolean;
};

function ListView({
  project,
  sortActive = false,
  disableDragDrop = false,
  disableCollectionActions = false,
}: ListViewProps) {
  const { t } = useTranslation();
  const { setProject } = useProjectStore();
  const setAvailableTasks = useBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const focusNext = useBulkSelectionStore((state) => state.focusNext);
  const focusPrevious = useBulkSelectionStore((state) => state.focusPrevious);
  const focusedTaskId = useBulkSelectionStore((state) => state.focusedTaskId);
  const clearFocus = useBulkSelectionStore((state) => state.clearFocus);
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: updateTaskPositions } = useUpdateTaskPositions();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const { isExpanded, toggleSection } = useCollapsedSections(
    project.id,
    "list",
  );
  const { data: relations = [], isLoading: relationsLoading } =
    useGetProjectRelations(project.id);
  const subtaskChildren = useMemo(
    () => buildSubtaskChildren(relations),
    [relations],
  );
  const tasksById = useMemo(() => {
    const index = new Map<
      string,
      ProjectWithTasks["columns"][number]["tasks"][number]
    >();
    for (const column of project.columns ?? []) {
      for (const task of column.tasks) index.set(task.id, task);
    }
    return index;
  }, [project.columns]);
  const [expandedTasks, setExpandedTasks] = useStoredState(
    `kaneo:list-view:expanded-subtasks:${project.id}`,
    parseExpandedRows,
    {},
  );
  const toggleTaskExpanded = useCallback(
    (rowId: string) => {
      setExpandedTasks((previous) => {
        const rows = { ...previous };
        if (rows[rowId]) delete rows[rowId];
        else rows[rowId] = true;
        return rows;
      });
    },
    [setExpandedTasks],
  );
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [columnToArchive, setColumnToArchive] = useState<
    ProjectWithTasks["columns"][number] | null
  >(null);

  // Nothing stays expanded while a drag is in flight, so every sortable row
  // keeps its single top-level identity.
  const rowsByColumn = useMemo(
    () =>
      new Map(
        (project.columns ?? []).map((column) => [
          column.id,
          flattenSubtaskRows({
            tasks: column.tasks,
            children: subtaskChildren,
            tasksById,
            isExpanded: (rowId) => !activeId && Boolean(expandedTasks[rowId]),
          }),
        ]),
      ),
    [project.columns, subtaskChildren, tasksById, expandedTasks, activeId],
  );
  const shownTaskIds = useCallback(
    (column: ProjectWithTasks["columns"][number]) => [
      ...new Set((rowsByColumn.get(column.id) ?? []).map((row) => row.task.id)),
    ],
    [rowsByColumn],
  );

  useEffect(() => {
    if (project?.columns) {
      const visibleTaskIds = project.columns
        .filter((column) => isExpanded(column.slug))
        .flatMap(shownTaskIds);
      setAvailableTasks([...new Set(visibleTaskIds)]);
    }
  }, [project, isExpanded, setAvailableTasks, shownTaskIds]);

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
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !activeId) {
      setOverColumnId(null);
      return;
    }

    if (project?.columns?.some((col) => col.id === over.id)) {
      setOverColumnId(over.id.toString());
      return;
    }

    const taskId = over.id.toString();
    const columnWithTask = project?.columns?.find((col) =>
      col.tasks.some((task) => task.id === taskId),
    );

    if (columnWithTask) {
      setOverColumnId(columnWithTask.id);
    } else {
      setOverColumnId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (disableDragDrop || !over || !project?.columns) return;

    const { project: updatedProject, updates } = applyTaskDrop({
      project,
      activeTaskId: active.id.toString(),
      overId: over.id.toString(),
      sortActive,
    });

    if (updates.length > 0) {
      setProject(updatedProject);
      updateTaskPositions({ projectId: project.id, tasks: updates });
    }
  };

  const handleArchiveClick = (column: ProjectWithTasks["columns"][number]) => {
    if (
      disableCollectionActions ||
      !column.isFinal ||
      column.tasks.length === 0
    )
      return;
    setColumnToArchive(column);
  };

  const handleConfirmArchive = () => {
    if (disableCollectionActions || !columnToArchive) return;

    // Read the column from the current project: the list can be re-rendered
    // (pagination, a dropped card) between the click and Confirm, and the
    // captured column object would miss the tasks added since.
    const column =
      project?.columns?.find((col) => col.id === columnToArchive.id) ??
      columnToArchive;
    for (const task of column.tasks) {
      updateTask({
        ...task,
        status: "archived",
      });
    }

    const updatedProject = produce(project, (draft) => {
      const archivedColumn = draft?.columns?.find(
        (col) => col.id === columnToArchive.id,
      );
      if (!archivedColumn) return;

      archivedColumn.tasks = [];
    });

    setProject(updatedProject);
    toast.success(
      t("tasks:archive.success", { count: columnToArchive.tasks.length }),
    );

    setColumnToArchive(null);
  };

  function ColumnSection({
    column,
  }: {
    column: ProjectWithTasks["columns"][number];
  }) {
    const { setNodeRef } = useDroppable({
      id: column.id,
      data: {
        type: "column",
        column,
      },
    });

    const showDropIndicator = activeId && overColumnId === column.id;
    const rows = rowsByColumn.get(column.id) ?? [];
    const groupHasSubtasks =
      relationsLoading ||
      rows.some((row) => row.childCount > 0 || row.depth > 0);

    return (
      <div
        className={cn(
          "border-b border-border/50 transition-colors duration-150 overflow-auto",
          showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
        )}
      >
        <div className="flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50">
          <button
            type="button"
            onClick={() => toggleSection(column.slug)}
            aria-expanded={isExpanded(column.slug)}
            className="touch-hitbox relative flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform",
                isExpanded(column.slug) && "rotate-90",
              )}
            />
            <div className="flex items-center gap-2 h-4">
              {getColumnIcon(column.id, column.isFinal, column.icon)}
              <div className="flex items-center gap-1">
                <span className="mt-1 mr-1">{column.name}</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {column.tasks.length}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 pointer-coarse:gap-6">
            <button
              type="button"
              onClick={() => {
                setIsTaskModalOpen(true);
                setActiveColumn(column.id);
              }}
              className="touch-hitbox relative p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
              title={t("tasks:listView.addTask")}
              aria-label={t("tasks:listView.addTask")}
            >
              <Plus className="w-3 h-3" />
            </button>

            {column.isFinal && column.tasks.length > 0 && (
              <button
                type="button"
                disabled={disableCollectionActions}
                onClick={() => handleArchiveClick(column)}
                className="touch-hitbox relative p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title={t("tasks:listView.archiveAllTooltip")}
                aria-label={t("tasks:listView.archiveAllTooltip")}
              >
                <Archive className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {isExpanded(column.slug) && (
          <div
            ref={setNodeRef}
            className="bg-card transition-[translate,opacity] duration-150 ease-out starting:-translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
          >
            <SortableContext
              items={column.tasks}
              strategy={verticalListSortingStrategy}
            >
              <AnimatePresence initial={false} mode="popLayout">
                {rows.map((row) => (
                  <motion.div
                    key={row.rowId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                  >
                    <TaskRow
                      task={row.task}
                      projectSlug={project?.slug ?? ""}
                      depth={row.depth}
                      rowId={row.rowId}
                      childCount={row.childCount}
                      isExpanded={row.isExpanded}
                      onToggleExpanded={toggleTaskExpanded}
                      reserveToggleSpace={groupHasSubtasks}
                      isTaskDragging={activeId === row.task.id}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </SortableContext>

            {column.tasks.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-muted-foreground">
                {t("tasks:listView.noTasks")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!project?.columns) {
    return null;
  }

  const activeTask = activeId
    ? project.columns
        ?.flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={disableDragDrop ? [] : sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        <div className="divide-y divide-border/50">
          {project.columns.map((column) => (
            <ColumnSection key={column.id} column={column} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-card border border-border rounded-lg shadow-lg p-2 max-w-[200px] cursor-grabbing">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Flag
                  className={cn(
                    "w-3 h-3",
                    priorityColorsTaskCard[
                      activeTask.priority as keyof typeof priorityColorsTaskCard
                    ],
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[0.625rem] font-mono text-muted-foreground">
                    {project?.slug}-{activeTask.number}
                  </span>
                  <span className="text-xs text-foreground truncate">
                    {activeTask.title}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      <CreateTaskModal
        open={isTaskModalOpen}
        projectId={project.id}
        onClose={() => setIsTaskModalOpen(false)}
        status={activeColumn ?? "done"}
      />
      <ArchiveTasksModal
        open={columnToArchive !== null}
        onClose={() => setColumnToArchive(null)}
        disabled={disableCollectionActions}
        onConfirm={handleConfirmArchive}
        taskCount={
          project?.columns?.find((col) => col.id === columnToArchive?.id)?.tasks
            .length ?? 0
        }
      />

      <BulkToolbar />
    </DndContext>
  );
}

export default ListView;
