import {
  ChevronLeft,
  ChevronRight,
  Milestone as MilestoneIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import RoadmapGraph, {
  type RoadmapFilter,
} from "@/components/roadmap/roadmap-graph";
import RoadmapMobileList from "@/components/roadmap/roadmap-mobile-list";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import labelColors from "@/constants/label-colors";
import useCreateMilestone from "@/hooks/mutations/milestone/use-create-milestone";
import useDeleteMilestone from "@/hooks/mutations/milestone/use-delete-milestone";
import useReorderMilestones from "@/hooks/mutations/milestone/use-reorder-milestones";
import useUpdateMilestone from "@/hooks/mutations/milestone/use-update-milestone";
import useGetMilestones from "@/hooks/queries/milestone/use-get-milestones";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectRelations from "@/hooks/queries/task-relation/use-get-project-relations";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { resolveLabelColor } from "@/lib/label-color";
import { buildRoadmapGraph, type RoadmapTask } from "@/lib/roadmap-layout";
import { toast } from "@/lib/toast";
import type Milestone from "@/types/milestone";

const FILTERS: RoadmapFilter[] = ["all", "active", "blocked"];

type RoadmapViewProps = {
  projectId: string;
  workspaceId: string;
};

function MilestoneColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {labelColors.map((color) => (
        <button
          key={color.value}
          type="button"
          aria-label={color.value}
          className={cn(
            "size-5 rounded-full border transition-transform hover:scale-110",
            value === color.value
              ? "border-foreground ring-2 ring-ring/40"
              : "border-transparent",
          )}
          style={{ backgroundColor: color.color }}
          onClick={() => onChange(color.value)}
        />
      ))}
    </div>
  );
}

