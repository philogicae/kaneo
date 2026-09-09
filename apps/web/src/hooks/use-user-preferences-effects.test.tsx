import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
  it("scales the root font size to the stored ui scale", () => {
    const { unmount } = renderHook(() => useUserPreferencesEffects());

    // The store default is 100%.
    expect(document.documentElement.style.fontSize).toBe("100%");

    setUiScale(0.8);
    expect(document.documentElement.style.fontSize).toBe("80%");

    setUiScale(0.8);
    expect(document.documentElement.style.fontSize).toBe("80%");

    setUiScale(1.2);
    expect(document.documentElement.style.fontSize).toBe("120%");

    unmount();
    expect(document.documentElement.style.fontSize).toBe("");
  });
});
