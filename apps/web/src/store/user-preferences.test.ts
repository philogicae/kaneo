import { afterEach, describe, expect, it } from "vitest";
import { useUserPreferencesStore } from "@/store/user-preferences";

const STORAGE_KEY = "user-preferences";

afterEach(() => {
  window.localStorage.clear();
  useUserPreferencesStore.setState({ chartsRange: "1m", chartsUnit: "day" });
});

describe("chart preferences", () => {
  it("defaults to the last month read in days", () => {
    const { chartsRange, chartsUnit } =
      useUserPreferencesStore.getInitialState();

    expect(chartsRange).toBe("1m");
    expect(chartsUnit).toBe("day");
  });

  it("carries a legacy default window onto the 1-month default once", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { chartsRange: "3m" }, version: 0 }),
    );
    await useUserPreferencesStore.persist.rehydrate();

    expect(useUserPreferencesStore.getState().chartsRange).toBe("1m");
  });

  it("keeps a window chosen after the migration", async () => {
    useUserPreferencesStore.getState().setChartsRange("3m");
    await useUserPreferencesStore.persist.rehydrate();

    expect(useUserPreferencesStore.getState().chartsRange).toBe("3m");
  });
});
