import {
  createFileRoute,
  Link,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import useAcceptWorkspaceInviteLink from "@/hooks/mutations/workspace-sharing/use-accept-workspace-invite-link";
import useGetWorkspaceInviteLinkDetails from "@/hooks/queries/workspace-sharing/use-get-workspace-invite-link-details";
import { authClient } from "@/lib/auth-client";
import { toast } from "@/lib/toast";
import { AuthLayout } from "../../components/auth/layout";

export const Route = createFileRoute("/invitation/link/$token")({
  component: AcceptInviteLink,
});

function AcceptInviteLink() {
  const { t } = useTranslation();
  const { token } = useParams({ from: "/invitation/link/$token" });
  const navigate = useNavigate();
  const [isAccepting, setIsAccepting] = useState(false);

  const { data: session, isPending: isSessionLoading } =
    authClient.useSession();
  const {
    data: linkData,
    isLoading: isLinkLoading,
    error: linkError,
  } = useGetWorkspaceInviteLinkDetails(token);
  const accept = useAcceptWorkspaceInviteLink();

  const isLoading = isSessionLoading || isLinkLoading;
  const isSignedIn = !!session?.user;

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      const result = await accept.mutateAsync(token);
      await authClient.organization
        .setActive({ organizationId: result.workspaceId })
        .catch(() => undefined);
      toast.success(t("auth:invitation.toast.acceptSuccess"));
      navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: result.workspaceId },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("auth:inviteLink.errors.accept"),
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSignIn = () =>
    navigate({
      to: "/auth/sign-in",
      search: { redirect: `/invitation/link/${token}` },
    });

  const handleCreateAccount = () =>
    navigate({ to: "/auth/sign-up", search: { inviteLinkToken: token } });

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("auth:inviteLink.pageTitleAccept")} />
        <AuthLayout title={t("auth:inviteLink.loading")}>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </AuthLayout>
      </>
    );
  }

  if (linkError || !linkData) {
    return (
      <>
        <PageTitle title={t("auth:inviteLink.pageTitleError")} />
        <AuthLayout title={t("auth:inviteLink.errorTitle")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <Alert variant="error">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t("auth:inviteLink.errors.load")}
              </AlertDescription>
            </Alert>
            <Button
              render={<Link to="/auth/sign-in" />}
              variant="outline"
              className="w-full"
            >
              {t("auth:invitation.goToSignIn")}
            </Button>
          </div>
        </AuthLayout>
      </>
    );
  }

  if (!linkData.valid) {
    return (
      <>
        <PageTitle title={t("auth:inviteLink.pageTitleInvalid")} />
        <AuthLayout title={t("auth:inviteLink.invalidTitle")}>
          <div className="space-y-4 mt-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full">
              {linkData.error?.includes("expired") ? (
                <Clock className="w-6 h-6 text-destructive" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive" />
              )}
            </div>
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {linkData.error?.includes("expired")
                  ? t("auth:inviteLink.linkExpired")
                  : t("auth:inviteLink.invalidTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{linkData.error}</p>
              {linkData.workspaceName && (
                <p className="text-xs text-muted-foreground">
                  {t("team:inviteLinks.workspace", {
                    workspaceName: linkData.workspaceName,
                  })}
                </p>
              )}
            </div>
            <Button
              render={<Link to="/auth/sign-in" />}
              variant="outline"
              className="w-full"
            >
              {t("auth:invitation.goToSignIn")}
            </Button>
          </div>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageTitle title={t("auth:inviteLink.pageTitleAccept")} />
      <AuthLayout title={t("auth:inviteLink.title")}>
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-success/10 rounded-full">
            <CheckCircle className="w-6 h-6 text-success-foreground" />
          </div>
          <p className="text-sm text-center">
            {t("auth:inviteLink.joinPrompt", {
              workspaceName: linkData.workspaceName,
            })}
          </p>

          {isSignedIn ? (
            <>
              {session?.user?.email && (
                <p className="text-xs text-center text-muted-foreground">
                  {t("auth:invitation.signedInAs", {
                    email: session.user.email,
                  })}
                </p>
              )}
              <Button
                className="w-full"
                onClick={handleAccept}
                disabled={isAccepting}
              >
                {isAccepting
                  ? t("auth:invitation.accepting")
                  : t("team:inviteLinks.join", {
                      workspaceName: linkData.workspaceName,
                    })}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-center text-muted-foreground">
                {t("auth:inviteLink.signedOutPrompt")}
              </p>
              <Button className="w-full" onClick={handleCreateAccount}>
                {t("auth:invitation.createAccount")}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignIn}
              >
                {t("auth:invitation.signIn")}
              </Button>
            </>
          )}
        </div>
      </AuthLayout>
    </>
  );
}
