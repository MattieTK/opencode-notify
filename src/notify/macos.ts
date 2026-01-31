import { execSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Notifier, NotificationOptions, NotificationResult } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * macOS notifier using alerter binary.
 * alerter provides native notifications with actionable buttons.
 * https://github.com/vjeantet/alerter
 */
export class MacOSNotifier implements Notifier {
  private alerterPath: string | null = null;

  async isAvailable(): Promise<boolean> {
    this.alerterPath = await this.findAlerter();
    return this.alerterPath !== null;
  }

  private async findAlerter(): Promise<string | null> {
    // Check bundled binary first
    const bundledPath = join(__dirname, "..", "..", "bin", "alerter");
    if (existsSync(bundledPath)) {
      return bundledPath;
    }

    // Check Homebrew installation
    try {
      const brewPath = execSync("which alerter", {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();
      if (brewPath && existsSync(brewPath)) {
        return brewPath;
      }
    } catch {
      // Not in PATH
    }

    // Check common Homebrew locations
    const homebrewPaths = [
      "/opt/homebrew/bin/alerter",
      "/usr/local/bin/alerter",
    ];

    for (const path of homebrewPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.alerterPath) {
      throw new Error("alerter binary not found");
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

    // -json returns structured output
    args.push("-json");

    return new Promise((resolve, reject) => {
      const proc = spawn(this.alerterPath!, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0 && code !== null) {
          // alerter returns non-zero for some valid outcomes
          // Parse stdout anyway
        }

        try {
          const result = JSON.parse(stdout);
          resolve({
            action: this.normaliseAction(result.activationValue),
            activated: result.activationType !== "timeout",
          });
        } catch {
          // Fallback to raw output parsing
          const trimmed = stdout.trim().toLowerCase();
          resolve({
            action: this.normaliseAction(trimmed),
            activated: trimmed !== "@timeout" && trimmed !== "@closed",
          });
        }
      });

      proc.on("error", reject);
    });
  }

  private normaliseAction(value: string): string {
    const lowered = value?.toLowerCase() ?? "";

    if (lowered === "accept" || lowered === "@actionclicked") {
      return "accept";
    }
    if (lowered === "always") {
      return "always";
    }
    if (lowered === "reject" || lowered === "@closebutton") {
      return "reject";
    }
    if (lowered === "@timeout" || lowered === "@closed") {
      return "dismissed";
    }

    return value;
  }
}
