import type { Notifier, NotificationOptions, NotificationResult } from "./types";

/**
 * Linux notifier using D-Bus notifications.
 * Uses node-dbus-notifier when available for action button support.
 * Falls back to notify-send for basic notifications.
 */
export class LinuxNotifier implements Notifier {
  private dbusNotifier: DbusNotifierModule | null = null;

  async isAvailable(): Promise<boolean> {
    // Try to load the optional D-Bus notifier
    try {
      // Use a variable to prevent TypeScript from statically analysing the import
      const moduleName = "node-dbus-notifier";
      this.dbusNotifier = await import(moduleName) as DbusNotifierModule;
      return true;
    } catch {
      // Fall back to checking for notify-send
      return this.hasNotifySend();
    }
  }

  private hasNotifySend(): boolean {
    try {
      const { execSync } = require("node:child_process");
      execSync("which notify-send", { encoding: "utf-8", timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (this.dbusNotifier) {
      return this.notifyWithDbus(options);
    }
    return this.notifyWithNotifySend(options);
  }

  private async notifyWithDbus(
    options: NotificationOptions
  ): Promise<NotificationResult> {
    const { Notification } = this.dbusNotifier!;

    return new Promise((resolve) => {
      const notification = new Notification({
        summary: options.title,
        body: options.message,
        actions: this.buildDbusActions(options.actions),
        hints: {
          urgency: { type: "y", value: 2 }, // Critical urgency prevents auto-dismiss
        },
        timeout: options.timeout ? options.timeout * 1000 : 0,
      });

      notification.on("action", (actionKey: string) => {
        resolve({
          action: this.normaliseAction(actionKey),
          activated: true,
        });
      });

      notification.on("close", (reason: number) => {
        // reason: 1=expired, 2=dismissed, 3=closed, 4=undefined
        if (reason === 1) {
          resolve({ action: "dismissed", activated: false });
        }
      });

      notification.show().catch(() => {
        resolve({ action: "dismissed", activated: false });
      });
    });
  }

  private buildDbusActions(
    actions?: string[]
  ): Array<{ key: string; label: string }> {
    if (!actions || actions.length === 0) {
      return [];
    }

    return actions.map((label) => ({
      key: label.toLowerCase(),
      label,
    }));
  }

  private async notifyWithNotifySend(
    options: NotificationOptions
  ): Promise<NotificationResult> {
    const { execSync } = await import("node:child_process");

    const args: string[] = [];

    if (options.subtitle) {
      args.push(`${options.title}: ${options.subtitle}`);
    } else {
      args.push(options.title);
    }

    args.push(options.message);

    if (options.timeout) {
      args.push("-t", String(options.timeout * 1000));
    }

    // notify-send doesn't support actions, so we can only show the notification
    try {
      execSync(`notify-send ${args.map((a) => `"${a}"`).join(" ")}`, {
        timeout: 5000,
      });
    } catch {
      // Ignore errors
    }

    // Without D-Bus, we can't get action responses
    return { action: "dismissed", activated: false };
  }

  private normaliseAction(actionKey: string): string {
    const lowered = actionKey.toLowerCase();

    if (lowered === "accept") return "accept";
    if (lowered === "always") return "always";
    if (lowered === "reject") return "reject";

    return actionKey;
  }
}

// Type for the optional node-dbus-notifier module
interface DbusNotifierModule {
  Notification: new (options: {
    summary: string;
    body: string;
    actions?: Array<{ key: string; label: string }>;
    hints?: Record<string, { type: string; value: number }>;
    timeout?: number;
  }) => {
    on(event: "action", callback: (actionKey: string) => void): void;
    on(event: "close", callback: (reason: number) => void): void;
    show(): Promise<void>;
  };
}
