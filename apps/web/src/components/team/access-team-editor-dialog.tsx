import { useQueries } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AccessScopeSelector from "@/components/team/access-scope-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AccessTeam } from "@/fetchers/access-team/list-access-teams";
import type { ManageableWorkspace } from "@/fetchers/access-team/list-manageable-workspaces";
import getWorkspaceMembers from "@/fetchers/workspace/get-workspace-members";
import useCreateAccessTeam from "@/hooks/mutations/access-team/use-create-access-team";
import useSetAccessTeamMember from "@/hooks/mutations/access-team/use-set-access-team-member";
import useUpdateAccessTeam from "@/hooks/mutations/access-team/use-update-access-team";
import {
  type AccessScopeValue,
  isScopeValid,
  scopeFromTeam,
  toggleScopeWorkspace,
  toScopeInput,
} from "@/lib/access-scope";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  team: AccessTeam | null;
  activeWorkspaceId?: string;
  manageableWorkspaces: ManageableWorkspace[];
  onClose: () => void;
};

export default function AccessTeamEditorDialog({
  open,
  team,
  activeWorkspaceId,
  manageableWorkspaces,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { mutateAsync: createTeam, isPending: isCreating } =
    useCreateAccessTeam();
  const { mutateAsync: updateTeam, isPending: isUpdating } =
    useUpdateAccessTeam();
  const { mutateAsync: setMember, isPending: isUpdatingMember } =
    useSetAccessTeamMember();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<AccessScopeValue>({});
  const [memberToAdd, setMemberToAdd] = useState("");

  const isPending = isCreating || isUpdating;

  // Reset the form whenever the dialog opens on a different team.
  useEffect(() => {
    if (!open) return;
    setName(team?.name ?? "");
    setDescription(team?.description ?? "");
    if (team) {
      setScope(scopeFromTeam(team.workspaces));
    } else if (activeWorkspaceId) {
      setScope(toggleScopeWorkspace({}, activeWorkspaceId, true));
    } else {
      setScope({});
    }
    setMemberToAdd("");
  }, [open, team, activeWorkspaceId]);

  const scopeWorkspaceIds = useMemo(
    () => (team?.workspaces ?? []).map((workspace) => workspace.workspaceId),
    [team],
  );

  const memberQueries = useQueries({
    queries: scopeWorkspaceIds.map((workspaceId) => ({
      queryKey: ["workspace-members", workspaceId],
      queryFn: () => getWorkspaceMembers(workspaceId),
    })),
  });

  const candidates = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; email: string }>();
    for (const query of memberQueries) {
      for (const member of query.data ?? []) {
        byId.set(member.id, {
          id: member.id,
          name: member.name,
          email: member.email,
        });
      }
    }
    for (const member of team?.members ?? []) {
      byId.delete(member.userId);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [memberQueries, team]);

  const canSave = name.trim().length > 0 && isScopeValid(scope) && !isPending;

  const handleSave = async () => {
    if (!canSave) return;
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      workspaces: toScopeInput(scope),
    };
    try {
      if (team) {
        await updateTeam({ id: team.id, body });
        toast.success(t("team:accessTeams.updated"));
      } else {
        await createTeam(body);
        toast.success(t("team:accessTeams.created"));
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:accessTeams.saveError"),
      );
    }
  };

  const handleAddMember = async () => {
    if (!team || !memberToAdd) return;
    try {
      await setMember({ id: team.id, userId: memberToAdd, action: "add" });
      setMemberToAdd("");
      toast.success(t("team:accessTeams.memberAdded"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:accessTeams.memberError"),
      );
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!team) return;
    try {
      await setMember({ id: team.id, userId, action: "remove" });
      toast.success(t("team:accessTeams.memberRemoved"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:accessTeams.memberError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {team
              ? t("team:accessTeams.editTitle")
              : t("team:accessTeams.createTitle")}
          </DialogTitle>
        </DialogHeader>

        <DialogPanel className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="access-team-name">
              {t("team:accessTeams.nameLabel")}
            </Label>
            <Input
              id="access-team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("team:accessTeams.namePlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="access-team-description">
              {t("team:accessTeams.descriptionLabel")}
            </Label>
            <Textarea
              id="access-team-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("team:accessTeams.descriptionPlaceholder")}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("team:accessTeams.scopeLabel")}</Label>
            <p className="text-xs text-muted-foreground">
              {t("team:accessTeams.scopeHint")}
            </p>
            <AccessScopeSelector
              workspaces={manageableWorkspaces}
              value={scope}
              onChange={setScope}
              disabled={isPending}
            />
          </div>

          {team && (
            <div className="space-y-2">
              <Label>{t("team:accessTeams.membersLabel")}</Label>
              {team.members.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("team:accessTeams.noMembers")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {team.members.map((member) => (
                    <li
                      key={member.userId}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {member.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("team:accessTeams.removeMember")}
                        disabled={isUpdatingMember}
                        onClick={() => handleRemoveMember(member.userId)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Select
                  value={memberToAdd}
                  onValueChange={(value) => setMemberToAdd(value ?? "")}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue
                      placeholder={t("team:accessTeams.addMemberPlaceholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                        <span className="ml-2 text-muted-foreground">
                          {candidate.email}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!memberToAdd || isUpdatingMember}
                  onClick={handleAddMember}
                >
                  {isUpdatingMember ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  {t("team:accessTeams.addMember")}
                </Button>
              </div>
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
