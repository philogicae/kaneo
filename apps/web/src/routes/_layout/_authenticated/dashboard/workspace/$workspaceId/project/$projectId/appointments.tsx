import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AppointmentDialog from "@/components/appointments/appointment-dialog";
import WeekCalendar from "@/components/appointments/week-calendar";
import { addDays, startOfWeek } from "@/components/appointments/week-model";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import useGetAppointments from "@/hooks/queries/appointment/use-get-appointments";
import useGetProject from "@/hooks/queries/project/use-get-project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Appointment from "@/types/appointment";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/appointments",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const {
    data: appointments,
    isLoading,
    isError,
  } = useGetAppointments(projectId);

  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), weekStartsOn),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);

  // Keep the visible week aligned with the preference if it changes.
  useEffect(() => {
    setWeekStart((current) => startOfWeek(current, weekStartsOn));
  }, [weekStartsOn]);

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const startLabel = weekStart.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    const endLabel = end.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${startLabel} – ${endLabel}`;
  }, [weekStart]);

  const handlePreviousWeek = useCallback(() => {
    setWeekStart((current) => addDays(current, -7));
  }, []);

  const handleNextWeek = useCallback(() => {
    setWeekStart((current) => addDays(current, 7));
  }, []);

  const handleToday = useCallback(() => {
    setWeekStart(startOfWeek(new Date(), weekStartsOn));
  }, [weekStartsOn]);

  // Appointments converted from undated backlog items have nothing to place
  // on the grid; they stay reachable here until they are scheduled.
  const unscheduled = useMemo(
    () =>
      (appointments ?? []).filter((item) => !item.startDate && !item.dueDate),
    [appointments],
  );

  const handleCreate = useCallback(() => {
    setSelectedAppointment(null);
    setDefaultStart(null);
    setDialogOpen(true);
  }, []);

  const handleCreateAt = useCallback((start: Date) => {
    setSelectedAppointment(null);
    setDefaultStart(start);
    setDialogOpen(true);
  }, []);

  const handleSelectAppointment = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDefaultStart(null);
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="appointments"
    >
      <PageTitle
        title={t("appointments:pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handlePreviousWeek}
              aria-label={t("appointments:previousWeek")}
              title={t("appointments:previousWeek")}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleToday}
            >
              {t("appointments:today")}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNextWeek}
              aria-label={t("appointments:nextWeek")}
              title={t("appointments:nextWeek")}
            >
              <ChevronRight className="size-4" />
            </Button>
            <span className="ml-2 text-sm font-medium tabular-nums">
              {weekLabel}
            </span>
          </div>

          <Button
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={handleCreate}
          >
            <Plus className="size-3.5" />
            {t("appointments:newAppointment")}
          </Button>
        </div>

        {isLoading ? (
          <div className="border-b border-border/80 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">
              {t("common:empty.loading")}
            </p>
          </div>
        ) : isError ? (
          <div className="border-b border-border/80 px-4 py-2 text-center">
            <p className="text-xs font-semibold text-destructive">
              {t("appointments:loadError")}
            </p>
          </div>
        ) : appointments && appointments.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-2 text-center">
            <p className="text-xs font-semibold text-foreground">
              {t("appointments:empty.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("appointments:empty.description")}
            </p>
          </div>
        ) : null}

        {unscheduled.length > 0 && (
          <div className="border-b border-border/80 px-3 py-2">
            <p className="text-[10px] font-medium uppercase text-muted-foreground">
              {t("appointments:unscheduled")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unscheduled.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs transition-colors hover:bg-accent"
                  onClick={() => handleSelectAppointment(appointment)}
                >
                  {appointment.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <WeekCalendar
          appointments={appointments}
          weekStart={weekStart}
          onSelectAppointment={handleSelectAppointment}
          onCreateAt={handleCreateAt}
        />
      </div>

      <AppointmentDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        projectId={projectId}
        workspaceId={workspaceId}
        appointment={selectedAppointment}
        defaultStart={defaultStart}
      />
    </ProjectLayout>
  );
}
