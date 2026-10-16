import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useUserPreferencesEffects } from "@/hooks/use-user-preferences-effects";
import { useUserPreferencesStore } from "@/store/user-preferences";

function setUiScale(scale: number) {
  act(() => {
    useUserPreferencesStore.setState({ uiScale: scale });
  });
}

afterEach(() => {
  window.localStorage.clear();
  setUiScale(1);
});

describe("useUserPreferencesEffects", () => {
  it("publishes the stored ui scale as the root --ui-scale", () => {
    const { unmount } = renderHook(() => useUserPreferencesEffects());

    // The store default is 100%; index.css multiplies it by the base density.
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "1",
    );

    setUiScale(0.8);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "0.8",
    );

    setUiScale(1.2);
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "1.2",
    );

    unmount();
    expect(document.documentElement.style.getPropertyValue("--ui-scale")).toBe(
      "",
    );
  });
});
