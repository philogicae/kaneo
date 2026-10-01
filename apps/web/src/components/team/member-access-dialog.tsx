import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import useUpdateMemberAccess from "@/hooks/mutations/workspace-user/use-update-member-access";
import useGetManageableWorkspaces from "@/hooks/queries/access-team/use-get-manageable-workspaces";
import useGetMemberAccess from "@/hooks/queries/workspace-users/use-get-member-access";
import {
  type AccessScopeValue,
  scopeFromTeam,
  toScopeInput,
} from "@/lib/access-scope";
import { toast } from "@/lib/toast";
import AccessScopeSelector from "./access-scope-selector";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  member: { id: string; name: string; email: string };
};

// Edits a member's direct grants for one workspace, outside teams. An empty
// selection clears them; the API then drops the membership when nothing else
// keeps the member in the workspace.
export default function MemberAccessDialog({
  open,
  onOpenChange,
  workspaceId,
  member,
}: Props) {
  const { t } = useTranslation();
  const { data: access, isLoading } = useGetMemberAccess(
    workspaceId,
    member.id,
    open,
  );
  const { data: manageableWorkspaces = [] } = useGetManageableWorkspaces();
  const { mutateAsync: updateMemberAccess, isPending } =
    useUpdateMemberAccess();
  const [scope, setScope] = useState<AccessScopeValue>({});

  const workspace = useMemo(
    () => manageableWorkspaces.find((entry) => entry.id === workspaceId),
    [manageableWorkspaces, workspaceId],
  );

  // Seed the tree from the saved grants each time the dialog opens.
  useEffect(() => {
    if (!open || !access) return;
    if (access.allProjects) {
      setScope({ [workspaceId]: { allProjects: true, projectIds: new Set() } });
      return;
    }
    if (access.projectIds.length > 0) {
      setScope(
        scopeFromTeam([
          {
            workspaceId,
            allProjects: false,
            projects: access.projectIds.map((id) => ({ id })),
          },
        ]),
      );
      return;
    }
    setScope({});
  }, [open, access, workspaceId]);

  const isFull = access?.accessScope === "full";

  const handleSave = async () => {
    try {
      const [entry] = toScopeInput(scope);
      await updateMemberAccess({
        workspaceId,
        userId: member.id,
        allProjects: entry?.allProjects ?? false,
        projectIds: entry?.projectIds ?? [],
      });
      toast.success(t("team:memberAccess.saveSuccess"));
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:memberAccess.saveError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("team:memberAccess.title")}</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("team:memberAccess.description", {
              name: member.name || member.email,
            })}
          </p>
          {isFull ? (
            <p className="rounded-md border border-border/50 bg-muted/40 p-2 text-xs text-muted-foreground">
              {t("team:memberAccess.fullAccess")}
            </p>
          ) : (
            <>
              <AccessScopeSelector
                workspaces={workspace ? [workspace] : []}
                value={scope}
                onChange={setScope}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                {t("team:memberAccess.hint")}
              </p>
            </>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {t("common:actions.cancel")}
          </Button>
          {isFull ? null : (
            <Button
              size="sm"
              disabled={isPending || isLoading}
              onClick={handleSave}
            >
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {t("team:memberAccess.save")}
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
