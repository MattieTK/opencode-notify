import { describe, expect, test } from "bun:test";
import opencodeNotifyPlugin from "../index";
import type { PluginInput } from "@opencode-ai/plugin";

// Minimal mock for PluginInput
function createMockInput(overrides?: Partial<PluginInput>): PluginInput {
  return {
    client: {} as PluginInput["client"],
    project: {} as PluginInput["project"],
    directory: "/test",
    worktree: "/test",
    serverUrl: new URL("http://localhost:3000"),
    $: {} as PluginInput["$"],
    ...overrides,
  };
}

describe("opencodeNotifyPlugin", () => {
  test("returns hooks object with event handler and permission.ask hook", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    expect(hooks).toBeDefined();
    expect(typeof hooks.event).toBe("function");
    expect(typeof hooks["tool.execute.before"]).toBe("function");
    expect(typeof hooks["permission.ask"]).toBe("function");
  });

  test("permission.ask hook processes permission requests", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    const permissionInput = {
      id: "test-id",
      type: "Bash",
      pattern: "run command",
      sessionID: "session-1",
      messageID: "msg-1",
      title: "Run command",
      metadata: {},
      time: { created: Date.now() },
    };

    const output = { status: "ask" as "ask" | "deny" | "allow" };

    // Should not throw when processing permission request
    await expect(
      hooks["permission.ask"]?.(permissionInput, output)
    ).resolves.toBeUndefined();
  });

  test("event handler processes permission.updated events", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    // Should not throw when processing permission event
    await expect(
      hooks.event?.({
        event: {
          type: "permission.updated",
          properties: {
            id: "test-id",
            type: "Bash",
            title: "Run command",
            sessionID: "session-1",
            messageID: "msg-1",
            metadata: {},
            time: { created: Date.now() },
          },
        },
      })
    ).resolves.toBeUndefined();
  });

  test("event handler processes session.idle events", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    await expect(
      hooks.event?.({
        event: {
          type: "session.idle",
          properties: {
            sessionID: "session-1",
          },
        },
      })
    ).resolves.toBeUndefined();
  });

  test("event handler processes session.error events", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    await expect(
      hooks.event?.({
        event: {
          type: "session.error",
          properties: {
            sessionID: "session-1",
            error: {
              name: "UnknownError" as const,
              data: { message: "Something went wrong" },
            },
          },
        },
      })
    ).resolves.toBeUndefined();
  });

  test("tool.execute.before hook ignores non-question tools", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    // Should not throw when processing non-question tool
    await expect(
      hooks["tool.execute.before"]?.(
        { tool: "Bash", sessionID: "session-1", callID: "call-1" },
        { args: {} }
      )
    ).resolves.toBeUndefined();
  });

  test("tool.execute.before hook processes AskUserQuestion", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    await expect(
      hooks["tool.execute.before"]?.(
        { tool: "AskUserQuestion", sessionID: "session-1", callID: "call-1" },
        { args: { question: "What should I do?" } }
      )
    ).resolves.toBeUndefined();
  });

  test("event handler detects AskUserQuestion in message.updated", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    // Minimal mock event - actual structure has more fields but we only need these for the test
    const mockEvent = {
      type: "message.updated",
      properties: {
        info: {
          id: "msg-1",
          role: "assistant",
          sessionID: "session-1",
          time: { created: Date.now() },
          parts: [
            {
              id: "part-1",
              type: "tool",
              tool: "AskUserQuestion",
              state: { status: "pending" },
              input: {
                questions: [{ question: "What should I do?" }],
              },
            },
          ],
        },
      },
    };

    await expect(
      hooks.event?.({ event: mockEvent as unknown as Parameters<NonNullable<typeof hooks.event>>[0]["event"] })
    ).resolves.toBeUndefined();
  });
});

describe("event type filtering", () => {
  test("ignores unhandled event types", async () => {
    const input = createMockInput();
    const hooks = await opencodeNotifyPlugin(input);

    // Should not throw for unhandled event types
    await expect(
      hooks.event?.({
        event: {
          type: "session.created",
          properties: {
            info: {
              id: "session-1",
              projectID: "proj-1",
              directory: "/test",
              title: "Test",
              version: "1",
              time: { created: Date.now(), updated: Date.now() },
            },
          },
        },
      })
    ).resolves.toBeUndefined();
  });
});
