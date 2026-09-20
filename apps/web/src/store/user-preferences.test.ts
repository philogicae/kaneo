import { afterEach, describe, expect, it } from "vitest";
import {
  CHART_RANGE_OPTIONS,
  CHART_UNITS_BY_RANGE,
  rangeSupportingUnit,
  useUserPreferencesStore,
} from "@/store/user-preferences";

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

  it("keeps a legacy finer unit by widening the window to carry it", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { chartsRange: "all", chartsUnit: "day" },
        version: 1,
      }),
    );
    await useUserPreferencesStore.persist.rehydrate();

    expect(useUserPreferencesStore.getState().chartsRange).toBe("12m");
    expect(useUserPreferencesStore.getState().chartsUnit).toBe("day");
  });
});

describe("rangeSupportingUnit", () => {
  it("leaves a window that already carries the unit untouched", () => {
    expect(rangeSupportingUnit("1m", "day")).toBe("1m");
    expect(rangeSupportingUnit("12m", "month")).toBe("12m");
    expect(rangeSupportingUnit("all", "week")).toBe("all");
  });

  it("moves finer units to the longest window that supports them", () => {
    expect(rangeSupportingUnit("all", "day")).toBe("12m");
    expect(rangeSupportingUnit("all", "hour")).toBe("1w");
    expect(rangeSupportingUnit("1w", "month")).toBe("all");
  });

  it("returns a window from the allowed list for every unit", () => {
    for (const range of CHART_RANGE_OPTIONS) {
      for (const unit of ["hour", "day", "week", "month"] as const) {
        const supported = rangeSupportingUnit(range, unit);
        expect(CHART_UNITS_BY_RANGE[supported]).toContain(unit);
      }
    }
  });
});
