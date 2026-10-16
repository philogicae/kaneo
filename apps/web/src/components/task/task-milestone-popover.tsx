import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useUpdateTaskMilestone from "@/hooks/mutations/task/use-update-task-milestone";
import useGetMilestones from "@/hooks/queries/milestone/use-get-milestones";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { resolveLabelColor } from "@/lib/label-color";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskMilestonePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

// Roadmap sprint/phase picker, shared by the task sidebar and the roadmap
// graph click-through. Assignments never delete or move the task itself.
export default function TaskMilestonePopover({
  task,
  children,
}: TaskMilestonePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: milestones = [] } = useGetMilestones(task.projectId);
  const { mutateAsync: updateMilestone } = useUpdateTaskMilestone(
    task.projectId,
  );
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleSelect = async (milestoneId: string | null) => {
    try {
      await updateMilestone({ taskId: task.id, milestoneId });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("roadmap:assign.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <div className="p-1">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t("roadmap:assign.title")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 h-8 px-2"
            onClick={() => handleSelect(null)}
          >
            <span className="size-2 rounded-full border border-border" />
            <span className="text-sm">{t("roadmap:assign.none")}</span>
            {!task.milestoneId && <Check className="ml-auto h-4 w-4" />}
          </Button>
          {milestones.map((milestone) => (
            <Button
              key={milestone.id}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 px-2"
              onClick={() => handleSelect(milestone.id)}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: resolveLabelColor(milestone.color) }}
              />
              <span className="max-w-36 truncate text-sm">
                {milestone.name}
              </span>
              {task.milestoneId === milestone.id && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </Button>
          ))}
          {milestones.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">
              {t("roadmap:assign.empty")}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
