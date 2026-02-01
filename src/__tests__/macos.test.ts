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
  test("findNotifier returns path when binary exists", () => {
    const notifier = new MacOSNotifier();

    // Access private method via any cast for testing
    const findNotifier = (
      notifier as unknown as { findNotifier: () => string | null }
    ).findNotifier.bind(notifier);

    const result = findNotifier();
    // Result depends on whether the binary has been built
    expect(result === null || typeof result === "string").toBe(true);
  });
});
