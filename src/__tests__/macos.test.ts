import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { MacOSNotifier } from "../notify/macos";

// Skip these tests on non-macOS platforms
const describeMacOS = process.platform === "darwin" ? describe : describe.skip;

describeMacOS("MacOSNotifier", () => {
  test("isAvailable checks for alerter binary", async () => {
    const notifier = new MacOSNotifier();
    const result = await notifier.isAvailable();

    // Result depends on whether alerter is installed
    expect(typeof result).toBe("boolean");
  });
});

describe("MacOSNotifier (unit tests)", () => {
  test("normalises accept action correctly", () => {
    const notifier = new MacOSNotifier();

    // Access private method via any cast for testing
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("Accept")).toBe("accept");
    expect(normalise("accept")).toBe("accept");
    expect(normalise("@actionclicked")).toBe("accept");
  });

  test("normalises always action correctly", () => {
    const notifier = new MacOSNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("Always")).toBe("always");
    expect(normalise("always")).toBe("always");
  });

  test("normalises reject action correctly", () => {
    const notifier = new MacOSNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("Reject")).toBe("reject");
    expect(normalise("reject")).toBe("reject");
    expect(normalise("@closebutton")).toBe("reject");
  });

  test("normalises dismissed actions correctly", () => {
    const notifier = new MacOSNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("@timeout")).toBe("dismissed");
    expect(normalise("@closed")).toBe("dismissed");
  });

  test("passes through unknown actions", () => {
    const notifier = new MacOSNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("CustomAction")).toBe("CustomAction");
  });
});
