import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NotificationPreferencesSettings } from "@/components/account/notification-preferences-settings";
import PageTitle from "@/components/page-title";
import { ChannelIntegrationsTab } from "@/components/settings/channel-integrations-tab";
import { TelegramConfigCard } from "@/components/settings/telegram-config/telegram-config-card";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";

const NOTIFICATION_TABS = ["general", "telegram", "discord", "slack"] as const;

type NotificationTab = (typeof NOTIFICATION_TABS)[number];

function isNotificationTab(value: unknown): value is NotificationTab {
  return (
    typeof value === "string" &&
    (NOTIFICATION_TABS as readonly string[]).includes(value)
  );
}

type NotificationsSearchParams = {
  tab?: NotificationTab;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/notifications",
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): NotificationsSearchParams => ({
    tab: isNotificationTab(search.tab) ? search.tab : undefined,
  }),
});

// One page for every notification surface: account delivery preferences and
// the per-channel integrations (Telegram bots/rules, Discord and Slack
// project webhooks). The Telegram route redirects here with `?tab=telegram`.
function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const activeTab = tab ?? "general";

  return (
    <>
      <PageTitle title={t("settings:notificationsPage.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:notificationsPage.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:notificationsPage.subtitle")}
          </p>
        </div>

        <Tabs
          className="gap-4"
          value={activeTab}
          onValueChange={(value) => {
            if (isNotificationTab(value)) {
              navigate({ to: ".", search: { tab: value }, replace: true });
            }
          }}
        >
          <TabsList className="w-fit">
            <TabsTrigger value="general">
              {t("settings:notificationsPage.tabGeneral")}
            </TabsTrigger>
            <TabsTrigger value="telegram">
              {t("settings:notificationsPage.tabTelegram")}
            </TabsTrigger>
            <TabsTrigger value="discord">
              {t("settings:notificationsPage.tabDiscord")}
            </TabsTrigger>
            <TabsTrigger value="slack">
              {t("settings:notificationsPage.tabSlack")}
            </TabsTrigger>
          </TabsList>

          <TabsPanel value="general">
            <NotificationPreferencesSettings />
          </TabsPanel>

          <TabsPanel value="telegram">
            <CardFrame>
              <Card className="rounded-none! border-t-0!">
                <CardHeader>
                  <CardTitle className="inline-flex items-center gap-2 text-base">
                    {t("settings:telegramUnified.cardTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings:telegramUnified.cardDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="rounded-none!">
                <CardPanel className="p-4">
                  <TelegramConfigCard />
                </CardPanel>
              </Card>
            </CardFrame>
          </TabsPanel>

          <TabsPanel value="discord">
            <ChannelIntegrationsTab kind="discord" />
          </TabsPanel>

          <TabsPanel value="slack">
            <ChannelIntegrationsTab kind="slack" />
          </TabsPanel>
        </Tabs>
      </div>
    </>
  );
}
