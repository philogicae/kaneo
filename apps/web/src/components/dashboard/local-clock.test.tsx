import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { LocalClock } from "./local-clock";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en-US", language: "en-US" },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T15:30:00.000Z"));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LocalClock", () => {
  it("shows the browser time and advances every second", () => {
    render(<LocalClock />);

    expect(screen.getByText("unified:clock.localTime")).toBeInTheDocument();
    expect(screen.queryByText(/AM|PM/)).toBeNull();
    const first = screen.getByText(/\d{1,2}:\d{2}:\d{2}/).textContent;

    act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/).textContent).not.toBe(first);
  });
});
