import { MoonIcon, SunIcon, ZapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "@/store/user-preferences";

// Order matters: volt sits between dark and light by design.
const THEMES = ["dark", "volt", "light"] as const;

export function ThemeToggleDropdown() {
  const { t } = useTranslation();
  const { theme, setTheme } = useUserPreferencesStore();

  const labels: Record<(typeof THEMES)[number], string> = {
    dark: t("settings:preferencesPage.themeDark"),
    volt: t("settings:preferencesPage.themeVolt"),
    light: t("settings:preferencesPage.themeLight"),
  };

  return (
    <fieldset
      className="relative inline-grid h-7 grid-cols-[1fr_1fr_1fr] items-center rounded-full border-0 bg-input/50 p-0 font-medium text-sm"
      aria-label={t("settings:preferencesPage.selectTheme")}
    >
      {THEMES.map((value) => {
        const Icon = {
          dark: MoonIcon,
          volt: ZapIcon,
          light: SunIcon,
        }[value];
        const active = theme === value;

        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={labels[value]}
            title={labels[value]}
            onClick={() => setTheme(value)}
            className={`flex min-w-7 items-center justify-center rounded-full text-center transition-colors duration-200 ease-out ${
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <Icon aria-hidden="true" size={13} />
          </button>
        );
      })}
    </fieldset>
  );
}
