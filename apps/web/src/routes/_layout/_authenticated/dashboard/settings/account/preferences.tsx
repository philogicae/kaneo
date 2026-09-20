import {
  type AppLocale,
  defaultLocale,
  supportedLocales,
} from "@i18n/resources";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/hooks/use-locale";
import { cn } from "@/lib/cn";
import {
  isWeekStartDay,
  useUserPreferencesStore,
  WEEK_START_DAYS,
  type WeekStartDay,
} from "@/store/user-preferences";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/account/preferences",
)({
  component: RouteComponent,
});

function getLocaleLabel(locale: AppLocale) {
  try {
    const localeObj = new Intl.Locale(locale);
    const languageDisplayNames = new Intl.DisplayNames([locale], {
      type: "language",
    });
    return languageDisplayNames.of(localeObj.language) ?? locale;
  } catch {
    return locale;
  }
}

function RouteComponent() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const {
    theme,
    setTheme,
    weekStartsOn,
    setWeekStartsOn,
    viewMode,
    setViewMode,
    showTaskNumbers,
    setShowTaskNumbers,
    showAssignees,
    setShowAssignees,
    showDueDates,
    setShowDueDates,
    showLabels,
    setShowLabels,
    showPriority,
    setShowPriority,
    resetDisplayPreferences,
    sidebarDefaultOpen,
    setSidebarDefaultOpen,
  } = useUserPreferencesStore();

  const themeLabels: Record<string, string> = {
    light: t("settings:preferencesPage.themeLight"),
    dark: t("settings:preferencesPage.themeDark"),
    volt: t("settings:preferencesPage.themeVolt"),
    system: t("settings:preferencesPage.themeSystem"),
  };

  const viewLabels: Record<string, string> = {
    board: t("settings:preferencesPage.board"),
    list: t("settings:preferencesPage.list"),
  };
  const weekStartLabels: Record<WeekStartDay, string> = {
    0: t("settings:preferencesPage.weekStartsOnSunday"),
    1: t("settings:preferencesPage.weekStartsOnMonday"),
    6: t("settings:preferencesPage.weekStartsOnSaturday"),
  };

  const selectedLocale: AppLocale = locale ?? defaultLocale;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {t("settings:preferencesPage.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("settings:preferencesPage.subtitle")}
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-md font-medium">
            {t("settings:preferencesPage.appearanceTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings:preferencesPage.appearanceSubtitle")}
          </p>
        </div>

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="space-y-2">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.theme")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.themeDescription")}
              </p>
            </div>
            <fieldset
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              aria-label={t("settings:preferencesPage.theme")}
            >
              {(["light", "dark", "volt", "system"] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer flex-col gap-2 rounded-lg border p-2 text-left transition-colors focus-within:ring-2 focus-within:ring-ring/40",
                    theme === option
                      ? "border-ring ring-2 ring-ring/30"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={option}
                    checked={theme === option}
                    onChange={() => setTheme(option)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "relative block h-10 w-full overflow-hidden rounded-md border",
                      `theme-preview-${option}`,
                    )}
                    style={{
                      background: "var(--preview-bg)",
                      borderColor: "var(--preview-border)",
                    }}
                  >
                    <span
                      className="absolute top-1.5 left-1.5 h-4 w-8 rounded-sm border"
                      style={{
                        background: "var(--preview-card)",
                        borderColor: "var(--preview-border)",
                      }}
                    />
                    <span
                      className="absolute right-1.5 bottom-1.5 size-2.5 rounded-full"
                      style={{ background: "var(--preview-accent)" }}
                    />
                  </span>
                  <span className="text-xs font-medium">
                    {themeLabels[option]}
                  </span>
                </label>
              ))}
            </fieldset>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.language")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.languageDescription")}
              </p>
            </div>
            <Select
              value={selectedLocale}
              onValueChange={(value) => {
                if (value) {
                  void setLocale(value as AppLocale);
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectLanguage")}
                >
                  {getLocaleLabel(selectedLocale)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {supportedLocales.map((supportedLocale) => (
                  <SelectItem key={supportedLocale} value={supportedLocale}>
                    {getLocaleLabel(supportedLocale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.firstDayOfWeek")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.firstDayOfWeekDescription")}
              </p>
            </div>
            <Select
              value={String(weekStartsOn)}
              onValueChange={(value) => {
                if (!value) {
                  return;
                }

                const parsedWeekStart = Number(value);

                if (isWeekStartDay(parsedWeekStart)) {
                  setWeekStartsOn(parsedWeekStart);
                }
              }}
            >
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue
                  placeholder={t(
                    "settings:preferencesPage.selectFirstDayOfWeek",
                  )}
                >
                  {weekStartLabels[weekStartsOn]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {WEEK_START_DAYS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    {weekStartLabels[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.defaultView")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.defaultViewDescription")}
              </p>
            </div>
            <Select
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value)}
            >
              <SelectTrigger size="sm" className="w-full sm:w-40">
                <SelectValue
                  placeholder={t("settings:preferencesPage.selectViewMode")}
                >
                  {viewLabels[viewMode]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="board">
                  {t("settings:preferencesPage.board")}
                </SelectItem>
                <SelectItem value="list">
                  {t("settings:preferencesPage.list")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.sidebarDefault")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.sidebarDefaultDescription")}
              </p>
            </div>
            <Switch
              checked={sidebarDefaultOpen}
              onCheckedChange={setSidebarDefaultOpen}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:preferencesPage.displayOptions")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:preferencesPage.displayOptionsDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={resetDisplayPreferences}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            {t("common:actions.reset")}
          </Button>
        </div>

        <div className="space-y-4 border border-border rounded-md p-4 bg-sidebar">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.taskNumbers")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.taskNumbersDescription")}
              </p>
            </div>
            <Switch
              checked={showTaskNumbers}
              onCheckedChange={setShowTaskNumbers}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.assignees")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.assigneesDescription")}
              </p>
            </div>
            <Switch
              checked={showAssignees}
              onCheckedChange={setShowAssignees}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.dueDates")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.dueDatesDescription")}
              </p>
            </div>
            <Switch checked={showDueDates} onCheckedChange={setShowDueDates} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.labels")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.labelsDescription")}
              </p>
            </div>
            <Switch checked={showLabels} onCheckedChange={setShowLabels} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">
                {t("settings:preferencesPage.priority")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("settings:preferencesPage.priorityDescription")}
              </p>
            </div>
            <Switch checked={showPriority} onCheckedChange={setShowPriority} />
          </div>
        </div>
      </div>
    </div>
  );
}
