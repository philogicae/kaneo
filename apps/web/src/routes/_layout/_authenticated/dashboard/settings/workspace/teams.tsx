import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import AccessTeamsSettings from "@/components/team/access-teams-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/teams",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("team:accessTeams.pageTitle")} />
      <AccessTeamsSettings />
    </>
  );
}
