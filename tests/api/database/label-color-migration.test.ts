import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockLog = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (...args: unknown[]) => mockSelect(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

import { migrateLabelColors } from "../../../apps/api/src/migrations/label-color-migration";

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function makeUpdateMock() {
  const set = vi.fn(() => ({
    where: vi.fn(() => Promise.resolve(undefined)),
  }));
  mockUpdate.mockImplementation(() => ({ set }));
  return { set };
}

describe("migrateLabelColors", () => {
  beforeEach(() => {
    mockSelect.mockReset();
    mockUpdate.mockReset();
    mockLog.mockReset();
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      mockLog(...args);
    });
  });

  it("syncs every drifted task-level copy to its definition color", async () => {
    mockSelect.mockImplementationOnce(() =>
      makeSelectMock([
        { id: "copy-1", canonicalColor: "teal" },
        { id: "copy-2", canonicalColor: "purple" },
      ]),
    );
    const update = makeUpdateMock();

    await migrateLabelColors();

    expect(update.set).toHaveBeenCalledWith({ color: "teal" });
    expect(update.set).toHaveBeenCalledWith({ color: "purple" });
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining("synced 2 task-level label copies"),
    );
  });

  it("writes nothing when no copy drifted", async () => {
    mockSelect.mockImplementationOnce(() => makeSelectMock([]));

    await migrateLabelColors();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });
});
