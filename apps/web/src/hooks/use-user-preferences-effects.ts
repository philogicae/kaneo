import { useEffect } from "react";
import { useUserPreferencesStore } from "@/store/user-preferences";

export function useUserPreferencesEffects() {
  const { uiScale } = useUserPreferencesStore();

  useEffect(() => {
    const root = document.documentElement;

    root.style.fontSize = `${uiScale * 100}%`;

    return () => {
      root.style.fontSize = "";
    };
  }, [uiScale]);

  return {
    uiScale,
  };
}
