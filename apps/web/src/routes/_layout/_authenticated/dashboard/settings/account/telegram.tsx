import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { TelegramConfigCard } from "@/components/settings/telegram-config/telegram-config-card";
import {
  Card,
  CardDescription,
  CardFrame,
  CardHeader,
  CardPanel,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/telegram",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();

  return (
    <>
      <PageTitle title={t("settings:telegramUnified.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:telegramUnified.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:telegramUnified.subtitle")}
          </p>
        </div>

        <CardFrame>
          <Card className="!rounded-none !border-t-0">
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                {t("settings:telegramUnified.cardTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings:telegramUnified.cardDescription")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="!rounded-none">
            <CardPanel className="p-4">
              <TelegramConfigCard />
            </CardPanel>
          </Card>
        </CardFrame>
      </div>
    </>
  );
}
