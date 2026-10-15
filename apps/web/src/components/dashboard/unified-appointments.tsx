import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  CardFrame,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import icons from "@/constants/project-icons";
import getAppointments from "@/fetchers/appointment/get-appointments";
import { getInitials } from "@/lib/get-initials";
import { getPriorityIcon } from "@/lib/priority";
import type Appointment from "@/types/appointment";
import type { ConsolidatedProject } from "./consolidated-task-list";

// Cross-project appointment row: read-only, opens the project's Appointments
// view where the item can be rescheduled.
function ConsolidatedAppointmentRow({
  appointment,
  project,
}: {
  appointment: Appointment;
  project: ConsolidatedProject;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = appointment.startDate ? new Date(appointment.startDate) : null;
  const end = appointment.dueDate ? new Date(appointment.dueDate) : null;

  const range = start
    ? `${format(start, "MMM d, HH:mm")}${end ? ` – ${format(end, "HH:mm")}` : ""}`
    : null;

  return (
    <button
      type="button"
      className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/40"
      onClick={() =>
        navigate({
          to: "/dashboard/workspace/$workspaceId/project/$projectId/appointments",
          params: {
            workspaceId: project.workspaceId,
            projectId: project.project.id,
          },
        })
      }
    >
      <span className="shrink-0">
        {getPriorityIcon(appointment.priority ?? "no-priority")}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {appointment.title}
      </span>
      {range ? (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground tabular-nums">
          {range}
        </span>
      ) : (
        <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {t("unified:appointments.unscheduled")}
        </span>
      )}
      <Avatar className="size-5 shrink-0">
        <AvatarFallback className="text-[10px]">
          {getInitials(appointment.assigneeName, "—")}
        </AvatarFallback>
      </Avatar>
    </button>
  );
}

function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((left, right) => {
    if (!left.startDate && !right.startDate) {
      return left.title.localeCompare(right.title);
    }
    if (!left.startDate) return 1;
    if (!right.startDate) return -1;
    return (
      new Date(left.startDate).getTime() - new Date(right.startDate).getTime()
    );
  });
}

function UnifiedAppointments({
  projects,
}: {
  projects: ConsolidatedProject[];
}) {
  const { t } = useTranslation();

  // Same query key and fetcher as useGetAppointments, so the cross-project
  // view shares the per-project appointment cache.
  const queries = useQueries({
    queries: projects.map(({ project }) => ({
      queryKey: ["appointments", project.id],
      queryFn: () => getAppointments(project.id),
      enabled: !!project.id,
    })),
  });

  const sections = useMemo(
    () =>
      projects.map((project, index) => ({
        project,
        appointments: sortAppointments(queries[index]?.data ?? []),
      })),
    [projects, queries],
  );

  const isLoading = projects.length > 0 && queries.some((q) => q.isLoading);
  const total = sections.reduce(
    (sum, section) => sum + section.appointments.length,
    0,
  );

  // Group the non-empty sections per workspace, preserving the page's
  // workspace order, so this tab reads like Backlog and Tasks.
  const workspaceSections = useMemo(() => {
    const byWorkspace = new Map<
      string,
      { workspaceId: string; workspaceName: string; projects: typeof sections }
    >();
    for (const section of sections) {
      if (section.appointments.length === 0) continue;
      const group = byWorkspace.get(section.project.workspaceId) ?? {
        workspaceId: section.project.workspaceId,
        workspaceName: section.project.workspaceName,
        projects: [],
      };
      group.projects.push(section);
      byWorkspace.set(section.project.workspaceId, group);
    }
    return [...byWorkspace.values()];
  }, [sections]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
    );
  }

  if (total === 0) {
    return (
      <Empty className="min-h-[40vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarClock />
          </EmptyMedia>
          <EmptyTitle>{t("unified:appointments.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("unified:appointments.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {workspaceSections.map(({ workspaceId, workspaceName, projects }) => (
        <div className="flex flex-col gap-2" key={workspaceId}>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{workspaceName}</h3>
            <span className="text-xs text-muted-foreground">
              {t("unified:section.projectCount", {
                count: projects.length,
              })}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {projects.map(({ project, appointments }) => {
              const IconComponent =
                icons[project.project.icon as keyof typeof icons] ||
                icons.Layout;
              return (
                <CardFrame key={project.project.id} className="min-w-0">
                  <CardFrameHeader>
                    <CardFrameTitle>
                      <span className="flex items-center gap-2">
                        <IconComponent
                          aria-hidden="true"
                          className="h-4 w-4 text-muted-foreground"
                        />
                        {project.project.name}
                      </span>
                    </CardFrameTitle>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("unified:appointments.count", {
                        count: appointments.length,
                      })}
                    </span>
                  </CardFrameHeader>
                  <CardPanel className="p-0">
                    <div className="divide-border/60 divide-y">
                      {appointments.map((appointment) => (
                        <ConsolidatedAppointmentRow
                          key={appointment.id}
                          appointment={appointment}
                          project={project}
                        />
                      ))}
                    </div>
                  </CardPanel>
                </CardFrame>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default UnifiedAppointments;
