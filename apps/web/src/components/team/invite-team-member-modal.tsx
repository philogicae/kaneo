import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useCreateInvitation from "@/hooks/mutations/invitation/use-create-invitation";
import useGetAccessTeams from "@/hooks/queries/access-team/use-get-access-teams";
import useGetManageableWorkspaces from "@/hooks/queries/access-team/use-get-manageable-workspaces";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import {
  type AccessScopeValue,
  isScopeValid,
  toggleScopeWorkspace,
  toScopeInput,
} from "@/lib/access-scope";
import { toast } from "@/lib/toast";
import AccessScopeSelector from "./access-scope-selector";
import InvitationLinkField from "./invitation-link-field";

type Props = {
  open: boolean;
  onClose: () => void;
};

const teamMemberSchema = z.object({
  email: z.string().email(),
});

type TeamMemberFormValues = z.infer<typeof teamMemberSchema>;

function InviteTeamMemberModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useCreateInvitation();
  const queryClient = useQueryClient();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { canInviteUsers } = useWorkspacePermission();
  const canInvite = canInviteUsers();
  const { data: teams } = useGetAccessTeams(workspaceId);
  const { data: manageableWorkspaces = [] } = useGetManageableWorkspaces();
  const [createdInvitation, setCreatedInvitation] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(
    new Set(),
  );
  const [scope, setScope] = useState<AccessScopeValue>({});

  const form = useForm<TeamMemberFormValues>({
    resolver: standardSchemaResolver(teamMemberSchema),
    defaultValues: {
      email: "",
    },
  });

  // Default scope: the active workspace in full, matching the pre-scope
  // behaviour of an email invitation.
  useEffect(() => {
    if (!open || !workspaceId) return;
    setScope((current) =>
      Object.keys(current).length > 0
        ? current
        : toggleScopeWorkspace({}, workspaceId, true),
    );
  }, [open, workspaceId]);

  // The invitation needs at least one source of access: a selected team or a
  // valid manual scope.
  const manualScopeSelected = Object.keys(scope).length > 0;
  const scopeReady =
    selectedTeamIds.size > 0 || (manualScopeSelected && isScopeValid(scope));
  const canSubmit = canInvite && scopeReady && manageableWorkspaces.length > 0;

  const toggleTeam = (teamId: string, checked: boolean) => {
    setSelectedTeamIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(teamId);
      } else {
        next.delete(teamId);
      }
      return next;
    });
  };

  const onSubmit = async ({ email }: TeamMemberFormValues) => {
    if (!canSubmit) {
      toast.error(t("team:inviteModal.scopeRequired"));
      return;
    }
    try {
      const invitation = await mutateAsync({
        email: email.trim(),
        role: "member",
        workspaces: toScopeInput(scope),
        teamIds: [...selectedTeamIds],
      });
      await queryClient.refetchQueries({
        queryKey: ["workspace-users", workspaceId],
      });

      toast.success(t("team:inviteModal.success"));

      if (invitation?.id) {
        setCreatedInvitation({ id: invitation.id, email });
        form.reset();
        return;
      }

      resetInviteTeamMember();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("team:inviteModal.error"),
      );
    }
  };

  const resetInviteTeamMember = async () => {
    if (workspaceId) {
      await queryClient.invalidateQueries({
        queryKey: ["workspace-users", workspaceId],
      });
    }
    form.reset();
    setSelectedTeamIds(new Set());
    if (workspaceId) {
      setScope(toggleScopeWorkspace({}, workspaceId, true));
    }
  };

  const resetAndCloseModal = () => {
    setCreatedInvitation(null);
    resetInviteTeamMember();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndCloseModal}>
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {createdInvitation
              ? t("team:inviteModal.createdTitle")
              : t("team:inviteModal.title")}
          </DialogTitle>
        </DialogHeader>

        {createdInvitation ? (
          <>
            <DialogPanel className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("team:inviteModal.shareLinkDescription", {
                  email: createdInvitation.email,
                })}
              </p>
              <InvitationLinkField invitationId={createdInvitation.id} />
            </DialogPanel>
            <DialogFooter>
              <Button size="sm" onClick={resetAndCloseModal}>
                {t("team:inviteModal.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogPanel className="max-h-[70vh] space-y-4 overflow-y-auto">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("team:inviteModal.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t("team:inviteModal.emailPlaceholder")}
                          autoFocus
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {t("team:inviteModal.teamsLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("team:inviteModal.teamsHint")}
                  </p>
                  {teams && teams.length > 0 ? (
                    <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border/50 p-2">
                      {teams.map((team) => (
                        <label
                          key={team.id}
                          className="flex items-center gap-2 text-sm"
                          htmlFor={`invite-team-${team.id}`}
                        >
                          <Checkbox
                            id={`invite-team-${team.id}`}
                            checked={selectedTeamIds.has(team.id)}
                            onCheckedChange={(checked) =>
                              toggleTeam(team.id, checked === true)
                            }
                          />
                          <span className="min-w-0 truncate">{team.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("team:inviteModal.noTeams")}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {t("team:inviteModal.scopeLabel")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("team:inviteModal.scopeHint")}
                  </p>
                  <AccessScopeSelector
                    workspaces={manageableWorkspaces}
                    value={scope}
                    onChange={setScope}
                    disabled={!canInvite}
                  />
                </div>
              </DialogPanel>

              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" size="sm" type="button" />}
                >
                  {t("common:actions.cancel")}
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || !workspaceId || isPending}
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {t("team:inviteModal.sendInvitation")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogPopup>
    </Dialog>
  );
}

export default InviteTeamMemberModal;
