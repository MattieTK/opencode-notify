import { describe, expect, test } from "bun:test";
import { LinuxNotifier } from "../notify/linux";

describe("LinuxNotifier", () => {
  test("isAvailable returns boolean", async () => {
    const notifier = new LinuxNotifier();
    const result = await notifier.isAvailable();

    // Result depends on platform and available tools
    expect(typeof result).toBe("boolean");
  });
});

describe("LinuxNotifier (unit tests)", () => {
  test("normalises accept action correctly", () => {
    const notifier = new LinuxNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("accept")).toBe("accept");
    expect(normalise("Accept")).toBe("accept");
  });

  test("normalises always action correctly", () => {
    const notifier = new LinuxNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("always")).toBe("always");
    expect(normalise("Always")).toBe("always");
  });

  test("normalises reject action correctly", () => {
    const notifier = new LinuxNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("reject")).toBe("reject");
    expect(normalise("Reject")).toBe("reject");
  });

  test("passes through unknown actions", () => {
    const notifier = new LinuxNotifier();
    const normalise = (notifier as unknown as { normaliseAction: (v: string) => string }).normaliseAction.bind(notifier);

    expect(normalise("custom")).toBe("custom");
  });

  test("buildDbusActions creates correct structure", () => {
    const notifier = new LinuxNotifier();
    const build = (notifier as unknown as { buildDbusActions: (a?: string[]) => Array<{ key: string; label: string }> }).buildDbusActions.bind(notifier);

    expect(build(undefined)).toEqual([]);
    expect(build([])).toEqual([]);

    expect(build(["Accept", "Reject"])).toEqual([
      { key: "accept", label: "Accept" },
      { key: "reject", label: "Reject" },
    ]);
  });
});
