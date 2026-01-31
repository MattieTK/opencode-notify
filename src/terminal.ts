import { execSync } from "node:child_process";

type TerminalApp =
  | "ghostty"
  | "kitty"
  | "iterm"
  | "wezterm"
  | "terminal"
  | "alacritty"
  | "hyper"
  | "windows-terminal"
  | "unknown";

interface TerminalInfo {
  app: TerminalApp;
  bundleId?: string;
  processName?: string;
}

/**
 * Detect which terminal emulator is running.
 * Checks TERM_PROGRAM and other environment variables.
 */
export function detectTerminal(
  configuredTerminal: string | null
): TerminalInfo {
  if (configuredTerminal) {
    return terminalInfoFromName(configuredTerminal);
  }

  const termProgram = process.env.TERM_PROGRAM?.toLowerCase();
  const lcTerminal = process.env.LC_TERMINAL?.toLowerCase();

  if (termProgram === "ghostty" || lcTerminal === "ghostty") {
    return {
      app: "ghostty",
      bundleId: "com.mitchellh.ghostty",
      processName: "ghostty",
    };
  }

  if (termProgram === "iterm.app") {
    return {
      app: "iterm",
      bundleId: "com.googlecode.iterm2",
      processName: "iTerm2",
    };
  }

  if (termProgram === "wezterm") {
    return {
      app: "wezterm",
      bundleId: "com.github.wez.wezterm",
      processName: "wezterm-gui",
    };
  }

  if (termProgram === "apple_terminal") {
    return {
      app: "terminal",
      bundleId: "com.apple.Terminal",
      processName: "Terminal",
    };
  }

  if (process.env.KITTY_WINDOW_ID) {
    return {
      app: "kitty",
      bundleId: "net.kovidgoyal.kitty",
      processName: "kitty",
    };
  }

  if (termProgram === "alacritty") {
    return {
      app: "alacritty",
      bundleId: "org.alacritty",
      processName: "Alacritty",
    };
  }

  if (termProgram === "hyper") {
    return {
      app: "hyper",
      bundleId: "co.zeit.hyper",
      processName: "Hyper",
    };
  }

  if (process.env.WT_SESSION) {
    return {
      app: "windows-terminal",
      processName: "WindowsTerminal",
    };
  }

  return { app: "unknown" };
}

function terminalInfoFromName(name: string): TerminalInfo {
  const lowered = name.toLowerCase();

  const terminals: Record<string, TerminalInfo> = {
    ghostty: {
      app: "ghostty",
      bundleId: "com.mitchellh.ghostty",
      processName: "ghostty",
    },
    kitty: {
      app: "kitty",
      bundleId: "net.kovidgoyal.kitty",
      processName: "kitty",
    },
    iterm: {
      app: "iterm",
      bundleId: "com.googlecode.iterm2",
      processName: "iTerm2",
    },
    iterm2: {
      app: "iterm",
      bundleId: "com.googlecode.iterm2",
      processName: "iTerm2",
    },
    wezterm: {
      app: "wezterm",
      bundleId: "com.github.wez.wezterm",
      processName: "wezterm-gui",
    },
    terminal: {
      app: "terminal",
      bundleId: "com.apple.Terminal",
      processName: "Terminal",
    },
    alacritty: {
      app: "alacritty",
      bundleId: "org.alacritty",
      processName: "Alacritty",
    },
    hyper: { app: "hyper", bundleId: "co.zeit.hyper", processName: "Hyper" },
  };

  return terminals[lowered] ?? { app: "unknown" };
}

/**
 * Check if the terminal window is currently focused.
 * Used to suppress notifications when user is already looking at the terminal.
 */
export function isTerminalFocused(terminal: TerminalInfo): boolean {
  const platform = process.platform;

  if (platform === "darwin") {
    return isMacOSAppFocused(terminal.bundleId ?? terminal.processName);
  }

  if (platform === "linux") {
    return isLinuxAppFocused(terminal.processName);
  }

  if (platform === "win32") {
    return isWindowsAppFocused(terminal.processName);
  }

  return false;
}

function isMacOSAppFocused(bundleIdOrName?: string): boolean {
  if (!bundleIdOrName) return false;

  try {
    const script = `
      tell application "System Events"
        set frontApp to name of first application process whose frontmost is true
        return frontApp
      end tell
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();

    return result.toLowerCase().includes(bundleIdOrName.toLowerCase());
  } catch {
    return false;
  }
}

function isLinuxAppFocused(processName?: string): boolean {
  if (!processName) return false;

  try {
    // Use xdotool to get the active window's process name
    const windowId = execSync("xdotool getactivewindow", {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();

    const pid = execSync(`xdotool getwindowpid ${windowId}`, {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();

    const comm = execSync(`cat /proc/${pid}/comm`, {
      encoding: "utf-8",
      timeout: 1000,
    }).trim();

    return comm.toLowerCase().includes(processName.toLowerCase());
  } catch {
    // xdotool might not be available, or we're in Wayland
    return false;
  }
}

function isWindowsAppFocused(processName?: string): boolean {
  if (!processName) return false;

  try {
    // PowerShell to get foreground window process
    const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
          [DllImport("user32.dll")]
          public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")]
          public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $pid = 0
      [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
      (Get-Process -Id $pid).ProcessName
    `;

    const result = execSync(
      `powershell -Command "${script.replace(/"/g, '\\"')}"`,
      {
        encoding: "utf-8",
        timeout: 2000,
      }
    ).trim();

    return result.toLowerCase().includes(processName.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Focus the terminal window.
 * Called when user clicks a notification.
 */
export function focusTerminal(terminal: TerminalInfo): void {
  const platform = process.platform;

  if (platform === "darwin" && terminal.bundleId) {
    try {
      execSync(`open -b "${terminal.bundleId}"`, { timeout: 2000 });
    } catch {
      // Ignore focus errors
    }
  }

  if (platform === "linux" && terminal.processName) {
    try {
      execSync(`wmctrl -a "${terminal.processName}"`, { timeout: 2000 });
    } catch {
      // wmctrl might not be available
    }
  }

  // Windows: Toast notifications can include activation arguments,
  // but focusing is typically handled by the toast action itself
}
