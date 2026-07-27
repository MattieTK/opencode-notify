import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { detectTerminal } from "../terminal";

describe("detectTerminal", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.KITTY_WINDOW_ID;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  test("returns configured terminal when provided", () => {
    const result = detectTerminal("ghostty");
    expect(result.app).toBe("ghostty");
    expect(result.bundleId).toBe("com.mitchellh.ghostty");
    expect(result.processName).toBe("ghostty");
  });

  test("detects ghostty from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "ghostty";
    const result = detectTerminal(null);
    expect(result.app).toBe("ghostty");
  });

  test("detects ghostty from LC_TERMINAL", () => {
    delete process.env.TERM_PROGRAM;
    process.env.LC_TERMINAL = "ghostty";
    const result = detectTerminal(null);
    expect(result.app).toBe("ghostty");
  });

  test("detects iTerm from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "iTerm.app";
    const result = detectTerminal(null);
    expect(result.app).toBe("iterm");
    expect(result.bundleId).toBe("com.googlecode.iterm2");
  });

  test("detects WezTerm from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "WezTerm";
    const result = detectTerminal(null);
    expect(result.app).toBe("wezterm");
  });

  test("detects Apple Terminal from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "Apple_Terminal";
    const result = detectTerminal(null);
    expect(result.app).toBe("terminal");
    expect(result.bundleId).toBe("com.apple.Terminal");
  });

  test("detects Kitty from KITTY_WINDOW_ID", () => {
    delete process.env.TERM_PROGRAM;
    process.env.KITTY_WINDOW_ID = "1";
    const result = detectTerminal(null);
    expect(result.app).toBe("kitty");
  });

  test("detects Alacritty from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "Alacritty";
    const result = detectTerminal(null);
    expect(result.app).toBe("alacritty");
  });

  test("detects Hyper from TERM_PROGRAM", () => {
    process.env.TERM_PROGRAM = "Hyper";
    const result = detectTerminal(null);
    expect(result.app).toBe("hyper");
  });

  test("detects Windows Terminal from WT_SESSION", () => {
    delete process.env.TERM_PROGRAM;
    process.env.WT_SESSION = "some-session-id";
    const result = detectTerminal(null);
    expect(result.app).toBe("windows-terminal");
  });

  test("returns unknown when no terminal detected", () => {
    delete process.env.TERM_PROGRAM;
    delete process.env.LC_TERMINAL;
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.WT_SESSION;
    const result = detectTerminal(null);
    expect(result.app).toBe("unknown");
  });

  test("handles case-insensitive terminal names in config", () => {
    const result = detectTerminal("ITERM2");
    expect(result.app).toBe("iterm");
  });

  test("returns correct bundle IDs for known terminals", () => {
    const terminals = [
      { name: "ghostty", bundleId: "com.mitchellh.ghostty" },
      { name: "kitty", bundleId: "net.kovidgoyal.kitty" },
      { name: "iterm", bundleId: "com.googlecode.iterm2" },
      { name: "wezterm", bundleId: "com.github.wez.wezterm" },
      { name: "terminal", bundleId: "com.apple.Terminal" },
      { name: "alacritty", bundleId: "org.alacritty" },
      { name: "hyper", bundleId: "co.zeit.hyper" },
    ];

    for (const { name, bundleId } of terminals) {
      const result = detectTerminal(name);
      expect(result.bundleId).toBe(bundleId);
    }
  });
});
