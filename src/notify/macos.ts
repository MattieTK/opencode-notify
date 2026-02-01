import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Notifier, NotificationOptions, NotificationResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * macOS notifier using bundled OpenCodeNotifier app.
 * Uses CFUserNotification for native alert dialogs with action buttons.
 * No special permissions required.
 */
export class MacOSNotifier implements Notifier {
  private notifierPath: string | null = null;

  async isAvailable(): Promise<boolean> {
    this.notifierPath = this.findNotifier();
    return this.notifierPath !== null;
  }

  private findNotifier(): string | null {
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
      if (existsSync(binaryPath)) {
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
      args.push("-actions", options.actions.join(","));
    }

    if (options.timeout) {
      args.push("-timeout", String(options.timeout));
    }

    if (options.activateBundleId) {
      args.push("-sender", options.activateBundleId);
    }

    args.push("-json");

    return new Promise((resolve, reject) => {
      const proc = spawn(this.notifierPath!, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", () => {
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

      proc.on("error", reject);
    });
  }
}
