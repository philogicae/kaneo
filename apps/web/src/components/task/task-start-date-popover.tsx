import { Clock, Repeat, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type { RecurrenceRule } from "@/lib/recurrence";
import {
  applyDatePreservingTime,
  combineDateAndTime,
  hasTimeComponent,
  toTimeInputValue,
} from "@/lib/task-datetime";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskStartDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

const FREQUENCIES: RecurrenceRule["frequency"][] = [
  "daily",
  "weekly",
  "monthly",
];

const UNIT_KEY_BY_FREQUENCY: Record<RecurrenceRule["frequency"], string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export function formatRecurrenceSummary(
  rule: RecurrenceRule,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return t("tasks:recurrence.summary", {
    interval: rule.interval,
    unit: t(`tasks:recurrence.${UNIT_KEY_BY_FREQUENCY[rule.frequency]}`, {
      count: rule.interval,
    }),
  });
}

export default function TaskStartDatePopover({
  task,
  children,
}: TaskStartDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Draft state: the picker edits locally and Apply commits, so the date, the
  // optional time, and the recurrence are chosen before anything is sent.
  const [draftDate, setDraftDate] = useState<Date | undefined>(
    task.startDate ? new Date(task.startDate) : undefined,
  );
  const [draftTime, setDraftTime] = useState<string>(
    task.startDate && hasTimeComponent(task.startDate)
      ? toTimeInputValue(task.startDate)
      : "",
  );
  const [draftRecurrence, setDraftRecurrence] = useState<RecurrenceRule | null>(
    task.recurrence ?? null,
  );
  const [saving, setSaving] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  useEffect(() => {
    if (open) {
      setDraftDate(task.startDate ? new Date(task.startDate) : undefined);
      setDraftTime(
        task.startDate && hasTimeComponent(task.startDate)
          ? toTimeInputValue(task.startDate)
          : "",
      );
      setDraftRecurrence(task.recurrence ?? null);
    }
  }, [open, task.startDate, task.recurrence]);

  const save = async (
    startDate: string | null,
    recurrence: RecurrenceRule | null = draftRecurrence,
  ) => {
    setSaving(true);
    try {
      await updateTask({
        ...task,
        startDate,
        recurrence,
      });
      toast.success(t("tasks:popover.startDate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.startDate.updateError"),
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
    await save(iso, draftRecurrence);
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
            task.dueDate ? { after: new Date(task.dueDate) } : undefined
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
            aria-label={t("tasks:popover.startDate.timeLabel")}
          />
        </div>

        <div className="space-y-1.5 border-t border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Repeat className="size-4 shrink-0 text-muted-foreground" />
            <Select
              value={draftRecurrence?.frequency ?? "none"}
              onValueChange={(value) => {
                if (value === "none") {
                  setDraftRecurrence(null);
                  return;
                }
                setDraftRecurrence({
                  frequency: value as RecurrenceRule["frequency"],
                  interval: draftRecurrence?.interval ?? 1,
                });
              }}
            >
              <SelectTrigger
                className="h-8 w-full"
                aria-label={t("tasks:recurrence.title")}
              >
                <SelectValue>
                  {draftRecurrence
                    ? t(`tasks:recurrence.${draftRecurrence.frequency}`)
                    : t("tasks:recurrence.none")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("tasks:recurrence.none")}
                </SelectItem>
                {FREQUENCIES.map((frequency) => (
                  <SelectItem key={frequency} value={frequency}>
                    {t(`tasks:recurrence.${frequency}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {draftRecurrence && (
            <div className="flex items-center gap-2 pl-6">
              <label
                className="text-xs text-muted-foreground"
                htmlFor="start-date-recurrence-interval"
              >
                {t("tasks:recurrence.every")}
              </label>
              <Input
                id="start-date-recurrence-interval"
                type="number"
                min={1}
                max={365}
                value={draftRecurrence.interval}
                onChange={(event) => {
                  const interval = Number(event.target.value);
                  if (Number.isFinite(interval) && interval >= 1) {
                    setDraftRecurrence({ ...draftRecurrence, interval });
                  }
                }}
                className="h-8 w-16"
              />
              <span className="text-xs text-muted-foreground">
                {t(
                  `tasks:recurrence.${UNIT_KEY_BY_FREQUENCY[draftRecurrence.frequency]}`,
                  { count: draftRecurrence.interval },
                )}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          {task.startDate ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              disabled={saving}
              // Clearing the date also clears the recurrence: repeating needs
              // a date to repeat from.
              onClick={() => save(null, null)}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.startDate.clear")}
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
              {t("tasks:popover.startDate.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-8"
              disabled={!draftDate || saving}
              onClick={handleApply}
            >
              {t("tasks:popover.startDate.apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
