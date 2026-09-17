import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const WEEK_START_DAYS = [0, 1, 6] as const;
export type WeekStartDay = (typeof WEEK_START_DAYS)[number];

export function isWeekStartDay(value: number): value is WeekStartDay {
  return WEEK_START_DAYS.some((day) => day === value);
}

export const PROJECT_SORT_MODES = [
  "custom",
  "name",
  "date",
  "completion",
] as const;
export type ProjectSortMode = (typeof PROJECT_SORT_MODES)[number];

export function isProjectSortMode(value: unknown): value is ProjectSortMode {
  return (
    typeof value === "string" &&
    (PROJECT_SORT_MODES as readonly string[]).includes(value)
  );
}

export const WORKSPACE_SORT_MODES = ["custom", "name", "date"] as const;
export type WorkspaceSortMode = (typeof WORKSPACE_SORT_MODES)[number];

export function isWorkspaceSortMode(
  value: unknown,
): value is WorkspaceSortMode {
  return (
    typeof value === "string" &&
    (WORKSPACE_SORT_MODES as readonly string[]).includes(value)
  );
}

export const CHART_RANGE_OPTIONS = [
  "1w",
  "1m",
  "3m",
  "6m",
  "12m",
  "all",
] as const;
export type ChartRange = (typeof CHART_RANGE_OPTIONS)[number];

export function isChartRange(value: unknown): value is ChartRange {
  return (
    typeof value === "string" &&
    (CHART_RANGE_OPTIONS as readonly string[]).includes(value)
  );
}

export const CHART_UNIT_OPTIONS = ["hour", "day", "week", "month"] as const;
export type ChartUnit = (typeof CHART_UNIT_OPTIONS)[number];

export function isChartUnit(value: unknown): value is ChartUnit {
  return (
    typeof value === "string" &&
    (CHART_UNIT_OPTIONS as readonly string[]).includes(value)
  );
}

// Mirror of the API's ALLOWED_UNITS: the dashboard disables units the server
// rejects, and falls back to the daily default when the window changes.
export const CHART_UNITS_BY_RANGE: Record<ChartRange, readonly ChartUnit[]> = {
  "1w": ["hour", "day", "week"],
  "1m": ["day", "week"],
  "3m": ["day", "week", "month"],
  "6m": ["day", "week", "month"],
  "12m": ["day", "week", "month"],
  all: ["week", "month"],
};

// The product default is daily buckets; "all" has no daily reading, so it
// falls back to weekly ones.
export function defaultChartUnit(range: ChartRange): ChartUnit {
  return CHART_UNITS_BY_RANGE[range].includes("day") ? "day" : "week";
}

// Interface density as root font-size multiplier: every rem-based Tailwind
// size (text, spacing, sidebar width) follows the root font size. The
// stepper moves in 5% steps within these bounds.
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.25;
export const UI_SCALE_STEP = 0.05;

export function isUiScale(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= UI_SCALE_MIN &&
    value <= UI_SCALE_MAX
  );
}

// Snap to the 5% grid (and to whole percents) so repeated steps and stored
// values never accumulate float drift.
export function clampUiScale(value: number): number {
  const snapped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  const clamped = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, snapped));
  return Math.round(clamped * 100) / 100;
}

