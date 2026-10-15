import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import getAppointments from "@/fetchers/appointment/get-appointments";
import getTasks from "@/fetchers/task/get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { expandRecurringTasks } from "@/lib/recurrence";
import { toScheduledTask, toScheduledTasks } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type { ConsolidatedProject } from "./consolidated-task-list";

// Lanes are capped so a busy week cannot push a row taller than its container;
// anything past the cap surfaces as a per-day overflow hint.
const MAX_LANES_DESKTOP = 3;
const MAX_LANES_MOBILE = 2;

type ItemLocation = {
  workspaceId: string;
  projectId: string;
  kind: "task" | "appointment";
};

function UnifiedCalendar({ projects }: { projects: ConsolidatedProject[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

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

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const { calendarTasks, locations } = useMemo(() => {
    const locations = new Map<string, ItemLocation>();
    const tasks: CalendarTask[] = [];
    const rangeStart = weeks[0]?.[0];
    const rangeEnd = weeks.at(-1)?.at(-1);

    projects.forEach(({ project }, index) => {
      const location = {
        workspaceId: project.workspaceId,
        projectId: project.id,
      };
      const data = taskQueries[index]?.data;
      const base = toScheduledTasks(data);
      // Completed recurring tasks do not project: completing one spawns its
      // next occurrence as a real task, which projects on its own.
      const completedIds = new Set(
        (data?.columns ?? [])
          .filter((column) => column.isFinal)
          .flatMap((column) => column.tasks.map((task) => task.id)),
      );
      const scheduled =
        rangeStart && rangeEnd
          ? expandRecurringTasks(
              base,
              rangeStart,
              rangeEnd,
              (task) => !completedIds.has(task.id),
            )
          : base;

      for (const task of scheduled) {
        const realId = "sourceTaskId" in task ? task.sourceTaskId : task.id;
        locations.set(realId, { ...location, kind: "task" });
        tasks.push({ ...task, projectSlug: project.slug });
      }

      for (const appointment of appointmentQueries[index]?.data ?? []) {
        const item = toScheduledTask({ ...appointment, status: "appointment" });
        if (!item) continue;
        locations.set(item.id, { ...location, kind: "appointment" });
        tasks.push({
          ...item,
          number: null,
          title: appointment.title,
          projectSlug: project.slug,
        });
      }
    });

    return {
      calendarTasks: tasks.sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      ),
      locations,
    };
  }, [projects, taskQueries, appointmentQueries, weeks]);

  const isLoading =
    projects.length > 0 &&
    [...taskQueries, ...appointmentQueries].some((query) => query.isLoading);
  const isError = [...taskQueries, ...appointmentQueries].some(
    (query) => query.isError,
  );

  const handlePreviousMonth = useCallback(() => {
    setVisibleMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  const handleOpenTask = useCallback(
    (taskId: string) => {
      const location = locations.get(taskId);
      if (!location) return;
      if (location.kind === "appointment") {
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/appointments",
          params: {
            workspaceId: location.workspaceId,
            projectId: location.projectId,
          },
        });
        return;
      }
      navigate({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
        params: {
          workspaceId: location.workspaceId,
          projectId: location.projectId,
        },
        search: { taskId },
      });
    },
    [locations, navigate],
  );

  return (
    <div className="flex h-[70vh] min-h-[28rem] flex-col overflow-hidden rounded-lg border border-border/60">
      <CalendarToolbar
        visibleMonth={visibleMonth}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      {isLoading ? (
        <div className="border-b border-border/80 px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">
            {t("common:empty.loading")}
          </p>
        </div>
      ) : isError ? (
        <div className="border-b border-border/80 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-destructive">
            {t("tasks:calendar.loadError")}
          </p>
        </div>
      ) : calendarTasks.length === 0 ? (
        <div className="border-b border-border/80 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t("tasks:calendar.noTasks")}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("tasks:calendar.noTasksSubtitle")}
          </p>
        </div>
      ) : null}

      <MonthGrid
        weeks={weeks}
        tasks={calendarTasks}
        visibleMonth={visibleMonth}
        maxLanes={isMobile ? MAX_LANES_MOBILE : MAX_LANES_DESKTOP}
        onOpenTask={handleOpenTask}
      />
    </div>
  );
}

export default UnifiedCalendar;
