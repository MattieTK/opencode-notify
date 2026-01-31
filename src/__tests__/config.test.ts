import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { isQuietHours, type Config } from "../config";

describe("isQuietHours", () => {
  const baseConfig: Config = {
    sounds: { permission: "Submarine", complete: "Glass", error: "Basso" },
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    notifyChildSessions: false,
    terminal: null,
  };

  test("returns false when quiet hours disabled", () => {
    const config = { ...baseConfig, quietHours: { enabled: false, start: "22:00", end: "08:00" } };
    expect(isQuietHours(config)).toBe(false);
  });

  test("returns true during overnight quiet hours (before midnight)", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    // Mock Date to 23:00
    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 23, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(true);

    global.Date = realDate;
  });

  test("returns true during overnight quiet hours (after midnight)", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 3, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(true);

    global.Date = realDate;
  });

  test("returns false outside overnight quiet hours", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 12, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(false);

    global.Date = realDate;
  });

  test("handles same-day quiet hours", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "09:00", end: "17:00" } };

    const realDate = Date;

    // 10:00 - should be in quiet hours
    let mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 10, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;
    expect(isQuietHours(config)).toBe(true);

    // 18:00 - should be outside quiet hours
    mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 18, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;
    expect(isQuietHours(config)).toBe(false);

    global.Date = realDate;
  });

  test("handles edge case at start time", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 22, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(true);

    global.Date = realDate;
  });

  test("handles edge case just before end time", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 7, 59, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(true);

    global.Date = realDate;
  });

  test("handles edge case at end time (should be outside)", () => {
    const config = { ...baseConfig, quietHours: { enabled: true, start: "22:00", end: "08:00" } };

    const realDate = Date;
    const mockDate = class extends realDate {
      constructor() {
        super();
        return new realDate(2024, 0, 15, 8, 0, 0);
      }
    };
    global.Date = mockDate as DateConstructor;

    expect(isQuietHours(config)).toBe(false);

    global.Date = realDate;
  });
});
