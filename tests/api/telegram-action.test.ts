import { describe, expect, it } from "vitest";
import { buildTelegramAction } from "../../apps/api/src/plugins/telegram/events";

describe("buildTelegramAction", () => {
  it("describes task creation", () => {
    expect(buildTelegramAction({ kind: "created" })).toBe("Task created");
  });

  it("describes a status transition", () => {
    expect(
      buildTelegramAction({
        kind: "statusChanged",
        oldStatus: "to-do",
        newStatus: "in-progress",
      }),
    ).toBe("To Do → In Progress");
  });

  it("falls back when the old status is missing (bulk updates)", () => {
    expect(
      buildTelegramAction({
        kind: "statusChanged",
        oldStatus: null,
        newStatus: "done",
      }),
    ).toBe("Status → Done");
  });

  it("falls back when the old priority is missing", () => {
    expect(
      buildTelegramAction({
        kind: "priorityChanged",
        oldPriority: null,
        newPriority: "high",
      }),
    ).toBe("Priority → High");
  });

  it("truncates long titles in a rename", () => {
    const longTitle = "a".repeat(100);
    const action = buildTelegramAction({
      kind: "titleChanged",
      oldTitle: "old",
      newTitle: longTitle,
    });
    expect(action.startsWith('Title: "old" → "')).toBe(true);
    expect(action.length).toBeLessThan(120);
    expect(action.endsWith('…"')).toBe(true);
  });

  it("summarizes description updates and clears", () => {
    expect(
      buildTelegramAction({
        kind: "descriptionChanged",
        newDescription: null,
      }),
    ).toBe("Description updated");
    expect(
      buildTelegramAction({
        kind: "descriptionChanged",
        newDescription: "Line one\nLine two",
      }),
    ).toBe("Description: Line one Line two");
  });

  it("strips the comment markdown prefix and keeps the content", () => {
    expect(
      buildTelegramAction({
        kind: "commentCreated",
        comment: "**Arnaud** commented:\n> Looks good to me",
      }),
    ).toBe("Comment: Looks good to me");
  });

  it("keeps a comment that does not match the prefix format", () => {
    expect(
      buildTelegramAction({
        kind: "commentCreated",
        comment: "plain text",
      }),
    ).toBe("Comment: plain text");
  });
});
