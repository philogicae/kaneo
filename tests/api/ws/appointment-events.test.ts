import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Every broadcast re-checks the project's workspace and the recipients'
// membership before sending, so the database is stubbed to answer both reads.
// Drizzle awaits its query builders, so the stub is a promise that also carries
// the chainable methods: awaiting it yields the rows for whichever read was
// built. The project read chains `.limit(1)`; the member read does not.
vi.mock("../../../apps/api/src/database", () => {
  const rows = (single: boolean) =>
    single
      ? [{ workspaceId: "ws-1" }]
      : [{ userId: "user-1" }, { userId: "user-2" }];

  return {
    default: {
      select: () => {
        let single = false;
        // A pending promise is already awaitable, so the builder only has to
        // expose the chainable methods on it.
        const pending = new Promise<unknown[]>((resolve) => {
          queueMicrotask(() => resolve(rows(single)));
        });
        return Object.assign(pending, {
          from: () => pending,
          where: () => pending,
          limit: () => {
            single = true;
            return pending;
          },
        });
      },
    },
  };
});

import { eventContext, publishEvent } from "../../../apps/api/src/events";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";

function makeFakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    url: null,
    protocol: null,
  } as never;
}

describe("appointment event broadcasts", () => {
  beforeEach(async () => {
    // Ensure no REDIS_URL so InMemoryBroadcastAdapter is used
    delete process.env.REDIS_URL;
    await initializeWebSocketAdapter();
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it.each([
    ["appointment.created", "APPOINTMENT_CREATED"],
    ["appointment.updated", "APPOINTMENT_UPDATED"],
    ["appointment.deleted", "APPOINTMENT_DELETED"],
  ])("maps %s to a %s project message", async (eventName, expectedType) => {
    const ws = makeFakeWs();
    const conn = addConnection("proj-1", ws, "user-1", "init-1", "ws-1");

    await publishEvent(eventName, {
      appointmentId: "a1",
      projectId: "proj-1",
    });

    await vi.waitFor(
      () => {
        expect(
          (ws as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    const sent = JSON.parse(
      (ws as { send: ReturnType<typeof vi.fn> }).send.mock.calls[0][0],
    );
    expect(sent).toMatchObject({
      type: expectedType,
      projectId: "proj-1",
      appointmentId: "a1",
    });

    removeConnection("proj-1", conn);
  });

  it("excludes the initiating window from appointment broadcasts", async () => {
    const ws1 = makeFakeWs();
    const ws2 = makeFakeWs();
    const conn1 = addConnection(
      "proj-1",
      ws1,
      "user-1",
      "init-excluded",
      "ws-1",
    );
    const conn2 = addConnection("proj-1", ws2, "user-2", "init-other", "ws-1");

    await eventContext.run({ initiatorId: "init-excluded" }, async () => {
      await publishEvent("appointment.created", {
        appointmentId: "a1",
        projectId: "proj-1",
      });
    });

    await vi.waitFor(
      () => {
        expect(
          (ws2 as { send: ReturnType<typeof vi.fn> }).send,
        ).toHaveBeenCalled();
      },
      { timeout: 300 },
    );

    expect(
      (ws1 as { send: ReturnType<typeof vi.fn> }).send,
    ).not.toHaveBeenCalled();

    removeConnection("proj-1", conn1);
    removeConnection("proj-1", conn2);
  });
});
