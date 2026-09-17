import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  Card,
  CardFrame,
  CardFrameDescription,
  CardFrameHeader,
  CardFrameTitle,
  CardPanel,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccessTeam } from "@/fetchers/access-team/list-access-teams";
import useDeleteAccessTeam from "@/hooks/mutations/access-team/use-delete-access-team";
import useGetAccessTeams from "@/hooks/queries/access-team/use-get-access-teams";
import useGetManageableWorkspaces from "@/hooks/queries/access-team/use-get-manageable-workspaces";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import AccessTeamEditorDialog from "./access-team-editor-dialog";

export default function AccessTeamsSettings() {
  const { t } = useTranslation();
  const { workspace, canInviteUsers } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canManage = canInviteUsers();
  const { data: teams, isLoading } = useGetAccessTeams(workspaceId);
  const { data: manageableWorkspaces = [] } = useGetManageableWorkspaces();
  const { mutateAsync: deleteTeam, isPending: isDeleting } =
    useDeleteAccessTeam();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTeamId, setEditorTeamId] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<AccessTeam | null>(null);

  const editingTeam =
    (editorTeamId ? teams?.find((team) => team.id === editorTeamId) : null) ??
    null;

  const openCreate = () => {
    setEditorTeamId(null);
    setEditorOpen(true);
  };

  const openEdit = (team: AccessTeam) => {
    setEditorTeamId(team.id);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!teamToDelete) return;
    try {
      await deleteTeam(teamToDelete.id);
      toast.success(t("team:accessTeams.deleted"));
      setTeamToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:accessTeams.deleteError"),
      );
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">
            {t("team:accessTeams.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("team:accessTeams.description")}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canManage || manageableWorkspaces.length === 0}
          onClick={openCreate}
        >
          <Plus className="size-4" />
          {t("team:accessTeams.newTeam")}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !teams || teams.length === 0 ? (
        <CardFrame>
          <CardPanel className="py-8 text-center">
            <Users className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">{t("team:accessTeams.empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("team:accessTeams.emptyDescription")}
            </p>
          </CardPanel>
        </CardFrame>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.id} className="min-w-0">
              <CardFrame>
                <CardFrameHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardFrameTitle className="truncate">
                        {team.name}
                      </CardFrameTitle>
                      {team.description && (
                        <CardFrameDescription className="truncate">
                          {team.description}
                        </CardFrameDescription>
                      )}
                    </div>
                    {team.canManage && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("team:accessTeams.edit")}
                          onClick={() => openEdit(team)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("team:accessTeams.delete")}
                          onClick={() => setTeamToDelete(team)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardFrameHeader>
                <CardPanel className="space-y-2">
                  <ul className="space-y-1">
                    {team.workspaces.map((workspace) => (
                      <li
                        key={workspace.workspaceId}
                        className="flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate">
                          {workspace.workspaceName}
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {workspace.allProjects
                            ? t("team:accessTeams.allProjects")
                            : t("team:accessTeams.projectCount", {
                                count: workspace.projects.length,
                              })}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">
                    {t("team:accessTeams.memberCount", {
                      count: team.members.length,
                    })}
                  </p>
                </CardPanel>
              </CardFrame>
            </Card>
          ))}
        </div>
      )}

      <AccessTeamEditorDialog
        open={editorOpen}
        team={editingTeam}
        activeWorkspaceId={workspaceId}
        manageableWorkspaces={manageableWorkspaces}
        onClose={() => setEditorOpen(false)}
      />

      <AlertDialog
        open={Boolean(teamToDelete)}
        onOpenChange={(open) => !open && setTeamToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("team:accessTeams.deleteDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("team:accessTeams.deleteDialogDescription", {
                name: teamToDelete?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              render={<Button variant="outline" size="sm" type="button" />}
            >
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              {t("team:accessTeams.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
