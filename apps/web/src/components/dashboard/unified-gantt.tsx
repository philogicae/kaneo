import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  startOfWeek,
  subDays,
} from "date-fns";
import { Calendar, Search } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import getAppointments from "@/fetchers/appointment/get-appointments";
import getTasks from "@/fetchers/task/get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { toScheduledTask, toScheduledTasks } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ConsolidatedProject } from "./consolidated-task-list";

type UnifiedGanttItem = {
  id: string;
  kind: "task" | "appointment";
  title: string;
  status: string;
  number: number | null;
  workspaceId: string;
  projectId: string;
  projectName: string;
  projectSlug: string;
  scheduleStart: Date;
  scheduleEnd: Date;
};

// Read-only timeline across every project: the project Gantt owns drag/resize
// mutations, so this view only places the same scheduled items side by side and
// opens their project view on click.
function UnifiedGantt({ projects }: { projects: ConsolidatedProject[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const dayColumnWidthRem = isMobile ? 3.125 : 2.75;
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);
  const hasCenteredOnTodayRef = useRef(false);

  const taskQueries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: ["tasks", project.id],
      queryFn: () => getTasks(project.id),
      enabled: !!project.id,
    })),
  });

  const appointmentQueries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: ["appointments", project.id],
      queryFn: () => getAppointments(project.id),
      enabled: !!project.id,
    })),
  });

  const items = useMemo(() => {
    const acc: UnifiedGanttItem[] = [];

    projects.forEach(({ project, workspaceId }, index) => {
      const base = {
        workspaceId,
        projectId: project.id,
        projectName: project.name,
        projectSlug: project.slug,
      };

      for (const task of toScheduledTasks(taskQueries[index]?.data)) {
        acc.push({
          ...base,
          id: task.id,
          kind: "task",
          title: task.title,
          status: task.status,
          number: task.number ?? null,
          scheduleStart: task.scheduleStart,
          scheduleEnd: task.scheduleEnd,
        });
      }

      for (const appointment of appointmentQueries[index]?.data ?? []) {
        const item = toScheduledTask({ ...appointment, status: "appointment" });
        if (!item) continue;
        acc.push({
          ...base,
          id: item.id,
          kind: "appointment",
          title: appointment.title,
          status: "appointment",
          number: null,
          scheduleStart: item.scheduleStart,
          scheduleEnd: item.scheduleEnd,
        });
      }
    });

    return acc.sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
  }, [projects, taskQueries, appointmentQueries]);

  const isLoading =
    projects.length > 0 &&
    [...taskQueries, ...appointmentQueries].some((query) => query.isLoading);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(query) ||
        item.projectName.toLowerCase().includes(query) ||
        `${item.projectSlug}-${item.number ?? ""}`.toLowerCase().includes(query)
      );
    });
  }, [items, searchQuery]);

  const timeline = useMemo(() => {
    if (filteredItems.length === 0) return null;

    const earliest = filteredItems.reduce(
      (current, item) =>
        item.scheduleStart < current ? item.scheduleStart : current,
      filteredItems[0].scheduleStart,
    );
    const latest = filteredItems.reduce(
      (current, item) =>
        item.scheduleEnd > current ? item.scheduleEnd : current,
      filteredItems[0].scheduleEnd,
    );

    const weekStart = startOfWeek(earliest, { weekStartsOn });
    const weekEnd = endOfWeek(latest, { weekStartsOn });
    const rangeStart = subDays(weekStart, 7);
    const rangeEnd = addDays(weekEnd, 28);
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return {
      days,
      rangeStart,
      gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
      timelineMinWidthRem: days.length * dayColumnWidthRem,
    };
  }, [filteredItems, dayColumnWidthRem, weekStartsOn]);

  const todayInRange = useMemo(
    () => timeline?.days.some((day) => isToday(day)) ?? false,
    [timeline],
  );

  const scrollToToday = useCallback((behavior: ScrollBehavior = "smooth") => {
    todayCellRef.current?.scrollIntoView({
      behavior,
      inline: "center",
      block: "nearest",
    });
  }, []);

  // Center the view on today the first time it becomes available.
  useLayoutEffect(() => {
    if (
      hasCenteredOnTodayRef.current ||
      !todayInRange ||
      filteredItems.length === 0 ||
      !todayCellRef.current
    )
      return;
    hasCenteredOnTodayRef.current = true;
    scrollToToday("auto");
  }, [todayInRange, filteredItems.length, scrollToToday]);

  const openItem = useCallback(
    (item: UnifiedGanttItem) => {
      if (item.kind === "appointment") {
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/appointments",
          params: {
            workspaceId: item.workspaceId,
            projectId: item.projectId,
          },
        });
        return;
      }
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
        params: {
          workspaceId: item.workspaceId,
          projectId: item.projectId,
        },
        search: { taskId: item.id },
      });
    },
    [navigate],
  );

  const barGeometry = useCallback(
    (item: UnifiedGanttItem) => {
      if (!timeline) return null;
      const startIndex = differenceInCalendarDays(
        item.scheduleStart,
        timeline.rangeStart,
      );
      const endIndex = differenceInCalendarDays(
        item.scheduleEnd,
        timeline.rangeStart,
      );
      const trackCount = timeline.days.length;
      if (endIndex < 0 || startIndex >= trackCount || trackCount === 0) {
        return null;
      }
      const clampedStart = Math.max(0, startIndex);
      const clampedEnd = Math.min(trackCount - 1, endIndex);
      return {
        leftRem: clampedStart * dayColumnWidthRem,
        widthRem: (clampedEnd - clampedStart + 1) * dayColumnWidthRem,
      };
    },
    [timeline, dayColumnWidthRem],
  );

  return (
    <div className="flex h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-lg border border-border/60">
      <div className="border-b border-border/80 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-sm font-semibold text-foreground">
            {t("tasks:gantt.title")}
          </h1>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("tasks:gantt.searchPlaceholder")}
              className="h-9 min-h-11 touch-manipulation sm:h-8 sm:min-h-0 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            onClick={() => scrollToToday()}
            disabled={!todayInRange || filteredItems.length === 0}
          >
            <Calendar className="size-3.5" />
            {t("tasks:gantt.jumpToToday")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("common:empty.loading")}
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-semibold text-foreground">
              {t("tasks:gantt.noTasks")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("tasks:gantt.noTasksSubtitle")}
            </p>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <h2 className="text-sm font-semibold text-foreground">
              {t("tasks:gantt.noTasksFound")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("tasks:gantt.noTasksMatch", { query: searchQuery })}
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          data-testid="unified-gantt-scroll-container"
          className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
        >
          <div className="relative min-w-max touch-pan-x touch-pan-y">
            <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
              <div className="sticky left-0 z-30 w-48 shrink-0 border-r border-border bg-background px-3 py-2.5 sm:w-80 sm:px-4 sm:py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("tasks:gantt.taskHeader")}
                </p>
              </div>
              <div
                className="grid shrink-0"
                style={{
                  gridTemplateColumns: timeline?.gridTemplateColumns,
                  minWidth: `${timeline?.timelineMinWidthRem}rem`,
                }}
              >
                {timeline?.days.map((day, index) => {
                  const showMonth =
                    index === 0 ||
                    !isSameMonth(day, timeline.days[index - 1] ?? day);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      ref={isCurrentDay ? todayCellRef : undefined}
                      className={cn(
                        "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                        isWeekend(day) && "bg-muted/25",
                      )}
                    >
                      <div className="h-4 text-[10px] font-medium text-muted-foreground">
                        {showMonth ? format(day, "MMM") : ""}
                      </div>
                      <div
                        className={cn(
                          "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                          isCurrentDay && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <div
                className="absolute inset-y-0 left-0 z-0 grid"
                style={{
                  left: isMobile ? "12rem" : "20rem",
                  gridTemplateColumns: timeline?.gridTemplateColumns,
                  width: `${timeline?.timelineMinWidthRem}rem`,
                }}
              >
                {timeline?.days.map((day) => (
                  <div
                    key={`bg-line-${day.toISOString()}`}
                    className={cn(
                      "h-full min-h-0 border-r border-border/60",
                      isWeekend(day) && "bg-muted/25",
                    )}
                  />
                ))}
              </div>

              <div className="relative z-10 flex flex-col">
                {filteredItems.map((item) => {
                  const geometry = barGeometry(item);
                  return (
                    <div
                      key={item.id}
                      className="grid items-stretch border-b border-border/70"
                      style={{
                        gridTemplateColumns: isMobile
                          ? "12rem max-content"
                          : "20rem max-content",
                      }}
                    >
                      <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
                        <button
                          type="button"
                          className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2 py-2 text-left transition-colors hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5"
                          onClick={() => openItem(item)}
                        >
                          <div className="flex w-full items-center gap-1.5">
                            <span className="max-w-[7rem] truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground sm:max-w-none">
                              {getStatusLabel(item.status)}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {item.projectSlug}-{item.number ?? "—"}
                            </span>
                          </div>
                          <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                            {item.title}
                          </p>
                          <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                            {format(item.scheduleStart, "MMM d")} -{" "}
                            {format(item.scheduleEnd, "MMM d")}
                            {` • ${item.projectName}`}
                          </p>
                        </button>
                      </div>

                      <div
                        className="relative min-h-11 shrink-0 select-none"
                        style={{
                          minWidth: `${timeline?.timelineMinWidthRem}rem`,
                        }}
                      >
                        {geometry ? (
                          <button
                            type="button"
                            onClick={() => openItem(item)}
                            title={`${item.title} · ${format(
                              item.scheduleStart,
                              "MMM d",
                            )} – ${format(item.scheduleEnd, "MMM d")}`}
                            className={cn(
                              "absolute top-1/2 flex h-7 max-w-full -translate-y-1/2 items-center overflow-hidden rounded-md border px-2 text-left text-xs font-medium text-foreground transition-colors",
                              item.kind === "appointment"
                                ? "border-info/40 bg-info/15 hover:bg-info/25"
                                : "border-primary/25 bg-primary/12 hover:bg-primary/18",
                            )}
                            style={{
                              left: `calc(${geometry.leftRem}rem + 0.25rem)`,
                              width: `calc(${geometry.widthRem}rem - 0.5rem)`,
                            }}
                          >
                            <span className="truncate">{item.title}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UnifiedGantt;
