import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type { LabelGroup } from "@/lib/group-tasks";
import { resolveLabelColor } from "@/lib/label-color";
import TaskCard from "./task-card";

// Read-only counterpart of the status columns: while the board is grouped by
// labels, each group renders its task cards without drag & drop (groups mix
// tasks from several status columns, so a drop would have no clear meaning).
function GroupColumn({
  group,
  projectId,
}: {
  group: LabelGroup;
  projectId: string;
}) {
  const { t } = useTranslation();
  const { canCreateTasks } = useWorkspacePermission();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col rounded-xl border border-border/70 bg-muted/40 shadow-xs/5 hover:border-border/90 dark:bg-card/90 transition-colors duration-150">
      <div className="shrink-0 border-b border-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {group.color ? (
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: resolveLabelColor(group.color) }}
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full border border-dashed border-border"
              />
            )}
            <span className="truncate text-sm font-medium text-foreground/95">
              {group.id === "label:none"
                ? t("tasks:boardGroup.noLabel")
                : group.name}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.tasks.length}
            </span>
            {canCreateTasks() && (
              <button
                type="button"
                aria-label={t("tasks:kanban.addTask")}
                title={t("tasks:kanban.addTask")}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                onClick={() => setIsTaskModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-2">
          {group.tasks.map((task) => (
            <TaskCard key={task.id} task={task} dragDisabled />
          ))}
        </div>
      </div>
      <CreateTaskModal
        open={isTaskModalOpen}
        projectId={projectId}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </div>
  );
}

export default GroupColumn;
