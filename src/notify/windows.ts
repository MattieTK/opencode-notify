import type { Notifier, NotificationOptions, NotificationResult } from "./types";

/**
 * Windows notifier using powertoast for native toast notifications.
 * Provides action button support on Windows 10 1709+.
 */
export class WindowsNotifier implements Notifier {
  private powertoast: PowerToastModule | null = null;

  async isAvailable(): Promise<boolean> {
    // Check Windows version (needs 10.0.16299 / 1709 or later)
    if (process.platform !== "win32") {
      return false;
    }

    try {
      this.powertoast = await import("powertoast");
      return true;
    } catch {
      return false;
    }
  }

  async notify(options: NotificationOptions): Promise<NotificationResult> {
    if (!this.powertoast) {
      throw new Error("powertoast module not available");
    }

    const { Toast } = this.powertoast;

    return new Promise((resolve) => {
      const toast = new Toast({
        title: options.title,
        message: options.message,
        appId: "com.opencode.notify",
        actions: this.buildToastActions(options.actions),
        audio:
          options.sound !== undefined
            ? { src: this.mapSoundToWindows(options.sound) }
            : undefined,
      });

      toast.on("activated", (event: { arguments?: string }) => {
        const action = event.arguments ?? "accept";
        resolve({
          action: this.normaliseAction(action),
          activated: true,
        });
      });

      toast.on("dismissed", (reason: { reason: string }) => {
        resolve({
          action: "dismissed",
          activated: false,
        });
      });

      toast.show().catch(() => {
        resolve({ action: "dismissed", activated: false });
      });
    });
  }

  private buildToastActions(
    actions?: string[]
  ): Array<{ content: string; arguments: string }> | undefined {
    if (!actions || actions.length === 0) {
      return undefined;
    }

    return actions.map((label) => ({
      content: label,
      arguments: label.toLowerCase(),
    }));
  }

  private mapSoundToWindows(macSound?: string): string {
    // Map macOS sound names to Windows toast sounds
    const soundMap: Record<string, string> = {
      Submarine: "ms-winsoundevent:Notification.Default",
      Glass: "ms-winsoundevent:Notification.IM",
      Basso: "ms-winsoundevent:Notification.Reminder",
      Ping: "ms-winsoundevent:Notification.Mail",
      Pop: "ms-winsoundevent:Notification.SMS",
    };

    return soundMap[macSound ?? ""] ?? "ms-winsoundevent:Notification.Default";
  }

  private normaliseAction(actionArg: string): string {
    const lowered = actionArg.toLowerCase();

    if (lowered === "accept") return "accept";
    if (lowered === "always") return "always";
    if (lowered === "reject") return "reject";

    return actionArg;
  }
}

// Type for the optional powertoast module
interface PowerToastModule {
  Toast: new (options: {
    title: string;
    message: string;
    appId?: string;
    actions?: Array<{ content: string; arguments: string }>;
    audio?: { src: string };
  }) => {
    on(
      event: "activated",
      callback: (event: { arguments?: string }) => void
    ): void;
    on(
      event: "dismissed",
      callback: (reason: { reason: string }) => void
    ): void;
    show(): Promise<void>;
  };
}
