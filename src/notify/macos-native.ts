import { spawn } from "node:child_process";
import { existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import type { Notifier, NotificationOptions, NotificationResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

function debugLog(msg: string): void {
  appendFileSync(join(homedir(), ".opencode-notify.log"), `${new Date().toISOString()} [macos-native] ${msg}\n`);
}

/**
 * macOS notifier using native Notification Centre via OpenCodeNotifier.app.
 *
 * Shows notifications in the macOS Notification Centre with standard banner behaviour.
 * Uses NSUserNotificationCenter (legacy API) which works with linker-signed binaries.
 *
 * Trade-offs vs CFUserNotification (MacOSNotifier):
 * - Notifications appear in Notification Centre and respect Do Not Disturb
 * - Limited to a single action button rather than Accept/Always/Reject
 * - App name shows as "OpenCode Request"
 */
export class MacOSNativeNotifier implements Notifier {
  private notifierPath: string | null = null;

  async isAvailable(): Promise<boolean> {
    debugLog(`isAvailable called, platform=${process.platform}`);
    if (process.platform !== "darwin") {
      return false;
    }

    this.notifierPath = this.findNotifier();
    debugLog(`notifierPath=${this.notifierPath}`);
    return this.notifierPath !== null;
  }

  private findNotifier(): string | null {
    debugLog(`findNotifier: __dirname=${__dirname}`);
    debugLog(`findNotifier: import.meta.url=${import.meta.url}`);

    // Try multiple possible locations for the app bundle
    const possiblePaths = [
      // Primary: When bundled, __dirname is the dist folder where index.js lives
      join(__dirname, "OpenCodeNotifier.app", "Contents", "MacOS", "opencode-notifier"),
      // Fallback: One level up from dist/notify/
      join(__dirname, "..", "OpenCodeNotifier.app", "Contents", "MacOS", "opencode-notifier"),
      // Fallback: Two levels up
      join(__dirname, "..", "..", "OpenCodeNotifier.app", "Contents", "MacOS", "opencode-notifier"),
    ];

    for (const binaryPath of possiblePaths) {
      const exists = existsSync(binaryPath);
      debugLog(`Checking: ${binaryPath} = ${exists}`);
      if (exists) {
        return binaryPath;
      }
    }

    return null;
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.notifierPath) {
      throw new Error("OpenCodeNotifier not found");
    }

    const args: string[] = [
      "-native",  // Use native Notification Centre
      "-title",
      options.title,
      "-message",
      options.message,
    ];

    if (options.subtitle) {
      args.push("-subtitle", options.subtitle);
    }

    if (options.sound) {
      args.push("-sound", options.sound);
    }

    if (options.actions && options.actions.length > 0) {
      // For native notifications, only use the first non-dismiss action
      const primaryAction = options.actions.find(
        (a) => a.toLowerCase() !== "dismiss"
      );
      if (primaryAction) {
        args.push("-actions", primaryAction);
      }
    }

    if (options.timeout) {
      args.push("-timeout", String(options.timeout));
    }

    if (options.activateBundleId) {
      args.push("-sender", options.activateBundleId);
    }

    args.push("-json");

    return new Promise((resolve, reject) => {
      debugLog(`Spawning: ${this.notifierPath} ${args.join(" ")}`);
      debugLog(`Environment PATH: ${process.env.PATH}`);
      debugLog(`Current working directory: ${process.cwd()}`);
      const proc = spawn(this.notifierPath!, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code, signal) => {
        debugLog(`Process exited with code ${code}, signal ${signal}`);
        debugLog(`stdout: ${stdout}`);
        debugLog(`stderr: ${stderr}`);
        try {
          const result = JSON.parse(stdout);
          resolve({
            action: result.action ?? "dismissed",
            activated: result.activated ?? false,
          });
        } catch {
          resolve({
            action: "dismissed",
            activated: false,
          });
        }
      });

      proc.on("error", (err) => {
        debugLog(`Process error: ${err}`);
        reject(err);
      });
    });
  }
}
