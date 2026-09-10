import { Bell, BellPlus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskRemindersPopoverProps = {
  task: Task;
  children?: React.ReactNode;
};

const MINUTES_IN = {
  minute: 1,
  hour: 60,
  day: 24 * 60,
  week: 7 * 24 * 60,
} as const;

type ReminderUnit = keyof typeof MINUTES_IN;

const UNITS: ReminderUnit[] = ["minute", "hour", "day", "week"];

const UNIT_KEY_BY_UNIT: Record<ReminderUnit, string> = {
  minute: "tasks:reminders.unitMinute",
  hour: "tasks:reminders.unitHour",
  day: "tasks:reminders.unitDay",
  week: "tasks:reminders.unitWeek",
};

export function formatReminderOffsetLabel(
  minutes: number,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (minutes >= MINUTES_IN.week && minutes % MINUTES_IN.week === 0) {
    return t("tasks:reminders.weeksBefore", {
      count: minutes / MINUTES_IN.week,
    });
  }
  if (minutes >= MINUTES_IN.day && minutes % MINUTES_IN.day === 0) {
    return t("tasks:reminders.daysBefore", { count: minutes / MINUTES_IN.day });
  }
  if (minutes >= MINUTES_IN.hour && minutes % MINUTES_IN.hour === 0) {
    return t("tasks:reminders.hoursBefore", {
      count: minutes / MINUTES_IN.hour,
    });
  }
  return t("tasks:reminders.minutesBefore", { count: minutes });
}

export default function TaskRemindersPopover({
  task,
  children,
}: TaskRemindersPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Draft row for the "add" line; "1 hour before" by default. The amount is
  // kept as text so partial typing ("", "-", "1.") never fights the field;
  // it is parsed only when adding.
  const [draftAmount, setDraftAmount] = useState("1");
  const [draftUnit, setDraftUnit] = useState<ReminderUnit>("hour");
  const draftMinutes = Number(draftAmount);
  const draftCount =
    Number.isFinite(draftMinutes) && draftMinutes >= 1
      ? Math.floor(draftMinutes)
      : 1;
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  useEffect(() => {
    if (open) {
      setDraftAmount("1");
      setDraftUnit("hour");
    }
  }, [open]);

  const offsets = [...new Set(task.reminderOffsets ?? [])].sort(
    (a, b) => a - b,
  );

  const save = async (next: number[]) => {
    try {
      await updateTaskDueDate({
        ...task,
        reminderOffsets: next.length > 0 ? next : null,
      });
      toast.success(t("tasks:reminders.updateSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:reminders.updateError"),
      );
    }
  };

  const addDraft = async () => {
    const minutes = draftMinutes * MINUTES_IN[draftUnit];
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    if (offsets.includes(minutes)) return;
    await save([...offsets, minutes]);
    // The row goes back to its default after adding, ready for the next one.
    setDraftAmount("1");
    setDraftUnit("hour");
  };

  const removeOffset = async (minutes: number) => {
    await save(offsets.filter((offset) => offset !== minutes));
  };

  if (!canEdit) return <>{children ?? null}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children ?? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 gap-1.5"
            disabled={!task.startDate}
            title={t("tasks:reminders.title")}
          >
            {offsets.length > 0 ? (
              <>
                <Bell className="w-3.5 h-3.5 text-foreground" />
                <span className="text-xs font-semibold">{offsets.length}</span>
              </>
            ) : (
              <BellPlus className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2.5 p-3" align="start">
        {!task.startDate ? (
          <p className="text-xs text-muted-foreground">
            {t("tasks:reminders.needsStartDate")}
          </p>
        ) : (
          <>
            <p className="text-xs font-medium">{t("tasks:reminders.title")}</p>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 p-0"
                disabled={!Number.isFinite(draftMinutes) || draftMinutes < 1}
                onClick={addDraft}
                aria-label={t("tasks:reminders.add")}
              >
                <Plus className="size-3.5" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
                // The compact coss size keeps the inner input inside the
                // bordered span; a smaller height plus extra padding left the
                // value hidden under the native spinner.
                size="sm"
                className="w-14 text-xs"
                aria-label={t("tasks:reminders.amountLabel")}
              />
              <Select
                value={draftUnit}
                onValueChange={(value) => setDraftUnit(value as ReminderUnit)}
              >
                <SelectTrigger
                  className="h-7 w-31 shrink-0 px-2 text-xs"
                  aria-label={t("tasks:reminders.unitLabel")}
                >
                  <SelectValue>
                    {`${t(UNIT_KEY_BY_UNIT[draftUnit], {
                      count: draftCount,
                    })} ${t("tasks:reminders.before")}`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit} className="text-xs">
                      {`${t(UNIT_KEY_BY_UNIT[unit], {
                        count: draftCount,
                      })} ${t("tasks:reminders.before")}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {offsets.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("tasks:reminders.empty")}
              </p>
            ) : (
              <div className="space-y-1">
                {offsets.map((offset) => (
                  <div
                    key={offset}
                    className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => removeOffset(offset)}
                      aria-label={t("tasks:reminders.remove")}
                    >
                      <X className="size-3" />
                    </Button>
                    <span className="text-xs">
                      {formatReminderOffsetLabel(offset, t)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t("tasks:reminders.hint")}
            </p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
