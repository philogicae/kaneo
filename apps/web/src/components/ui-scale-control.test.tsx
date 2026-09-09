import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiScaleControl } from "@/components/ui-scale-control";
import { useUserPreferencesStore } from "@/store/user-preferences";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function setUiScale(scale: number) {
  act(() => {
    useUserPreferencesStore.setState({ uiScale: scale });
  });
}

const decrease = () =>
  screen.getByTitle("settings:preferencesPage.interfaceSizeDecrease");
const increase = () =>
  screen.getByTitle("settings:preferencesPage.interfaceSizeIncrease");

beforeEach(() => {
  window.localStorage.clear();
  setUiScale(1);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("UiScaleControl", () => {
  it("shows the current scale as a percentage", () => {
    render(<UiScaleControl />);

    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("steps by 5% per click", () => {
    render(<UiScaleControl />);

    fireEvent.click(decrease());
    expect(useUserPreferencesStore.getState().uiScale).toBe(0.95);
    expect(screen.getByText("95%")).toBeTruthy();

    fireEvent.click(increase());
    fireEvent.click(increase());
    expect(useUserPreferencesStore.getState().uiScale).toBe(1.05);
    expect(screen.getByText("105%")).toBeTruthy();
  });

  it("disables each button at its bound", () => {
    setUiScale(0.8);
    render(<UiScaleControl />);

    expect((decrease() as HTMLButtonElement).disabled).toBe(true);
    expect((increase() as HTMLButtonElement).disabled).toBe(false);

    setUiScale(1.25);
    expect((decrease() as HTMLButtonElement).disabled).toBe(false);
    expect((increase() as HTMLButtonElement).disabled).toBe(true);
  });

  it("persists the choice to localStorage", () => {
    render(<UiScaleControl />);

    fireEvent.click(decrease());

    const persisted = JSON.parse(
      window.localStorage.getItem("user-preferences") ?? "{}",
    ) as { state?: { uiScale?: number } };
    expect(persisted.state?.uiScale).toBe(0.95);
  });
});
