import { describe, expect, test } from "bun:test";
import { WindowsNotifier } from "../notify/windows";

describe("WindowsNotifier", () => {
  test("isAvailable returns false on non-Windows platforms", async () => {
    const notifier = new WindowsNotifier();
    const result = await notifier.isAvailable();

    if (process.platform !== "win32") {
      expect(result).toBe(false);
    } else {
      expect(typeof result).toBe("boolean");
    }
  });
});

describe("WindowsNotifier (unit tests)", () => {
  test("normalises accept action correctly", () => {
    const notifier = new WindowsNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("accept")).toBe("accept");
    expect(normalise("Accept")).toBe("accept");
  });

  test("normalises always action correctly", () => {
    const notifier = new WindowsNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("always")).toBe("always");
    expect(normalise("Always")).toBe("always");
  });

  test("normalises reject action correctly", () => {
    const notifier = new WindowsNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("reject")).toBe("reject");
    expect(normalise("Reject")).toBe("reject");
  });

  test("passes through unknown actions", () => {
    const notifier = new WindowsNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("custom")).toBe("custom");
  });

  test("buildToastActions creates correct structure", () => {
    const notifier = new WindowsNotifier();
    const build = (notifier as unknown as { buildToastActions: (a?: string[]) => Array<{ content: string; arguments: string }> | undefined }).buildToastActions.bind(notifier);

    expect(build(undefined)).toBeUndefined();
    expect(build([])).toBeUndefined();

    expect(build(["Accept", "Reject"])).toEqual([
      { content: "Accept", arguments: "accept" },
      { content: "Reject", arguments: "reject" },
    ]);
  });

  test("mapSoundToWindows maps macOS sounds", () => {
    const notifier = new WindowsNotifier();
    const map = (notifier as unknown as { mapSoundToWindows: (s?: string) => string }).mapSoundToWindows.bind(notifier);

    expect(map("Submarine")).toBe("ms-winsoundevent:Notification.Default");
    expect(map("Glass")).toBe("ms-winsoundevent:Notification.IM");
    expect(map("Basso")).toBe("ms-winsoundevent:Notification.Reminder");
    expect(map("Ping")).toBe("ms-winsoundevent:Notification.Mail");
    expect(map("Pop")).toBe("ms-winsoundevent:Notification.SMS");
  });

  test("mapSoundToWindows returns default for unknown sounds", () => {
    const notifier = new WindowsNotifier();
    const map = (notifier as unknown as { mapSoundToWindows: (s?: string) => string }).mapSoundToWindows.bind(notifier);

    expect(map("UnknownSound")).toBe("ms-winsoundevent:Notification.Default");
    expect(map(undefined)).toBe("ms-winsoundevent:Notification.Default");
  });
});
