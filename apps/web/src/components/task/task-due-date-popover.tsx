import { Clock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import {
  applyDatePreservingTime,
  combineDateAndTime,
  hasTimeComponent,
  toTimeInputValue,
} from "@/lib/task-datetime";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskDueDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskDueDatePopover({
  task,
  children,
}: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Draft state: the picker edits locally and Apply commits, so a date and an
  // optional time can be chosen before anything is sent.
  const [draftDate, setDraftDate] = useState<Date | undefined>(
    task.dueDate ? new Date(task.dueDate) : undefined,
  );
  const [draftTime, setDraftTime] = useState<string>(
    task.dueDate && hasTimeComponent(task.dueDate)
      ? toTimeInputValue(task.dueDate)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  useEffect(() => {
    if (open) {
      setDraftDate(task.dueDate ? new Date(task.dueDate) : undefined);
      setDraftTime(
        task.dueDate && hasTimeComponent(task.dueDate)
          ? toTimeInputValue(task.dueDate)
          : "",
      );
    }
  }, [open, task.dueDate]);

  const save = async (dueDate: string | null) => {
    setSaving(true);
    try {
      await updateTaskDueDate({
        ...task,
        dueDate,
      });
      toast.success(t("tasks:popover.dueDate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.dueDate.updateError"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    if (!draftDate) return;
    const iso = draftTime
      ? combineDateAndTime(draftDate, draftTime)
      : draftDate.toISOString();
    if (!iso) return;
    await save(iso);
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={draftDate}
          onSelect={(date) =>
            setDraftDate(date && applyDatePreservingTime(draftDate, date))
          }
          disabled={
            task.startDate ? { before: new Date(task.startDate) } : undefined
          }
          className="w-full bg-popover"
        />
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            value={draftTime}
            disabled={!draftDate}
            onChange={(event) => setDraftTime(event.target.value)}
            className="h-8 w-28"
            aria-label={t("tasks:popover.dueDate.timeLabel")}
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          {task.dueDate ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              disabled={saving}
              onClick={() => save(null)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.dueDate.clear")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              {t("tasks:popover.dueDate.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={!draftDate || saving}
              onClick={handleApply}
            >
              {t("tasks:popover.dueDate.apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
