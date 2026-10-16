import { useEffect } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function useUserPreferencesEffects() {
  const { uiScale } = useUserPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;

    // The preference multiplies the CSS base (see index.css) instead of
    // replacing it, so a user scale stacks with the shipped density.
    root.style.setProperty("--ui-scale", String(uiScale));

    return () => {
      root.style.removeProperty("--ui-scale");
    };
  }, [uiScale]);

  return {
    uiScale,
  };
}
