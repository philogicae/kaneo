import { CheckIcon, CopyIcon, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GetWorkspaceInviteLinksResponse } from "@/fetchers/workspace-sharing/get-invite-links";
import useCreateWorkspaceInviteLink from "@/hooks/mutations/workspace-sharing/use-create-workspace-invite-link";
import useDeleteWorkspaceInviteLink from "@/hooks/mutations/workspace-sharing/use-delete-workspace-invite-link";
import useWorkspaceInviteLinks from "@/hooks/queries/workspace-sharing/use-workspace-invite-links";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

type ExpiryChoice = "none" | "24" | "168" | "720";
type MaxUsesChoice = "unlimited" | "1" | "10" | "50";

function InviteLinksManager({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { data: links, isLoading } = useWorkspaceInviteLinks(workspaceId);
  const create = useCreateWorkspaceInviteLink();
  const remove = useDeleteWorkspaceInviteLink({ workspaceId });

  const [expiryHours, setExpiryHours] = useState<ExpiryChoice>("none");
  const [maxUses, setMaxUses] = useState<MaxUsesChoice>("unlimited");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCreate = async () => {
    try {
      await create.mutateAsync({
        workspaceId,
        expiresInHours:
          expiryHours === "none" ? undefined : Number.parseInt(expiryHours, 10),
        maxUses:
          maxUses === "unlimited" ? undefined : Number.parseInt(maxUses, 10),
      });
      toast.success(t("team:inviteLinks.createSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:inviteLinks.createError"),
      );
    }
  };

  const handleCopy = async (token: string) => {
    const ok = await copyToClipboard(
      `${window.location.origin}/invitation/link/${token}`,
    );
    if (ok) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
      toast.success(t("team:inviteLinks.linkCopied"));
    } else {
      toast.error(t("team:inviteLinks.copyFailed"));
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await remove.mutateAsync(linkId);
      toast.success(t("team:inviteLinks.deleteSuccess"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("team:inviteLinks.deleteError"),
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="w-4 h-4" />
          {t("team:inviteLinks.title")}
        </CardTitle>
        <CardDescription>{t("team:inviteLinks.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="basis-40 space-y-1">
            <span className="text-xs text-muted-foreground block">
              {t("team:inviteLinks.expiryLabel")}
            </span>
            <Select
              value={expiryHours}
              onValueChange={(value) => setExpiryHours(value as ExpiryChoice)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("team:inviteLinks.expiryNever")}
                </SelectItem>
                <SelectItem value="24">
                  {t("team:inviteLinks.expiry24h")}
                </SelectItem>
                <SelectItem value="168">
                  {t("team:inviteLinks.expiry7d")}
                </SelectItem>
                <SelectItem value="720">
                  {t("team:inviteLinks.expiry30d")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="basis-40">
            <span className="text-xs text-muted-foreground block">
              {t("team:inviteLinks.maxUsesLabel")}
            </span>
            <Select
              value={maxUses}
              onValueChange={(value) => setMaxUses(value as MaxUsesChoice)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">
                  {t("team:inviteLinks.maxUsesUnlimited")}
                </SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={create.isPending}
          >
            {t("team:inviteLinks.create")}
          </Button>
        </div>

        {isLoading ? null : !links?.length ? (
          <p className="text-xs text-muted-foreground">
            {t("team:inviteLinks.empty")}
          </p>
        ) : (
          <div className="space-y-1">
            {links.map((link: GetWorkspaceInviteLinksResponse[number]) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-b-0"
              >
                <span className="font-mono text-xs truncate min-w-0">
                  {`${window.location.origin}/invitation/link/${link.token}`}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {t("team:inviteLinks.uses", {
                    used: link.usedCount,
                    max: link.maxUses,
                  })}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {link.expiresAt
                    ? t("team:invitations.expires", {
                        date: new Date(link.expiresAt).toLocaleDateString(),
                      })
                    : t("team:inviteLinks.never")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("team:inviteLinks.copyIconAria")}
                  onClick={() => handleCopy(link.token)}
                >
                  {copiedToken === link.token ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <CopyIcon className="size-3" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("team:inviteLinks.revokeIconAria")}
                  onClick={() => handleDelete(link.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InviteLinksManager;
