import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatReminderOffsetLabel } from "@/components/task/task-reminders-popover";
import useCreateAppointment from "@/hooks/mutations/appointment/use-create-appointment";
import useDeleteAppointment from "@/hooks/mutations/appointment/use-delete-appointment";
import useUpdateAppointment from "@/hooks/mutations/appointment/use-update-appointment";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getPriorityLabel } from "@/lib/i18n/domain";
import type { RecurrenceFrequency } from "@/lib/recurrence";
import { toast } from "@/lib/toast";
import type Appointment from "@/types/appointment";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

// Preset reminder offsets (minutes before the start), matching the task
// reminder vocabulary. Arbitrary offsets remain available through the API/MCP.
const REMINDER_PRESETS = [15, 60, 2 * 60, 24 * 60, 7 * 24 * 60] as const;

const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = [
  "daily",
  "weekly",
  "monthly",
];

function isPriority(value: string | null | undefined): value is Priority {
  return (
    Boolean(value) && (PRIORITIES as readonly string[]).includes(value ?? "")
  );
}
const UNASSIGNED = "__unassigned";

function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type AppointmentDialogProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
  appointment?: Appointment | null;
  defaultStart?: Date | null;
};

export default function AppointmentDialog({
  open,
  onClose,
  projectId,
  workspaceId,
  appointment,
  defaultStart,
}: AppointmentDialogProps) {
  const { t } = useTranslation();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { mutateAsync: createAppointment, isPending: isCreating } =
    useCreateAppointment();
  const { mutateAsync: updateAppointment, isPending: isUpdating } =
    useUpdateAppointment(projectId);
  const { mutateAsync: deleteAppointment, isPending: isDeleting } =
    useDeleteAppointment(projectId);
  const { canCreateTasks, canUpdateTasks, canDeleteTasks } =
    useWorkspacePermission();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState(UNASSIGNED);
  const [reminderOffsets, setReminderOffsets] = useState<number[]>([]);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    RecurrenceFrequency | "none"
  >("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);

  const isEditing = Boolean(appointment);
  const isSaving = isCreating || isUpdating || isDeleting;

  useEffect(() => {
    if (!open) return;

    if (appointment) {
      const start = appointment.startDate
        ? new Date(appointment.startDate)
        : new Date();
      const end = appointment.dueDate
        ? new Date(appointment.dueDate)
        : new Date(start.getTime() + 60 * 60 * 1000);
      setTitle(appointment.title);
      setDescription(appointment.description ?? "");
      setStartValue(toLocalInputValue(start));
      setEndValue(toLocalInputValue(end));
      setPriority(
        isPriority(appointment.priority) ? appointment.priority : "medium",
      );
      setAssignee(appointment.userId ?? UNASSIGNED);
      setReminderOffsets(appointment.reminderOffsets ?? []);
      setRecurrenceFrequency(appointment.recurrence?.frequency ?? "none");
      setRecurrenceInterval(appointment.recurrence?.interval ?? 1);
      return;
    }

    const start = defaultStart ?? new Date();
    if (!defaultStart) {
      start.setMinutes(0, 0, 0);
    }
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setTitle("");
    setDescription("");
    setStartValue(toLocalInputValue(start));
    setEndValue(toLocalInputValue(end));
    setPriority("medium");
    setAssignee(UNASSIGNED);
    setReminderOffsets([]);
    setRecurrenceFrequency("none");
    setRecurrenceInterval(1);
  }, [open, appointment, defaultStart]);

  const start = fromLocalInputValue(startValue);
  const end = fromLocalInputValue(endValue);
  const rangeInvalid = Boolean(start && end && start > end);
  const canSave = isEditing ? canUpdateTasks() : canCreateTasks();
  const canSubmit = title.trim().length > 0 && !rangeInvalid && canSave;

  const handleSubmit = async () => {
    if (!canSubmit || !start || !end) return;

    const payload = {
      title: title.trim(),
      description,
      startDate: start.toISOString(),
      dueDate: end.toISOString(),
      priority,
      userId: assignee === UNASSIGNED ? undefined : assignee,
      reminderOffsets:
        reminderOffsets.length > 0
          ? [...reminderOffsets].sort((a, b) => a - b)
          : null,
      recurrence:
        recurrenceFrequency === "none"
          ? null
          : {
              frequency: recurrenceFrequency,
              interval: Math.max(1, Math.floor(recurrenceInterval) || 1),
            },
    };

    try {
      if (appointment) {
        await updateAppointment({ id: appointment.id, ...payload });
      } else {
        await createAppointment({ projectId, ...payload });
      }
      toast.success(
        t(
          isEditing
            ? "appointments:toast.updated"
            : "appointments:toast.created",
        ),
      );
      onClose();
    } catch {
      toast.error(t("appointments:toast.error"));
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    try {
      await deleteAppointment(appointment.id);
      toast.success(t("appointments:toast.deleted"));
      onClose();
    } catch {
      toast.error(t("appointments:toast.error"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>
            {t(
              isEditing
                ? "appointments:dialog.editTitle"
                : "appointments:dialog.createTitle",
            )}
          </DialogTitle>
          <DialogDescription>
            {t("appointments:dialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="appointment-title">
              {t("appointments:dialog.titleLabel")}
            </Label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("appointments:dialog.titlePlaceholder")}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="appointment-description">
              {t("appointments:dialog.descriptionLabel")}
            </Label>
            <Textarea
              id="appointment-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appointment-start">
                {t("appointments:dialog.startLabel")}
              </Label>
              <Input
                id="appointment-start"
                type="datetime-local"
                value={startValue}
                onChange={(event) => setStartValue(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-end">
                {t("appointments:dialog.endLabel")}
              </Label>
              <Input
                id="appointment-end"
                type="datetime-local"
                value={endValue}
                onChange={(event) => setEndValue(event.target.value)}
              />
            </div>
          </div>
          {rangeInvalid && (
            <p className="text-xs text-destructive">
              {t("appointments:dialog.rangeError")}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("appointments:dialog.priorityLabel")}</Label>
              <Select
                items={PRIORITIES.map((value) => ({
                  value,
                  label: getPriorityLabel(value),
                }))}
                value={priority}
                onValueChange={(value) =>
                  isPriority(value) && setPriority(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {getPriorityLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("appointments:dialog.assigneeLabel")}</Label>
              <Select
                items={[
                  {
                    value: UNASSIGNED,
                    label: t("appointments:dialog.unassigned"),
                  },
                  ...(workspaceUsers?.members ?? []).map((member) => ({
                    value: member.userId,
                    label: member.user?.name ?? member.userId,
                  })),
                ]}
                value={assignee}
                onValueChange={(value) => value && setAssignee(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>
                    {t("appointments:dialog.unassigned")}
                  </SelectItem>
                  {(workspaceUsers?.members ?? []).map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.user?.name ?? member.userId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("tasks:recurrence.title")}</Label>
              <div className="flex items-center gap-2">
                <Select
                  items={[
                    {
                      value: "none",
                      label: t("tasks:recurrence.none"),
                    },
                    ...RECURRENCE_FREQUENCIES.map((frequency) => ({
                      value: frequency,
                      label: t(`tasks:recurrence.${frequency}`),
                    })),
                  ]}
                  value={recurrenceFrequency}
                  onValueChange={(value) =>
                    value &&
                    setRecurrenceFrequency(
                      value as RecurrenceFrequency | "none",
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      {t("tasks:recurrence.none")}
                    </SelectItem>
                    {RECURRENCE_FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {t(`tasks:recurrence.${frequency}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recurrenceFrequency !== "none" && (
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={recurrenceInterval}
                    onChange={(event) =>
                      setRecurrenceInterval(Number(event.target.value))
                    }
                    className="w-18"
                    aria-label={t("tasks:recurrence.title")}
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("tasks:reminders.title")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {REMINDER_PRESETS.map((offset) => {
                  const active = reminderOffsets.includes(offset);
                  return (
                    <Button
                      key={offset}
                      type="button"
                      // Selected chips switch to the primary fill: readable in
                      // light, dark and volt, where the subtle secondary tint
                      // was nearly invisible.
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      aria-pressed={active}
                      onClick={() =>
                        setReminderOffsets(
                          active
                            ? reminderOffsets.filter((item) => item !== offset)
                            : [...reminderOffsets, offset],
                        )
                      }
                    >
                      {formatReminderOffsetLabel(offset, t)}
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("tasks:reminders.hint")}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:gap-2">
          {isEditing && canDeleteTasks() && (
            <Button
              type="button"
              variant="destructive"
              className="mr-auto"
              disabled={isSaving}
              onClick={handleDelete}
            >
              {t("appointments:dialog.delete")}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || isSaving}
            onClick={handleSubmit}
          >
            {t(
              isEditing
                ? "appointments:dialog.save"
                : "appointments:dialog.create",
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