function MilestoneChipMenu({
  milestone,
  canMoveLeft,
  canMoveRight,
  onMove,
  onSave,
  onDelete,
}: {
  milestone: Milestone;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (direction: -1 | 1) => void;
  onSave: (patch: { name: string; color: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(milestone.name);
  const [color, setColor] = useState(milestone.color);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
            />
          }
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: resolveLabelColor(milestone.color) }}
          />
          {milestone.name}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-3 p-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 text-sm"
            aria-label={t("roadmap:nameLabel")}
          />
          <MilestoneColorPicker value={color} onChange={setColor} />
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!canMoveLeft}
                aria-label={t("roadmap:moveLeft")}
                onClick={() => onMove(-1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={!canMoveRight}
                aria-label={t("roadmap:moveRight")}
                onClick={() => onMove(1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                aria-label={t("roadmap:delete")}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-7"
                disabled={saving || name.trim().length === 0}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave({ name: name.trim(), color });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {t("common:actions.save")}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("roadmap:deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("roadmap:deleteDescription", { name: milestone.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" size="sm" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <AlertDialogClose
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void onDelete()}
                />
              }
            >
              {t("common:actions.delete")}
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateMilestonePopover({
  onCreate,
}: {
  onCreate: (input: { name: string; color: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("sky");
  const [saving, setSaving] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button size="sm" className="h-7 gap-1.5" />}>
        <Plus className="h-3.5 w-3.5" />
        {t("roadmap:newSprint")}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3 p-3">
        <Input
          value={name}
          placeholder={t("roadmap:namePlaceholder")}
          aria-label={t("roadmap:nameLabel")}
          onChange={(event) => setName(event.target.value)}
          className="h-8 text-sm"
        />
        <MilestoneColorPicker value={color} onChange={setColor} />
        <Button
          size="sm"
          className="h-7 w-full"
          disabled={saving || name.trim().length === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await onCreate({ name: name.trim(), color });
              setName("");
              setColor("sky");
              setOpen(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          {t("roadmap:create")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export default function RoadmapView({
  projectId,
  workspaceId,
}: RoadmapViewProps) {
  const { t } = useTranslation();
  const { data: board } = useGetTasks(projectId);
  const { data: milestones = [] } = useGetMilestones(projectId);
  const { data: relations = [] } = useGetProjectRelations(projectId);
  const { mutateAsync: createMilestone } = useCreateMilestone(projectId);
  const { mutateAsync: updateMilestone } = useUpdateMilestone(projectId);
  const { mutateAsync: deleteMilestone } = useDeleteMilestone(projectId);
  const { mutateAsync: reorderMilestones } = useReorderMilestones(projectId);
  const { canUpdateProjects } = useWorkspacePermission();
  // Sprint management (create/rename/reorder/delete) is project:update; the
  // API enforces it, and hiding the controls keeps the 403 out of the UI.
  const canManageSprints = canUpdateProjects();
  const [filter, setFilter] = useState<RoadmapFilter>("all");
  const [openTaskId, setOpenTaskId] = useState<string | undefined>(undefined);

  const tasks = useMemo<RoadmapTask[]>(() => {
    if (!board) return [];
    const rows = [
      ...board.columns.flatMap((column) => column.tasks),
      ...(board.plannedTasks ?? []),
      ...(board.archivedTasks ?? []),
    ];
    return rows.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority ?? null,
      milestoneId: task.milestoneId ?? null,
      position: task.position ?? 0,
      number: task.number ?? null,
      assigneeName: task.assigneeName ?? null,
      labelNames: (task.labels ?? []).map((label) => label.name),
    }));
  }, [board]);

  const finalStatuses = useMemo(
    () =>
      new Set(
        (board?.columns ?? [])
          .filter((column) => column.isFinal)
          .map((column) => column.slug),
      ),
    [board],
  );

  const graph = useMemo(
    () =>
      buildRoadmapGraph({
        tasks,
        milestones,
        relations,
        finalStatuses,
      }),
    [tasks, milestones, relations, finalStatuses],
  );

  const orderedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.position - b.position),
    [milestones],
  );

  const handleMove = async (milestone: Milestone, direction: -1 | 1) => {
    const index = orderedMilestones.findIndex((row) => row.id === milestone.id);
    const targetIndex = index + direction;
    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= orderedMilestones.length
    ) {
      return;
    }
    const next = [...orderedMilestones];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    // Renumber the whole list so a swap can never leave two equal positions.
    const renumbered = next.map((row, position) => ({
      id: row.id,
      position,
    }));
    try {
      await reorderMilestones(renumbered);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("roadmap:reorderError"),
      );
    }
  };

  if (!board) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("common:empty.loading")}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5">
            {FILTERS.map((option) => (
              <Button
                key={option}
                variant={filter === option ? "secondary" : "ghost"}
                size="xs"
                className={cn(
                  "h-6 rounded-md px-2 text-xs",
                  filter !== option && "text-muted-foreground",
                )}
                onClick={() => setFilter(option)}
              >
                {t(`roadmap:filter.${option}`)}
              </Button>
            ))}
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            {(["done", "active", "blocked", "todo"] as const).map((state) => (
              <span
                key={state}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    state === "done" && "bg-success",
                    state === "active" && "bg-primary",
                    state === "blocked" && "bg-warning",
                    state === "todo" && "bg-muted-foreground",
                  )}
                />
                {t(`roadmap:state.${state}`)}
              </span>
            ))}
          </div>
        </div>
        {canManageSprints && (
          <CreateMilestonePopover
            onCreate={async ({ name, color }) => {
              try {
                await createMilestone({ projectId, name, color });
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : t("roadmap:createError"),
                );
              }
            }}
          />
        )}
      </div>

      {orderedMilestones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <MilestoneIcon className="h-3 w-3" />
            {t("roadmap:sprints", { count: orderedMilestones.length })}
          </Badge>
          {orderedMilestones.map((milestone, index) =>
            canManageSprints ? (
              <MilestoneChipMenu
                key={milestone.id}
                milestone={milestone}
                canMoveLeft={index > 0}
                canMoveRight={index < orderedMilestones.length - 1}
                onMove={(direction) => void handleMove(milestone, direction)}
                onSave={async (patch) => {
                  try {
                    await updateMilestone({ id: milestone.id, ...patch });
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t("roadmap:updateError"),
                    );
                  }
                }}
                onDelete={async () => {
                  try {
                    await deleteMilestone(milestone.id);
                    toast.success(t("roadmap:deleteSuccess"));
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : t("roadmap:deleteError"),
                    );
                  }
                }}
              />
            ) : (
              // Without project:update the sprints stay visible as a legend,
              // just not editable.
              <span
                key={milestone.id}
                className="flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs font-medium"
              >
                <span
                  className="size-2 rounded-full"
                  style={{
                    backgroundColor: resolveLabelColor(milestone.color),
                  }}
                />
                {milestone.name}
              </span>
            ),
          )}
        </div>
      )}

      {tasks.length === 0 && orderedMilestones.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border">
          <div className="max-w-sm text-center">
            <MilestoneIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("roadmap:emptyTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("roadmap:emptyDescription")}
            </p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <div className="hidden h-full md:block">
            <RoadmapGraph
              graph={graph}
              filter={filter}
              onOpenTask={(taskId) => setOpenTaskId(taskId)}
            />
          </div>
          <div className="h-full md:hidden">
            <RoadmapMobileList
              graph={graph}
              filter={filter}
              onOpenTask={(taskId) => setOpenTaskId(taskId)}
            />
          </div>
        </div>
      )}

      <TaskDetailsSheet
        taskId={openTaskId}
        projectId={projectId}
        workspaceId={workspaceId}
        onClose={() => setOpenTaskId(undefined)}
      />
    </div>
  );
}
