import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthAgenda from "@/components/calendar/month-agenda";
import MonthGrid from "@/components/calendar/month-grid";
import AppointmentDialog from "@/components/appointments/appointment-dialog";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { DisplaySection } from "@/components/project/display/display-section";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import useGetAppointments from "@/hooks/queries/appointment/use-get-appointments";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { expandRecurringTasks } from "@/lib/recurrence";
import { toScheduledTask, toScheduledTasks } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Appointment from "@/types/appointment";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";

type CalendarSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// Lanes are capped so a busy week cannot push a row taller than the viewport;
// anything past the cap surfaces as a per-day overflow hint. Phones use the
// agenda list instead of the grid.
const MAX_LANES_DESKTOP = 3;

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useGetTasks(projectId);
  const { data: appointments } = useGetAppointments(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "schedule",
  });
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);

  const allScheduledTasks = useMemo(() => toScheduledTasks(project), [project]);

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const scheduledTasks = useMemo(() => {
    const base = toScheduledTasks(view.filters.filteredProject);
    const rangeStart = weeks[0]?.[0];
    const rangeEnd = weeks.at(-1)?.at(-1);
    if (!rangeStart || !rangeEnd) return base;
    // Completed recurring tasks do not project: completing one spawns its
    // next occurrence as a real task, which projects on its own.
    const completedIds = new Set(
      (project?.columns ?? [])
        .filter((column) => column.isFinal)
        .flatMap((column) => column.tasks.map((task) => task.id)),
    );
    return expandRecurringTasks(
      base,
      rangeStart,
      rangeEnd,
      (task) => !completedIds.has(task.id),
    );
  }, [project, weeks, view.filters.filteredProject]);

  const calendarTasks = useMemo<CalendarTask[]>(() => {
    const appointmentItems = (appointments ?? [])
      .map((appointment) =>
        toScheduledTask({ ...appointment, status: "appointment" }),
      )
      .filter((item): item is NonNullable<typeof item> => item !== null);
    return [...scheduledTasks, ...appointmentItems].sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
  }, [scheduledTasks, appointments]);

  const appointmentById = useMemo(
    () => new Map((appointments ?? []).map((item) => [item.id, item])),
    [appointments],
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
    (nextTaskId: string) => {
      const appointment = appointmentById.get(nextTaskId);
      if (appointment) {
        setSelectedAppointment(appointment);
        return;
      }
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate, appointmentById],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="calendar"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="calendar"
                  currentView="calendar"
                />
              </DisplaySection>
              <DisplaySection>
                <WeekStartControl />
              </DisplaySection>
            </>
          }
        />
      }
      summary={
        <TaskCount
          shown={scheduledTasks.length}
          total={allScheduledTasks.length}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={view.filters.clearFilters}
        />
      }
    >
      <PageTitle
        title={t("tasks:calendar.pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
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
        ) : allScheduledTasks.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t("tasks:calendar.noTasks")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("tasks:calendar.noTasksSubtitle")}
            </p>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t("tasks:filterBar.noMatches")}
            </p>
          </div>
        ) : null}

        {isMobile ? (
          calendarTasks.length > 0 && (
            <MonthAgenda
              tasks={calendarTasks}
              visibleMonth={visibleMonth}
              projectSlug={project?.slug}
              onOpenTask={handleOpenTask}
            />
          )
        ) : (
          <MonthGrid
            weeks={weeks}
            tasks={calendarTasks}
            visibleMonth={visibleMonth}
            maxLanes={MAX_LANES_DESKTOP}
            projectSlug={project?.slug}
            onOpenTask={handleOpenTask}
          />
        )}

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />

        <AppointmentDialog
          open={selectedAppointment !== null}
          onClose={() => setSelectedAppointment(null)}
          projectId={projectId}
          workspaceId={workspaceId}
          appointment={selectedAppointment}
        />
      </div>
    </ProjectLayout>
  );
}
