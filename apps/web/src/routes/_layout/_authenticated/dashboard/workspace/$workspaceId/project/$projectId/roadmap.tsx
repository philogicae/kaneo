import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import RoadmapView from "@/components/roadmap";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/roadmap",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="roadmap"
    >
      <PageTitle title={t("roadmap:title")} hideAppName />
      <div className="h-[calc(100svh-3.5rem)] min-h-0">
        <RoadmapView projectId={projectId} workspaceId={workspaceId} />
      </div>
    </ProjectLayout>
  );
}
