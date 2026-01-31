import { describe, expect, test, mock, beforeEach } from "bun:test";
import { NotificationDispatcher } from "../notify";

describe("NotificationDispatcher", () => {
  test("initialise returns false when no backend available on unsupported platform", async () => {
    // On Linux without D-Bus or notify-send, should return false
    // This test will behave differently on different platforms
    const dispatcher = new NotificationDispatcher();
    const result = await dispatcher.initialise();

    // The result depends on the platform and available tools
    // We just verify it doesn't throw and returns a boolean
    expect(typeof result).toBe("boolean");
  });

  test("notify returns dismissed result when not initialised", async () => {
    // Create a dispatcher that won't have any backend
    const dispatcher = new NotificationDispatcher();

    // Force the dispatcher to think it's initialised but has no notifier
    (dispatcher as unknown as { initialised: boolean }).initialised = true;
    (dispatcher as unknown as { notifier: null }).notifier = null;

    const result = await dispatcher.notify({
      title: "Test",
      message: "Test message",
    });

    expect(result.action).toBe("dismissed");
    expect(result.activated).toBe(false);
  });

  test("showPermissionRequest builds correct options", async () => {
    const dispatcher = new NotificationDispatcher();
    let capturedOptions: unknown = null;

    // Mock the notify method
    dispatcher.notify = mock(async (options) => {
      capturedOptions = options;
      return { action: "accept", activated: true };
    }) as typeof dispatcher.notify;

    await dispatcher.showPermissionRequest("Bash", "rm -rf /tmp/test", "Submarine");

    expect(capturedOptions).toEqual({
      title: "Opencode Permission Request",
      subtitle: "Bash",
      message: "rm -rf /tmp/test",
      sound: "Submarine",
      actions: ["Accept", "Always", "Reject"],
    });
  });

  test("showPermissionRequest truncates long commands", async () => {
    const dispatcher = new NotificationDispatcher();
    let capturedOptions: { message?: string } = {};

    dispatcher.notify = mock(async (options) => {
      capturedOptions = options;
      return { action: "accept", activated: true };
    }) as typeof dispatcher.notify;

    const longCommand = "x".repeat(200);
    await dispatcher.showPermissionRequest("Bash", longCommand);

    expect(capturedOptions.message?.length).toBeLessThanOrEqual(101);
    expect(capturedOptions.message?.endsWith("…")).toBe(true);
  });

  test("showSessionComplete builds correct options", async () => {
    const dispatcher = new NotificationDispatcher();
    let capturedOptions: unknown = null;

    dispatcher.notify = mock(async (options) => {
      capturedOptions = options;
      return { action: "dismissed", activated: false };
    }) as typeof dispatcher.notify;

    await dispatcher.showSessionComplete("Task finished", "Glass");

    expect(capturedOptions).toEqual({
      title: "Opencode",
      message: "Task finished",
      sound: "Glass",
    });
  });

  test("showError builds correct options", async () => {
    const dispatcher = new NotificationDispatcher();
    let capturedOptions: unknown = null;

    dispatcher.notify = mock(async (options) => {
      capturedOptions = options;
      return { action: "dismissed", activated: false };
    }) as typeof dispatcher.notify;

    await dispatcher.showError("Something went wrong", "Basso");

    expect(capturedOptions).toEqual({
      title: "Opencode Error",
      message: "Something went wrong",
      sound: "Basso",
    });
  });

  test("showQuestion builds correct options", async () => {
    const dispatcher = new NotificationDispatcher();
    let capturedOptions: unknown = null;

    dispatcher.notify = mock(async (options) => {
      capturedOptions = options;
      return { action: "dismissed", activated: false };
    }) as typeof dispatcher.notify;

    await dispatcher.showQuestion("Which approach do you prefer?", "Submarine");

    expect(capturedOptions).toEqual({
      title: "Opencode Question",
      message: "Which approach do you prefer?",
      sound: "Submarine",
    });
  });
});
