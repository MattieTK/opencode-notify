import { describe, expect, test, mock } from "bun:test";
import opencodeNotifyPlugin from "../index";

describe("opencodeNotifyPlugin", () => {
  test("registers event handlers on context", () => {
    const handlers: Record<string, (data: unknown) => void> = {};

    const mockContext = {
      on: mock((event: string, handler: (data: unknown) => void) => {
        handlers[event] = handler;
      }),
      getApiBaseUrl: () => "http://localhost:3000",
    };

    opencodeNotifyPlugin(mockContext);

    // Verify all expected events are registered
    expect(mockContext.on).toHaveBeenCalledTimes(4);

    const registeredEvents = mockContext.on.mock.calls.map((call) => call[0]);
    expect(registeredEvents).toContain("permission.updated");
    expect(registeredEvents).toContain("session.idle");
    expect(registeredEvents).toContain("session.error");
    expect(registeredEvents).toContain("tool.execute.before");
  });

  test("works without getApiBaseUrl method", () => {
    const mockContext = {
      on: mock(() => {}),
    };

    // Should not throw
    expect(() => opencodeNotifyPlugin(mockContext)).not.toThrow();
  });

  test("tool.execute.before handler ignores non-question tools", async () => {
    let toolHandler: ((data: unknown) => void) | null = null;

    const mockContext = {
      on: mock((event: string, handler: (data: unknown) => void) => {
        if (event === "tool.execute.before") {
          toolHandler = handler;
        }
      }),
    };

    opencodeNotifyPlugin(mockContext);

    // Call the handler with a non-question tool
    // Should not throw or do anything observable
    expect(() => {
      toolHandler?.({ tool: "Bash", args: {} });
    }).not.toThrow();
  });
});

describe("shouldSuppress helper", () => {
  // Test indirectly through plugin behavior
  test("child sessions are suppressed by default", () => {
    const handlers: Record<string, (data: unknown) => void> = {};

    const mockContext = {
      on: mock((event: string, handler: (data: unknown) => void) => {
        handlers[event] = handler;
      }),
    };

    opencodeNotifyPlugin(mockContext);

    // Verify session.idle handler was registered
    expect(handlers["session.idle"]).toBeDefined();

    // Call with child session - should not throw
    // (notification would be suppressed due to isChildSession: true)
    expect(() => {
      handlers["session.idle"]({ message: "Done", isChildSession: true });
    }).not.toThrow();
  });
});
