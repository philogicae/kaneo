import { MinusIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  clampUiScale,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  useUserPreferencesStore,
} from "@/store/user-preferences";

export function UiScaleControl() {
  const { t } = useTranslation();
  const { uiScale, setUiScale } = useUserPreferencesStore();

  // Guard against a stale persisted value that slipped past rehydration.
  const current = clampUiScale(uiScale ?? 1);

  const decrease = () => {
    if (current > UI_SCALE_MIN) {
      setUiScale(clampUiScale(current - UI_SCALE_STEP));
    }
  };
  const increase = () => {
    if (current < UI_SCALE_MAX) {
      setUiScale(clampUiScale(current + UI_SCALE_STEP));
    }
  };

  return (
    <fieldset
      aria-label={t("settings:preferencesPage.interfaceSize")}
      className="inline-flex h-7 items-center rounded-full border-0 bg-input/50 p-0 px-0.5 font-medium text-sm"
    >
      <button
        type="button"
        onClick={decrease}
        disabled={current <= UI_SCALE_MIN}
        aria-label={t("settings:preferencesPage.interfaceSizeDecrease")}
        title={t("settings:preferencesPage.interfaceSizeDecrease")}
        className="flex h-6 min-w-6 items-center justify-center rounded-full transition-colors duration-200 ease-out hover:text-foreground disabled:pointer-events-none disabled:opacity-30 text-muted-foreground/70"
      >
        <MinusIcon aria-hidden="true" size={13} />
      </button>
      <span className="min-w-9 text-center text-muted-foreground">
        {Math.round(current * 100)}%
      </span>
      <button
        type="button"
        onClick={increase}
        disabled={current >= UI_SCALE_MAX}
        aria-label={t("settings:preferencesPage.interfaceSizeIncrease")}
        title={t("settings:preferencesPage.interfaceSizeIncrease")}
        className="flex h-6 min-w-6 items-center justify-center rounded-full transition-colors duration-200 ease-out hover:text-foreground disabled:pointer-events-none disabled:opacity-30 text-muted-foreground/70"
      >
        <PlusIcon aria-hidden="true" size={13} />
      </button>
    </fieldset>
  );
}
