import { useQueries } from "@tanstack/react-query";
import { ChevronDown, MessageCircle, Webhook } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DiscordIntegrationSettings } from "@/components/project/discord-integration-settings";
import { SlackIntegrationSettings } from "@/components/project/slack-integration-settings";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import getDiscordIntegration from "@/fetchers/discord-integration/get-discord-integration";
import getProjects from "@/fetchers/project/get-projects";
import getSlackIntegration from "@/fetchers/slack-integration/get-slack-integration";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";

type ChannelKind = "discord" | "slack";

type IntegrationStatus = {
  channelName: string | null;
  webhookConfigured: boolean;
  isActive: boolean | null;
} | null;

type ProjectEntry = {
  workspaceId: string;
  workspaceName: string;
  projectId: string;
  projectName: string;
};

function IntegrationProjectRow({
  entry,
  status,
  kind,
}: {
  entry: ProjectEntry;
  status: IntegrationStatus;
  kind: ChannelKind;
}) {
  const { t } = useTranslation();
  const configured = Boolean(status?.webhookConfigured);
  const paused = configured && status?.isActive === false;
  const SettingsComponent =
    kind === "discord" ? DiscordIntegrationSettings : SlackIntegrationSettings;
  const Icon = kind === "discord" ? MessageCircle : Webhook;

  return (
    <Collapsible className="rounded-lg border border-border bg-background">
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {entry.projectName}
          </span>
          {status?.channelName ? (
            <span className="truncate text-xs text-muted-foreground">
              #{status.channelName}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant={paused ? "outline" : configured ? "default" : "secondary"}
            className="text-[10px]"
          >
            {paused
              ? t("settings:notificationsPage.statusPaused")
              : configured
                ? t("settings:notificationsPage.statusConnected")
                : t("settings:notificationsPage.integrationNotConfigured")}
          </Badge>
          <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 group-data-[panel-open]:rotate-180" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t border-border p-3">
          <SettingsComponent projectId={entry.projectId} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Discord and Slack route project events through a per-project incoming
// webhook, so this tab mirrors the project-level settings across every
// accessible project instead of offering one account-wide connection.
export function ChannelIntegrationsTab({ kind }: { kind: ChannelKind }) {
  const { t } = useTranslation();
  const { data: workspacesData, isLoading: workspacesLoading } =
    useGetWorkspaces();

  const workspaces = useMemo(
    () =>
      (workspacesData ?? []).map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
      })),
    [workspacesData],
  );

  const projectQueries = useQueries({
    queries: workspaces.map((workspace) => ({
      queryKey: ["projects", workspace.id],
      queryFn: () => getProjects({ workspaceId: workspace.id }),
      enabled: !!workspace.id,
    })),
  });

  const entries = useMemo<ProjectEntry[]>(
    () =>
      workspaces.flatMap((workspace, index) =>
        (projectQueries[index]?.data ?? []).map((project) => ({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          projectId: project.id,
          projectName: project.name,
        })),
      ),
    [workspaces, projectQueries],
  );

  const integrationQueries = useQueries({
    queries: entries.map((entry) => {
      const queryKey =
        kind === "discord"
          ? ["discord-integration", entry.projectId]
          : ["slack-integration", entry.projectId];
      const queryFn =
        kind === "discord"
          ? () => getDiscordIntegration(entry.projectId)
          : () => getSlackIntegration(entry.projectId);
      return { queryKey, queryFn, enabled: !!entry.projectId };
    }),
  });

  const isLoading =
    workspacesLoading ||
    projectQueries.some((query) => query.isLoading) ||
    (entries.length > 0 && integrationQueries.some((query) => query.isLoading));

  const sections = useMemo(() => {
    const byWorkspace = new Map<
      string,
      { workspaceId: string; workspaceName: string; entries: ProjectEntry[] }
    >();
    for (const entry of entries) {
      const group = byWorkspace.get(entry.workspaceId) ?? {
        workspaceId: entry.workspaceId,
        workspaceName: entry.workspaceName,
        entries: [],
      };
      group.entries.push(entry);
      byWorkspace.set(entry.workspaceId, group);
    }
    return [...byWorkspace.values()];
  }, [entries]);

  const entryIndex = useMemo(
    () => new Map(entries.map((entry, index) => [entry.projectId, index])),
    [entries],
  );

  const isDiscord = kind === "discord";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">
          {t(
            isDiscord
              ? "settings:notificationsPage.integrationsDiscordTitle"
              : "settings:notificationsPage.integrationsSlackTitle",
          )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            isDiscord
              ? "settings:notificationsPage.integrationsDiscordDescription"
              : "settings:notificationsPage.integrationsSlackDescription",
          )}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("settings:notificationsPage.noProjectsInWorkspace")}
        </p>
      ) : (
        <div className="space-y-5">
          {sections.map(({ workspaceId, workspaceName, entries: items }) => (
            <div className="space-y-2" key={workspaceId}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{workspaceName}</h3>
                <span className="text-xs text-muted-foreground">
                  {t("settings:notificationsPage.projectCount", {
                    count: items.length,
                  })}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((entry) => {
                  const index = entryIndex.get(entry.projectId) ?? -1;
                  const status =
                    index >= 0 ? integrationQueries[index]?.data : null;
                  return (
                    <IntegrationProjectRow
                      key={entry.projectId}
                      entry={entry}
                      status={(status as IntegrationStatus) ?? null}
                      kind={kind}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