type UserPreferencesStore = {
  theme: "light" | "dark" | "volt" | "system";
  setTheme: (
    theme: "light" | "dark" | "volt" | "system",
    coordinates?: { x: number; y: number },
  ) => void;

  viewMode: "board" | "list";
  setViewMode: (mode: "board" | "list") => void;

  uiScale: number;
  setUiScale: (scale: number) => void;

  showTaskNumbers: boolean;
  setShowTaskNumbers: (show: boolean) => void;
  toggleTaskNumbers: () => void;
  showAssignees: boolean;
  setShowAssignees: (show: boolean) => void;
  toggleAssignees: () => void;
  showDueDates: boolean;
  setShowDueDates: (show: boolean) => void;
  toggleDueDates: () => void;
  showLabels: boolean;
  setShowLabels: (show: boolean) => void;
  toggleLabels: () => void;
  showPriority: boolean;
  setShowPriority: (show: boolean) => void;
  togglePriority: () => void;
  showTaskItemCounts: boolean;
  setShowTaskItemCounts: (show: boolean) => void;
  toggleTaskItemCounts: () => void;
  resetDisplayPreferences: () => void;

  sidebarDefaultOpen: boolean;
  setSidebarDefaultOpen: (open: boolean) => void;

  weekStartsOn: WeekStartDay;
  setWeekStartsOn: (weekStartsOn: WeekStartDay) => void;

  projectsSort: ProjectSortMode;
  setProjectsSort: (mode: ProjectSortMode) => void;

  workspaceSort: WorkspaceSortMode;
  setWorkspaceSort: (mode: WorkspaceSortMode) => void;
  workspaceOrder: string[];
  setWorkspaceOrder: (ids: string[]) => void;

  chartsRange: ChartRange;
  setChartsRange: (range: ChartRange) => void;
  chartsUnit: ChartUnit;
  setChartsUnit: (unit: ChartUnit) => void;
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (
        theme: "light" | "dark" | "volt" | "system",
        coordinates?: { x: number; y: number },
      ) => {
        if (coordinates) {
          document.documentElement.style.setProperty(
            "--x",
            `${coordinates.x}%`,
          );
          document.documentElement.style.setProperty(
            "--y",
            `${coordinates.y}%`,
          );
        } else {
          document.documentElement.style.removeProperty("--x");
          document.documentElement.style.removeProperty("--y");
        }

        if ("startViewTransition" in document) {
          document.startViewTransition(() => {
            set({ theme });
          });
        } else {
          set({ theme });
        }
      },

      viewMode: "board",
      setViewMode: (mode) => set({ viewMode: mode }),

      uiScale: 1,
      setUiScale: (uiScale) => set({ uiScale: clampUiScale(uiScale) }),

      showTaskNumbers: true,
      setShowTaskNumbers: (show) => set({ showTaskNumbers: show }),
      toggleTaskNumbers: () =>
        set((state) => ({ showTaskNumbers: !state.showTaskNumbers })),
      showAssignees: true,
      setShowAssignees: (show) => set({ showAssignees: show }),
      toggleAssignees: () =>
        set((state) => ({ showAssignees: !state.showAssignees })),
      showDueDates: true,
      setShowDueDates: (show) => set({ showDueDates: show }),
      toggleDueDates: () =>
        set((state) => ({ showDueDates: !state.showDueDates })),
      showLabels: true,
      setShowLabels: (show) => set({ showLabels: show }),
      toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
      showPriority: true,
      setShowPriority: (show) => set({ showPriority: show }),
      togglePriority: () =>
        set((state) => ({ showPriority: !state.showPriority })),
      showTaskItemCounts: true,
      setShowTaskItemCounts: (show) => set({ showTaskItemCounts: show }),
      toggleTaskItemCounts: () =>
        set((state) => ({ showTaskItemCounts: !state.showTaskItemCounts })),
      resetDisplayPreferences: () =>
        set({
          showAssignees: true,
          showDueDates: true,
          showLabels: true,
          showTaskNumbers: true,
          showPriority: true,
          showTaskItemCounts: true,
        }),

      sidebarDefaultOpen: true,
      setSidebarDefaultOpen: (open) => set({ sidebarDefaultOpen: open }),

      weekStartsOn: 0,
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),

      // Alphabetical by default; the stored custom order only applies once
      // the user explicitly picks it.
      projectsSort: "name",
      setProjectsSort: (mode) => set({ projectsSort: mode }),

      workspaceSort: "name",
      setWorkspaceSort: (mode) => set({ workspaceSort: mode }),
      workspaceOrder: [],
      setWorkspaceOrder: (ids) => set({ workspaceOrder: ids }),

      // Default reading: the last month, bucketed by day. The window can be
      // narrowed to a week or widened to all history.
      chartsRange: "1m",
      setChartsRange: (range) => set({ chartsRange: range }),
      // Daily buckets by default (weekly for "all"); the unit selector refines
      // them down to the hour or coarsens them up to the month.
      chartsUnit: "day",
      setChartsUnit: (unit) => set({ chartsUnit: unit }),
    }),
    {
      name: "user-preferences",
      storage: createJSONStorage(() => localStorage),
      // The current default window is 1 month; sessions persisted while 6
      // months, then 3 months, were the defaults still hold one of those. Move
      // them once so the new default shows, while a window deliberately picked
      // after the migration is never overridden.
      version: 1,
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<UserPreferencesStore>;
        if (
          version < 1 &&
          (state.chartsRange === "3m" || state.chartsRange === "6m")
        ) {
          state.chartsRange = "1m";
        }
        return state as UserPreferencesStore;
      },
      onRehydrateStorage: () => (state) => {
        if (state && !isWeekStartDay(state.weekStartsOn)) {
          state.setWeekStartsOn(0);
        }
        if (state && !isProjectSortMode(state.projectsSort)) {
          state.setProjectsSort("name");
        }
        if (state && !isWorkspaceSortMode(state.workspaceSort)) {
          state.setWorkspaceSort("name");
        }
        if (state && !isUiScale(state.uiScale)) {
          state.setUiScale(1);
        }
        if (state && !Array.isArray(state.workspaceOrder)) {
          state.setWorkspaceOrder([]);
        }
        if (state) {
          const range = isChartRange(state.chartsRange)
            ? state.chartsRange
            : "1m";
          if (range !== state.chartsRange) {
            state.setChartsRange(range);
          }
          if (
            !isChartUnit(state.chartsUnit) ||
            !CHART_UNITS_BY_RANGE[range].includes(state.chartsUnit)
          ) {
            state.setChartsUnit(defaultChartUnit(range));
          }
        }
      },
    },
  ),
);
